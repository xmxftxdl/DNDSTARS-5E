import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { prepareDnd5eAbilityCheck, previewPreparedDnd5eAbilityCheck, resolvePreparedDnd5eAbilityCheck } from './abilityCheckAction'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { DND5E_CHAIN_MAIL } from './equipment'
import { createDnd5eMechanicalEffect } from './activeEffects'
import {preparedDnd5eAbilityCheckEffectDice} from './abilityCheckAction'

function bard(): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'bard', name: '诗人', player: '', avatar: '', accent: '',
    race: '人类', charClass: '吟游诗人', level: 14, background: '', experience: 0, reputation: 0,
    abilities: { str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 18 }, savingThrows: ['dex', 'cha'],
    skills: ['performance'], maxHp: 70, currentHp: 70, tempHp: 0, hitDice: '14d8', ac: 14, speed: 30,
    initiativeBonus: 0, saveDC: 17, passivePerception: 10, inspiration: 0,
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eClassChoices: { classes: { bard: { subclass: 'lore', selections: { expertise: ['performance'] } } } },
    classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
  }
}

function fixture(payload: NonNullable<SharedPlayerActionState['dnd5eAbilityCheck']>) {
  const actor = bard()
  const actorToken: Token = { id: 'bard-token', label: actor.name, x: 25, y: 25, color: '', emoji: '', size: 1, type: 'player', characterId: actor.id }
  const enemyToken: Token = { id: 'enemy-token', label: '敌人', x: 75, y: 25, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10 }
  const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [actorToken, enemyToken] }
  const action: SharedPlayerActionState = {
    id: 'check', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending',
    type: 'dnd5e-ability-check', actorTokenId: actorToken.id, characterId: actor.id,
    dnd5eAbilityCheck: payload, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
  }
  const initiativeOrder = [
    { tokenId: actorToken.id, label: actor.name, emoji: '', color: '', roll: 20 },
    { tokenId: enemyToken.id, label: enemyToken.label, emoji: '', color: '', roll: 10 },
  ]
  return { actor, action, map, initiativeOrder }
}

