import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

// Shared config for packages/*. apps/web uses eslint-config-next instead.
// typescript is pinned to 5.x in this package: typescript-eslint can't parse with the repo's TS 7.
export default defineConfig([js.configs.recommended, tseslint.configs.recommended]);
