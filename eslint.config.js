import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Formatting is enforced by the separate `prettier` script — running prettier
  // as an eslint rule (eslint-plugin-prettier) made lint runs take minutes.
  { ignores: ["dist", ".output", ".vinxi", ".tanstack", ".wrangler", ".vercel", "src/routeTree.gen.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Empty catch blocks are the codebase's intentional pattern for
      // best-effort operations (feature detection, pointer capture, etc.)
      "no-empty": ["error", { allowEmptyCatch: true }],
      // `cond && doThing()` short-circuit guards are used throughout
      "no-unused-expressions": ["error", { allowShortCircuit: true, allowTernary: true }],
      // The YouTube/InnerTube/yt-dlp integration layers parse untyped third-
      // party JSON; `any` there is deliberate JS-interop typing. Surfaced as
      // warnings so new usage stays visible without blocking the build.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
