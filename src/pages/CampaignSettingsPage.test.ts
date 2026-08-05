import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('campaign settings information architecture', () => {
  const settingsSource = readFileSync(new URL('./CampaignSettingsPage.tsx', import.meta.url), 'utf8')
  const sidebarSource = readFileSync(new URL('../components/Sidebar.tsx', import.meta.url), 'utf8')
  const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')

  it('keeps theme selection in settings instead of the campaign sidebar', () => {
    expect(sidebarSource).not.toContain("import ThemeToggle from './ThemeToggle'")
    expect(sidebarSource).not.toContain('<ThemeToggle')
    expect(settingsSource).toContain("label: '深色主题'")
    expect(settingsSource).toContain("label: '浅色主题'")
    expect(settingsSource).toContain('onClick={() => setAppTheme(option.id)}')
  })

  it('routes campaign settings to the focused settings page', () => {
    expect(appSource).toContain("const CampaignSettingsPage = lazy(() => import('./pages/CampaignSettingsPage'))")
    expect(appSource).toContain('<CampaignSettingsPage />')
    expect(appSource).not.toContain('<RulesPluginsPage />')
  })

  it('keeps only appearance, gameplay, room and recovery settings', () => {
    expect(settingsSource).toContain("label: '界面外观'")
    expect(settingsSource).toContain("label: '游戏与表现'")
    expect(settingsSource).toContain("label: '房间与恢复'")
    expect(settingsSource).toContain('<RoomManagementPanel />')
    expect(settingsSource).toContain('<CampaignSafetyPanel />')
    expect(settingsSource).toContain("key: 'combatBannersEnabled'")
    expect(settingsSource).toContain("key: 'spellAnimationsEnabled'")
    expect(settingsSource).toContain("key: 'spellcastingPrerequisitesEnabled'")
    expect(settingsSource).toContain("key: 'encumbranceEnabled'")
  })

  it('does not expose plugin administration, legal copy or developer diagnostics as settings', () => {
    expect(settingsSource).not.toContain('规则插件')
    expect(settingsSource).not.toContain('SRD 5.1 来源与许可')
    expect(settingsSource).not.toContain('Worker／WASM')
    expect(settingsSource).not.toContain('SharedSyncDiagnosticsPanel')
    expect(settingsSource).not.toContain('Dnd5eEffectDiagnosticsPanel')
  })
})
