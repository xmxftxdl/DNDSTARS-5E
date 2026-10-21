import { normalizeCharacter } from '../../../store/characters'
import { migrateCharacterToDnd5e } from '../character'
import { DND5E_LONGSWORD } from '../equipment'
import { describe, expect, it, vi } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { dnd5eBestowCurseSpellDamageRollDeclarationsV1 } from './dnd5eActivityRollRecipe'
import { dnd5eActivityPerTargetRollDeclarationsV1 } from './dnd5eActivityPerTargetRolls'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

const abilities = { str: 14, dex: 12, con: 12, int: 10, wis: 10, cha: 16 } as const
const actor: Dnd5eActivityActorSnapshot = {
  id: 'actor', controller: 'players', level: 5, proficiencyBonus: 3, abilities,
  armorClass: 15, conditions: [], currentHp: 30, maxHp: 30,
}
const target: Dnd5eActivityActorSnapshot = {
  id: 'target', controller: 'dm', level: 3, proficiencyBonus: 2, abilities,
  armorClass: 14, conditions: [], currentHp: 20, maxHp: 20, savingThrowModifiers: { dex: 1 },
}

it.each([true, false])('uses only the Host counter outcome for its exact saving throw (counter=%s)', counter => {
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'counter-save', name: 'Counter save', activation: { kind: 'action' },
    target: { kind: 'creature', relation: 'any', count: 2 },
    automation: automationCapabilityFromLegacyStatus('full'),
    checks: [{ id: 'save', kind: 'saving-throw', scope: 'per-target', rollId: 'save',
      ability: 'dex', dc: { kind: 'constant', value: 15 } }],
    outcomes: [
      { id: 'failed', when: { kind: 'check', checkId: 'save', result: 'failure' },
        operations: [{ id: 'hurt', kind: 'damage', target: 'target',
          amount: { kind: 'constant', value: 8 }, damageType: 'fire' }] },
      { id: 'saved', when: { kind: 'check', checkId: 'save', result: 'success' },
        operations: [{ id: 'half', kind: 'damage', target: 'target',
          amount: { kind: 'constant', value: 4 }, damageType: 'fire' }] },
    ],
  }
  const bonus = vi.fn(() => 0), negate = vi.fn(() => false)
  const rolls: Record<string, { values: number[] }> = { 'save:other': { values: [1] } }
  if (!counter) rolls['save:target'] = { values: [1] }
  const result = resolveDnd5eActivity({ activity, actor, targets: [target, { ...target, id: 'other' }],
    rolls, optionalSavingThrowBonus: bonus, negateDisadvantage: negate,
    weaponCounterattackSuccessCheckKeys: counter ? new Set(['save:target']) : undefined })
  expect(result.ok, result.ok ? '' : result.reason).toBe(true)
  if (!result.ok) return
  expect(result.checks.find(check => check.targetId === 'target')).toMatchObject({
    success: counter, d20: counter ? 0 : 1,
    automaticOutcome: counter ? 'weapon-counterattack-success' : undefined,
    criticalSuccess: false, criticalFailure: !counter,
  })
  expect(result.checks.find(check => check.targetId === 'other')).toMatchObject({ success: false, d20: 1 })
  expect(bonus).toHaveBeenCalledTimes(counter ? 1 : 2)
  expect(result.proposals.filter(proposal => proposal.kind === 'deal-damage').map(proposal =>
    [proposal.targetId, proposal.amount])).toEqual(expect.arrayContaining([
      ['target', counter ? 4 : 8], ['other', 8],
    ]))
})

it('executes explicit breathing capabilities from serialized activity declarations', () => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'breathing', name: 'Breathing',
    activation: { kind: 'free' }, target: { kind: 'self' }, automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'airless', name: 'Airless', stacking: 'replace', duration: { kind: 'permanent' },
      modifiers: [{ kind: 'environmental-capability', doesNotNeedAir: true, holdBreathSeconds: 3600 }] }],
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'airless' }] }] }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const result = resolveDnd5eActivity({ activity: JSON.parse(JSON.stringify(activity)), actor, targets: [actor], rolls: {} })
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.proposals).toContainEqual(expect.objectContaining({ kind: 'apply-effect',
    modifierGroups: [expect.objectContaining({ environmentalCapabilities: expect.objectContaining({ doesNotNeedAir: true, holdBreathSeconds: 3600 }) })] }))
  for (const patch of [{ doesNotNeedAir: false }, { holdBreathSeconds: -1 }, { holdBreathSeconds: 86401 }, { holdBreathSeconds: '60' }]) {
    const invalid = structuredClone(activity)
    Object.assign(invalid.effects![0].modifiers![0], patch)
    expect(validateDnd5eActivityDefinitionV1(invalid).some(error => error.includes('environmental capability'))).toBe(true)
  }
})

it('carries declared harmful movement through execution and rejects malformed declarations',()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'harmful-move',name:'Harmful move',activation:{kind:'action'},
  target:{kind:'creature',relation:'any',count:1},automation:automationCapabilityFromLegacyStatus('full'),
  outcomes:[{id:'move',when:{kind:'always'},operations:[{id:'push',kind:'move',target:'target',mode:'forced',harmful:true,distanceFeet:{kind:'constant',value:5}}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const resolved=resolveDnd5eActivity({activity:JSON.parse(JSON.stringify(activity)),actor,targets:[target],rolls:{}})
 expect(resolved.ok).toBe(true)
 if(resolved.ok)expect(resolved.proposals).toContainEqual(expect.objectContaining({kind:'move',targetId:'target',harmful:true}))
 for(const value of [false,'true',1]){
  const invalid=structuredClone(activity);Object.assign(invalid.outcomes[0].operations[0],{harmful:value})
  expect(validateDnd5eActivityDefinitionV1(invalid).some(error=>error.includes('harmful'))).toBe(true)
 }
})

it('branches on Host upward clearance and fails closed when that map fact is absent', () => {
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'clearance-test', name: 'Clearance', activation: { kind: 'free' },
    target: { kind: 'creature', relation: 'any', count: 1 },
    outcomes: [{ id: 'blocked', when: { kind: 'predicate', predicate: {
      kind: 'upward-clearance', subject: 'target', distanceFeet: 30, blocked: true,
    } }, operations: [{ id: 'marker', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 1 } }] }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  for (const clearance of [undefined, 0, 10, 30, 10000]) {
    const result = resolveDnd5eActivity({ activity, actor, targets: [{ ...target, upwardClearanceFeet: clearance }], rolls: {} })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.proposals.some(proposal => proposal.kind === 'grant-temporary-hit-points')).toBe(clearance != null && clearance < 30)
  }
})

it('validates and carries the residual area surface declaration without changing its target volume', () => {
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'surface', name: 'Surface', activation: { kind: 'action' },
    target: { kind: 'self' }, outcomes: [{ id: 'area', when: { kind: 'always' }, operations: [{
      id: 'terrain', kind: 'create-persistent-area', label: 'Terrain', durationRounds: 1,
      permanent: true, concentration: false, groundOnly: true, movementCostMultiplier: 2,
    }] }], automation: automationCapabilityFromLegacyStatus('full'),
  }
  const resolved = resolveDnd5eActivity({ activity, actor, targets: [actor], rolls: {} })
  expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
  if (resolved.ok) expect(resolved.proposals).toContainEqual(expect.objectContaining({
    kind: 'create-persistent-area', groundOnly: true,
  }))
  for (const value of [false, 'ground', 1]) {
    const malformed = structuredClone(activity)
    Object.assign(malformed.outcomes[0].operations[0], { groundOnly: value })
    expect(validateDnd5eActivityDefinitionV1(malformed).some(error => error.includes('groundOnly'))).toBe(true)
  }
})

it.each([-1, 0, 5, 400_000])('does not silently clamp or discard a dynamic maximum-HP modifier (%s)', multiplier => {
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'maximum-hp', name: 'Maximum HP', activation: { kind: 'free' }, target: { kind: 'self' },
    effects: [{ schemaVersion: 1, id: 'maximum', name: 'Maximum', stacking: 'replace', duration: { kind: 'permanent' },
      modifiers: [{ kind: 'hit-point-maximum', mode: 'add', value: { kind: 'multiply', values: [
        { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } }, { kind: 'constant', value: multiplier },
      ] } }] }],
    outcomes: [{ id: 'effect', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'maximum' }] }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
  const before = structuredClone(actor)
  const result = resolveDnd5eActivity({ activity, actor, targets: [actor], rolls: {} })
  expect(result.ok).toBe(multiplier >= 0 && multiplier <= 5)
  expect(actor).toEqual(before)
  if (result.ok) expect(result.proposals).toContainEqual(expect.objectContaining({ kind: 'apply-effect',
    modifierGroups: [expect.objectContaining({ hitPointMaximumBonus: multiplier * actor.proficiencyBonus })] }))
})

it.each([6, 10, 12, 16, 20])('enforces the same ability-based target limit during execution (%s)', charisma => {
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'ability-targets', name: 'Ability targets', activation: { kind: 'free' },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 },
    scaling: [{ basis: 'ability-modifier', ability: 'cha', baseLevel: 1, adjustments: [{ operationId: 'pool', additionalTargetsPerStep: 1 }] }],
    outcomes: [{ id: 'pool', when: { kind: 'always' }, operations: [{ id: 'pool', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 5 } }] }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
  const owner = { ...actor, abilities: { ...actor.abilities, cha: charisma } }
  const count = Math.max(1, Math.floor((charisma - 10) / 2))
  const targets = Array.from({ length: count + 1 }, (_, i) => ({ ...target, id: `target-${i}` }))
  const input = { activity, actor: owner, rolls: {}, distanceFeetByTargetId: Object.fromEntries(targets.map(t => [t.id, 5])) }
  const valid = resolveDnd5eActivity({ ...input, targets: targets.slice(0, count) })
  expect(valid.ok, JSON.stringify(valid)).toBe(true)
  if (valid.ok) expect(valid.proposals).toHaveLength(count)
  expect(resolveDnd5eActivity({ ...input, targets })).toMatchObject({ ok: false, reason: 'invalid-target' })
  expect(resolveDnd5eActivity({ ...input, actor: { ...owner, abilities: { ...owner.abilities, cha: NaN } }, targets: [targets[0]] }))
    .toMatchObject({ ok: false, reason: 'invalid-actor' })
})

