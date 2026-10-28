import { db, eq, users } from "@repo/database";
import { publicUser } from "../user/user.dal";

export class AuthDal {
  /** Includes passwordHash; never return this row to clients. */
  async findByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  }

  /** Returns null if the email is already registered. */
  async create(values: typeof users.$inferInsert) {
    const [user] = await db
      .insert(users)
      .values(values)
      .onConflictDoNothing({ target: users.email })
      .returning(publicUser);
    return user ?? null;
  }
}

export const authDal = new AuthDal();
