import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { createCaller, createTRPCContext } from "@repo/backend";

/** Server Component caller. Reads the request, so call it inside <Suspense>. */
export const api = cache(async () =>
  // Cookies can't be set while rendering; auth mutations go through /api/trpc
  createCaller(await createTRPCContext({ headers: await headers(), resHeaders: new Headers() })),
);
