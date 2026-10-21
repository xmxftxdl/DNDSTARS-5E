import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityRequiredPhases, validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { dnd5eActivityAutomationAnalysisV1 } from '../plugins/pluginMechanicsRegistry'

it.each(['protect-source', 'attack-nearest-visible', 'attack-nearest-other-subtype'] as const)('only the protective autonomous policy accepts owner orders (%s)', autonomousBehavior => {
  const activity = damageActivity()
  activity.outcomes = [{ id: 'summon', when: { kind: 'always' }, operations: [{ id: 'summon', kind: 'summon',
    monsterId: 'srd-5.1:wolf', count: { kind: 'constant', value: 4 }, timing: 'immediate', durationRounds: 600,
    concentration: false, side: 'ally', autonomousBehavior, requiredCreatureSubtype: 'demon', commandPolicy: 'persistent-order' }] }]
  expect(validateDnd5eActivityDefinitionV1(activity).filter(error => error.includes('autonomousBehavior')))
    .toHaveLength(autonomousBehavior === 'protect-source' ? 0 : 1)
})

it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('validates fixed-origin placement range (%s)', placeRangeFeet => {
  const activity = damageActivity()
  activity.target = { kind: 'area', origin: 'point', shape: 'rect', widthFeet: 100, lengthFeet: 100,
    heightFeet: 100, rangeOrigin: 'granting-area', relation: 'any', placeRangeFeet }
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('target.placeRangeFeet')))
    .toBe(placeRangeFeet !== 0)
  activity.target.widthFeet = 0
  expect(validateDnd5eActivityDefinitionV1(activity)).toContain('activity.target.widthFeet is invalid')
})

it.each([
  ['ascend', 'target', true], ['descend', 'target', true],
  ['ascend', 'actor', true], ['voluntary', 'actor', true],
  ['voluntary', 'target', false], ['forced', 'actor', false],
  ['teleport', 'actor', false], ['ascend', 'all-targets', false],
] as const)('validates movement budget for %s / %s', (mode, target, valid) => {
  const activity = damageActivity()
  activity.outcomes = [{ id: 'move', when: { kind: 'always' }, operations: [{
    id: 'move', kind: 'move', mode, target,
    distanceFeet: { kind: 'constant', value: 5 }, usesActorMovement: true,
  }] }]
  expect(validateDnd5eActivityDefinitionV1(activity).filter(error => error.includes('usesActorMovement')))
    .toHaveLength(valid ? 0 : 1)
})

it.each(['valid', 'unknown-policy', 'missing-bond', 'temporary'])('validates living bond creation policy (%s)', mode => {
  const activity = damageActivity()
  activity.outcomes[0].operations = [{ id: 'create', kind: 'summon', monsterId: 'srd-5.1:wolf',
    count: { kind: 'constant', value: 1 }, timing: 'immediate', concentration: false, side: 'ally',
    persistent: mode !== 'temporary', durationRounds: 10, bondKey: mode === 'missing-bond' ? undefined : 'companion',
    existingBondPolicy: (mode === 'unknown-policy' ? 'replace' : 'reject-living') as 'reject-living' }]
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('existingBondPolicy'))).toBe(mode !== 'valid')
})

it.each(['valid', 'empty', 'duplicate', 'invalid-key', 'missing-bond', 'temporary'])('validates cross-package bond keys (%s)', mode => {
  const activity = damageActivity()
  activity.outcomes[0].operations = [{ id: 'create', kind: 'summon', monsterId: 'srd-5.1:wolf',
    count: { kind: 'constant', value: 1 }, timing: 'immediate', concentration: false, side: 'ally',
    persistent: mode !== 'temporary', durationRounds: 10, bondKey: mode === 'missing-bond' ? undefined : 'companion',
    exclusiveBondKeys: mode === 'empty' ? [] : mode === 'duplicate' ? ['companion', 'companion'] : mode === 'invalid-key' ? [''] : ['companion'],
  }]
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('exclusiveBondKeys'))).toBe(mode !== 'valid')
})

it.each([undefined,0,1,2,-1,3,0.5,'0',Number.NaN])('validates optional creature target minimum (%j)',minimumCount=>{
  const activity=damageActivity()
  activity.target={kind:'creature',relation:'any',count:2,minimumCount} as Dnd5eActivityDefinitionV1['target']
  expect(validateDnd5eActivityDefinitionV1(activity).some(error=>error.includes('minimumCount')))
    .toBe(minimumCount!==undefined && !(typeof minimumCount==='number' && Number.isInteger(minimumCount) && minimumCount>=0 && minimumCount<=2))
})

