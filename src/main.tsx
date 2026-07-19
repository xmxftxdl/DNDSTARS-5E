import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import PageErrorBoundary from './components/PageErrorBoundary.tsx'
import { exposeDnd5eRulesPluginHost, loadInstalledDnd5eRulesPlugins } from './rulesets/dnd5e/pluginLoader'

exposeDnd5eRulesPluginHost()
const pluginFailures = await loadInstalledDnd5eRulesPlugins()
for (const failure of pluginFailures) console.error(`[D&D 5e rules plugin] ${failure.id}: ${failure.error}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PageErrorBoundary scope="应用外壳" compact>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PageErrorBoundary>
  </StrictMode>,
)
