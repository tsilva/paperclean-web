import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { requiredEnv } from "@/lib/env";
import * as schema from "@/lib/db/schema";

let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase() {
  const client = neon(requiredEnv("DATABASE_URL"));
  return drizzle(client, { schema });
}

export function db() {
  database ??= createDatabase();
  return database;
}