it.each([undefined, true, false, 'true', 1, {}, []])('validates irreducible damage declaration (%j)', cannotBeReduced => {
  const activity = damageActivity()
  Object.assign(activity.outcomes[0].operations[0], { cannotBeReduced })
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('.cannotBeReduced')))
    .toBe(cannotBeReduced !== undefined && typeof cannotBeReduced !== 'boolean')
})

it.each([true, false, 'true', 1])('validates an explicit magical Effect flag (%j)', magical => {
  const activity = damageActivity()
  activity.effects = [{ schemaVersion: 1, id: 'veil', name: 'Veil', magical,
    duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' },
    conditions: ['invisible'], stacking: 'replace' } as unknown as NonNullable<Dnd5eActivityDefinitionV1['effects']>[number]]
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('.magical'))).toBe(magical !== true)
})

it.each(['valid', 'missing-grant', 'unknown-source'])('validates grant-owned damage attribution (%s)', mode => {
  const activity = damageActivity()
  activity.requiresEffectGrant = mode === 'missing-grant' ? undefined : true
  const operation = activity.outcomes[0].operations[0]
  if (operation.kind !== 'damage') throw Error('Expected damage fixture')
  operation.damageSource = (mode === 'unknown-source' ? 'client-actor' : 'grant-source') as 'grant-source'
  const errors = validateDnd5eActivityDefinitionV1(activity)
  expect(errors.length).toBe(mode === 'valid' ? 0 : 1)
})

it('rejects an unknown movement distance basis', () => {
  const activity = damageActivity()
  activity.requirements = [{ kind: 'movement-distance', basis: 'total-movement' } as any]
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('basis is invalid'))).toBe(true)
})

it.each([undefined, null, false, 'permanent', []])('reports malformed condition durations without crashing import (%j)', duration => {
  const activity = damageActivity()
  activity.outcomes = [{ id: 'condition', when: { kind: 'always' }, operations: [{
    id: 'condition', kind: 'apply-standard-condition', condition: 'prone', target: 'target', duration,
  } as unknown as Dnd5eActivityDefinitionV1['outcomes'][number]['operations'][number]] }]
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('duration'))).toBe(true)
})

it.each(['scope', 'retention', 'event', 'false', 'active'])('rejects invalid window-expiry contracts: %s', mode => {
  const activity = damageActivity()
  activity.requiresEffectGrant = true
  activity.invocation = { kind: mode === 'active' ? 'active' : 'triggered',
    event: mode === 'event' ? 'turn-end' : 'temporary-hit-points-gained', confirmation: 'actor-choice',
    effectGrantScope: mode === 'scope' ? undefined : 'trigger-execution',
    retention: mode === 'retention' ? 'until-turn-end' : 'single-event',
    expireGrantAtWindowEnd: mode === 'false' ? false : true,
  } as unknown as Dnd5eActivityDefinitionV1['invocation']
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('expireGrantAtWindowEnd'))).toBe(true)
})

it.each(['no-grant', 'unknown-scope', 'active'])('rejects invalid execution-grant contracts: %s', mode => {
  const activity = damageActivity()
  activity.requiresEffectGrant = mode === 'no-grant' ? undefined : true
  activity.invocation = { kind: mode === 'active' ? 'active' : 'triggered', event: 'temporary-hit-points-gained',
    confirmation: 'actor-choice', effectGrantScope: mode === 'unknown-scope' ? 'any' : 'trigger-execution',
  } as unknown as Dnd5eActivityDefinitionV1['invocation']
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('effectGrantScope'))).toBe(true)
})

it.each(['no-grant', 'automatic', 'false-flag'])('rejects invalid decline-release contracts: %s', mode => {
  const activity = damageActivity()
  activity.requiresEffectGrant = mode === 'no-grant' ? undefined : true
  activity.invocation = { kind: 'triggered', event: 'temporary-hit-points-gained',
    confirmation: mode === 'automatic' ? 'automatic' : 'actor-choice',
    releaseSingleUseGrantOnDecline: mode === 'false-flag' ? false : true } as unknown as Dnd5eActivityDefinitionV1['invocation']
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('releaseSingleUseGrantOnDecline'))).toBe(true)
})

