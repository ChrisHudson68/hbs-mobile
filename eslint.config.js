// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = defineConfig([
  expoConfig,
  {
    // React Compiler correctness rules now live in eslint-plugin-react-hooks v7
    // (replacing the deprecated eslint-plugin-react-compiler). eslint-config-expo
    // on SDK 54 still bundles an OLDER react-hooks (only rules-of-hooks +
    // exhaustive-deps); the compiler-aware rules auto-merge in SDK 55+. Until then
    // we register v7 under an ALIAS namespace so it adds the compiler rules WITHOUT
    // redefining expo's `react-hooks` plugin. React Compiler is ON (app.json
    // experiments.reactCompiler), so these flag Rules-of-React the compiler would
    // otherwise SILENTLY skip/miscompile. 'warn' (not 'error') to surface without
    // breaking the build until a test gate exists.
    plugins: { 'react-compiler-rules': reactHooks },
    rules: {
      'react-compiler-rules/set-state-in-render': 'warn',
      'react-compiler-rules/set-state-in-effect': 'warn',
      'react-compiler-rules/immutability': 'warn',
      'react-compiler-rules/refs': 'warn',
      'react-compiler-rules/purity': 'warn',
      'react-compiler-rules/preserve-manual-memoization': 'warn',
      'react-compiler-rules/static-components': 'warn',
      'react-compiler-rules/globals': 'warn',
      'react-compiler-rules/incompatible-library': 'warn',
    },
  },
  {
    ignores: ['dist/*'],
  },
]);
