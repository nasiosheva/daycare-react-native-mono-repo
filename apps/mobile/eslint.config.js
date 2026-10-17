const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

// Mories Deo Hutapea,S.E.,S.Kom

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", ".expo/*"] },
  {
    files: ["app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "react-native",
          importNames: ["Alert"],
          message: "Use the shared notify helper so screen feedback works consistently on web and native.",
        }],
      }],
      "no-restricted-syntax": ["error", {
        selector: 'ImportDeclaration[source.value="react-native"] > ImportNamespaceSpecifier',
        message: "Import only the React Native APIs a route needs; use shared notify instead of Alert.alert.",
      }],
    },
  },
  {
    files: ["app/_layout.tsx"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },
]);
