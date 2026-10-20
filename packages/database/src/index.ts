import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Reuse connection across Next dev hot reloads
const g = globalThis as unknown as { pg?: postgres.Sql };
const client = g.pg ?? postgres(process.env.DATABASE_URL!);
if (process.env.NODE_ENV !== "production") g.pg = client;

export const db = drizzle({ client });
export type DB = typeof db;
export * from "./schema";
export * from "drizzle-orm"; // eq/and/etc from one instance
