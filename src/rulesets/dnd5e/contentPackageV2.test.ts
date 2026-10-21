import { describe, expect, it, vi } from 'vitest'
import * as contentRegistry from '../../domain/content/contentDefinitionRegistry'
import { readFileSync } from 'node:fs'
import type { Character } from '../../types/character'
import { dnd5eItemActionIcon } from '../../lib/dnd5eActionIcons'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import {
  DND5E_CONTENT_PACKAGE_FORMAT,
  DND5E_CONTENT_PACKAGE_SCHEMA_VERSION,
  buildDnd5eCustomRulesContentPackageV2,
  dnd5eContentPackageAutomationCoverageV2,
  dnd5eContentPackageSummaryV2,
  dnd5eRoomRuntimeProjectionV2,
  dnd5eRulesPluginFromContentPackageV2,
  DND5E_ROOM_RUNTIME_PROJECTION,
  DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER,
  parseDnd5eContentPackageV2,
  resolveDnd5eContentPackageItemReferences,
  type Dnd5eContentPackageV2,
} from './contentPackageV2'
import type { Dnd5eCustomRulesPluginDraft } from './customRulesPlugin'
import { dnd5ePluginImageAssetUrl, registeredDnd5ePluginImageAssets } from './pluginAssets'
import {
  registerDnd5eRulesPlugin,
  dnd5ePluginSpellDefinition,
  dnd5ePluginFeatureDefinition,
  registeredDnd5ePluginFeats,
  registeredDnd5ePluginItems,
  registeredDnd5ePluginRaces,
  dnd5ePluginFeatureRuntimeSourceV1,
} from './pluginApi'
import { dnd5eContentPackageActivityProjectionV1 } from './activities/dnd5eContentPackageActivityProjection'
import { dnd5eContentDefinitionsFromPackageV2 } from './activities/dnd5eContentDefinitionProjection'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './activities/dnd5eActivityRegistry'
import { listRegisteredContentDefinitionPackages } from '../../domain/content/contentDefinitionRegistry'
import { buildDnd5eCustomMonster, createDnd5eCustomMonsterDraft } from './customMonsterWorkshop'
import { applyDnd5eContentBuildChoicesV1 } from './buildChoices'
import type { Dnd5eAdvancementDefinitionV1 } from './activities/dnd5eAdvancementContracts'
import { dnd5eNaturalWeaponProfiles } from './equipment'
import { dnd5ePluginHeadlessActionDefinition } from './plugins/pluginHeadlessRuntimeRegistry'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { DND5E_GRANTED_SPELL_AUTHORING_EXAMPLE } from './activities/dnd5eGrantedSpellAuthoringExample'
import { dnd5ePluginSpellActivity, dnd5ePluginSpellAutomationSupported, dnd5ePluginSpellHasFullHeadlessAutomation } from './pluginSpellTransaction'

it('registers subclass-owned passives after their source and still rejects invalid ownership', () => {
  for (const source of ['valid', 'missing', 'wrong-class']) {
    const pkg = packageValue()
    pkg.content.subclasses = [{ schemaVersion: 1, id: 'passive-owner', classId: 'fighter',
      name: 'Passive owner', summary: 'Synthetic', resources: [], abilities: [{
        schemaVersion: 1, id: 'reference', name: 'Reference', description: 'Synthetic', level: 3,
        trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [], automation: 'manual',
      }] }]
    pkg.content.features = [...pkg.content.features, { id: 'owned-passive', name: 'Owned passive', summary: 'Synthetic',
      description: 'Synthetic', automation: 'full', minimumLevel: 7, grantedBySubclass: true,
      sourceClassId: source === 'wrong-class' ? 'wizard' : 'fighter',
      sourceSubclassId: `${pkg.manifest.id}:${source === 'missing' ? 'missing' : 'passive-owner'}`,
      staticModifiers: { skillCheckAbilityBonuses: [{ skill: 'persuasion', ability: 'cha', bonusAbility: 'wis' }] },
    }]
    const register = () => registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
    if (source !== 'valid') {
      expect(register).toThrow('Invalid plugin subclass feature source')
      expect(dnd5ePluginFeatureDefinition(`${pkg.manifest.id}:owned-passive`)).toBeUndefined()
      continue
    }
    const dispose = register()
    try {
      expect(dnd5ePluginFeatureDefinition(`${pkg.manifest.id}:owned-passive`)).toMatchObject({
        minimumLevel: 7, grantedBySubclass: true, sourceClassId: 'fighter',
      })
    } finally { dispose() }
    expect(dnd5ePluginFeatureDefinition(`${pkg.manifest.id}:owned-passive`)).toBeUndefined()
  }
})

it('indexes feature controls once per registry revision and isolates returned activities', async () => {
  const {dnd5eFeatureActivityControls} = await import('./activities/dnd5eFeatureActivityControls')
  const pkg = packageValue()
  pkg.content.subclasses = [{schemaVersion: 1, id: 'indexed', classId: 'fighter', name: 'Indexed', summary: 'Synthetic', resources: [],
    abilities: ['first','second'].map(id => ({schemaVersion: 1, id, name: id, description: 'Synthetic', level: 3,
      trigger: {kind: 'active-use'}, targeting: {kind: 'self'}, effects: [], automation: 'manual'})),
  }]
  pkg.content.activities = ['first','second'].map(id => ({schemaVersion: 1, id, name: id,
    activation: {kind: 'action'}, target: {kind: 'self'}, legacySource: {kind: 'subclass-ability', id: `indexed:${id}`},
    automation: automationCapabilityFromLegacyStatus('full'),
    outcomes: [{id: 'heal', when: {kind: 'always'}, operations: [{id:'heal',kind:'healing',target:'actor',amount:{kind:'constant',value:1}}]}],
  }))
  const listed = vi.spyOn(contentRegistry, 'listRegisteredContentActivities')
  let dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const first = dnd5ePluginFeatureDefinition(`${pkg.manifest.id}:indexed.first`)!
    const second = dnd5ePluginFeatureDefinition(`${pkg.manifest.id}:indexed.second`)!
    listed.mockClear()
    const original = dnd5eFeatureActivityControls(first)
    expect(original.map(c=>c.activity.id)).toEqual(['first'])
    original[0].activity.name = 'mutated caller copy'
    expect(dnd5eFeatureActivityControls(second).map(c=>c.activity.id)).toEqual(['second'])
    expect(dnd5eFeatureActivityControls(first)[0].activity.name).toBe('first')
    expect(listed).toHaveBeenCalledTimes(1)
    dispose()
    expect(dnd5eFeatureActivityControls(first)).toEqual([])
    pkg.content.activities = pkg.content.activities.map(activity => ({...activity,name:`new ${activity.name}`}))
    dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
    expect(dnd5eFeatureActivityControls(dnd5ePluginFeatureDefinition(first.id)!)[0].activity.name).toBe('new first')
  } finally {dispose();listed.mockRestore()}
})

it('reports explicit subclass Activities without promoting unbound summaries or hiding manual branches', () => {
  const pkg = packageValue()
  pkg.content.subclasses = ['native', 'unbound'].map(id => ({
    schemaVersion: 1, id, classId: 'fighter', name: id, summary: 'Synthetic', resources: [],
    abilities: [{schemaVersion: 1, id: 'gift', name: 'Gift', description: 'Synthetic', level: 3,
      trigger: {kind: 'active-use'}, targeting: {kind: 'self'}, effects: [], automation: 'manual'}],
  }))
  pkg.content.activities = [{schemaVersion: 1, id: 'gift-native', name: 'Native gift',
    activation: {kind: 'action'}, target: {kind: 'self'},
    legacySource: {kind: 'subclass-ability', id: 'native:gift'},
    automation: automationCapabilityFromLegacyStatus('full'),
    outcomes: [{id: 'heal', when: {kind: 'always'}, operations: [
      {id: 'heal', kind: 'healing', target: 'actor', amount: {kind: 'constant', value: 1}},
    ]}],
  }]
  const entries = () => dnd5eContentPackageAutomationCoverageV2(pkg).entries
    .filter(entry => entry.category === 'subclass-ability')
  expect(entries()).toEqual([
    expect.objectContaining({id: 'native:gift', status: 'full'}),
    expect.objectContaining({id: 'unbound:gift', status: 'manual'}),
  ])
  expect(entries()[0].reasons).toBeUndefined()
  const assertRuntime = (expected: 'full' | 'partial') => {
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
    try {
      const bound = dnd5ePluginFeatureDefinition(`${pkg.manifest.id}:native.gift`)!
      expect(bound.automation).toBe(expected)
      expect(bound.declarativeAbility?.automation).toBe('manual')
      if (expected === 'full') expect(bound.automationReasons).toEqual([])
      expect(dnd5ePluginFeatureDefinition(`${pkg.manifest.id}:unbound.gift`)?.automation).toBe('manual')
    } finally { dispose() }
  }
  assertRuntime('full')
  pkg.content.activities = [...pkg.content.activities, {...pkg.content.activities[0], id: 'gift-manual',
    automation: automationCapabilityFromLegacyStatus('manual'),
    outcomes: [{id: 'manual', when: {kind: 'always'}, operations: [
      {id: 'manual', kind: 'manual-adjudication', prompt: 'Choose an outcome', reason: 'Synthetic manual branch', requiresDmApproval: true},
    ]}],
  }]
  expect(entries()[0]).toMatchObject({id: 'native:gift', status: 'partial'})
  expect(entries()[1]).toMatchObject({id: 'unbound:gift', status: 'manual'})
  assertRuntime('partial')
})

it.each(['short-rest-started', 'long-rest-started', 'short-rest-complete', 'long-rest-complete'] as const)(
  'preserves a native subclass %s control through legacy archive import', async event => {
    const { exportLegacyDnd5eStarMod, readLegacyDnd5eStarMod } = await import('./starModAdapter')
    const { dnd5eFeatureActivityControls } = await import('./activities/dnd5eFeatureActivityControls')
    const pkg = packageValue()
    pkg.content.subclasses = [{ schemaVersion: 1, id: 'rest-choice', classId: 'fighter', name: 'Rest choice', summary: 'Synthetic', resources: [],
      abilities: [{ schemaVersion: 1, id: 'gift', name: 'Gift', description: 'Synthetic', level: 3, trigger: { kind: 'long-rest-complete' },
        cost: { economy: 'none' }, targeting: { kind: 'self' }, rolls: [], effects: [], automation: 'manual' }] }]
    pkg.content.activities = [{ schemaVersion: 1, id: 'rest-choice', name: 'Rest choice', activation: { kind: 'free' }, target: { kind: 'self' },
      legacySource: { kind: 'subclass-ability', id: 'rest-choice:gift' }, automation: automationCapabilityFromLegacyStatus('full'),
      invocation: { kind: 'triggered', event, confirmation: 'actor-choice', retention: 'single-event' },
      outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 1 } }] }] }]
    const imported = await readLegacyDnd5eStarMod(await exportLegacyDnd5eStarMod(pkg))
    expect(imported).toBeDefined()
    if (!imported) throw Error('rest choice archive failed to import')
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(imported.package))
    try {
      const feature = dnd5ePluginFeatureDefinition(`${pkg.manifest.id}:rest-choice.gift`)!
      expect(dnd5ePluginHeadlessActionDefinition(pkg.manifest.id, 'rest-choice')).toBeDefined()
      expect(dnd5eFeatureActivityControls(feature).map(control => control.activity.invocation)).toEqual([pkg.content.activities[0].invocation])
    } finally { dispose() }
  })

