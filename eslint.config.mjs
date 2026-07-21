import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    files: ["src/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/server/**"], message: "UI must use an explicit browser/server composition boundary, not server infrastructure." },
          { group: ["@/modules/**/infrastructure/**"], message: "UI must depend on typed contracts or a browser composition boundary, not repositories/adapters." },
        ],
      }],
    },
  },
]);

export default eslintConfig;
