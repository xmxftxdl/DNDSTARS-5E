import { getDnd5eSrdMonster, setDnd5eRoomMonsterCatalog } from './monsters'
import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { auditDnd5eMonsterHeadlessCoverage } from './monsterHeadlessCoverage'
import {previewDnd5eMonsterCompositePrefix} from './headlessCombatEngine'
import {createDnd5eMechanicalEffect} from './activeEffects'
import {dnd5eRollDiceRecipes} from './rollDiceModifiers'
import {dnd5eRollDiceOccurrenceId} from './rollDiceTransaction'
import {registerDnd5eRulesPlugin} from './pluginApi'
import type {Dnd5eAction} from './headlessCombatEngine'

function combatant(input: {
  id: string
  initiative: number
  controller: 'dm' | 'player'
  statBlockId?: string
  x?: number
}): Dnd5eCombatant {
  return createDnd5eCombatant({
    id: input.id,
    name: input.id,
    controller: input.controller,
    initiative: input.initiative,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 200,
    maxHp: 200,
    temporaryHp: 0,
    speed: 30,
    position: { x: input.x ?? 0, y: 0 },
    concentrating: false,
    statBlockId: input.statBlockId,
  })
}

function dragonComposite(firstStep: 'use' | 'skip') {
  return {
    type: 'monster-multiattack-composite' as const,
    schemaVersion: 1 as const,
    actorId: 'dragon',
    actionId: 'multiattack',
    steps: [
      firstStep === 'skip'
        ? {
            kind: 'skip' as const,
            actionId: 'frightful-presence',
          }
        : {
            kind: 'area' as const,
            actionId: 'frightful-presence',
            resolution: {
              schemaVersion: 1 as const,
              targetIds: ['hero'],
              targetSavingThrows: [{ targetId: 'hero', d20: 1 }],
              damageRolls: [],
            },
          },
      {
        kind: 'weapon' as const,
        actionId: 'bite',
        roll: { targetId: 'hero', d20: 1, damageRolls: [] },
      },
      {
        kind: 'weapon' as const,
        actionId: 'claw',
        roll: { targetId: 'hero', d20: 1, damageRolls: [] },
      },
      {
        kind: 'weapon' as const,
        actionId: 'claw',
        roll: { targetId: 'hero', d20: 1, damageRolls: [] },
      },
    ],
  }
}

function state() {
  return startDnd5eHeadlessCombat('dragon-composite', [
    combatant({
      id: 'dragon',
      initiative: 20,
      controller: 'dm',
      statBlockId: 'srd-5.1:adult-black-dragon',
    }),
    combatant({ id: 'hero', initiative: 10, controller: 'player', x: 5 }),
  ])
}

