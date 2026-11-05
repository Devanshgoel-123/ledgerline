// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'src/pdf/readerHtml.generated.*'],
  },
  {
    // Config plugins run in Node during prebuild.
    files: ['plugins/**/*.js'],
    languageOptions: { globals: { __dirname: 'readonly', require: 'readonly', module: 'writable' } },
  },
  {
    // Tests run on Node, where node:sqlite stands in for expo-sqlite.
    files: ['tests/**'],
    settings: { 'import/core-modules': ['node:sqlite'] },
  },
]);