it.each(['cast-first', 'grant-first', 'grant-only'] as const)('does not select an effect-only follow-up as the spell casting entry (%s)', order => {
  const source = packageValue()
  const [cast, follow] = structuredClone([...DND5E_GRANTED_SPELL_AUTHORING_EXAMPLE])
  source.content.activities = order === 'cast-first' ? [cast, follow] : order === 'grant-first' ? [follow, cast] : [follow]
  source.content.spells = [{ id: 'example-granted-spell', name: 'Synthetic grant', level: 0, school: 'transmutation', ritual: false,
    castingTime: { value: 1, unit: 'action' }, range: { type: 'self' },
    components: { verbal: true, somatic: true, material: false }, duration: { type: 'instantaneous', concentration: false },
    classes: ['wizard'], description: 'Synthetic entry selection test.', automation: { mode: 'reference-only' } }]
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(source))
  try {
    expect(dnd5ePluginSpellDefinition(source.manifest.id + ':example-granted-spell')?.automation).toEqual(
      order === 'grant-only' ? { mode: 'reference-only' } : { mode: 'headless-action', actionId: 'example-cast' })
    expect(getRegisteredDnd5eActivity(source.manifest.id, follow.id)?.requiresEffectGrant).toBe(true)
    const registered = dnd5ePluginSpellDefinition(source.manifest.id + ':example-granted-spell')
    if (!registered) throw new Error('Missing synthetic spell')
    expect(dnd5ePluginSpellActivity({ ...registered, automation: { mode: 'headless-action', actionId: follow.id } })).toBeUndefined()
    const legacyFallback = { ...registered, automation: { mode: 'headless-action' as const, actionId: follow.id },
      mechanics: { kind: 'damage' as const, resolution: 'automatic' as const, damage: { dice: { count: 1, sides: 6, bonus: 0 }, type: 'force' as const } } }
    expect(dnd5ePluginSpellAutomationSupported(legacyFallback)).toBe(false)
    expect(dnd5ePluginSpellHasFullHeadlessAutomation(legacyFallback)).toBe(false)
  } finally { dispose() }
})

const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

it.each(['heal', 'empty-area'] as const)('spends a qualified independent feature resource through the compiled player action (%s)', async effect => {
  const { normalizeCharacter } = await import('../../store/characters')
  const { syncCharacterClassResources } = await import('../../lib/classResources')
  const { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } = await import('./pluginFeatureAction')
  const pkg = packageValue(), featureId = `${pkg.manifest.id}:limited`, resourceId = `${pkg.manifest.id}:use`
  pkg.content.features = [{id:'limited',name:'Limited',summary:'Synthetic',description:'Synthetic',automation:'full',classRequirements:[{classId:'warlock',minimumLevel:5}],resources:[{id:'use',label:'Use',maximum:1,resetOn:'short-rest'}]}]
  pkg.content.activities = [{schemaVersion:1,id:'limited',name:'Limited',activation:{kind:'free'},target:{kind:'self'},legacySource:{kind:'feature',id:'limited'},automation:automationCapabilityFromLegacyStatus('full'),consumption:[{kind:'resource',resourceId:'use',amount:{kind:'constant',value:1},consumeOn:'resolve'}],outcomes:[{id:'heal',when:{kind:'always'},operations:[{id:'heal',kind:'healing',target:'actor',amount:{kind:'constant',value:2}}]}]}]
  if (effect === 'empty-area') {
    pkg.content.activities[0].target={kind:'area',origin:'self',shape:'sphere',radiusFeet:5,relation:'any',includeSelf:false}
    pkg.content.activities[0].outcomes=[{id:'area',when:{kind:'always'},operations:[{id:'area',kind:'create-persistent-area',label:'Synthetic aura',durationRounds:10,concentration:false,anchorMode:'source-token',triggers:[{id:'tick',label:'Tick',timing:'turn-start',oncePerTurn:true,damage:{count:0,sides:6,type:'poison',modifier:1}}]}]}]
  }
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const owner = syncCharacterClassResources(normalizeCharacter({id:'hero',name:'Hero',charClass:'邪术师',level:5,maxHp:20,currentHp:10,dnd5ePluginFeatureIds:[featureId]}))
    const map:import('../../store/maps').BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[{id:'hero-token',characterId:'hero',label:'Hero',x:25,y:25,type:'player',size:1,color:'#fff',emoji:'H'}]}
    for (const mode of ['valid','empty','unowned','low-level'] as const) {
      const actor = {...owner,...(mode==='empty'?{classResources:{...owner.classResources,[resourceId]:{current:0,max:1}}}:mode==='unowned'?{dnd5ePluginFeatureIds:[]}:mode==='low-level'?{level:4,dnd5eClassLevels:{warlock:4}}: {})}
      const prepared = prepareDnd5ePluginFeatureAction({map,characters:[actor],initiativeOrder:[{tokenId:'hero-token',label:'Hero',roll:20,color:'#fff',emoji:'H'}],action:{id:mode,mapId:'map',sourceMode:'player',status:'pending',type:'dnd5e-plugin-action',actorTokenId:'hero-token',characterId:'hero',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5ePluginAction:{featureId}}})
      if (!prepared.ok) { expect(mode,prepared.reason).not.toBe('valid'); continue }
      const resolved = await resolvePreparedDnd5ePluginFeatureAction({prepared:prepared.prepared})
      expect(resolved.result.ok,JSON.stringify({mode,result:resolved.result.ok?'ok':resolved.result.reason})).toBe(mode==='valid')
      if (resolved.result.ok) {
        expect(resolved.application!.characters[0].classResources![resourceId].current).toBe(0)
        expect(resolved.application!.characters[0].currentHp).toBe(effect==='heal'?12:10)
        if(effect==='empty-area')expect(resolved.result.activityHandoffs).toBeDefined()
      }
    }
    expect(pkg.content.activities[0].consumption![0]).toMatchObject({resourceId:'use'})
  } finally { dispose() }
})

it.each(['full','manual'] as const)('imports a native subclass rest Activity under a %s parent and settles its own recipe', async (parentAutomation) => {
  const { normalizeCharacter } = await import('../../store/characters')
  const { reconcileDnd5eCharacterCampaignTime } = await import('./campaignTimeRules')
  const { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } = await import('./pluginFeatureAction')
  const { dnd5eSpellAuthorityResolutionContext } = await import('../../pages/maps/spellSettlementCoordinator')
  const { dnd5eFeatureActivityControls } = await import('./activities/dnd5eFeatureActivityControls')
  const pkg = packageValue(), subclassId = `${pkg.manifest.id}:rest-guard`, featureId = `${subclassId}.gift`
  pkg.content.subclasses = [{schemaVersion:1,id:'rest-guard',classId:'fighter',name:'Rest guard',summary:'Test',resources:[],abilities:[{
    schemaVersion:1,id:'gift',name:'Gift',description:'Test',level:3,trigger:{kind:'long-rest-complete'},cost:{economy:'none'},targeting:{kind:'self'},
    rolls:parentAutomation==='full'?[{id:'old-heal',kind:'healing',label:'Old dice',dice:{count:1,sides:6}}]:[],effects:parentAutomation==='full'?[{kind:'healing',target:'actor',rollId:'old-heal'}]:[],automation:parentAutomation,
  }]}]
  pkg.content.activities = [{schemaVersion:1,id:'native-rest',name:'Native rest',activation:{kind:'free'},target:{kind:'self'},
    invocation:{kind:'triggered',event:'long-rest-complete',confirmation:'actor-choice',retention:'single-event'},
    legacySource:{kind:'subclass-ability',id:'rest-guard:gift'},automation:automationCapabilityFromLegacyStatus('full'),
    outcomes:[{id:'heal',when:{kind:'always'},operations:[{id:'heal',kind:'healing',target:'actor',amount:{kind:'constant',value:4}}]}]}]
  const parsed = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(pkg)).buffer)!
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(parsed))
  try {
    expect(dnd5eFeatureActivityControls(dnd5ePluginFeatureDefinition(featureId)!).map(entry=>entry.activity.id)).toEqual(['native-rest'])
    const clock:import('../../lib/campaignTime').SharedCampaignTimeState={schemaVersion:2,worldMinute:480,displayMode:'campaign-day',displayMinuteOffset:0,timers:[],updatedAt:1,advances:[{id:'rest-480',kind:'long-rest',fromWorldMinute:0,toWorldMinute:480,minutes:480,reason:'Test',dawnsCrossed:0,expiredTimerIds:[],createdAt:1,beneficiaryCharacterIds:['hero']}]}
    const source=normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',level:3,maxHp:20,currentHp:20,dnd5eWorldTimeAppliedMinute:0,dnd5eClassChoices:{fighter:{subclass:subclassId,fightingStyles:[]}}})
    const owner={...reconcileDnd5eCharacterCampaignTime(source,clock).character,currentHp:5}
    const map:import('../../store/maps').BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[{id:'hero-token',characterId:'hero',label:'Hero',x:25,y:25,type:'player',size:1,color:'#fff',emoji:'H'}]}
    const authority=dnd5eSpellAuthorityResolutionContext({combatActive:false,map,actorTokenId:'hero-token',initiativeOrder:[]})
    const prepare=(character=owner)=>prepareDnd5ePluginFeatureAction({map,characters:[character],initiativeOrder:authority.initiativeOrder,
      action:{id:'native-rest-request',mapId:map.id,sourceMode:'player',status:'pending',type:'dnd5e-plugin-action',actorTokenId:'hero-token',characterId:'hero',targetTokenId:'hero-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5ePluginAction:{featureId,payload:{selectedActivityId:'native-rest',restEventId:owner.dnd5eRestActivityWindow!.eventId}}}})
    expect(prepare({...owner,level:2,dnd5eClassLevels:{fighter:2}})).toMatchObject({ok:false})
    expect(prepare({...owner,dnd5eClassChoices:{fighter:{subclass:'champion',fightingStyles:[]}}})).toMatchObject({ok:false})
    const prepared=prepare()
    expect(prepared.ok,JSON.stringify(prepared)).toBe(true)
    if(!prepared.ok)throw Error('native subclass preparation failed')
    expect(prepared.prepared.feature.declarativeAbility).toBeUndefined()
    const resolved=await resolvePreparedDnd5ePluginFeatureAction({prepared:prepared.prepared,restAuthority:{clock,combatRevision:1}})
    expect(resolved.result.ok,JSON.stringify(resolved.result)).toBe(true)
    const committed=resolved.application!.characters.find(character=>character.id==='hero')!
    expect(committed.currentHp).toBe(9)
    expect(committed.dnd5eRestActivityWindow?.receipts).toEqual({[JSON.stringify([pkg.manifest.id,'native-rest'])]:'used'})
    const replay=prepare(committed)
    if(!replay.ok)throw Error('replay prepare failed')
    expect((await resolvePreparedDnd5ePluginFeatureAction({prepared:replay.prepared,restAuthority:{clock,combatRevision:2}})).result.ok).toBe(false)
  }finally{dispose()}
})

