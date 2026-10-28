import { updateRoleInput } from "@repo/validators";
import { createTRPCRouter, permissionProcedure, roleProcedure } from "../../lib/trpc";
import { userController } from "./user.controller";

export const userRouter = createTRPCRouter({
  list: permissionProcedure("user:read").query(() => userController.list()),

  setRole: roleProcedure("admin")
    .input(updateRoleInput)
    .mutation(({ input }) => userController.setRole(input)),
});
