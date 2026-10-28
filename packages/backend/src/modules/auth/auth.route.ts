import { loginInput, signupInput } from "@repo/validators";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../../lib/trpc";
import { authController } from "./auth.controller";

export const authRouter = createTRPCRouter({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  signup: publicProcedure
    .input(signupInput)
    .mutation(({ ctx, input }) => authController.signup(input, ctx.resHeaders)),

  login: publicProcedure
    .input(loginInput)
    .mutation(({ ctx, input }) => authController.login(input, ctx.resHeaders)),

  logout: protectedProcedure.mutation(({ ctx }) => authController.logout(ctx.resHeaders)),
});
