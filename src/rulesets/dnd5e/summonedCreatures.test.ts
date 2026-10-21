import { createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication } from './mapBridge'
import { afterEach, describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { migrateMapsState } from '../../store/maps'
import { expireDnd5eSummonLingerAtWorldMinute } from '../../../shared/summon-linger.mjs'
import { droppedDnd5eCompanionObjects } from './companionCarriedObjects'
import type { Character } from '../../types/character'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import {
  planDnd5eSummonedCreature,
  markDnd5eSummonsDamaged,
  rebaseDnd5eSummonedCreatureTokens,
  reconcileDnd5eSummonedCreatures,
} from './summonedCreatures'
import { buildDnd5eCustomMonster, createDnd5eCustomMonsterDraft } from './customMonsterWorkshop'
import { setDnd5eRoomMonsterCatalog } from './monsters'
import { dnd5eSummonedCreatureWeaponAttack,resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { detachDnd5eUncontrolledSummon } from './summonedControl'
import { validateAndMigrateSharedResource } from '../../lib/sharedResourceValidation'
import { createDnd5eMechanicalEffect } from './activeEffects'

function map(tokens: Token[]): BattleMap {
  return {
    id: 'map-1', name: '召唤测试', width: 500, height: 500,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens,
  }
}

const actor: Token = {
  id: 'actor-token', label: '施法者', x: 25, y: 25, color: '#fff', emoji: 'A',
  size: 1, type: 'player', characterId: 'actor',
}

function source(concentrationSpellId?: string): Character {
  return {
    id: 'actor', name: '施法者', player: '玩家', avatar: '', accent: '', race: '人类', charClass: '法师',
    level: 5, background: '学者', experience: 0, reputation: 0,
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
    savingThrows: [], skills: [], maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '5d6',
    ac: 13, speed: 30, initiativeBonus: 0, saveDC: 14, passivePerception: 10, inspiration: 0,
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eCombatState: concentrationSpellId ? { concentrationSpellId } : undefined,
  }
}

describe('D&D 5e summoned creature lifecycle', () => {
  it('creates a commandable protector, preserves its policy on reload, and rejects contradictory control saves', () => {
    const input = { map: map([actor]), actorToken: actor, sourceCharacterId: 'actor', featureId: 'protectors',
      pluginId: 'local.test', actionId: 'protect', round: 1, targetCell: { col: 2, row: 1 }, initiativeD20: 12,
      summon: { monsterId: 'srd-5.1:wolf', durationRounds: 600, concentration: false,
        autonomousBehavior: 'protect-source' as const, commandPolicy: 'persistent-order' as const } }
    const planned = planDnd5eSummonedCreature(input)
    expect(planned.ok).toBe(true); if (!planned.ok) return
    const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map([actor, planned.plan.token])] }))).maps[0]
    expect(saved.tokens[1].dnd5eSummon).toMatchObject({ autonomousBehavior: 'protect-source', commandPolicy: 'persistent-order' })
    expect(planDnd5eSummonedCreature({ ...input, summon: { ...input.summon, controlSave: { ability: 'cha', dc: 15 } } }).ok).toBe(false)
    expect(planDnd5eSummonedCreature({ ...input, summon: { ...input.summon, cannotAttack: true } }).ok).toBe(false)
  })
  it('requires a declared subtype for independent hostile pursuit and retains it on reload',()=>{
    const input={map:map([actor]),actorToken:actor,sourceCharacterId:'actor',featureId:'lesser-demons',pluginId:'local.test',actionId:'spawn',round:1,targetCell:{col:2,row:1},initiativeD20:12,
      summon:{monsterId:'srd-5.1:dretch',durationRounds:600,concentration:true,autonomousBehavior:'attack-nearest-other-subtype' as const,requiredCreatureSubtype:'demon'}}
    const result=planDnd5eSummonedCreature(input)
    expect(result.ok,result.ok?'':result.reason).toBe(true)
    if(!result.ok)return
    const envelope={maps:[map([actor,result.plan.token])]}
    expect(validateAndMigrateSharedResource('maps',envelope).status).toBe('valid')
    const restored=migrateMapsState(JSON.parse(JSON.stringify(envelope))).maps[0]
    expect(restored.tokens[1].dnd5eSummon).toMatchObject({autonomousBehavior:'attack-nearest-other-subtype',requiredCreatureSubtype:'demon'})
    expect(planDnd5eSummonedCreature({...input,summon:{...input.summon,requiredCreatureSubtype:undefined}})).toMatchObject({ok:false,reason:'invalid-summon'})
  })

  it.each([-5, -2, 0, 5])('preserves signed summon modifier %s through shared validation, map reload and attack variants', bonus => {
    const result = planDnd5eSummonedCreature({ map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'signed-bonus', pluginId: 'local.test', actionId: 'spawn', round: 1, targetCell: { col: 2, row: 1 }, initiativeD20: 12,
      summon: { monsterId: 'srd-5.1:skeleton', durationRounds: 600, concentration: false, weaponAttackBonus: bonus, weaponDamageBonus: bonus } })
    if (!result.ok) throw Error(result.reason)
    const envelope = { maps: [map([actor, result.plan.token])] }
    expect(validateAndMigrateSharedResource('maps', envelope).status).toBe('valid')
    const saved = migrateMapsState(JSON.parse(JSON.stringify(envelope))).maps[0]
    expect(saved.tokens[1].dnd5eSummon).toMatchObject({ weaponAttackBonus: bonus, weaponDamageBonus: bonus })
    const snapshot = createDnd5eMapCombatSnapshot({ map: saved, characters: [source()], combatId: 'signed',
      initiativeOrder: saved.tokens.map((t,i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20-i })) })
    expect(snapshot.state.combatants[result.plan.token.id]).toMatchObject({ summonedWeaponAttackBonus: bonus, summonedWeaponDamageBonus: bonus })
    const damage = [{ average: 5, count: 1, sides: 6, bonus: 2, type: 'piercing' as const },
      { average: 3, count: 1, sides: 6, bonus: 0, type: 'necrotic' as const }]
    const attack = dnd5eSummonedCreatureWeaponAttack({ mode: 'melee', toHit: 4, target: 'one creature',
      damage, rangedDamage: damage, damageAtHalfHp: damage }, bonus, bonus)
    expect(attack.toHit).toBe(4 + bonus)
    for (const parts of [attack.damage, attack.rangedDamage, attack.damageAtHalfHp]) expect(parts?.map(d => d.bonus)).toEqual([2 + bonus, 0])
    expect(damage.map(d => d.bonus)).toEqual([2, 0])
  })
  it('preserves autonomous targeting through summon creation and map restoration',()=>{
    const input={map:map([actor]),actorToken:actor,sourceCharacterId:'actor',featureId:'autonomous',pluginId:'local.test',actionId:'spawn',round:1,targetCell:{col:2,row:1},initiativeD20:12,
      summon:{monsterId:'srd-5.1:zombie',durationRounds:600,concentration:false,autonomousBehavior:'attack-nearest-visible' as const}}
    const result=planDnd5eSummonedCreature(input)
    expect(result.ok,result.ok?'':result.reason).toBe(true)
    if(!result.ok)return
    const restored=migrateMapsState(JSON.parse(JSON.stringify({maps:[map([actor,result.plan.token])]})))
    expect(restored.maps[0].tokens[1].dnd5eSummon?.autonomousBehavior).toBe('attack-nearest-visible')
    for(const patch of [{commandPolicy:'turn-order' as const},{cannotAttack:true},{controlSave:{ability:'cha' as const,dc:15}}]) {
      expect(planDnd5eSummonedCreature({...input,summon:{...input.summon,...patch}})).toMatchObject({ok:false,reason:'invalid-summon'})
    }
  })
  it('persists multi-die minute linger beyond original expiry without rerolling', () => {
    const planned = planDnd5eSummonedCreature({ map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'devil', pluginId: 'local.test', actionId: 'minute-linger', round: 1,
      targetCell: { col: 2, row: 1 }, initiativeD20: 12, summon: {
        monsterId: 'srd-5.1:imp', durationRounds: 600, concentration: true,
        uncontrolledLinger: { count: 3, sides: 6, unit: 'minute' },
      } })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    const uncontrolled = { ...planned.plan.token, dnd5eSummon: { ...planned.plan.token.dnd5eSummon!, controlEnded: true as const } }
    const original = structuredClone(uncontrolled)
    const stored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map([actor, uncontrolled])] })))
    expect(stored.maps[0].tokens[1].dnd5eSummon).toMatchObject({ controlEnded: true,
      concentrationId: 'plugin-summon:minute-linger', uncontrolledLinger: { count: 3, sides: 6, unit: 'minute' } })
    for (const invalid of [[1], [0, 2, 3], [7, 2, 3], [1.5, 2, 3]]) {
      expect(() => detachDnd5eUncontrolledSummon(uncontrolled, 599, invalid)).toThrow('Invalid summon linger roll')
      expect(uncontrolled).toEqual(original)
    }
    const detached = detachDnd5eUncontrolledSummon(uncontrolled, 599, [2, 3, 4], 480)
    expect(detached.dnd5eSummon).toMatchObject({ lingerRoll: 9, lingerRolls: [2, 3, 4], dismissAtRound: 689, expiresAfterRound: 689 })
    expect(detached.dnd5eSummon?.concentrationId).toBeUndefined()
    const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map([actor, detached])] }))).maps[0].tokens[1]
    expect(restored.dnd5eSummon).toMatchObject({ lingerRolls: [2, 3, 4], dismissAtRound: 689, dismissAtWorldMinute: 489 })
    const exploration = map([actor, restored])
    const withPossessions = structuredClone(exploration)
    withPossessions.tokens[1].dnd5eCarriedObjects = [{ id: 'retained-arrows', label: 'Arrows', pickupReceipt: 'original',
      objectState: { schemaVersion: 1, wornOrCarried: true, inventoryItem: {
        templateId: 'srd-5.1:item:arrows', quantity: 3, receiptId: 'original' } } }]
    const beforePossessions = structuredClone(withPossessions)
    expect(expireDnd5eSummonLingerAtWorldMinute(withPossessions, 488)).toBe(withPossessions)
    const withDrops = expireDnd5eSummonLingerAtWorldMinute(withPossessions, 489)
    expect(withPossessions).toEqual(beforePossessions)
    const drop = withDrops.tokens.find(entry => entry.id === 'carried:retained-arrows')!
    expect(drop).toEqual(droppedDnd5eCompanionObjects(withPossessions.tokens[1])[0])
    expect(drop).toMatchObject({ type: 'obstacle', x: restored.x, y: restored.y,
      dnd5eObjectState: { wornOrCarried: false, inventoryItem: { quantity: 3, receiptId: 'carried:retained-arrows' } } })
    expect(migrateMapsState(JSON.parse(JSON.stringify({ maps: [withDrops] }))).maps[0].tokens).toHaveLength(2)
    expect(expireDnd5eSummonLingerAtWorldMinute(withDrops, 500)).toBe(withDrops)
    const conflicted = { ...withPossessions, tokens: [...withPossessions.tokens, structuredClone(drop)] }
    expect(() => expireDnd5eSummonLingerAtWorldMinute(conflicted, 489)).toThrow('carried-object-drop-conflict')
    expect(conflicted.tokens).toHaveLength(3)
    const animated = structuredClone(withPossessions)
    animated.tokens[1].dnd5eSummon!.animatedCorpse = { ...actor, id: 'original-corpse', type: 'enemy', characterId: undefined, hp: 0 }
    const restoredBody = expireDnd5eSummonLingerAtWorldMinute(animated, 489)
    expect(restoredBody.tokens.map(entry => entry.id)).toEqual([actor.id, 'original-corpse', 'carried:retained-arrows'])
    expect(restoredBody.tokens[1]).toMatchObject({ hp: 0, x: restored.x, y: restored.y })
    expect(expireDnd5eSummonLingerAtWorldMinute(exploration, 488)).toBe(exploration)
    const expired = expireDnd5eSummonLingerAtWorldMinute(exploration, 489)
    expect(expired.tokens.map(entry => entry.id)).toEqual([actor.id])
    expect(expireDnd5eSummonLingerAtWorldMinute(expired, 500)).toBe(expired)
    expect(detachDnd5eUncontrolledSummon(restored, 610, [6, 6, 6])).toBe(restored)
    expect(reconcileDnd5eSummonedCreatures({ map: map([actor, restored]), characters: [source()], round: 688 }).removedTokenIds).toEqual([])
    expect(reconcileDnd5eSummonedCreatures({ map: map([actor, restored]), characters: [source()], round: 689 }).removedTokenIds).toEqual([restored.id])
    expect(reconcileDnd5eSummonedCreatures({ map: map([actor, { ...restored, hp: 0 }]), characters: [source()], round: 610 }).removedTokenIds).toEqual([restored.id])
    expect(uncontrolled).toEqual(original)
  })
  it('accepts localized devil subtypes while still rejecting demons for a devil summon', () => {
    const input = { map: map([actor]), actorToken: actor, sourceCharacterId: 'actor', featureId: 'devil',
      pluginId: 'local.test', actionId: 'devil', round: 1, targetCell: { col: 2, row: 1 }, initiativeD20: 12 }
    expect(planDnd5eSummonedCreature({ ...input, summon: { monsterId: 'srd-5.1:imp', durationRounds: 10,
      requiredCreatureSubtype: 'devil', maximumChallengeRating: 1 } }).ok).toBe(true)
    expect(planDnd5eSummonedCreature({ ...input, summon: { monsterId: 'srd-5.1:dretch', durationRounds: 10,
      requiredCreatureSubtype: 'devil', maximumChallengeRating: 1 } }).ok).toBe(false)
  })
  it('uses the bond instance across maps so recasting or dismissing cannot leave an old mount alive',()=>{
    const planned=planDnd5eSummonedCreature({map:map([actor]),actorToken:actor,sourceCharacterId:'actor',featureId:'greater-steed',pluginId:'local',actionId:'mount-old',round:1,targetCell:{col:2,row:1},initiativeD20:12,summon:{monsterId:'srd-5.1:dire-wolf',durationRounds:1,persistent:true,bondKey:'steed',bondEffectId:'old-bond'}})
    expect(planned.ok).toBe(true);if(!planned.ok)return
    const owner=source(),mount=planned.plan.token
    const bond=createDnd5eMechanicalEffect({id:'old-bond',definitionId:'summon-bond:steed',label:'Bond',targetId:'actor',source:{kind:'spell',actorId:'actor-token'},duration:{type:'permanent'}})
    owner.dnd5eCombatState={activeEffects:[bond]}
    const remoteMap=map([mount])
    expect(reconcileDnd5eSummonedCreatures({map:remoteMap,characters:[owner],round:1000}).removedTokenIds).toEqual([])
    owner.dnd5eCombatState.activeEffects=[{...bond,id:'new-bond'}]
    expect(reconcileDnd5eSummonedCreatures({map:remoteMap,characters:[owner],round:1000}).removedTokenIds).toEqual([mount.id])
    owner.dnd5eCombatState.activeEffects=[{...bond,tags:['bond-dismissed']}]
    expect(reconcileDnd5eSummonedCreatures({map:remoteMap,characters:[owner],round:1000}).removedTokenIds).toEqual([mount.id])
  })
  afterEach(() => setDnd5eRoomMonsterCatalog([]))
  it('rolls the control save at the creature turn end and persists loss of control without ending concentration',()=>{
    const result=planDnd5eSummonedCreature({map:map([actor]),actorToken:actor,sourceCharacterId:'actor',featureId:'demon',pluginId:'local.test',actionId:'control',round:1,targetCell:{col:2,row:1},initiativeD20:12,summon:{monsterId:'srd-5.1:dretch',durationRounds:600,concentration:true,controlSave:{ability:'cha',dc:15,disadvantage:true,lingerDieSides:6}}})
    expect(result.ok).toBe(true);if(!result.ok)return
    const demon=result.plan.token,current=map([actor,demon]),characters=[source('plugin-summon:control')]
    const snapshot=createDnd5eMapCombatSnapshot({combatId:'control',map:current,characters,initiativeOrder:[result.plan.initiativeEntry,{tokenId:actor.id,label:actor.label,emoji:'',color:'',roll:1}]})
    const effect=demon.dnd5eCombatState!.activeEffects![0]
    expect(resolveDnd5eHeadlessAction(snapshot.state,{type:'end-turn',actorId:demon.id}).ok).toBe(false)
    const failed=resolveDnd5eHeadlessAction(snapshot.state,{type:'end-turn',actorId:demon.id,activeEffectSavingThrows:[{effectId:effect.id,d20:20,d20Second:1}]})
    expect(failed.ok,JSON.stringify(failed)).toBe(true)
    if(failed.ok)expect(failed.state.combatants[demon.id].classState.activeEffects?.some(e=>e.id===effect.id)).toBe(true)
    const saved=resolveDnd5eHeadlessAction(snapshot.state,{type:'end-turn',actorId:demon.id,activeEffectSavingThrows:[{effectId:effect.id,d20:20,d20Second:20}]})
    expect(saved.ok).toBe(true);if(!saved.ok)return
    const applied=planDnd5eMapResultApplication({state:saved.state,map:current,characters,characterIdByCombatantId:snapshot.characterIdByCombatantId,events:[...saved.events]})
    expect(applied.map.tokens.find(t=>t.id===demon.id)?.dnd5eSummon).toMatchObject({controlEnded:true,concentrationId:'plugin-summon:control'})
    expect(saved.state.combatants[actor.id].classState.concentrationSpellId).toBe('plugin-summon:control')
  })
  it('enforces summon catalog CR/subtype and distinguishes controlled dismissal from lost-control lingering', () => {
    const input={map:map([actor]),actorToken:actor,sourceCharacterId:'actor',featureId:'demon',pluginId:'local.test',actionId:'demon',round:1,targetCell:{col:2,row:1},initiativeD20:12}
    const summon={monsterId:'srd-5.1:dretch',durationRounds:600,concentration:true,side:'ally' as const,maximumChallengeRating:5,requiredCreatureSubtype:'demon',controlSave:{ability:'cha' as const,dc:15,disadvantage:true,lingerDieSides:6}}
    const result=planDnd5eSummonedCreature({...input,summon})
    expect(result.ok).toBe(true)
    expect(planDnd5eSummonedCreature({...input,summon:{...summon,monsterId:'srd-5.1:wolf'}}).ok).toBe(false)
    expect(planDnd5eSummonedCreature({...input,summon:{...summon,monsterId:'srd-5.1:balor'}}).ok).toBe(false)
    if(!result.ok)return
    const token=result.plan.token
    expect(token.dnd5eCombatState?.activeEffects?.[0].repeatSave).toMatchObject({ability:'cha',dc:15,disadvantage:true,timing:'target-turn-end'})
    expect(reconcileDnd5eSummonedCreatures({map:map([actor,token]),characters:[source()],round:2}).removedTokenIds).toEqual([token.id])
    const escaped={...token,dnd5eSummon:{...token.dnd5eSummon!,controlEnded:true as const}}
    const lingering=detachDnd5eUncontrolledSummon(escaped,2,4)
    expect(lingering.dnd5eSummon).toMatchObject({dismissAtRound:6,lingerRoll:4})
    expect(detachDnd5eUncontrolledSummon(lingering,3,1)).toBe(lingering)
    expect(reconcileDnd5eSummonedCreatures({map:map([actor,lingering]),characters:[source()],round:5}).removedTokenIds).toEqual([])
    expect(reconcileDnd5eSummonedCreatures({map:map([actor,lingering]),characters:[source()],round:6}).removedTokenIds).toEqual([token.id])
    expect(reconcileDnd5eSummonedCreatures({map:map([actor,escaped]),characters:[source()],round:601}).removedTokenIds).toEqual([token.id])
  })

  it('adds a persisted summon bonus once to each weapon hit, not to every damage component', () => {
    const attack = dnd5eSummonedCreatureWeaponAttack({
      mode: 'melee', toHit: 4, target: 'one creature',
      damage: [
        { average: 5, count: 1, sides: 6, bonus: 2, type: 'piercing' },
        { average: 3, count: 1, sides: 6, bonus: 0, type: 'necrotic' },
      ],
    }, 3, 2)
    expect(attack.toHit).toBe(6)
    expect(attack.damage).toEqual([
      expect.objectContaining({ bonus: 5, type: 'piercing' }),
      expect.objectContaining({ bonus: 0, type: 'necrotic' }),
    ])
  })

  it('creates an allied SRD creature at an unoccupied cell with authoritative initiative', () => {
    const result = planDnd5eSummonedCreature({
      map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'com.example:wolf', pluginId: 'com.example', actionId: 'action-1', round: 2,
      targetCell: { col: 2, row: 1 }, initiativeD20: 12,
      summon: {
        monsterId: 'srd-5.1:wolf', durationRounds: 10, concentration: true, side: 'ally',
        temporaryHitPoints: 8, minimumMaximumHitPoints: 40, maximumHitPointBonus: 6,
        armorClassBonus: 3, weaponAttackBonus: 3, weaponDamageBonus: 3,
        savingThrowBonus: 3, proficientSkillCheckBonus: 3,
        weaponAttacksMagical: true, attacksPerAction: 2, shareSelfSpellsRangeFeet: 30,
        cannotAttack: true,
        walkingSpeedFeet: 100, dismissAfterDamageRounds: 10,
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.token).toMatchObject({
      id: 'plugin-summon:action-1', poolId: 'srd-5.1:wolf', visualVariantId: 'rain-stalker',
      type: 'enemy', hp: 40, maxHp: 40,
      dnd5eCombatState: { temporaryHp: 8 },
      dnd5eSummon: {
        sourceCharacterId: 'actor', createdRound: 2, expiresAfterRound: 11,
        concentrationId: 'plugin-summon:action-1', side: 'player',
        minimumMaximumHitPoints: 40, maximumHitPointBonus: 6,
        armorClassBonus: 3, weaponAttackBonus: 3, weaponDamageBonus: 3,
        savingThrowBonus: 3, proficientSkillCheckBonus: 3,
        weaponAttacksMagical: true, attacksPerAction: 2, shareSelfSpellsRangeFeet: 30,
        cannotAttack: true,
        walkingSpeedFeet: 100, dismissAfterDamageRounds: 10,
      },
    })
    expect(result.plan.initiativeEntry).toMatchObject({ tokenId: 'plugin-summon:action-1', roll: 14 })
  })

  it('starts a summon damage-dismissal timer once and removes it at the authoritative round', () => {
    const planned = planDnd5eSummonedCreature({
      map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'spell:phantom-steed', pluginId: 'srd-5.1', actionId: 'phantom-steed', round: 2,
      targetCell: { col: 2, row: 1 }, initiativeD20: 12,
      summon: {
        monsterId: 'srd-5.1:riding-horse', durationRounds: 600, side: 'ally',
        walkingSpeedFeet: 100, dismissAfterDamageRounds: 10,
      },
    })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    const placed = map([actor, planned.plan.token])
    const damaged = markDnd5eSummonsDamaged(placed, new Set([planned.plan.token.id]), 3)
    expect(damaged.tokens[1].dnd5eSummon).toMatchObject({ dismissAtRound: 13 })
    expect(markDnd5eSummonsDamaged(damaged, new Set([planned.plan.token.id]), 7)).toBe(damaged)
    expect(reconcileDnd5eSummonedCreatures({ map: damaged, characters: [source()], round: 12 }).removedTokenIds).toEqual([])
    expect(reconcileDnd5eSummonedCreatures({ map: damaged, characters: [source()], round: 13 }).removedTokenIds)
      .toEqual([planned.plan.token.id])
  })

  it('keeps a True Polymorph creature only after completed concentration and ends caster control', () => {
    const planned = planDnd5eSummonedCreature({
      map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'spell:true-polymorph', pluginId: 'srd-5.1', actionId: 'true-polymorph',
      concentrationId: 'true-polymorph', createdWorldMinute: 480, round: 2,
      targetCell: { col: 2, row: 1 }, initiativeD20: 12,
      summon: {
        monsterId: 'srd-5.1:brown-bear', durationRounds: 600,
        concentration: true, side: 'ally', persistAfterConcentrationCompletes: true,
      },
    })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    expect(planned.plan.token.dnd5eSummon).toMatchObject({
      concentrationId: 'true-polymorph', createdWorldMinute: 480,
      persistAfterConcentrationCompletes: true,
    })

    const interrupted = reconcileDnd5eSummonedCreatures({
      map: map([actor, planned.plan.token]), characters: [source()], round: 3,
    })
    expect(interrupted.removedTokenIds).toEqual([planned.plan.token.id])

    const completedSource = source()
    completedSource.dnd5eCombatState = {
      lastCompletedConcentration: {
        spellId: 'true-polymorph', completedWorldMinute: 540,
      },
    }
    const completed = reconcileDnd5eSummonedCreatures({
      map: map([actor, planned.plan.token]), characters: [completedSource], round: 3,
    })
    expect(completed.removedTokenIds).toEqual([])
    expect(completed.promotedTokenIds).toEqual([planned.plan.token.id])
    expect(completed.map.tokens.find((token) => token.id === planned.plan.token.id)?.dnd5eSummon)
      .toMatchObject({
        persistent: true, controlEnded: true,
        concentrationId: undefined,
        persistAfterConcentrationCompletes: undefined,
      })
  })

  it('rotates a summon to the next unused portrait for the same monster', () => {
    const existingWolf: Token = {
      ...actor,
      id: 'existing-wolf',
      label: '狼',
      x: 225,
      y: 225,
      type: 'enemy',
      characterId: undefined,
      poolId: 'srd-5.1:wolf',
      visualVariantId: 'rain-stalker',
    }
    const result = planDnd5eSummonedCreature({
      map: map([actor, existingWolf]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'com.example:wolf', pluginId: 'com.example', actionId: 'action-2', round: 2,
      targetCell: { col: 2, row: 1 }, initiativeD20: 12,
      summon: { monsterId: 'srd-5.1:wolf', durationRounds: 10, side: 'ally' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.token.visualVariantId).toBe('snow-howler')
  })

  it('places a room-local workshop monster through the same summon boundary', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.name = '房间援军'
    const roomMonster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([roomMonster])

    const result = planDnd5eSummonedCreature({
      map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'local.activity:reinforcement', pluginId: 'local.activity',
      actionId: 'room-monster-action', round: 2,
      targetCell: { col: 2, row: 1 }, initiativeD20: 11,
      summon: { monsterId: roomMonster.id, durationRounds: 3, side: 'ally' },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.token).toMatchObject({
      poolId: roomMonster.id,
      label: '房间援军',
      dnd5eSummon: { side: 'player', expiresAfterRound: 4 },
    })
  })

  it('rejects occupied placement before the action can spend resources', () => {
    const result = planDnd5eSummonedCreature({
      map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'com.example:wolf', pluginId: 'com.example', actionId: 'action-1', round: 1,
      targetCell: { col: 0, row: 0 }, initiativeD20: 10,
      summon: { monsterId: 'srd-5.1:wolf', durationRounds: 1 },
    })
    expect(result).toEqual({ ok: false, reason: 'summon-position-blocked' })
  })

  it('rejects a placement inside blocking geometry or behind a line-of-effect wall', () => {
    const geometry = createEmptyMapGeometry('map-1', 1)
    geometry.walls.push({
      id: 'wall', kind: 'wall', label: '墙', points: [{ x: 75, y: 0 }, { x: 75, y: 150 }],
      blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
      baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    })
    expect(planDnd5eSummonedCreature({
      map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'com.example:wolf', pluginId: 'com.example', actionId: 'blocked', round: 1,
      targetCell: { col: 2, row: 0 }, initiativeD20: 10, geometry,
      summon: { monsterId: 'srd-5.1:wolf', durationRounds: 1 },
    })).toEqual({ ok: false, reason: 'summon-position-blocked' })

    geometry.walls[0] = { ...geometry.walls[0], blocksLineOfEffect: false }
    expect(planDnd5eSummonedCreature({
      map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'com.example:wolf', pluginId: 'com.example', actionId: 'inside', round: 1,
      targetCell: { col: 1, row: 0 }, initiativeD20: 10, geometry,
      summon: { monsterId: 'srd-5.1:wolf', durationRounds: 1 },
    })).toEqual({ ok: false, reason: 'summon-position-blocked' })
  })

  it('rebases summon commits without rolling back unrelated token changes', () => {
    const summon = { ...actor, id: 'plugin-summon:action-1', x: 125, label: '狼', characterId: undefined }
    const latestActor = { ...actor, x: 75, hp: 17 }
    const target = { ...actor, id: 'target', characterId: 'target-character', x: 175, hp: 8 }
    const resolvedTarget = { ...target, hp: 3 }
    const tokens = rebaseDnd5eSummonedCreatureTokens({
      latestMap: map([latestActor, target]),
      resolvedTokens: [actor, resolvedTarget, summon],
      changedTokenIds: ['target', summon.id],
      summonedToken: summon,
    })
    expect(tokens.find((token) => token.id === actor.id)).toMatchObject({ x: 75, hp: 17 })
    expect(tokens.find((token) => token.id === target.id)?.hp).toBe(3)
    expect(tokens.filter((token) => token.id === summon.id)).toHaveLength(1)
  })

  it('removes a summon when concentration ends, duration expires, or it reaches 0 HP', () => {
    const planned = planDnd5eSummonedCreature({
      map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'com.example:wolf', pluginId: 'com.example', actionId: 'action-1', round: 1,
      targetCell: { col: 2, row: 0 }, initiativeD20: 10,
      summon: { monsterId: 'srd-5.1:wolf', durationRounds: 2, concentration: true },
    })
    if (!planned.ok) throw new Error(planned.reason)
    const activeMap = map([actor, planned.plan.token])
    expect(reconcileDnd5eSummonedCreatures({
      map: activeMap, characters: [source('plugin-summon:action-1')], round: 2,
    }).removedTokenIds).toEqual([])
    expect(reconcileDnd5eSummonedCreatures({
      map: activeMap, characters: [source()], round: 2,
    }).removedTokenIds).toEqual(['plugin-summon:action-1'])
    expect(reconcileDnd5eSummonedCreatures({
      map: activeMap, characters: [source('plugin-summon:action-1')], round: 3,
    }).removedTokenIds).toEqual(['plugin-summon:action-1'])
    expect(reconcileDnd5eSummonedCreatures({
      map: { ...activeMap, tokens: [actor, { ...planned.plan.token, hp: 0 }] },
      characters: [source('plugin-summon:action-1')], round: 2,
    }).removedTokenIds).toEqual(['plugin-summon:action-1'])
  })

  it('keeps a Conjure Elemental summon and flips it hostile when concentration ends', () => {
    const planned = planDnd5eSummonedCreature({
      map: map([actor]), actorToken: actor, sourceCharacterId: 'actor',
      featureId: 'spell:conjure-elemental', pluginId: 'srd-5.1',
      actionId: 'conjure-elemental-cast', concentrationId: 'conjure-elemental', round: 1,
      targetCell: { col: 2, row: 0 }, initiativeD20: 10,
      summon: {
        monsterId: 'srd-5.1:fire-elemental', durationRounds: 600,
        concentration: true, side: 'ally', becomesHostileAfterConcentrationEnds: true,
      },
    })
    if (!planned.ok) throw new Error(planned.reason)
    const activeMap = map([actor, planned.plan.token])
    const reconciled = reconcileDnd5eSummonedCreatures({
      map: activeMap, characters: [source()], round: 2,
    })
    expect(reconciled.removedTokenIds).toEqual([])
    expect(reconciled.hostileTokenIds).toEqual([planned.plan.token.id])
    expect(reconciled.map.tokens.find((token) => token.id === planned.plan.token.id)?.dnd5eSummon)
      .toMatchObject({
        side: 'enemy', controlEnded: true, expiresAfterRound: 600,
        concentrationId: undefined, becomesHostileAfterConcentrationEnds: undefined,
      })
  })
})

it('retains declared creature type, minimum intelligence and mounted sharing policy on a summon', () => {
  const result=planDnd5eSummonedCreature({map:map([actor]),actorToken:actor,sourceCharacterId:'actor',featureId:'local:mount',pluginId:'local',actionId:'mount',round:1,targetCell:{col:3,row:1},initiativeD20:10,summon:{monsterId:'srd-5.1:dire-wolf',durationRounds:1,persistent:true,creatureTypeOverride:'fey',minimumIntelligence:6,shareSelfSpellsRangeFeet:5,shareSelfSpellsRequiresMounted:true}})
  expect(result.ok).toBe(true)
  if(result.ok) {
    expect(result.plan.token).toMatchObject({creatureTypes:['fey'],dnd5eSummon:{creatureTypeOverride:'fey',minimumIntelligence:6,shareSelfSpellsRequiresMounted:true}})
    const snapshot=createDnd5eMapCombatSnapshot({combatId:'mount-profile',map:map([actor,result.plan.token]),characters:[],initiativeOrder:[result.plan.initiativeEntry]})
    expect(snapshot.state.combatants[result.plan.token.id]).toMatchObject({creatureType:'fey',abilities:{int:6},summonedShareSelfSpellsRequiresMounted:true})
  }
})
