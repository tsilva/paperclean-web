#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createServer } from "node:net";

async function randomAvailablePort() {
  const server = createServer();

  return await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        if (!address || typeof address === "string") {
          reject(new Error("Could not resolve random server port"));
          return;
        }

        resolve(address.port);
      });
    });
  });
}

function usesServeListenFlag(command, args) {
  return command === "serve" || (command === "pnpm" && args[0] === "exec" && args[1] === "serve");
}

async function resolveAutoPortArgs(command, args) {
  const nextArgs = [...args];
  const serveListenFlag = usesServeListenFlag(command, args);

  for (let index = 0; index < nextArgs.length; index += 1) {
    const arg = nextArgs[index];

    if ((arg === "--port" || arg === "-p") && nextArgs[index + 1] === "auto") {
      const port = await randomAvailablePort();
      nextArgs[index] = serveListenFlag ? "--listen" : arg;
      nextArgs[index + 1] = String(port);
      console.error(`Using random available port ${port}`);
      return nextArgs;
    }

    if (arg === "--port=auto" || arg === "-p=auto") {
      const port = await randomAvailablePort();
      const [flag] = arg.split("=");
      nextArgs[index] = serveListenFlag ? `--listen=${port}` : `${flag}=${port}`;
      console.error(`Using random available port ${port}`);
      return nextArgs;
    }
  }

  return nextArgs;
}

async function main() {
  const supplied = process.argv.slice(2);
  const preview = supplied[0] === "--preview";
  if (preview) supplied.shift();
  const [command, ...rawArgs] = supplied;

  if (!command) {
    console.error("Usage: node scripts/dev-server.mjs <command> [...args]");
    process.exit(1);
  }

  const args = await resolveAutoPortArgs(command, rawArgs);
  const environment = { ...process.env };
  if (preview) for (const key of ["ASSET_RETENTION_SECONDS", "BWS_ACCESS_TOKEN", "CLERK_SECRET_KEY", "CLERK_WEBHOOK_SIGNING_SECRET", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ORCHESTRATOR_URL", "CLOUDFLARE_ORIGIN_SECRET", "DATABASE_URL", "INFISICAL_CLIENT_SECRET", "INFISICAL_TOKEN", "INFISICAL_UNIVERSAL_AUTH_ACCESS_TOKEN", "INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET", "JOB_CALLBACK_SECRET", "JOB_DISPATCH_SECRET", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "PAPERCLEAN_CONVERSION_ENABLED", "R2_ACCESS_KEY_ID", "R2_BUCKET", "R2_SECRET_ACCESS_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) environment[key] = "";
  if (command === "next" && args[0] === "dev") {
    const portIndex = args.findIndex((arg) => arg === "--port" || arg === "-p");
    const assignedPort = portIndex >= 0
      ? args[portIndex + 1]
      : args.find((arg) => /^--port=|^-p=/.test(arg))?.split("=")[1];
    if (assignedPort && /^\d+$/.test(assignedPort)) {
      environment.NEXT_PUBLIC_APP_URL = `http://localhost:${assignedPort}`;
    }
  }
  const child = spawn(command, args, {
    env: environment,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      child.kill(signal);
    });
  }

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
