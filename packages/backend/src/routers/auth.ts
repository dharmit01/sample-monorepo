import { TRPCError } from "@trpc/server";
import { eq, users } from "@repo/database";
import { loginInput, signupInput } from "@repo/validators";
import { hashPassword, sessionCookie, signToken, verifyPassword } from "../auth";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const authRouter = createTRPCRouter({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  signup: publicProcedure.input(signupInput).mutation(async ({ ctx, input }) => {
    const [user] = await ctx.db
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role });
    if (!user) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
    ctx.resHeaders.append("Set-Cookie", sessionCookie(await signToken(user.id)));
    return user;
  }),

  login: publicProcedure.input(loginInput).mutation(async ({ ctx, input }) => {
    const [user] = await ctx.db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (!user || !(await verifyPassword(input.password, user.passwordHash)))
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
    ctx.resHeaders.append("Set-Cookie", sessionCookie(await signToken(user.id)));
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }),

  logout: protectedProcedure.mutation(({ ctx }) => {
    ctx.resHeaders.append("Set-Cookie", sessionCookie("", 0));
  }),
});