describe('D&D 5e ability-check authority bridge', () => {
  it('accepts smell perception from a shared request and preserves its conditional advantage', () => {
    const input = fixture({ ability: 'wis', skill: 'perception', context: 'smell', dc: 12, spendAction: true })
    input.actor.dnd5eCombatState = { activeEffects: [createDnd5eMechanicalEffect({
      definitionId: 'keen-smell', label: 'Keen smell', source: { kind: 'plugin' }, targetId: input.actor.id,
      modifiers: { abilityCheckRules: [{ mode: 'advantage', ability: 'wis', skill: 'perception', sense: 'smell' }] },
    })] }
    const request = JSON.parse(JSON.stringify(input.action))
    const prepared = prepareDnd5eAbilityCheck({ ...input, action: request, characters: [input.actor] })
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) throw Error(prepared.reason)
    expect(previewPreparedDnd5eAbilityCheck(prepared.prepared, 4, 18)).toMatchObject({ success: true })
    const result = resolvePreparedDnd5eAbilityCheck({ prepared: prepared.prepared, d20: 4, d20Second: 18 })
    expect(result.result.ok).toBe(true)
    expect(result.result.state.combatants['bard-token'].turn.actionAvailable).toBe(false)
    request.dnd5eAbilityCheck.skill = 'insight'
    expect(prepareDnd5eAbilityCheck({ ...input, action: request, characters: [input.actor] })).toMatchObject({ ok: false, reason: 'invalid-action' })
  })
  it('settles an owned remote hearing check on the caster and rejects forged or deafened origins', () => {
    const input = fixture({ ability: 'wis', skill: 'perception', dc: 12, spendAction: true,
      remoteHearing: { sensorId: 'sensor', soundSourceTokenId: 'speaker' } })
    input.actor.concentrating = true
    input.actor.dnd5eCombatState = { concentrationSpellId: 'activity:eyes', concentrationRoundsRemaining: 100 }
    input.actor.dnd5eCombatState.activeEffects = [createDnd5eMechanicalEffect({
      definitionId: 'test:keen-hearing', label: 'Keen hearing', source: { kind: 'plugin' }, targetId: input.actor.id,
      modifiers: { abilityCheckRules: [{ mode: 'advantage', skill: 'perception', sense: 'hearing' }] },
    })]
    const remote: BattleMap = { ...input.map, id: 'remote', tokens: [
      { ...input.map.tokens[1], id: 'speaker' },
      { ...input.map.tokens[1], id: 'sensor', type: 'obstacle', dnd5eSpellEffect: { schemaVersion: 1, spellId: 'eyes',
        sourceTokenId: 'bard-token', sourceCharacterId: input.actor.id, createdRound: 1, expiresAfterRound: 101,
        concentrationId: 'activity:eyes', hearingFromSource: true, visionFromSource: true, shareVisionWithSource: true } },
    ], dnd5ePluginAreas: [{ id: 'eyes', pluginId: 'test', featureId: 'eyes', label: 'Eyes', color: '#ffffff',
      sourceTokenId: 'bard-token', sourceCharacterId: input.actor.id, anchorTokenId: 'sensor', anchorMode: 'effect-token',
      concentrationId: 'activity:eyes', cells: [{ col: 1, row: 0 }], createdRound: 1, expiresAfterRound: 101,
      createdWorldMinute: 100, expiresAtWorldMinute: 110 }] }
    const args = { ...input, characters: [input.actor], roomMaps: [input.map, remote], worldMinute: 100 }
    const prepared = prepareDnd5eAbilityCheck(args)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) throw Error(prepared.reason)
    expect(prepared.prepared.payload.context).toBe('hearing')
    expect(input.action.dnd5eAbilityCheck!.context).toBeUndefined()
    expect(prepared.prepared.rollMode).toBe('advantage')
    // The bard also retains Jack of All Trades (+2), independently of hearing advantage.
    expect(previewPreparedDnd5eAbilityCheck(prepared.prepared, 3, 15)).toMatchObject({ d20: 15, modifier: 2, total: 17, success: true })
    const resolved = resolvePreparedDnd5eAbilityCheck({ prepared: prepared.prepared, d20: 3, d20Second: 15 })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', success: true }))
    expect(resolved.result.state.combatants['bard-token'].turn.actionAvailable).toBe(false)
    input.actor.conditions = ['deafened']
    expect(prepareDnd5eAbilityCheck(args)).toMatchObject({ ok: false, reason: 'cannot-hear' })
    input.actor.conditions = []
    remote.tokens[1].dnd5eSpellEffect!.sourceCharacterId = 'another-owner'
    expect(prepareDnd5eAbilityCheck(args)).toMatchObject({ ok: false, reason: 'invalid-actor' })
    expect(prepareDnd5eAbilityCheck({ ...args, roomMaps: undefined })).toMatchObject({ ok: false })
  })
  it('binds mandatory dice to the shared request across preview and commit without spending on failure',()=>{
    const input=fixture({ability:'int',dc:12,spendAction:true})
    input.actor.dnd5eCombatState={activeEffects:[createDnd5eMechanicalEffect({id:'penalty',definitionId:'penalty',label:'Penalty',source:{kind:'plugin'},targetId:input.actor.id,
      modifiers:{rollDiceModifiers:[{count:1,sides:6,direction:'subtract',appliesTo:['ability-check']}]}})]}
    const prepared=prepareDnd5eAbilityCheck({...input,characters:[input.actor]})
    expect(prepared.ok).toBe(true)
    if(!prepared.ok) return
    const check=prepared.prepared
    const effectRollDice=Object.fromEntries(preparedDnd5eAbilityCheckEffectDice(check).map(recipe=>[recipe.id,[6]]))
    expect(Object.keys(effectRollDice)).toHaveLength(1)
    for(let n=0;n<3;n++) expect(previewPreparedDnd5eAbilityCheck(check,15,undefined,undefined,effectRollDice)).toMatchObject({total:11,success:false})
    expect(resolvePreparedDnd5eAbilityCheck({prepared:check,d20:15}).result.ok).toBe(false)
    expect(check.state.combatants[check.actorToken.id].turn.actionAvailable).toBe(true)
    const resolved=resolvePreparedDnd5eAbilityCheck({prepared:check,d20:15,effectRollDice})
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.transaction?.id).toBe(input.action.id)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',total:11,success:false}))
    expect(resolved.result.state.combatants[check.actorToken.id].turn.actionAvailable).toBe(false)
    const replay=resolvePreparedDnd5eAbilityCheck({prepared:{...check,action:{...check.action,id:'next'}},d20:15,effectRollDice})
    expect(replay.result.ok).toBe(false)
    check.state.combatants[check.actorToken.id].classState.activeEffects=[]
    expect(resolvePreparedDnd5eAbilityCheck({prepared:check,d20:15,effectRollDice}).result.ok).toBe(false)
  })
  it('uses Host-owned tool proficiency without stacking a skill and drops it when the receipt is removed', () => {
    const input = fixture({ ability: 'int', toolId: 'alchemists-supplies', dc: 15 })
    input.actor.dnd5eContentChoices = { 'test:tool': { schemaVersion: 1, contentId: 'test:tool', selections: {}, resolvedGrants: [{ kind: 'proficiency', category: 'tool', id: 'alchemists-supplies' }] } }
    const prepared = prepareDnd5eAbilityCheck({ ...input, characters: [input.actor] })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(previewPreparedDnd5eAbilityCheck(prepared.prepared, 10)).toMatchObject({ toolId: 'alchemists-supplies', modifier: 5, total: 15 })
    const result = resolvePreparedDnd5eAbilityCheck({ prepared: prepared.prepared, d20: 10 })
    expect(result.result.ok).toBe(true)
    expect(result.result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', toolId: 'alchemists-supplies', total: 15 }))
    input.actor.dnd5eContentChoices = {}
    const removed = prepareDnd5eAbilityCheck({ ...input, characters: [input.actor] })
    expect(removed.ok).toBe(true)
    if (removed.ok) expect(previewPreparedDnd5eAbilityCheck(removed.prepared, 10)).toMatchObject({ modifier: 2, total: 12 })
    input.action.dnd5eAbilityCheck!.skill = 'arcana'
    expect(prepareDnd5eAbilityCheck({ ...input, characters: [input.actor] })).toMatchObject({ ok: false, reason: 'invalid-action' })
  })
  it('uses climbing advantage in both preparation and final resolution without widening Athletics', () => {
    const input = fixture({ ability: 'str', skill: 'athletics', context: 'climbing', dc: 10 })
    input.actor.dnd5eCombatState = { activeEffects: [createDnd5eMechanicalEffect({
      definitionId: 'test:climbing', label: '攀爬药水', targetId: input.actor.id, source: { kind: 'item' },
      modifiers: { climbingCheckAdvantage: true, climbSpeedEqualsWalking: true },
    })] }
    const prepared = prepareDnd5eAbilityCheck({ ...input, characters: [input.actor] })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.rollMode).toBe('advantage')
    const resolved = resolvePreparedDnd5eAbilityCheck({ prepared: prepared.prepared, d20: 2, d20Second: 18 })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', success: true }))
    input.action.dnd5eAbilityCheck!.context = undefined
    const ordinary = prepareDnd5eAbilityCheck({ ...input, characters: [input.actor] })
    expect(ordinary.ok && ordinary.prepared.rollMode).toBe('normal')
  })
  it('previews and persists Peerless Skill through the map bridge', () => {
    const input = fixture({ ability: 'cha', skill: 'performance', dc: 20 })
    const prepared = prepareDnd5eAbilityCheck({
      ...input, characters: [input.actor], turnEconomy: createDnd5eTurnEconomyCounts('turn'),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(previewPreparedDnd5eAbilityCheck(prepared.prepared, 2)).toMatchObject({ total: 16, success: false })
    const resolved = resolvePreparedDnd5eAbilityCheck({ prepared: prepared.prepared, d20: 2, peerlessSkillRoll: 6 })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].classResources?.['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 4 })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 22, success: true, peerlessSkillApplied: 6,
    }))
  })

  it('rejects a mismatched skill ability and an unavailable action', () => {
    const invalid = fixture({ ability: 'str', skill: 'performance', dc: 10 })
    expect(prepareDnd5eAbilityCheck({ ...invalid, characters: [invalid.actor] })).toEqual({ ok: false, reason: 'invalid-action' })

    const actionCheck = fixture({ ability: 'cha', dc: 10, spendAction: true })
    const economy = createDnd5eTurnEconomyCounts('turn')
    economy.action.current = 0
    expect(prepareDnd5eAbilityCheck({
      ...actionCheck, characters: [actionCheck.actor], turnEconomy: economy,
    })).toEqual({ ok: false, reason: 'action-unavailable' })
  })

  it('applies unproficient-armor disadvantage only to Strength and Dexterity checks', () => {
    const dexterity = fixture({ ability: 'dex', dc: 15 })
    dexterity.actor.equipment = { armor: DND5E_CHAIN_MAIL }
    const preparedDexterity = prepareDnd5eAbilityCheck({ ...dexterity, characters: [dexterity.actor] })
    expect(preparedDexterity.ok).toBe(true)
    if (!preparedDexterity.ok) return
    expect(preparedDexterity.prepared.rollMode).toBe('disadvantage')
    expect(previewPreparedDnd5eAbilityCheck(preparedDexterity.prepared, 18, 2)).toMatchObject({
      d20: 2,
      mode: 'disadvantage',
    })

    const charisma = fixture({ ability: 'cha', dc: 15 })
    charisma.actor.equipment = { armor: DND5E_CHAIN_MAIL }
    const preparedCharisma = prepareDnd5eAbilityCheck({ ...charisma, characters: [charisma.actor] })
    expect(preparedCharisma.ok).toBe(true)
    if (!preparedCharisma.ok) return
    expect(preparedCharisma.prepared.rollMode).toBe('normal')
  })

  it('applies an armor Stealth penalty even when the wearer is proficient', () => {
    const stealth = fixture({ ability: 'dex', skill: 'stealth', dc: 15 })
    stealth.actor.charClass = '战士'
    stealth.actor.dnd5eClassLevels = { fighter: 14 }
    stealth.actor.equipment = { armor: DND5E_CHAIN_MAIL }
    const preparedStealth = prepareDnd5eAbilityCheck({ ...stealth, characters: [stealth.actor] })
    expect(preparedStealth.ok).toBe(true)
    if (!preparedStealth.ok) return
    expect(preparedStealth.prepared.rollMode).toBe('disadvantage')

    const acrobatics = fixture({ ability: 'dex', skill: 'acrobatics', dc: 15 })
    acrobatics.actor.charClass = '战士'
    acrobatics.actor.dnd5eClassLevels = { fighter: 14 }
    acrobatics.actor.equipment = { armor: DND5E_CHAIN_MAIL }
    const preparedAcrobatics = prepareDnd5eAbilityCheck({ ...acrobatics, characters: [acrobatics.actor] })
    expect(preparedAcrobatics.ok).toBe(true)
    if (!preparedAcrobatics.ok) return
    expect(preparedAcrobatics.prepared.rollMode).toBe('normal')
  })

  it('doubles an applicable Charisma proficiency for Draconic Ancestry interaction checks', () => {
    const input = fixture({
      ability: 'cha',
      skill: 'persuasion',
      context: 'interact-with-dragons',
      dc: 20,
    })
    input.actor.charClass = '术士'
    input.actor.level = 5
    input.actor.dnd5eClassLevels = { sorcerer: 5 }
    input.actor.skills = ['persuasion']
    input.actor.dnd5eClassChoices = {
      classes: { sorcerer: { subclass: 'draconic', selections: { 'dragon-ancestor': ['red-fire'] } } },
    }
    const prepared = prepareDnd5eAbilityCheck({ ...input, characters: [input.actor] })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5eAbilityCheck({ prepared: prepared.prepared, d20: 10 })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved',
      actorId: input.map.tokens[0].id,
      ability: 'cha',
      skill: 'persuasion',
      modifier: 10,
      total: 20,
      success: true,
    }))
  })

  it('rejects a forged Draconic Ancestry interaction context', () => {
    const input = fixture({
      ability: 'cha',
      skill: 'performance',
      context: 'interact-with-dragons',
      dc: 10,
    })
    expect(prepareDnd5eAbilityCheck({ ...input, characters: [input.actor] }))
      .toEqual({ ok: false, reason: 'invalid-action' })
  })
})


