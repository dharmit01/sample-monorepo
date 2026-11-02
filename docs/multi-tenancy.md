# Multi-tenancy: supporting multiple colleges

**Status:** not implemented. The app currently serves a single college. This guide is the plan for when more colleges need to share one deployment. Each college is a _tenant_.

> **When to do it:** adding a `college_id` column is cheap while tables are small and there is little data. Retrofitting it later means backfilling every table. If a second college is likely, do steps 1–3 below early.

## Recommended model: shared tables with a `college_id` column

All colleges share one database and the same tables. Every row that belongs to a college carries a `college_id`, and every query filters by it.

| Model                                     | Isolation                            | Operational cost                          | Choose when                                           |
| ----------------------------------------- | ------------------------------------ | ----------------------------------------- | ----------------------------------------------------- |
| **Shared tables + `college_id`** (chosen) | App code, plus optional Postgres RLS | One database, one migration run           | Many colleges with the same features                  |
| Schema per college                        | Separate Postgres schemas            | Every migration runs once per college     | A few colleges that demand strict separation          |
| Database per college                      | Separate databases                   | Infra, backups and migrations per college | Contractual data residency, or one very large college |

The shared model doesn't rule out the others. Because every row is tagged with `college_id`, a college that later needs its own database can be exported and moved on its own.

## The rules

These must hold for every feature, not just the first one.

1. **Every college-owned table has `college_id uuid NOT NULL`**, with a foreign key to `colleges`.
2. **The college comes from the server, never from the client.** It is read from the signed-in user's record. No tRPC input ever contains `collegeId`.
3. **Every query on a college-owned table filters by `college_id`.** That includes reads, updates, deletes and joins. Inserts set it from the request context.
4. **Another college's record is reported as `NOT_FOUND`, not `FORBIDDEN`.** Don't confirm that it exists.
5. **Anything stored outside the database is keyed by college.** That covers cache keys, file storage paths, background job payloads and logs.

## Changes to the current code

### 1. Database: `packages/database/src/schema.ts`

Add a `colleges` table and a `collegeId` column to `users` and to every college-owned table:

```ts
export const colleges = snakeCase.table("colleges", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  name: text().notNull(),
  slug: text().notNull().unique(), // URL key, e.g. the subdomain
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const users = snakeCase.table("users", {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  collegeId: uuid()
    .notNull()
    .references(() => colleges.id),
  email: text().notNull().unique(),
  // ...existing columns
});

// Example of a future college-owned table
export const students = snakeCase.table(
  "students",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    collegeId: uuid()
      .notNull()
      .references(() => colleges.id),
    rollNo: text().notNull(),
    name: text().notNull(),
  },
  (t) => [unique().on(t.collegeId, t.rollNo)], // roll numbers repeat across colleges
);
```