it('rejects a non-boolean reverse visibility requirement', () => {
  const activity = damageActivity()
  activity.target = { kind: 'creature', count: 1, relation: 'any', requiresTargetSeeActor: 'yes' } as unknown as Dnd5eActivityDefinitionV1['target']
  expect(validateDnd5eActivityDefinitionV1(activity)).toContain('activity.target.requiresTargetSeeActor is invalid')
})

it.each([
  null, [], 'reaction', { kind: 'unknown' },
  { kind: 'action-economy', economy: 'reaction' },
  { kind: 'action-economy', economy: 'reaction', amount: 2, consumeOn: 'resolve' },
  { kind: 'action-economy', economy: 'turn', amount: 1, consumeOn: 'resolve' },
  { kind: 'action-economy', economy: 'reaction', amount: 1, consumeOn: 'hit' },
  { kind: 'spell-slot', minimumLevel: 10, level: 'selected', amount: 1, consumeOn: 'resolve' },
  { kind: 'spell-slot', minimumLevel: 1, level: 1, amount: 1, consumeOn: 'resolve' },
  { kind: 'resource', consumeOn: 'resolve', amount: { kind: 'constant', value: 1 } },
  { kind: 'resource', resourceId: 'pool', consumeOn: 'resolve' },
  { kind: 'movement', amount: 5, consumeOn: 'resolve' },
  { kind: 'hp', amount: { kind: 'constant', value: 1 }, consumeOn: 'hit' },
  { kind: 'item-charge', resourceId: 'wand', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve', itemTemplateIds: 'wand' },
])('rejects malformed imported consumption without throwing: %j', consumption => {
  const activity = damageActivity()
  activity.consumption = [consumption] as unknown as Dnd5eActivityDefinitionV1['consumption']
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.startsWith('activity.consumption'))).toBe(true)
})

it.each([
  { kind: 'check-success', checkId: 'save' },
  { kind: 'check', checkId: 'save', result: 'hit' },
  { kind: 'all' },
  { kind: 'all', conditions: [{ kind: 'always' }, { kind: 'check', checkId: 'save', result: 'success' }] },
  { kind: 'all', conditions: [null, { kind: 'check', checkId: 'save', result: 'success' }] },
  null,
])('rejects malformed outcome conditions instead of accepting a silent no-op (%j)', when => {
  const activity = damageActivity()
  activity.outcomes = [{ ...activity.outcomes[0], when } as unknown as Dnd5eActivityDefinitionV1['outcomes'][number]]
  expect(validateDnd5eActivityDefinitionV1(activity).length).toBeGreaterThan(0)
})

