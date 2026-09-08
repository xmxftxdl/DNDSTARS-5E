import { describe, expect, it } from 'vitest'
import {
  dnd5eActivityManualAdjudicationOperationsV1,
} from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5eActivityAutomationAnalysisV1 } from './plugins/pluginMechanicsRegistry'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import {
  dnd5eActivityFromMonsterAction,
  type Dnd5eLegacyMonsterActionCollection,
} from './activities/legacyContentActivityAdapters'
import { DND5E_SRD_MONSTERS, type Dnd5eMonsterAction } from './monsters'
import { dnd5eMonsterActionAutomation } from './monsterSchema'

/**
 * Exact semantic-audit keys for complex actions that use shared runtime
 * primitives. Keeping the exact monster/collection/action tuple here makes
 * their Headless claim auditable instead of inheriting confidence from a
 * generic multiattack, area or legendary-action test.
 */
const VERIFIED_COMPLEX_ACTION_KEYS = [
  'adult-blue-dragon:legendaryActions:wing-attack-costs-2-actions',
  'adult-green-dragon:actions:multiattack',
  'adult-green-dragon:actions:frightful-presence',
  'adult-green-dragon:actions:poison-breath',
  'adult-green-dragon:actions:multiattack-weapons-only',
  'adult-green-dragon:legendaryActions:detect',
  'adult-green-dragon:legendaryActions:wing-attack-costs-2-actions',
  'adult-red-dragon:actions:multiattack',
  'adult-red-dragon:actions:frightful-presence',
  'adult-red-dragon:actions:fire-breath',
  'adult-red-dragon:actions:multiattack-weapons-only',
  'adult-red-dragon:legendaryActions:detect',
  'adult-red-dragon:legendaryActions:wing-attack-costs-2-actions',
  'adult-silver-dragon:actions:multiattack',
  'adult-silver-dragon:actions:frightful-presence',
  'adult-silver-dragon:actions:breath-weapons',
  'adult-silver-dragon:actions:multiattack-weapons-only',
  'adult-silver-dragon:legendaryActions:detect',
  'adult-silver-dragon:legendaryActions:wing-attack-costs-2-actions',
  'adult-white-dragon:actions:multiattack',
  'adult-white-dragon:actions:frightful-presence',
  'adult-white-dragon:actions:cold-breath',
  'adult-white-dragon:actions:multiattack-weapons-only',
  'adult-white-dragon:legendaryActions:detect',
  'adult-white-dragon:legendaryActions:wing-attack-costs-2-actions',
  'air-elemental:actions:multiattack',
  'ancient-black-dragon:actions:multiattack',
  'ancient-black-dragon:actions:frightful-presence',
  'ancient-black-dragon:actions:acid-breath',
  'ancient-black-dragon:actions:multiattack-weapons-only',
  'ancient-black-dragon:legendaryActions:detect',
  'ancient-black-dragon:legendaryActions:wing-attack-costs-2-actions',
  'ancient-blue-dragon:actions:multiattack',
  'ancient-blue-dragon:actions:frightful-presence',
  'ancient-blue-dragon:actions:lightning-breath',
  'ancient-blue-dragon:actions:multiattack-weapons-only',
  'ancient-blue-dragon:legendaryActions:detect',
  'ancient-blue-dragon:legendaryActions:wing-attack-costs-2-actions',
  'ancient-brass-dragon:actions:multiattack',
  'ancient-brass-dragon:actions:frightful-presence',
  'ancient-brass-dragon:actions:breath-weapons',
  'ancient-brass-dragon:actions:multiattack-weapons-only',
  'ancient-brass-dragon:legendaryActions:detect',
  'ancient-brass-dragon:legendaryActions:wing-attack-costs-2-actions',
  'ancient-green-dragon:actions:multiattack',
  'ancient-green-dragon:actions:frightful-presence',
  'ancient-green-dragon:actions:multiattack-weapons-only',
  'ancient-green-dragon:legendaryActions:detect',
  'ancient-green-dragon:legendaryActions:wing-attack-costs-2-actions',
  'ancient-red-dragon:actions:multiattack',
  'ancient-red-dragon:actions:frightful-presence',
  'ancient-red-dragon:actions:fire-breath',
  'ancient-red-dragon:actions:multiattack-weapons-only',
  'ancient-red-dragon:legendaryActions:detect',
  'ancient-red-dragon:legendaryActions:wing-attack-costs-2-actions',
  'ancient-silver-dragon:legendaryActions:wing-attack-costs-2-actions',
  'ancient-white-dragon:actions:multiattack',
  'ancient-white-dragon:actions:frightful-presence',
  'ancient-white-dragon:actions:multiattack-weapons-only',
  'ancient-white-dragon:legendaryActions:detect',
  'ancient-white-dragon:legendaryActions:wing-attack-costs-2-actions',
  'animated-armor:actions:multiattack',
  'ape:actions:multiattack',
  'brown-bear:actions:multiattack',
  'chimera:actions:multiattack-fire-breath-instead-of-bite',
  'chimera:actions:multiattack-fire-breath-instead-of-horns',
  'deva:actions:multiattack',
  'earth-elemental:actions:multiattack',
  'ettin:actions:multiattack',
  'fire-giant:actions:multiattack',
  'frost-giant:actions:multiattack',
  'gargoyle:actions:multiattack',
  'giant-ape:actions:multiattack',
  'giant-badger:actions:multiattack',
  'giant-eagle:actions:multiattack',
  'giant-vulture:actions:multiattack',
  'griffon:actions:multiattack',
  'harpy:actions:multiattack',
  'hezrou:actions:multiattack',
  'hill-giant:actions:multiattack',
  'hippogriff:actions:multiattack',
  'ice-devil:actions:multiattack',
  'invisible-stalker:actions:multiattack',
  'knight:actions:multiattack',
  'planetar:actions:multiattack',
  'polar-bear:actions:multiattack',
  'shield-guardian:actions:multiattack',
  'solar:actions:multiattack',
  'stone-golem:actions:multiattack',
  'storm-giant:actions:multiattack',
  'swarm-of-bats:actions:bites',
  'swarm-of-beetles:actions:bites',
  'swarm-of-insects:actions:bites',
  'swarm-of-quippers:actions:bites',
  'swarm-of-ravens:actions:beaks',
  'swarm-of-spiders:actions:bites',
  'swarm-of-wasps:actions:bites',
  'thug:actions:multiattack',
  'treant:actions:multiattack',
  'troll:actions:multiattack',
  'vampire-spawn:actions:multiattack-claws-and-grapple',
  'vampire-spawn:actions:multiattack-grapple-and-claws',
  'vampire-spawn:actions:multiattack-grapples',
  'vampire-vampire:actions:multiattack-unarmed-strike-and-grapple',
  'vampire-vampire:actions:multiattack-grapple-and-unarmed-strike',
  'vampire-vampire:actions:multiattack-unarmed-grapples',
  'vrock:actions:multiattack',
  'water-elemental:actions:multiattack',
  'xorn:actions:multiattack',
] as const

