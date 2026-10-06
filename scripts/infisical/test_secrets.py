"""Check transport, conflict handling, readback and application isolation."""

import contextlib
import io
import json
import os
import shutil
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from common import Infisical, SecretError, application_environment, KEYS
from migrate_keyenv import transfer
import run as launcher

PROJECT = "0bb3d445-14b3-437e-a1bb-eb1f5fcc81da"
VALUE = "dummy-only '$HOME' \"quoted\"\\backslash\nsecond line\n"


def row(value=VALUE, **overrides):
    return {
        "key": "CLERK_SECRET_KEY",
        "value": value,
        "workspace": PROJECT,
        "secretPath": "/",
        "type": "shared",
        **overrides,
    }


class SecretTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / ".infisical.json").write_text(json.dumps({"workspaceId": PROJECT}))
        self.client = Infisical(self.root)

    def test_dev_callbacks_use_the_selected_local_port(self):
        node = shutil.which("node")
        self.assertIsNotNone(node)
        fake_next = self.root / "next"
        fake_next.write_text(
            "#!" + node + "\n"
            "console.log(JSON.stringify({args:process.argv.slice(2),url:process.env.NEXT_PUBLIC_APP_URL}));\n"
        )
        fake_next.chmod(0o700)
        result = subprocess.run(
            [node, str(launcher.ROOT / "scripts/dev-server.mjs"), "next", "dev", "--port", "auto"],
            env={"PATH": str(self.root), "NEXT_PUBLIC_APP_URL": "https://production.invalid"},
            capture_output=True, text=True, timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        received = json.loads(result.stdout)
        port = received["args"][received["args"].index("--port") + 1]
        self.assertTrue(port.isdigit())
        self.assertEqual(received["url"], "http://localhost:" + port)

    def test_transport_is_stdin_only_and_exact(self):
        calls = []

        def cli(args, **kwargs):
            calls.append((args, kwargs))
            payload = [] if len(calls) == 1 else [row()]
            return subprocess.CompletedProcess(args, 0, json.dumps(payload), "")

        with patch("common.subprocess.run", side_effect=cli):
            self.assertIn(
                "verified", self.client.create_and_verify("CLERK_SECRET_KEY", VALUE)
            )
        args, kwargs = calls[1]
        self.assertNotIn(VALUE, " ".join(args))
        self.assertIn("CLERK_SECRET_KEY=@/dev/stdin", args)
        self.assertEqual(kwargs["input"], VALUE)
        self.assertTrue(kwargs["capture_output"])
        self.assertIn("--expand=false", calls[0][0])
        self.assertIn("--secret-overriding=false", calls[0][0])

    def test_identical_existing_value_causes_no_write(self):
        with (
            patch.object(self.client, "read", return_value={"CLERK_SECRET_KEY": VALUE}),
            patch.object(self.client, "command") as command,
        ):
            self.assertIn(
                "already present",
                self.client.create_and_verify("CLERK_SECRET_KEY", VALUE),
            )
            command.assert_not_called()

    def test_changed_readback_fails(self):
        with (
            patch.object(
                self.client, "read", side_effect=[{}, {"CLERK_SECRET_KEY": "different"}]
            ),
            patch.object(self.client, "command"),
        ):
            with self.assertRaisesRegex(SecretError, "Readback"):
                self.client.create_and_verify("CLERK_SECRET_KEY", VALUE)

    def test_conflict_preflight_prevents_all_writes(self):
        source = {
            "keys": {
                "STRIPE_SECRET_KEY": {"status": "available", "value": "dummy-new"},
                "CLERK_SECRET_KEY": {"status": "available", "value": VALUE},
            }
        }
        with (
            patch.object(
                self.client, "read", return_value={"CLERK_SECRET_KEY": "different"}
            ),
            patch.object(self.client, "create_and_verify") as create,
        ):
            with self.assertRaisesRegex(SecretError, "no credentials were written"):
                transfer(source, self.client)
            create.assert_not_called()

    def test_keychain_bindings_fail_closed(self):
        with patch.object(self.client, "read") as read:
            with self.assertRaisesRegex(SecretError, "bindings"):
                transfer(
                    {"keys": {"CLERK_SECRET_KEY": {"status": "binding-foreign"}}},
                    self.client,
                )
            read.assert_not_called()

    def test_destination_identity_and_duplicates_are_rejected(self):
        for rows in (
            [row(workspace="other-project")],
            [row(secretPath="/other")],
            [row(type="personal")],
            [row(), row()],
        ):
            with patch.object(self.client, "command", return_value=json.dumps(rows)):
                with self.assertRaises(SecretError):
                    self.client.read()

    def test_provider_error_details_never_escape(self):
        response = subprocess.CompletedProcess([], 1, VALUE, VALUE)
        with patch("common.subprocess.run", return_value=response):
            with self.assertRaises(SecretError) as error:
                self.client.read()
        self.assertNotIn(VALUE, str(error.exception))

    def test_app_environment_strips_tokens_stale_keys_and_untrusted_overrides(self):
        original = {
            "PATH": "/safe/bin",
            "BWS_ACCESS_TOKEN": "dummy-token",
            "INFISICAL_TOKEN": "dummy-token",
            "INFISICAL_CLIENT_SECRET": "dummy-token",
            "STRIPE_SECRET_KEY": "stale",
            "SENTRY_ORG": "tsilva",
        }
        with patch.dict(os.environ, original, clear=True):
            actual = application_environment(
                {"CLERK_SECRET_KEY": VALUE, "PATH": "/evil", "NODE_OPTIONS": "evil"}
            )
        self.assertEqual(actual["CLERK_SECRET_KEY"], VALUE)
        self.assertEqual(actual["PATH"], "/safe/bin")
        self.assertEqual(actual["SENTRY_ORG"], "tsilva")

        for key in KEYS:
            if key != "CLERK_SECRET_KEY":
                self.assertEqual(actual[key], "")
        for key in (
            "BWS_ACCESS_TOKEN",
            "INFISICAL_TOKEN",
            "INFISICAL_CLIENT_SECRET",
            "NODE_OPTIONS",
        ):
            self.assertNotIn(key, actual)

    def test_missing_infisical_key_cannot_fall_back_to_next_dotenv(self):
        (self.root / ".env").write_text("CLERK_SECRET_KEY=dummy-stale-dotenv-key\n")
        code = (
            "const {createRequire} = await import('node:module'); const req=createRequire(import.meta.url); const nextEnv=req(req.resolve('@next/env', {paths:[req.resolve('next/package.json', {paths:[process.cwd()]})]})); "
            "nextEnv.loadEnvConfig(process.argv[1], true, {info(){},error(){}}); "
            "process.stdout.write(JSON.stringify({hasKey:Boolean(process.env.CLERK_SECRET_KEY)}));"
        )
        environment = application_environment({})
        result = subprocess.run(
            ["node", "--input-type=module", "-e", code, str(self.root)],
            env=environment,
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertFalse(json.loads(result.stdout)["hasKey"])

    def test_launcher_rejects_environment_overrides_before_fetching(self):
        with (
            patch("run.sys.argv", ["run.py", "dev", "--env", "prod"]),
            patch("run.Infisical") as client,
            patch("run.os.execvpe") as execute,
        ):
            with self.assertRaises(SecretError):
                launcher.main()
            client.assert_not_called()
            execute.assert_not_called()

    def test_failed_infisical_fetch_never_launches_the_application(self):
        with (
            patch("run.sys.argv", ["run.py", "dev", "--port", "auto"]),
            patch("run.Infisical") as client,
            patch("run.os.execvpe") as execute,
        ):
            client.return_value.read.side_effect = SecretError("Fetch failed.")
            with self.assertRaises(SecretError):
                launcher.main()
            execute.assert_not_called()

    def test_report_skips_missing_keys_and_never_prints_values(self):
        output = io.StringIO()
        source = {
            "keys": {
                "CLERK_SECRET_KEY": {"status": "available", "value": VALUE},
                "STRIPE_SECRET_KEY": {"status": "missing"},
            }
        }
        with (
            patch.object(self.client, "read", return_value={}),
            patch.object(
                self.client,
                "create_and_verify",
                return_value="copied; verified matching",
            ),
            contextlib.redirect_stdout(output),
        ):
            report = transfer(source, self.client)
        self.assertIn("skipped", report["STRIPE_SECRET_KEY"])
        self.assertNotIn(VALUE, output.getvalue())


if __name__ == "__main__":
    unittest.main()