it.each(['owned', 'effect', 'monster'] as const)('projects ability-scaled feature targets consistently into controls and Host preparation (%s)', async grantKind => {
  const { normalizeCharacter } = await import('../../store/characters')
  const { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } = await import('./pluginFeatureAction')
  const { dnd5eFeatureActivityControls } = await import('./activities/dnd5eFeatureActivityControls')
  const pkg = packageValue()
  pkg.content.features = [{ id: 'gift', name: 'Gift', summary: 'Test', description: 'Test', automation: 'full' }]
  pkg.content.activities = [{ schemaVersion: 1, id: 'gift', name: 'Gift', activation: { kind: 'free' },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 },
    legacySource: { kind: 'feature', id: 'gift' }, automation: automationCapabilityFromLegacyStatus('full'),
    scaling: [{ basis: 'ability-modifier', ability: 'cha', baseLevel: 1, adjustments: [{ operationId: 'heal', additionalTargetsPerStep: 1 }] }],
    outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'target', amount: { kind: 'constant', value: 2 } }] }],
  }]
  const parsed = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(pkg)).buffer)!
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(parsed))
  try {
    const featureId = `${pkg.manifest.id}:${grantKind !== 'owned' ? 'effect-control.' : ''}gift`
    const { createDnd5eMechanicalEffect } = await import('./activeEffects')
    const hero = normalizeCharacter({ id: 'hero', name: 'Hero', currentHp: 5, maxHp: 20, level: 1,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 }, dnd5ePluginFeatureIds: grantKind === 'owned' ? [featureId] : [],
      ...(grantKind !== 'owned' ? { dnd5eCombatState: { activeEffects: [createDnd5eMechanicalEffect({ id: 'gift-grant', definitionId: 'gift-grant', label: 'Grant', targetId: 'hero',
        source: { kind: 'plugin', actorId: 'hero', rulesId: 'gift-grant', pluginId: pkg.manifest.id }, duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' }, grantedActivities: ['gift'] })] } } : {}) })
    const allies = Array.from({ length: 4 }, (_, i) => normalizeCharacter({ id: `ally-${i}`, name: `Ally ${i}`, currentHp: 5, maxHp: 20 }))
    const characters = grantKind === 'monster' ? allies : [hero, ...allies]
    const map: import('../../store/maps').BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
      tokens: [hero, ...allies].map((c, i) => ({ id: c.id, characterId: c.id, label: c.name, x: 25 + i * 50, y: 25, type: 'player', size: 1, color: '#fff', emoji: '' })) }
    if (grantKind === 'monster') map.tokens[0] = { ...map.tokens[0], characterId: undefined, type: 'enemy', poolId: 'srd-5.1:noble', hp: 5, maxHp: 20, dnd5eCombatState: hero.dnd5eCombatState }
    const controls = dnd5eFeatureActivityControls(dnd5ePluginFeatureDefinition(featureId)!, { actor: { level: 1, proficiencyBonus: 2, abilities: hero.abilities } })
    if (grantKind === 'owned') expect(controls[0].action.targeting).toMatchObject({ kind: 'multiple-creatures', maximumTargets: 3 })
    const prepare = (count: number) => prepareDnd5ePluginFeatureAction({ map, characters,
      initiativeOrder: map.tokens.map((t,i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20-i })),
      action: { id: 'gift-request', mapId: map.id, sourceMode: grantKind === 'monster' ? 'dm' : 'player', status: 'pending', type: 'dnd5e-plugin-action', actorTokenId: hero.id, characterId: grantKind === 'monster' ? 'dm-token:hero' : hero.id,
        targetTokenId: allies[0].id, targetTokenIds: allies.slice(0, count).map(c => c.id), round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
        dnd5ePluginAction: { featureId, payload: grantKind === 'owned' ? { selectedActivityId: 'gift' } : { activeEffectId: 'gift-grant' } } } })
    expect(prepare(4)).toMatchObject({ ok: false, reason: 'invalid-target' })
    const prepared = prepare(3)
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) throw Error('scaled feature failed preparation')
    expect(prepared.prepared.state.combatants.hero.abilities.cha).toBe(16)
    const { resolveDnd5eHeadlessAction } = await import('./headlessCombatEngine')
    const forged = resolveDnd5eHeadlessAction(prepared.prepared.state, { ...prepared.prepared.headlessAction, targetIds: allies.map(c => c.id) })
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-target' })
    const result = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
    expect(result.result.ok, JSON.stringify(result.result)).toBe(true)
    expect(result.application?.characters.filter(c => c.id !== 'hero').map(c => c.currentHp)).toEqual([7,7,7,5])
    expect(pkg.content.activities[0].target).toMatchObject({ count: 1 })
    if (grantKind !== 'owned') {
      if (grantKind === 'monster') map.tokens[0].dnd5eCombatState = undefined
      else hero.dnd5eCombatState = undefined
      expect(prepare(3).ok).toBe(false)
    }
  } finally { dispose() }
})

it('keeps standalone subclass-granted feature controls in the feature source namespace', async () => {
  const { dnd5eFeatureActivityControls } = await import('./activities/dnd5eFeatureActivityControls')
  const pkg = packageValue()
  pkg.content.subclasses = [{ schemaVersion: 1, id: 'school', classId: 'monk', name: 'School', summary: 'Synthetic', resources: [], abilities: [{ schemaVersion: 1, id: 'summary', name: 'Summary', description: 'Synthetic', level: 3, trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [], automation: 'manual' }] }]
  pkg.content.features = [{ id: 'owned', name: 'Owned', summary: 'Synthetic', description: 'Synthetic', automation: 'full',
    sourceClassId: 'monk', sourceSubclassId: pkg.manifest.id + ':school', grantedBySubclass: true, minimumLevel: 3 }]
  pkg.content.activities = ['main','follow-up','foreign'].map(id => ({
    schemaVersion: 1, id, name: id, activation: { kind: 'free' }, target: { kind: 'self' },
    legacySource: { kind: 'feature', id: id === 'foreign' ? 'other' : 'owned' }, automation: automationCapabilityFromLegacyStatus('full'),
    outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 1 } }] }],
  }))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const feature = dnd5ePluginFeatureDefinition(pkg.manifest.id + ':owned')!
    expect(feature.sourceSubclassId).toBe(pkg.manifest.id + ':school')
    expect(feature.declarativeAbility).toBeUndefined()
    expect(dnd5eFeatureActivityControls(feature).map(control => control.activity.id)).toEqual(['main','follow-up'])
  } finally { dispose() }
})

it('imports every Activity for one feature and authorizes the selected recipe without granting unrelated controls', async () => {
  const { normalizeCharacter } = await import('../../store/characters')
  const { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } = await import('./pluginFeatureAction')
  const { dnd5eSpellAuthorityResolutionContext } = await import('../../pages/maps/spellSettlementCoordinator')
  const { dnd5eFeatureActivityControls } = await import('./activities/dnd5eFeatureActivityControls')
  const pkg = packageValue()
  pkg.content.features = [{ id: 'gift', name: 'Gift', summary: 'Test', description: 'Test', automation: 'full' }, { id: 'other', name: 'Other', summary: 'Other', description: 'Other', automation: 'full' }]
  pkg.content.activities = ['first','second','foreign','listener'].map((id,index) => ({
    schemaVersion: 1, id, name: id, activation: id === 'second' ? { kind: 'action', cost: 1 } : { kind: 'free' }, target: { kind: 'self' },
    ...(id === 'listener' ? { invocation: { kind: 'triggered' as const, event: 'attack-resolved' as const, confirmation: 'actor-choice' as const } } : {}),
    legacySource: { kind: 'feature', id: id === 'foreign' ? 'other' : 'gift' }, automation: automationCapabilityFromLegacyStatus('full'),
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: index + 1 } }] }],
  }))
  const parsed = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(pkg)).buffer)!
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(parsed))
  try {
    const featureId = `${pkg.manifest.id}:gift`
    expect(dnd5eFeatureActivityControls(dnd5ePluginFeatureDefinition(featureId)!).map(entry => entry.activity.id)).toEqual(['first','second'])
    expect(dnd5ePluginHeadlessActionDefinition(pkg.manifest.id,'second')).toBeDefined()
    const hero = normalizeCharacter({ id:'hero',name:'Hero',currentHp:5,maxHp:20,charClass:'战士',level:1,dnd5ePluginFeatureIds:[featureId] })
    const map: import('../../store/maps').BattleMap = { id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[{id:'hero-token',characterId:'hero',label:'Hero',x:25,y:25,type:'player',size:1,color:'#fff',emoji:'H'}] }
    const authority = dnd5eSpellAuthorityResolutionContext({combatActive:false,map,actorTokenId:'hero-token',initiativeOrder:[]})
    const prepare = (selectedActivityId:string, owner=hero) => prepareDnd5ePluginFeatureAction({map,characters:[owner],initiativeOrder:authority.initiativeOrder,
      action:{id:'gift-request',mapId:map.id,sourceMode:'player',status:'pending',type:'dnd5e-plugin-action',actorTokenId:'hero-token',characterId:'hero',targetTokenId:'hero-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5ePluginAction:{featureId,payload:{selectedActivityId}}}})
    for (const id of ['foreign','listener','missing']) expect(prepare(id)).toMatchObject({ok:false})
    expect(prepare('second',{...hero,dnd5ePluginFeatureIds:[]})).toMatchObject({ok:false})
    const prepared = prepare('second')
    expect(prepared.ok,JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) throw Error('second Activity preparation failed')
    expect(prepared.prepared.headlessAction.actionId).toBe('second')
    const { resolveDnd5eHeadlessAction } = await import('./headlessCombatEngine')
    expect(resolveDnd5eHeadlessAction(prepared.prepared.state, { ...prepared.prepared.headlessAction, actionId: 'foreign' }).ok).toBe(false)
    const result = await resolvePreparedDnd5ePluginFeatureAction({prepared:prepared.prepared})
    expect(result.result.ok,JSON.stringify(result.result)).toBe(true)
    expect(result.application?.characters.find(entry=>entry.id==='hero')?.currentHp).toBe(7)
    expect(result.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
    expect(hero.currentHp).toBe(5)
  } finally { dispose() }
  expect(dnd5ePluginHeadlessActionDefinition(pkg.manifest.id,'second')).toBeUndefined()
})

it.each(['long-rest-complete', 'short-rest-complete'] as const)('restores a %s feature control when importing a serialized content package', (event) => {
  const pkg = packageValue()
  pkg.content.features = [{ id: 'rest-gift', name: 'Rest gift', summary: 'Test', description: 'Test', automation: 'full' }]
  pkg.content.activities = [{ schemaVersion: 1, id: 'rest-gift', name: 'Rest gift', activation: { kind: 'free' }, target: { kind: 'self' },
    invocation: { kind: 'triggered', event, confirmation: 'actor-choice', retention: 'single-event' },
    legacySource: { kind: 'feature', id: 'rest-gift' }, automation: automationCapabilityFromLegacyStatus('full'),
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 1 } }] }],
  }]
  const parsed = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(pkg)).buffer)
  expect(parsed).toBeDefined()
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(parsed!))
  try {
    expect(dnd5ePluginFeatureDefinition(`${pkg.manifest.id}:rest-gift`)?.action).toMatchObject({ id: 'rest-gift', economy: 'none' })
    expect(getRegisteredDnd5eActivity(pkg.manifest.id, 'rest-gift')?.invocation).toMatchObject({ event })
    const compiled = dnd5ePluginHeadlessActionDefinition(pkg.manifest.id, 'rest-gift')!
    expect(compiled).toBeDefined()
    if (!compiled.resolve) throw Error('Expected compiled rest control')
    expect(compiled.resolve({ fail: (reason: string) => ({ rejected: reason }) } as never)).toEqual({ rejected: 'invalid-plugin-action' })
  } finally { dispose() }
})

