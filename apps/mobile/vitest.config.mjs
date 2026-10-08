import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // UI suites use Jest + jest-expo; keep the existing Vitest command focused
    // on the app's logic and pure utility tests.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
      "src/**/*.ui.test.ts",
      "src/**/*.ui.test.tsx",
    ],
  },
});
