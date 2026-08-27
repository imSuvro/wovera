// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/", "**/dist/", "**/coverage/", "**/.expo/", "apps/"] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // The vault is typed end-to-end; `any` erodes that quietly.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);
