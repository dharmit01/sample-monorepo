import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { MESSAGES, PERMISSIONS, type Permission, type Role, SESSION_COOKIE } from "@repo/constants";
import { userDal } from "../modules/user/user.dal";
import { readCookie, verifyToken } from "./auth";

/** resHeaders lets procedures set cookies on the HTTP response. */
export async function createTRPCContext(opts: { headers: Headers; resHeaders: Headers }) {
  const token = readCookie(opts.headers.get("cookie"), SESSION_COOKIE);
  const userId = token ? await verifyToken(token) : null;
  // JWT proves identity; role is read fresh so changes/deletions apply immediately
  const user = userId ? await userDal.findById(userId) : null;
  return { user, resHeaders: opts.resHeaders };
}

const t = initTRPC.context<typeof createTRPCContext>().create({ transformer: superjson });

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: MESSAGES.auth.unauthorized });
  return next({ ctx: { user: ctx.user } });
});

export const roleProcedure = (...roles: Role[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.user.role))
      throw new TRPCError({ code: "FORBIDDEN", message: MESSAGES.auth.forbidden });
    return next();
  });

export const permissionProcedure = (...required: Permission[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!required.every((p) => PERMISSIONS[ctx.user.role].includes(p)))
      throw new TRPCError({ code: "FORBIDDEN", message: MESSAGES.auth.forbidden });
    return next();
  });