it.each([0, 4, 5, 9, 10, 14, 15, 20])('uses class levels for tiered temporary HP without borrowing other class levels (%s)', fighterLevel => {
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'tiered-pool', name: 'Tiered pool', activation: { kind: 'free' }, target: { kind: 'self' },
    outcomes: [{ id: 'pool', when: { kind: 'always' }, operations: [{ id: 'pool', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 5 } }] }],
    scaling: [{ basis: 'custom-table', classId: 'fighter', table: [{ level: 5, value: 1 }, { level: 10, value: 2 }, { level: 15, value: 3 }], adjustments: [{ operationId: 'pool', flatAmountPerStep: 5 }] }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const owner = { ...actor, level: 20, classLevels: { fighter: fighterLevel, wizard: 20 - fighterLevel } }
  const result = resolveDnd5eActivity({ activity, actor: owner, targets: [owner], rolls: {} })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(result.proposals).toContainEqual(expect.objectContaining({ amount: 5 + (fighterLevel >= 15 ? 3 : fighterLevel >= 10 ? 2 : fighterLevel >= 5 ? 1 : 0) * 5 }))
  const byCharacter = structuredClone(activity)
  delete byCharacter.scaling![0].classId
  const totalLevel = resolveDnd5eActivity({ activity: byCharacter, actor: owner, targets: [owner], rolls: {} })
  expect(totalLevel.ok).toBe(true)
  if (totalLevel.ok) expect(totalLevel.proposals).toContainEqual(expect.objectContaining({ amount: 20 }))
  const noClass = { ...owner, classLevels: {} }
  const missing = resolveDnd5eActivity({ activity, actor: noClass, targets: [noClass], rolls: {} })
  expect(missing.ok).toBe(true)
  if (missing.ok) expect(missing.proposals).toContainEqual(expect.objectContaining({ amount: 5 }))
})

it.each([{ proficiencyBonus: 2, charisma: 10, dc: 10 }, { proficiencyBonus: 3, charisma: 18, dc: 15 }])(
  'uses the Host ability and proficiency sum for a saving throw DC ($dc)', ({ proficiencyBonus, charisma, dc }) => {
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'composed-save-dc', name: 'Synthetic DC',
      activation: { kind: 'action' }, target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 },
      automation: automationCapabilityFromLegacyStatus('full'),
      checks: [{ id: 'save', kind: 'saving-throw', ability: 'wis', rollId: 'save', scope: 'per-target', rollMode: 'host-derived',
        dc: { kind: 'add', values: [{ kind: 'constant', value: 8 },
          { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
          { kind: 'reference', reference: { kind: 'actor-ability-modifier', ability: 'cha' } }] } }],
      outcomes: [{ id: 'failed', when: { kind: 'check', checkId: 'save', result: 'failure' }, operations: [
        { id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 1 }, damageType: 'psychic' },
      ] }],
    }
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    for (const d20 of [dc - 1, dc]) {
      const result = resolveDnd5eActivity({ activity, actor: { ...actor, proficiencyBonus, abilities: { ...abilities, cha: charisma } },
        targets: [{ ...target, savingThrowModifiers: { wis: 0 } }], distanceFeetByTargetId: { target: 5 },
        rolls: { 'save:target': { values: [d20] } }, checkRollModes: { 'save:target': 'normal' } })
      expect(result.ok, JSON.stringify(result)).toBe(true)
      if (!result.ok) throw new Error(result.reason)
      expect(result.checks[0]).toMatchObject({ dc, success: d20 >= dc })
      expect(result.proposals.filter(proposal => proposal.kind === 'deal-damage')).toHaveLength(d20 < dc ? 1 : 0)
    }
  },
)

it('accepts a willing save without dice while an unwilling target still rolls',()=>{
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'willing-save',name:'Willing save',
    activation:{kind:'action'},target:{kind:'creature',relation:'any',count:1},
    checks:[{id:'save',kind:'saving-throw',rollId:'save',ability:'wis',scope:'per-target',
      dc:{kind:'constant',value:15},rollMode:'host-derived',allowWillingFailure:true}],
    outcomes:[{id:'move',when:{kind:'check',checkId:'save',result:'failure'},operations:[
      {id:'move',kind:'move',target:'target',mode:'teleport',distanceFeet:{kind:'constant',value:30}},
    ]}],automation:automationCapabilityFromLegacyStatus('full')}
  const input={activity,actor,targets:[target],rolls:{}}
  const willing=resolveDnd5eActivity({...input,willingTargetIds:[target.id]})
  expect(willing.ok,JSON.stringify(willing)).toBe(true)
  if(willing.ok)expect(willing.checks[0]).toMatchObject({success:false,d20:0,criticalFailure:false})
  expect(resolveDnd5eActivity(input).ok).toBe(false)
  const rolled=resolveDnd5eActivity({...input,rolls:{'save:target':{values:[20]}},checkRollModes:{'save:target':'normal'}})
  expect(rolled.ok).toBe(true)
  if(rolled.ok)expect(rolled.checks[0]).toMatchObject({success:true,d20:20})
})

it('requires explicit consent for every willing-only creature, including self and allies',()=>{
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'consent-example',name:'Consent',activation:{kind:'action'},
    target:{kind:'creature',relation:'any',count:3,includeSelf:true,requiresWilling:true},
    outcomes:[{id:'damage',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',amount:{kind:'constant',value:1},damageType:'psychic'}]}],
    automation:automationCapabilityFromLegacyStatus('full')}
  const ally={...target,id:'ally',controller:'players' as const}
  const input={activity,actor,targets:[actor,ally,target],rolls:{}}
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  for(const willingTargetIds of [undefined,[],['actor'],['actor','ally'],['actor','ally','unselected']]){
    expect(resolveDnd5eActivity({...input,willingTargetIds})).toMatchObject({ok:false,reason:'invalid-target',details:['explicit target willingness is required']})
  }
  const accepted=resolveDnd5eActivity({...input,willingTargetIds:['actor','ally','target']})
  expect(accepted.ok).toBe(true)
  if(accepted.ok)expect(accepted.proposals.filter(proposal=>proposal.kind==='deal-damage')).toHaveLength(3)
  expect(validateDnd5eActivityDefinitionV1({...activity,target:{...activity.target,requiresWilling:'yes'} as any})).toContain('activity.target.requiresWilling is invalid')
})

it('resolves every eligible area occupant when no rule target limit is declared',()=>{
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'all-in-area',name:'All in area',activation:{kind:'action'},
    target:{kind:'area',relation:'enemy',origin:'point',shape:'sphere',radiusFeet:20,placeRangeFeet:120},
    outcomes:[{id:'damage',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',amount:{kind:'constant',value:1},damageType:'psychic'}]}],
    automation:automationCapabilityFromLegacyStatus('full')}
  const targets=Array.from({length:300},(_,index)=>({...target,id:`target-${index}`}))
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const input={activity,actor,targets,areaPlacement:{x:5,y:5},areaPlacementDistanceFeet:20,rolls:{}}
  const resolved=resolveDnd5eActivity(input)
  expect(resolved.ok,JSON.stringify(resolved)).toBe(true)
  if(resolved.ok)expect(resolved.proposals.filter(proposal=>proposal.kind==='deal-damage')).toHaveLength(300)
  if(activity.target.kind!=='area')throw Error('expected area')
  expect(resolveDnd5eActivity({...input,activity:{...activity,target:{...activity.target,maximumTargets:256}}}).ok).toBe(false)
})

it('scales persistent trigger dice at character tiers and spell slot levels before handoff', () => {
  const base: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'scaled-hazard', name: 'Scaled hazard', activation: { kind: 'action' },
    target: { kind: 'area', relation: 'any', origin: 'point', shape: 'cube', lengthFeet: 5, widthFeet: 5, heightFeet: 5, placeRangeFeet: 60, maximumTargets: 8 },
    outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'hazard', kind: 'create-persistent-area', label: 'Hazard', durationRounds: 10, concentration: true,
      triggers: [{ id: 'end', label: 'End turn', timing: 'turn-end', oncePerTurn: true, damage: { count: 1, sides: 8, type: 'fire' } }] }] }],
    automation: automationCapabilityFromLegacyStatus('full'),
    scaling: [{ basis: 'custom-table', table: [{ level: 1, value: 0 }, { level: 5, value: 1 }, { level: 11, value: 2 }, { level: 17, value: 3 }], adjustments: [{ operationId: 'hazard', diceCountPerStep: 1 }] }],
  }
  for (const [level, count] of [[1, 1], [4, 1], [5, 2], [10, 2], [11, 3], [16, 3], [17, 4], [20, 4]]) {
    const result = resolveDnd5eActivity({ activity: base, actor: { ...actor, level }, targets: [target], areaPlacement: { x: 5, y: 5 }, areaPlacementDistanceFeet: 20, rolls: {} })
    expect(result, JSON.stringify(result)).toMatchObject({ ok: true, proposals: [expect.objectContaining({ kind: 'create-persistent-area', triggers: [expect.objectContaining({ damage: expect.objectContaining({ count, sides: 8, type: 'fire' }) })] })] })
  }
  const upcast = { ...base, scaling: [{ basis: 'slot-level' as const, baseLevel: 5, adjustments: [{ operationId: 'hazard', diceCountPerStep: 1 }] }] }
  const result = resolveDnd5eActivity({ activity: upcast, actor, targets: [target], castLevel: 7, areaPlacement: { x: 5, y: 5 }, areaPlacementDistanceFeet: 20, rolls: {} })
  expect(result).toMatchObject({ ok: true, proposals: [expect.objectContaining({ triggers: [expect.objectContaining({ damage: expect.objectContaining({ count: 3, sides: 8, type: 'fire' }) })] })] })
})

