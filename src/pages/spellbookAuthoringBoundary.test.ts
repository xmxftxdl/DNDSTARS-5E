import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const spellbookSource = readFileSync(new URL('./SpellbookPage.tsx', import.meta.url), 'utf8')
const workshopSource = readFileSync(
  new URL('../components/rules/Dnd5eCustomPluginBuilder.tsx', import.meta.url),
  'utf8',
)

describe('spell content authoring boundary', () => {
  it('keeps authoring and legacy JSON import out of the spellbook browser', () => {
    expect(spellbookSource).not.toContain('下载法术模板')
    expect(spellbookSource).not.toContain('导入法术 JSON')
    expect(spellbookSource).not.toContain('parseDnd5eSpellImportFile')
    expect(spellbookSource).toContain('在自定义工坊管理法术')
  })

  it('uses one spell workshop list without the retired legacy JSON entry or duplicate inventory', () => {
    expect(workshopSource).toContain('title="法术工坊"')
    expect(workshopSource).not.toContain('兼容旧版法术 JSON')
    expect(workshopSource).not.toContain('导入旧版法术 JSON')
    expect(workshopSource).not.toContain('parseDnd5eSpellImportFile')
    expect(workshopSource).toContain("displayedSection !== 'spells' && <Dnd5eBuilderResourceInventory")
  })
})
