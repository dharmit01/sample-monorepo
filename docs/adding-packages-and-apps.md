# Adding a package or app

```
apps/        deployable apps (web = Next.js frontend, also serves the backend at /api/trpc)
packages/    shared code, imported by name as @repo/<name>
```

`pnpm-workspace.yaml` already includes every folder under `apps/*` and `packages/*`, so a new folder only needs a `package.json` to become part of the workspace.

## How packages work in this repo

- **No build step.** A package exports its TypeScript source (`"exports": { ".": "./src/index.ts" }`). Whoever imports it compiles it: Next.js bundles it into the app, `tsc` typechecks it.
- **Linked locally.** Consumers depend on `"workspace:*"`, which always resolves to the folder in this repo. Nothing is published.
- **Tooling comes from the root.** `tsc`, `eslint` and `prettier` are root devDependencies, so a package doesn't install them. It only needs `@repo/eslint-config` for its lint config.
- **Turbo finds scripts by name.** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm dev` run the script of that name in every package that defines it.

Current packages:

| Package               | What it holds                                                  | Used by                       |
| --------------------- | -------------------------------------------------------------- | ----------------------------- |
| `@repo/constants`     | Roles, permissions, session settings, limits, routes, messages | everything                    |
| `@repo/validators`    | Zod input schemas, one file per module                         | backend, web                  |
| `@repo/database`      | Drizzle client, schema, migrations                             | backend                       |
| `@repo/backend`       | tRPC routers (route → controller → service → dal per module)   | web                           |
| `@repo/eslint-config` | Shared ESLint config for `packages/*`                          | every package (devDependency) |

Keep dependencies flowing one way: `constants` → `validators` / `database` → `backend` → apps. A package must never import from something that depends on it (for example `constants` imports nothing).

## Add a package

Example: `@repo/utils`.

**1. Create the files**

`packages/utils/package.json`

```json
{
  "name": "@repo/utils",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*"
  }
}
```

Add `"test": "node --test 'src/**/*.test.ts'"` if the package has tests. Keep the quotes so Node expands the glob, not the shell (the shell's `**` doesn't search subfolders).

`packages/utils/tsconfig.json`

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

`packages/utils/eslint.config.mjs`

```js
export { default } from "@repo/eslint-config";
```

`packages/utils/src/index.ts`

```ts
export const fullName = (first: string, last: string) => `${first} ${last}`.trim();
```

**2. Install**

```bash
pnpm install
```

**3. Third-party dependencies (if any)**

```bash
pnpm --filter @repo/utils add <dependency>       # runtime
pnpm --filter @repo/utils add -D <dependency>    # dev only
```

## Use a package from another package or app

**1. Add it as a dependency of the consumer**

```bash
pnpm --filter @repo/backend add @repo/utils --workspace
```

This writes `"@repo/utils": "workspace:*"` into the consumer's `package.json` and links it. If you edit `package.json` by hand instead, run `pnpm install` afterwards. Until you do, imports fail with `Cannot find module '@repo/utils'`.

**2. Import it by name**

```ts
import { fullName } from "@repo/utils";
```

Always import through the package name, never through a relative path like `../../packages/utils/src`.

**3. If the consumer is `apps/web`**, also add the package to `transpilePackages` in `apps/web/next.config.ts`:

```ts
transpilePackages: ["@repo/backend", "@repo/constants", "@repo/database", "@repo/utils", "@repo/validators"],
```

Turbopack currently compiles workspace packages even without this. It's listed for every workspace package so they behave the same if the bundler or Next.js defaults change.

**4. Check everything**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
```

The Docker image needs no change for a new package. It copies the whole workspace and installs from the lockfile.

## Add an app

**1. Create `apps/<name>/` with a `package.json`.** Apps are unscoped (like `web`) and define the scripts Turbo runs:

```json
{
  "name": "admin",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "eslint",
    "typecheck": "next typegen && tsc --noEmit"
  }
}
```

Give each app its own port; `web` uses 3000. Then add its dependencies (`next`, `react`, `react-dom`, `typescript`, `eslint-config-next`, …) with `pnpm --filter <name> add`.

**2. Config.** For a Next.js app, copy the relevant parts of `apps/web`:

- `next.config.ts`: loads the root `.env`, lists `transpilePackages`, sets `output: "standalone"` for Docker
- `tsconfig.json` and `eslint.config.mjs` (Next.js apps use `eslint-config-next`, not `@repo/eslint-config`)

For a plain Node app, use the package setup above (`tsconfig.json` extending `tsconfig.base.json`, `@repo/eslint-config`).

**3. Turbo (`turbo.json`)**

- If the build writes somewhere other than `.next/`, add that folder to `tasks.build.outputs` (for example `"dist/**"`) so Turbo can cache it.
- Add any new environment variable to `globalEnv`. Turbo runs tasks in strict env mode: variables that aren't listed are hidden from tasks and don't count toward the cache key.

**4. Use packages** exactly as described above (`pnpm --filter <app> add @repo/<package> --workspace`).

To call the backend from a new app, either:

- point a tRPC client typed with `AppRouter` from `@repo/backend` at `web`'s `/api/trpc`, or
- serve the API from the new app too. Copy `apps/web/app/api/trpc/[trpc]/route.ts`, which uses `appRouter` and `createTRPCContext` from `@repo/backend`.

**5. Docker.** The `Dockerfile` builds only `web`. A new deployable app needs:

- its own build and runner stages in the `Dockerfile` (copy the `build` and `runner` stages and change the paths)
- a service in `docker-compose.yml` under the `app` profile.

## Gotchas

- **Packages loaded by plain Node.** The backend tests run with `node --test`, which strips TypeScript types but can't resolve relative imports without a file extension (`./foo` instead of `./foo.ts`). Any package those tests import must avoid them. That's why `@repo/constants` is a single file with no imports. If you split it, run `pnpm test` to confirm the tests still load.
- **Two TypeScript versions.** Packages are typechecked with the root TypeScript 7. `apps/web` and ESLint's parser use TypeScript 5.9. Stick to standard TypeScript that works in both.
- **Commit `pnpm-lock.yaml`** whenever a dependency changes.
