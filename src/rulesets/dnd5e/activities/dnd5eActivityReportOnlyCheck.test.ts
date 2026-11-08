import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { dnd5eActivityBaseFormulaRollIdsV1 } from './dnd5eActivityRollRecipe'

const actor: Dnd5eActivityActorSnapshot = {
  id: 'investigator', controller: 'players', level: 3, proficiencyBonus: 2,
  abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 14, cha: 10 },
  armorClass: 12, conditions: [], currentHp: 20, maxHp: 20,
  skillCheckModifiers: { perception: 4, investigation: 7 },
}
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'eye-for-detail', name: 'Eye for Detail',
  activation: { kind: 'bonus-action' }, target: { kind: 'self' },
  automation: automationCapabilityFromLegacyStatus('full'),
  checks: [{ id: 'observe', kind: 'skill-check', ability: 'wis', skill: 'perception',
    rollId: 'observe', reportTotalOnly: true }],
  outcomes: [],
}

describe('report-only skill checks', () => {
  it.each([1, 12, 20])('reports a total without inventing DC, success or discovery for d20=%i', d20 => {
    const imported = JSON.parse(JSON.stringify(activity))
    expect(validateDnd5eActivityDefinitionV1(imported)).toEqual([])
    expect([...dnd5eActivityBaseFormulaRollIdsV1(imported)]).toEqual([])
    const result = resolveDnd5eActivity({ activity: imported, actor, targets: [actor], rolls: { observe: { values: [d20] } } })
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.checks).toHaveLength(1)
    expect(result.checks[0]).toMatchObject({ total: d20 + 4, modifier: 4, criticalSuccess: false, criticalFailure: false })
    expect(result.checks[0].success).toBeUndefined()
    expect(result.checks[0].dc).toBeUndefined()
    expect(result.proposals).toEqual([])
  })
  it('rejects fabricated adjudication and malformed declarations', () => {
    const patches = [
      { dc: { kind: 'constant', value: 10 } }, { reportTotalOnly: false },
      { reportTotalOnly: undefined }, { kind: 'ability-check' }, { skill: undefined },
    ]
    for (const patch of patches) {
      expect(validateDnd5eActivityDefinitionV1({ ...activity, checks: [{ ...activity.checks![0], ...patch }] } as unknown as Dnd5eActivityDefinitionV1)).not.toEqual([])
    }
    for (const result of ['success', 'failure', 'critical-success', 'critical-failure'] as const) {
      const candidate: Dnd5eActivityDefinitionV1 = { ...activity, outcomes: [{ id: 'invented', when: { kind: 'check', checkId: 'observe', result }, operations: [] }] }
      expect(validateDnd5eActivityDefinitionV1(candidate).some(error => error.includes('report-only'))).toBe(true)
    }
  })
})

it('validates and projects bounded contextual skill modifiers without broadening their scope', () => {
  const candidate: Dnd5eActivityDefinitionV1 = {
    ...activity, id: 'contextual-rules', checks: [],
    effects: [{ schemaVersion: 1, id: 'rules', name: 'Rules', stacking: 'replace', duration: { kind: 'permanent' },
      modifiers: [
        { kind: 'minimum-skill-check-d20', ability: 'wis', skill: 'insight', purpose: 'detect-lies', minimum: 8 },
        { kind: 'half-speed-skill-check-advantage', ability: 'wis', skill: 'perception' },
        { kind: 'half-speed-skill-check-advantage', ability: 'int', skill: 'investigation' },
      ] }],
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'rules' }] }],
  }
  expect(validateDnd5eActivityDefinitionV1(candidate)).toEqual([])
  const result = resolveDnd5eActivity({ activity: JSON.parse(JSON.stringify(candidate)), actor, targets: [actor], rolls: {} })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) return
  expect(result.proposals).toContainEqual(expect.objectContaining({ kind: 'apply-effect', modifierGroups: [expect.objectContaining({
    minimumSkillCheckD20: [{ ability: 'wis', skill: 'insight', purpose: 'detect-lies', minimum: 8 }],
    skillCheckAdvantagesWithinHalfSpeed: [{ ability: 'wis', skill: 'perception' }, { ability: 'int', skill: 'investigation' }],
  })] }))
  for (const patch of [{ minimum: 21 }, { purpose: 'any' }, { skill: 'investigation' }, { ability: 'str' }, { extra: true }]) {
    const malformed = JSON.parse(JSON.stringify(candidate))
    Object.assign(malformed.effects[0].modifiers[0], patch)
    expect(validateDnd5eActivityDefinitionV1(malformed)).not.toEqual([])
  }
})

