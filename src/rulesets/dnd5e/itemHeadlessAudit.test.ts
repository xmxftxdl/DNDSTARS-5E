import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { DND5E_SRD_ITEM_TEMPLATES } from './items'
import { getDnd5eSrdCombatSpell } from './spells'

/** Inventory routes, not a claim that every rule in an item's prose is automated. */
export function auditSrdItemRoutes() {
  return DND5E_SRD_ITEM_TEMPLATES.map(item => {
    const actions = item.useActions?.length ? item.useActions : item.use ? [item.use] : []
    const routes = new Set<string>()
    const spells: string[] = []
    for (const action of actions) {
      if (action.targeting?.kind === 'map-area') routes.add('地图区域规则')
      else if (action.effect.kind === 'spell-cast') {
        routes.add('委托法术链路')
        const spell = getDnd5eSrdCombatSpell(action.effect.spellId)
        spells.push(`${action.effect.spellId}:${spell?.effect ?? 'missing'}`)
      } else if (action.effect.kind === 'healing') routes.add('Headless统一治疗')
      else if (action.effect.kind === 'active-effect') routes.add('Headless持续效果')
      else if (action.effect.kind === 'stabilize') routes.add('稳定濒死目标')
      else if (action.effect.kind === 'spell-slot-recovery') routes.add('库存恢复法术位')
      else routes.add('消耗后记录DM裁定')
    }
    if (item.equipment?.dnd5e || item.equipment?.effects && Object.keys(item.equipment.effects).length || item.headlessEffects?.length) routes.add('装备或被动数值')
    if (!routes.size) routes.add(item.magicItem ? '魔法道具无执行声明' : '无主动战斗声明')
    return { id: item.id, name: item.name, category: item.category, magicKind: item.magicItem?.kind ?? '', declared: item.magicItem?.automation ?? '', routes: [...routes], spells, actions: actions.length, resources: item.resources?.length ?? 0 }
  })
}

describe('SRD item Headless route audit', () => {
  it('covers the complete concrete catalogue and all delegated spell ids', () => {
    const rows = auditSrdItemRoutes()
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length)
    expect(rows.flatMap(row => row.spells).filter(spell => spell.endsWith(':missing'))).toEqual([])
    expect(rows.find(row => row.id === 'srd-5.1:item:caltrops-bag')?.routes).toContain('地图区域规则')
    expect(rows.find(row => row.id === 'srd-5.1:magic-item:amulet-of-the-planes')?.routes).toContain('消耗后记录DM裁定')
    expect(rows.find(row => row.id === 'srd-5.1:magic-item:ring-of-protection')?.routes).toContain('装备或被动数值')
    if (process.env.DND5E_WRITE_ITEM_AUDIT === '1') {
      const dir = 'docs/verification/2026-09-11-item-headless'
      mkdirSync(dir, { recursive: true })
      writeFileSync(`${dir}/catalog.json`, JSON.stringify(rows, null, 2) + '\n')
      const quote = (value: unknown) => '"' + String(value).replaceAll('"', '""') + '"'
      writeFileSync(`${dir}/catalog.csv`, '\uFEFF' + [
        ['ID', '名称', '分类', '魔法类别', '声明自动化', '实际路径', '法术委托', '动作数', '资源池数'],
        ...rows.map(row => [row.id, row.name, row.category, row.magicKind, row.declared, row.routes.join('；'), row.spells.join('；'), row.actions, row.resources]),
      ].map(row => row.map(quote).join(',')).join('\n') + '\n')
      const count = (subset: typeof rows) => ({ total: subset.length, routes: Object.fromEntries([...new Set(subset.flatMap(row => row.routes))].map(route => [route, subset.filter(row => row.routes.includes(route)).length])) })
      const summary = { all: count(rows), magicNonScroll: count(rows.filter(row => row.magicKind && row.magicKind !== 'scroll')), magic: count(rows.filter(row => row.magicKind)), scrolls: count(rows.filter(row => row.magicKind === 'scroll')) }
      writeFileSync(`${dir}/summary.json`, JSON.stringify(summary, null, 2) + '\n')
      console.log(JSON.stringify(summary))
    }
  })
})

