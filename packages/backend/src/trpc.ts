import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { db, eq, users } from "@repo/database";
import type { Role } from "@repo/validators";
import { readCookie, SESSION_COOKIE, verifyToken } from "./auth";

/** resHeaders lets procedures set cookies on the HTTP response. */
export async function createTRPCContext(opts: { headers: Headers; resHeaders: Headers }) {
  const token = readCookie(opts.headers.get("cookie"), SESSION_COOKIE);
  const userId = token ? await verifyToken(token) : null;
  // JWT proves identity; role is read fresh so changes/deletions apply immediately
  const [user] = userId
    ? await db
        .select({ id: users.id, email: users.email, name: users.name, role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
    : [];
  return { db, user: user ?? null, resHeaders: opts.resHeaders };
}

const t = initTRPC.context<typeof createTRPCContext>().create({ transformer: superjson });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { user: ctx.user } });
});

export type Permission = "user:read" | "user:write" | "post:write" | "post:delete";

const permissions: Record<Role, Permission[]> = {
  admin: ["user:read", "user:write", "post:write", "post:delete"],
  editor: ["user:read", "post:write"],
  user: [],
};

export const roleProcedure = (...roles: Role[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
    return next();
  });

export const permissionProcedure = (...required: Permission[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!required.every((p) => permissions[ctx.user.role].includes(p)))
      throw new TRPCError({ code: "FORBIDDEN" });
    return next();
  });
