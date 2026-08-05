import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: 'Use showAppAlert() from src/lib/appDialog.ts.' },
        { name: 'confirm', message: 'Use showAppConfirm() from src/lib/appDialog.ts.' },
        { name: 'prompt', message: 'Use showAppPrompt() from src/lib/appDialog.ts.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'alert', message: 'Use showAppAlert() instead.' },
        { object: 'window', property: 'confirm', message: 'Use showAppConfirm() instead.' },
        { object: 'window', property: 'prompt', message: 'Use showAppPrompt() instead.' },
        { object: 'globalThis', property: 'alert', message: 'Use showAppAlert() instead.' },
        { object: 'globalThis', property: 'confirm', message: 'Use showAppConfirm() instead.' },
        { object: 'globalThis', property: 'prompt', message: 'Use showAppPrompt() instead.' },
      ],
    },
  },
  {
    files: ['src/pages/MapsPage.tsx'],
    rules: {
      // MapsPage still mirrors authoritative async state in refs while its
      // transaction coordinators are migrated behind Application services.
      // The refs are projections, not React-owned mutable props.
      'react-hooks/immutability': 'off',
    },
  },
])