function actionCollection(
  monster: (typeof DND5E_SRD_MONSTERS)[number],
  section: Dnd5eLegacyMonsterActionCollection,
): readonly Dnd5eMonsterAction[] {
  if (section === 'actions') return monster.actions
  if (section === 'bonusActions') return monster.bonusActions ?? []
  if (section === 'reactions') return monster.reactions ?? []
  if (section === 'legendaryActions') return monster.legendaryActions ?? []
  return monster.lairActions ?? []
}

describe('exact complex monster Headless action contracts', () => {
  it.each(VERIFIED_COMPLEX_ACTION_KEYS)('%s has a complete executable runtime contract', (key) => {
    const [slug, sectionValue, actionId] = key.split(':')
    const section = sectionValue as Dnd5eLegacyMonsterActionCollection
    const monster = DND5E_SRD_MONSTERS.find((entry) => entry.slug === slug)
    expect(monster, key).toBeDefined()
    if (!monster) return
    const action = actionCollection(monster, section).find((entry) => entry.id === actionId)
    expect(action, key).toBeDefined()
    if (!action) return

    expect(dnd5eMonsterActionAutomation(action), key).toBe('headless')
    if (action.kind === 'multiattack') {
      const referencedIds = [
        ...(action.sequence ?? []),
        ...(action.randomRepeat ? [action.randomRepeat.actionId] : []),
      ]
      expect(referencedIds.length, key).toBeGreaterThan(0)
      const allActions = [
        ...monster.actions,
        ...(monster.bonusActions ?? []),
        ...(monster.reactions ?? []),
        ...(monster.legendaryActions ?? []),
        ...(monster.lairActions ?? []),
      ]
      for (const childId of referencedIds) {
        const child = allActions.find((entry) => entry.id === childId)
        expect(child, `${key} -> ${childId}`).toBeDefined()
        if (!child) continue
        expect(dnd5eMonsterActionAutomation(child), `${key} -> ${childId}`).toBe('headless')
      }
    }

    // These closed rule kinds are executed by the monster action transaction
    // rather than the generic Activity executor. Validate every field the
    // shared runtime consumes, then stop before checking the compatibility
    // Activity (which intentionally remains a manual projection for now).
    if (action.rule?.kind === 'ability-check') {
      expect(action.rule, key).toMatchObject({
        ability: expect.stringMatching(/^(?:str|dex|con|int|wis|cha)$/),
      })
      return
    }
    if (action.rule?.kind === 'legendary-wing-attack') {
      expect(action.rule, key).toMatchObject({
        target: 'all-creatures-except-self', ability: 'dex',
        damage: expect.objectContaining({ count: expect.any(Number), sides: expect.any(Number) }),
        damageOnSuccessfulSave: 'none', conditionOnFailedSave: 'prone',
        followUpMovement: { kind: 'grant-fly-movement', maximumSpeedFraction: 0.5 },
      })
      expect(action.rule.rangeFeet, key).toBeGreaterThan(0)
      expect(action.rule.dc, key).toBeGreaterThan(0)
      return
    }
    if (action.rule?.kind === 'area-saving-throw' && action.rule.variants) {
      expect(action.rule.variants.length, key).toBeGreaterThan(1)
      for (const variant of action.rule.variants) {
        const primaryDimension = variant.area.shape === 'circle'
          ? variant.area.radiusFeet
          : variant.area.shape === 'rect'
            ? Math.min(variant.area.widthFeet, variant.area.heightFeet)
            : variant.area.lengthFeet
        expect(primaryDimension, `${key}:${variant.id}`).toBeGreaterThan(0)
        expect(variant.dc, `${key}:${variant.id}`).toBeGreaterThan(0)
        expect(variant.ability, `${key}:${variant.id}`)
          .toMatch(/^(?:str|dex|con|int|wis|cha)$/)
        expect(Boolean(variant.damage || variant.conditionOnFailedSave), `${key}:${variant.id}`)
          .toBe(true)
        if (variant.damage) {
          expect(variant.damage.count, `${key}:${variant.id}`).toBeGreaterThan(0)
          expect(variant.damage.sides, `${key}:${variant.id}`).toBeGreaterThan(1)
        }
      }
      return
    }

    const activity = dnd5eActivityFromMonsterAction(monster, action, section)
    expect(validateDnd5eActivityDefinitionV1(activity), key).toEqual([])
    expect(dnd5eActivityManualAdjudicationOperationsV1(activity), key).toEqual([])
    expect(dnd5eActivityAutomationAnalysisV1(activity), key).toMatchObject({
      capability: { level: 'full' }, missingComponents: [],
    })
  })
})
