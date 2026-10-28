import { db, eq, users } from "@repo/database";
import type { Role } from "@repo/constants";

/** Columns safe to return to clients (no passwordHash). */
export const publicUser = { id: users.id, email: users.email, name: users.name, role: users.role };

export class UserDal {
  async findById(id: string) {
    const [user] = await db.select(publicUser).from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  }

  list() {
    return db.select(publicUser).from(users);
  }

  updateRole(id: string, role: Role) {
    return db.update(users).set({ role }).where(eq(users.id, id));
  }
}

export const userDal = new UserDal();