describe('total-only quick checks', () => {
  it('preserves expertise and does not spend the action', () => {
    const input = fixture({ ability: 'cha', skill: 'performance', dc: 0, totalOnly: true, spendAction: false })
    const prepared = prepareDnd5eAbilityCheck({ ...input, characters: [input.actor] })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const preview = previewPreparedDnd5eAbilityCheck(prepared.prepared, 10)
    expect(preview).toMatchObject({ d20: 10, modifier: 14, total: 24 })
    const resolved = resolvePreparedDnd5eAbilityCheck({ prepared: prepared.prepared, d20: 10 })
    expect(resolved.result.state.combatants[prepared.prepared.actorToken.id].turn.actionAvailable).toBe(true)
  })
  it('rejects a total-only request that supplies a difficulty or spends an action', () => {
    for (const extra of [{ dc: 15 }, { dc: 0, spendAction: true }]) {
      const input = fixture({ ability: 'cha', totalOnly: true, ...extra })
      expect(prepareDnd5eAbilityCheck({ ...input, characters: [input.actor] })).toEqual({ ok: false, reason: 'invalid-action' })
    }
  })
})

it('keeps visual Perception context through the player request authority bridge',()=>{
 const input=fixture({ability:'wis',skill:'perception',context:'sight',dc:10})
 const prepared=prepareDnd5eAbilityCheck({...input,characters:[input.actor]})
 expect(prepared.ok).toBe(true)
 if(!prepared.ok)throw Error(prepared.reason)
 expect(prepared.prepared.payload.context).toBe('sight')
 expect(prepared.prepared.rollMode).toBe('normal')
 const resolved=resolvePreparedDnd5eAbilityCheck({prepared:prepared.prepared,d20:18})
 expect(resolved.result.ok).toBe(true)
 expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',success:true}))
 input.action.dnd5eAbilityCheck={ability:'str',context:'sight',dc:10}
 expect(prepareDnd5eAbilityCheck({...input,characters:[input.actor]})).toMatchObject({ok:false,reason:'invalid-action'})
})