- **Uniqueness is per college.** Business keys such as roll numbers, course codes and class names get a composite `unique(college_id, …)`.
- **Indexes.** Every college-owned table needs an index whose first column is `college_id`. A composite unique that starts with `college_id` already provides one.
- **Email stays globally unique.** Login looks a user up by email alone, which only works if an email maps to one user. The trade-off: one email can't have accounts at two colleges. If that's ever needed, see [Users in more than one college](#later-users-in-more-than-one-college).

**Migrating existing data.** A new `NOT NULL` column fails on tables that already have rows, so do it in two migrations:

1. Add `collegeId` _without_ `.notNull()`, then generate:
   ```bash
   pnpm db:generate
   ```
2. Create an empty migration for the backfill:
   ```bash
   pnpm --filter @repo/database exec drizzle-kit generate --custom --name=backfill-college
   ```
   In it, insert the existing college and assign it to every row:
   ```sql
   INSERT INTO colleges (name, slug) VALUES ('Main College', 'main');
   UPDATE users SET college_id = (SELECT id FROM colleges WHERE slug = 'main');
   ```
3. Add `.notNull()` back, run `pnpm db:generate` again, then `pnpm db:migrate`.

### 2. Request context: `packages/backend/src/lib/trpc.ts`

The context already loads the user from the database on every request, so the college travels with the user. The JWT doesn't change; it still holds only the user id. Moving a user to another college therefore takes effect on their next request.

- Add `collegeId: users.collegeId` to `publicUser` in `modules/user/user.dal.ts`.
- Expose the college on every authenticated procedure:

```ts
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: MESSAGES.auth.unauthorized });
  return next({ ctx: { user: ctx.user, collegeId: ctx.user.collegeId } });
});
```

`roleProcedure` and `permissionProcedure` are built on `protectedProcedure`, so they get `ctx.collegeId` automatically.

### 3. Modules: route → controller → service → dal

Pass `ctx.collegeId` down from the route. Make it the first parameter of every DAL method, and filter on it in every query:

```ts
// modules/user/user.route.ts
list: permissionProcedure("user:read").query(({ ctx }) => userController.list(ctx.collegeId)),

setRole: roleProcedure("admin")
  .input(updateRoleInput)
  .mutation(({ ctx, input }) => userController.setRole(ctx.collegeId, input)),
```

```ts
// modules/user/user.dal.ts
list(collegeId: string) {
  return db.select(publicUser).from(users).where(eq(users.collegeId, collegeId));
}

updateRole(collegeId: string, id: string, role: Role) {
  return db
    .update(users)
    .set({ role })
    .where(and(eq(users.collegeId, collegeId), eq(users.id, id)));
}
```

Today `updateRole` matches on the user id alone. Once there are several colleges, that version would let an admin of college A change roles in college B by sending a user id from B. Scoping the `where` clause blocks this. If an update or delete affects 0 rows, the service should throw `NOT_FOUND`.

Controllers and services only pass `collegeId` along. The checks belong in the DAL, which every query goes through.

### 4. Validators and constants

- `@repo/validators`: never add `collegeId` to an input schema. The only exception is platform-admin endpoints (see below).
- `@repo/constants`: add new messages under their own key, e.g. `MESSAGES.college.notFound`. `ROLES` and `PERMISSIONS` stay as they are. A role already applies within one college, because each user belongs to exactly one college.

### 5. Signup and onboarding

Today anyone can sign up. With several colleges, the server has to decide which college a new account joins. Pick one:

- **Invite links (recommended for colleges).** A college admin creates an invite, and signup with the invite token puts the user in that college.
- **Signup on the college's subdomain.** The college comes from the host name (see below).

Either way, `authService.signup` receives the college from the server side, never from the signup form. Colleges themselves are created by a platform admin, through a seed script or an admin app.

### 6. Frontend: `apps/web`

- Return the college (`id`, `name`, `slug`) from `auth.me` and show it in `components/app-sidebar.tsx`, replacing the "Acme Inc." placeholder. Per-college branding (logo, colours) becomes extra columns on `colleges`.
- **Caching.** If you use `"use cache"`, the cache key comes from the function's arguments. A cached function that returns college data must take `collegeId` as an argument; otherwise one college's data could be served to another.

## Optional: a subdomain per college

`abc.example.com` for college `abc`. It's useful for branding and login pages before anyone is signed in. Resolve the college in `createTRPCContext`, which already receives the request headers:

```ts
const slug = opts.headers.get("host")?.split(".")[0];
const college = slug ? await collegeDal.findBySlug(slug) : null;
// ...load user as today...
// A session used on another college's subdomain counts as logged out
const user = loadedUser && college && loadedUser.collegeId === college.id ? loadedUser : null;
return { college, user, resHeaders: opts.resHeaders };
```

- **Cookies are already isolated per host.** `sessionCookie` in `lib/auth.ts` sets no `Domain`, so a session cookie from `abc.example.com` is never sent to `xyz.example.com`. Keep it that way.
- **Local development:** Chrome and Firefox resolve `*.localhost` to your machine, so `abc.localhost:3000` works without DNS changes. For other browsers, add an entry to `/etc/hosts`.
- **Production:** you need a wildcard DNS record (`*.example.com`) and a wildcard TLS certificate. If a reverse proxy rewrites `Host`, read `x-forwarded-host` instead.
- **Unknown subdomains:** to redirect them before rendering, use `proxy.ts`. Next.js 16 renamed `middleware.ts` to `proxy.ts`; see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- **The college lookup** belongs in a new `college` module (`modules/college/` with the usual four files). See [adding-packages-and-apps.md](./adding-packages-and-apps.md).

## Optional: Postgres row-level security

This is a safety net under rule 3. Even if a query forgets its `college_id` filter, Postgres returns only the current college's rows. Enable it on college-owned tables:

```ts
const isCurrentCollege = (collegeId: unknown) =>
  sql`${collegeId} = current_setting('app.college_id', true)::uuid`;

export const students = snakeCase.table.withRLS("students", {/* columns as above */}, (t) => [
  unique().on(t.collegeId, t.rollNo),
  pgPolicy("college_isolation", {
    using: isCurrentCollege(t.collegeId),
    withCheck: isCurrentCollege(t.collegeId),
  }),
]);
```

The setting has to be set inside a transaction for each request. A helper in `packages/database/src/index.ts`:

```ts
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function withCollege<T>(collegeId: string, fn: (tx: Tx) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.college_id', ${collegeId}, true)`); // local to this transaction
    return fn(tx);
  });
}

