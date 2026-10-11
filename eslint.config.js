// Lint exists here for one rule in particular: rules-of-hooks.
//
// A hook called after an early return runs a different number of hooks on
// different renders, and React responds by unmounting the tree - which on a
// booth screen means a student walks up to a blank kiosk. That failure is
// invisible to a type check and to a single static render, so it is caught
// statically instead.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'review/**', 'src/data/*.json'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Costs one extra render pass where it fires; never a correctness bug.
      // Left visible rather than silenced, but it does not block a build.
      'react-hooks/set-state-in-effect': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['scripts/**/*.{ts,tsx,mjs}'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
)