function saveActivity(): Dnd5eActivityDefinitionV1 {
  return {
    schemaVersion: 1,
    id: 'thunder-wave',
    name: '雷鸣波',
    activation: { kind: 'action' },
    target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 },
    checks: [{
      id: 'save', kind: 'saving-throw', rollId: 'save', ability: 'dex',
      dc: { kind: 'constant', value: 14 }, rollMode: 'normal', scope: 'per-target',
    }],
    outcomes: [
      {
        id: 'failure', when: { kind: 'check', checkId: 'save', result: 'failure' },
        operations: [{
          id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'damage', count: 2, sides: 6 },
          damageType: 'thunder', magical: true,
        }],
      },
      {
        id: 'success', when: { kind: 'check', checkId: 'save', result: 'success' },
        operations: [{
          id: 'half-damage', kind: 'damage', target: 'target',
          amount: { kind: 'floor', value: { kind: 'multiply', values: [
            { kind: 'dice', rollId: 'damage', count: 2, sides: 6 },
            { kind: 'constant', value: 0.5 },
          ] } },
          damageType: 'thunder', magical: true,
        }],
      },
    ],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

describe('generic D&D 5e Activity executor', () => {
  it('uses inclusive ability-score bounds for dice preparation and effect resolution', () => {
    const activity = saveActivity()
    activity.target = {kind:'creature',relation:'any',count:4,minimumAbilityScores:{int:3},maximumAbilityScores:{int:20}}
    activity.consumption = [{kind:'spell-slot',minimumLevel:1,level:'selected',amount:1,consumeOn:'resolve'}]
    const targets = [2,3,20,21].map(int=>({...target,id:`int-${int}`,abilities:{...abilities,int}}))
    const dice = dnd5eActivityPerTargetRollDeclarationsV1({activity,actor:{id:actor.id},targets:targets.map(({id,abilities})=>({id,abilities})),
      declarations:[{id:'save',count:1,sides:20,label:'Save'}],hostSavingThrowMode:()=> 'normal',hostAttackRollMode:()=> 'normal'})
    expect(dice.map(d=>d.id)).toEqual(['save:int-3','save:int-20'])
    const result = resolveDnd5eActivity({activity,actor,targets,castLevel:1,
      rolls:{'save:int-3':{values:[1]},'save:int-20':{values:[1]},damage:{values:[3,4]}}})
    expect(result.ok,JSON.stringify(result)).toBe(true)
    if(!result.ok)throw Error('score filter rejected')
    expect(result.proposals.filter(p=>p.kind==='deal-damage').map(p=>p.targetId)).toEqual(['int-3','int-20'])
    expect(result.checks).toHaveLength(2)
    const immune = resolveDnd5eActivity({activity,actor,targets:[targets[0]],castLevel:1,rolls:{}})
    expect(immune).toMatchObject({ok:true,checks:[],proposals:[],consumptions:[expect.objectContaining({kind:'spell-slot'})]})
    const unknown={...target,abilities:{...abilities,int:NaN}}
    expect(()=>dnd5eActivityPerTargetRollDeclarationsV1({activity,actor:{id:actor.id},targets:[{id:unknown.id,abilities:unknown.abilities}],declarations:[],hostSavingThrowMode:()=> 'normal',hostAttackRollMode:()=> 'normal'})).toThrow('activity-target-ability-missing:int')
    expect(resolveDnd5eActivity({activity,actor,targets:[unknown],rolls:{}})).toMatchObject({ok:false})
  })

  it.each([{}, {int:31}, {int:-1}, {int:2.5}, {luck:3}, []])('rejects malformed ability-score target bounds %j', bounds => {
    const activity=saveActivity()
    activity.target={kind:'creature',relation:'any',count:1,minimumAbilityScores:bounds as never}
    expect(validateDnd5eActivityDefinitionV1(activity)).toContain('activity.target.minimumAbilityScores is invalid')
    activity.target={kind:'creature',relation:'any',count:1,minimumAbilityScores:{int:10},maximumAbilityScores:{int:2}}
    expect(validateDnd5eActivityDefinitionV1(activity)).toContain('activity.target ability score bounds for int are inverted')
  })
  it('preserves a chosen cone orientation through validation and resolution', () => {
    const activity = saveActivity()
    activity.target = { kind: 'area', relation: 'any', origin: 'self', shape: 'cone', lengthFeet: 15, maximumTargets: 10, rotatable: true }
    const result = resolveDnd5eActivity({ activity, actor, targets: [target],
      rolls: { 'save:target': { values: [1] }, damage: { values: [2, 3] } },
      areaPlacement: { x: 0, y: 0, angleDegrees: 135 },
    })
    expect(result).toMatchObject({ ok: true, areaInstance: { shape: 'cone', angleDegrees: 135 },
      proposals: [expect.objectContaining({ kind: 'deal-damage', amount: 5 })] })
  })
  it.each([30, 31, undefined, Number.NaN, -1])('checks every target pair before applying effects: %s', (distance) => {
    const activity = saveActivity()
    activity.target = { kind: 'creature', relation: 'any', count: 3, maximumTargetSeparationFeet: 30 }
    activity.checks = []
    activity.outcomes = [{ id: 'resolve', when: { kind: 'always' }, operations: [{
      id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 1 }, damageType: 'force',
    }] }]
    const result = resolveDnd5eActivity({ activity, actor,
      targets: [target, { ...target, id: 'second' }, { ...target, id: 'third' }], rolls: {},
      distanceFeetBetweenTargets: { target: { second: 5, third: 5 },
        second: distance == null ? {} : { third: distance } },
    })
    expect(result.ok).toBe(distance === 30)
    if (!result.ok) expect(result.reason).toBe('invalid-target')
  })
  it('returns useful import errors for a subclass ability misplaced in activities', () => {
    const malformed = { id: 'misplaced', name: 'Example', trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, automation: 'manual' }
    expect(validateDnd5eActivityDefinitionV1(malformed as unknown as Dnd5eActivityDefinitionV1)).toEqual([
      'activity.activation must be an object', 'activity.target must be an object', 'activity.automation must be an object',
    ])
  })
  it.each(['construct', '构装', '构装体', '构装生物'])('settles eligible creatures without asking excluded %s creatures for saves or applying damage', creatureType => {
    const activity = saveActivity()
    activity.target = { kind: 'creature', relation: 'any', count: 3, excludedCreatureTypes: ['construct', 'undead'] }
    activity.legacySource = { kind: 'spell', id: 'test-selective-damage' }
    const result = resolveDnd5eActivity({
      activity, actor,
      targets: [{ ...target, id: 'construct', creatureType }, { ...target, creatureType: 'humanoid' }, { ...target, id: 'undead', creatureType: 'undead' }],
      rolls: { 'save:target': { values: [1] }, damage: { values: [3, 4] } },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.checks).toHaveLength(1)
    expect(result.proposals.filter(p => p.kind === 'deal-damage')).toEqual([expect.objectContaining({ targetId: 'target', amount: 7 })])
    const dice = dnd5eActivityPerTargetRollDeclarationsV1({
      activity, actor: { id: actor.id }, targets: [{ id: 'construct', creatureType }, { id: target.id, creatureType: 'humanoid' }],
      declarations: [{ id: 'save', count: 1, sides: 20, label: 'Save' }],
      hostSavingThrowMode: () => 'normal', hostAttackRollMode: () => 'normal',
    })
    expect(dice).toHaveLength(1)
    expect(dice[0].id).toBe('save:target')
    activity.target.excludedCreatureTypes = []
    expect(validateDnd5eActivityDefinitionV1(activity)).toContain('activity.target.excludedCreatureTypes is invalid')
  })
  it.each(['creature', 'area'] as const)('omits immune %s targets from dice and effects', kind => {
    const activity = saveActivity()
    activity.target = kind === 'creature'
      ? { kind, relation: 'any', count: 2, excludedConditionImmunities: ['charmed'] }
      : { kind, relation: 'any', origin: 'self', shape: 'circle', radiusFeet: 30, excludedConditionImmunities: ['charmed'] }
    const targets = [{ ...target, id: 'immune', conditionImmunities: ['charmed'] as const }, { ...target, conditionImmunities: [] }]
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const dice = dnd5eActivityPerTargetRollDeclarationsV1({ activity, actor: { id: actor.id }, targets: targets.map(({ id, conditionImmunities }) => ({ id, conditionImmunities })),
      declarations: [{ id: 'save', count: 1, sides: 20, label: 'Save' }],
      hostSavingThrowMode: () => 'normal', hostAttackRollMode: () => 'normal' })
    expect(dice.map(d => d.id)).toEqual(['save:target'])
    const result = resolveDnd5eActivity({ activity, actor, targets,
      areaPlacement: kind === 'area' ? { x: 0, y: 0 } : undefined,
      rolls: { 'save:target': { values: [1] }, damage: { values: [3, 4] } } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.checks).toHaveLength(1)
    expect(result.proposals.filter(p => p.kind === 'deal-damage')).toEqual([expect.objectContaining({ targetId: 'target', amount: 7 })])
    expect(() => dnd5eActivityPerTargetRollDeclarationsV1({ activity, actor: { id: actor.id }, targets: [{ id: target.id }],
      declarations: [], hostSavingThrowMode: () => 'normal', hostAttackRollMode: () => 'normal' }))
      .toThrow('activity-target-condition-immunities-missing')
    activity.target.excludedConditionImmunities = ['charmed', 'charmed']
    expect(validateDnd5eActivityDefinitionV1(activity)).toContain('activity.target.excludedConditionImmunities is invalid')
  })
  it('preserves negative exhaustion adjustments for restorative Activities', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1,
      id: 'greater-restoration-exhaustion',
      name: 'Greater Restoration',
      activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 5 },
      checks: [],
      outcomes: [{
        id: 'resolve',
        when: { kind: 'always' },
        operations: [{
          id: 'reduce-exhaustion',
          kind: 'adjust-exhaustion',
          target: 'target',
          amount: { kind: 'constant', value: -1 },
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }

    const resolved = resolveDnd5eActivity({
      activity,
      actor,
      targets: [target],
      rolls: {},
      distanceFeetByTargetId: { target: 5 },
    })

    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.proposals).toContainEqual(expect.objectContaining({
      kind: 'adjust-exhaustion',
      operationId: 'reduce-exhaustion',
      targetId: 'target',
      amount: -1,
    }))
  })

  it('uses the authoritative skill modifier for a skill check', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1,
      id: 'investigate-illusion',
      name: 'Investigate illusion',
      activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'any', count: 1 },
      checks: [{
        id: 'investigation', kind: 'skill-check', rollId: 'investigation-d20',
        ability: 'int', skill: 'investigation', dc: { kind: 'constant', value: 15 },
        rollMode: 'normal', scope: 'per-target',
      }],
      outcomes: [{ id: 'done', when: { kind: 'always' }, operations: [{
        id: 'done', kind: 'mechanic', target: 'actor', handlerId: 'core.resolve-only',
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const resolved = resolveDnd5eActivity({
      activity,
      actor: { ...actor, skillCheckModifiers: { investigation: 7 } },
      targets: [target],
      rolls: { 'investigation-d20:target': { values: [10] } },
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.checks).toContainEqual(expect.objectContaining({
      checkId: 'investigation', modifier: 7, total: 17, dc: 15, success: true,
    }))
  })

  it('rolls and applies Bestow Curse spell damage only for the source caster and cursed target', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...saveActivity(),
      legacySource: { kind: 'spell', id: 'thunderwave' },
    }
    const cursedTarget: Dnd5eActivityActorSnapshot = {
      ...target,
      activeEffectDefinitionIds: [{
        definitionId: 'bestow-curse-source-bonus-damage',
        sourceActorId: actor.id,
      }],
    }
    expect(dnd5eBestowCurseSpellDamageRollDeclarationsV1(
      activity,
      actor,
      [cursedTarget, { ...target, id: 'other-target' }],
    )).toEqual([expect.objectContaining({
      id: 'bestow-curse-source-bonus-damage:target', count: 1, sides: 8,
    })])

    const resolved = resolveDnd5eActivity({
      activity,
      actor,
      targets: [cursedTarget],
      rolls: {
        'save:target': { values: [1] },
        damage: { values: [3, 4] },
        'bestow-curse-source-bonus-damage:target': { values: [6] },
      },
      distanceFeetByTargetId: { target: 15 },
    })
    expect(resolved.ok, resolved.ok ? undefined : resolved.details.join('; ')).toBe(true)
    if (!resolved.ok) return
    expect(resolved.proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'deal-damage', operationId: 'damage', damageType: 'thunder', amount: 7,
      }),
      expect.objectContaining({
        kind: 'deal-damage',
        operationId: 'damage:bestow-curse-source-bonus-damage',
        damageType: 'necrotic',
        magical: true,
        amount: 6,
      }),
    ]))
  })

  it('blocks spell Activities from an antimagic actor and suppresses their effects on antimagic targets', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...saveActivity(),
      legacySource: { kind: 'spell', id: 'thunderwave' },
    }
    const blockedCaster = resolveDnd5eActivity({
      activity, actor: { ...actor, magicSuppressed: true }, targets: [target],
      rolls: {}, distanceFeetByTargetId: { target: 15 },
    })
    expect(blockedCaster).toMatchObject({ ok: false, reason: 'requirement-failed' })

    const suppressedTarget = resolveDnd5eActivity({
      activity, actor, targets: [{ ...target, magicSuppressed: true }],
      rolls: {}, distanceFeetByTargetId: { target: 15 },
    })
    expect(suppressedTarget).toMatchObject({
      ok: true,
      checks: [],
      proposals: [],
    })

    const barrierTarget = resolveDnd5eActivity({
      activity, actor,
      targets: [{ ...target, spellSuppressionAreas: [{ areaId: 'globe', maximumSpellLevel: 5 }] }],
      rolls: {}, distanceFeetByTargetId: { target: 15 },
    })
    expect(barrierTarget).toMatchObject({ ok: true, checks: [], proposals: [] })

    const sharedBarrier = resolveDnd5eActivity({
      activity,
      actor: { ...actor, spellSuppressionAreas: [{ areaId: 'globe', maximumSpellLevel: 5 }] },
      targets: [{ ...target, spellSuppressionAreas: [{ areaId: 'globe', maximumSpellLevel: 5 }] }],
      rolls: { 'save:target': { values: [1] }, damage: { values: [3, 4] } },
      distanceFeetByTargetId: { target: 15 },
    })
    expect(sharedBarrier.ok, sharedBarrier.ok ? undefined : sharedBarrier.details.join('; ')).toBe(true)
    if (sharedBarrier.ok) expect(sharedBarrier.proposals).toContainEqual(expect.objectContaining({ kind: 'deal-damage' }))
  })

  it('skips Divine Word checks and outcomes for selected targets that cannot hear the source', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...saveActivity(),
      id: 'divine-word',
      target: { kind: 'creature', relation: 'any', count: 2, rangeFeet: 30 },
      legacySource: { kind: 'spell', id: 'divine-word' },
    }
    const resolved = resolveDnd5eActivity({
      activity,
      actor,
      targets: [
        { ...target, id: 'audible', canHearActivitySource: true },
        { ...target, id: 'deafened', canHearActivitySource: false },
      ],
      rolls: {
        'save:audible': { values: [1] },
        damage: { values: [3, 4] },
      },
      distanceFeetByTargetId: { audible: 15, deafened: 15 },
    })

    expect(resolved.ok, resolved.ok ? undefined : resolved.details.join('; ')).toBe(true)
    if (!resolved.ok) return
    expect(resolved.checks).toEqual([expect.objectContaining({ targetId: 'audible' })])
    expect(resolved.proposals).toEqual([
      expect.objectContaining({ kind: 'deal-damage', targetId: 'audible' }),
    ])
  })

  it('consumes a Flesh to Stone cast but skips checks and effects for a non-flesh target', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...saveActivity(),
      id: 'flesh-to-stone',
      name: '石化术',
      legacySource: { kind: 'spell', id: 'flesh-to-stone' },
      consumption: [
        { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' },
        { kind: 'spell-slot', minimumLevel: 6, level: 'selected', amount: 1, consumeOn: 'resolve' },
      ],
    }
    const resolved = resolveDnd5eActivity({
      activity,
      actor,
      targets: [{
        ...target,
        statBlockId: 'srd-5.1:skeleton',
        creatureType: '亡灵',
      }],
      castLevel: 6,
      rolls: {},
      distanceFeetByTargetId: { target: 15 },
    })

    expect(resolved).toMatchObject({
      ok: true,
      checks: [],
      proposals: [],
      consumptions: [
        { kind: 'action-economy', economy: 'action', amount: 1 },
        { kind: 'spell-slot', level: 'selected', amount: 1 },
      ],
    })
  })

  it('enforces the Host-derived can-hear-source predicate', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'audible-test', name: 'Audible test',
      activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 60 },
      requirements: [{ kind: 'can-hear-source' }],
      outcomes: [{ id: 'resolved', when: { kind: 'always' }, operations: [{
        id: 'mark', kind: 'apply-standard-condition', target: 'target',
        condition: 'charmed', duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' },
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const audible = resolveDnd5eActivity({
      activity, actor, targets: [{ ...target, canHearActivitySource: true }],
      rolls: {}, distanceFeetByTargetId: { target: 30 },
    })
    expect(audible.ok).toBe(true)
    const blocked = resolveDnd5eActivity({
      activity, actor, targets: [{ ...target, canHearActivitySource: false }],
      rolls: {}, distanceFeetByTargetId: { target: 30 },
    })
    expect(blocked).toMatchObject({ ok: false, reason: 'requirement-failed' })
  })

  it('resolves a schema-driven on-damage repeat save into the ActiveEffect proposal', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'domination-test', name: 'Domination',
      activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 60 },
      effects: [{
        schemaVersion: 1, id: 'dominated', name: 'Dominated',
        duration: { kind: 'concentration', maximumRounds: 10 },
        conditions: ['charmed'],
        repeatSaveOnDamage: {
          ability: 'wis', dc: { kind: 'constant', value: 15 },
          mode: 'normal', sourceFilter: 'any',
        },
        stacking: 'replace',
      }],
      outcomes: [{ id: 'effect', when: { kind: 'always' }, operations: [{
        id: 'apply', kind: 'apply-effect', target: 'target', effectId: 'dominated',
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const resolved = resolveDnd5eActivity({
      activity, actor, targets: [target], rolls: {}, distanceFeetByTargetId: { target: 30 },
    })
    expect(resolved.ok, resolved.ok ? undefined : resolved.details.join('; ')).toBe(true)
    expect(resolved).toMatchObject({
      ok: true,
      proposals: [expect.objectContaining({
        kind: 'apply-effect', targetId: 'target', conditions: ['charmed'],
        repeatSaveOnDamage: {
          ability: 'wis', dc: 15,
          onDamage: { mode: 'normal', sourceFilter: 'any' }, onSuccess: 'remove',
        },
      })],
    })
  })

  it('lets condition immunity automatically pass a save without reporting a natural-1 failure', () => {
    const activity = saveActivity()
    activity.checks = [{
      ...activity.checks![0] as Extract<NonNullable<Dnd5eActivityDefinitionV1['checks']>[number], { kind: 'saving-throw' }>,
      automaticSuccessIfConditionImmune: 'charmed',
      rollModeIfOpposed: 'advantage',
    }]
    const immune = resolveDnd5eActivity({
      activity,
      actor,
      targets: [{ ...target, conditionImmunities: ['charmed'] }],
      rolls: { 'save:target': { values: [1, 1] }, damage: { values: [4, 4] } },
      distanceFeetByTargetId: { target: 10 },
    })
    expect(immune).toMatchObject({
      ok: true,
      checks: [{
        success: true,
        automaticOutcome: 'condition-immunity-success',
        criticalFailure: false,
      }],
    })
  })

  it('marks an allied unresisted save as automatic instead of implying the d20 beat the DC', () => {
    const activity = saveActivity()
    if (activity.target.kind !== 'creature') throw new Error('save fixture must target a creature')
    activity.target = { ...activity.target, relation: 'any' }
    activity.checks = [{
      ...activity.checks![0] as Extract<NonNullable<Dnd5eActivityDefinitionV1['checks']>[number], { kind: 'saving-throw' }>,
      automaticFailureIfAllied: true,
    }]
    const unresisted = resolveDnd5eActivity({
      activity,
      actor,
      targets: [{ ...target, controller: actor.controller }],
      rolls: { 'save:target': { values: [20] }, damage: { values: [4, 4] } },
      distanceFeetByTargetId: { target: 10 },
    })
    expect(unresisted).toMatchObject({
      ok: true,
      checks: [{
        success: false,
        automaticOutcome: 'allied-unresisted-failure',
        criticalSuccess: false,
      }],
    })
  })
  it('maximizes only healing dice when the target snapshot has the audited capability', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'healing-test', name: 'Healing test', activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'ally', count: 1, rangeFeet: 30 },
      outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{
        id: 'healing', kind: 'healing', target: 'target',
        amount: { kind: 'add', values: [
          { kind: 'dice', rollId: 'healing-dice', count: 2, sides: 8 },
          { kind: 'constant', value: 3 },
        ] },
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const result = resolveDnd5eActivity({
      activity,
      actor,
      targets: [{ ...target, controller: actor.controller, maximizeHealingDice: true }],
      rolls: { 'healing-dice': { values: [1, 2] } },
      distanceFeetByTargetId: { target: 10 },
    })
    expect(result).toMatchObject({
      ok: true,
      proposals: [{
        kind: 'heal', operationId: 'healing', targetId: 'target', amount: 19,
        diceAudit: [{ rollId: 'healing-dice', count: 2, sides: 8, values: [8, 8] }],
        formulaAdjustment: 3,
      }],
    })
  })

  it('evaluates equipment, free-hand, and spellcasting predicates from the Host actor snapshot', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'qualified-feature', name: 'Qualified feature', activation: { kind: 'free' },
      target: { kind: 'self' },
      requirements: [
        { kind: 'armor-equipped', subject: 'actor', categories: ['medium'], proficient: true },
        { kind: 'armor-proficiency', subject: 'actor', categories: ['medium'], match: 'all' },
        { kind: 'held-item', subject: 'actor', slot: 'main-hand', roles: ['weapon'], weaponModes: ['melee'], proficient: true },
        { kind: 'free-hands', subject: 'actor', minimum: 1 },
        { kind: 'spellcasting-capability', subject: 'actor', capable: true, classIds: ['wizard'] },
      ],
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
        id: 'temp', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 1 },
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const qualified: Dnd5eActivityActorSnapshot = {
      ...actor,
      equipment: {
        armorCategory: 'medium', armorProficient: true, armorProficiencies: ['light', 'medium'], freeHands: 1,
        mainHand: { itemId: 'longsword', roles: ['weapon'], weaponMode: 'melee', proficient: true },
      },
      spellcasting: { capable: true, classIds: ['wizard'] },
    }
    expect(resolveDnd5eActivity({ activity, actor: qualified, targets: [qualified], rolls: {} }))
      .toMatchObject({ ok: true })
    expect(resolveDnd5eActivity({
      activity, actor: { ...qualified, equipment: { ...qualified.equipment!, freeHands: 0 } },
      targets: [qualified], rolls: {},
    })).toMatchObject({ ok: false, reason: 'requirement-failed' })
  })

  it('projects an owned-companion command as a closed Host capability', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'command-companion', name: 'Command Companion',
      activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'ally', count: 1, rangeFeet: 60 },
      choices: [{
        id: 'command', label: 'Command', defaultOptionId: 'attack',
        options: [{ id: 'attack', label: 'Attack' }, { id: 'dodge', label: 'Dodge' }],
      }],
      outcomes: [{
        id: 'attack', when: { kind: 'choice', choiceId: 'command', optionId: 'attack' },
        operations: [{ id: 'issue', kind: 'command-owned-companion', target: 'target', command: 'attack' }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const result = resolveDnd5eActivity({
      activity, actor, targets: [{ ...target, controller: actor.controller }],
      rolls: {}, choices: { command: 'attack' }, distanceFeetByTargetId: { target: 20 },
    })
    expect(result).toMatchObject({
      ok: true,
      proposals: [{ kind: 'command-owned-companion', targetId: 'target', command: 'attack' }],
    })
  })

  it('checks temporary and permanent companion ownership independently of lifetime', () => {
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'owned', name: 'Owned',
      activation: { kind: 'free' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 },
      requirements: [{ kind: 'owned-companion', subject: 'target' }],
      outcomes: [{ id: 'command', when: { kind: 'always' }, operations: [{ id: 'command', kind: 'command-owned-companion', target: 'target', command: 'attack' }] }],
      automation: automationCapabilityFromLegacyStatus('full') }
    const check = (owner: string | undefined, persistent: boolean, bondKey?: string) => resolveDnd5eActivity({
      activity, actor, targets: [{ ...target, summonedSourceCombatantId: owner,
        summonedPersistent: persistent, summonedBondKey: bondKey }], rolls: {}, distanceFeetByTargetId: { target: 5 },
    })
    for (const persistent of [false, true]) {
      expect(check(actor.id, persistent).ok).toBe(true)
      expect(check('other', persistent)).toMatchObject({ ok: false, reason: 'requirement-failed' })
      expect(check(undefined, persistent)).toMatchObject({ ok: false, reason: 'requirement-failed' })
    }
    activity.requirements = [{ kind: 'owned-companion', subject: 'target', bondKey: 'steed' }]
    expect(check(actor.id, true, 'steed').ok).toBe(true)
    expect(check(actor.id, true, 'other').ok).toBe(false)
  })

  it('qualifies companions by exact source namespace before resolving benefits', () => {
    const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'benefit', name: 'Benefit',
      activation: { kind: 'free' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 },
      requirements: [{ kind: 'owned-companion', subject: 'target', source: { packageId: 'test.companions', activityId: 'summon' } }],
      outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'target', amount: { kind: 'constant', value: 1 } }] }],
      automation: automationCapabilityFromLegacyStatus('full') }
    const companion = { ...target, summonedSourceCombatantId: actor.id, summonedSourcePackageId: 'test.companions', summonedSourceActivityId: 'summon' }
    const run = (patch: Partial<Dnd5eActivityActorSnapshot>) => resolveDnd5eActivity({ activity, actor,
      targets: [{ ...companion, ...patch }], rolls: {}, distanceFeetByTargetId: { target: 5 } })
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(run({}).ok).toBe(true)
    for (const patch of [{ summonedSourceCombatantId: 'other' }, { summonedSourcePackageId: 'another.module' },
      { summonedSourcePackageId: undefined }, { summonedSourceActivityId: 'another' }, { summonedSourceActivityId: undefined }]) {
      expect(run(patch)).toMatchObject({ ok: false, reason: 'requirement-failed' })
    }
    for (const source of ['bad', [], {}, { packageId: 'test.companions' }, { packageId: 'bad id', activityId: 'summon' }]) {
      const invalid = { ...activity, requirements: [{ kind: 'owned-companion', subject: 'target', source }] }
      expect(validateDnd5eActivityDefinitionV1(invalid as unknown as Dnd5eActivityDefinitionV1).some(error => error.includes('.source is invalid'))).toBe(true)
    }
    activity.requirements = [{ kind: 'owned-companion', subject: 'target', source: { packageId: 'srd-5.1', activityId: 'summon' } }]
    expect(run({ summonedSourcePackageId: undefined }).ok).toBe(true)
    expect(run({}).ok).toBe(false)
  })

  it('derives a reusable summon combat profile from the Host actor snapshot', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'companion', name: 'Companion', activation: { kind: 'action' },
      target: { kind: 'area', relation: 'ally', origin: 'point', shape: 'circle', radiusFeet: 5, maximumTargets: 1 },
      outcomes: [{ id: 'summon', when: { kind: 'always' }, operations: [{
        id: 'wolf', kind: 'summon', monsterId: 'srd-5.1:wolf', count: { kind: 'constant', value: 1 }, placementRangeFeet: 60, requiresVisiblePlacement: true,
        timing: 'immediate', durationRounds: 100, concentration: false, side: 'ally', persistent: true,
        minimumMaximumHitPoints: { kind: 'multiply', values: [
          { kind: 'reference', reference: { kind: 'actor-class-level', classId: 'ranger' } },
          { kind: 'constant', value: 4 },
        ] },
        armorClassBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        weaponAttackBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        weaponDamageBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        savingThrowBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        proficientSkillCheckBonus: { kind: 'reference', reference: { kind: 'actor-proficiency-bonus' } },
        weaponAttacksMagical: true,
        attacksPerAction: { kind: 'constant', value: 2 },
        cannotAttack: true,
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    for (const patch of [{ placementRangeFeet: -1 }, { placementRangeFeet: 1.5 }, { placementRangeFeet: 100001 }, { requiresVisiblePlacement: 'yes' }]) {
      const invalid = structuredClone(activity)
      Object.assign(invalid.outcomes[0].operations[0], patch)
      expect(validateDnd5eActivityDefinitionV1(invalid).some(error => /placementRangeFeet|requiresVisiblePlacement/.test(error))).toBe(true)
    }
    const result = resolveDnd5eActivity({
      activity,
      actor: { ...actor, classLevels: { ranger: 11 } },
      targets: [], rolls: {},
      areaPlacement: { x: 5, y: 5, angleDegrees: 0 },
      areaPlacementDistanceFeet: 10,
    })
    expect(result).toMatchObject({
      ok: true,
      proposals: [{
        kind: 'summon', minimumMaximumHitPoints: 44, placementRangeFeet: 60, requiresVisiblePlacement: true,
        armorClassBonus: 3, weaponAttackBonus: 3, weaponDamageBonus: 3,
        savingThrowBonus: 3, proficientSkillCheckBonus: 3,
        weaponAttacksMagical: true, attacksPerAction: 2,
        cannotAttack: true,
      }],
    })
  })

  it('resolves a failed save into capability proposals without mutating snapshots', () => {
    const result = resolveDnd5eActivity({
      activity: saveActivity(), actor, targets: [target], distanceFeetByTargetId: { target: 20 },
      rolls: { 'save:target': { values: [10] }, damage: { values: [4, 5] } },
    })
    expect(result, JSON.stringify(result)).toMatchObject({
      ok: true,
      status: 'resolved',
      proposals: [{ kind: 'deal-damage', targetId: 'target', amount: 9, damageType: 'thunder' }],
    })
    expect(target.currentHp).toBe(20)
  })

  it('uses the success outcome and a shared authoritative damage roll', () => {
    const result = resolveDnd5eActivity({
      activity: saveActivity(), actor, targets: [target], distanceFeetByTargetId: { target: 20 },
      rolls: { 'save:target': { values: [15] }, damage: { values: [4, 5] } },
    })
    expect(result).toMatchObject({ ok: true, proposals: [{ amount: 4 }] })
  })

  it('rejects invalid targets before reading any dice', () => {
    expect(resolveDnd5eActivity({
      activity: saveActivity(), actor, targets: [{ ...target, controller: 'players' }],
      distanceFeetByTargetId: { target: 20 }, rolls: {},
    })).toEqual({ ok: false, reason: 'invalid-target', details: ['target relation is invalid'] })
  })

  it('applies custom-table cantrip scaling to authoritative dice declarations', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...saveActivity(),
      id: 'scaled-bolt',
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 120 },
      checks: undefined,
      outcomes: [{
        id: 'damage', when: { kind: 'always' }, operations: [{
          id: 'bolt-damage', kind: 'damage', target: 'target',
          amount: { kind: 'dice', rollId: 'bolt-damage', count: 1, sides: 10 },
          damageType: 'fire', magical: true,
        }],
      }],
      scaling: [{
        basis: 'custom-table',
        table: [{ level: 1, value: 0 }, { level: 5, value: 1 }, { level: 11, value: 2 }, { level: 17, value: 3 }],
        adjustments: [{ operationId: 'bolt-damage', diceCountPerStep: 1 }],
      }],
    }
    const result = resolveDnd5eActivity({
      activity, actor: { ...actor, level: 5 }, targets: [target],
      distanceFeetByTargetId: { target: 30 }, rolls: { 'bolt-damage': { values: [6, 7] } },
    })
    expect(result).toMatchObject({ ok: true, proposals: [{ kind: 'deal-damage', amount: 13 }] })
  })

  it('applies slot scaling, extra projectiles, and rebuilds the authoritative area instance', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'scaled-zone', name: 'Scaled Zone', activation: { kind: 'action' },
      target: { kind: 'area', relation: 'enemy', origin: 'point', shape: 'rect', lengthFeet: 20, widthFeet: 10, heightFeet: 5, placeRangeFeet: 60, maximumTargets: 1, rotatable: true },
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [
        { id: 'zone-damage', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'zone-damage', count: 1, sides: 6 }, damageType: 'cold' },
        { id: 'zone-area', kind: 'create-persistent-area', label: 'Zone', durationRounds: 2, concentration: true, sourceIncapacitatedBehavior: 'remove-area' },
      ] }],
      scaling: [{ basis: 'slot-level', baseLevel: 2, adjustments: [
        { operationId: 'zone-damage', diceCountPerStep: 1, additionalTargetsPerStep: 1, additionalProjectilesPerStep: 1 },
        { operationId: 'zone-area', durationRoundsPerStep: 2 },
      ] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const second = { ...target, id: 'target-2' }
    const result = resolveDnd5eActivity({
      activity, actor, targets: [target, second], castLevel: 3,
      areaPlacement: { x: 12, y: 18, angleDegrees: 725 }, areaPlacementDistanceFeet: 40,
      rolls: { 'zone-damage': { values: [3, 4] } },
    })
    expect(result, JSON.stringify(result)).toMatchObject({
      ok: true,
      areaInstance: { shape: 'rect', x: 12, y: 18, angleDegrees: 5, lengthFeet: 20, widthFeet: 10 },
      proposals: expect.arrayContaining([
        expect.objectContaining({ kind: 'deal-damage', targetId: 'target', amount: 7 }),
        expect.objectContaining({ kind: 'deal-damage', targetId: 'target', amount: 7 }),
        expect.objectContaining({ kind: 'deal-damage', targetId: 'target-2', amount: 7 }),
        expect.objectContaining({ kind: 'deal-damage', targetId: 'target-2', amount: 7 }),
        expect.objectContaining({ kind: 'create-persistent-area', durationRounds: 4, sourceIncapacitatedBehavior: 'remove-area' }),
      ]),
    })
  })

  it('commits host-validated adjustable area dimensions', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'adjustable-wall', name: 'Adjustable Wall', activation: { kind: 'action' },
      target: { kind: 'area', relation: 'enemy', origin: 'point', shape: 'rect', lengthFeet: 100, minimumLengthFeet: 5, widthFeet: 5, heightFeet: 5, placeRangeFeet: 90, maximumTargets: 1, rotatable: true },
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 1 }, damageType: 'force' }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const validResult = resolveDnd5eActivity({
      activity, actor, targets: [target], areaPlacement: { x: 2, y: 3, lengthFeet: 35, widthFeet: 5, heightFeet: 5 }, areaPlacementDistanceFeet: 30, dmApproved: true, rolls: {},
    })
    expect(validResult, JSON.stringify(validResult)).toMatchObject({ ok: true, areaInstance: { lengthFeet: 35, widthFeet: 5, heightFeet: 5 } })
    expect(resolveDnd5eActivity({
      activity, actor, targets: [target], areaPlacement: { x: 2, y: 3, lengthFeet: 105 }, areaPlacementDistanceFeet: 30, dmApproved: true, rolls: {},
    })).toEqual({ ok: false, reason: 'invalid-target', details: ['area dimensions are invalid'] })
  })

  it('authorizes exact rectangle dimensions without relaxing grid-aligned or declared bounds', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'thin-wall', name: 'Thin Wall', activation: { kind: 'action' },
      target: { kind: 'area', relation: 'enemy', origin: 'point', shape: 'rect', lengthFeet: 20, minimumLengthFeet: 1, widthFeet: 1, heightFeet: 10, placeRangeFeet: 90 },
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{ id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 1 }, damageType: 'force' }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    if (activity.target.kind !== 'area') throw Error('Expected area fixture')
    const areaTarget = activity.target
    const execute = (lengthFeet: number, widthFeet: number, gridAligned = false) => resolveDnd5eActivity({
      activity: { ...activity, target: { ...areaTarget, gridAligned } }, actor, targets: [target],
      areaPlacement: { x: 2, y: 3, lengthFeet, widthFeet }, areaPlacementDistanceFeet: 30, dmApproved: true, rolls: {},
    })
    const accepted = execute(13, 1)
    expect(accepted, JSON.stringify(accepted)).toMatchObject({ ok: true, areaInstance: { lengthFeet: 13, widthFeet: 1 } })
    for (const [length, width] of [[21, 1], [0, 1], [13, 2], [13, 0], [NaN, 1], [13, Infinity]]) {
      expect(execute(length, width).ok).toBe(false)
    }
    expect(execute(13, 1, true).ok).toBe(false)
  })

  it.each(['actor', 'target', 'both'] as const)('keeps opposed-save dice and settlement aligned when %s controller is unknown', missing => {
    const activity = saveActivity()
    activity.target = {kind:'creature',relation:'any',count:1,rangeFeet:30}
    activity.checks = [{id:'save',kind:'saving-throw',ability:'wis',rollId:'save',scope:'per-target',dc:{kind:'constant',value:15},rollMode:'normal',rollModeIfOpposed:'advantage'}]
    const source = {...actor,controller:missing==='actor'||missing==='both'?undefined:actor.controller}
    const recipient = {...target,controller:missing==='target'||missing==='both'?undefined:target.controller}
    const dice = dnd5eActivityPerTargetRollDeclarationsV1({activity,actor:{id:source.id,controller:source.controller?'players':undefined},targets:[{id:recipient.id,controller:recipient.controller?'dm':undefined}],declarations:[{id:'save',label:'Save',count:1,sides:20}],hostSavingThrowMode:()=> 'normal',hostAttackRollMode:()=> 'normal'})
    expect(dice[0]).toMatchObject({count:1,d20RollMode:'normal'})
    // Deliberately incomplete runtime data: the executor must agree with the
    // public dice recipe even when a caller violates the snapshot contract.
    const result=resolveDnd5eActivity({activity,actor:source as Dnd5eActivityActorSnapshot,targets:[recipient as Dnd5eActivityActorSnapshot],rolls:{'save:target':{values:[2]},damage:{values:[4,4]}},distanceFeetByTargetId:{target:10}})
    expect(result.ok,JSON.stringify(result)).toBe(true)
    if(result.ok)expect(result.checks[0]).toMatchObject({success:false,d20:2})
  })

  it('resolves cast-level profiles before creating a persistent area', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1,
      id: 'upcast-persistent-area',
      name: 'Upcast Persistent Area',
      activation: { kind: 'action' },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
        lengthFeet: 20, widthFeet: 20, heightFeet: 20, placeRangeFeet: 120,
        maximumTargets: 256, rotatable: false,
      },
      outcomes: [{
        id: 'resolve', when: { kind: 'always' }, operations: [{
          id: 'area', kind: 'create-persistent-area', label: 'Major Image',
          durationRounds: 100, concentration: true,
          castLevelProfiles: [{
            minimumCastLevel: 6,
            durationRounds: 5_256_000,
            permanent: true,
            concentration: false,
            occupantModifiers: { suppressesSpellsThroughLevel: 6 },
          }],
        }],
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }

    const fifthLevel = resolveDnd5eActivity({
      activity, actor, targets: [], castLevel: 5,
      areaPlacement: { x: 10, y: 10 }, areaPlacementDistanceFeet: 60,
      rolls: {},
    })
    expect(fifthLevel).toMatchObject({
      ok: true,
      proposals: [expect.objectContaining({
        kind: 'create-persistent-area', durationRounds: 100, concentration: true,
        occupantModifiers: undefined,
      })],
    })

    const eighthLevel = resolveDnd5eActivity({
      activity, actor, targets: [], castLevel: 8,
      areaPlacement: { x: 10, y: 10 }, areaPlacementDistanceFeet: 60,
      rolls: {},
    })
    expect(eighthLevel).toMatchObject({
      ok: true,
      proposals: [expect.objectContaining({
        kind: 'create-persistent-area', durationRounds: 5_256_000,
        permanent: true, concentration: false,
        occupantModifiers: expect.objectContaining({ suppressesSpellsThroughLevel: 6 }),
      })],
    })
  })

  it('evaluates illumination requirements from the authoritative actor snapshot', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...saveActivity(),
      id: 'shadow-only-activity',
      requirements: [{
        kind: 'illumination', subject: 'actor', values: ['dim', 'darkness', 'magical-darkness'],
      }],
    }
    const input = {
      activity,
      targets: [target],
      distanceFeetByTargetId: { target: 20 },
      rolls: { 'save:target': { values: [10] }, damage: { values: [4, 5] } },
    }
    expect(resolveDnd5eActivity({ ...input, actor: { ...actor, illumination: 'dim' } }).ok).toBe(true)
    expect(resolveDnd5eActivity({ ...input, actor: { ...actor, illumination: 'bright' } }))
      .toMatchObject({ ok: false, reason: 'requirement-failed' })
  })

  it('evaluates target ability-score requirements without trusting client metadata', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      ...saveActivity(),
      id: 'low-intelligence-target',
      requirements: [{
        kind: 'ability-score', subject: 'target', ability: 'int', comparison: 'at-most', value: 7,
      }],
    }
    const input = {
      activity, actor, distanceFeetByTargetId: { target: 20 },
      rolls: { 'save:target': { values: [10] }, damage: { values: [4, 5] } },
    }
    expect(resolveDnd5eActivity({ ...input, targets: [{ ...target, abilities: { ...abilities, int: 6 } }] }).ok).toBe(true)
    expect(resolveDnd5eActivity({ ...input, targets: [{ ...target, abilities: { ...abilities, int: 8 } }] }))
      .toMatchObject({ ok: false, reason: 'requirement-failed' })
  })

  it('compiles an exact skill-check advantage into the shared active-effect proposal', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'stealth-blessing', name: 'Stealth Blessing', activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'ally', count: 1, rangeFeet: 5 },
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
        { id: 'apply-stealth', kind: 'apply-effect', target: 'target', effectId: 'stealth-advantage' },
      ] }],
      effects: [{
        schemaVersion: 1, id: 'stealth-advantage', name: 'Stealth Advantage',
        duration: { kind: 'rounds', rounds: 600, expiresAt: 'source-turn-end' },
        modifiers: [{ kind: 'ability-check', ability: 'dex', skill: 'stealth', mode: 'advantage' }],
        stacking: 'unique-by-source',
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const ally = { ...target, controller: actor.controller }
    expect(resolveDnd5eActivity({
      activity, actor, targets: [ally], distanceFeetByTargetId: { target: 5 }, rolls: {},
    })).toMatchObject({
      ok: true,
      proposals: [{
        kind: 'apply-effect', targetId: 'target', exclusiveBySource: true,
        modifierGroups: [{ abilityCheckRules: [{ ability: 'dex', skill: 'stealth', mode: 'advantage' }] }],
      }],
    })
  })

  it('preserves concentration on an effect that also repeats a saving throw', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'concentrated-save-ends', name: 'Concentrated Save Ends',
      activation: { kind: 'action' },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 60 },
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{
        id: 'apply-charm', kind: 'apply-effect', target: 'target', effectId: 'charm',
      }] }],
      effects: [{
        schemaVersion: 1, id: 'charm', name: 'Charm',
        duration: {
          kind: 'save-ends', maximumRounds: 10, timing: 'target-turn-end', ability: 'wis',
          dc: { kind: 'constant', value: 14 },
        },
        conditions: ['charmed'], stacking: 'unique-by-source', concentration: true,
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    expect(resolveDnd5eActivity({
      activity, actor, targets: [target], distanceFeetByTargetId: { target: 30 }, rolls: {},
    })).toMatchObject({
      ok: true,
      proposals: [{
        kind: 'apply-effect', targetId: 'target', concentration: true,
        duration: { kind: 'save-ends', maximumRounds: 10, timing: 'target-turn-end', ability: 'wis', dc: 14 },
      }],
    })
  })

  it('compiles temporary senses into the shared active-effect proposal', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'temporary-senses', name: 'Temporary Senses', activation: { kind: 'action' },
      target: { kind: 'self' },
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
        { id: 'apply-senses', kind: 'apply-effect', target: 'actor', effectId: 'senses-effect' },
      ] }],
      effects: [{
        schemaVersion: 1, id: 'senses-effect', name: 'Temporary Senses',
        duration: { kind: 'rounds', rounds: 100, expiresAt: 'source-turn-end' },
        modifiers: [{ kind: 'darkvision', rangeFeet: 60 }, { kind: 'see-invisible' }],
        stacking: 'refresh-duration',
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    expect(resolveDnd5eActivity({ activity, actor, targets: [actor], rolls: {} })).toMatchObject({
      ok: true,
      proposals: [{
        kind: 'apply-effect', targetId: 'actor',
        modifierGroups: [{ darkvisionRangeFeet: 60, seeInvisible: true }],
      }],
    })
  })

  it('compiles flight and class-scoped spell pressure/economy into one reusable effect', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'transformation-mode', name: 'Transformation Mode', activation: { kind: 'action' },
      target: { kind: 'self' },
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [
        { id: 'apply-mode', kind: 'apply-effect', target: 'actor', effectId: 'mode' },
      ] }],
      effects: [{
        schemaVersion: 1, id: 'mode', name: 'Mode',
        duration: { kind: 'rounds', rounds: 10, expiresAt: 'source-turn-end' },
        modifiers: [
          { kind: 'flight-speed', speedFeet: 60 },
          { kind: 'spell-action-as-bonus-action', spellcastingClassIds: ['paladin'] },
          { kind: 'spell-save-disadvantage-aura', radiusFeet: 10, spellcastingClassIds: ['paladin'] },
        ],
        stacking: 'refresh-duration',
      }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    expect(resolveDnd5eActivity({ activity, actor, targets: [actor], rolls: {} })).toMatchObject({
      ok: true,
      proposals: [{
        kind: 'apply-effect', targetId: 'actor',
        modifierGroups: [{
          flySpeedFeet: 60,
          spellActionAsBonusActionClassIds: ['paladin'],
          spellSaveDisadvantageAura: { radiusFeet: 10, damageTypes: [], spellcastingClassIds: ['paladin'] },
        }],
      }],
    })
  })

  it('rejects a triggered choice whose Host spell metadata does not satisfy its requirements', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'recover-slot', name: 'Recover Slot', activation: { kind: 'passive' },
      invocation: { kind: 'triggered', event: 'spell-resolved', confirmation: 'actor-choice' },
      target: { kind: 'self' },
      choices: [{
        id: 'slot', label: 'Slot', options: [
          { id: 'one', label: 'Level 1', requirements: [{ kind: 'spell-used', schools: ['divination'], minimumLevel: 2 }] },
          { id: 'two', label: 'Level 2', requirements: [{ kind: 'spell-used', schools: ['divination'], minimumLevel: 3 }] },
        ],
      }],
      outcomes: [{ id: 'restore', when: { kind: 'choice', choiceId: 'slot', optionId: 'two' }, operations: [
        { id: 'restore-two', kind: 'resource', subject: 'actor', resourceId: 'dnd5e-spell-slot-2', mode: 'restore', amount: { kind: 'constant', value: 1 } },
      ] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const triggerContext = {
      eventId: 'event:spell', event: 'spell-resolved' as const,
      source: { kind: 'spell' as const, id: 'augury', level: 2, school: 'divination' as const },
      eligibleActorIds: ['actor'], eligibleTargetIds: ['actor'],
    }
    expect(resolveDnd5eActivity({
      activity, actor: { ...actor, resources: { 'dnd5e-spell-slot-2': { current: 0, maximum: 1 } } },
      targets: [actor], rolls: {}, choices: { slot: 'two' }, triggerContext, confirmedBy: 'actor',
    })).toMatchObject({ ok: false, reason: 'requirement-failed' })
    expect(resolveDnd5eActivity({
      activity, actor: { ...actor, resources: { 'dnd5e-spell-slot-2': { current: 0, maximum: 1 } } },
      targets: [actor], rolls: {}, choices: { slot: 'one' }, triggerContext, confirmedBy: 'actor',
    })).toMatchObject({ ok: true })
  })

  it('validates repeated area anchors as one authoritative Activity placement', () => {
    const activity: Dnd5eActivityDefinitionV1 = {
      schemaVersion: 1, id: 'multi-cube', name: 'Multi Cube', activation: { kind: 'action' },
      target: {
        kind: 'area', relation: 'any', origin: 'point', shape: 'cube', placeRangeFeet: 150,
        lengthFeet: 10, widthFeet: 10, heightFeet: 10, maximumTargets: 256,
        instanceCount: 10, minimumInstanceCount: 1, instanceAdjacency: 'face',
      },
      outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{
        id: 'damage', kind: 'damage', target: 'all-targets',
        amount: { kind: 'constant', value: 7 }, damageType: 'fire', magical: true,
      }] }],
      automation: automationCapabilityFromLegacyStatus('full'),
    }
    const placement = {
      x: 10, y: 10, lengthFeet: 10, widthFeet: 10, heightFeet: 10,
      instances: [{ x: 10, y: 10 }, { x: 20, y: 10 }],
    }
    expect(resolveDnd5eActivity({
      activity, actor, targets: [target], rolls: {}, areaPlacement: placement,
      areaPlacementDistanceFeet: 30,
    })).toMatchObject({
      ok: true,
      proposals: [{ kind: 'deal-damage', targetId: 'target', amount: 7 }],
    })
    expect(resolveDnd5eActivity({
      activity, actor, targets: [target], rolls: {},
      areaPlacement: { ...placement, x: 11 }, areaPlacementDistanceFeet: 30,
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })
})


