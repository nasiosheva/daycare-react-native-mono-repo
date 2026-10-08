module.exports = {
  preset: "jest-expo",
  rootDir: __dirname,
  testMatch: ["<rootDir>/src/**/*.ui.test.ts", "<rootDir>/src/**/*.ui.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/src/test/uiSetup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@daycare/ui$": "<rootDir>/../../packages/ui/src/index.ts",
    "^@daycare/(.*)$": "<rootDir>/../../packages/$1/src",
  },
  // Keep Expo/RN Flow-bearing packages transformable in both the pnpm store
  // path and a flat node_modules install. Other dependencies stay external so
  // the UI suite remains quick as more screen tests are added.
  transformIgnorePatterns: [
    "node_modules/.pnpm/(?!(?:@?react-native\\+|react-native@|@expo\\+|expo[^/]*@|jest-expo@|@testing-library\\+react-native@))",
    "node_modules/(?!\\.pnpm/)(?!(?:react-native|@react-native|expo[^/]*|@expo|@testing-library/react-native|jest-expo)/)",
  ],
};
