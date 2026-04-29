// ESLint 9 flat config — workspace 전체 (packages/* + root scripts/tests).
//
// 룰셋:
//   - @eslint/js recommended (no-unused-vars, no-undef, ...)
//   - node globals (process, console, __dirname 등은 전역으로 인식)
//   - eslint-config-prettier (stylistic 룰 disable — Prettier 가 format 담당)
//
// import / cross-workspace 위반은 import-discipline.test.js 가 별도 가드.
// pre-commit hook 은 본 PR 시점 미도입 (CI lint job 으로 강제).

import js from '@eslint/js';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'packs/**', 'docs/examples/**', 'scripts/poc/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  prettierConfig,
];