it.each(['doesNotRequireSleep', 'cannotBeForcedToSleep'] as const)('accepts only boolean permanent %s character capability', capability => {
  const candidate: Dnd5eActivityDefinitionV1 = { ...activity, effects: [{ schemaVersion: 1, id: 'sleep', name: 'Sleep', stacking: 'replace',
    duration: { kind: 'permanent' }, modifiers: [{ kind: 'character-capability', capability, value: true }] }] }
  expect(validateDnd5eActivityDefinitionV1(candidate)).toEqual([])
  const malformed = JSON.parse(JSON.stringify(candidate))
  malformed.effects[0].modifiers[0].value = 1
  expect(validateDnd5eActivityDefinitionV1(malformed)).not.toEqual([])
})

it('emits only a fixed range Host sensory inspection request and rejects client facts', () => {
  const candidate: Dnd5eActivityDefinitionV1 = { ...activity, id: 'unerring-eye', activation: { kind: 'action' }, checks: [],
    outcomes: [{ id: 'inspect', when: { kind: 'always' }, operations: [{ id: 'inspect', kind: 'read-sensory-deception', target: 'actor', rangeFeet: 30 }] }] }
  expect(validateDnd5eActivityDefinitionV1(candidate)).toEqual([])
  const result = resolveDnd5eActivity({ activity: candidate, actor, targets: [actor], rolls: {} })
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.proposals).toEqual([expect.objectContaining({ kind: 'read-sensory-deception', targetId: actor.id, rangeFeet: 30 })])
  for (const patch of [{ rangeFeet: 31 }, { target: 'target' }, { present: false }, { entityIds: ['secret'] }]) {
    const malformed = JSON.parse(JSON.stringify(candidate))
    Object.assign(malformed.outcomes[0].operations[0], patch)
    expect(validateDnd5eActivityDefinitionV1(malformed)).not.toEqual([])
  }
})

it.each(['normal','advantage','disadvantage'] as const)('preserves raw %s dice and applies reliable talent after original die selection', rollMode => {
  const reliable = { ...actor, classLevels: { rogue: 11 }, skillProficiencyRanks: { perception: 1 as const } }
  const candidate: Dnd5eActivityDefinitionV1 = { ...activity, checks: [{ id:'observe',kind:'skill-check',ability:'wis',skill:'perception',rollId:'observe',reportTotalOnly:true,rollMode }] }
  const rolls = { observe: { values: rollMode === 'normal' ? [2] : [2,18] } }
  const evidence=JSON.stringify(rolls)
  const result=resolveDnd5eActivity({activity:candidate,actor:reliable,targets:[reliable],rolls})
  expect(result.ok).toBe(true)
  if(result.ok)expect(result.checks[0]).toMatchObject({rawD20:rollMode==='advantage'?18:2,d20:rollMode==='advantage'?18:10,reliableTalentApplied:rollMode!=='advantage'})
  expect(JSON.stringify(rolls)).toBe(evidence)
})

it('applies reliable talent to both opposed skill participants without editing the source dice', () => {
  const reliable={...actor,classLevels:{rogue:11},skillProficiencyRanks:{insight:1 as const},skillCheckModifiers:{insight:0}}
  const target={...reliable,id:'target'}
  const candidate: Dnd5eActivityDefinitionV1={...activity,target:{kind:'creature',relation:'any',count:1},outcomes:[{id:'pass',when:{kind:'check',checkId:'contest',result:'success'},operations:[{id:'notice',kind:'narrative-prompt',prompt:'Contest succeeded'}]}],checks:[{id:'contest',kind:'opposed-ability-check',scope:'per-target',rollId:'source',opposedRollId:'target',
    sourceAbility:'wis',sourceSkill:'insight',sourceModifier:{kind:'constant',value:0},sourceRollMode:'disadvantage',targetRollMode:'normal',targetOptions:[{ability:'wis',skill:'insight'}]}]}
  const rolls={'source:target':{values:[2,18]},'target:target':{values:[3]}}
  const result=resolveDnd5eActivity({activity:candidate,actor:reliable,targets:[target],rolls})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  if(result.ok)expect(result.checks[0]).toMatchObject({rawD20:2,d20:10,rawOpposedD20:3,opposedD20:10,reliableTalentApplied:true,opposedReliableTalentApplied:true,success:false})
  expect(rolls).toEqual({'source:target':{values:[2,18]},'target:target':{values:[3]}})
})
