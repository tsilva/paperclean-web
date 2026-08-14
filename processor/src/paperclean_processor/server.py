"""Small authenticated HTTP adapter around the existing PaperClean CLI."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from PIL import Image
from paperclean.pdfs import page_count

from paperclean_processor import __version__

MAX_BYTES = 100 * 1024 * 1024
MAX_PAGES = 100
MAX_PIXELS = 100_000_000
MAX_JOB_SECONDS = 55 * 60


def safe_filename(value: str) -> str:
    decoded = urllib.parse.unquote(value)
    name = Path(decoded).name
    cleaned = "".join(character for character in name if character.isalnum() or character in "._-")
    if not cleaned or Path(cleaned).suffix.lower() not in {".pdf", ".jpg", ".jpeg", ".png"}:
        raise ValueError("unsupported file name")
    return cleaned[:180]


def estimate_max_charge_cents(pages: int) -> int:
    """Conservative v1 reservation; final billing uses observed successful-page cost."""
    if not 1 <= pages <= MAX_PAGES:
        raise ValueError("page count is outside the supported range")
    return 30 + pages * 600


def sign_payload(secret: str, timestamp: str, body: str) -> str:
    return hmac.new(
        secret.encode(), f"{timestamp}.{body}".encode(), hashlib.sha256
    ).hexdigest()


def callback(url: str, secret: str, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, separators=(",", ":"))
    timestamp = str(int(time.time()))
    request = urllib.request.Request(
        url,
        method="POST",
        data=body.encode(),
        headers={
            "content-type": "application/json",
            "x-paperclean-timestamp": timestamp,
            "x-paperclean-signature": sign_payload(secret, timestamp, body),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status >= 300:
                raise RuntimeError(f"callback failed with status {response.status}")
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"callback failed with status {error.code}") from error


def inspect_document(path: Path) -> int:
    if path.suffix.lower() == ".pdf":
        pages = page_count(path)
    else:
        with Image.open(path) as image:
            if image.width * image.height > MAX_PIXELS:
                raise ValueError("image exceeds the 100 megapixel limit")
        pages = 1
    if not 1 <= pages <= MAX_PAGES:
        raise ValueError("document exceeds the 100 page limit")
    return pages


def page_events(report: dict[str, Any]) -> list[dict[str, Any]]:
    pages = list(report.get("pages") or [])
    observed_micros = max(0, round(float(report.get("cost_usd") or 0) * 1_000_000))
    per_page, remainder = divmod(observed_micros, max(1, len(pages)))
    results: list[dict[str, Any]] = []
    for index, page in enumerate(pages):
        status = str(page.get("status") or "failed")
        chargeable = status not in {"original_fallback", "failed"}
        allocated = per_page + (1 if index < remainder else 0)
        results.append(
            {
                "pageNumber": int(page.get("page") or index + 1),
                "status": status,
                "attempts": min(3, len(page.get("attempts") or [])),
                "providerCostMicros": allocated if chargeable else 0,
                "fallbackReason": page.get("fallback_reason"),
            }
        )
    return results


class Handler(BaseHTTPRequestHandler):
    server_version = "PaperCleanProcessor/0.1"

    def log_message(self, format_: str, *args: object) -> None:
        sys.stderr.write(f"processor: {format_ % args}\n")

    def _json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._json(HTTPStatus.OK, {"ok": True, "version": __version__})
        else:
            self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path not in {"/inspect", "/process"}:
            self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("content-length") or "0")
            if not 0 < length <= MAX_BYTES:
                raise ValueError("request must contain a file no larger than 100 MB")
            job_id = self.headers.get("x-paperclean-job-id") or ""
            filename = safe_filename(self.headers.get("x-paperclean-file-name") or "")
            if len(job_id) < 8:
                raise ValueError("missing job identifier")
            with tempfile.TemporaryDirectory(prefix="paperclean-job-") as directory:
                source = Path(directory) / filename
                source.write_bytes(self.rfile.read(length))
                pages = inspect_document(source)
                if self.path == "/inspect":
                    self._json(
                        HTTPStatus.OK,
                        {
                            "pageTotal": pages,
                            "estimatedMaxChargeCents": estimate_max_charge_cents(pages),
                            "processorVersion": f"paperclean-processor/{__version__}",
                        },
                    )
                    return
                self._process(source, job_id)
        except (ValueError, OSError, json.JSONDecodeError) as error:
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except subprocess.TimeoutExpired:
            self._json(HTTPStatus.GATEWAY_TIMEOUT, {"error": "job exceeded the processing limit"})
        except Exception as error:  # defensive container boundary
            self.log_error("job failed: %s", type(error).__name__)
            self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "processing failed safely"})

    def _process(self, source: Path, job_id: str) -> None:
        callback_url = self.headers.get("x-paperclean-callback-url") or ""
        callback_secret = self.headers.get("x-paperclean-callback-secret") or ""
        openrouter_key = self.headers.get("x-openrouter-api-key") or ""
        if not callback_url.startswith("https://") or not callback_secret or not openrouter_key:
            raise ValueError("processor secrets are not configured")
        callback(
            callback_url,
            callback_secret,
            {"eventId": f"{job_id}:started", "type": "job.started"},
        )
        output = source.with_name(f"result{source.suffix.lower()}")
        environment = os.environ.copy()
        environment["OPENROUTER_API_KEY"] = openrouter_key
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "paperclean",
                str(source),
                "--output",
                str(output),
                "--backend",
                "openrouter",
                "--jobs",
                "1",
                "--max-attempts",
                "3",
                "--yes",
            ],
            env=environment,
            capture_output=True,
            text=True,
            timeout=MAX_JOB_SECONDS,
            check=False,
        )
        if result.returncode not in {0, 2} or not output.exists():
            raise RuntimeError("PaperClean did not produce a safe result")
        report_path = output.with_name(f"{output.name}.report.json")
        report = json.loads(report_path.read_text())
        for event in page_events(report):
            callback(
                callback_url,
                callback_secret,
                {
                    "eventId": f"{job_id}:page:{event['pageNumber']}",
                    "type": "page.completed",
                    **event,
                },
            )
        payload = output.read_bytes()
        content_type = {
            ".pdf": "application/pdf",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
        }[output.suffix.lower()]
        self.send_response(HTTPStatus.OK)
        self.send_header("content-type", content_type)
        self.send_header("content-length", str(len(payload)))
        self.send_header("x-paperclean-extension", output.suffix.lower().lstrip("."))
        self.end_headers()
        self.wfile.write(payload)


def main() -> None:
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    server.serve_forever()
