import { createCallerFactory, createTRPCRouter } from "./lib/trpc";
import { authRouter } from "./modules/auth/auth.route";
import { userRouter } from "./modules/user/user.route";

// Register each module's router here
export const appRouter = createTRPCRouter({ auth: authRouter, user: userRouter });
export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
