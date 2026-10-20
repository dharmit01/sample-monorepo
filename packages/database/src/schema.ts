import { sql } from "drizzle-orm";
import { pgEnum, snakeCase, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { ROLES } from "@repo/validators";

export const roleEnum = pgEnum("role", ROLES);

// snakeCase: camelCase keys -> snake_case columns (v1 replaced the global `casing` option)
export const users = snakeCase.table("users", {
  id: uuid().primaryKey().default(sql`uuidv7()`), // native in PG18
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text().notNull(),
  role: roleEnum().notNull().default("user"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