it('materializes imported effect-local charges at the actual cast level and rejects invalid declarations', () => {
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'charged-stars', name: 'Stars', activation: { kind: 'action' }, target: { kind: 'self' },
    automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'stars', name: 'Stars', stacking: 'replace',
      duration: { kind: 'rounds', rounds: 600, expiresAt: 'source-turn-end' }, grants: ['star-attack'],
      grantCharges: { initial: 7, baseCastLevel: 7, additionalPerSlotLevel: 2, endWhenEmpty: true,
        lightTiers: [{ minimumRemaining: 4, brightRadiusFeet: 30, dimRadiusFeet: 30, color: '#ffffff' },
          { minimumRemaining: 1, brightRadiusFeet: 0, dimRadiusFeet: 30, color: '#ffffff' }] } }],
    outcomes: [{ id: 'cast', when: { kind: 'always' }, operations: [
      { id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'stars' }] }],
  }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  for (const [castLevel, maximum] of [[7, 7], [8, 9], [9, 11]]) {
    const result = resolveDnd5eActivity({ activity: JSON.parse(JSON.stringify(activity)), actor, targets: [actor], rolls: {}, castLevel })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (result.ok) expect(result.proposals).toContainEqual(expect.objectContaining({ kind: 'apply-effect',
      grantedActivities: ['star-attack'], grantedActivityCharges: expect.objectContaining({ current: maximum, maximum, endWhenEmpty: true }) }))
  }
  for (const castLevel of [undefined, 6, 10]) {
    expect(resolveDnd5eActivity({ activity, actor, targets: [actor], rolls: {}, castLevel }).ok).toBe(false)
  }
  for (const patch of [{ initial: 0 }, { initial: 999 }, { additionalPerSlotLevel: undefined }, { unknown: true }]) {
    const invalid = structuredClone(activity)
    Object.assign(invalid.effects![0].grantCharges!, patch)
    expect(validateDnd5eActivityDefinitionV1(invalid).some(error => error.includes('grantCharges'))).toBe(true)
  }
  for (const patch of [{ grants: [] }, { grantsSingleUse: true }]) {
    const invalid = structuredClone(activity)
    Object.assign(invalid.effects![0], patch)
    expect(validateDnd5eActivityDefinitionV1(invalid).some(error => error.includes('grantCharges'))).toBe(true)
  }
})


