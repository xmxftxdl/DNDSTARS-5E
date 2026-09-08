import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

// MapsWorkspacePage.tsx is temporarily too large for the complete React Hooks compiler-rule
// bundle: linting this one file alone exceeds the 4 GiB CI heap. Keep the correctness-oriented
// rules below active until extractions make the normal repository config safe for this file again.
export default defineConfig([
  {
    files: ['src/pages/MapsWorkspacePage.tsx'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
    ],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
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
])
