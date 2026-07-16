import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist", "coverage", "src/api/schema.d.ts"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // TanStack Table is a settled dependency (docs/72 stack); the React
      // Compiler simply skips memoizing components that use it.
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    // Vendored shadcn/ui primitives + shared component modules export their
    // cva variants/helpers alongside components by convention.
    files: ["src/components/**/*.tsx", "src/theme/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}", "vite.config.ts", "scripts/**/*"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
);