function damageActivity(): Dnd5eActivityDefinitionV1 {
  return {
    schemaVersion: 1,
    id: 'ember-burst',
    name: '余烬爆发',
    activation: { kind: 'action' },
    target: {
      kind: 'area', relation: 'enemy', origin: 'point', shape: 'rect', placeRangeFeet: 60,
      widthFeet: 30, heightFeet: 5, maximumTargets: 32, rotatable: true,
    },
    checks: [{
      id: 'save', kind: 'saving-throw', rollId: 'save', ability: 'dex',
      dc: { kind: 'constant', value: 14 }, scope: 'per-target',
    }],
    outcomes: [{
      id: 'failed-save',
      when: { kind: 'check', checkId: 'save', result: 'failure' },
      operations: [{
        id: 'damage', kind: 'damage', target: 'target', damageType: 'fire',
        amount: { kind: 'dice', rollId: 'damage', count: 3, sides: 6 }, magical: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('full'),
  }
}

describe('D&D 5e Activity validation', () => {
  it('requires a valid class identifier for class scaling and optional class tables', () => {
    for (const basis of ['class-level', 'custom-table'] as const) {
      for (const classId of ['', 'bad class']) {
        const activity = damageActivity()
        activity.scaling = [{ basis, classId, ...(basis === 'custom-table' ? { table: [{ level: 1, value: 0 }] } : {}) }]
        expect(validateDnd5eActivityDefinitionV1(activity).join(' ')).toContain('classId is invalid')
      }
    }
    const activity = damageActivity()
    activity.scaling = [{ basis: 'class-level' }]
    expect(validateDnd5eActivityDefinitionV1(activity).join(' ')).toContain('classId is invalid')
  })
  it('validates explicit casting class filters without accepting malformed lists', () => {
    const activity = damageActivity()
    activity.requirements = [{ kind: 'spell-used', castingClassIds: ['wizard', 'cleric'] }]
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    for (const castingClassIds of [[], ['wizard', 'wizard'], [''], [null], 'wizard', {}]) {
      const invalid = structuredClone(activity)
      Object.assign(invalid.requirements![0], { castingClassIds })
      expect(validateDnd5eActivityDefinitionV1(invalid).join(' ')).toContain('castingClassIds is invalid')
    }
  })
  it('validates the optional source-incapacity area lifecycle', () => {
    const activity = damageActivity()
    activity.outcomes[0].operations = [{ id: 'zone', kind: 'create-persistent-area', label: 'Zone', durationRounds: 10, concentration: false, sourceIncapacitatedBehavior: 'remove-area' }]
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    for (const invalid of [false, true, 1, 'keep', null]) {
      const bad = structuredClone(activity)
      ;(bad.outcomes[0].operations[0] as any).sourceIncapacitatedBehavior = invalid
      expect(validateDnd5eActivityDefinitionV1(bad).join(' ')).toContain('sourceIncapacitatedBehavior is invalid')
    }
  })
  it('accepts a standalone incapacity source link and rejects non-true values', () => {
    const activity = damageActivity()
    activity.effects = [{ schemaVersion: 1, id: 'wings', name: 'Wings', disposition: 'buff', stacking: 'replace', duration: { kind: 'permanent' }, sourceLink: { sourceMustNotBeIncapacitated: true } }]
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    for (const invalid of [false, 1, 'true']) {
      const bad = structuredClone(activity)
      ;(bad.effects![0].sourceLink as any).sourceMustNotBeIncapacitated = invalid
      expect(validateDnd5eActivityDefinitionV1(bad).join(' ')).toContain('sourceMustNotBeIncapacitated is invalid')
    }
  })
  it('validates bearer-exclusive effect groups without changing the default source scope', () => {
    const activity = damageActivity()
    activity.effects = [{ schemaVersion: 1, id: 'mark', name: 'Mark', stacking: 'replace',
      duration: { kind: 'permanent' }, exclusiveGroup: 'mark', exclusiveGroupScope: 'bearer' }]
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    for (const scope of ['source', undefined] as const) {
      activity.effects[0].exclusiveGroupScope = scope
      expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    }
    for (const patch of [{ exclusiveGroupScope: 'global' }, { exclusiveGroupScope: 'bearer', exclusiveGroup: undefined }]) {
      Object.assign(activity.effects[0], patch)
      expect(validateDnd5eActivityDefinitionV1(activity).join(' ')).toContain('exclusiveGroupScope is invalid')
    }
  })
  it('permits distinct-destination requirements on positional movement, not directional push', () => {
    const activity = damageActivity()
    for (const mode of ['teleport', 'forced', 'voluntary'] as const) {
      activity.outcomes[0].operations = [{ id: 'step', kind: 'move', target: 'target', mode, distanceFeet: { kind: 'constant', value: 30 }, requiresDifferentDestination: true }]
      expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    }
    activity.outcomes[0].operations = [{ id: 'step', kind: 'move', target: 'target', mode: 'push', distanceFeet: { kind: 'constant', value: 30 }, requiresDifferentDestination: true }]
    expect(validateDnd5eActivityDefinitionV1(activity).join(' ')).toContain('requiresDifferentDestination requires positional movement and true')
  })
  it('restricts area-center movement to directional movement with centered geometry', () => {
    const activity = damageActivity()
    activity.outcomes[0].operations = [{ id: 'push', kind: 'move', target: 'target', mode: 'push', distanceFeet: { kind: 'constant', value: 10 }, directionOrigin: 'area-center' }]
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    activity.outcomes[0].operations = [{ id: 'push', kind: 'move', target: 'target', mode: 'teleport', distanceFeet: { kind: 'constant', value: 10 }, directionOrigin: 'area-center' }]
    expect(validateDnd5eActivityDefinitionV1(activity).join(' ')).toContain('directionOrigin requires push/pull')
    activity.target = { kind: 'self' }
    expect(validateDnd5eActivityDefinitionV1(activity).join(' ')).toContain('requires a centered area target')
  })
  it('rejects self-dependent effect creation DCs but permits existing-effect followups',()=>{
    const activity=damageActivity()
    activity.effects=[{schemaVersion:1,id:'new-effect',name:'New effect',disposition:'debuff',stacking:'replace',duration:{kind:'save-ends',maximumRounds:10,timing:'target-turn-end',ability:'int',dc:{kind:'reference',reference:{kind:'actor-active-effect-source-spell-save-dc',effectId:'new-effect'}}}}]
    expect(validateDnd5eActivityDefinitionV1(activity).some(issue=>issue.includes('not-yet-existing effect'))).toBe(true)
    activity.requirements=[{kind:'active-effect',subject:'actor',effectId:'new-effect',present:true,source:'any'}]
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    activity.requirements=[]
    activity.effects[0].duration={kind:'save-ends',maximumRounds:10,timing:'target-turn-end',ability:'int',dc:{kind:'reference',reference:{kind:'actor-spell-save-dc'}}}
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  })
  it('rejects dangling scaling references and tables that the scaling basis would ignore', () => {
    const activity = damageActivity()
    activity.scaling = [{ basis: 'slot-level', baseLevel: 2, adjustments: [{ operationId: 'another-activity', diceCountPerStep: 1 }] }]
    expect(validateDnd5eActivityDefinitionV1(activity)).toContain('activity.scaling[0].adjustments[0].operationId must reference an operation in this Activity, not another Activity')
    activity.scaling = [{ basis: 'character-level', table: [{ level: 1, value: 0 }, { level: 5, value: 1 }], adjustments: [{ operationId: 'damage', diceCountPerStep: 1 }] }]
    expect(validateDnd5eActivityDefinitionV1(activity)).toContain('activity.scaling[0].table requires basis custom-table; other bases use linear steps and ignore tables')
    activity.scaling = [{ ...activity.scaling[0], basis: 'custom-table' }]
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    activity.scaling = [{ ...activity.scaling[0], table: [{ level: 1, value: 'one' }] }]
    expect(validateDnd5eActivityDefinitionV1(activity).join(' ')).toContain('nonnegative integer step values')
  })
  it.each([
    [{ id: 'form', options: [] }, 'activity.choices[0].label must be a string'],
    [{ id: 'form', label: 'Form' }, 'activity.choices[0].options must be an array'],
    [{ id: 'form', label: 'Form', options: [null] }, 'activity.choices[0].options[0] must be an object'],
    [{ id: 'form', label: 'Form', options: [{ id: 'wolf' }] }, 'activity.choices[0].options[0].label must be a string'],
  ])('returns repairable diagnostics for malformed imported choices', (choice, diagnostic) => {
    const activity = { ...damageActivity(), choices: [choice] } as unknown as Dnd5eActivityDefinitionV1
    expect(validateDnd5eActivityDefinitionV1(activity)).toContain(diagnostic)
  })
  it('validates a freely rotatable wall-like damage Activity', () => {
    const activity = damageActivity()
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    expect(dnd5eActivityRequiredPhases(activity)).toEqual(expect.arrayContaining([
      'eligibility', 'targeting', 'saving-throw', 'damage', 'persistence',
    ]))
  })

  it('rejects dangling checks and arbitrary ids while deriving automation independently of legacy claims', () => {
    const activity = damageActivity()
    const invalid: Dnd5eActivityDefinitionV1 = {
      ...activity,
      id: 'Bad Activity',
      outcomes: [{
        id: 'manual',
        when: { kind: 'check', checkId: 'missing', result: 'failure' },
        operations: [{
          id: 'manual', kind: 'manual-adjudication', prompt: '请裁定', reason: '地图改变',
          requiresDmApproval: true,
        }],
      }],
    }
    expect(validateDnd5eActivityDefinitionV1(invalid)).toEqual(expect.arrayContaining([
      'activity.id is invalid',
      'activity.outcomes[0].when references an unknown check',
    ]))
    expect(dnd5eActivityAutomationAnalysisV1(invalid).capability).toMatchObject({
      level: 'assisted',
      limitations: expect.arrayContaining(['Activity 包含显式 DM 裁定 operation。']),
    })
  })

  it('rejects runtime-only unknown activation, trigger, target and operation values', () => {
    const invalid = {
      ...damageActivity(),
      activation: { kind: 'script' },
      invocation: { kind: 'triggered', event: 'after-anything', confirmation: 'automatic' },
      target: { kind: 'zone', relation: 'enemy' },
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{ id: 'execute', kind: 'javascript' }] }],
    } as unknown as Dnd5eActivityDefinitionV1
    expect(validateDnd5eActivityDefinitionV1(invalid)).toEqual(expect.arrayContaining([
      'activity.invocation.event is invalid',
      'activity.activation.kind is invalid',
      'activity.target.kind is invalid',
      'activity.outcomes[0].operations[0].kind is invalid',
    ]))
  })

  it('validates source-turn maintenance links and rejects arbitrary effect ids', () => {
    const valid: Dnd5eActivityDefinitionV1 = {
      ...damageActivity(),
      effects: [{
        schemaVersion: 1,
        id: 'maintained-charm',
        name: '维持中的魅惑',
        duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' },
        sourceLink: { sourceRequiresEffectAtSourceTurnEnd: 'maintained-this-turn' },
        stacking: 'refresh-duration',
      }],
    }
    expect(validateDnd5eActivityDefinitionV1(valid)).toEqual([])
    expect(validateDnd5eActivityDefinitionV1({
      ...valid,
      effects: [{
        ...valid.effects![0]!,
        sourceLink: { sourceRequiresEffectAtSourceTurnEnd: 'Bad Effect ID' },
      }],
    })).toContain('activity.effects[0].sourceLink.sourceRequiresEffectAtSourceTurnEnd is invalid')
  })
})

it('validates the ground-placement contract and rejects incompatible declarations', () => {
  const ground = damageActivity()
  if (ground.target.kind !== 'area') throw Error('fixture')
  ground.target.placementSurface = 'ground'
  expect(validateDnd5eActivityDefinitionV1(ground)).toEqual([])
  expect(validateDnd5eActivityDefinitionV1({ ...ground, target: { ...ground.target, origin: 'self' } })).toContain('activity.target.placementSurface requires ground and point origin')
  expect(validateDnd5eActivityDefinitionV1({ ...ground, target: { ...ground.target, placementSurface: 'water' as 'ground' } })).toContain('activity.target.placementSurface requires ground and point origin')
})

it.each([undefined, 0, 1, 2, -1, 3, 0.5, '0', Number.NaN])('validates selected area minimum without inventing a target cap: %j', minimumTargets => {
  const definition = damageActivity()
  definition.target = { kind: 'area', origin: 'point', shape: 'sphere', relation: 'any', radiusFeet: 10,
    selection: 'choose-any', maximumTargets: 2, minimumTargets } as Dnd5eActivityDefinitionV1['target']
  expect(validateDnd5eActivityDefinitionV1(definition).some(error => error.includes('minimumTargets')))
    .toBe(minimumTargets !== undefined && !(typeof minimumTargets === 'number' && Number.isInteger(minimumTargets) && minimumTargets >= 0 && minimumTargets <= 2))
  if (definition.target.kind === 'area') {
    definition.target.minimumTargets = 1
    definition.target.selection = undefined
    expect(validateDnd5eActivityDefinitionV1(definition).some(error => error.includes('minimumTargets'))).toBe(true)
  }
})


it('restricts deferred effects to personal before-damage reactions',()=>{
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'late',name:'Late',activation:{kind:'reaction'},target:{kind:'self'},
  invocation:{kind:'triggered',event:'before-damage',confirmation:'actor-choice',retention:'single-event'},
  automation:automationCapabilityFromLegacyStatus('full'),effects:[{schemaVersion:1,id:'late',name:'Late',duration:{kind:'rounds',rounds:1,expiresAt:'target-turn-end'},stacking:'replace'}],
  outcomes:[{id:'late',when:{kind:'always'},operations:[{id:'late',kind:'apply-effect',target:'actor',effectId:'late',timing:'after-triggering-damage'}]}]}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 expect(validateDnd5eActivityDefinitionV1({...activity,activation:{kind:'action'}}).join(' ')).toContain('personal before-damage reaction')
 expect(validateDnd5eActivityDefinitionV1({...activity,invocation:undefined}).join(' ')).toContain('personal before-damage reaction')
 expect(validateDnd5eActivityDefinitionV1({...activity,outcomes:[{id:'late',when:{kind:'always'},operations:[{id:'late',kind:'apply-effect',target:'target',effectId:'late',timing:'after-triggering-damage'}]}]}).join(' ')).toContain('personal before-damage reaction')
})
