import { describe, expect, it } from 'vitest'
import { cellToPixel } from '../../../lib/gridCombat'
import type { BattleMap, Token } from '../../../store/maps'
import type {
  Dnd5eActivityActorSnapshot,
  Dnd5eActivityCapabilityProposal,
} from './dnd5eActivityExecutor'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import {
  applyDnd5eActivityMapHandoffsV1,
  resolveDnd5eActivityAreaMapSelectionV1,
} from './dnd5eActivityMapInteraction'
import {
  dnd5eSrdAuditedSpellActivityV1,
  dnd5eSrdAuditedSpellDefinitionV1,
} from './dnd5eSrdAuditedSpellActivities'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { activateSymbolArea, SYMBOL_MODES, SYMBOL_SAVES } from '../symbolSpell'
import { collectDnd5ePersistentAreaTriggers, recordDnd5ePersistentAreaTrigger, expireDnd5ePluginAreasAtWorldMinute } from '../pluginAreas'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5ePersistentAreaTrigger, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'
import { dnd5ePluginSpellActivity } from '../pluginSpellTransaction'

const actor: Dnd5eActivityActorSnapshot = {
  id: 'wizard', controller: 'player', level: 20, proficiencyBonus: 6,
  abilities: { str: 8, dex: 14, con: 16, int: 20, wis: 12, cha: 10 },
  armorClass: 16, conditions: [], currentHp: 120, maxHp: 120, spellSaveDc: 19,
  resources: { 'dnd5e-spell-slot-7': { current: 2, maximum: 2 } },
}

function map(): BattleMap {
  const battleMap: BattleMap = {
    id: 'programmed-illusion-map', name: 'Illusion map',
    width: 2_000, height: 2_000, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [],
  }
  const token: Token = {
    id: 'wizard-token', characterId: 'wizard', label: 'Wizard',
    color: '#fff', emoji: 'W', size: 1, type: 'player',
    ...cellToPixel({ col: 10, row: 10 }, battleMap),
  }
  battleMap.tokens = [token]
  return battleMap
}