// in a DAL
list(collegeId: string) {
  return withCollege(collegeId, (tx) => tx.select().from(students).where(eq(students.collegeId, collegeId)));
}
```

Caveats:

- **Superusers and table owners bypass RLS.** The `postgres` user in `docker-compose.yml` is a superuser, so policies have no effect for it. The app needs its own non-superuser role in `DATABASE_URL`. Migrations keep using the owner role. Alternatively, run `ALTER TABLE … FORCE ROW LEVEL SECURITY` so the owner is subject to the policies too.
- **No setting means no rows.** If `app.college_id` isn't set, `current_setting(..., true)` returns `NULL` and the policy matches nothing. That fails safe, but a forgotten `withCollege` shows up as empty results rather than an error.
- **Connection poolers are fine.** `set_config(..., true)` only lasts for the transaction, so PgBouncer in transaction mode works.

## Later: users in more than one college

Needed if staff work at several colleges, or one person studies at two:

- Add `memberships(user_id, college_id, role)` with `unique(user_id, college_id)`, and move `role` off `users`.
- Determine the active college per request, from the subdomain or a college switcher stored in the session. Then load the membership for `(userId, collegeId)` in the context and take the role from it.
- When the user switches college on the client, clear the React Query cache (`queryClient.clear()`).

## Platform administration

Managing colleges (creating them, suspending them, support access) is not a college role:

- Mark platform admins separately: a `platform_admins` table or a `users.isPlatformAdmin` flag. Don't add a value to `ROLES`.
- Give them a separate `platformProcedure`. These endpoints are the only ones that accept a `collegeId` in their input.
- Consider a separate app for this (`apps/admin`). See [adding-packages-and-apps.md](./adding-packages-and-apps.md).

## Checklist for every new feature

- [ ] New table has `collegeId: uuid().notNull().references(() => colleges.id)`
- [ ] Business keys are unique per college: `unique().on(t.collegeId, …)`
- [ ] Every DAL method takes `collegeId` first and filters on it, including updates, deletes and joins
- [ ] Inserts set `collegeId` from `ctx.collegeId`
- [ ] No input schema contains `collegeId` (except platform-admin endpoints)
- [ ] Records from another college return `NOT_FOUND`
- [ ] Cached functions, file paths and job payloads include the college
- [ ] Isolation test added (below)

## Testing isolation

For each module, add one test that creates two colleges, signs in as a user of college A, and calls every procedure with ids that belong to college B. Reads must come back empty or `NOT_FOUND`, and writes must change nothing. Use `createCaller` from `@repo/backend` with a context built for that user, against a test database.

These tests import `@repo/database`, whose files use relative imports without file extensions. Plain `node --test` can't resolve those, so they need a runner that can, such as Vitest.
