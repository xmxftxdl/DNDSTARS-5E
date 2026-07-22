import { DND5E_SRD_MAGIC_ITEM_RULES_ZH } from './magicItemRulesZh.generated'
import { DND5E_SRD_MAGIC_ITEM_RULES_ZH_REVIEWED } from './magicItemRulesZh.reviewed.generated'
import {
  DND5E_SRD_MAGIC_ITEM_CATALOG,
  DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES,
} from './magicItems'
import { DND5E_SRD_LEGACY_MAGIC_ITEM_SPELL_ALIASES } from './srdContent'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'
import { DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED } from './spellDescriptionsZh.reviewed.generated'
import { DND5E_SRD_SPELL_NAMES_ZH } from './spellNamesZh'
import { dnd5eSpellbookEntries } from './spellbook'
import { DND5E_SRD_COMBAT_SPELLS } from './spells'

export type Dnd5eSrdContentAuditIssueCode =
  | 'spell-name'
  | 'spell-english-name'
  | 'spell-level'
  | 'spell-classes'
  | 'spell-reference'
  | 'magic-item-reference'
  | 'magic-item-spell-alias'

export interface Dnd5eSrdContentAuditIssue {
  code: Dnd5eSrdContentAuditIssueCode
  id: string
  message: string
}

export interface Dnd5eSrdContentAuditReport {
  spellCatalogCount: number
  headlessSpellCount: number
  reviewedSpellCount: number
  pendingSpellReviewCount: number
  magicItemCatalogCount: number
  reviewedMagicItemCount: number
  pendingMagicItemReviewCount: number
  issues: Dnd5eSrdContentAuditIssue[]
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort().join('|') === [...right].sort().join('|')
}

/**
 * 检查发布时真正会被法术书、Headless 和物品栏读取的数据，而不是只检查生成源。
 * 未完成语境审校属于显式积压，不计为一致性错误；把旧正文误标为已审校才是错误。
 */
