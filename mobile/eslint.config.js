// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const reactNativeA11y = require('eslint-plugin-react-native-a11y');

// Plugin has no `recommended` preset; `basic` is cross-platform. Guard against the plugin
// dropping/renaming this export in a future version so lint fails loudly, not with a cryptic
// TypeError. Omit has-accessibility-hint — labels alone satisfy 7.1/7.2; hints are added where
// UX warrants, not on every labeled element.
if (!reactNativeA11y.configs?.basic?.rules) {
  throw new Error(
    'eslint-plugin-react-native-a11y: expected configs.basic.rules to exist — plugin API may have changed.'
  );
}
const a11yRules = { ...reactNativeA11y.configs.basic.rules };
delete a11yRules['react-native-a11y/has-accessibility-hint'];

module.exports = defineConfig([
  expoConfig,
  {
    files: ['**/*.jsx', '**/*.tsx'],
    plugins: {
      'react-native-a11y': reactNativeA11y,
    },
    rules: a11yRules,
  },
  {
    ignores: ['dist/*'],
  },
]);
