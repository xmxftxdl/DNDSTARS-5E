import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import AppDialogHost from './components/AppDialogHost.tsx'
import PageErrorBoundary from './components/PageErrorBoundary.tsx'
import { initializeAppTheme } from './lib/appTheme.ts'

initializeAppTheme()

const publicWebsitePaths = new Set(['/', '/combat', '/extension', '/extensions', '/blog', '/pricing'])
if (!publicWebsitePaths.has(window.location.pathname)) {
  const {
    ensureDnd5eRulesPluginHost,
  } = await import('./rulesets/dnd5e/pluginLoader')
  const pluginFailures = await ensureDnd5eRulesPluginHost()
  for (const failure of pluginFailures) {
    console.error(`[D&D 5e rules plugin] ${failure.id}: ${failure.error}`)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PageErrorBoundary scope="应用外壳" compact>
      <BrowserRouter>
        <App />
        <AppDialogHost />
      </BrowserRouter>
    </PageErrorBoundary>
  </StrictMode>,
)