export function auditDnd5eSrdContentConsistency(): Dnd5eSrdContentAuditReport {
  const issues: Dnd5eSrdContentAuditIssue[] = []
  const catalogById = new Map(DND5E_SRD_SPELL_CATALOG.map((spell) => [spell.id, spell]))
  const spellbookById = new Map(dnd5eSpellbookEntries([]).map((spell) => [spell.id, spell]))

  for (const catalog of DND5E_SRD_SPELL_CATALOG) {
    const canonicalName = DND5E_SRD_SPELL_NAMES_ZH[catalog.id]
    if (!canonicalName || catalog.name !== canonicalName) {
      issues.push({ code: 'spell-name', id: catalog.id, message: `目录名称“${catalog.name}”未使用规范名称“${canonicalName ?? '缺失'}”` })
    }

    const runtime = spellbookById.get(catalog.id)
    if (!runtime?.reference) {
      issues.push({ code: 'spell-reference', id: catalog.id, message: '法术书缺少可显示的规则正文' })
    } else {
      if (runtime.reference.sourceName !== catalog.name) {
        issues.push({ code: 'spell-name', id: catalog.id, message: `正文名称“${runtime.reference.sourceName}”与目录名称不一致` })
      }
      if (runtime.reference.sourceEnglishName !== catalog.englishName) {
        issues.push({ code: 'spell-english-name', id: catalog.id, message: `正文英文名“${runtime.reference.sourceEnglishName}”与目录英文名不一致` })
      }
      if (runtime.reference.level !== catalog.level) {
        issues.push({ code: 'spell-level', id: catalog.id, message: `正文环级 ${runtime.reference.level} 与目录环级 ${catalog.level} 不一致` })
      }
    }
  }

  for (const spell of DND5E_SRD_COMBAT_SPELLS) {
    const catalog = catalogById.get(spell.id)
    if (!catalog) {
      issues.push({ code: 'spell-reference', id: spell.id, message: 'Headless 法术不在 SRD 5.1 目录中' })
      continue
    }
    if (spell.name !== catalog.name) {
      issues.push({ code: 'spell-name', id: spell.id, message: `Headless 名称“${spell.name}”与目录名称“${catalog.name}”不一致` })
    }
    if (spell.englishName !== catalog.englishName) {
      issues.push({ code: 'spell-english-name', id: spell.id, message: `Headless 英文名“${spell.englishName}”与目录英文名不一致` })
    }
    if (spell.level !== catalog.level) {
      issues.push({ code: 'spell-level', id: spell.id, message: `Headless 环级 ${spell.level} 与目录环级 ${catalog.level} 不一致` })
    }
    if (!sameStrings(spell.classes, catalog.classes)) {
      issues.push({ code: 'spell-classes', id: spell.id, message: 'Headless 职业归属与 SRD 目录不一致' })
    }
  }

  const reviewedSpellIds = Object.keys(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED)
  for (const id of reviewedSpellIds) {
    const catalog = catalogById.get(id)
    const reviewed = DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED[id]
    if (!catalog || !reviewed) {
      issues.push({ code: 'spell-reference', id, message: '已审校正文没有对应的 SRD 目录条目' })
      continue
    }
    if (reviewed.sourceName !== catalog.name) {
      issues.push({ code: 'spell-name', id, message: `已审校正文名称“${reviewed.sourceName}”与目录名称不一致` })
    }
    if (reviewed.sourceEnglishName !== catalog.englishName) {
      issues.push({ code: 'spell-english-name', id, message: `已审校正文英文名“${reviewed.sourceEnglishName}”与目录英文名不一致` })
    }
  }

  const itemCatalogById = new Map(DND5E_SRD_MAGIC_ITEM_CATALOG.map((item) => [item.id, item]))
  for (const id of Object.keys(DND5E_SRD_MAGIC_ITEM_RULES_ZH_REVIEWED)) {
    if (!itemCatalogById.has(id)) {
      issues.push({ code: 'magic-item-reference', id, message: '已审校魔法物品正文没有对应的 SRD 目录条目' })
    }
  }
  for (const template of DND5E_SRD_MAGIC_ITEM_CATALOG_TEMPLATES) {
    const id = template.id.replace(/^srd-5\.1:magic-item:/, '')
    const catalog = itemCatalogById.get(id)
    if (!catalog || !DND5E_SRD_MAGIC_ITEM_RULES_ZH[id]) {
      issues.push({ code: 'magic-item-reference', id, message: '发布模板、目录或规则正文之间缺少对应条目' })
      continue
    }
    if (template.name !== catalog.name || template.englishName !== catalog.englishName) {
      issues.push({ code: 'magic-item-reference', id, message: '发布模板名称与 SRD 魔法物品目录不一致' })
    }
    if (!template.rulesText.trim()) {
      issues.push({ code: 'magic-item-reference', id, message: '发布模板缺少规则正文' })
    }
    if (template.source.book !== 'SRD 5.1' || template.source.license !== 'CC BY 4.0') {
      issues.push({ code: 'magic-item-reference', id, message: '发布模板缺少 SRD 5.1 / CC BY 4.0 来源标记' })
    }
    const publishedText = `${template.rulesText}\n${JSON.stringify(template.use ?? {})}`
    for (const alias of Object.keys(DND5E_SRD_LEGACY_MAGIC_ITEM_SPELL_ALIASES)) {
      if (publishedText.includes(alias)) {
        issues.push({ code: 'magic-item-spell-alias', id, message: `装备正文仍使用旧法术名“${alias}”` })
      }
    }
  }

  return {
    spellCatalogCount: DND5E_SRD_SPELL_CATALOG.length,
    headlessSpellCount: DND5E_SRD_COMBAT_SPELLS.length,
    reviewedSpellCount: reviewedSpellIds.length,
    pendingSpellReviewCount: DND5E_SRD_SPELL_CATALOG.length - reviewedSpellIds.length,
    magicItemCatalogCount: DND5E_SRD_MAGIC_ITEM_CATALOG.length,
    reviewedMagicItemCount: Object.keys(DND5E_SRD_MAGIC_ITEM_RULES_ZH_REVIEWED).length,
    pendingMagicItemReviewCount:
      DND5E_SRD_MAGIC_ITEM_CATALOG.length - Object.keys(DND5E_SRD_MAGIC_ITEM_RULES_ZH_REVIEWED).length,
    issues,
  }
}
