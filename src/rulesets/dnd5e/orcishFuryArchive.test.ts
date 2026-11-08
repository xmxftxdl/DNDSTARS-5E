import { resolveDnd5eActionWithDamageReactions } from './damageReactionFlow'
import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin, dnd5ePluginFeatureDefinition } from './pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, type Dnd5eAction } from './headlessCombatEngine'
import { createDnd5eWeaponHitSession } from './weaponHitSession'
import { resolveDnd5eWeaponHitActivity } from './activities/dnd5eWeaponHitActivity'
import { createDnd5eRegisteredWeaponHitSession } from './activities/dnd5eRegisteredWeaponHitSession'
import { listDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerWindows'
import { listDnd5eWeaponHitActivities } from './activities/dnd5eWeaponHitDiscovery'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'

const namespace = 'xge.orcish-fury', resourceId = 'xge.orcish-fury:orcish-fury-use'
const activity: Dnd5eActivityDefinitionV1 = {"schemaVersion": 1, "id": "orcish-fury-hit", "name": "兽人狂怒·额外武器骰", "activation": {"kind": "free"}, "invocation": {"kind": "triggered", "event": "attack-hit", "confirmation": "actor-choice", "retention": "single-event"}, "target": {"kind": "creature", "count": 1, "relation": "any"}, "requirements": [{"kind": "attack-weapon-category", "categories": ["simple", "martial"]}], "consumption": [{"kind": "resource", "resourceId": "xge.orcish-fury:orcish-fury-use", "amount": {"kind": "constant", "value": 1}, "consumeOn": "resolve"}], "outcomes": [{"id": "bonus", "when": {"kind": "always"}, "operations": [{"id": "bonus", "kind": "damage", "target": "target", "amount": {"kind": "constant", "value": 0}, "damageType": "inherit-primary", "critical": "double-dice", "weaponDiceFromTrigger": {"rollId": "extra", "count": 1}}]}], "automation": automationCapabilityFromLegacyStatus('full'), "legacySource": {"kind": "feat", "id": "orcish-fury"}}

const featPayload = {"id": "orcish-fury", "name": "兽人狂怒", "summary": "半兽人专长：提升力量或体质，并强化一次武器命中及坚韧不屈后的反应攻击。", "description": "先决条件：半兽人。力量或体质提高1，最高为20。使用简易武器或军用武器命中时，可以额外掷一枚该武器的伤害骰，并以武器的伤害类型造成额外伤害；使用后须完成短休或长休才能再次使用。使用坚韧不屈后，可以立即用反应进行一次武器攻击。", "automation": "full", "prerequisite": {"raceIds": ["half-orc"]}, "resources": [{"id": "orcish-fury-use", "label": "兽人狂怒使用次数", "maximum": 1, "resetOn": "short-rest"}], "advancements": [{"schemaVersion": 1, "id": "orcish-fury-ability", "level": 1, "kind": "select", "label": "兽人狂怒属性提升", "count": 1, "options": [{"id": "str", "label": "力量", "grants": [{"kind": "ability-score", "ability": "str", "amount": 1, "maximumScore": 20}]}, {"id": "con", "label": "体质", "grants": [{"kind": "ability-score", "ability": "con", "amount": 1, "maximumScore": 20}]}]}], "declarativeAbility": {"schemaVersion": 1, "id": "orcish-fury-reaction", "name": "兽人狂怒·反击", "description": "使用坚韧不屈后，立即可以用反应进行一次武器攻击。", "level": 1, "trigger": {"kind": "passive"}, "cost": {"economy": "reaction"}, "targeting": {"kind": "single-creature", "relation": "enemy"}, "effects": [], "mechanic": {"kind": "reaction-weapon-attack", "event": "relentless-endurance"}, "automation": "full"}} as const

const scenarios = [false,true].flatMap(critical=>[{critical,mode:'weapon' as string,automatic:false,count:2,sides:6,attackMode:'melee' as const},{critical,mode:'weapon' as string,automatic:false,count:1,sides:8,attackMode:'ranged' as const}])
it.each(scenarios)('exports, installs and authorizes hit damage (%j)', async ({critical, mode, automatic,count,sides,attackMode}) => {
  const definition = structuredClone(activity)
  if (definition.invocation?.kind === 'triggered' && automatic) definition.invocation.confirmation = 'automatic'
  const operation = definition.outcomes[0].operations[0]
  if (operation.kind !== 'damage') throw Error('expected damage')
  if (mode !== 'weapon') {
    delete operation.weaponDiceFromTrigger
    const halfLevel = { kind: 'floor' as const, value: { kind: 'multiply' as const, values: [
      { kind: 'reference' as const, reference: { kind: 'actor-class-level' as const, classId: 'fighter' } },
      { kind: 'constant' as const, value: 0.5 },
    ] } }
    operation.amount = mode === 'constant' ? halfLevel : { kind: 'add', values: [
      { kind: 'dice', rollId: 'extra', count: 1, sides: 4 },
      ...(mode === 'formula' ? [{ kind: 'dice' as const, rollId: 'other', count: 1, sides: 8 }] : []), halfLevel,
    ] }
  }
  if (mode === 'radiant') operation.damageType = 'radiant'
  if (mode === 'magical') operation.magical = true
  if (mode === 'faces') definition.scaling = [{ basis: 'custom-table', classId: 'fighter',
    table: [{ level: 3, value: 0 }, { level: 5, value: 1 }, { level: 11, value: 2 }],
    adjustments: [{ operationId: 'bonus', diceSidesPerStep: 2 }] }]
  const factor = critical ? 2 : 1
  const bonus = mode === 'weapon' ? 3 * factor : mode === 'formula' ? 6 * factor + 2 : mode === 'constant' ? 2 : 3 * factor + 2
  const expectedHp = 20 - (mode === 'radiant' || mode === 'magical'
    ? Math.floor(3 * factor / 2) + bonus * (mode === 'radiant' ? 2 : 1)
    : Math.floor((3 * count * factor + bonus) / 2))

  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic hit', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feat', id: 'orcish-fury', name: '兽人狂怒',
      automation: activity.automation, activities: [definition], payload: featPayload }],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    expect(dnd5ePluginFeatureDefinition(`${namespace}:feat-orcish-fury`)?.automation).toBe('full')
    const make = (id: string) => createDnd5eCombatant({ id, name: id, initiative: id === 'actor' ? 20 : 10,
      controller: id === 'actor' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
      concentrating: false, position: { x: 0, y: 0 }, classResources: { [resourceId]: { current: 1, max: 1 } } })
    const actor = make('actor'), target = make('target')
    actor.classLevels = { fighter: 5 }
    actor.pluginFeatureIds = [`${namespace}:feat-orcish-fury`]
    target.damageResistances = mode === 'magical' ? [] : ['slashing']
    if (mode === 'magical') target.damageDefenseRules = [{ outcome: 'resistant', damageTypes: ['slashing'], magical: false }]
    if (mode === 'radiant') target.damageVulnerabilities = ['radiant']
    const state = startDnd5eHeadlessCombat('import-hit', [actor, target])
    const original = structuredClone(state)
    const action: Dnd5eAction = { type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 5,
      d20: critical ? 20 : 18, damage: { count, sides, bonus: 0, rolls: Array(count*factor).fill(3), type: 'slashing' },
      classDamageContext: { mode: attackMode, weaponId: attackMode==='melee'?'greatsword':'longbow', weaponCategory: 'martial', weaponDamageSides: sides,
        finesse: false, strengthBased: true, damageType: 'slashing', adjacentEnemyOfTarget: false } }
    const session = createDnd5eWeaponHitSession(state, action, () => true)
    const pending = session.run(state)
    if (pending.status !== 'pending') throw Error('expected hit')
    const input = { state: pending.snapshot, event: pending.event, eventBatchId: 'import-hit', combatRevision: 1,
      packageId: namespace, packageVersion: '1.0.0', activityId: 'orcish-fury-hit',
      authoritativeRolls: Object.fromEntries((mode === 'constant' ? [] : mode === 'formula' ? ['extra', 'other'] : ['extra']).map(id => [id, { values: critical ? [3, 3] : [3] }])) }
    const snapshotBeforeDiscovery = structuredClone(pending.snapshot)
    const offers = listDnd5eWeaponHitActivities(input)
    expect(offers).toHaveLength(1)
    expect(offers[0].rolls).toEqual(mode === 'constant' ? [] : mode === 'formula'
      ? [{ id: 'extra', count: factor, sides: 4 }, { id: 'other', count: factor, sides: 8 }]
      : [{ id: 'extra', count: factor, sides: mode === 'weapon' ? sides : mode === 'faces' ? 6 : 4 }])
    expect(pending.snapshot).toEqual(snapshotBeforeDiscovery)
    for (const boundary of ['missing-category'] as const) {
      const changedState=structuredClone(pending.snapshot),changedEvent=structuredClone(pending.event)
      
      if(boundary==='missing-category')delete changedEvent.weaponCategory
      expect(listDnd5eWeaponHitActivities({...input,state:changedState,event:changedEvent})).toEqual([])
    }
    const exhausted = structuredClone(pending.snapshot); exhausted.combatants.actor.classResources[resourceId].current = 0
    expect(listDnd5eWeaponHitActivities({ ...input, state: exhausted })).toEqual([])
    expect(resolveDnd5eWeaponHitActivity({ ...input, state: exhausted })).toMatchObject({ ok: false, reason: 'weapon-hit-resource-unavailable' })
    expect(listDnd5eWeaponHitActivities({ ...input, event: { ...pending.event, hit: false } })).toEqual([])
    // Spell hits are supported by the shared adapter, but cannot satisfy this weapon-only Activity's trigger.
    expect(resolveDnd5eWeaponHitActivity({ ...input, event: { ...pending.event, attackCategory: 'spell' } })).toMatchObject({ ok: false, reason: 'trigger-mismatch' })
    expect(listDnd5eWeaponHitActivities({ ...input, event: { ...pending.event, attackCategory: 'spell' } })).toEqual([])
    expect(resolveDnd5eWeaponHitActivity({ ...input, packageVersion: '2.0.0' })).toMatchObject({ ok: false, reason: 'content-version-mismatch' })
    expect(resolveDnd5eWeaponHitActivity({ ...input, expectedDefinitionSignature: 'stale' })).toMatchObject({ ok: false, reason: 'weapon-hit-activity-changed' })
    const unowned = structuredClone(pending.snapshot); unowned.combatants.actor.pluginFeatureIds = []
    expect(resolveDnd5eWeaponHitActivity({ ...input, state: unowned })).toMatchObject({ ok: false, reason: 'weapon-hit-activity-not-owned' })
    expect(resolveDnd5eWeaponHitActivity({ ...input, authoritativeRolls: { extra: { values: [sides+1] } } })).toMatchObject({ ok: false })
    expect(resolveDnd5eWeaponHitActivity({ ...input, authoritativeRolls: { ...input.authoritativeRolls, injected: { values: [6] } } })).toMatchObject({ ok: false, reason: 'invalid-rolls' })
    const selected = resolveDnd5eWeaponHitActivity(input)
    expect(selected.ok, JSON.stringify(selected)).toBe(true)
    if (!selected.ok) throw Error(selected.reason)
    expect(selected.decision.usageKeys).toEqual([])
    expect(selected.decision.resourceCosts).toEqual([{ resourceId, amount: 1 }])
    const resolved = session.resume(state, pending.event, pending.index, selected.decision)
    if (resolved.status !== 'resolved') throw Error('expected commit')
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.state.combatants.target.currentHp).toBe(expectedHp)
    expect(resolved.result.state.combatants.actor.classResources[resourceId].current).toBe(0)
    expect(resolved.result.events.filter(event => event.type === 'damage-applied')).toHaveLength(1)
    expect(state).toEqual(original)
    for (const accepted of automatic ? [true] : [false, true]) {
      const wrapped = createDnd5eRegisteredWeaponHitSession({ state, action, combatRevision: 1,
        packageId: namespace, packageVersion: '1.0.0', activityId: 'orcish-fury-hit', eventBatchId: 'wrapped-hit' })
      const offer = wrapped.run(state)
      if (offer.status !== 'pending') throw Error('expected pending offer')
      offer.snapshot.combatants.target.currentHp = 1
      offer.event.weaponDamageDice!.sides = 20
      const finished = wrapped.resume(state, accepted, input.authoritativeRolls)
      if (finished.status !== 'resolved' || !finished.result.ok) throw Error(JSON.stringify(finished))
      expect(finished.result.state.combatants.target.currentHp).toBe(accepted ? expectedHp : 20-Math.floor(3*count*factor/2))
      expect(finished.result.state.combatants.actor.classResources[resourceId].current).toBe(accepted ? 0 : 1)
      expect(finished.result.state.combatants.actor.classState.declarativeUsedTurnKeys?.['import-hit'])
        .toBeUndefined()
      const serialized = JSON.parse(JSON.stringify(finished.result))
      const windows = listDnd5eActivityTriggerWindowsV1({ state: serialized.state, events: serialized.events, eventBatchId: 'after-commit' })
      expect(windows.flatMap(window => window.available).some(entry => entry.packageId === namespace && entry.activity.id === 'orcish-fury-hit')).toBe(false)
      expect(listDnd5eWeaponHitActivities({ state: serialized.state,
        event: serialized.events.find((event: { type: string }) => event.type === 'attack-resolved'), eventBatchId: 'after-commit', combatRevision: 2 })).toEqual([])
      expect(wrapped.resume(state, accepted, input.authoritativeRolls)).toMatchObject({ status: 'rejected' })
    }
    const prompts: string[] = [], diceRequests: { count: number; sides: number }[] = []
    const driven = await resolveDnd5eActionWithDamageReactions({ state, action, combatRevision: 1,
      authorityUnchanged: () => true, confirm: async request => { prompts.push(request.activity.id); return { accepted: true } },
      roll: async request => { diceRequests.push({ count: request.count, sides: request.sides }); return Array(request.count).fill(3) },
    })
    expect(driven.ok).toBe(true)
    expect(prompts).toEqual(automatic ? [] : ['orcish-fury-hit'])
    expect(diceRequests).toEqual(offers[0].rolls.map(({count, sides}) => ({count, sides})))
    expect(driven.state.combatants.target.currentHp).toBe(expectedHp)
    expect(driven.events.filter(event => event.type === 'damage-applied')).toHaveLength(1)
    if (mode === 'radiant') expect(driven.events).toContainEqual(expect.objectContaining({ type: 'damage-applied', damageTypes: expect.arrayContaining(['slashing', 'radiant']) }))
    expect(driven.state.combatants.actor.classResources[resourceId].current).toBe(0)
    expect(state).toEqual(original)
    const changed = createDnd5eRegisteredWeaponHitSession({ state, action, combatRevision: 1,
      packageId: namespace, packageVersion: '1.0.0', activityId: 'orcish-fury-hit', eventBatchId: 'changed-hit' })
    expect(changed.run(state).status).toBe('pending')
    dispose()
    expect(changed.resume(state, true, input.authoritativeRolls)).toEqual({ status: 'rejected', reason: 'changed-definition' })
  } finally { dispose() }
}, 20000)


it('keeps an explicitly manual feat declaration manual after real archive import', async () => {
  const payload = structuredClone(featPayload)
  const bundle: Dnd5eUnifiedContentBundleV1 = {format:'dndstars5e-unified-content',schemaVersion:1,
    manifest:{id:namespace,name:'Manual boundary',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],
    definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feat',id:'orcish-fury',name:payload.name,
      automation:automationCapabilityFromLegacyStatus('manual'),activities:[activity],payload:{...payload,automation:'manual',declarativeAbility:{...payload.declarativeAbility,automation:'manual'}}}]}
  const decoded=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {expect(dnd5ePluginFeatureDefinition(`${namespace}:feat-orcish-fury`)?.automation).toBe('manual')}
  finally {dispose()}
})
