import { describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import ts from 'typescript'
import { DND5E_SRD_SPELL_NAMES_ZH } from '../../rulesets/dnd5e/spellNamesZh'
import { dnd5eSrdAuditedSpellActivityV1 } from '../../rulesets/dnd5e/activities/dnd5eSrdAuditedSpellActivities'

describe('combat log catalog audit', () => {
  it('inventories spell effects, checks and combat event presentation coverage', () => {
    const labels: Record<string, string> = {}
    const rollLabels: Record<string,string> = {}
    const kinds: Record<string,string> = {'saving-throw':'豁免', 'attack-roll':'攻击命中', 'ability-check':'属性检定', 'skill-check':'技能检定', 'concentration-check':'专注检定', 'random-roll':'效果判定', 'opposed-ability-check':'对抗检定'}
    const spells: {id:string; name:string; effects:number; checks:number}[] = []
    for (const [id, name] of Object.entries(DND5E_SRD_SPELL_NAMES_ZH)) {
      const activity = dnd5eSrdAuditedSpellActivityV1(id)
      if (!activity) continue
      spells.push({id,name,effects:activity.effects?.length ?? 0,checks:activity.checks?.length ?? 0})
      for (const check of activity.checks ?? []) {
        if (check.rollId) rollLabels[check.rollId] = `${name}·${kinds[check.kind] ?? '效果判定'}`
      }
      for (const effect of activity.effects ?? []) labels[`activity:${id}:${effect.id}`] = effect.name
    }
    const source = ts.createSourceFile('engine.ts', readFileSync(new URL('../../rulesets/dnd5e/headlessCombatEngine.ts', import.meta.url),'utf8'), ts.ScriptTarget.Latest, true)
    const events: string[] = []
    const collect = (node: ts.Node) => {
      if (ts.isPropertySignature(node) && node.name.getText(source)==='type' && node.type && ts.isLiteralTypeNode(node.type) && ts.isStringLiteral(node.type.literal)) events.push(node.type.literal.text)
      ts.forEachChild(node, collect)
    }
    for (const node of source.statements) if (ts.isTypeAliasDeclaration(node) && node.name.text==='Dnd5eCombatEvent') collect(node)
    const formatter = readFileSync(new URL('../../lib/combatLogDetails.ts',import.meta.url),'utf8').split('export function formatDnd5eSecretCombatOutcomeDetails')[0] + readFileSync(new URL('../../lib/combatLogAdditionalEvents.ts',import.meta.url),'utf8')
    const handled = new Set([...formatter.matchAll(/case '([^']+)'/g)].map(match=>match[1]))
    const missing = events.filter(event=>!handled.has(event))
    if (process.env.UPDATE_COMBAT_LOG_AUDIT==='1') {
      writeFileSync(new URL('./combatLogRollLabels.generated.json',import.meta.url), JSON.stringify(rollLabels,null,2)+'\n')
      writeFileSync(new URL('./combatLogEffectLabels.generated.json',import.meta.url), JSON.stringify(labels,null,2)+'\n')
      mkdirSync('docs/audits',{recursive:true})
      writeFileSync('docs/audits/combat-log-inventory.json',JSON.stringify({spellNameCount:Object.keys(DND5E_SRD_SPELL_NAMES_ZH).length,auditedSpellCount:spells.length,effectCount:Object.keys(labels).length,eventCount:events.length,centralHandledEventCount:events.length-missing.length,missingFromCentralFormatter:missing,spells},null,2)+'\n')
    }
    const stored = JSON.parse(readFileSync(new URL('./combatLogEffectLabels.generated.json',import.meta.url),'utf8'))
    expect(stored).toEqual(labels)
    expect(JSON.parse(readFileSync(new URL('./combatLogRollLabels.generated.json',import.meta.url),'utf8'))).toEqual(rollLabels)
    expect(missing, 'Every combat event needs an explicit central log handler').toEqual([])
    expect(Object.keys(labels).length).toBeGreaterThan(20)
  })
})