it.each(['immediate', 'completion'] as const)('registers and disposes custom effect-granted Headless activities (%s)', timing => {
  const pkg = packageValue()
  const base = { schemaVersion: 1 as const, activation: { kind: 'free' as const },
    target: { kind: 'self' as const }, automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'feat' as const, id: pkg.content.feats[0].id } }
  pkg.content.activities = [
    { ...base, id: 'source', name: 'Source', effects: [{ schemaVersion: 1, id: 'grant', name: 'Grant',
      duration: { kind: 'rounds', rounds: 10, expiresAt: 'source-turn-end' }, stacking: 'replace', grants: ['follow-up', 'listener'] }],
      outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'grant' }] }] },
    { ...base, id: 'follow-up', name: 'Follow-up', outcomes: [{ id: 'benefit', when: { kind: 'always' },
      operations: [{ id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 1 } }] }] },
    { ...base, id: 'listener', name: 'Listener', invocation: { kind: 'triggered', event: 'attack-resolved', confirmation: 'actor-choice' },
      outcomes: [{ id: 'benefit', when: { kind: 'always' }, operations: [{ id: 'heal', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 1 } }] }] },
  ]
  if (timing === 'completion') {
    const effect = pkg.content.activities![0].effects![0]
    effect.completionGrant = { activityIds: effect.grants!, availableRounds: 10, recipient: 'source', bindTarget: 'bearer', singleUse: true }
    pkg.content.activities!.slice(1).forEach(activity => { activity.requiresEffectGrant = true })
    delete effect.grants
  } else {
    pkg.content.activities![0].effects![0].grantsSingleUse = true
  }
  const parsed = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(pkg)).buffer)!
  expect(parsed.content.activities![0].effects![0]).toEqual(pkg.content.activities![0].effects![0])
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(parsed))
  try {
    expect(dnd5ePluginHeadlessActionDefinition(pkg.manifest.id, 'follow-up')).toBeDefined()
    expect(getRegisteredDnd5eActivity(pkg.manifest.id, 'listener')?.invocation?.kind).toBe('triggered')
    expect(dnd5ePluginHeadlessActionDefinition(pkg.manifest.id, 'listener')).toBeUndefined()
  }
  finally { dispose() }
  expect(dnd5ePluginHeadlessActionDefinition(pkg.manifest.id, 'follow-up')).toBeUndefined()
  if (timing === 'completion') {
    const missingGuard = structuredClone(pkg)
    delete missingGuard.content.activities![1].requiresEffectGrant
    expect(() => registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(missingGuard))).toThrow(/requiresEffectGrant/)
  }
  if (timing === 'completion') pkg.content.activities![0].effects![0].completionGrant!.activityIds = ['missing']
  else pkg.content.activities![0].effects![0].grants = ['missing']
  expect(() => registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))).toThrow(/unavailable Activity/)
})

it('registers area-granted assisted actions without removing manual approval', () => {
  const pkg = packageValue()
  const base = { schemaVersion: 1 as const, activation: { kind: 'action' as const, cost: 1 },
    automation: automationCapabilityFromLegacyStatus('full'),
    legacySource: { kind: 'feat' as const, id: pkg.content.feats[0].id } }
  pkg.content.activities = [
    { ...base, id: 'zone', name: 'Zone', target: { kind: 'area', relation: 'any', origin: 'point',
      shape: 'sphere', radiusFeet: 10, placeRangeFeet: 30, maximumTargets: 10, includeSelf: false },
      outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'create', kind: 'create-persistent-area',
        label: 'Zone', durationRounds: 10, concentration: true, grantedActivities: [{ activityId: 'follow-up' }] }] }] },
    { ...base, id: 'follow-up', name: 'Follow-up', target: { kind: 'self' },
      automation: { schemaVersion: 1, level: 'assisted', supportedPhases: [], manualPhases: ['effects'], limitations: ['DM decision'] },
      outcomes: [{ id: 'manual', when: { kind: 'always' }, operations: [{ id: 'manual', kind: 'manual-adjudication',
        prompt: 'Resolve the scene-dependent effect.', reason: 'Requires a scene decision.', requiresDmApproval: true }] }] },
  ]
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    expect(dnd5ePluginHeadlessActionDefinition(pkg.manifest.id, 'follow-up')).toBeDefined()
    expect(getRegisteredDnd5eActivity(pkg.manifest.id, 'follow-up')?.outcomes[0].operations[0])
      .toMatchObject({ kind: 'manual-adjudication', requiresDmApproval: true })
  } finally { dispose() }
  expect(dnd5ePluginHeadlessActionDefinition(pkg.manifest.id, 'follow-up')).toBeUndefined()
  pkg.content.activities[1].invocation = { kind: 'triggered', event: 'attack-resolved', confirmation: 'actor-choice' }
  expect(() => registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))).toThrow(/unavailable Activity/)
})

function packageValue(): Dnd5eContentPackageV2 {
  return {
    format: DND5E_CONTENT_PACKAGE_FORMAT,
    schemaVersion: DND5E_CONTENT_PACKAGE_SCHEMA_VERSION,
    manifest: {
      id: 'com.example.content-v2',
      name: 'Synthetic Content V2',
      version: '1.0.0',
      apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests',
      license: 'CC0-1.0',
      distributionPolicy: 'local-only',
      contentCategory: 'mixed',
    },
    provenance: {
      edition: '2014',
      contentMode: 'incremental',
      sourceTitle: 'Synthetic test data',
    },
    assets: [{ id: 'ember', mediaType: 'image/png', dataBase64: ONE_PIXEL_PNG }],
    content: {
      races: [{
        id: 'emberkin',
        name: 'Emberkin',
        speedFeet: 30,
        size: 'small',
        iconAssetId: 'ember',
        skillProficiencies: ['perception'],
        languages: ['Common'],
        traits: [{ id: 'heat-sight', name: 'Heat Sight', description: 'Synthetic trait.' }],
        staticModifiers: {
          armorClassBonus: 1,
          darkvisionRangeFeet: 60,
          damageResistances: ['fire'],
          conditionImmunities: ['frightened'],
        },
      }],
      backgrounds: [],
      features: [],
      feats: [{
        id: 'steady',
        name: 'Steady',
        summary: 'Synthetic passive feat.',
        description: 'Synthetic passive feat used only by tests.',
        iconAssetId: 'ember',
        prerequisite: { minimumLevel: 4, abilityScores: { dex: 10 } },
        automation: 'full',
        staticModifiers: {
          armorClassBonus: 1,
          initiativeBonus: 2,
          speedBonusFeet: 5,
          savingThrowBonus: 1,
          passivePerceptionBonus: 5,
          cannotBeSurprisedWhileConscious: true,
          unseenAttackersDoNotGainAdvantage: true,
          ignoreLongRangeRangedWeaponDisadvantage: true,
          ignoreNearbyHostileRangedAttackDisadvantage: true,
          ignoreRangedWeaponCoverBonus: true,
          preventOpportunityAttacksFromMeleeAttackTargets: true,
          spellAttackRangeMultiplier: 2,
          ignoreSpellAttackCoverBonus: true,
          damageImmunities: ['poison'],
        },
        passiveEffects: [{
          schemaVersion: 1,
          id: 'damage-reduction',
          kind: 'damage-reduction',
          trigger: 'before-damage',
          amount: 3,
          damageTypes: ['slashing'],
          maximumCurrentHitPointPercent: 50,
          oncePerTurn: true,
        }],
      }],
      spells: [],
      items: [{
        id: 'ember-token',
        name: 'Ember Token',
        category: 'magic-item',
        icon: 'generic',
        iconAssetId: 'ember',
        description: 'Synthetic item.',
        rulesText: 'Synthetic item rules.',
        stackable: true,
      }],
      abilityGenerationMethods: [],
      headlessActions: [],
      subclasses: [],
      monsters: [],
    },
  }
}

function character(): Character {
  return {
    id: 'hero',
    name: 'Hero',
    player: 'P1',
    avatar: '',
    accent: '',
    race: 'Emberkin',
    dnd5eRaceId: 'com.example.content-v2:emberkin',
    charClass: '战士',
    level: 4,
    background: '',
    experience: 0,
    reputation: 0,
    rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 20,
    currentHp: 20,
    tempHp: 0,
    hitDice: '1d10',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5eFeatIds: ['com.example.content-v2:steady'],
  }
}