it('preserves a creature-detection purpose through shared request, preview and settlement', () => {
  const input = fixture({ ability:'int', skill:'investigation', detectedCreatureId:'enemy-token', dc:12, spendAction:true })
  input.map.dnd5ePluginAreas=[{id:'unicorn',pluginId:'test',featureId:'unicorn',label:'Unicorn',color:'#fff',
    sourceTokenId:'bard-token',sourceCharacterId:'bard',createdRound:1,expiresAfterRound:10,
    cells:[{col:1,row:0}],anchorCell:{col:1,row:0},creatureDetectionAdvantage:'source-and-allies'}]
  const prepare = (action=input.action) => prepareDnd5eAbilityCheck({...input, action:JSON.parse(JSON.stringify(action)),characters:[input.actor]})
  const prepared=prepare()
  expect(prepared.ok).toBe(true);if(!prepared.ok)return
  expect(prepared.prepared.rollMode).toBe('advantage')
  expect(previewPreparedDnd5eAbilityCheck(prepared.prepared,2,18)).toMatchObject({success:true})
  const resolved=resolvePreparedDnd5eAbilityCheck({prepared:prepared.prepared,d20:2,d20Second:18})
  expect(resolved.result.ok).toBe(true)
  expect(resolved.result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',detectedCreatureId:'enemy-token',mode:'advantage',d20:18}))
  expect(resolved.result.state.combatants['bard-token'].turn.actionAvailable).toBe(false)
  for(const targetId of ['unknown','bard-token'])expect(prepare({...input.action,dnd5eAbilityCheck:{...input.action.dnd5eAbilityCheck!,detectedCreatureId:targetId}}).ok).toBe(false)
})
