import { authRouter } from "./routers/auth";
import { userRouter } from "./routers/user";
import { createCallerFactory, createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({ auth: authRouter, user: userRouter });
export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
export { createTRPCContext } from "./trpc";
