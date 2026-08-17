import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DND5E_LOCAL_CONTENT_COLLECTION_FORMAT,
  DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION,
  compileDnd5eLocalContentCollection,
  prepareDnd5eLocalContentJson,
} from './localContentCollection'
import {
  dnd5eRulesPluginFromContentPackageV2,
  parseDnd5eContentPackageV2,
} from './contentPackageV2'
import { dnd5eContentPackageActivityProjectionV1 } from './activities/dnd5eContentPackageActivityProjection'
import {
  dnd5ePluginSpellDefinition,
  dnd5ePluginBackgroundDefinition,
  dnd5ePluginSubclassSpellIds,
  dnd5ePluginFeatureDefinition,
  dnd5ePluginFeatDefinition,
  dnd5ePluginItemDefinition,
  registerDnd5eRulesPlugin,
} from './pluginApi'
import { dnd5ePluginHeadlessActionDefinition } from './plugins/pluginHeadlessRuntimeRegistry'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'
import {
  defaultDnd5eStartingEquipmentSelection,
  dnd5eStartingEquipmentPlan,
  resolveDnd5eStartingEquipment,
} from './startingEquipment'

const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
const LOCAL_PHB_COLLECTION_DIRECTORY = fileURLToPath(new URL(
  '../../../local-content/phb-2014/',
  import.meta.url,
))

function localCollectionFiles(directory: string, base = directory): File[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return localCollectionFiles(fullPath, base)
    const relativePath = path.relative(base, fullPath).replace(/\\/g, '/')
    return [new File([readFileSync(fullPath)], relativePath)]
  })
}

