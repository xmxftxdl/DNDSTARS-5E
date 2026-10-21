import { dnd5eRulesPluginFromContentPackageV2, type Dnd5eContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'

self.onmessage = (event: MessageEvent<Dnd5eContentPackageV2>) => {
  try {
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(event.data))
    dispose()
    self.postMessage({ ok: true })
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