describe('Symbol cast and activation', () => {
  it.each(SYMBOL_MODES)('places a dormant %s glyph, then activates without another slot', mode => {
    const activity = dnd5eSrdAuditedSpellActivityV1('symbol')!
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(dnd5eActivityAutomationAnalysisV1(activity).capability.level).toBe('full')
    expect(dnd5ePluginSpellActivity(dnd5eSrdAuditedSpellDefinitionV1('symbol'))?.target.kind).toBe('area')
    expect(activity.choices?.[0].options).toHaveLength(8)
    const current = map()
    const selection = resolveDnd5eActivityAreaMapSelectionV1({ activity, map: current,
      actorToken: current.tokens[0], anchorCell: { col: 11, row: 10 } })!
    const result = resolveDnd5eActivity({ activity, actor, targets: [], rolls: {}, castLevel: 7,
      choices: { 'symbol-mode': mode }, areaPlacement: selection.areaPlacement,
      areaPlacementDistanceFeet: selection.areaPlacementDistanceFeet })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const proposal = result.proposals.find((p): p is Extract<Dnd5eActivityCapabilityProposal, {kind: 'create-persistent-area'}> => p.kind === 'create-persistent-area')!
    expect(proposal.symbolMode).toBe(mode)
    const committed = applyDnd5eActivityMapHandoffsV1({ map: current, activity, packageId: 'srd-5.1',
      actionId: `symbol-${mode}`, actorId: 'wizard-token', sourceSaveDc: 19, castLevel: 7,
      round: 7, worldMinute: 600, areaSelection: selection, selection: {},
      handoffs: { persistentAreas: [proposal], summons: [], movements: [], invocations: [] } })
    expect(committed.ok, JSON.stringify(committed)).toBe(true)
    if (!committed.ok) return
    const area = committed.map.dnd5ePluginAreas![0]
    expect(area.symbol).toEqual({ mode, activated: false })
    expect(area.lighting).toBeUndefined()
    expect(area.cells).toHaveLength(1)
    expect(collectDnd5ePersistentAreaTriggers({ map: committed.map, timing: 'on-create', round: 7 })).toEqual([])
    const activated = activateSymbolArea(committed.map, area.id, 9, 800)!
    const active = activated.dnd5ePluginAreas![0]
    expect(active.symbol).toEqual({ mode, activated: true })
    expect(active.lighting).toMatchObject({ brightRadiusFeet: 0, dimRadiusFeet: 60 })
    expect(active.expiresAtWorldMinute).toBe(810)
    expect(expireDnd5ePluginAreasAtWorldMinute(activated, 809).dnd5ePluginAreas).toHaveLength(1)
    expect(expireDnd5ePluginAreasAtWorldMinute(activated, 810).dnd5ePluginAreas).toHaveLength(0)
    expect(expireDnd5ePluginAreasAtWorldMinute(committed.map, 999999).dnd5ePluginAreas).toHaveLength(1)
    expect(active.expiresAfterRound).toBe(109)
    expect(active.triggers?.map(t => t.savingThrow?.ability)).toEqual(Array(3).fill(SYMBOL_SAVES[mode]))
    expect(activateSymbolArea(activated, area.id, 9, 800)).toBeUndefined()
    expect(collectDnd5ePersistentAreaTriggers({ map: activated, timing: 'on-create', round: 9 })).toHaveLength(1)
    const movement = { token: { ...activated.tokens[0], x: 1900, y: 1900 }, to: activated.tokens[0] }
    const entering = collectDnd5ePersistentAreaTriggers({ map: activated, timing: 'on-enter', round: 9, turnKey: '9:wizard-token', movement })
    expect(entering).toHaveLength(1)
    const receiptArea = recordDnd5ePersistentAreaTrigger([active], entering[0], 9)
    const recorded = { ...activated, dnd5ePluginAreas: receiptArea }
    expect(collectDnd5ePersistentAreaTriggers({ map: recorded, timing: 'on-enter', round: 9, turnKey: '9:wizard-token', movement })).toHaveLength(0)
    expect(collectDnd5ePersistentAreaTriggers({ map: recorded, timing: 'turn-end', round: 9, turnKey: '9:wizard-token', targetTokenId: 'wizard-token' })).toHaveLength(1)
    const fighter = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative: 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 200, maxHp: 200, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    for (const d20 of [1, 20]) {
      const resolved = resolveDnd5ePersistentAreaTrigger(startDnd5eHeadlessCombat('symbol-test', [fighter('source'), fighter('target')]), {
        areaId: area.id, areaSourceKind: 'core-spell', coreSpellId: 'symbol', sourceId: 'source', targetId: 'target',
        trigger: active.triggers![0], d20, ...(mode === 'death' ? { damageRolls: Array(10).fill(5) } : {}) })
      expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
      if (!resolved.ok) continue
      const target = resolved.state.combatants.target
      if (mode === 'death') expect(target.currentHp).toBe(d20 === 1 ? 150 : 175)
      else expect(target.classState.activeEffects?.length ?? 0)[d20 === 1 ? 'toBeGreaterThan' : 'toBe'](0)
      if (d20 === 1 && mode !== 'death') {
        const effects = target.classState.activeEffects ?? []
        expect(effects[0].duration).toMatchObject({ type: 'rounds', remainingRounds: mode === 'sleep' ? 100 : 10 })
        const condition = ({ fear: 'frightened', pain: 'incapacitated', sleep: 'unconscious', stunning: 'stunned' } as Record<string, string>)[mode]
        if (condition) expect(effects.some(effect => effect.standardCondition === condition)).toBe(true)
        if (mode === 'discord') expect(effects[0].modifiers).toMatchObject({ attackRollDisadvantage: true, abilityCheckDisadvantages: ['str', 'dex', 'con', 'int', 'wis', 'cha'] })
        if (mode === 'insanity') expect(effects[0].modifiers?.languageRestriction).toEqual({ understandLanguages: false, intelligibleCommunication: false })
      }
      if (mode === 'hopelessness' && d20 === 1) {
        resolved.state.initiativeIndex = resolved.state.initiativeOrder.indexOf('target')
        expect(resolveDnd5eHeadlessAction(resolved.state, { type: 'cast-spell', actorId: 'target', targetId: 'source', spellId: 'fire-bolt', slotLevel: 0, d20: 20, effectRolls: [5] })).toMatchObject({ ok: false, reason: 'action-prohibited' })
      }
      if (mode === 'sleep' && d20 === 1) expect(target.classState.activeEffects?.[0].breakOn).toContain('takes-damage')
    }
  })
})
