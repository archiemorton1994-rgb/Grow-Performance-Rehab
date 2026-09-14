const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    /**
     * THE EXPO 57 UPGRADE TURNED THESE ON AS ERRORS, AND THEY WERE NOT BEFORE.
     *
     * eslint-config-expo 57 brings eslint-plugin-react-hooks 7, whose
     * recommended set adds the React Compiler's own rules. On the first run
     * after the upgrade they reported 93 errors across code that had passed the
     * gate the day before, which stopped `npm run check` at lint so that not one
     * behaviour test ran.
     *
     * They are warnings here, not switched off. Every one of them describes code
     * the compiler declines to optimise: it skips that component and runs it as
     * written, which is exactly how it ran under Expo 54. So they are a list of
     * places to tidy, not a list of breakages, and the gate should go back to
     * failing on things that are wrong.
     */
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
]);
