export type CharDockPanel = 'inventory' | 'features' | 'spells' | 'skills'

export const CHAR_PANEL_TITLES: Record<CharDockPanel, string> = {
  inventory: '装备栏',
  features: '特性',
  spells: '法术栏',
  skills: '技能栏',
}