describe('monster composite Multiattack', () => {
  it.each([true, false].flatMap(hit => ['area', 'weapon'].map(shape => ({hit, shape}))))('resolves a counter before a composite $shape save (hit=$hit)', ({hit, shape}) => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'test.area-step-counter', name: 'Counter', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' },
      setup(api) { api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'hunter', name: 'Hunter',
        classId: 'ranger', summary: 'Synthetic', abilities: [{ schemaVersion: 1, id: 'counter',
          name: 'Counter', description: 'Synthetic', level: 15, trigger: { kind: 'before-saving-throw' },
          cost: { economy: 'reaction' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
          mechanic: { kind: 'saving-throw-weapon-counterattack', markEffectDefinitionId: 'prey' } }] }) },
    })
    try {
      const source = state(), hunter = source.combatants.hero
      hunter.classId = 'ranger'; hunter.classLevels = { ranger: 15 }; hunter.level = 15
      hunter.subclassIds = { ranger: 'test.area-step-counter:hunter' }
      hunter.pluginFeatureIds = ['test.area-step-counter:hunter.counter']
      const mark = createDnd5eMechanicalEffect({ definitionId: 'prey', label: 'Prey', targetId: 'hero',
        source: { kind: 'plugin', actorId: 'hero', pluginId: 'test.area-step-counter' },
        modifiers: { onHitBonusDamage: { count: 1, sides: 6, bonus: 0, damageType: 'inherit-primary',
          appliesTo: 'all-weapon-attacks', doubleDiceOnCritical: true, oncePerTurn: true,
          consumeEffectOnHit: false, boundTargetId: 'dragon' } } })
      hunter.classState.activeEffects = [mark]
      const intent: Extract<Dnd5eAction, { type: 'monster-multiattack-composite' }> = dragonComposite('use')
      const area = intent.steps[0]
      if (area.kind !== 'area') throw Error('missing area step')
      area.resolution.targetSavingThrows = [{ targetId: 'hero', d20: hit ? 0 : 1 }]
      area.savingThrowCounterattacks = [{ targetId: 'hero', sourceId: 'dragon', ability: 'wis',
        occurrence: 0, featureId: 'test.area-step-counter:hunter.counter', attack: {
          type: 'attack', actorId: 'hero', targetId: 'dragon', d20: hit ? 18 : 1, attackModifier: 20,
          damage: { count: 1, sides: 6, bonus: 0, rolls: hit ? [2] : [], type: 'slashing' },
          classDamageContext: { mode: 'melee', weaponId: 'sword', finesse: false, strengthBased: true,
            weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false },
          classDamageRolls: hit ? [{ source: 'activity-effect-rider', rollId: `activity-on-hit:${mark.id}`, rolls: [4] }] : [],
        } }]
      if (shape === 'weapon') {
        const monster = structuredClone(getDnd5eSrdMonster('srd-5.1:adult-black-dragon')!)
        monster.id = 'test:counter-composite-dragon'
        const bite = monster.actions.find(action => action.id === 'bite')!
        bite.attack!.onHitEffects = getDnd5eSrdMonster('srd-5.1:ghoul')!.actions.find(action => action.id === 'claws')!.attack!.onHitEffects
        setDnd5eRoomMonsterCatalog([monster])
        source.combatants.dragon.statBlockId = monster.id
        const weapon = intent.steps[1]
        if (weapon.kind !== 'weapon') throw Error('missing weapon step')
        weapon.savingThrowCounterattacks = area.savingThrowCounterattacks!.map(use => ({...use, ability:'con'}))
        area.savingThrowCounterattacks = undefined
        area.resolution.targetSavingThrows = [{targetId:'hero',d20:20}]
        weapon.roll = {targetId:'hero',d20:18,
          damageRolls:bite.attack!.damage.map(damage => Array(damage.count).fill(1)),
          onHitEffectRolls:bite.attack!.onHitEffects!.map(effect => ({effectId:effect.id,d20:hit?0:1}))}
      }
      const before = structuredClone(source)
      const result = resolveDnd5eHeadlessAction(source, intent)
      expect(result.ok, result.ok ? '' : result.reason).toBe(true)
      expect(source).toEqual(before)
      expect(result.state.combatants.hero.conditions.includes(shape === 'weapon' ? 'paralyzed' : 'frightened')).toBe(!hit)
      expect(result.state.combatants.dragon.currentHp).toBe(hit ? 194 : 200)
      expect(result.events.filter(e => e.type === 'attack-resolved')).toHaveLength(4)
      expect(result.events.filter(e => e.type === 'turn-resource-spent' && e.resource === 'reaction')).toHaveLength(1)
      expect(result.events.filter(e => e.type === 'turn-resource-spent' && e.resource === 'action')).toHaveLength(1)
    } finally { setDnd5eRoomMonsterCatalog([]); dispose() }
  })
  it('previews ordered prefixes without authorizing partial commits or retaining expired effect dice',()=>{
    const source=state(),action=dragonComposite('use'),transactionId='composite-preview'
    source.combatants.dragon.classState.activeEffects=[createDnd5eMechanicalEffect({id:'once',definitionId:'once',label:'Once',targetId:'dragon',source:{kind:'plugin'},
      breakOn:['makes-weapon-attack'],modifiers:{rollDiceModifiers:[{count:1,sides:6,direction:'subtract',appliesTo:['attack']}]}})]
    const original=structuredClone(source)
    const effectRollDice=Object.fromEntries(dnd5eRollDiceRecipes({actorId:'dragon',effects:source.combatants.dragon.classState.activeEffects,kind:'attack',
      eventId:dnd5eRollDiceOccurrenceId(transactionId,'dragon','attack',0)}).map(recipe=>[recipe.id,[6]]))
    const first=previewDnd5eMonsterCompositePrefix(source,{...action,steps:action.steps.slice(0,1)},transactionId)
    expect(first.ok).toBe(true)
    if(!first.ok)return
    expect(first.state.combatants.hero.conditions).toContain('frightened')
    expect(first.state.combatants.dragon.turn.actionAvailable).toBe(true)
    expect(first.state.combatants.dragon.classState.activeEffects?.some(effect=>effect.id==='once')).toBe(true)
    expect(first).not.toHaveProperty('transaction')
    expect(first.rollDiceOccurrences).toEqual([{actorId:'hero',kind:'saving-throw',count:1}])
    const second=previewDnd5eMonsterCompositePrefix(source,{...action,steps:action.steps.slice(0,2),effectRollDice},transactionId)
    expect(second.ok,JSON.stringify(second)).toBe(true)
    if(!second.ok)return
    expect(second.state.combatants.dragon.classState.activeEffects?.some(effect=>effect.id==='once')).toBeFalsy()
    expect(second.events.filter(event=>event.type==='attack-resolved')).toHaveLength(1)
    expect(second.rollDiceOccurrences).toContainEqual({actorId:'dragon',kind:'attack',count:1})
    const invalid=previewDnd5eMonsterCompositePrefix(source,{...action,steps:[action.steps[2]]},transactionId)
    expect(invalid.ok).toBe(false)
    expect(resolveDnd5eHeadlessAction(source,{...action,steps:action.steps.slice(0,2),effectRollDice},{transactionId}).ok).toBe(false)
    const full=resolveDnd5eHeadlessAction(source,{...action,effectRollDice},{transactionId})
    expect(full.ok,JSON.stringify(full)).toBe(true)
    expect(full.state.combatants.dragon.turn.actionAvailable).toBe(false)
    expect(full.events.filter(event=>event.type==='attack-resolved')).toHaveLength(3)
    expect(source).toEqual(original)
  })
  it('settles Frightful Presence and three weapon attacks as one action', () => {
    const result = resolveDnd5eHeadlessAction(state(), dragonComposite('use'))

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.conditions).toContain('frightened')
    expect(result.events.filter((event) =>
      event.type === 'attack-resolved')).toHaveLength(3)
    expect(result.events.filter((event) =>
      event.type === 'monster-area-action-resolved')).toHaveLength(1)
    expect(result.events.filter((event) =>
      event.type === 'turn-resource-spent' &&
      event.actorId === 'dragon' &&
      event.resource === 'action')).toHaveLength(1)
    expect(result.events).toContainEqual({
      type: 'monster-multiattack-composite-resolved',
      actorId: 'dragon',
      actionId: 'multiattack',
      resolvedActionIds: [
        'frightful-presence',
        'bite',
        'claw',
        'claw',
      ],
      skippedActionIds: [],
    })
  })

  it('binds a target save penalty to the composite root and retains it through all attack prefixes',()=>{
    const source=state(),action=dragonComposite('use'),transactionId='composite-save-effect'
    const first=action.steps[0]
    if(first.kind!=='area')throw Error('expected area child')
    first.resolution.targetSavingThrows[0].d20=16
    expect(resolveDnd5eHeadlessAction(source,action).state.combatants.hero.conditions).not.toContain('frightened')
    source.combatants.hero.classState.activeEffects=[createDnd5eMechanicalEffect({id:'save-penalty',definitionId:'save-penalty',label:'Penalty',targetId:'hero',source:{kind:'plugin'},
      modifiers:{rollDiceModifiers:[{count:1,sides:6,direction:'subtract',appliesTo:['saving-throw']}]}})]
    const original=structuredClone(source)
    const dice=(occurrence:number)=>Object.fromEntries(dnd5eRollDiceRecipes({actorId:'hero',kind:'saving-throw',effects:source.combatants.hero.classState.activeEffects,
      eventId:dnd5eRollDiceOccurrenceId(transactionId,'hero','saving-throw',occurrence)}).map(recipe=>[recipe.id,[6]]))
    expect(previewDnd5eMonsterCompositePrefix(source,{...action,steps:[first]},transactionId).ok).toBe(false)
    expect(previewDnd5eMonsterCompositePrefix(source,{...action,steps:[first],effectRollDice:dice(1)},transactionId).ok).toBe(false)
    for(let length=1;length<=action.steps.length;length++){
      const prefix=previewDnd5eMonsterCompositePrefix(source,{...action,steps:action.steps.slice(0,length),effectRollDice:dice(0)},transactionId)
      expect(prefix.ok,JSON.stringify(prefix)).toBe(true)
      if(!prefix.ok)continue
      expect(prefix.rollDiceOccurrences).toContainEqual({actorId:'hero',kind:'saving-throw',count:1})
      expect(prefix.events).toContainEqual(expect.objectContaining({type:'saving-throw-resolved',targetId:'hero',d20:16,modifier:-6,total:10,success:false}))
      expect(prefix.state.combatants.hero.conditions).toContain('frightened')
    }
    const final=resolveDnd5eHeadlessAction(source,{...action,effectRollDice:dice(0)},{transactionId})
    expect(final.ok,JSON.stringify(final)).toBe(true)
    expect(final.state.combatants.hero.conditions).toContain('frightened')
    expect(final.events.filter(event=>event.type==='attack-resolved')).toHaveLength(3)
    expect(source).toEqual(original)
  })

  it('supports the dragon rule’s optional Frightful Presence branch', () => {
    const result = resolveDnd5eHeadlessAction(state(), dragonComposite('skip'))

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.conditions).not.toContain('frightened')
    expect(result.events.filter((event) =>
      event.type === 'attack-resolved')).toHaveLength(3)
    expect(result.events).toContainEqual({
      type: 'monster-multiattack-composite-resolved',
      actorId: 'dragon',
      actionId: 'multiattack',
      resolvedActionIds: ['bite', 'claw', 'claw'],
      skippedActionIds: ['frightful-presence'],
    })
  })

  it('does not allow a required weapon occurrence to be skipped', () => {
    const action = dragonComposite('skip')
    const result = resolveDnd5eHeadlessAction(state(), {
      ...action,
      steps: [
        action.steps[0],
        { kind: 'skip', actionId: 'bite' },
        action.steps[2],
        action.steps[3],
      ],
    })

    expect(result).toMatchObject({ ok: false, reason: 'invalid-monster-action' })
  })

  it('reports all adult and ancient dragon originals as executable Headless composites', () => {
    const rows = auditDnd5eMonsterHeadlessCoverage().actions.rows.filter((row) =>
      /^(?:adult|ancient)-.+-dragon$/.test(row.slug) &&
      row.actionId === 'multiattack')

    expect(rows).toHaveLength(20)
    expect(rows.map((row) => ({
      slug: row.slug,
      effectiveAutomation: row.effectiveAutomation,
      blockers: row.blockedChildIds,
    }))).toEqual(rows.map((row) => ({
      slug: row.slug,
      effectiveAutomation: 'headless',
      blockers: [],
    })))
  })
})