it('validates material-filtered terrain and carries its whitelist through the executor',()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'filtered',name:'Filtered',activation:{kind:'action'},
 target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),outcomes:[{id:'terrain',when:{kind:'always'},operations:[{
 id:'terrain',kind:'create-persistent-area',label:'Terrain',durationRounds:1,permanent:true,concentration:false,
 groundOnly:true,anchorMode:'fixed',surfaceMaterials:['loose-earth','stone'],terrainClearing:{squareFeetPerMinute:25},movementCostMultiplier:2}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const result=resolveDnd5eActivity({activity,actor,targets:[actor],rolls:{}})
 expect(result.ok).toBe(true)
 if(result.ok)expect(result.proposals).toContainEqual(expect.objectContaining({kind:'create-persistent-area',surfaceMaterials:['loose-earth','stone']}))
 for(const patch of [{surfaceMaterials:[]},{surfaceMaterials:['lava']},{surfaceMaterials:['stone','stone']},{groundOnly:undefined},{permanent:false},{concentration:true},{anchorMode:'source-token'}]){
  const invalid=structuredClone(activity);Object.assign(invalid.outcomes[0].operations[0],patch)
  expect(validateDnd5eActivityDefinitionV1(invalid).some(e=>e.includes('surfaceMaterials'))).toBe(true)
 }
})


it('skips ground-contact area saves and effects for airborne or underground targets without assuming missing facts',()=>{
 const activity=saveActivity()
 activity.target={kind:'area',origin:'self',shape:'circle',radiusFeet:10,relation:'any',requiresGroundContact:true}
 const grounded={...target,id:'grounded',elevationFeet:10,groundElevationFeet:10}
 const airborne={...target,id:'airborne',elevationFeet:15,groundElevationFeet:10}
 const underground={...target,id:'underground',elevationFeet:5,groundElevationFeet:10}
 const targets=[grounded,airborne,underground]
 const dice=dnd5eActivityPerTargetRollDeclarationsV1({activity,actor:{id:actor.id},targets:targets.map(({id,elevationFeet,groundElevationFeet})=>({id,elevationFeet,groundElevationFeet})),declarations:[{id:'save',label:'Save',count:1,sides:20}],hostSavingThrowMode:()=> 'normal',hostAttackRollMode:()=> 'normal'})
 expect(dice.map(d=>d.id)).toEqual(['save:grounded'])
 const result=resolveDnd5eActivity({activity,actor,targets,areaPlacement:{x:0,y:0,elevationFeet:10},areaPlacementDistanceFeet:0,
 distanceFeetByTargetId:{grounded:5,airborne:5,underground:5},rolls:{'save:grounded':{values:[1]},damage:{values:[3,4]}}})
 expect(result.ok,JSON.stringify(result)).toBe(true)
 if(result.ok)expect(result.proposals.filter(p=>p.kind==='deal-damage').map(p=>p.targetId)).toEqual(['grounded'])
 expect(()=>dnd5eActivityPerTargetRollDeclarationsV1({activity,actor:{id:actor.id},targets:[{id:target.id}],declarations:[],hostSavingThrowMode:()=> 'normal',hostAttackRollMode:()=> 'normal'})).toThrow('activity-target-ground-contact-missing')
})


it('applies a Host negation checkpoint after final save mode and before selecting d20', () => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'luck-save', name: 'Luck save',
    activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1 },
    automation: automationCapabilityFromLegacyStatus('full'),
    checks: [{ id: 'save', kind: 'saving-throw', ability: 'dex', rollId: 'save', scope: 'per-target',
      rollMode: 'disadvantage', dc: { kind: 'constant', value: 14 } }],
    outcomes: [{ id: 'passed', when: { kind: 'check', checkId: 'save', result: 'success' },
      operations: [{ id: 'mark', kind: 'temporary-hit-points', target: 'target', amount: { kind: 'constant', value: 2 } }] }] }
  const checkpoint = vi.fn(() => true)
  const used = resolveDnd5eActivity({ activity, actor, targets: [target], rolls: { 'save:target': { values: [20] } }, negateDisadvantage: checkpoint })
  expect(used.ok, JSON.stringify(used)).toBe(true)
  expect(checkpoint).toHaveBeenCalledWith({ rollId: 'save:target', rollerId: target.id, kind: 'saving-throw', mode: 'disadvantage' })
  if (used.ok) {
    expect(used.checks[0]).toMatchObject({ d20: 20, success: true, rollMode: 'normal' })
    expect(used.proposals).toContainEqual(expect.objectContaining({ kind: 'grant-temporary-hit-points', targetId: target.id }))
  }
  const declined = resolveDnd5eActivity({ activity, actor, targets: [target], rolls: { 'save:target': { values: [20, 1] } }, negateDisadvantage: () => false })
  expect(declined.ok).toBe(true)
  if (declined.ok) expect(declined.checks[0]).toMatchObject({ d20: 1, success: false, rollMode: 'disadvantage' })
  const normal = structuredClone(activity)
  Object.assign(normal.checks![0], { rollMode: 'normal' })
  expect(resolveDnd5eActivity({ activity: normal, actor, targets: [target], rolls: { 'save:target': { values: [20] } }, negateDisadvantage: () => true }).ok).toBe(false)
  const immune = structuredClone(activity)
  Object.assign(immune.checks![0], { automaticSuccessIfConditionImmune: 'charmed' })
  const automatic = vi.fn(() => true)
  const result = resolveDnd5eActivity({ activity: immune, actor, targets: [{ ...target, conditionImmunities: ['charmed'] }], rolls: {}, negateDisadvantage: automatic })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(automatic).not.toHaveBeenCalled()
})


