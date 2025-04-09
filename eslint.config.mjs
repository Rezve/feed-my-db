// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/out/**', '*.js']
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
        '@typescript-eslint/no-explicit-any': 'off'
    }
  }
);