describe('D&D 5e content package V2', () => {
  it('audits subclass summaries backed by owned executable feature activities', () => {
    const pkg = packageValue()
    pkg.content.features = [{id:'linked',name:'Linked',summary:'Test',description:'Test',automation:'full',
      sourceClassId:'monk',sourceSubclassId:`${pkg.manifest.id}:synthetic`,minimumLevel:3,grantedBySubclass:true}]
    pkg.content.subclasses = [{schemaVersion:1,id:'synthetic',classId:'monk',name:'Synthetic',summary:'Test',
      abilities:[{schemaVersion:1,id:'summary',name:'Summary',description:'Test',level:3,
        trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],automation:'manual',
        passiveImplementationReferences:[{kind:'feature',id:'linked'}]}]}]
    pkg.content.activities = [{schemaVersion:1,id:'linked-action',name:'Linked action',automation:automationCapabilityFromLegacyStatus('full'),
      legacySource:{kind:'feature',id:'linked'},activation:{kind:'action'},target:{kind:'self'},
      outcomes:[{id:'heal',when:{kind:'always'},operations:[{id:'heal',kind:'healing',target:'actor',amount:{kind:'constant',value:1}}]}]}]
    const status=(p=pkg)=>dnd5eContentPackageAutomationCoverageV2(p).entries.find(e=>e.id==='synthetic:summary')!.status
    expect(status()).toBe('full')
    for (const key of ['sourceClassId','sourceSubclassId','minimumLevel','grantedBySubclass'] as const) {
      const invalid=structuredClone(pkg);delete invalid.content.features[0][key];expect(status(invalid),key).toBe('manual')
    }
    const missing=structuredClone(pkg);missing.content.activities=[];expect(status(missing)).toBe('manual')
    const unrelated=structuredClone(pkg);unrelated.content.activities![0].legacySource!.id='other';expect(status(unrelated)).toBe('manual')
    const unknown=structuredClone(pkg);unknown.content.features[0].staticModifiers={speedBonusFeet:10};expect(status(unknown)).toBe('manual')
    const light=structuredClone(pkg);light.content.features[0].staticModifiers={inherentLight:{brightRadiusFeet:30,dimRadiusFeet:30,color:'#ffffff'}};expect(status(light)).toBe('full')
    light.content.features[0].staticModifiers.inherentLight!.brightRadiusFeet=-1;expect(status(light)).toBe('manual')
  })
  it('requires owned executable static features for passive implementation references', () => {
    const pkg = packageValue()
    pkg.content.features = [{id:'courtier',name:'Courtier',summary:'Test',description:'Test',automation:'full',
      sourceClassId:'fighter',sourceSubclassId:`${pkg.manifest.id}:synthetic`,minimumLevel:7,grantedBySubclass:true,
      staticModifiers:{skillCheckAbilityBonuses:[{skill:'persuasion',ability:'cha',bonusAbility:'wis'}]}}]
    pkg.content.subclasses = [{schemaVersion:1,id:'synthetic',classId:'fighter',name:'Synthetic',summary:'Test',
      abilities:[{schemaVersion:1,id:'courtier',name:'Courtier',description:'Test',level:7,
        trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],automation:'manual',
        passiveImplementationReferences:[{kind:'feature',id:'courtier'}]}]}]
    const status=(p=pkg)=>dnd5eContentPackageAutomationCoverageV2(p).entries.find(e=>e.id==='synthetic:courtier')!.status
    expect(status()).toBe('full')
    expect(parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(pkg)).buffer)).toBeTruthy()
    for(const key of ['sourceClassId','sourceSubclassId','minimumLevel','grantedBySubclass','staticModifiers'] as const){
      const invalid=structuredClone(pkg)
      delete invalid.content.features[0][key]
      expect(status(invalid),key).toBe('manual')
    }
    const missing=structuredClone(pkg);missing.content.features=[]
    expect(status(missing)).toBe('manual')
  })

  it('recognizes the owned standing-cost implementation without accepting unrelated modifiers', () => {
    const pkg = packageValue()
    pkg.content.features = [{id:'stand',name:'Stand',summary:'Test',description:'Test',automation:'full',
      sourceClassId:'monk',sourceSubclassId:`${pkg.manifest.id}:synthetic`,minimumLevel:6,grantedBySubclass:true,
      staticModifiers:{standFromProneMovementCostFeet:5}}]
    pkg.content.subclasses = [{schemaVersion:1,id:'synthetic',classId:'monk',name:'Synthetic',summary:'Test',
      abilities:[{schemaVersion:1,id:'stand',name:'Stand',description:'Test',level:6,
        trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],automation:'manual',
        passiveImplementationReferences:[{kind:'feature',id:'stand'}]}]}]
    const status=(p=pkg)=>dnd5eContentPackageAutomationCoverageV2(p).entries.find(e=>e.id==='synthetic:stand')!.status
    expect(status()).toBe('full')
    expect(parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(pkg)).buffer)).toBeTruthy()
    for(const cost of [-1,501,Number.NaN]){
      const invalid=structuredClone(pkg);invalid.content.features[0].staticModifiers={standFromProneMovementCostFeet:cost}
      expect(status(invalid)).toBe('manual')
    }
    for(const key of ['sourceClassId','sourceSubclassId','minimumLevel','grantedBySubclass','staticModifiers'] as const){
      const invalid=structuredClone(pkg);delete invalid.content.features[0][key];expect(status(invalid)).toBe('manual')
    }
    const extra=structuredClone(pkg);extra.content.features[0].staticModifiers={standFromProneMovementCostFeet:5,speedBonusFeet:10}
    expect(status(extra)).toBe('manual')
  })

  it('audits linked passive build and initiative declarations without trusting a full label', () => {
    const pkg = packageValue()
    pkg.content.subclasses = [{schemaVersion:1,id:'archer',classId:'fighter',name:'Synthetic',summary:'Synthetic',
      abilities:[{schemaVersion:1,id:'lore',name:'Lore',description:'Synthetic',level:3,trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],automation:'manual',
        passiveImplementationReferences:[{kind:'advancement',id:'skill'},{kind:'advancement',id:'cantrip'},{kind:'resource',id:'uses'}]},
        {schemaVersion:1,id:'recovery',name:'Recovery',description:'Synthetic',level:15,trigger:{kind:'passive'},targeting:{kind:'self'},effects:[],automation:'manual',
          passiveImplementationReferences:[{kind:'combat-start-resource',id:'uses'}]}],
      advancements:[{schemaVersion:1,id:'skill',level:3,kind:'select',count:1,label:'Skill',options:[{id:'arcana',label:'Arcana',grants:[{kind:'proficiency',category:'skill',id:'arcana'}]}]},
        {schemaVersion:1,id:'cantrip',level:3,kind:'select',count:1,label:'Cantrip',options:[{id:'spell',label:'Spell',grants:[{kind:'spell',spellId:'prestidigitation',mode:'cantrip'}]}]}],
      resources:[{id:'uses',label:'Uses',minimumLevel:3,maximum:{kind:'fixed',value:2},resetOn:'short-rest',combatStartRecovery:{mode:'restore',amount:1,onlyWhenEmpty:true,minimumClassLevel:{classId:'fighter',level:15}}}]}]
    const status=(value= pkg,id='lore')=>dnd5eContentPackageAutomationCoverageV2(value).entries.find(e=>e.id===`archer:${id}`)!.status
    expect(status()).toBe('full');expect(status(pkg,'recovery')).toBe('full')
    expect(parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(pkg)).buffer)!.content.subclasses[0].abilities[0].passiveImplementationReferences).toHaveLength(3)
    for(const change of ['missing','wrong-level','unknown-spell','hidden-condition','wrong-recovery-level','duplicate'] as const){
      const invalid=structuredClone(pkg),sub=invalid.content.subclasses[0]
      if(change==='missing')sub.abilities[0].passiveImplementationReferences=[{kind:'advancement',id:'missing'}]
      if(change==='wrong-level')sub.advancements![0].level=2
      if(change==='unknown-spell')(sub.advancements![1] as any).options[0].grants[0].spellId='missing-spell'
      if(change==='hidden-condition')sub.abilities[0].predicates={subclassChoices:[{groupId:'missing',optionId:'missing'}]}
      if(change==='wrong-recovery-level')sub.resources![0].combatStartRecovery!.minimumClassLevel!.level=14
      if(change==='duplicate'){
        sub.abilities[0].passiveImplementationReferences=[{kind:'advancement',id:'skill'},{kind:'advancement',id:'skill'}]
        expect(()=>parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(invalid)).buffer)).toThrow();continue
      }
      expect(status(invalid,change==='wrong-recovery-level'?'recovery':'lore'),change).toBe('manual')
    }
  })

  it('requires an applied, source-bound and level-matched bonus for passive effect references', () => {
    const pkg = packageValue()
    const summary = { schemaVersion: 1 as const, name: 'Synthetic', description: 'Synthetic',
      trigger: { kind: 'passive' as const }, targeting: { kind: 'self' as const }, effects: [], automation: 'manual' as const }
    pkg.content.subclasses = [{ schemaVersion: 1, id: 'keeper', classId: 'ranger', name: 'Keeper', summary: 'Synthetic',
      abilities: [{ ...summary, id: 'mark', level: 3 }, { ...summary, id: 'defense', level: 7,
        passiveImplementationReferences: [{ kind: 'bound-source-bonus', id: 'mark' }] }] }]
    pkg.content.activities = [{ schemaVersion: 1, id: 'mark', name: 'Synthetic', activation: { kind: 'bonus-action' },
      target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 },
      legacySource: { kind: 'subclass-ability', id: 'keeper:mark' },
      automation: { schemaVersion: 1, level: 'full', supportedPhases: [], manualPhases: [], limitations: [] },
      effects: [{ schemaVersion: 1, id: 'mark', name: 'Synthetic', stacking: 'replace', duration: { kind: 'permanent' },
        modifiers: [{ kind: 'on-hit-bonus-damage', amount: { kind: 'dice', rollId: 'bonus', count: 1, sides: 6 },
          damageType: 'inherit-primary', appliesTo: 'all-weapon-attacks', bindToSelectedTarget: true },
        { kind: 'optional-bonus-die', sides: 6, appliesTo: ['saving-throw'], consumeOnUse: false,
          boundTargetSource: { classId: 'ranger', minimumLevel: 7 } }] }],
      outcomes: [{ id: 'mark', when: { kind: 'always' },
        operations: [{ id: 'mark', kind: 'apply-effect', target: 'actor', effectId: 'mark' }] }] }]
    const status = (value = pkg) => dnd5eContentPackageAutomationCoverageV2(value).entries.find(e => e.id === 'keeper:defense')!.status
    expect(status()).toBe('full')
    expect(status(parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(pkg)).buffer)!)).toBe('full')
    for (const change of ['missing', 'foreign', 'level', 'unbound', 'unused', 'manual', 'cost'] as const) {
      const invalid = structuredClone(pkg), activity = invalid.content.activities![0]
      if (change === 'missing') activity.id = 'missing'
      if (change === 'foreign') activity.legacySource!.id = 'other:mark'
      if (change === 'level') invalid.content.subclasses[0].abilities[1].level = 8
      if (change === 'unbound') activity.effects![0].modifiers = activity.effects![0].modifiers!.filter(m => m.kind !== 'on-hit-bonus-damage')
      if (change === 'unused') activity.outcomes[0].operations = []
      if (change === 'manual') activity.automation.level = 'dm-adjudication'
      if (change === 'cost') invalid.content.subclasses[0].abilities[1].cost = { economy: 'reaction' }
      expect(status(invalid), change).not.toBe('full')
    }
  })

  it('audits passive upgrades against explicit executable sibling outcomes and rejects broken links', () => {
    const pkg = packageValue()
    const summary = { schemaVersion: 1 as const, name: 'Synthetic', description: 'Synthetic',
      trigger: { kind: 'passive' as const }, targeting: { kind: 'self' as const }, effects: [], automation: 'manual' as const }
    pkg.content.subclasses = [{ schemaVersion: 1, id: 'keeper', classId: 'druid', name: 'Keeper', summary: 'Synthetic',
      abilities: [{ ...summary, id: 'area', level: 2 }, { ...summary, id: 'upgrade', level: 10,
        activityOutcomeReferences: [{ activityId: 'area', outcomeId: 'upgraded' }] }] }]
    pkg.content.activities = [{ schemaVersion: 1, id: 'area', name: 'Synthetic', activation: { kind: 'action' },
      target: { kind: 'self' }, legacySource: { kind: 'subclass-ability', id: 'keeper:area' },
      automation: { schemaVersion: 1, level: 'full', supportedPhases: [], manualPhases: [], limitations: [] },
      outcomes: [{ id: 'upgraded', when: { kind: 'predicate', predicate: { kind: 'class-level', classId: 'druid', minimum: 10 } },
        operations: [{ id: 'area', kind: 'create-persistent-area', label: 'Synthetic', durationRounds: 10, concentration: false }] }] }]
    const status = (value = pkg) => dnd5eContentPackageAutomationCoverageV2(value).entries.find(e => e.id === 'keeper:upgrade')!.status
    expect(status()).toBe('full')
    const parsed = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(pkg)).buffer)!
    expect(parsed.content.subclasses[0].abilities[1].activityOutcomeReferences).toEqual([{ activityId: 'area', outcomeId: 'upgraded' }])
    for (const change of ['missing-activity', 'missing-outcome', 'foreign-source', 'wrong-level', 'empty', 'manual', 'active', 'duplicate'] as const) {
      const invalid = structuredClone(pkg), activity = invalid.content.activities![0]
      if (change === 'missing-activity') activity.id = 'other'
      if (change === 'missing-outcome') activity.outcomes[0].id = 'other'
      if (change === 'foreign-source') activity.legacySource!.id = 'foreign:area'
      if (change === 'wrong-level') activity.outcomes[0].when = { kind: 'predicate', predicate: { kind: 'class-level', classId: 'druid', minimum: 2 } }
      if (change === 'empty') activity.outcomes[0].operations = []
      if (change === 'manual') activity.outcomes[0].operations = [{ id: 'manual', kind: 'manual-adjudication', reason: 'Synthetic', prompt: 'Resolve synthetic outcome', requiresDmApproval: true }]
      if (change === 'active') invalid.content.subclasses[0].abilities[1].trigger = { kind: 'active-use' }
      if (change === 'duplicate') {
        invalid.content.subclasses[0].abilities[1].activityOutcomeReferences = [{ activityId: 'area', outcomeId: 'upgraded' }, { activityId: 'area', outcomeId: 'upgraded' }]
        expect(() => parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(invalid)).buffer)).toThrow()
      } else expect(status(invalid), change).not.toBe('full')
    }
  })
  it('recognizes matching passive language and creature communication grants without trusting unrelated tags', () => {
    const pkg = packageValue()
    pkg.content.subclasses = [{
      schemaVersion: 1, id: 'speaker', classId: 'druid', name: 'Speaker', summary: 'Synthetic.',
      abilities: [{ schemaVersion: 1, id: 'speech', name: 'Speech', description: 'Synthetic.', level: 2,
        trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'manual' }],
      advancements: [{ schemaVersion: 1, id: 'speech', level: 2, kind: 'build-grant', grants: [
        { kind: 'tag', key: 'language', value: 'sylvan' },
        { kind: 'tag', key: 'creature-communication', value: 'beast' },
      ] }],
    }]
    const status = (value = pkg) => dnd5eContentPackageAutomationCoverageV2(value).entries.find(
      entry => entry.category === 'subclass-ability' && entry.id === 'speaker:speech')!.status
    expect(status()).toBe('full')
    for (const change of ['id', 'level', 'unknown-tag', 'empty-value', 'active'] as const) {
      const invalid = structuredClone(pkg)
      const subclass = invalid.content.subclasses[0]
      const grant = subclass.advancements![0]
      if (change === 'id') grant.id = 'unrelated'
      if (change === 'level') grant.level = 3
      if (grant.kind === 'build-grant' && (change === 'unknown-tag' || change === 'empty-value')) {
        grant.grants = [{ kind: 'tag', key: change === 'unknown-tag' ? 'unimplemented-power' : 'language', value: change === 'empty-value' ? ' ' : 'beast' }]
      }
      if (change === 'active') subclass.abilities[0].trigger = { kind: 'active-use' }
      expect(status(invalid), change).not.toBe('full')
    }
  })
  it('registers natural weapons and unarmored formulas through unified permanent effects', () => {
    const pkg = packageValue()
    pkg.content.feats = [{ id: 'natural', name: 'Natural', summary: 'Synthetic.', description: 'Synthetic.', automation: 'full', staticModifiers: {
      unarmoredArmorClassBase: 13, unarmoredArmorClassAllowsShield: true,
      naturalWeapons: [{ id: 'claw', name: 'Claw', damageDieSides: 4, damageType: 'slashing' }],
    } }]
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
    try {
      const feat = registeredDnd5ePluginFeats().find(entry => entry.id === `${pkg.manifest.id}:natural`)!
      expect(feat.staticModifiers).toMatchObject({ unarmoredArmorClassBase: 13, unarmoredArmorClassAllowsShield: true, naturalWeapons: [{ id: 'claw' }] })
      const hero = { ...character(), dnd5eFeatIds: [feat.id] }
      expect(dnd5eNaturalWeaponProfiles(hero)).toHaveLength(1)
      expect(dnd5eNaturalWeaponProfiles({ ...hero, dnd5eFeatIds: [] })).toHaveLength(0)
    } finally { dispose() }
  })
  it('preserves subclass build grants and choices through serialization and unified projection', () => {
    const source = packageValue()
    source.content.subclasses = [{
      schemaVersion: 1, id: 'scholar', classId: 'fighter', name: 'Scholar', summary: 'Synthetic subclass.',
      abilities: [{
        schemaVersion: 1, id: 'strike', name: 'Strike', description: 'Synthetic strike.', level: 3,
        trigger: { kind: 'active-use' }, cost: { economy: 'none' },
        targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 30 },
        rolls: [{ id: 'damage', kind: 'damage', label: 'Damage', dice: { count: 1, sides: 6 }, damageType: 'force' }],
        effects: [{ kind: 'damage', target: 'target', rollId: 'damage' }], automation: 'full',
      }],
      advancements: [{
        schemaVersion: 1, id: 'training', level: 3, kind: 'build-grant',
        grants: [{ kind: 'proficiency', category: 'skill', id: 'history' }],
      }, {
        schemaVersion: 1, id: 'specialty', level: 3, kind: 'select', label: 'Specialty', count: 1,
        options: [{ id: 'arcana', label: 'Arcana', grants: [{ kind: 'proficiency', category: 'skill', id: 'arcana' }] }],
      }],
    }]
    const parsed = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(source)).buffer)!
    expect(parsed).toBeTruthy()
    const projected = dnd5eContentDefinitionsFromPackageV2(parsed).find((entry) => entry.kind === 'subclass')!
    const advancements = projected.advancements as readonly Dnd5eAdvancementDefinitionV1[]
    expect(advancements).toEqual(expect.arrayContaining([...parsed.content.subclasses[0].advancements!]))
    expect(advancements).toContainEqual(expect.objectContaining({ kind: 'grant', level: 3 }))
    expect(advancements[0]).not.toBe(parsed.content.subclasses[0].advancements![0])
    const hero = character()
    expect(applyDnd5eContentBuildChoicesV1({ character: hero, contentId: projected.id, advancements })).toEqual({ ok: false, reason: 'missing-choice' })
    expect(hero.skills).toEqual([])
    const result = applyDnd5eContentBuildChoicesV1({
      character: hero, contentId: projected.id, advancements, selections: { specialty: ['arcana'] },
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.character.skills).toEqual(expect.arrayContaining(['history', 'arcana']))
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(parsed))
    dispose()
  })
  it('resolves local generated item references without mutating archive data or external IDs', () => {
    const value = packageValue()
    const itemId = value.content.items[0].id
    value.content.activities = [{schemaVersion:1,id:'generate',name:'Generate',activation:{kind:'action'},automation:{schemaVersion:1,level:'full',supportedPhases:[],manualPhases:[],limitations:[]},target:{kind:'self'},outcomes:[{id:'result',when:{kind:'always'},operations:[{id:'item',kind:'grant-inventory-item',target:'actor',templateId:itemId,quantity:{kind:'constant',value:1},templateVariants:[{minimumCastLevel:3,templateId:itemId},{minimumCastLevel:5,templateId:'external:item'}]}]}]}]
    const before = JSON.stringify(value)
    const runtime = resolveDnd5eContentPackageItemReferences(value)
    expect(JSON.stringify(value)).toBe(before)
    expect(runtime.content.activities![0].outcomes[0].operations[0]).toMatchObject({templateId:`${value.manifest.id}:${itemId}`,templateVariants:[{minimumCastLevel:3,templateId:`${value.manifest.id}:${itemId}`},{minimumCastLevel:5,templateId:'external:item'}]})
    expect(resolveDnd5eContentPackageItemReferences(runtime)).toEqual(runtime)
    value.content.activities![0].outcomes[0].operations = [{ id: 'alter', kind: 'alter-inventory-item', target: 'actor',
      templateId: itemId, originalTemplateIds: [itemId, 'external:item'], quantity: { kind: 'constant', value: 1 }, sourceEffectId: 'life' }]
    const originalArchive = JSON.stringify(value)
    const alteredRuntime = resolveDnd5eContentPackageItemReferences(value)
    expect(alteredRuntime.content.activities![0].outcomes[0].operations[0]).toMatchObject({ templateId: `${value.manifest.id}:${itemId}`,
      originalTemplateIds: [`${value.manifest.id}:${itemId}`, 'external:item'] })
    expect(JSON.stringify(value)).toBe(originalArchive)
    expect(resolveDnd5eContentPackageItemReferences(alteredRuntime)).toEqual(alteredRuntime)
    for (const mealTemplateId of [itemId, 'external:item', 'undeclared-meal']) {
      value.content.activities![0].outcomes[0].operations = [{
        id: 'fortress', kind: 'create-persistent-area', label: 'Fortress',
        utilityProjectionId: 'mighty-fortress', durationRounds: 100800, concentration: false,
        structureServices: { mealTemplateId, furnishings:[{templateId:mealTemplateId,size:0.5}] },
      }]
      const archive = JSON.stringify(value)
      const projected = resolveDnd5eContentPackageItemReferences(value)
      expect(projected.content.activities![0].outcomes[0].operations[0]).toMatchObject({
        structureServices: { mealTemplateId: mealTemplateId === itemId ? `${value.manifest.id}:${itemId}` : mealTemplateId,
          furnishings:[{templateId:mealTemplateId===itemId?`${value.manifest.id}:${itemId}`:mealTemplateId,size:0.5}] },
      })
      expect(JSON.stringify(value)).toBe(archive)
      expect(resolveDnd5eContentPackageItemReferences(projected)).toEqual(projected)
    }
  })
  it('persists first-class Activity templates and binds them to every owning content definition', () => {
    const source = packageValue()
    source.content.activities = [{
      schemaVersion: 1,
      id: 'steady-follow-up',
      name: 'Steady follow-up',
      activation: { kind: 'bonus-action', cost: 1 },
      invocation: {
        kind: 'triggered', event: 'attack-resolved', confirmation: 'actor-choice', retention: 'until-turn-end',
      },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 5 },
      requirements: [
        { kind: 'event-source', source: 'attack' },
        { kind: 'weapon-property', property: 'light', present: true },
        { kind: 'action-economy-available', economy: 'bonus-action' },
      ],
      consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
      outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
        id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 2 }, damageType: 'slashing',
      }] }],
      automation: {
        schemaVersion: 1, level: 'full', supportedPhases: [
          'eligibility', 'targeting', 'cost', 'damage', 'interrupt', 'persistence',
        ], manualPhases: [], limitations: [],
      },
      legacySource: { kind: 'feat', id: 'steady' },
    }]

    const parsed = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(source)).buffer)
    expect(parsed?.content.activities).toHaveLength(1)
    const projection = dnd5eContentPackageActivityProjectionV1(parsed!)
    expect(projection.entries).toContainEqual(expect.objectContaining({
      sourceKind: 'feat', sourceId: 'steady', activityId: 'steady-follow-up', mode: 'adapted',
    }))
    const feat = dnd5eContentDefinitionsFromPackageV2(parsed!).find((definition) =>
      definition.kind === 'feat' && definition.payload && (definition.payload as { id?: string }).id === 'steady')
    expect(feat?.activities).toMatchObject([{ id: 'steady-follow-up', invocation: { event: 'attack-resolved' } }])
    expect(feat?.effects).toContainEqual(expect.objectContaining({
      modifiers: [expect.objectContaining({ kind: 'damage-reduction', damageTypes: ['slashing'], oncePerTurn: true })],
      triggers: [expect.objectContaining({ event: 'before-damage', decision: 'automatic' })],
    }))
  })

  it('projects passive item hooks into the same Effect/Trigger vocabulary', () => {
    const base = packageValue()
    const source = { ...base, content: { ...base.content, items: [...base.content.items] } }
    source.content.items[0] = {
      ...source.content.items[0]!,
      resources: [{ id: 'charges', label: 'Charges', maximum: 3, resetOn: 'long-rest' }],
      headlessEffects: [{
        schemaVersion: 1, id: 'reroll', kind: 'attack-roll-reroll', resourceId: 'charges', resourceCost: 1,
        maximumDice: 1, trigger: 'after-attack-roll', appliesTo: 'weapon-attacks',
      }, {
        schemaVersion: 1, id: 'bonus', kind: 'on-hit-bonus-damage', trigger: 'after-attack-hit',
        appliesTo: 'weapon-attacks', damage: { count: 1, sides: 6, bonus: 0 }, damageType: 'fire', oncePerTurn: true,
      }, {
        schemaVersion: 1, id: 'guard', kind: 'damage-reduction', trigger: 'before-damage', amount: 2,
      }, {
        schemaVersion: 1, id: 'survive', kind: 'death-prevention', trigger: 'before-drop-to-zero', hitPointsAfter: 1,
      }],
    }
    const item = dnd5eContentDefinitionsFromPackageV2(source).find((definition) => definition.kind === 'item') as {
      effects?: readonly {
        modifiers?: readonly { kind: string }[]
        triggers?: readonly { event: string }[]
      }[]
    } | undefined
    expect(item?.effects?.flatMap((effect) => effect.modifiers ?? []).map((modifier) => modifier.kind)).toEqual([
      'attack-roll-reroll', 'on-hit-bonus-damage', 'damage-reduction', 'death-prevention',
    ])
    expect(item?.effects?.flatMap((effect) => effect.triggers ?? []).map((trigger) => trigger.event)).toEqual([
      'after-attack-roll', 'attack-hit', 'before-damage', 'before-drop-to-zero',
    ])
  })

  it('projects executable V2 content into the internal Activity catalog without changing the wire schema', () => {
    const source = packageValue()
    source.content.headlessActions = [{
      id: 'ember-wave-action',
      label: 'Ember Wave',
      effects: [{ kind: 'damage', dice: { count: 2, sides: 6 }, damageType: 'fire' }],
    }]
    source.content.features = [{
      id: 'ember-pulse',
      name: 'Ember Pulse',
      summary: 'Synthetic action feature.',
      description: 'Synthetic action feature.',
      automation: 'full',
      action: {
        id: 'ember-wave-action', label: 'Ember Wave', economy: 'action',
        targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 30 },
      },
    }]
    source.content.spells = [{
      id: 'ember-wave', name: 'Ember Wave', level: 1, school: 'evocation', ritual: false,
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'distance', feet: 30 },
      components: { verbal: true, somatic: true, material: false },
      duration: { type: 'instantaneous', concentration: false },
      classes: ['wizard'], description: 'Synthetic spell.',
      automation: { mode: 'headless-action', actionId: 'ember-wave-action' },
    }]
    const projection = dnd5eContentPackageActivityProjectionV1(source)
    expect(projection.counts).toMatchObject({ total: 3, adapted: 3, legacyFallback: 0 })
    expect(projection.activities.map((activity) => activity.id)).toEqual([
      'ember-wave-action', 'feature:ember-pulse', 'spell:ember-wave',
    ])

    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(source))
    try {
      expect(listRegisteredDnd5eActivityPackages()).toContainEqual(expect.objectContaining({
        packageId: 'com.example.content-v2',
        activities: expect.arrayContaining([expect.objectContaining({ id: 'spell:ember-wave' })]),
      }))
      expect(listRegisteredContentDefinitionPackages()).toContainEqual(expect.objectContaining({
        packageId: 'com.example.content-v2',
        definitions: expect.arrayContaining([
          expect.objectContaining({ kind: 'feature', id: 'feature.ember-pulse' }),
          expect.objectContaining({ kind: 'spell', id: 'spell.ember-wave' }),
        ]),
      }))
    } finally {
      dispose()
    }
    expect(listRegisteredDnd5eActivityPackages()).toEqual([])
    expect(listRegisteredContentDefinitionPackages()).toEqual([])
  })

  it('builds workshop spell icons into V2 and registers the namespaced asset', () => {
    const source = packageValue()
    const draft: Dnd5eCustomRulesPluginDraft = {
      manifest: source.manifest,
      races: [], backgrounds: [], features: [], feats: [], items: [], abilityGenerationMethods: [],
      headlessActions: [], subclasses: [], classes: [], monsters: [],
      spells: [{
        id: 'thunderclap', name: '鸣雷破', iconAssetId: 'spell-thunderclap-icon',
        level: 0, school: 'evocation', ritual: false,
        castingTime: { value: 1, unit: 'action' },
        range: { type: 'self', shape: 'radius', sizeFeet: 5 },
        components: { verbal: false, somatic: true, material: false },
        duration: { type: 'instantaneous', concentration: false },
        classes: ['wizard'], description: 'Synthetic spell used only by tests.',
        automation: { mode: 'reference-only' },
      }],
    }
    const encoded = new TextEncoder().encode(buildDnd5eCustomRulesContentPackageV2(draft, [{
      id: 'spell-thunderclap-icon', mediaType: 'image/png', dataBase64: ONE_PIXEL_PNG,
    }]))
    const parsed = parseDnd5eContentPackageV2(encoded.buffer)!
    expect(parsed.content.spells[0].iconAssetId).toBe('spell-thunderclap-icon')
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(parsed))
    try {
      expect(dnd5ePluginSpellDefinition('com.example.content-v2:thunderclap')?.iconAssetId)
        .toBe('com.example.content-v2:spell-thunderclap-icon')
      expect(dnd5ePluginImageAssetUrl('com.example.content-v2:spell-thunderclap-icon'))
        .toMatch(/^data:image\/png;base64,/)
    } finally {
      dispose()
    }
  })

  it('keeps the checked-in original-content example importable', () => {
    const bytes = readFileSync(new URL('../../../examples/original-content-v2.dndstars5e', import.meta.url))
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    expect(parseDnd5eContentPackageV2(buffer)?.manifest.id).toBe('local.example.original-content-v2')
  })

  it('keeps the rights-safe subclass protocol example valid with prearmed attack intent support', () => {
    const example = JSON.parse(readFileSync(
      new URL('../../../examples/phb-local-collection-template/subclass-protocol.example.json', import.meta.url),
      'utf8',
    ))
    const source = packageValue()
    source.content.subclasses = example
    const encoded = new TextEncoder().encode(JSON.stringify(source))
    const parsed = parseDnd5eContentPackageV2(encoded.buffer)
    const subclass = parsed?.content.subclasses[0]
    expect(subclass).toMatchObject({
      id: 'synthetic-protocol-demo',
      spellcasting: { progression: 'one-third', spellListClassId: 'wizard' },
    })
    expect(subclass?.resources?.[0].die).toMatchObject({ sides: 6 })
    expect(subclass?.choiceGroups?.[0].maxSelectionsByLevel?.[0]).toEqual({ level: 7, maxSelections: 5 })
    expect(dnd5eContentPackageAutomationCoverageV2(parsed!).entries).toContainEqual(expect.objectContaining({
      category: 'subclass-ability',
      id: 'synthetic-protocol-demo:precision-pulse',
      status: 'full',
      capability: expect.objectContaining({ level: 'full', manualPhases: [] }),
    }))
  })

  it('parses pure JSON and reports a non-executable installation preview', () => {
    const encoded = new TextEncoder().encode(JSON.stringify(packageValue()))
    const parsed = parseDnd5eContentPackageV2(encoded.buffer)
    expect(parsed?.manifest.id).toBe('com.example.content-v2')
    expect(parsed?.provenance).toMatchObject({ edition: '2014', contentMode: 'incremental' })
    expect(dnd5eContentPackageSummaryV2(parsed!)).toMatchObject({
      races: 1,
      feats: 1,
      items: 1,
      imageAssets: 1,
    })
    expect(dnd5eContentPackageAutomationCoverageV2(parsed!, 'sha256-test')).toMatchObject({
      package: {
        id: 'com.example.content-v2',
        version: '1.0.0',
        distributionPolicy: 'local-only',
        integrity: 'sha256-test',
      },
      privacy: {
        includesSourceText: false,
        includesImageData: false,
        includesHumanReadableContentNames: false,
      },
      totals: { total: 3, full: 2, referenceOnly: 1 },
      bindings: {
        declaredHeadlessActions: 0,
        referencedHeadlessActions: 0,
        unreferencedHeadlessActions: 0,
      },
      visuals: {
        declaredImageAssets: 1,
        referencedImageAssets: 1,
        missingImageAssetReferences: 0,
        unusedImageAssets: 0,
      },
    })
    const serializedReport = JSON.stringify(dnd5eContentPackageAutomationCoverageV2(parsed!))
    expect(serializedReport).not.toContain('Synthetic passive feat used only by tests.')
    expect(serializedReport).not.toContain(ONE_PIXEL_PNG)
  })

  it('reports imported race automation honestly instead of assuming full coverage', () => {
    const source = packageValue()
    source.content.races[0].automation = 'partial'
    source.content.races[0].automationReasons = ['Scene-dependent trait requires DM adjudication.']
    expect(dnd5eContentPackageAutomationCoverageV2(source).categories.race).toMatchObject({
      total: 1,
      full: 0,
      partial: 1,
    })
    expect(dnd5eContentPackageAutomationCoverageV2(source).entries).toContainEqual(expect.objectContaining({
      category: 'race',
      id: 'emberkin',
      status: 'partial',
      reasons: ['Scene-dependent trait requires DM adjudication.'],
      capability: expect.objectContaining({
        level: 'assisted',
        limitations: ['Scene-dependent trait requires DM adjudication.'],
      }),
    }))
  })

  it('uses permanent unified Effects as the runtime authority for race and feat passives', () => {
    const base = packageValue()
    const source = {
      ...base,
      content: {
        ...base.content,
        races: base.content.races.map((race, index) => index === 0 ? {
          ...race,
          hitPointsPerLevelBonus: 1,
          naturalOneReroll: true,
          savingThrowAdvantages: { damageTypes: ['poison'] as const, magicAbilities: ['int', 'wis', 'cha'] as const },
        } : race),
        feats: base.content.feats.map((feat, index) => index === 0 ? {
          ...feat,
          passiveEffects: [{
            ...feat.passiveEffects![0]!,
            deliveries: ['weapon-attack'] as const,
            magical: false,
            requiresHeavyArmor: true,
          }],
        } : feat),
      },
    }
    const definitions = dnd5eContentDefinitionsFromPackageV2(source)
    const race = definitions.find((definition) => definition.kind === 'race')
    expect(race?.effects?.flatMap((effect) => (effect as { modifiers?: readonly unknown[] }).modifiers ?? [])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'character-capability', capability: 'hitPointsPerLevelBonus', value: 1 }),
        expect.objectContaining({ kind: 'character-capability', capability: 'naturalOneReroll', value: true }),
        expect.objectContaining({ kind: 'racial-saving-throw-advantage', damageTypes: ['poison'] }),
      ]),
    )

    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(source))
    try {
      expect(dnd5ePluginFeatureRuntimeSourceV1('com.example.content-v2:feat-steady')).toBe('unified-content')
      expect(registeredDnd5ePluginRaces()[0]).toMatchObject({
        hitPointsPerLevelBonus: 1,
        naturalOneReroll: true,
        savingThrowAdvantages: { damageTypes: ['poison'], magicAbilities: ['int', 'wis', 'cha'] },
      })
      expect(registeredDnd5ePluginFeats()[0]?.passiveEffects?.[0]).toMatchObject({
        deliveries: ['weapon-attack'],
        magical: false,
        requiresHeavyArmor: true,
      })
    } finally {
      dispose()
    }
  })

  it('registers each monster action Activity exactly once', () => {
    const source = packageValue()
    source.content.monsters = [buildDnd5eCustomMonster(createDnd5eCustomMonsterDraft())]

    const definitions = dnd5eContentDefinitionsFromPackageV2(source)
    const monster = definitions.find((definition) => definition.kind === 'monster')
    const monsterActions = definitions.filter((definition) => definition.kind === 'monster-action')
    const actionIds = definitions.flatMap((definition) => definition.activities ?? [])
      .flatMap((activity) => activity && typeof activity === 'object' && 'id' in activity &&
        typeof activity.id === 'string' ? [activity.id] : [])

    expect(monster?.activities ?? []).toEqual([])
    expect(monsterActions.length).toBeGreaterThan(0)
    expect(new Set(actionIds).size).toBe(actionIds.length)

    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(source))
    dispose()
  })

  it('reports backgrounds as partially automated because narrative and choice fields need confirmation', () => {
    const source = packageValue()
    source.content.backgrounds = [{
      id: 'field-scholar',
      name: 'Field Scholar',
      description: 'Synthetic background.',
      skillProficiencies: ['history', 'nature'],
      toolProficiencies: ['cartographer-tools'],
      languages: 1,
      feature: { name: 'Research Contact', description: 'Synthetic narrative feature.' },
    }]

    expect(dnd5eContentPackageAutomationCoverageV2(source).entries).toContainEqual(
      expect.objectContaining({
        category: 'background',
        id: 'field-scholar',
        status: 'partial',
        capability: expect.objectContaining({ level: 'assisted' }),
      }),
    )
  })

  it('uses the migrated Activity capability instead of trusting a stale full declaration', () => {
    const source = packageValue()
    source.content.features = [{
      id: 'broken-action-link',
      name: 'Broken action link',
      summary: 'Synthetic migration edge case.',
      description: 'Synthetic migration edge case.',
      automation: 'full',
      action: {
        id: 'missing-action',
        label: 'Missing action',
        economy: 'action',
        targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 30 },
      },
    }]

    expect(dnd5eContentPackageAutomationCoverageV2(source).entries).toContainEqual(
      expect.objectContaining({
        category: 'feature',
        id: 'broken-action-link',
        status: 'partial',
        capability: expect.objectContaining({ level: 'assisted' }),
      }),
    )
  })

  it('shares opted-in Chinese spell text without exposing other source prose', () => {
    const source = packageValue()
    source.manifest.distributionPolicy = 'room-ephemeral'
    source.manifest.roomSpellText = 'include'
    source.content.spells = [{ id: 'test-spell', name: '测试法术', level: 1, school: 'abjuration', ritual: false,
      castingTime: { value: 1, unit: 'action' }, range: { type: 'self' },
      components: { verbal: true, somatic: true, material: true, materialText: '材料说明' }, duration: { type: 'instantaneous', concentration: false },
      classes: ['wizard'], description: '中文法术说明。'.repeat(100), higherLevels: '升环说明',
      automation: { mode: 'reference-only' } }]
    const before = structuredClone(source)
    const projected = dnd5eRoomRuntimeProjectionV2(source)
    expect(source).toEqual(before)
    expect(projected.content.spells[0]).toMatchObject({ description: source.content.spells[0].description,
      higherLevels: '升环说明', components: { materialText: '材料说明' } })
    expect(projected.content.feats[0].description).toBe(DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER)
    expect(dnd5eRoomRuntimeProjectionV2(projected)).toEqual(projected)
    delete source.manifest.roomSpellText
    expect(dnd5eRoomRuntimeProjectionV2(source).content.spells[0].description).toBe(DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER)
    source.manifest.roomSpellText = 'include'
    source.content.spells[0].description = '字'.repeat(20_001)
    expect(() => dnd5eRoomRuntimeProjectionV2(source)).toThrow('长度限制')
  })

  it('retains opted-in subclass abilities, choices and other content display text', () => {
    const source = packageValue()
    source.manifest.distributionPolicy = 'room-ephemeral'
    source.manifest.roomContentText = 'include'
    source.content.subclasses = [{ schemaVersion: 1, id: 'test-subclass', classId: 'fighter', name: '测试子职',
      summary: '子职摘要', resources: [],
      abilities: [{ schemaVersion: 1, id: 'gift', name: '测试战技', description: '中文战技说明。'.repeat(100), level: 3,
        trigger: { kind: 'long-rest-complete' }, cost: { economy: 'none' }, targeting: { kind: 'self' }, rolls: [], effects: [], automation: 'manual' }] }]
    const projected = dnd5eRoomRuntimeProjectionV2(source)
    expect(projected.content.subclasses).toEqual(source.content.subclasses)
    expect(projected.content.feats).toEqual(source.content.feats)
    expect(projected.content.items).toEqual(source.content.items)
    expect(projected.manifest.description).toBe(DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER)
    expect(projected.provenance.sourceTitle).toBe(DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER)
    expect(dnd5eRoomRuntimeProjectionV2(projected)).toEqual(projected)
    delete source.manifest.roomContentText
    expect(dnd5eRoomRuntimeProjectionV2(source).content.subclasses[0].abilities[0].description).toBe(DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER)
  })

  it('projects room-ephemeral mechanics and images without source prose', () => {
    const source = packageValue()
    source.manifest.distributionPolicy = 'room-ephemeral'
    source.manifest.description = 'Local source description that must not be transmitted.'
    source.content.feats[0].summary = 'Local summary.'
    source.content.feats[0].description = 'Local rule prose.'
    const projected = dnd5eRoomRuntimeProjectionV2(source)
    expect(projected.provenance).toEqual({
      edition: '2014',
      contentMode: 'incremental',
      sourceTitle: DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER,
      projection: DND5E_ROOM_RUNTIME_PROJECTION,
    })
    expect(projected.content.feats[0]).toMatchObject({
      id: 'steady',
      name: 'Steady',
      summary: DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER,
      description: DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER,
      staticModifiers: { initiativeBonus: 2 },
      passiveEffects: [expect.objectContaining({
        kind: 'damage-reduction',
        amount: 3,
      })],
    })
    expect(projected.assets[0].dataBase64).toBe(ONE_PIXEL_PNG)
  })

  it('registers assets and projects race/feat passives into Headless combat', () => {
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(packageValue()))
    try {
      expect(registeredDnd5ePluginRaces()).toEqual([
        expect.objectContaining({ id: 'com.example.content-v2:emberkin', size: 'small' }),
      ])
      expect(registeredDnd5ePluginFeats()).toEqual([
        expect.objectContaining({
          id: 'com.example.content-v2:steady',
          featureId: 'com.example.content-v2:feat-steady',
          passiveEffects: [expect.objectContaining({
            kind: 'damage-reduction',
            amount: 3,
          })],
        }),
      ])
      const item = registeredDnd5ePluginItems()[0]
      expect(item.iconAssetId).toBe('com.example.content-v2:ember')
      expect(dnd5eItemActionIcon(item).asset).toBe(
        dnd5ePluginImageAssetUrl('com.example.content-v2:ember'),
      )

      const migrated = migrateCharacterToDnd5e(character())
      const combatant = createCombatantFromDnd5eCharacter({
        character: migrated,
        controller: 'player',
        initiativeD20: 10,
        position: { x: 0, y: 0 },
      })
      expect(combatant).toMatchObject({
        sizeRank: 1,
        armorClass: 13,
        speed: 35,
        initiative: 13,
        passivePerception: 15,
        darkvisionRangeFeet: 60,
        cannotBeSurprisedWhileConscious: true,
        unseenAttackersDoNotGainAdvantage: true,
        ignoreLongRangeRangedWeaponDisadvantage: true,
        ignoreNearbyHostileRangedAttackDisadvantage: true,
        ignoreRangedWeaponCoverBonus: true,
        preventOpportunityAttacksFromMeleeAttackTargets: true,
        spellAttackRangeMultiplier: 2,
        ignoreSpellAttackCoverBonus: true,
      })
      expect(combatant.skillProficiencies).toContain('perception')
      expect(combatant.damageResistances).toContain('fire')
      expect(combatant.damageImmunities).toContain('poison')
      expect(combatant.conditionImmunities).toContain('frightened')
      expect(combatant.savingThrowBonuses.dex).toBe(2)
      expect(combatant.pluginFeaturePassiveEffects).toEqual([
        expect.objectContaining({
          featureId: 'com.example.content-v2:feat-steady',
          featureName: 'Steady',
          effect: expect.objectContaining({
            kind: 'damage-reduction',
            amount: 3,
          }),
        }),
      ])
    } finally {
      dispose()
    }
    expect(registeredDnd5ePluginImageAssets()).toEqual([])
    expect(registeredDnd5ePluginFeats()).toEqual([])
  })

  it('rejects executable image formats and manifest/payload mismatches', () => {
    const invalid: Dnd5eContentPackageV2 = {
      ...packageValue(),
      assets: [{
        id: 'vector',
        mediaType: 'image/svg+xml' as 'image/png',
        dataBase64: btoa('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      }],
    }
    const bytes = new TextEncoder().encode(JSON.stringify(invalid))
    expect(() => parseDnd5eContentPackageV2(bytes.buffer)).toThrow('Unsupported plugin image media type')
  })
})