describe('本地房间内容合集', () => {
  it('keeps the public single-file JSON example importable', async () => {
    const prepared = await prepareDnd5eLocalContentJson(readFileSync(
      new URL('../../../examples/local-room-rules-single-file.json', import.meta.url),
      'utf8',
    ))
    expect(prepared.sourceKind).toBe('content-shorthand')
    expect(prepared.package.content.features).toEqual([
      expect.objectContaining({ id: 'example-room-feature', automation: 'manual' }),
    ])
  })

  it('accepts a fenced shorthand JSON document and creates a stable ephemeral package', async () => {
    const source = {
      name: 'Portable room rules',
      races: [{
        id: 'swiftfolk',
        name: 'Swiftfolk',
        speedFeet: 35,
        size: 'medium',
        skillProficiencies: [],
        languages: [],
        traits: [],
      }],
    }
    const first = await prepareDnd5eLocalContentJson(
      `\`\`\`json\n${JSON.stringify(source)}\n\`\`\``,
    )
    const second = await prepareDnd5eLocalContentJson(JSON.stringify(source))
    expect(first.sourceKind).toBe('content-shorthand')
    expect(first.package.manifest).toMatchObject({
      id: second.package.manifest.id,
      name: 'Portable room rules',
      distributionPolicy: 'room-ephemeral',
    })
    expect(first.package.content.races).toEqual([
      expect.objectContaining({ id: 'swiftfolk', speedFeet: 35 }),
    ])
  })

  it('accepts one feat object when the importer explicitly selected feats', async () => {
    const feat = {
      id: 'watchful-step',
      name: '警觉步伐',
      summary: '你会持续留意周围威胁。',
      description: '这是一项用于验证单条专长导入的测试专长。',
      automation: 'manual',
    }
    const prepared = await prepareDnd5eLocalContentJson(
      JSON.stringify(feat),
      'single-feat.json',
      { targetCollection: 'feats' },
    )

    expect(prepared.sourceKind).toBe('content-shorthand')
    expect(prepared.package.content.feats).toEqual([
      expect.objectContaining({ id: feat.id, name: feat.name, automation: 'manual' }),
    ])
  })

  it('accepts a singular feat wrapper when the importer explicitly selected feats', async () => {
    const prepared = await prepareDnd5eLocalContentJson(JSON.stringify({
      name: '单条专长资料',
      feat: {
        id: 'steady-hands',
        name: '稳定双手',
        summary: '保持稳定。',
        description: '这是一项用于验证单数包装格式的测试专长。',
        automation: 'manual',
      },
    }), 'wrapped-feat.json', { targetCollection: 'feats' })

    expect(prepared.package.content.feats).toEqual([
      expect.objectContaining({ id: 'steady-hands', name: '稳定双手' }),
    ])
  })

  it('does not guess the category of a bare resource object without an explicit target', async () => {
    await expect(prepareDnd5eLocalContentJson(JSON.stringify({
      id: 'ambiguous-resource',
      name: 'Ambiguous Resource',
      summary: 'Could be a feature or feat.',
      description: 'The generic importer must keep requiring an explicit collection.',
      automation: 'manual',
    }))).rejects.toThrow(/races.*feats.*spells/i)
  })

  it('accepts a self-contained collection with an embedded AI-generated image', async () => {
    const prepared = await prepareDnd5eLocalContentJson(JSON.stringify({
      format: DND5E_LOCAL_CONTENT_COLLECTION_FORMAT,
      schemaVersion: DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION,
      manifest: {
        id: 'local.example.portable-json',
        name: 'Portable JSON',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Local test',
        license: 'Private local use',
        contentCategory: 'mixed',
      },
      content: {
        races: [{
          id: 'emberkin', name: 'Emberkin', speedFeet: 30, size: 'medium',
          skillProficiencies: [], languages: [], traits: [],
        }],
      },
      images: [{
        id: 'emberkin-icon',
        mediaType: 'image/png',
        dataBase64: ONE_PIXEL_PNG,
        origin: 'ai-generated',
        prompt: 'private generation prompt',
        targets: [{ category: 'race', id: 'emberkin', slot: 'icon' }],
      }],
    }))
    expect(prepared.sourceKind).toBe('local-collection')
    expect(prepared.audit?.complete).toBe(true)
    expect(prepared.package.content.races[0]).toMatchObject({
      id: 'emberkin',
      iconAssetId: 'emberkin-icon',
    })
    expect(prepared.package.assets).toEqual([
      expect.objectContaining({ id: 'emberkin-icon', mediaType: 'image/png' }),
    ])
    expect(new TextDecoder().decode(prepared.bytes)).not.toContain('private generation prompt')
  })

  it('keeps unified Activity templates when compiling a local collection', async () => {
    const prepared = await prepareDnd5eLocalContentJson(JSON.stringify({
      format: DND5E_LOCAL_CONTENT_COLLECTION_FORMAT,
      schemaVersion: DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION,
      manifest: {
        id: 'local.example.activity-template',
        name: 'Activity template collection',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Local test',
        license: 'Private local use',
        contentCategory: 'rules',
      },
      content: {
        features: [{
          id: 'restorative-pulse',
          name: 'Restorative pulse',
          summary: 'A reusable Activity source.',
          description: 'A local test feature backed by a unified Activity.',
          automation: 'full',
        }],
        activities: [{
          schemaVersion: 1,
          id: 'restorative-pulse-activity',
          name: 'Restorative pulse',
          activation: { kind: 'action', cost: 1 },
          invocation: { kind: 'active', confirmation: 'actor-choice' },
          target: { kind: 'self' },
          consumption: [{
            kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve',
          }],
          outcomes: [{
            id: 'restore', when: { kind: 'always' }, operations: [{
              id: 'healing', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 1 },
            }],
          }],
          automation: {
            schemaVersion: 1,
            level: 'full',
            supportedPhases: ['eligibility', 'cost', 'targeting', 'healing', 'persistence'],
            manualPhases: [],
            limitations: [],
          },
          legacySource: { kind: 'feature', id: 'restorative-pulse' },
        }],
      },
    }))

    expect(prepared.package.content.activities).toEqual([
      expect.objectContaining({
        id: 'restorative-pulse-activity',
        legacySource: { kind: 'feature', id: 'restorative-pulse' },
      }),
    ])
    expect(dnd5eContentPackageActivityProjectionV1(prepared.package).entries).toContainEqual(
      expect.objectContaining({
        sourceKind: 'feature',
        sourceId: 'restorative-pulse',
        activityId: 'restorative-pulse-activity',
        mode: 'adapted',
      }),
    )
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(prepared.package))
    try {
      expect(dnd5ePluginFeatureDefinition('local.example.activity-template:restorative-pulse')?.action)
        .toMatchObject({
          id: 'restorative-pulse-activity',
          economy: 'action',
          targeting: { kind: 'self' },
        })
      expect(dnd5ePluginHeadlessActionDefinition(
        'local.example.activity-template',
        'restorative-pulse-activity',
      )).toMatchObject({ execution: 'trusted' })
    } finally {
      dispose()
    }
  })

  it('accepts a previously compiled room-ephemeral V2 JSON as a single file', async () => {
    const compiled = await prepareDnd5eLocalContentJson(JSON.stringify({
      name: 'Round trip rules',
      races: [{
        id: 'round-trip-race', name: 'Round Trip', speedFeet: 30, size: 'medium',
        skillProficiencies: [], languages: [], traits: [],
      }],
    }))
    const prepared = await prepareDnd5eLocalContentJson(
      new TextDecoder().decode(compiled.bytes),
      'round-trip.json',
    )
    expect(prepared.sourceKind).toBe('content-package-v2')
    expect(prepared.fileName).toBe('round-trip.json')
    expect(prepared.package.manifest.id).toBe(compiled.package.manifest.id)
  })

  it('merges multiple local JSON tables for the same content category', async () => {
    const collection = {
      format: DND5E_LOCAL_CONTENT_COLLECTION_FORMAT,
      schemaVersion: DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION,
      manifest: {
        id: 'local.example.split-subclasses',
        name: 'Split Subclass Collection',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Local test',
        license: 'Private local use',
        contentCategory: 'subclasses',
      },
      json: {
        subclasses: [
          'subclasses/vanguard.json',
          'subclasses/warden.json',
        ],
      },
      expected: {
        subclasses: {
          count: 2,
          ids: ['vanguard', 'warden'],
        },
      },
    }
    const subclass = (id: string, name: string) => [{
      schemaVersion: 1,
      id,
      classId: 'fighter',
      name,
      summary: 'Synthetic local test fixture.',
      abilities: [{
        schemaVersion: 1,
        id: 'local-note',
        name: 'Local note',
        description: 'Synthetic local test fixture.',
        level: 3,
        trigger: { kind: 'active-use' },
        targeting: { kind: 'self' },
        effects: [{
          kind: 'temporary-hit-points',
          target: 'actor',
          amount: { kind: 'fixed', value: 0 },
        }],
        automation: 'manual',
      }],
    }]
    const result = await compileDnd5eLocalContentCollection([
      new File([JSON.stringify(collection)], 'collection.json', { type: 'application/json' }),
      new File([JSON.stringify(subclass('vanguard', 'Vanguard'))], 'subclasses/vanguard.json', { type: 'application/json' }),
      new File([JSON.stringify(subclass('warden', 'Warden'))], 'subclasses/warden.json', { type: 'application/json' }),
    ])
    const parsed = parseDnd5eContentPackageV2(result.bytes)
    expect(result.audit.complete).toBe(true)
    expect(parsed?.manifest.id).toBe('local.example.split-subclasses')
    expect(parsed?.content.subclasses.map((entry) => entry.id)).toEqual(['vanguard', 'warden'])
  })

  it.runIf(existsSync(LOCAL_PHB_COLLECTION_DIRECTORY))(
    'compiles the ignored private PHB directory through its single root manifest',
    async () => {
      const localManifest = JSON.parse(readFileSync(
        path.join(LOCAL_PHB_COLLECTION_DIRECTORY, 'collection.json'),
        'utf8',
      )) as { expected: { activities: { count: number } } }
      const result = await compileDnd5eLocalContentCollection(
        localCollectionFiles(LOCAL_PHB_COLLECTION_DIRECTORY),
      )
      const parsed = parseDnd5eContentPackageV2(result.bytes)
      expect(result.audit.complete).toBe(true)
      expect(parsed?.manifest).toMatchObject({
        id: 'local.doco.phb-2014-room',
        distributionPolicy: 'room-ephemeral',
      })
      expect(parsed?.content).toMatchObject({
        races: expect.arrayContaining([
          expect.objectContaining({ id: 'hill-dwarf', coreRaceMechanicsId: 'dwarf' }),
          expect.objectContaining({ id: 'stout-halfling', naturalOneReroll: true }),
          expect.objectContaining({
            id: 'drow',
            coreRaceMechanicsId: 'elf',
            innateSpells: expect.arrayContaining([
              expect.objectContaining({ spellId: 'faerie-fire', minimumLevel: 3 }),
            ]),
          }),
          expect.objectContaining({
            id: 'forest-gnome',
            coreRaceMechanicsId: 'gnome',
            innateSpells: expect.arrayContaining([
              expect.objectContaining({ spellId: 'minor-illusion', minimumLevel: 1 }),
            ]),
          }),
        ]),
        backgrounds: expect.arrayContaining([expect.objectContaining({ id: 'soldier' })]),
        subclasses: expect.arrayContaining([
          expect.objectContaining({ id: 'battle-master-2014' }),
          expect.objectContaining({ id: 'eldritch-knight-2014' }),
          expect.objectContaining({ id: 'totem-warrior-2014' }),
        ]),
      })
      const projection = dnd5eContentPackageActivityProjectionV1(parsed!)
      const subclassEntries = projection.entries.filter((entry) => entry.sourceKind === 'subclass-ability')
      expect(subclassEntries.filter((entry) => entry.mode === 'legacy-fallback')).toEqual([])
      expect({
        total: subclassEntries.length,
        adapted: subclassEntries.filter((entry) => entry.mode === 'adapted').length,
        dmAdjudication: subclassEntries.filter((entry) => entry.mode === 'dm-adjudication').length,
        legacyFallback: subclassEntries.filter((entry) => entry.mode === 'legacy-fallback').length,
      }).toEqual({ total: 169, adapted: 128, dmAdjudication: 41, legacyFallback: 0 })
      expect(projection.activities.filter((activity) =>
        activity.legacySource?.kind === 'subclass-ability' && activity.authorityBinding,
      )).toHaveLength(92)
      expect(projection.activities.find((activity) =>
        activity.legacySource?.id === 'trickery-domain-2014:invoke-duplicity',
      )).toMatchObject({
        target: { kind: 'area', origin: 'point', shape: 'rect', placeRangeFeet: 30 },
        outcomes: [{ operations: [expect.objectContaining({
          kind: 'create-persistent-area', utilityProjectionId: 'invoke-duplicity',
          movement: {
            economy: 'bonus-action', maximumFeet: 30, maximumDistanceFromSourceFeet: 120,
          },
        })] }],
      })
      const subclassAbilities = parsed!.content.subclasses.flatMap((subclass) =>
        subclass.abilities.map((ability) => ({ subclassId: subclass.id, ability })))
      expect(subclassAbilities.filter(({ ability }) => ability.automation === 'partial').map(
        ({ subclassId, ability }) => `${subclassId}:${ability.id}`,
      )).toEqual([
        'wild-magic-2014:wild-magic-surge',
        'knowledge-domain-2014:blessings-of-knowledge',
        'knowledge-domain-2014:knowledge-of-the-ages',
        'knowledge-domain-2014:read-thoughts',
        'nature-domain-2014:master-of-nature',
        'moon-circle-2014:thousand-forms',
        'four-elements-2014:elemental-attunement',
        'conjuration-school-2014:minor-conjuration',
        'illusion-school-2014:malleable-illusions',
        'illusion-school-2014:illusory-reality',
        'transmutation-school-2014:master-transmuter',
      ])
      expect(subclassAbilities.filter(({ ability }) =>
        ability.automation === 'manual' && ability.effects.length > 0,
      )).toEqual([])
      expect(parsed?.content.spells).toHaveLength(42)
      expect(new Set(parsed?.content.spells.map((spell) => spell.id)).size).toBe(42)
      expect(parsed?.content.spells.filter((spell) =>
        DND5E_SRD_SPELL_CATALOG.some((entry) => entry.id === spell.id),
      )).toEqual([])
      expect(parsed?.content.spells.map((spell) => spell.id)).toEqual([
        'blade-ward', 'friends', 'thorn-whip',
        'armor-of-agathys', 'arms-of-hadar', 'chromatic-orb', 'compelled-duel',
        'dissonant-whispers', 'ensnaring-strike', 'hail-of-thorns', 'hex',
        'ray-of-sickness', 'searing-smite', 'thunderous-smite', 'witch-bolt',
        'wrathful-smite', 'beast-sense', 'cloud-of-daggers', 'cordon-of-arrows',
        'crown-of-madness', 'phantasmal-force', 'aura-of-vitality', 'blinding-smite',
        'conjure-barrage', 'crusaders-mantle', 'elemental-weapon', 'feign-death',
        'hunger-of-hadar', 'lightning-arrow', 'aura-of-life', 'aura-of-purity',
        'grasping-vine', 'staggering-smite', 'banishing-smite', 'circle-of-power',
        'conjure-volley', 'destructive-wave', 'swift-quiver', 'arcane-gate',
        'telepathy', 'tsunami', 'power-word-heal',
      ])
      expect(parsed?.content.feats).toHaveLength(41)
      const combatFeatCoverage = JSON.parse(readFileSync(
        path.join(LOCAL_PHB_COLLECTION_DIRECTORY, 'feats/combat-coverage.json'),
        'utf8',
      )) as { entries: Array<{ id: string; status: string; primitives: string[]; pending: string[] }> }
      expect(new Set(combatFeatCoverage.entries.map((entry) => entry.id)).size)
        .toBe(combatFeatCoverage.entries.length)
      for (const entry of combatFeatCoverage.entries) {
        expect(parsed?.content.feats.find((feat) => feat.id === entry.id)?.automation, entry.id)
          .toBe(entry.status)
        expect(entry.primitives.length + entry.pending.length, entry.id).toBeGreaterThan(0)
      }
      expect(parsed?.content.activities).toHaveLength(localManifest.expected.activities.count)
      expect(parsed?.content.activities).toContainEqual(expect.objectContaining({
        id: 'polearm-master-butt-attack-activity',
        requirements: expect.arrayContaining([expect.objectContaining({ kind: 'attack-weapon' })]),
        outcomes: [expect.objectContaining({ operations: [expect.objectContaining({
          kind: 'grant-weapon-attack', damageDice: { count: 1, sides: 4 }, damageType: 'bludgeoning',
        })] })],
      }))
      expect(parsed?.content.items).toHaveLength(108)
      expect(parsed?.content.classes).toEqual([])
      expect(parsed?.content.monsters).toEqual([])
      expect(parsed?.content.abilityGenerationMethods).toEqual([])
      const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(parsed!))
      try {
        expect(dnd5ePluginBackgroundDefinition('local.doco.phb-2014-room:soldier')).toMatchObject({
          toolProficiencies: ['陆上载具'],
          toolProficiencyChoices: [expect.objectContaining({ id: 'gaming-set', count: 1 })],
          startingEquipment: expect.objectContaining({ fixedGrants: expect.any(Array) }),
        })
        const soldierEquipmentPlan = dnd5eStartingEquipmentPlan(
          '战士',
          'local.doco.phb-2014-room:soldier',
        )
        expect(soldierEquipmentPlan.groups.some((group) => group.source === 'background')).toBe(true)
        const soldierEquipment = resolveDnd5eStartingEquipment(
          'soldier-test',
          soldierEquipmentPlan,
          defaultDnd5eStartingEquipmentSelection(soldierEquipmentPlan),
        )
        expect(soldierEquipment.inventory.entries.some((entry) =>
          entry.templateId === 'local.doco.phb-2014-room:background-insignia',
        )).toBe(true)
        expect(soldierEquipment.inventory.entries.some((entry) =>
          entry.templateId === 'local.doco.phb-2014-room:dice-set',
        )).toBe(true)
        for (const background of parsed!.content.backgrounds) {
          const plan = dnd5eStartingEquipmentPlan('战士', `local.doco.phb-2014-room:${background.id}`)
          expect(
            plan.fixedGrants.length > 0 || plan.groups.some((group) => group.source === 'background'),
            background.id,
          ).toBe(true)
          expect(() => resolveDnd5eStartingEquipment(
            `background-${background.id}`,
            plan,
            defaultDnd5eStartingEquipmentSelection(plan),
          )).not.toThrow()
        }
        expect(dnd5ePluginBackgroundDefinition('local.doco.phb-2014-room:criminal')?.variants)
          .toContainEqual(expect.objectContaining({ id: 'spy' }))
        expect(dnd5ePluginBackgroundDefinition('local.doco.phb-2014-room:noble')?.variants)
          .toContainEqual(expect.objectContaining({ id: 'knight' }))
        expect(dnd5ePluginFeatDefinition('local.doco.phb-2014-room:lucky')).toMatchObject({
          automation: 'full',
          declarativeAbility: { mechanic: { kind: 'd20-choice-reroll' } },
        })
        const feat = (id: string) => dnd5ePluginFeatDefinition(`local.doco.phb-2014-room:${id}`)
        expect(feat('athlete')).toMatchObject({
          automation: 'full',
          staticModifiers: {
            climbWithoutSpeedCostMultiplier: 1,
            runningJumpMinimumApproachFeet: 5,
            standFromProneMovementCostFeet: 5,
          },
        })
        expect(feat('skulker')).toMatchObject({
          automation: 'partial',
          staticModifiers: { retainHiddenOnRangedWeaponMiss: true },
        })
        expect(feat('crossbow-expert')).toMatchObject({
          automation: 'full',
          staticModifiers: {
            ignoreNearbyHostileRangedAttackDisadvantage: true,
            ignoreLoadingWeaponProperty: true,
          },
        })
        expect(feat('dual-wielder')).toMatchObject({
          automation: 'partial',
          staticModifiers: { dualWieldMeleeArmorClassBonus: 1, allowNonLightTwoWeaponFighting: true },
        })
        expect(feat('durable')).toMatchObject({
          automation: 'full',
          staticModifiers: { minimumHitDieHealingConstitutionMultiplier: 2 },
        })
        expect(feat('great-weapon-master')).toMatchObject({
          automation: 'full',
          declarativeAbility: { mechanic: { kind: 'attack-tradeoff', attackRollModifier: -5, damageBonus: 10 } },
        })
        expect(feat('heavy-armor-master')).toMatchObject({
          automation: 'full',
          passiveEffects: [expect.objectContaining({ kind: 'damage-reduction', amount: 3, requiresHeavyArmor: true })],
        })
        expect(feat('medium-armor-master')).toMatchObject({
          automation: 'full',
          staticModifiers: { mediumArmorDexterityCapBonus: 1, ignoreMediumArmorStealthDisadvantage: true },
        })
        expect(feat('polearm-master')).toMatchObject({
          automation: 'full',
          staticModifiers: { opportunityAttacksOnEnterReachWeaponIds: expect.arrayContaining(['dnd5e-quarterstaff']) },
        })
        expect(feat('sentinel')).toMatchObject({
          automation: 'full',
          staticModifiers: { opportunityAttacksIgnoreDisengage: true, opportunityAttackHitStopsMovement: true },
          declarativeAbility: { mechanic: { kind: 'reaction-weapon-attack', event: 'enemy-attacks-other' } },
        })
        expect(feat('mage-slayer')).toMatchObject({
          automation: 'full',
          staticModifiers: {
            spellSavingThrowAdvantageWithinFeet: 5,
            imposeConcentrationCheckDisadvantageOnDamage: true,
          },
          declarativeAbility: { mechanic: { kind: 'reaction-weapon-attack', event: 'nearby-creature-casts-spell' } },
        })
        expect(feat('mounted-combatant')).toMatchObject({
          automation: 'full',
          staticModifiers: {
            mountedMeleeAdvantageAgainstSmallerUnmounted: true,
            redirectMountedCreatureAttacksToRider: true,
            grantMountedCreatureDexterityEvasion: true,
          },
        })
        expect(feat('mobile')).toMatchObject({
          automation: 'full',
          staticModifiers: {
            speedBonusFeet: 10,
            preventOpportunityAttacksFromMeleeAttackTargets: true,
            ignoreDifficultTerrainWhileDashing: true,
          },
        })
        expect(feat('observant')).toMatchObject({
          automation: 'partial', staticModifiers: { passivePerceptionBonus: 5 },
        })
        expect(feat('sharpshooter')).toMatchObject({
          automation: 'full',
          staticModifiers: { ignoreLongRangeRangedWeaponDisadvantage: true, ignoreRangedWeaponCoverBonus: true },
          declarativeAbility: { mechanic: { kind: 'attack-tradeoff', attackRollModifier: -5, damageBonus: 10 } },
        })
        expect(feat('spell-sniper')).toMatchObject({
          automation: 'full',
          staticModifiers: { spellAttackRangeMultiplier: 2, ignoreSpellAttackCoverBonus: true },
        })
        expect(feat('war-caster')).toMatchObject({
          automation: 'full',
          staticModifiers: {
            ignoreOccupiedHandsForSomaticComponents: true,
            opportunityAttackSpellReplacement: true,
          },
          declarativeAbility: { mechanic: { kind: 'passive-defense', concentrationCheckAdvantage: true } },
        })
        expect(dnd5ePluginItemDefinition('local.doco.phb-2014-room:plate-armor')).toMatchObject({
          category: 'equipment',
          equipment: { dnd5e: { kind: 'armor', baseArmorClass: 18 } },
        })
        expect(dnd5ePluginItemDefinition('local.doco.phb-2014-room:barrel')).toMatchObject({
          category: 'container', containerCapacityWeightLb: 400,
        })
        expect(dnd5ePluginSubclassSpellIds(
          'local.doco.phb-2014-room:nature-domain-2014',
          7,
          'always-prepared',
        )).toContain('local.doco.phb-2014-room:grasping-vine')
        expect(dnd5ePluginSpellDefinition('local.doco.phb-2014-room:grasping-vine'))
          .toMatchObject({
            name: '抓握藤蔓',
            automation: { mode: 'headless-action', actionId: 'grasping-vine-activity' },
          })
        expect(dnd5ePluginHeadlessActionDefinition(
          'local.doco.phb-2014-room',
          'grasping-vine-control-activity',
        )).toMatchObject({ execution: 'trusted' })
        expect(dnd5ePluginFeatureDefinition(
          'local.doco.phb-2014-room:area-control.grasping-vine-control-activity',
        )?.action).toMatchObject({
          id: 'grasping-vine-control-activity',
          economy: 'bonusAction',
          targeting: { kind: 'single-creature', rangeFeet: 30 },
        })
        expect(dnd5ePluginSubclassSpellIds(
          'local.doco.phb-2014-room:great-old-one-2014',
          1,
          'expanded-list',
        )).toContain('hideous-laughter')
        expect(dnd5ePluginSubclassSpellIds(
          'local.doco.phb-2014-room:great-old-one-2014',
          7,
          'expanded-list',
        )).toContain('black-tentacles')
      } finally {
        dispose()
      }
    },
  )

  it('在浏览器内合并 CSV 并将 AI 图片绑定到稳定条目 ID', async () => {
    const collection = {
      format: DND5E_LOCAL_CONTENT_COLLECTION_FORMAT,
      schemaVersion: DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION,
      manifest: {
        id: 'local.example.csv-room',
        name: 'CSV Room Collection',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Local DM',
        license: 'Private local use',
        contentCategory: 'mixed',
      },
      json: { feats: 'feats.json' },
      csv: { features: 'features.csv' },
      expected: {
        features: { ids: ['steady'], count: 1, imageRequired: true },
        feats: { ids: ['watchful'], count: 1, imageRequired: true },
      },
      images: [{
        id: 'steady-icon',
        file: 'images/steady.png',
        origin: 'ai-generated',
        prompt: 'This local prompt must never be copied into the package.',
        targets: [{ category: 'feature', id: 'steady', slot: 'icon' }],
      }],
    }
    const result = await compileDnd5eLocalContentCollection([
      new File([JSON.stringify(collection)], 'collection.json', { type: 'application/json' }),
      new File([
        'id,name,summary,description,automation\n' +
        'steady,Steady,Local summary,Local rules text,manual\n',
      ], 'features.csv', { type: 'text/csv' }),
      new File([JSON.stringify([{
        id: 'watchful',
        name: 'Watchful',
        summary: 'Local summary.',
        description: 'Local rules text.',
        automation: 'manual',
      }])], 'feats.json', { type: 'application/json' }),
      new File([Buffer.from(ONE_PIXEL_PNG, 'base64')], 'images/steady.png', { type: 'image/png' }),
    ])
    const parsed = parseDnd5eContentPackageV2(result.bytes)
    expect(parsed?.manifest.distributionPolicy).toBe('room-ephemeral')
    expect(parsed?.content.features[0]).toMatchObject({
      id: 'steady',
      iconAssetId: 'steady-icon',
    })
    expect(parsed?.assets[0].dataBase64).toBe(ONE_PIXEL_PNG)
    expect(new TextDecoder().decode(result.bytes)).not.toContain('This local prompt')
    expect(result.audit).toMatchObject({
      complete: false,
      totals: {
        entries: 2,
        expectedEntries: 2,
        countShortfall: 0,
        missingIds: 0,
        missingImages: 1,
      },
      privacy: {
        includesSourceText: false,
        includesImageData: false,
        includesImagePrompts: false,
      },
    })
    expect(result.audit.categories.feats.missingImageIds).toEqual(['watchful'])
  })

  it('keeps the checked-in local collection template empty and requires content before import', async () => {
    const names = [
      'collection.json',
      'races.json',
      'subclasses.json',
      'spells.json',
      'items.json',
      'monsters.json',
      'features.csv',
      'feats.csv',
    ]
    const files = names.map((name) => new File([
      readFileSync(new URL(`../../../examples/phb-local-collection-template/${name}`, import.meta.url)),
    ], name))
    await expect(compileDnd5eLocalContentCollection(files))
      .rejects
      .toThrow('请至少添加一种规则内容。')
  })
})