it('binds eligible weapon types while allowing magic without intrinsic attack and damage bonuses', () => {
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'sharpen', name: 'Sharpen',
    activation: { kind: 'bonus-action' }, target: { kind: 'self' }, automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'sharp', name: 'Sharp', stacking: 'replace', duration: { kind: 'rounds', rounds: 10, expiresAt: 'source-turn-start' },
      modifiers: [{ kind: 'weapon-enchantment', weaponSlot: 'main-hand', weaponBaseIds: ['dnd5e-longsword'],
        requiresNoIntrinsicAttackAndDamageBonus: true, attackAndDamageBonus: { kind: 'constant', value: 3 } }] }],
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'sharp' }] }] }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  for (const magical of [false, true]) for (const bonus of [0, 1, 3]) {
    const equipment = structuredClone(DND5E_LONGSWORD)
    equipment.id = 'owned-instance'; equipment.baseEquipmentId = 'dnd5e-longsword'
    if (equipment.dnd5e?.kind !== 'weapon') throw Error('weapon required')
    equipment.dnd5e.magical = magical
    equipment.effects = { weaponAttackBonus: bonus, weaponDamageBonus: bonus }
    const character = normalizeCharacter({ id: 'actor', level: 11, charClass: '武僧', equipment: { mainWeapon: equipment } })
    const snapshot = migrateCharacterToDnd5e(character).activityEquipment
    expect(snapshot.mainHand).toMatchObject({ weaponId: 'owned-instance', weaponBaseId: 'dnd5e-longsword', intrinsicAttackBonus: bonus, intrinsicDamageBonus: bonus, magical })
    const wielder = { ...actor, equipment: JSON.parse(JSON.stringify(snapshot)) }
    const result = resolveDnd5eActivity({ activity, actor: wielder, targets: [wielder], rolls: {} })
    expect(result.ok, JSON.stringify(result)).toBe(bonus === 0)
    if (result.ok) expect(result.proposals).toContainEqual(expect.objectContaining({ kind: 'apply-effect', modifierGroups: [expect.objectContaining({ weaponEnchantment: expect.objectContaining({ weaponId: 'owned-instance', attackAndDamageBonus: 3 }) })] }))
    const wrong = structuredClone(wielder); wrong.equipment.mainHand!.weaponBaseId = 'dnd5e-shortbow'
    expect(resolveDnd5eActivity({ activity, actor: wrong, targets: [wrong], rolls: {} }).ok).toBe(false)
    const unknown = structuredClone(wielder); delete unknown.equipment.mainHand!.intrinsicAttackBonus
    expect(resolveDnd5eActivity({ activity, actor: unknown, targets: [unknown], rolls: {} }).ok).toBe(false)
  }
  for (const patch of [{ weaponBaseIds: [] }, { weaponBaseIds: ['a', 'a'] }, { requiresNoIntrinsicAttackAndDamageBonus: false }, { weaponSlot: 'ammunition-container' }]) {
    const invalid = structuredClone(activity); Object.assign(invalid.effects![0].modifiers![0], patch)
    expect(validateDnd5eActivityDefinitionV1(invalid).length).toBeGreaterThan(0)
  }
})
