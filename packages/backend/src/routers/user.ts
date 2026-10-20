import { eq, users } from "@repo/database";
import { updateRoleInput } from "@repo/validators";
import { createTRPCRouter, permissionProcedure, roleProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  list: permissionProcedure("user:read").query(({ ctx }) =>
    ctx.db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role })
      .from(users),
  ),

  setRole: roleProcedure("admin")
    .input(updateRoleInput)
    .mutation(({ ctx, input }) =>
      ctx.db.update(users).set({ role: input.role }).where(eq(users.id, input.userId)),
    ),
});
