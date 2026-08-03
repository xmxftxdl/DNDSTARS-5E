import { describe, expect, it } from 'vitest'
import { projectCharacterTokenPresentations, type Token } from './maps'
import { createDnd5eMechanicalEffect } from '../rulesets/dnd5e/activeEffects'

function token(patch: Partial<Token> = {}): Token {
  return {
    id: 'token-1',
    label: '旧名称',
    x: 0,
    y: 0,
    color: '#fff',
    emoji: '🛡️',
    size: 1,
    type: 'player',
    characterId: 'character-1',
    ...patch,
  }
}

describe('character token presentation', () => {
  it('projects the current character avatar and name onto an existing map token', () => {
    expect(projectCharacterTokenPresentations([token()], [
      { id: 'character-1', name: '艾利娅', avatar: '🧙‍♀️' },
    ])).toMatchObject([{ label: '艾利娅', emoji: '🧙‍♀️' }])
  })

  it('does not alter unlinked tokens or allocate a new array without changes', () => {
    const original = [token({ characterId: undefined })]
    expect(projectCharacterTokenPresentations(original, [])).toBe(original)
  })

  it('projects full portrait and the separately cropped map token from the character', () => {
    const projected = projectCharacterTokenPresentations([token()], [{
      id: 'character-1',
      name: 'Hero',
      avatar: 'H',
      portrait: 'data:image/webp;base64,AAAA',
      tokenPortrait: 'data:image/webp;base64,BBBB',
    }])
    expect(projected[0]).toMatchObject({
      portrait: 'data:image/webp;base64,AAAA',
      tokenPortrait: 'data:image/webp;base64,BBBB',
    })
  })

  it('projects temporary Darkvision without overwriting the stored token range', () => {
    const original = token({ darkvisionRangeFeet: 30 })
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:darkvision',
      label: '黑暗视觉',
      targetId: original.id,
      source: { kind: 'spell', actorId: 'caster', rulesId: 'darkvision' },
      modifiers: { darkvisionRangeFeet: 60 },
    })
    const projected = projectCharacterTokenPresentations([original], [{
      id: 'character-1',
      name: original.label,
      avatar: original.emoji,
      dnd5eCombatState: { activeEffects: [effect] },
    }])
    expect(projected[0].darkvisionRangeFeet).toBe(60)
    expect(original.darkvisionRangeFeet).toBe(30)
    const withoutEffect = [original]
    expect(projectCharacterTokenPresentations(withoutEffect, [{
      id: 'character-1',
      name: original.label,
      avatar: original.emoji,
    }])).toBe(withoutEffect)
    expect(original.darkvisionRangeFeet).toBe(30)
  })

  it('projects resolved character Darkvision and Devil’s Sight into the same client profile', () => {
    const projected = projectCharacterTokenPresentations([token()], [{
      id: 'character-1',
      name: '契术师',
      avatar: 'W',
      darkvisionRangeFeet: 60,
      dnd5eClassChoices: {
        classes: {
          warlock: {
            selections: { 'eldritch-invocations': ['devils-sight'] },
          },
        },
      },
    }])
    expect(projected[0]).toMatchObject({
      darkvisionRangeFeet: 60,
      darknessSightRangeFeet: 120,
      magicalDarknessSightRangeFeet: 120,
    })
  })

  it('projects bundled initiative portraits and map tokens for new and legacy monster ids', () => {
    const cases = [
      {
        ids: ['srd-5.1:goblin', 'goblin'],
        asset: 'goblin-forest-scout',
      },
      {
        ids: ['srd-5.1:bugbear', 'bugbear'],
        asset: 'bugbear-forest-raider',
      },
    ]
    for (const { ids, asset } of cases) {
      for (const poolId of ids) {
        const projected = projectCharacterTokenPresentations([
          token({ type: 'enemy', characterId: undefined, poolId }),
        ], [])
        expect(projected[0]).toMatchObject({
          portrait: `/assets/portraits/${asset}-initiative.png`,
          tokenPortrait: `/assets/portraits/${asset}-token.png`,
        })
      }
    }
    for (const poolId of ['srd-5.1:air-elemental', 'air-elemental']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/air-elemental-storm-canyon-initiative.png',
        tokenPortrait: '/assets/portraits/air-elemental-storm-canyon-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ancient-black-dragon', 'ancient-black-dragon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ancient-black-dragon-stygian-swamp-initiative.png',
        tokenPortrait: '/assets/portraits/ancient-black-dragon-stygian-swamp-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ancient-blue-dragon', 'ancient-blue-dragon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ancient-blue-dragon-thunder-necropolis-initiative.png',
        tokenPortrait: '/assets/portraits/ancient-blue-dragon-thunder-necropolis-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ancient-brass-dragon', 'ancient-brass-dragon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ancient-brass-dragon-canyon-fireflight-initiative.png',
        tokenPortrait: '/assets/portraits/ancient-brass-dragon-canyon-fireflight-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ancient-bronze-dragon', 'ancient-bronze-dragon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ancient-bronze-dragon-tempest-coast-initiative.png',
        tokenPortrait: '/assets/portraits/ancient-bronze-dragon-tempest-coast-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ancient-copper-dragon', 'ancient-copper-dragon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ancient-copper-dragon-sunset-acidfall-initiative.png',
        tokenPortrait: '/assets/portraits/ancient-copper-dragon-sunset-acidfall-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ancient-gold-dragon', 'ancient-gold-dragon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ancient-gold-dragon-cloud-citadel-fire-initiative.png',
        tokenPortrait: '/assets/portraits/ancient-gold-dragon-cloud-citadel-fire-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ancient-green-dragon', 'ancient-green-dragon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ancient-green-dragon-primordial-stalker-initiative.png',
        tokenPortrait: '/assets/portraits/ancient-green-dragon-primordial-stalker-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ancient-red-dragon', 'ancient-red-dragon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ancient-red-dragon-caldera-tyrant-initiative.png',
        tokenPortrait: '/assets/portraits/ancient-red-dragon-caldera-tyrant-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ancient-silver-dragon', 'ancient-silver-dragon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ancient-silver-dragon-alpine-skyflight-initiative.png',
        tokenPortrait: '/assets/portraits/ancient-silver-dragon-alpine-skyflight-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ancient-white-dragon', 'ancient-white-dragon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ancient-white-dragon-glacier-cavern-hunter-initiative.png',
        tokenPortrait: '/assets/portraits/ancient-white-dragon-glacier-cavern-hunter-token.png',
      })
    }
    for (const poolId of ['srd-5.1:androsphinx', 'androsphinx']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/androsphinx-sunset-procession-initiative.png',
        tokenPortrait: '/assets/portraits/androsphinx-sunset-procession-token.png',
      })
    }
    for (const poolId of ['srd-5.1:animated-armor', 'animated-armor']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/animated-armor-blacksteel-haunt-initiative.png',
        tokenPortrait: '/assets/portraits/animated-armor-blacksteel-haunt-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ankheg', 'ankheg']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ankheg-root-tunnel-stalker-initiative.png',
        tokenPortrait: '/assets/portraits/ankheg-root-tunnel-stalker-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ape', 'ape']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ape-rainforest-silverback-initiative.png',
        tokenPortrait: '/assets/portraits/ape-rainforest-silverback-token.png',
      })
    }
    for (const poolId of ['srd-5.1:archmage', 'archmage']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/archmage-stellar-observatory-initiative.png',
        tokenPortrait: '/assets/portraits/archmage-stellar-observatory-token.png',
      })
    }
    for (const poolId of ['srd-5.1:assassin', 'assassin']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/assassin-rainroof-blade-initiative.png',
        tokenPortrait: '/assets/portraits/assassin-rainroof-blade-token.png',
      })
    }
    for (const poolId of ['srd-5.1:awakened-shrub', 'awakened-shrub']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/awakened-shrub-spring-bloom-initiative.png',
        tokenPortrait: '/assets/portraits/awakened-shrub-spring-bloom-token.png',
      })
    }
    for (const poolId of ['srd-5.1:awakened-tree', 'awakened-tree']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/awakened-tree-sunrise-oak-initiative.png',
        tokenPortrait: '/assets/portraits/awakened-tree-sunrise-oak-token.png',
      })
    }
    for (const poolId of ['srd-5.1:azer', 'azer']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/azer-magma-forge-smith-initiative.png',
        tokenPortrait: '/assets/portraits/azer-magma-forge-smith-token.png',
      })
    }
    for (const poolId of ['srd-5.1:baboon', 'baboon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/baboon-jungle-sentinel-initiative.png',
        tokenPortrait: '/assets/portraits/baboon-jungle-sentinel-token.png',
      })
    }
    for (const poolId of ['srd-5.1:badger', 'badger']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/badger-woodland-burrower-initiative.png',
        tokenPortrait: '/assets/portraits/badger-woodland-burrower-token.png',
      })
    }
    for (const poolId of ['srd-5.1:balor', 'balor']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/balor-volcanic-warlord-initiative.png',
        tokenPortrait: '/assets/portraits/balor-volcanic-warlord-token.png',
      })
    }
    for (const poolId of ['srd-5.1:bandit-captain', 'bandit-captain']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/bandit-captain-road-camp-commander-initiative.png',
        tokenPortrait: '/assets/portraits/bandit-captain-road-camp-commander-token.png',
      })
    }
    for (const poolId of ['srd-5.1:barbed-devil', 'barbed-devil']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/barbed-devil-iron-battlement-stalker-initiative.png',
        tokenPortrait: '/assets/portraits/barbed-devil-iron-battlement-stalker-token.png',
      })
    }
    for (const poolId of ['srd-5.1:basilisk', 'basilisk']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/basilisk-petrified-garden-stalker-initiative.png',
        tokenPortrait: '/assets/portraits/basilisk-petrified-garden-stalker-token.png',
      })
    }
    for (const poolId of ['srd-5.1:bat', 'bat']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/bat-moonlit-cavern-flight-initiative.png',
        tokenPortrait: '/assets/portraits/bat-moonlit-cavern-flight-token.png',
      })
    }
    for (const poolId of ['srd-5.1:bearded-devil', 'bearded-devil']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/bearded-devil-infernal-legionnaire-initiative.png',
        tokenPortrait: '/assets/portraits/bearded-devil-infernal-legionnaire-token.png',
      })
    }
    for (const poolId of ['srd-5.1:behir', 'behir']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/behir-storm-gorge-climber-initiative.png',
        tokenPortrait: '/assets/portraits/behir-storm-gorge-climber-token.png',
      })
    }
    for (const poolId of ['srd-5.1:berserker', 'berserker']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/berserker-snowfield-charge-initiative.png',
        tokenPortrait: '/assets/portraits/berserker-snowfield-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:black-bear', 'black-bear']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/black-bear-rainforest-charge-initiative.png',
        tokenPortrait: '/assets/portraits/black-bear-rainforest-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:black-dragon-wyrmling', 'black-dragon-wyrmling']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/black-dragon-wyrmling-drowned-shrine-stalker-initiative.png',
        tokenPortrait: '/assets/portraits/black-dragon-wyrmling-drowned-shrine-stalker-token.png',
      })
    }
    for (const poolId of ['srd-5.1:black-pudding', 'black-pudding']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/black-pudding-dungeon-step-flow-initiative.png',
        tokenPortrait: '/assets/portraits/black-pudding-dungeon-step-flow-token.png',
      })
    }
    for (const poolId of ['srd-5.1:blink-dog', 'blink-dog']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/blink-dog-moonstone-leap-initiative.png',
        tokenPortrait: '/assets/portraits/blink-dog-moonstone-leap-token.png',
      })
    }
    for (const poolId of ['srd-5.1:blood-hawk', 'blood-hawk']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/blood-hawk-red-canyon-dive-initiative.png',
        tokenPortrait: '/assets/portraits/blood-hawk-red-canyon-dive-token.png',
      })
    }
    for (const poolId of ['srd-5.1:blue-dragon-wyrmling', 'blue-dragon-wyrmling']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/blue-dragon-wyrmling-sunlit-dune-runner-initiative.png',
        tokenPortrait: '/assets/portraits/blue-dragon-wyrmling-sunlit-dune-runner-token.png',
      })
    }
    for (const poolId of ['srd-5.1:boar', 'boar']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/boar-autumn-mud-charge-initiative.png',
        tokenPortrait: '/assets/portraits/boar-autumn-mud-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:bone-devil', 'bone-devil']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/bone-devil-iron-watchtower-sentinel-initiative.png',
        tokenPortrait: '/assets/portraits/bone-devil-iron-watchtower-sentinel-token.png',
      })
    }
    for (const poolId of ['srd-5.1:brass-dragon-wyrmling', 'brass-dragon-wyrmling']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/brass-dragon-wyrmling-desert-library-explorer-initiative.png',
        tokenPortrait: '/assets/portraits/brass-dragon-wyrmling-desert-library-explorer-token.png',
      })
    }
    for (const poolId of ['srd-5.1:bronze-dragon-wyrmling', 'bronze-dragon-wyrmling']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/bronze-dragon-wyrmling-tidal-ruin-explorer-initiative.png',
        tokenPortrait: '/assets/portraits/bronze-dragon-wyrmling-tidal-ruin-explorer-token.png',
      })
    }
    for (const poolId of ['srd-5.1:brown-bear', 'brown-bear']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/brown-bear-alpine-roar-initiative.png',
        tokenPortrait: '/assets/portraits/brown-bear-alpine-roar-token.png',
      })
    }
    for (const poolId of ['srd-5.1:bulette', 'bulette']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/bulette-farmland-eruption-initiative.png',
        tokenPortrait: '/assets/portraits/bulette-farmland-eruption-token.png',
      })
    }
    for (const poolId of ['srd-5.1:camel', 'camel']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/camel-sunrise-dune-walker-initiative.png',
        tokenPortrait: '/assets/portraits/camel-sunrise-dune-walker-token.png',
      })
    }
    for (const poolId of ['srd-5.1:cat', 'cat']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/cat-rainy-rooftop-leap-initiative.png',
        tokenPortrait: '/assets/portraits/cat-rainy-rooftop-leap-token.png',
      })
    }
    for (const poolId of ['srd-5.1:centaur', 'centaur']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/centaur-storm-grassland-lancer-initiative.png',
        tokenPortrait: '/assets/portraits/centaur-storm-grassland-lancer-token.png',
      })
    }
    for (const poolId of ['srd-5.1:chain-devil', 'chain-devil']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/chain-devil-iron-prison-march-initiative.png',
        tokenPortrait: '/assets/portraits/chain-devil-iron-prison-march-token.png',
      })
    }
    for (const poolId of ['srd-5.1:chimera', 'chimera']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/chimera-mountain-temple-guardian-initiative.png',
        tokenPortrait: '/assets/portraits/chimera-mountain-temple-guardian-token.png',
      })
    }
    for (const poolId of ['srd-5.1:chuul', 'chuul']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/chuul-moonlit-swamp-ambusher-initiative.png',
        tokenPortrait: '/assets/portraits/chuul-moonlit-swamp-ambusher-token.png',
      })
    }
    for (const poolId of ['srd-5.1:clay-golem', 'clay-golem']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/clay-golem-sealed-temple-guardian-initiative.png',
        tokenPortrait: '/assets/portraits/clay-golem-sealed-temple-guardian-token.png',
      })
    }
    for (const poolId of ['srd-5.1:cloaker', 'cloaker']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/cloaker-cavern-ceiling-ambush-initiative.png',
        tokenPortrait: '/assets/portraits/cloaker-cavern-ceiling-ambush-token.png',
      })
    }
    for (const poolId of ['srd-5.1:cloud-giant', 'cloud-giant']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/cloud-giant-floating-palace-noble-initiative.png',
        tokenPortrait: '/assets/portraits/cloud-giant-floating-palace-noble-token.png',
      })
    }
    for (const poolId of ['srd-5.1:cockatrice', 'cockatrice']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/cockatrice-misty-farm-threat-initiative.png',
        tokenPortrait: '/assets/portraits/cockatrice-misty-farm-threat-token.png',
      })
    }
    for (const poolId of ['srd-5.1:commoner', 'commoner']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/commoner-dawn-village-farmer-initiative.png',
        tokenPortrait: '/assets/portraits/commoner-dawn-village-farmer-token.png',
      })
    }
    for (const poolId of ['srd-5.1:constrictor-snake', 'constrictor-snake']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/constrictor-snake-jungle-branch-coil-initiative.png',
        tokenPortrait: '/assets/portraits/constrictor-snake-jungle-branch-coil-token.png',
      })
    }
    for (const poolId of ['srd-5.1:copper-dragon-wyrmling', 'copper-dragon-wyrmling']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/copper-dragon-wyrmling-red-canyon-leap-initiative.png',
        tokenPortrait: '/assets/portraits/copper-dragon-wyrmling-red-canyon-leap-token.png',
      })
    }
    for (const poolId of ['srd-5.1:couatl', 'couatl']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/couatl-sunrise-cloud-temple-initiative.png',
        tokenPortrait: '/assets/portraits/couatl-sunrise-cloud-temple-token.png',
      })
    }
    for (const poolId of ['srd-5.1:crab', 'crab']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/crab-sunrise-tidepool-defense-initiative.png',
        tokenPortrait: '/assets/portraits/crab-sunrise-tidepool-defense-token.png',
      })
    }
    for (const poolId of ['srd-5.1:crocodile', 'crocodile']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/crocodile-sunlit-riverbank-bask-initiative.png',
        tokenPortrait: '/assets/portraits/crocodile-sunlit-riverbank-bask-token.png',
      })
    }
    for (const poolId of ['srd-5.1:cult-fanatic', 'cult-fanatic']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/cult-fanatic-ossuary-book-ritual-initiative.png',
        tokenPortrait: '/assets/portraits/cult-fanatic-ossuary-book-ritual-token.png',
      })
    }
    for (const poolId of ['srd-5.1:cultist', 'cultist']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/cultist-fog-harbor-guard-initiative.png',
        tokenPortrait: '/assets/portraits/cultist-fog-harbor-guard-token.png',
      })
    }
    for (const poolId of ['srd-5.1:darkmantle', 'darkmantle']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/darkmantle-stalactite-camouflage-initiative.png',
        tokenPortrait: '/assets/portraits/darkmantle-stalactite-camouflage-token.png',
      })
    }
    for (const poolId of ['srd-5.1:death-dog', 'death-dog']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/death-dog-blue-graveyard-stalk-initiative.png',
        tokenPortrait: '/assets/portraits/death-dog-blue-graveyard-stalk-token.png',
      })
    }
    for (const poolId of ['srd-5.1:deep-gnome-svirfneblin', 'deep-gnome-svirfneblin']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/deep-gnome-svirfneblin-crystal-mine-guard-initiative.png',
        tokenPortrait: '/assets/portraits/deep-gnome-svirfneblin-crystal-mine-guard-token.png',
      })
    }
    for (const poolId of ['srd-5.1:deer', 'deer']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/deer-autumn-sunrise-stag-initiative.png',
        tokenPortrait: '/assets/portraits/deer-autumn-sunrise-stag-token.png',
      })
    }
    for (const poolId of ['srd-5.1:deva', 'deva']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/deva-golden-archive-guardian-initiative.png',
        tokenPortrait: '/assets/portraits/deva-golden-archive-guardian-token.png',
      })
    }
    for (const poolId of ['srd-5.1:dire-wolf', 'dire-wolf']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/dire-wolf-snow-cedar-stalk-initiative.png',
        tokenPortrait: '/assets/portraits/dire-wolf-snow-cedar-stalk-token.png',
      })
    }
    for (const poolId of ['srd-5.1:djinni', 'djinni']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/djinni-cloud-palace-noble-initiative.png',
        tokenPortrait: '/assets/portraits/djinni-cloud-palace-noble-token.png',
      })
    }
    for (const poolId of ['srd-5.1:doppelganger', 'doppelganger']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/doppelganger-mirror-vault-true-form-initiative.png',
        tokenPortrait: '/assets/portraits/doppelganger-mirror-vault-true-form-token.png',
      })
    }
    for (const poolId of ['srd-5.1:draft-horse', 'draft-horse']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/draft-horse-spring-field-plow-initiative.png',
        tokenPortrait: '/assets/portraits/draft-horse-spring-field-plow-token.png',
      })
    }
    for (const poolId of ['srd-5.1:dragon-turtle', 'dragon-turtle']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/dragon-turtle-sunken-city-patrol-initiative.png',
        tokenPortrait: '/assets/portraits/dragon-turtle-sunken-city-patrol-token.png',
      })
    }
    for (const poolId of ['srd-5.1:dretch', 'dretch']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/dretch-abyssal-bog-trudge-initiative.png',
        tokenPortrait: '/assets/portraits/dretch-abyssal-bog-trudge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:drider', 'drider']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/drider-underdark-bridge-archer-initiative.png',
        tokenPortrait: '/assets/portraits/drider-underdark-bridge-archer-token.png',
      })
    }
    for (const poolId of ['srd-5.1:drow', 'drow']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/drow-luminous-fungal-scout-initiative.png',
        tokenPortrait: '/assets/portraits/drow-luminous-fungal-scout-token.png',
      })
    }
    for (const poolId of ['srd-5.1:druid', 'druid']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/druid-autumn-grove-shillelagh-initiative.png',
        tokenPortrait: '/assets/portraits/druid-autumn-grove-shillelagh-token.png',
      })
    }
    for (const poolId of ['srd-5.1:dryad', 'dryad']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/dryad-spring-oak-tree-stride-initiative.png',
        tokenPortrait: '/assets/portraits/dryad-spring-oak-tree-stride-token.png',
      })
    }
    for (const poolId of ['srd-5.1:duergar', 'duergar']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/duergar-iron-forge-guard-initiative.png',
        tokenPortrait: '/assets/portraits/duergar-iron-forge-guard-token.png',
      })
    }
    for (const poolId of ['srd-5.1:dust-mephit', 'dust-mephit']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/dust-mephit-desert-tomb-breath-initiative.png',
        tokenPortrait: '/assets/portraits/dust-mephit-desert-tomb-breath-token.png',
      })
    }
    for (const poolId of ['srd-5.1:eagle', 'eagle']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/eagle-alpine-talon-dive-initiative.png',
        tokenPortrait: '/assets/portraits/eagle-alpine-talon-dive-token.png',
      })
    }
    for (const poolId of ['srd-5.1:earth-elemental', 'earth-elemental']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/earth-elemental-red-canyon-glide-initiative.png',
        tokenPortrait: '/assets/portraits/earth-elemental-red-canyon-glide-token.png',
      })
    }
    for (const poolId of ['srd-5.1:efreeti', 'efreeti']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/efreeti-brass-palace-scimitar-initiative.png',
        tokenPortrait: '/assets/portraits/efreeti-brass-palace-scimitar-token.png',
      })
    }
    for (const poolId of ['srd-5.1:elephant', 'elephant']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/elephant-savanna-trampling-charge-initiative.png',
        tokenPortrait: '/assets/portraits/elephant-savanna-trampling-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:elk', 'elk']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/elk-autumn-valley-charge-initiative.png',
        tokenPortrait: '/assets/portraits/elk-autumn-valley-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:erinyes', 'erinyes']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/erinyes-infernal-city-archer-initiative.png',
        tokenPortrait: '/assets/portraits/erinyes-infernal-city-archer-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ettercap', 'ettercap']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ettercap-redwood-web-ambush-initiative.png',
        tokenPortrait: '/assets/portraits/ettercap-redwood-web-ambush-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ettin', 'ettin']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ettin-misty-hillfort-charge-initiative.png',
        tokenPortrait: '/assets/portraits/ettin-misty-hillfort-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:fire-elemental', 'fire-elemental']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/fire-elemental-obsidian-caldera-rise-initiative.png',
        tokenPortrait: '/assets/portraits/fire-elemental-obsidian-caldera-rise-token.png',
      })
    }
    for (const poolId of ['srd-5.1:fire-giant', 'fire-giant']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/fire-giant-volcanic-forge-greatsword-initiative.png',
        tokenPortrait: '/assets/portraits/fire-giant-volcanic-forge-greatsword-token.png',
      })
    }
    for (const poolId of ['srd-5.1:flesh-golem', 'flesh-golem']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/flesh-golem-lightning-laboratory-awakening-initiative.png',
        tokenPortrait: '/assets/portraits/flesh-golem-lightning-laboratory-awakening-token.png',
      })
    }
    for (const poolId of ['srd-5.1:flying-snake', 'flying-snake']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/flying-snake-jungle-temple-flight-initiative.png',
        tokenPortrait: '/assets/portraits/flying-snake-jungle-temple-flight-token.png',
      })
    }
    for (const poolId of ['srd-5.1:flying-sword', 'flying-sword']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/flying-sword-ruined-armory-awakening-initiative.png',
        tokenPortrait: '/assets/portraits/flying-sword-ruined-armory-awakening-token.png',
      })
    }
    for (const poolId of ['srd-5.1:frog', 'frog']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/frog-rainforest-lotus-leap-initiative.png',
        tokenPortrait: '/assets/portraits/frog-rainforest-lotus-leap-token.png',
      })
    }
    for (const poolId of ['srd-5.1:frost-giant', 'frost-giant']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/frost-giant-blizzard-greataxe-initiative.png',
        tokenPortrait: '/assets/portraits/frost-giant-blizzard-greataxe-token.png',
      })
    }
    for (const poolId of ['srd-5.1:gargoyle', 'gargoyle']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/gargoyle-storm-cathedral-awakening-initiative.png',
        tokenPortrait: '/assets/portraits/gargoyle-storm-cathedral-awakening-token.png',
      })
    }
    for (const poolId of ['srd-5.1:gelatinous-cube', 'gelatinous-cube']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/gelatinous-cube-torch-dungeon-engulf-initiative.png',
        tokenPortrait: '/assets/portraits/gelatinous-cube-torch-dungeon-engulf-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ghast', 'ghast']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ghast-royal-crypt-lunge-initiative.png',
        tokenPortrait: '/assets/portraits/ghast-royal-crypt-lunge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ghost', 'ghost']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ghost-dawn-battlefield-touch-initiative.png',
        tokenPortrait: '/assets/portraits/ghost-dawn-battlefield-touch-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ghoul', 'ghoul']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ghoul-dusk-graveyard-crawl-initiative.png',
        tokenPortrait: '/assets/portraits/ghoul-dusk-graveyard-crawl-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-ape', 'giant-ape']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-ape-jungle-ground-pound-initiative.png',
        tokenPortrait: '/assets/portraits/giant-ape-jungle-ground-pound-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-badger', 'giant-badger']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-badger-autumn-burrow-lunge-initiative.png',
        tokenPortrait: '/assets/portraits/giant-badger-autumn-burrow-lunge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-bat', 'giant-bat']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-bat-cavern-bank-flight-initiative.png',
        tokenPortrait: '/assets/portraits/giant-bat-cavern-bank-flight-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-boar', 'giant-boar']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-boar-golden-forest-charge-initiative.png',
        tokenPortrait: '/assets/portraits/giant-boar-golden-forest-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-centipede', 'giant-centipede']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-centipede-jungle-temple-climb-initiative.png',
        tokenPortrait: '/assets/portraits/giant-centipede-jungle-temple-climb-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-constrictor-snake', 'giant-constrictor-snake']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-constrictor-snake-jungle-temple-strike-initiative.png',
        tokenPortrait: '/assets/portraits/giant-constrictor-snake-jungle-temple-strike-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-crab', 'giant-crab']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-crab-storm-beach-side-step-initiative.png',
        tokenPortrait: '/assets/portraits/giant-crab-storm-beach-side-step-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-crocodile', 'giant-crocodile']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-crocodile-dawn-swamp-bite-initiative.png',
        tokenPortrait: '/assets/portraits/giant-crocodile-dawn-swamp-bite-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-eagle', 'giant-eagle']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-eagle-snow-peak-talon-dive-initiative.png',
        tokenPortrait: '/assets/portraits/giant-eagle-snow-peak-talon-dive-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-elk', 'giant-elk']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-elk-snow-forest-charge-initiative.png',
        tokenPortrait: '/assets/portraits/giant-elk-snow-forest-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-fire-beetle', 'giant-fire-beetle']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-fire-beetle-crystal-cavern-glow-initiative.png',
        tokenPortrait: '/assets/portraits/giant-fire-beetle-crystal-cavern-glow-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-frog', 'giant-frog']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-frog-dawn-swamp-leap-initiative.png',
        tokenPortrait: '/assets/portraits/giant-frog-dawn-swamp-leap-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-goat', 'giant-goat']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-goat-sunset-cliff-surefoot-initiative.png',
        tokenPortrait: '/assets/portraits/giant-goat-sunset-cliff-surefoot-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-hyena', 'giant-hyena']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-hyena-savanna-rampage-initiative.png',
        tokenPortrait: '/assets/portraits/giant-hyena-savanna-rampage-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-lizard', 'giant-lizard']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-lizard-desert-ruin-climb-initiative.png',
        tokenPortrait: '/assets/portraits/giant-lizard-desert-ruin-climb-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-octopus', 'giant-octopus']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-octopus-coral-ruins-camouflage-initiative.png',
        tokenPortrait: '/assets/portraits/giant-octopus-coral-ruins-camouflage-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-owl', 'giant-owl']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-owl-moonlit-redwood-flyby-initiative.png',
        tokenPortrait: '/assets/portraits/giant-owl-moonlit-redwood-flyby-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-poisonous-snake', 'giant-poisonous-snake']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-poisonous-snake-mangrove-swim-initiative.png',
        tokenPortrait: '/assets/portraits/giant-poisonous-snake-mangrove-swim-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-rat', 'giant-rat']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-rat-sewer-sprint-initiative.png',
        tokenPortrait: '/assets/portraits/giant-rat-sewer-sprint-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-rat-diseased', 'giant-rat-diseased']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-rat-diseased-plague-alley-stalk-initiative.png',
        tokenPortrait: '/assets/portraits/giant-rat-diseased-plague-alley-stalk-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-scorpion', 'giant-scorpion']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-scorpion-desert-fortress-guard-initiative.png',
        tokenPortrait: '/assets/portraits/giant-scorpion-desert-fortress-guard-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-sea-horse', 'giant-sea-horse']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-sea-horse-coral-canyon-charge-initiative.png',
        tokenPortrait: '/assets/portraits/giant-sea-horse-coral-canyon-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-shark', 'giant-shark']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-shark-sunken-warship-patrol-initiative.png',
        tokenPortrait: '/assets/portraits/giant-shark-sunken-warship-patrol-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-spider', 'giant-spider']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-spider-moonlit-cathedral-descent-initiative.png',
        tokenPortrait: '/assets/portraits/giant-spider-moonlit-cathedral-descent-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-toad', 'giant-toad']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-toad-dawn-marsh-leap-initiative.png',
        tokenPortrait: '/assets/portraits/giant-toad-dawn-marsh-leap-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-vulture', 'giant-vulture']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-vulture-red-canyon-circle-initiative.png',
        tokenPortrait: '/assets/portraits/giant-vulture-red-canyon-circle-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-wasp', 'giant-wasp']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-wasp-dawn-orchard-dive-initiative.png',
        tokenPortrait: '/assets/portraits/giant-wasp-dawn-orchard-dive-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-weasel', 'giant-weasel']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-weasel-autumn-log-leap-initiative.png',
        tokenPortrait: '/assets/portraits/giant-weasel-autumn-log-leap-token.png',
      })
    }
    for (const poolId of ['srd-5.1:giant-wolf-spider', 'giant-wolf-spider']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/giant-wolf-spider-storm-prairie-stalk-initiative.png',
        tokenPortrait: '/assets/portraits/giant-wolf-spider-storm-prairie-stalk-token.png',
      })
    }
    for (const poolId of ['srd-5.1:gibbering-mouther', 'gibbering-mouther']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/gibbering-mouther-fungal-cavern-warp-initiative.png',
        tokenPortrait: '/assets/portraits/gibbering-mouther-fungal-cavern-warp-token.png',
      })
    }
    for (const poolId of ['srd-5.1:glabrezu', 'glabrezu']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/glabrezu-abyssal-obsidian-hall-initiative.png',
        tokenPortrait: '/assets/portraits/glabrezu-abyssal-obsidian-hall-token.png',
      })
    }
    for (const poolId of ['srd-5.1:gladiator', 'gladiator']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/gladiator-sunlit-arena-veteran-initiative.png',
        tokenPortrait: '/assets/portraits/gladiator-sunlit-arena-veteran-token.png',
      })
    }
    for (const poolId of ['srd-5.1:gnoll', 'gnoll']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/gnoll-sunset-savanna-spear-charge-initiative.png',
        tokenPortrait: '/assets/portraits/gnoll-sunset-savanna-spear-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:goat', 'goat']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/goat-alpine-meadow-charge-initiative.png',
        tokenPortrait: '/assets/portraits/goat-alpine-meadow-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:gold-dragon-wyrmling', 'gold-dragon-wyrmling']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/gold-dragon-wyrmling-sunrise-terrace-flight-initiative.png',
        tokenPortrait: '/assets/portraits/gold-dragon-wyrmling-sunrise-terrace-flight-token.png',
      })
    }
    for (const poolId of ['srd-5.1:gorgon', 'gorgon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/gorgon-sunset-basalt-charge-initiative.png',
        tokenPortrait: '/assets/portraits/gorgon-sunset-basalt-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:gray-ooze', 'gray-ooze']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/gray-ooze-torchlit-dungeon-disguise-initiative.png',
        tokenPortrait: '/assets/portraits/gray-ooze-torchlit-dungeon-disguise-token.png',
      })
    }
    for (const poolId of ['srd-5.1:green-dragon-wyrmling', 'green-dragon-wyrmling']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/green-dragon-wyrmling-rainforest-canopy-glide-initiative.png',
        tokenPortrait: '/assets/portraits/green-dragon-wyrmling-rainforest-canopy-glide-token.png',
      })
    }
    for (const poolId of ['srd-5.1:green-hag', 'green-hag']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/green-hag-flooded-cypress-stalk-initiative.png',
        tokenPortrait: '/assets/portraits/green-hag-flooded-cypress-stalk-token.png',
      })
    }
    for (const poolId of ['srd-5.1:grick', 'grick']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/grick-amber-crystal-ambush-initiative.png',
        tokenPortrait: '/assets/portraits/grick-amber-crystal-ambush-token.png',
      })
    }
    for (const poolId of ['srd-5.1:griffon', 'griffon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/griffon-alpine-sunrise-flight-initiative.png',
        tokenPortrait: '/assets/portraits/griffon-alpine-sunrise-flight-token.png',
      })
    }
    for (const poolId of ['srd-5.1:grimlock', 'grimlock']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/grimlock-basalt-cave-charge-initiative.png',
        tokenPortrait: '/assets/portraits/grimlock-basalt-cave-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:guard', 'guard']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/guard-rainy-city-gate-initiative.png',
        tokenPortrait: '/assets/portraits/guard-rainy-city-gate-token.png',
      })
    }
    for (const poolId of ['srd-5.1:guardian-naga', 'guardian-naga']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/guardian-naga-sun-sanctuary-sentinel-initiative.png',
        tokenPortrait: '/assets/portraits/guardian-naga-sun-sanctuary-sentinel-token.png',
      })
    }
    for (const poolId of ['srd-5.1:gynosphinx', 'gynosphinx']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/gynosphinx-golden-archive-riddler-initiative.png',
        tokenPortrait: '/assets/portraits/gynosphinx-golden-archive-riddler-token.png',
      })
    }
    for (const poolId of ['srd-5.1:half-red-dragon-veteran', 'half-red-dragon-veteran']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/half-red-dragon-veteran-volcanic-dual-blades-initiative.png',
        tokenPortrait: '/assets/portraits/half-red-dragon-veteran-volcanic-dual-blades-token.png',
      })
    }
    for (const poolId of ['srd-5.1:harpy', 'harpy']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/harpy-storm-coast-luring-song-initiative.png',
        tokenPortrait: '/assets/portraits/harpy-storm-coast-luring-song-token.png',
      })
    }
    for (const poolId of ['srd-5.1:hawk', 'hawk']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/hawk-autumn-river-soar-initiative.png',
        tokenPortrait: '/assets/portraits/hawk-autumn-river-soar-token.png',
      })
    }
    for (const poolId of ['srd-5.1:hell-hound', 'hell-hound']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/hell-hound-infernal-bridge-charge-initiative.png',
        tokenPortrait: '/assets/portraits/hell-hound-infernal-bridge-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:hezrou', 'hezrou']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/hezrou-fetid-swamp-emergence-initiative.png',
        tokenPortrait: '/assets/portraits/hezrou-fetid-swamp-emergence-token.png',
      })
    }
    for (const poolId of ['srd-5.1:hill-giant', 'hill-giant']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/hill-giant-storm-hamlet-greatclub-initiative.png',
        tokenPortrait: '/assets/portraits/hill-giant-storm-hamlet-greatclub-token.png',
      })
    }
    for (const poolId of ['srd-5.1:hippogriff', 'hippogriff']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/hippogriff-alpine-sunrise-flight-initiative.png',
        tokenPortrait: '/assets/portraits/hippogriff-alpine-sunrise-flight-token.png',
      })
    }
    for (const poolId of ['srd-5.1:hobgoblin', 'hobgoblin']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/hobgoblin-mountain-fortress-blade-initiative.png',
        tokenPortrait: '/assets/portraits/hobgoblin-mountain-fortress-blade-token.png',
      })
    }
    for (const poolId of ['srd-5.1:homunculus', 'homunculus']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/homunculus-alchemist-workshop-courier-initiative.png',
        tokenPortrait: '/assets/portraits/homunculus-alchemist-workshop-courier-token.png',
      })
    }
    for (const poolId of ['srd-5.1:horned-devil', 'horned-devil']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/horned-devil-infernal-battlement-fork-initiative.png',
        tokenPortrait: '/assets/portraits/horned-devil-infernal-battlement-fork-token.png',
      })
    }
    for (const poolId of ['srd-5.1:hunter-shark', 'hunter-shark']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/hunter-shark-sunken-merchant-patrol-initiative.png',
        tokenPortrait: '/assets/portraits/hunter-shark-sunken-merchant-patrol-token.png',
      })
    }
    for (const poolId of ['srd-5.1:hydra', 'hydra']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/hydra-drowned-swamp-five-heads-initiative.png',
        tokenPortrait: '/assets/portraits/hydra-drowned-swamp-five-heads-token.png',
      })
    }
    for (const poolId of ['srd-5.1:hyena', 'hyena']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/hyena-sunlit-savanna-run-initiative.png',
        tokenPortrait: '/assets/portraits/hyena-sunlit-savanna-run-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ice-devil', 'ice-devil']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ice-devil-glacial-canyon-stalker-initiative.png',
        tokenPortrait: '/assets/portraits/ice-devil-glacial-canyon-stalker-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ice-mephit', 'ice-mephit']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ice-mephit-glacial-cavern-frost-breath-initiative.png',
        tokenPortrait: '/assets/portraits/ice-mephit-glacial-cavern-frost-breath-token.png',
      })
    }
    for (const poolId of ['srd-5.1:imp', 'imp']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/imp-infernal-archive-key-thief-initiative.png',
        tokenPortrait: '/assets/portraits/imp-infernal-archive-key-thief-token.png',
      })
    }
    for (const poolId of ['srd-5.1:invisible-stalker', 'invisible-stalker']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/invisible-stalker-desert-temple-slam-initiative.png',
        tokenPortrait: '/assets/portraits/invisible-stalker-desert-temple-slam-token.png',
      })
    }
    for (const poolId of ['srd-5.1:iron-golem', 'iron-golem']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/iron-golem-royal-foundry-advance-initiative.png',
        tokenPortrait: '/assets/portraits/iron-golem-royal-foundry-advance-token.png',
      })
    }
    for (const poolId of ['srd-5.1:jackal', 'jackal']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/jackal-sunlit-savanna-sprint-initiative.png',
        tokenPortrait: '/assets/portraits/jackal-sunlit-savanna-sprint-token.png',
      })
    }
    for (const poolId of ['srd-5.1:killer-whale', 'killer-whale']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/killer-whale-polar-canyon-charge-initiative.png',
        tokenPortrait: '/assets/portraits/killer-whale-polar-canyon-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:knight', 'knight']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/knight-battered-castle-greatsword-initiative.png',
        tokenPortrait: '/assets/portraits/knight-battered-castle-greatsword-token.png',
      })
    }
    for (const poolId of ['srd-5.1:kraken', 'kraken']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/kraken-storm-fortress-siege-initiative.png',
        tokenPortrait: '/assets/portraits/kraken-storm-fortress-siege-token.png',
      })
    }
    for (const poolId of ['srd-5.1:lamia', 'lamia']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/lamia-sunset-palace-prowl-initiative.png',
        tokenPortrait: '/assets/portraits/lamia-sunset-palace-prowl-token.png',
      })
    }
    for (const poolId of ['srd-5.1:lemure', 'lemure']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/lemure-hellish-mudflat-lurch-initiative.png',
        tokenPortrait: '/assets/portraits/lemure-hellish-mudflat-lurch-token.png',
      })
    }
    for (const poolId of ['srd-5.1:lich', 'lich']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/lich-royal-crypt-paralyzing-touch-initiative.png',
        tokenPortrait: '/assets/portraits/lich-royal-crypt-paralyzing-touch-token.png',
      })
    }
    for (const poolId of ['srd-5.1:lion', 'lion']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/lion-sunlit-savanna-pounce-initiative.png',
        tokenPortrait: '/assets/portraits/lion-sunlit-savanna-pounce-token.png',
      })
    }
    for (const poolId of ['srd-5.1:lizard', 'lizard']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/lizard-desert-boulder-sprint-initiative.png',
        tokenPortrait: '/assets/portraits/lizard-desert-boulder-sprint-token.png',
      })
    }
    for (const poolId of ['srd-5.1:lizardfolk', 'lizardfolk']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/lizardfolk-cypress-swamp-warrior-initiative.png',
        tokenPortrait: '/assets/portraits/lizardfolk-cypress-swamp-warrior-token.png',
      })
    }
    for (const poolId of ['srd-5.1:mage', 'mage']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/mage-burning-library-fireball-initiative.png',
        tokenPortrait: '/assets/portraits/mage-burning-library-fireball-token.png',
      })
    }
    for (const poolId of ['srd-5.1:magma-mephit', 'magma-mephit']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/magma-mephit-volcanic-caldera-breath-initiative.png',
        tokenPortrait: '/assets/portraits/magma-mephit-volcanic-caldera-breath-token.png',
      })
    }
    for (const poolId of ['srd-5.1:magmin', 'magmin']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/magmin-lava-tube-ignition-initiative.png',
        tokenPortrait: '/assets/portraits/magmin-lava-tube-ignition-token.png',
      })
    }
    for (const poolId of ['srd-5.1:mammoth', 'mammoth']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/mammoth-glacial-tundra-charge-initiative.png',
        tokenPortrait: '/assets/portraits/mammoth-glacial-tundra-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:manticore', 'manticore']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/manticore-sunset-canyon-volley-initiative.png',
        tokenPortrait: '/assets/portraits/manticore-sunset-canyon-volley-token.png',
      })
    }
    for (const poolId of ['srd-5.1:marilith', 'marilith']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/marilith-infernal-courtyard-blades-initiative.png',
        tokenPortrait: '/assets/portraits/marilith-infernal-courtyard-blades-token.png',
      })
    }
    for (const poolId of ['srd-5.1:mastiff', 'mastiff']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/mastiff-forest-camp-charge-initiative.png',
        tokenPortrait: '/assets/portraits/mastiff-forest-camp-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:medusa', 'medusa']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/medusa-ruined-temple-gaze-initiative.png',
        tokenPortrait: '/assets/portraits/medusa-ruined-temple-gaze-token.png',
      })
    }
    for (const poolId of ['srd-5.1:merfolk', 'merfolk']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/merfolk-sunlit-coral-spear-initiative.png',
        tokenPortrait: '/assets/portraits/merfolk-sunlit-coral-spear-token.png',
      })
    }
    for (const poolId of ['srd-5.1:merrow', 'merrow']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/merrow-abyssal-shipyard-harpoon-initiative.png',
        tokenPortrait: '/assets/portraits/merrow-abyssal-shipyard-harpoon-token.png',
      })
    }
    for (const poolId of ['srd-5.1:mimic', 'mimic']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/mimic-dungeon-treasure-chest-initiative.png',
        tokenPortrait: '/assets/portraits/mimic-dungeon-treasure-chest-token.png',
      })
    }
    for (const poolId of ['srd-5.1:minotaur', 'minotaur']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/minotaur-torch-labyrinth-charge-initiative.png',
        tokenPortrait: '/assets/portraits/minotaur-torch-labyrinth-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:minotaur-skeleton', 'minotaur-skeleton']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/minotaur-skeleton-ossuary-charge-initiative.png',
        tokenPortrait: '/assets/portraits/minotaur-skeleton-ossuary-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:mule', 'mule']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/mule-alpine-pass-pack-initiative.png',
        tokenPortrait: '/assets/portraits/mule-alpine-pass-pack-token.png',
      })
    }
    for (const poolId of ['srd-5.1:mummy', 'mummy']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/mummy-desert-tomb-rotting-fist-initiative.png',
        tokenPortrait: '/assets/portraits/mummy-desert-tomb-rotting-fist-token.png',
      })
    }
    for (const poolId of ['srd-5.1:mummy-lord', 'mummy-lord']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/mummy-lord-royal-pyramid-scarabs-initiative.png',
        tokenPortrait: '/assets/portraits/mummy-lord-royal-pyramid-scarabs-token.png',
      })
    }
    for (const poolId of ['srd-5.1:nalfeshnee', 'nalfeshnee']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/nalfeshnee-abyssal-fortress-charge-initiative.png',
        tokenPortrait: '/assets/portraits/nalfeshnee-abyssal-fortress-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:night-hag', 'night-hag']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/night-hag-bedchamber-nightmare-haunting-initiative.png',
        tokenPortrait: '/assets/portraits/night-hag-bedchamber-nightmare-haunting-token.png',
      })
    }
    for (const poolId of ['srd-5.1:nightmare', 'nightmare']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/nightmare-infernal-causeway-gallop-initiative.png',
        tokenPortrait: '/assets/portraits/nightmare-infernal-causeway-gallop-token.png',
      })
    }
    for (const poolId of ['srd-5.1:noble', 'noble']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/noble-sunlit-palace-challenge-initiative.png',
        tokenPortrait: '/assets/portraits/noble-sunlit-palace-challenge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ochre-jelly', 'ochre-jelly']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ochre-jelly-mine-wall-pseudopod-initiative.png',
        tokenPortrait: '/assets/portraits/ochre-jelly-mine-wall-pseudopod-token.png',
      })
    }
    for (const poolId of ['srd-5.1:octopus', 'octopus']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/octopus-coral-wreck-camouflage-initiative.png',
        tokenPortrait: '/assets/portraits/octopus-coral-wreck-camouflage-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ogre', 'ogre']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ogre-rainy-toll-bridge-greatclub-initiative.png',
        tokenPortrait: '/assets/portraits/ogre-rainy-toll-bridge-greatclub-token.png',
      })
    }
    for (const poolId of ['srd-5.1:ogre-zombie', 'ogre-zombie']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/ogre-zombie-moonlit-ossuary-morningstar-initiative.png',
        tokenPortrait: '/assets/portraits/ogre-zombie-moonlit-ossuary-morningstar-token.png',
      })
    }
    for (const poolId of ['srd-5.1:oni', 'oni']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/oni-storm-shrine-glaive-initiative.png',
        tokenPortrait: '/assets/portraits/oni-storm-shrine-glaive-token.png',
      })
    }
    for (const poolId of ['srd-5.1:orc', 'orc']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/orc-red-steppe-greataxe-initiative.png',
        tokenPortrait: '/assets/portraits/orc-red-steppe-greataxe-token.png',
      })
    }
    for (const poolId of ['srd-5.1:otyugh', 'otyugh']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/otyugh-city-refuse-barrel-initiative.png',
        tokenPortrait: '/assets/portraits/otyugh-city-refuse-barrel-token.png',
      })
    }
    for (const poolId of ['srd-5.1:owl', 'owl']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/owl-moonlit-roadside-watch-initiative.png',
        tokenPortrait: '/assets/portraits/owl-moonlit-roadside-watch-token.png',
      })
    }
    for (const poolId of ['srd-5.1:owlbear', 'owlbear']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/owlbear-storm-forest-charge-initiative.png',
        tokenPortrait: '/assets/portraits/owlbear-storm-forest-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:panther', 'panther']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/panther-sunlit-jungle-pounce-initiative.png',
        tokenPortrait: '/assets/portraits/panther-sunlit-jungle-pounce-token.png',
      })
    }
    for (const poolId of ['srd-5.1:pegasus', 'pegasus']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/pegasus-alpine-sunrise-flight-initiative.png',
        tokenPortrait: '/assets/portraits/pegasus-alpine-sunrise-flight-token.png',
      })
    }
    for (const poolId of ['srd-5.1:phase-spider', 'phase-spider']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/phase-spider-moonlit-library-jaunt-initiative.png',
        tokenPortrait: '/assets/portraits/phase-spider-moonlit-library-jaunt-token.png',
      })
    }
    for (const poolId of ['srd-5.1:pit-fiend', 'pit-fiend']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/pit-fiend-infernal-throne-mace-initiative.png',
        tokenPortrait: '/assets/portraits/pit-fiend-infernal-throne-mace-token.png',
      })
    }
    for (const poolId of ['srd-5.1:planetar', 'planetar']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/planetar-sky-temple-greatsword-initiative.png',
        tokenPortrait: '/assets/portraits/planetar-sky-temple-greatsword-token.png',
      })
    }
    for (const poolId of ['srd-5.1:plesiosaurus', 'plesiosaurus']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/plesiosaurus-arctic-longship-hunt-initiative.png',
        tokenPortrait: '/assets/portraits/plesiosaurus-arctic-longship-hunt-token.png',
      })
    }
    for (const poolId of ['srd-5.1:poisonous-snake', 'poisonous-snake']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/poisonous-snake-rainforest-branch-strike-initiative.png',
        tokenPortrait: '/assets/portraits/poisonous-snake-rainforest-branch-strike-token.png',
      })
    }
    for (const poolId of ['srd-5.1:polar-bear', 'polar-bear']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/polar-bear-blizzard-ice-charge-initiative.png',
        tokenPortrait: '/assets/portraits/polar-bear-blizzard-ice-charge-token.png',
      })
    }
    for (const poolId of ['srd-5.1:pony', 'pony']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/pony-highland-pack-trail-initiative.png',
        tokenPortrait: '/assets/portraits/pony-highland-pack-trail-token.png',
      })
    }
    for (const poolId of ['srd-5.1:priest', 'priest']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/priest-ruined-chapel-holy-book-initiative.png',
        tokenPortrait: '/assets/portraits/priest-ruined-chapel-holy-book-token.png',
      })
    }
    for (const poolId of ['srd-5.1:pseudodragon', 'pseudodragon']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/pseudodragon-candlelit-study-telepathy-initiative.png',
        tokenPortrait: '/assets/portraits/pseudodragon-candlelit-study-telepathy-token.png',
      })
    }
    for (const poolId of ['srd-5.1:purple-worm', 'purple-worm']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/purple-worm-desert-canyon-eruption-initiative.png',
        tokenPortrait: '/assets/portraits/purple-worm-desert-canyon-eruption-token.png',
      })
    }
    for (const poolId of ['srd-5.1:quasit', 'quasit']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/quasit-candlelit-crypt-scare-initiative.png',
        tokenPortrait: '/assets/portraits/quasit-candlelit-crypt-scare-token.png',
      })
    }
    for (const poolId of ['srd-5.1:quipper', 'quipper']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/quipper-jungle-river-bite-initiative.png',
        tokenPortrait: '/assets/portraits/quipper-jungle-river-bite-token.png',
      })
    }
    for (const poolId of ['srd-5.1:rakshasa', 'rakshasa']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/rakshasa-moonlit-palace-illusion-initiative.png',
        tokenPortrait: '/assets/portraits/rakshasa-moonlit-palace-illusion-token.png',
      })
    }
    for (const poolId of ['srd-5.1:rat', 'rat']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/rat-candlelit-pantry-scent-initiative.png',
        tokenPortrait: '/assets/portraits/rat-candlelit-pantry-scent-token.png',
      })
    }
    for (const poolId of ['srd-5.1:raven', 'raven']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/raven-moonlit-belltower-mimicry-initiative.png',
        tokenPortrait: '/assets/portraits/raven-moonlit-belltower-mimicry-token.png',
      })
    }
    for (const poolId of ['srd-5.1:red-dragon-wyrmling', 'red-dragon-wyrmling']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/red-dragon-wyrmling-volcanic-ravine-glide-initiative.png',
        tokenPortrait: '/assets/portraits/red-dragon-wyrmling-volcanic-ravine-glide-token.png',
      })
    }
    for (const poolId of ['srd-5.1:reef-shark', 'reef-shark']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/reef-shark-sunlit-coral-canyon-initiative.png',
        tokenPortrait: '/assets/portraits/reef-shark-sunlit-coral-canyon-token.png',
      })
    }
    for (const poolId of ['srd-5.1:remorhaz', 'remorhaz']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/remorhaz-glacier-pass-eruption-initiative.png',
        tokenPortrait: '/assets/portraits/remorhaz-glacier-pass-eruption-token.png',
      })
    }
    for (const [slug, asset] of [
      ['rhinoceros', 'rhinoceros-savanna-charge'],
      ['riding-horse', 'riding-horse-highland-road-trot'],
      ['roc', 'roc-storm-peak-flight'],
      ['roper', 'roper-limestone-cavern-reveal'],
      ['rug-of-smothering', 'rug-of-smothering-palace-corridor-spring'],
      ['rust-monster', 'rust-monster-dwarven-forge-corrosion'],
      ['saber-toothed-tiger', 'saber-toothed-tiger-alpine-pounce'],
      ['sahuagin', 'sahuagin-sunken-coral-temple-spear'],
      ['salamander', 'salamander-obsidian-foundry-spear'],
      ['satyr', 'satyr-autumn-woodland-archer'],
      ['scorpion', 'scorpion-desert-ruins-sting'],
      ['scout', 'scout-highland-longbow'],
      ['sea-hag', 'sea-hag-moonlit-shipwreck-claws'],
      ['sea-horse', 'sea-horse-sunlit-coral-cling'],
      ['shadow', 'shadow-candlelit-crypt-drain'],
      ['shambling-mound', 'shambling-mound-storm-swamp-lightning'],
      ['shield-guardian', 'shield-guardian-storm-castle-defense'],
      ['shrieker', 'shrieker-violet-underdark-alarm'],
      ['silver-dragon-wyrmling', 'silver-dragon-wyrmling-alpine-sunrise-flight'],
      ['solar', 'solar-celestial-citadel-longbow'],
      ['specter', 'specter-flooded-manor-life-drain'],
      ['spider', 'spider-attic-web-sense'],
      ['spirit-naga', 'spirit-naga-jungle-temple-lightning'],
      ['sprite', 'sprite-autumn-garden-shortbow'],
      ['spy', 'spy-palace-coded-letter'],
      ['steam-mephit', 'steam-mephit-hot-springs-breath'],
      ['stirge', 'stirge-dungeon-dive'],
      ['stone-giant', 'stone-giant-underdark-rock-throw'],
      ['stone-golem', 'stone-golem-mountain-temple-slam'],
      ['storm-giant', 'storm-giant-sea-cliff-lightning'],
      ['succubus-incubus', 'succubus-incubus-infernal-embassy-contract'],
      ['swarm-of-bats', 'swarm-of-bats-twilight-cave-eruption'],
      ['swarm-of-beetles', 'swarm-of-beetles-crypt-carrion-tide'],
      ['swarm-of-centipedes', 'swarm-of-centipedes-monastery-cellar'],
      ['swarm-of-insects', 'swarm-of-insects-red-sunset-locusts'],
      ['swarm-of-poisonous-snakes', 'swarm-of-poisonous-snakes-jungle-shrine'],
      ['swarm-of-quippers', 'swarm-of-quippers-flooded-dungeon-rush'],
      ['swarm-of-rats', 'swarm-of-rats-city-sewer-surge'],
      ['swarm-of-ravens', 'swarm-of-ravens-misty-battlefield'],
      ['swarm-of-spiders', 'swarm-of-spiders-alchemist-laboratory'],
      ['swarm-of-wasps', 'swarm-of-wasps-forest-chapel'],
      ['tarrasque', 'tarrasque-capital-plaza-rampage'],
      ['thug', 'thug-foggy-dock-enforcer'],
      ['tiger', 'tiger-jungle-pounce'],
      ['treant', 'treant-hill-fortress-rock-throw'],
      ['tribal-warrior', 'tribal-warrior-river-village-guard'],
      ['triceratops', 'triceratops-fern-floodplain-charge'],
      ['troll', 'troll-moonlit-swamp-bridge'],
      ['tyrannosaurus-rex', 'tyrannosaurus-rex-storm-rainforest-bite'],
      ['unicorn', 'unicorn-sunlit-forest-healing-touch'],
      ['vampire-spawn', 'vampire-spawn-monastery-spider-climb'],
      ['vampire-bat', 'vampire-bat-bell-tower-flight'],
      ['vampire-mist', 'vampire-mist-crypt-gate-passage'],
      ['vampire-vampire', 'vampire-vampire-throne-hall-grapple'],
      ['veteran', 'veteran-burning-gate-dual-blades'],
      ['violet-fungus', 'violet-fungus-glowing-grotto-rotting-touch'],
      ['vrock', 'vrock-abyssal-spore-screech'],
      ['vulture', 'vulture-desert-canyon-flight'],
      ['warhorse', 'warhorse-rainy-lists-charge'],
      ['warhorse-skeleton', 'warhorse-skeleton-moonlit-graveyard-gallop'],
      ['water-elemental', 'water-elemental-storm-harbor-double-slam'],
      ['weasel', 'weasel-sunlit-forest-leap'],
      ['werebear-bear', 'werebear-bear-storm-cliff-climb'],
      ['werebear-human', 'werebear-human-moonlit-camp-greataxe'],
      ['werebear-hybrid', 'werebear-hybrid-ruined-inn-claws'],
      ['wereboar-boar', 'wereboar-boar-autumn-orchard-charge'],
      ['wereboar-human', 'wereboar-human-rainy-forge-maul'],
      ['wereboar-hybrid', 'wereboar-hybrid-ruined-village-charge'],
      ['wererat-human', 'wererat-human-rainy-canal-crossbow'],
      ['wererat-hybrid', 'wererat-hybrid-green-sewer-crossbow'],
      ['wererat-rat', 'wererat-rat-moonlit-sewer-leap'],
      ['weretiger-human', 'weretiger-human-monsoon-temple-longbow'],
      ['weretiger-hybrid', 'weretiger-hybrid-rainy-temple-pounce'],
      ['weretiger-tiger', 'weretiger-tiger-jungle-ravine-pounce'],
      ['werewolf-human', 'werewolf-human-moonlit-road-spear'],
      ['werewolf-hybrid', 'werewolf-hybrid-moonlit-barn-lunge'],
      ['werewolf-wolf', 'werewolf-wolf-snowy-forest-sprint'],
      ['white-dragon-wyrmling', 'white-dragon-wyrmling-glacier-cavern-bite'],
      ['wight', 'wight-moonlit-barrow-life-drain'],
      ['will-o-wisp', 'will-o-wisp-moonlit-marsh-lure'],
      ['winter-wolf', 'winter-wolf-blizzard-pass-charge'],
      ['worg', 'worg-goblin-camp-chainbreak'],
      ['wraith', 'wraith-crypt-stair-life-drain'],
      ['wyvern', 'wyvern-volcanic-sky-bank'],
      ['xorn', 'xorn-geode-chamber-gem-harvest'],
      ['young-black-dragon', 'young-black-dragon-moonlit-swamp-prowl'],
      ['young-blue-dragon', 'young-blue-dragon-sandstorm-ruins-stride'],
      ['young-brass-dragon', 'young-brass-dragon-sunrise-arches-stride'],
      ['young-bronze-dragon', 'young-bronze-dragon-dawn-coast-watch'],
      ['young-copper-dragon', 'young-copper-dragon-autumn-highland-crouch'],
      ['young-gold-dragon', 'young-gold-dragon-mountain-monastery-watch'],
      ['young-green-dragon', 'young-green-dragon-rainy-forest-prowl'],
      ['young-red-dragon', 'young-red-dragon-night-caldera-stand'],
      ['young-silver-dragon', 'young-silver-dragon-aurora-observatory-watch'],
      ['young-white-dragon', 'young-white-dragon-glacier-cavern-stalk'],
    ] as const) {
      for (const poolId of [`srd-5.1:${slug}`, slug]) {
        const projected = projectCharacterTokenPresentations([
          token({ type: 'enemy', characterId: undefined, poolId }),
        ], [])
        expect(projected[0]).toMatchObject({
          portrait: `/assets/portraits/${asset}-initiative.png`,
          tokenPortrait: `/assets/portraits/${asset}-token.png`,
        })
      }
    }
    for (const poolId of ['srd-5.1:axe-beak', 'axe-beak']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/axe-beak-dawn-runner-initiative.png',
        tokenPortrait: '/assets/portraits/axe-beak-dawn-runner-token.png',
      })
    }
    for (const poolId of ['srd-5.1:bandit', 'bandit']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/bandit-storm-road-initiative.png',
        tokenPortrait: '/assets/portraits/bandit-storm-road-token.png',
      })
    }
    for (const poolId of ['srd-5.1:kobold', 'kobold']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/kobold-mine-trapper-initiative.png',
        tokenPortrait: '/assets/portraits/kobold-mine-trapper-token.png',
      })
    }
    for (const poolId of ['srd-5.1:skeleton', 'skeleton']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/skeleton-crypt-riser-initiative.png',
        tokenPortrait: '/assets/portraits/skeleton-crypt-riser-token.png',
      })
    }
    for (const poolId of ['srd-5.1:zombie', 'zombie']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/zombie-plague-villager-initiative.png',
        tokenPortrait: '/assets/portraits/zombie-plague-villager-token.png',
      })
    }
    for (const poolId of ['srd-5.1:wolf', 'wolf']) {
      const projected = projectCharacterTokenPresentations([
        token({ type: 'enemy', characterId: undefined, poolId }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: '/assets/portraits/wolf-rain-stalker-initiative.png',
        tokenPortrait: '/assets/portraits/wolf-rain-stalker-token.png',
      })
    }
  })

  it('keeps a room-specific monster portrait ahead of the bundled goblin artwork', () => {
    const original = [
      token({
        type: 'enemy',
        characterId: undefined,
        poolId: 'srd-5.1:goblin',
        portraitImageId: 'custom-goblin',
      }),
    ]
    expect(projectCharacterTokenPresentations(original, [])).toBe(original)
  })

  it('projects the selected goblin appearance into both map and initiative artwork', () => {
    const projected = projectCharacterTokenPresentations([
      token({
        type: 'enemy',
        characterId: undefined,
        poolId: 'srd-5.1:goblin',
        visualVariantId: 'cave-skulk',
      }),
    ], [])
    expect(projected[0]).toMatchObject({
      portrait: '/assets/portraits/goblin-cave-skulk-initiative.png',
      tokenPortrait: '/assets/portraits/goblin-cave-skulk-token.png',
    })
  })

  it('projects the selected ancient dragon appearances into both map and initiative artwork', () => {
    const cases = [
      {
        poolId: 'srd-5.1:air-elemental',
        visualVariantId: 'sky-temple-gale',
        asset: 'air-elemental-sky-temple-gale',
      },
      {
        poolId: 'srd-5.1:azer',
        visualVariantId: 'obsidian-bridge-guard',
        asset: 'azer-obsidian-bridge-guard',
      },
      {
        poolId: 'srd-5.1:baboon',
        visualVariantId: 'savanna-runner',
        asset: 'baboon-savanna-runner',
      },
      {
        poolId: 'srd-5.1:badger',
        visualVariantId: 'heathland-defender',
        asset: 'badger-heathland-defender',
      },
      {
        poolId: 'srd-5.1:balor',
        visualVariantId: 'obsidian-bridge-tyrant',
        asset: 'balor-obsidian-bridge-tyrant',
      },
      {
        poolId: 'srd-5.1:bandit-captain',
        visualVariantId: 'storm-tollhouse-chief',
        asset: 'bandit-captain-storm-tollhouse-chief',
      },
      {
        poolId: 'srd-5.1:barbed-devil',
        visualVariantId: 'ashfield-flame-hurler',
        asset: 'barbed-devil-ashfield-flame-hurler',
      },
      {
        poolId: 'srd-5.1:basilisk',
        visualVariantId: 'sandstone-cavern-prowler',
        asset: 'basilisk-sandstone-cavern-prowler',
      },
      {
        poolId: 'srd-5.1:bat',
        visualVariantId: 'bell-tower-roost',
        asset: 'bat-bell-tower-roost',
      },
      {
        poolId: 'srd-5.1:bearded-devil',
        visualVariantId: 'prison-lunger',
        asset: 'bearded-devil-prison-lunger',
      },
      {
        poolId: 'srd-5.1:behir',
        visualVariantId: 'crystal-cavern-lightning',
        asset: 'behir-crystal-cavern-lightning',
      },
      {
        poolId: 'srd-5.1:berserker',
        visualVariantId: 'desert-arena-guard',
        asset: 'berserker-desert-arena-guard',
      },
      {
        poolId: 'srd-5.1:black-bear',
        visualVariantId: 'autumn-stream-fisher',
        asset: 'black-bear-autumn-stream-fisher',
      },
      {
        poolId: 'srd-5.1:black-dragon-wyrmling',
        visualVariantId: 'moonlit-bog-flight',
        asset: 'black-dragon-wyrmling-moonlit-bog-flight',
      },
      {
        poolId: 'srd-5.1:black-pudding',
        visualVariantId: 'sewer-ceiling-ambush',
        asset: 'black-pudding-sewer-ceiling-ambush',
      },
      {
        poolId: 'srd-5.1:blink-dog',
        visualVariantId: 'autumn-ravine-watch',
        asset: 'blink-dog-autumn-ravine-watch',
      },
      {
        poolId: 'srd-5.1:blood-hawk',
        visualVariantId: 'frost-battlefield-sentry',
        asset: 'blood-hawk-frost-battlefield-sentry',
      },
      {
        poolId: 'srd-5.1:blue-dragon-wyrmling',
        visualVariantId: 'thunder-mesa-flight',
        asset: 'blue-dragon-wyrmling-thunder-mesa-flight',
      },
      {
        poolId: 'srd-5.1:boar',
        visualVariantId: 'frost-hillside-sentry',
        asset: 'boar-frost-hillside-sentry',
      },
      {
        poolId: 'srd-5.1:bone-devil',
        visualVariantId: 'frozen-hell-hunter',
        asset: 'bone-devil-frozen-hell-hunter',
      },
      {
        poolId: 'srd-5.1:brass-dragon-wyrmling',
        visualVariantId: 'sunset-canyon-glide',
        asset: 'brass-dragon-wyrmling-sunset-canyon-glide',
      },
      {
        poolId: 'srd-5.1:bronze-dragon-wyrmling',
        visualVariantId: 'storm-coast-flight',
        asset: 'bronze-dragon-wyrmling-storm-coast-flight',
      },
      {
        poolId: 'srd-5.1:brown-bear',
        visualVariantId: 'glacial-river-charge',
        asset: 'brown-bear-glacial-river-charge',
      },
      {
        poolId: 'srd-5.1:bulette',
        visualVariantId: 'badlands-stalker',
        asset: 'bulette-badlands-stalker',
      },
      {
        poolId: 'srd-5.1:camel',
        visualVariantId: 'rain-oasis-riser',
        asset: 'camel-rain-oasis-riser',
      },
      {
        poolId: 'srd-5.1:cat',
        visualVariantId: 'sunlit-library-sentry',
        asset: 'cat-sunlit-library-sentry',
      },
      {
        poolId: 'srd-5.1:centaur',
        visualVariantId: 'autumn-forest-archer',
        asset: 'centaur-autumn-forest-archer',
      },
      {
        poolId: 'srd-5.1:chain-devil',
        visualVariantId: 'infernal-foundry-controller',
        asset: 'chain-devil-infernal-foundry-controller',
      },
      {
        poolId: 'srd-5.1:chimera',
        visualVariantId: 'volcanic-canyon-flight',
        asset: 'chimera-volcanic-canyon-flight',
      },
      {
        poolId: 'srd-5.1:chuul',
        visualVariantId: 'flooded-observatory-patrol',
        asset: 'chuul-flooded-observatory-patrol',
      },
      {
        poolId: 'srd-5.1:clay-golem',
        visualVariantId: 'flooded-kiln-rampage',
        asset: 'clay-golem-flooded-kiln-rampage',
      },
      {
        poolId: 'srd-5.1:cloaker',
        visualVariantId: 'buried-throne-dive',
        asset: 'cloaker-buried-throne-dive',
      },
      {
        poolId: 'srd-5.1:cloud-giant',
        visualVariantId: 'storm-peak-warrior',
        asset: 'cloud-giant-storm-peak-warrior',
      },
      {
        poolId: 'srd-5.1:cockatrice',
        visualVariantId: 'ruined-belltower-dive',
        asset: 'cockatrice-ruined-belltower-dive',
      },
      {
        poolId: 'srd-5.1:commoner',
        visualVariantId: 'rainy-town-potter',
        asset: 'commoner-rainy-town-potter',
      },
      {
        poolId: 'srd-5.1:constrictor-snake',
        visualVariantId: 'ruined-temple-strike',
        asset: 'constrictor-snake-ruined-temple-strike',
      },
      {
        poolId: 'srd-5.1:copper-dragon-wyrmling',
        visualVariantId: 'crystal-observatory',
        asset: 'copper-dragon-wyrmling-crystal-observatory',
      },
      {
        poolId: 'srd-5.1:couatl',
        visualVariantId: 'moonlit-flooded-sanctuary',
        asset: 'couatl-moonlit-flooded-sanctuary',
      },
      {
        poolId: 'srd-5.1:crab',
        visualVariantId: 'underwater-seagrass-scuttle',
        asset: 'crab-underwater-seagrass-scuttle',
      },
      {
        poolId: 'srd-5.1:crocodile',
        visualVariantId: 'moonlit-swamp-ambush',
        asset: 'crocodile-moonlit-swamp-ambush',
      },
      {
        poolId: 'srd-5.1:cult-fanatic',
        visualVariantId: 'storm-cliff-binding',
        asset: 'cult-fanatic-storm-cliff-binding',
      },
      {
        poolId: 'srd-5.1:cultist',
        visualVariantId: 'twilight-forest-offering',
        asset: 'cultist-twilight-forest-offering',
      },
      {
        poolId: 'srd-5.1:darkmantle',
        visualVariantId: 'abandoned-mine-dive',
        asset: 'darkmantle-abandoned-mine-dive',
      },
      {
        poolId: 'srd-5.1:death-dog',
        visualVariantId: 'desert-ruin-charge',
        asset: 'death-dog-desert-ruin-charge',
      },
      {
        poolId: 'srd-5.1:deep-gnome-svirfneblin',
        visualVariantId: 'fungal-illusion-scout',
        asset: 'deep-gnome-svirfneblin-fungal-illusion-scout',
      },
      {
        poolId: 'srd-5.1:deer',
        visualVariantId: 'moonlit-snow-doe',
        asset: 'deer-moonlit-snow-doe',
      },
      {
        poolId: 'srd-5.1:deva',
        visualVariantId: 'silver-dawn-descent',
        asset: 'deva-silver-dawn-descent',
      },
      {
        poolId: 'srd-5.1:dire-wolf',
        visualVariantId: 'storm-moor-charge',
        asset: 'dire-wolf-storm-moor-charge',
      },
      {
        poolId: 'srd-5.1:djinni',
        visualVariantId: 'storm-cloudship-whirlwind',
        asset: 'djinni-storm-cloudship-whirlwind',
      },
      {
        poolId: 'srd-5.1:doppelganger',
        visualVariantId: 'rainy-inn-transformation',
        asset: 'doppelganger-rainy-inn-transformation',
      },
      {
        poolId: 'srd-5.1:draft-horse',
        visualVariantId: 'snow-pass-freight',
        asset: 'draft-horse-snow-pass-freight',
      },
      {
        poolId: 'srd-5.1:dragon-turtle',
        visualVariantId: 'storm-harbor-surge',
        asset: 'dragon-turtle-storm-harbor-surge',
      },
      {
        poolId: 'srd-5.1:dretch',
        visualVariantId: 'abandoned-prison-break',
        asset: 'dretch-abandoned-prison-break',
      },
      {
        poolId: 'srd-5.1:drider',
        visualVariantId: 'ruined-shrine-blade',
        asset: 'drider-ruined-shrine-blade',
      },
      {
        poolId: 'srd-5.1:drow',
        visualVariantId: 'rain-city-duelist',
        asset: 'drow-rain-city-duelist',
      },
      {
        poolId: 'srd-5.1:druid',
        visualVariantId: 'storm-cliff-thunderwave',
        asset: 'druid-storm-cliff-thunderwave',
      },
      {
        poolId: 'srd-5.1:dryad',
        visualVariantId: 'winter-yew-stalker',
        asset: 'dryad-winter-yew-stalker',
      },
      {
        poolId: 'srd-5.1:duergar',
        visualVariantId: 'crystal-gate-enlarged',
        asset: 'duergar-crystal-gate-enlarged',
      },
      {
        poolId: 'srd-5.1:dust-mephit',
        visualVariantId: 'ruined-library-dive',
        asset: 'dust-mephit-ruined-library-dive',
      },
      {
        poolId: 'srd-5.1:eagle',
        visualVariantId: 'storm-coast-perch',
        asset: 'eagle-storm-coast-perch',
      },
      {
        poolId: 'srd-5.1:earth-elemental',
        visualVariantId: 'storm-fortress-siege',
        asset: 'earth-elemental-storm-fortress-siege',
      },
      {
        poolId: 'srd-5.1:efreeti',
        visualVariantId: 'black-sand-flame-hurl',
        asset: 'efreeti-black-sand-flame-hurl',
      },
      {
        poolId: 'srd-5.1:elephant',
        visualVariantId: 'monsoon-temple-crossing',
        asset: 'elephant-monsoon-temple-crossing',
      },
      {
        poolId: 'srd-5.1:elk',
        visualVariantId: 'snow-cedar-watch',
        asset: 'elk-snow-cedar-watch',
      },
      {
        poolId: 'srd-5.1:erinyes',
        visualVariantId: 'frozen-prison-blade',
        asset: 'erinyes-frozen-prison-blade',
      },
      {
        poolId: 'srd-5.1:ettercap',
        visualVariantId: 'abandoned-mine-climb',
        asset: 'ettercap-abandoned-mine-climb',
      },
      {
        poolId: 'srd-5.1:ettin',
        visualVariantId: 'moon-cave-watch',
        asset: 'ettin-moon-cave-watch',
      },
      {
        poolId: 'srd-5.1:fire-elemental',
        visualVariantId: 'rain-city-fireform',
        asset: 'fire-elemental-rain-city-fireform',
      },
      {
        poolId: 'srd-5.1:fire-giant',
        visualVariantId: 'glacier-pass-rockthrow',
        asset: 'fire-giant-glacier-pass-rockthrow',
      },
      {
        poolId: 'srd-5.1:flesh-golem',
        visualVariantId: 'burning-barn-berserk',
        asset: 'flesh-golem-burning-barn-berserk',
      },
      {
        poolId: 'srd-5.1:flying-snake',
        visualVariantId: 'cenote-swim',
        asset: 'flying-snake-cenote-swim',
      },
      {
        poolId: 'srd-5.1:flying-sword',
        visualVariantId: 'moonlit-hall-charge',
        asset: 'flying-sword-moonlit-hall-charge',
      },
      {
        poolId: 'srd-5.1:frog',
        visualVariantId: 'moonlit-pond-swim',
        asset: 'frog-moonlit-pond-swim',
      },
      {
        poolId: 'srd-5.1:frost-giant',
        visualVariantId: 'glacier-rockthrow',
        asset: 'frost-giant-glacier-rockthrow',
      },
      {
        poolId: 'srd-5.1:gargoyle',
        visualVariantId: 'desert-ziggurat-dive',
        asset: 'gargoyle-desert-ziggurat-dive',
      },
      {
        poolId: 'srd-5.1:gelatinous-cube',
        visualVariantId: 'flooded-archive-pseudopod',
        asset: 'gelatinous-cube-flooded-archive-pseudopod',
      },
      {
        poolId: 'srd-5.1:ghast',
        visualVariantId: 'flooded-sewer-stalker',
        asset: 'ghast-flooded-sewer-stalker',
      },
      {
        poolId: 'srd-5.1:ghost',
        visualVariantId: 'storm-manor-visage',
        asset: 'ghost-storm-manor-visage',
      },
      {
        poolId: 'srd-5.1:ghoul',
        visualVariantId: 'frost-kitchen-stalker',
        asset: 'ghoul-frost-kitchen-stalker',
      },
      {
        poolId: 'srd-5.1:giant-ape',
        visualVariantId: 'alpine-rockthrow',
        asset: 'giant-ape-alpine-rockthrow',
      },
      {
        poolId: 'srd-5.1:giant-badger',
        visualVariantId: 'moonlit-chalk-charge',
        asset: 'giant-badger-moonlit-chalk-charge',
      },
      {
        poolId: 'srd-5.1:giant-bat',
        visualVariantId: 'dawn-bell-tower-perch',
        asset: 'giant-bat-dawn-bell-tower-perch',
      },
      {
        poolId: 'srd-5.1:giant-boar',
        visualVariantId: 'storm-moor-relentless',
        asset: 'giant-boar-storm-moor-relentless',
      },
      {
        poolId: 'srd-5.1:giant-centipede',
        visualVariantId: 'moonlit-cellar-bite',
        asset: 'giant-centipede-moonlit-cellar-bite',
      },
      {
        poolId: 'srd-5.1:giant-constrictor-snake',
        visualVariantId: 'flooded-river-swim',
        asset: 'giant-constrictor-snake-flooded-river-swim',
      },
      {
        poolId: 'srd-5.1:giant-crab',
        visualVariantId: 'sunken-wreck-guard',
        asset: 'giant-crab-sunken-wreck-guard',
      },
      {
        poolId: 'srd-5.1:giant-crocodile',
        visualVariantId: 'sunken-ruins-tail-sweep',
        asset: 'giant-crocodile-sunken-ruins-tail-sweep',
      },
      {
        poolId: 'srd-5.1:giant-eagle',
        visualVariantId: 'desert-mesa-watch',
        asset: 'giant-eagle-desert-mesa-watch',
      },
      {
        poolId: 'srd-5.1:giant-elk',
        visualVariantId: 'moonlit-heather-hooves',
        asset: 'giant-elk-moonlit-heather-hooves',
      },
      {
        poolId: 'srd-5.1:giant-fire-beetle',
        visualVariantId: 'rainforest-log-glow',
        asset: 'giant-fire-beetle-rainforest-log-glow',
      },
      {
        poolId: 'srd-5.1:giant-frog',
        visualVariantId: 'moonlit-quarry-swim',
        asset: 'giant-frog-moonlit-quarry-swim',
      },
      {
        poolId: 'srd-5.1:giant-goat',
        visualVariantId: 'storm-highland-charge',
        asset: 'giant-goat-storm-highland-charge',
      },
      {
        poolId: 'srd-5.1:giant-hyena',
        visualVariantId: 'moonlit-ruins-stalker',
        asset: 'giant-hyena-moonlit-ruins-stalker',
      },
      {
        poolId: 'srd-5.1:giant-lizard',
        visualVariantId: 'rainforest-stream-bite',
        asset: 'giant-lizard-rainforest-stream-bite',
      },
      {
        poolId: 'srd-5.1:giant-octopus',
        visualVariantId: 'moonlit-kelp-ink-dash',
        asset: 'giant-octopus-moonlit-kelp-ink-dash',
      },
      {
        poolId: 'srd-5.1:giant-owl',
        visualVariantId: 'dawn-bell-tower-perch',
        asset: 'giant-owl-dawn-bell-tower-perch',
      },
      {
        poolId: 'srd-5.1:giant-poisonous-snake',
        visualVariantId: 'sunset-ziggurat-strike',
        asset: 'giant-poisonous-snake-sunset-ziggurat-strike',
      },
      {
        poolId: 'srd-5.1:giant-rat',
        visualVariantId: 'dawn-barn-scent',
        asset: 'giant-rat-dawn-barn-scent',
      },
      {
        poolId: 'srd-5.1:giant-rat-diseased',
        visualVariantId: 'moonlit-apothecary-scent',
        asset: 'giant-rat-diseased-moonlit-apothecary-scent',
      },
      {
        poolId: 'srd-5.1:giant-scorpion',
        visualVariantId: 'moonlit-salt-canyon-charge',
        asset: 'giant-scorpion-moonlit-salt-canyon-charge',
      },
      {
        poolId: 'srd-5.1:giant-sea-horse',
        visualVariantId: 'drowned-bell-tower-perch',
        asset: 'giant-sea-horse-drowned-bell-tower-perch',
      },
      {
        poolId: 'srd-5.1:giant-shark',
        visualVariantId: 'volcanic-rift-blood-frenzy',
        asset: 'giant-shark-volcanic-rift-blood-frenzy',
      },
      {
        poolId: 'srd-5.1:giant-spider',
        visualVariantId: 'rainforest-ruin-silk-run',
        asset: 'giant-spider-rainforest-ruin-silk-run',
      },
      {
        poolId: 'srd-5.1:giant-toad',
        visualVariantId: 'moonlit-sunken-temple-swim',
        asset: 'giant-toad-moonlit-sunken-temple-swim',
      },
      {
        poolId: 'srd-5.1:giant-vulture',
        visualVariantId: 'storm-monument-watch',
        asset: 'giant-vulture-storm-monument-watch',
      },
      {
        poolId: 'srd-5.1:giant-wasp',
        visualVariantId: 'storm-watchtower-guard',
        asset: 'giant-wasp-storm-watchtower-guard',
      },
      {
        poolId: 'srd-5.1:giant-weasel',
        visualVariantId: 'moonlit-monastery-scent',
        asset: 'giant-weasel-moonlit-monastery-scent',
      },
      {
        poolId: 'srd-5.1:giant-wolf-spider',
        visualVariantId: 'silver-mine-wall-descent',
        asset: 'giant-wolf-spider-silver-mine-wall-descent',
      },
      {
        poolId: 'srd-5.1:gibbering-mouther',
        visualVariantId: 'moonlit-flooded-temple-spit',
        asset: 'gibbering-mouther-moonlit-flooded-temple-spit',
      },
      {
        poolId: 'srd-5.1:glabrezu',
        visualVariantId: 'moonlit-observatory-darkness',
        asset: 'glabrezu-moonlit-observatory-darkness',
      },
      {
        poolId: 'srd-5.1:gladiator',
        visualVariantId: 'storm-cliff-shield-bash',
        asset: 'gladiator-storm-cliff-shield-bash',
      },
      {
        poolId: 'srd-5.1:gnoll',
        visualVariantId: 'moonlit-badlands-longbow',
        asset: 'gnoll-moonlit-badlands-longbow',
      },
      {
        poolId: 'srd-5.1:goat',
        visualVariantId: 'misty-cliff-surefoot',
        asset: 'goat-misty-cliff-surefoot',
      },
      {
        poolId: 'srd-5.1:gold-dragon-wyrmling',
        visualVariantId: 'coral-palace-swim',
        asset: 'gold-dragon-wyrmling-coral-palace-swim',
      },
      {
        poolId: 'srd-5.1:gorgon',
        visualVariantId: 'moonlit-foundry-petrify',
        asset: 'gorgon-moonlit-foundry-petrify',
      },
      {
        poolId: 'srd-5.1:gray-ooze',
        visualVariantId: 'flooded-cistern-corrosion',
        asset: 'gray-ooze-flooded-cistern-corrosion',
      },
      {
        poolId: 'srd-5.1:green-dragon-wyrmling',
        visualVariantId: 'moonlit-mangrove-stalk',
        asset: 'green-dragon-wyrmling-moonlit-mangrove-stalk',
      },
      {
        poolId: 'srd-5.1:green-hag',
        visualVariantId: 'moonlit-manor-illusion',
        asset: 'green-hag-moonlit-manor-illusion',
      },
      {
        poolId: 'srd-5.1:grick',
        visualVariantId: 'blue-cistern-ceiling',
        asset: 'grick-blue-cistern-ceiling',
      },
      {
        poolId: 'srd-5.1:griffon',
        visualVariantId: 'storm-amphitheater-guard',
        asset: 'griffon-storm-amphitheater-guard',
      },
      {
        poolId: 'srd-5.1:grimlock',
        visualVariantId: 'blue-grotto-tracker',
        asset: 'grimlock-blue-grotto-tracker',
      },
      {
        poolId: 'srd-5.1:guard',
        visualVariantId: 'night-harbor-patrol',
        asset: 'guard-night-harbor-patrol',
      },
      {
        poolId: 'srd-5.1:guardian-naga',
        visualVariantId: 'moonlit-jungle-strike',
        asset: 'guardian-naga-moonlit-jungle-strike',
      },
      {
        poolId: 'srd-5.1:gynosphinx',
        visualVariantId: 'desert-observatory-flight',
        asset: 'gynosphinx-desert-observatory-flight',
      },
      {
        poolId: 'srd-5.1:half-red-dragon-veteran',
        visualVariantId: 'frozen-crossbow-watch',
        asset: 'half-red-dragon-veteran-frozen-crossbow-watch',
      },
      {
        poolId: 'srd-5.1:harpy',
        visualVariantId: 'moonlit-village-club-raid',
        asset: 'harpy-moonlit-village-club-raid',
      },
      {
        poolId: 'srd-5.1:hawk',
        visualVariantId: 'snow-pine-watch',
        asset: 'hawk-snow-pine-watch',
      },
      {
        poolId: 'srd-5.1:hell-hound',
        visualVariantId: 'frozen-necropolis-firebreath',
        asset: 'hell-hound-frozen-necropolis-firebreath',
      },
      {
        poolId: 'srd-5.1:hezrou',
        visualVariantId: 'blue-sewer-rampage',
        asset: 'hezrou-blue-sewer-rampage',
      },
      {
        poolId: 'srd-5.1:hill-giant',
        visualVariantId: 'sunlit-quarry-rockthrow',
        asset: 'hill-giant-sunlit-quarry-rockthrow',
      },
      {
        poolId: 'srd-5.1:hippogriff',
        visualVariantId: 'moonlit-sea-ruins',
        asset: 'hippogriff-moonlit-sea-ruins',
      },
      {
        poolId: 'srd-5.1:hobgoblin',
        visualVariantId: 'rain-ravine-longbow',
        asset: 'hobgoblin-rain-ravine-longbow',
      },
      {
        poolId: 'srd-5.1:homunculus',
        visualVariantId: 'rainy-gothic-rooftop',
        asset: 'homunculus-rainy-gothic-rooftop',
      },
      {
        poolId: 'srd-5.1:horned-devil',
        visualVariantId: 'moonlit-cathedral-hurl-flame',
        asset: 'horned-devil-moonlit-cathedral-hurl-flame',
      },
      {
        poolId: 'srd-5.1:hunter-shark',
        visualVariantId: 'kelp-canyon-charge',
        asset: 'hunter-shark-kelp-canyon-charge',
      },
      {
        poolId: 'srd-5.1:hydra',
        visualVariantId: 'moonlit-sea-temple',
        asset: 'hydra-moonlit-sea-temple',
      },
      {
        poolId: 'srd-5.1:hyena',
        visualVariantId: 'moonlit-caravanserai',
        asset: 'hyena-moonlit-caravanserai',
      },
      {
        poolId: 'srd-5.1:ice-devil',
        visualVariantId: 'frozen-city-ice-wall',
        asset: 'ice-devil-frozen-city-ice-wall',
      },
      {
        poolId: 'srd-5.1:ice-mephit',
        visualVariantId: 'alpine-temple-ambush',
        asset: 'ice-mephit-alpine-temple-ambush',
      },
      {
        poolId: 'srd-5.1:imp',
        visualVariantId: 'moonlit-alley-flight',
        asset: 'imp-moonlit-alley-flight',
      },
      {
        poolId: 'srd-5.1:invisible-stalker',
        visualVariantId: 'storm-harbor-pursuit',
        asset: 'invisible-stalker-storm-harbor-pursuit',
      },
      {
        poolId: 'srd-5.1:iron-golem',
        visualVariantId: 'storm-citadel-poison-breath',
        asset: 'iron-golem-storm-citadel-poison-breath',
      },
      {
        poolId: 'srd-5.1:jackal',
        visualVariantId: 'moonlit-necropolis-howl',
        asset: 'jackal-moonlit-necropolis-howl',
      },
      {
        poolId: 'srd-5.1:killer-whale',
        visualVariantId: 'storm-sea-breach',
        asset: 'killer-whale-storm-sea-breach',
      },
      {
        poolId: 'srd-5.1:knight',
        visualVariantId: 'snow-watchtower-crossbow',
        asset: 'knight-snow-watchtower-crossbow',
      },
      {
        poolId: 'srd-5.1:kraken',
        visualVariantId: 'drowned-city-lightning',
        asset: 'kraken-drowned-city-lightning',
      },
      {
        poolId: 'srd-5.1:lamia',
        visualVariantId: 'moonlit-canyon-touch',
        asset: 'lamia-moonlit-canyon-touch',
      },
      {
        poolId: 'srd-5.1:lemure',
        visualVariantId: 'infernal-foundry-crawl',
        asset: 'lemure-infernal-foundry-crawl',
      },
      {
        poolId: 'srd-5.1:lich',
        visualVariantId: 'mountaintop-observatory-ray',
        asset: 'lich-mountaintop-observatory-ray',
      },
      {
        poolId: 'srd-5.1:lion',
        visualVariantId: 'moonlit-amphitheater-guard',
        asset: 'lion-moonlit-amphitheater-guard',
      },
      {
        poolId: 'srd-5.1:lizard',
        visualVariantId: 'jungle-temple-climb',
        asset: 'lizard-jungle-temple-climb',
      },
      {
        poolId: 'srd-5.1:lizardfolk',
        visualVariantId: 'moonlit-river-javelin',
        asset: 'lizardfolk-moonlit-river-javelin',
      },
      {
        poolId: 'srd-5.1:mage',
        visualVariantId: 'alpine-observatory-cold',
        asset: 'mage-alpine-observatory-cold',
      },
      {
        poolId: 'srd-5.1:magma-mephit',
        visualVariantId: 'dwarven-forge-ambush',
        asset: 'magma-mephit-dwarven-forge-ambush',
      },
      {
        poolId: 'srd-5.1:magmin',
        visualVariantId: 'snow-village-smolder',
        asset: 'magmin-snow-village-smolder',
      },
      {
        poolId: 'srd-5.1:mammoth',
        visualVariantId: 'aurora-forest-stomp',
        asset: 'mammoth-aurora-forest-stomp',
      },
      {
        poolId: 'srd-5.1:manticore',
        visualVariantId: 'storm-aqueduct-guard',
        asset: 'manticore-storm-aqueduct-guard',
      },
      {
        poolId: 'srd-5.1:marilith',
        visualVariantId: 'celestial-palace-teleport',
        asset: 'marilith-celestial-palace-teleport',
      },
      {
        poolId: 'srd-5.1:mastiff',
        visualVariantId: 'snow-monastery-guard',
        asset: 'mastiff-snow-monastery-guard',
      },
      {
        poolId: 'srd-5.1:medusa',
        visualVariantId: 'moonlit-rooftop-longbow',
        asset: 'medusa-moonlit-rooftop-longbow',
      },
      {
        poolId: 'srd-5.1:merfolk',
        visualVariantId: 'storm-tidal-scout',
        asset: 'merfolk-storm-tidal-scout',
      },
      {
        poolId: 'srd-5.1:merrow',
        visualVariantId: 'storm-tidal-cave-bite',
        asset: 'merrow-storm-tidal-cave-bite',
      },
      {
        poolId: 'srd-5.1:mimic',
        visualVariantId: 'moonlit-manor-wardrobe',
        asset: 'mimic-moonlit-manor-wardrobe',
      },
      {
        poolId: 'srd-5.1:minotaur',
        visualVariantId: 'aurora-mountain-guard',
        asset: 'minotaur-aurora-mountain-guard',
      },
      {
        poolId: 'srd-5.1:minotaur-skeleton',
        visualVariantId: 'moonlit-desert-maze',
        asset: 'minotaur-skeleton-moonlit-desert-maze',
      },
      {
        poolId: 'srd-5.1:mule',
        visualVariantId: 'snow-stable-kick',
        asset: 'mule-snow-stable-kick',
      },
      {
        poolId: 'srd-5.1:mummy',
        visualVariantId: 'flooded-necropolis-glare',
        asset: 'mummy-flooded-necropolis-glare',
      },
      {
        poolId: 'srd-5.1:mummy-lord',
        visualVariantId: 'moonlit-sandstorm-word',
        asset: 'mummy-lord-moonlit-sandstorm-word',
      },
      {
        poolId: 'srd-5.1:nalfeshnee',
        visualVariantId: 'moonlit-fungal-teleport',
        asset: 'nalfeshnee-moonlit-fungal-teleport',
      },
      {
        poolId: 'srd-5.1:night-hag',
        visualVariantId: 'dead-marsh-ethereal',
        asset: 'night-hag-dead-marsh-ethereal',
      },
      {
        poolId: 'srd-5.1:nightmare',
        visualVariantId: 'moonlit-cathedral-ethereal',
        asset: 'nightmare-moonlit-cathedral-ethereal',
      },
      {
        poolId: 'srd-5.1:noble',
        visualVariantId: 'storm-battlement-defense',
        asset: 'noble-storm-battlement-defense',
      },
      {
        poolId: 'srd-5.1:ochre-jelly',
        visualVariantId: 'flooded-aqueduct-surge',
        asset: 'ochre-jelly-flooded-aqueduct-surge',
      },
      {
        poolId: 'srd-5.1:octopus',
        visualVariantId: 'moonlit-kelp-ink-cloud',
        asset: 'octopus-moonlit-kelp-ink-cloud',
      },
      {
        poolId: 'srd-5.1:ogre',
        visualVariantId: 'snow-quarry-javelin',
        asset: 'ogre-snow-quarry-javelin',
      },
      {
        poolId: 'srd-5.1:ogre-zombie',
        visualVariantId: 'dawn-swamp-drag',
        asset: 'ogre-zombie-dawn-swamp-drag',
      },
      {
        poolId: 'srd-5.1:oni',
        visualVariantId: 'snow-city-cone-of-cold',
        asset: 'oni-snow-city-cone-of-cold',
      },
      {
        poolId: 'srd-5.1:orc',
        visualVariantId: 'storm-coast-javelin',
        asset: 'orc-storm-coast-javelin',
      },
      {
        poolId: 'srd-5.1:otyugh',
        visualVariantId: 'fungal-cavern-slam',
        asset: 'otyugh-fungal-cavern-slam',
      },
      {
        poolId: 'srd-5.1:owl',
        visualVariantId: 'snow-barn-flyby',
        asset: 'owl-snow-barn-flyby',
      },
      {
        poolId: 'srd-5.1:owlbear',
        visualVariantId: 'aurora-ice-cave-guard',
        asset: 'owlbear-aurora-ice-cave-guard',
      },
      {
        poolId: 'srd-5.1:panther',
        visualVariantId: 'moonlit-temple-climb',
        asset: 'panther-moonlit-temple-climb',
      },
      {
        poolId: 'srd-5.1:pegasus',
        visualVariantId: 'moonlit-sacred-spring',
        asset: 'pegasus-moonlit-sacred-spring',
      },
      {
        poolId: 'srd-5.1:phase-spider',
        visualVariantId: 'desert-bridge-phase',
        asset: 'phase-spider-desert-bridge-phase',
      },
      {
        poolId: 'srd-5.1:pit-fiend',
        visualVariantId: 'sulfur-plain-tailstrike',
        asset: 'pit-fiend-sulfur-plain-tailstrike',
      },
      {
        poolId: 'srd-5.1:planetar',
        visualVariantId: 'twilight-sanctuary-healing',
        asset: 'planetar-twilight-sanctuary-healing',
      },
      {
        poolId: 'srd-5.1:plesiosaurus',
        visualVariantId: 'tropical-lagoon-surface',
        asset: 'plesiosaurus-tropical-lagoon-surface',
      },
      {
        poolId: 'srd-5.1:poisonous-snake',
        visualVariantId: 'moonlit-marsh-swim',
        asset: 'poisonous-snake-moonlit-marsh-swim',
      },
      {
        poolId: 'srd-5.1:polar-bear',
        visualVariantId: 'underice-swim',
        asset: 'polar-bear-underice-swim',
      },
      {
        poolId: 'srd-5.1:pony',
        visualVariantId: 'snow-stable-kick',
        asset: 'pony-snow-stable-kick',
      },
      {
        poolId: 'srd-5.1:priest',
        visualVariantId: 'storm-hospice-guiding-bolt',
        asset: 'priest-storm-hospice-guiding-bolt',
      },
      {
        poolId: 'srd-5.1:pseudodragon',
        visualVariantId: 'autumn-orchard-flight',
        asset: 'pseudodragon-autumn-orchard-flight',
      },
      {
        poolId: 'srd-5.1:purple-worm',
        visualVariantId: 'crystal-cavern-tailstrike',
        asset: 'purple-worm-crystal-cavern-tailstrike',
      },
      {
        poolId: 'srd-5.1:quasit',
        visualVariantId: 'rainy-rooftop-invisibility',
        asset: 'quasit-rainy-rooftop-invisibility',
      },
      {
        poolId: 'srd-5.1:quipper',
        visualVariantId: 'flooded-dungeon-key',
        asset: 'quipper-flooded-dungeon-key',
      },
      {
        poolId: 'srd-5.1:rakshasa',
        visualVariantId: 'rainy-bazaar-disguise',
        asset: 'rakshasa-rainy-bazaar-disguise',
      },
      {
        poolId: 'srd-5.1:rat',
        visualVariantId: 'dawn-bridge-dash',
        asset: 'rat-dawn-bridge-dash',
      },
      {
        poolId: 'srd-5.1:raven',
        visualVariantId: 'winter-forest-flight',
        asset: 'raven-winter-forest-flight',
      },
      {
        poolId: 'srd-5.1:red-dragon-wyrmling',
        visualVariantId: 'moonlit-fortress-firebreath',
        asset: 'red-dragon-wyrmling-moonlit-fortress-firebreath',
      },
      {
        poolId: 'srd-5.1:reef-shark',
        visualVariantId: 'dusk-shipwreck-bite',
        asset: 'reef-shark-dusk-shipwreck-bite',
      },
      {
        poolId: 'srd-5.1:remorhaz',
        visualVariantId: 'geothermal-ice-cavern',
        asset: 'remorhaz-geothermal-ice-cavern',
      },
      {
        poolId: 'srd-5.1:rhinoceros',
        visualVariantId: 'jungle-watering-hole',
        asset: 'rhinoceros-jungle-watering-hole',
      },
      {
        poolId: 'srd-5.1:riding-horse',
        visualVariantId: 'rainy-inn-courtyard',
        asset: 'riding-horse-rainy-inn-courtyard',
      },
      {
        poolId: 'srd-5.1:roc',
        visualVariantId: 'dawn-watchtower-perch',
        asset: 'roc-dawn-watchtower-perch',
      },
      {
        poolId: 'srd-5.1:roper',
        visualVariantId: 'red-crystal-ceiling-climb',
        asset: 'roper-red-crystal-ceiling-climb',
      },
      {
        poolId: 'srd-5.1:rug-of-smothering',
        visualVariantId: 'flooded-library-smother',
        asset: 'rug-of-smothering-flooded-library-smother',
      },
      {
        poolId: 'srd-5.1:rust-monster',
        visualVariantId: 'flooded-armory-scent',
        asset: 'rust-monster-flooded-armory-scent',
      },
      {
        poolId: 'srd-5.1:saber-toothed-tiger',
        visualVariantId: 'redwood-scent',
        asset: 'saber-toothed-tiger-redwood-scent',
      },
      {
        poolId: 'srd-5.1:sahuagin',
        visualVariantId: 'storm-coast-claws',
        asset: 'sahuagin-storm-coast-claws',
      },
      {
        poolId: 'srd-5.1:salamander',
        visualVariantId: 'moonlit-desert-tail-grapple',
        asset: 'salamander-moonlit-desert-tail-grapple',
      },
      {
        poolId: 'srd-5.1:satyr',
        visualVariantId: 'moonlit-amphitheater-sword',
        asset: 'satyr-moonlit-amphitheater-sword',
      },
      {
        poolId: 'srd-5.1:scorpion',
        visualVariantId: 'wine-cellar-crawl',
        asset: 'scorpion-wine-cellar-crawl',
      },
      {
        poolId: 'srd-5.1:scout',
        visualVariantId: 'rainy-village-shortsword',
        asset: 'scout-rainy-village-shortsword',
      },
      {
        poolId: 'srd-5.1:sea-hag',
        visualVariantId: 'storm-tidepool-death-glare',
        asset: 'sea-hag-storm-tidepool-death-glare',
      },
      {
        poolId: 'srd-5.1:sea-horse',
        visualVariantId: 'moonlit-mosaic-swim',
        asset: 'sea-horse-moonlit-mosaic-swim',
      },
      {
        poolId: 'srd-5.1:shadow',
        visualVariantId: 'dawn-monastery-recoil',
        asset: 'shadow-dawn-monastery-recoil',
      },
      {
        poolId: 'srd-5.1:shambling-mound',
        visualVariantId: 'flooded-sewer-engulf',
        asset: 'shambling-mound-flooded-sewer-engulf',
      },
      {
        poolId: 'srd-5.1:shield-guardian',
        visualVariantId: 'dawn-observatory-spell',
        asset: 'shield-guardian-dawn-observatory-spell',
      },
      {
        poolId: 'srd-5.1:shrieker',
        visualVariantId: 'flooded-crypt-alarm',
        asset: 'shrieker-flooded-crypt-alarm',
      },
      {
        poolId: 'srd-5.1:silver-dragon-wyrmling',
        visualVariantId: 'moonlit-glacier-cold-breath',
        asset: 'silver-dragon-wyrmling-moonlit-glacier-cold-breath',
      },
      {
        poolId: 'srd-5.1:solar',
        visualVariantId: 'dawn-battlefield-greatsword',
        asset: 'solar-dawn-battlefield-greatsword',
      },
      {
        poolId: 'srd-5.1:specter',
        visualVariantId: 'dawn-memorial-sunlight',
        asset: 'specter-dawn-memorial-sunlight',
      },
      {
        poolId: 'srd-5.1:spider',
        visualVariantId: 'moonlit-herb-web',
        asset: 'spider-moonlit-herb-web',
      },
      {
        poolId: 'srd-5.1:spirit-naga',
        visualVariantId: 'moonlit-necropolis-bite',
        asset: 'spirit-naga-moonlit-necropolis-bite',
      },
      {
        poolId: 'srd-5.1:sprite',
        visualVariantId: 'moonlit-library-heart-sight',
        asset: 'sprite-moonlit-library-heart-sight',
      },
      {
        poolId: 'srd-5.1:spy',
        visualVariantId: 'harbor-tavern-dead-drop',
        asset: 'spy-harbor-tavern-dead-drop',
      },
      {
        poolId: 'srd-5.1:steam-mephit',
        visualVariantId: 'dwarven-boiler-sabotage',
        asset: 'steam-mephit-dwarven-boiler-sabotage',
      },
      {
        poolId: 'srd-5.1:stirge',
        visualVariantId: 'moonlit-swamp-fed',
        asset: 'stirge-moonlit-swamp-fed',
      },
      {
        poolId: 'srd-5.1:stone-giant',
        visualVariantId: 'sunrise-canyon-greatclub',
        asset: 'stone-giant-sunrise-canyon-greatclub',
      },
      {
        poolId: 'srd-5.1:stone-golem',
        visualVariantId: 'catacomb-slow',
        asset: 'stone-golem-catacomb-slow',
      },
      {
        poolId: 'srd-5.1:storm-giant',
        visualVariantId: 'underwater-palace-greatsword',
        asset: 'storm-giant-underwater-palace-greatsword',
      },
      {
        poolId: 'srd-5.1:succubus-incubus',
        visualVariantId: 'cathedral-incubus-reliquary',
        asset: 'succubus-incubus-cathedral-incubus-reliquary',
      },
      {
        poolId: 'srd-5.1:swarm-of-bats',
        visualVariantId: 'storm-bell-tower',
        asset: 'swarm-of-bats-storm-bell-tower',
      },
      {
        poolId: 'srd-5.1:swarm-of-beetles',
        visualVariantId: 'jungle-ruin-jewel-stream',
        asset: 'swarm-of-beetles-jungle-ruin-jewel-stream',
      },
      {
        poolId: 'srd-5.1:swarm-of-centipedes',
        visualVariantId: 'moonlit-caravanserai',
        asset: 'swarm-of-centipedes-moonlit-caravanserai',
      },
      {
        poolId: 'srd-5.1:swarm-of-insects',
        visualVariantId: 'underdark-cave-crickets',
        asset: 'swarm-of-insects-underdark-cave-crickets',
      },
      {
        poolId: 'srd-5.1:swarm-of-poisonous-snakes',
        visualVariantId: 'desert-watchtower',
        asset: 'swarm-of-poisonous-snakes-desert-watchtower',
      },
      {
        poolId: 'srd-5.1:swarm-of-quippers',
        visualVariantId: 'jungle-river-canoe',
        asset: 'swarm-of-quippers-jungle-river-canoe',
      },
      {
        poolId: 'srd-5.1:swarm-of-rats',
        visualVariantId: 'winter-granary',
        asset: 'swarm-of-rats-winter-granary',
      },
      {
        poolId: 'srd-5.1:swarm-of-ravens',
        visualVariantId: 'sunset-observatory',
        asset: 'swarm-of-ravens-sunset-observatory',
      },
      {
        poolId: 'srd-5.1:swarm-of-spiders',
        visualVariantId: 'morning-greenhouse',
        asset: 'swarm-of-spiders-morning-greenhouse',
      },
      {
        poolId: 'srd-5.1:swarm-of-wasps',
        visualVariantId: 'storm-orchard',
        asset: 'swarm-of-wasps-storm-orchard',
      },
      {
        poolId: 'srd-5.1:tarrasque',
        visualVariantId: 'volcanic-caldera-awakening',
        asset: 'tarrasque-volcanic-caldera-awakening',
      },
      {
        poolId: 'srd-5.1:thug',
        visualVariantId: 'roadside-tavern-heavy-crossbow',
        asset: 'thug-roadside-tavern-heavy-crossbow',
      },
      {
        poolId: 'srd-5.1:tiger',
        visualVariantId: 'snowy-bamboo-stalk',
        asset: 'tiger-snowy-bamboo-stalk',
      },
      {
        poolId: 'srd-5.1:treant',
        visualVariantId: 'autumn-marsh-animate-trees',
        asset: 'treant-autumn-marsh-animate-trees',
      },
      {
        poolId: 'srd-5.1:tribal-warrior',
        visualVariantId: 'snow-pass-spear-throw',
        asset: 'tribal-warrior-snow-pass-spear-throw',
      },
      {
        poolId: 'srd-5.1:triceratops',
        visualVariantId: 'red-canyon-defense',
        asset: 'triceratops-red-canyon-defense',
      },
      {
        poolId: 'srd-5.1:troll',
        visualVariantId: 'sunlit-alpine-claw',
        asset: 'troll-sunlit-alpine-claw',
      },
      {
        poolId: 'srd-5.1:tyrannosaurus-rex',
        visualVariantId: 'sunrise-badlands-tail',
        asset: 'tyrannosaurus-rex-sunrise-badlands-tail',
      },
      {
        poolId: 'srd-5.1:unicorn',
        visualVariantId: 'moonlit-alpine-charge',
        asset: 'unicorn-moonlit-alpine-charge',
      },
      {
        poolId: 'srd-5.1:vampire-spawn',
        visualVariantId: 'flooded-crypt-grapple',
        asset: 'vampire-spawn-flooded-crypt-grapple',
      },
      {
        poolId: 'srd-5.1:vampire-bat',
        visualVariantId: 'cemetery-launch',
        asset: 'vampire-bat-cemetery-launch',
      },
      {
        poolId: 'srd-5.1:vampire-mist',
        visualVariantId: 'underground-river',
        asset: 'vampire-mist-underground-river',
      },
      {
        poolId: 'srd-5.1:vampire-vampire',
        visualVariantId: 'castle-wall-charm',
        asset: 'vampire-vampire-castle-wall-charm',
      },
      {
        poolId: 'srd-5.1:veteran',
        visualVariantId: 'snowy-battlement-crossbow',
        asset: 'veteran-snowy-battlement-crossbow',
      },
      {
        poolId: 'srd-5.1:violet-fungus',
        visualVariantId: 'ruined-shrine-false-appearance',
        asset: 'violet-fungus-ruined-shrine-false-appearance',
      },
      {
        poolId: 'srd-5.1:vrock',
        visualVariantId: 'shattered-cathedral-talons',
        asset: 'vrock-shattered-cathedral-talons',
      },
      {
        poolId: 'srd-5.1:vulture',
        visualVariantId: 'sunset-marsh-perch',
        asset: 'vulture-sunset-marsh-perch',
      },
      {
        poolId: 'srd-5.1:warhorse',
        visualVariantId: 'coastal-cliff-rear',
        asset: 'warhorse-coastal-cliff-rear',
      },
      {
        poolId: 'srd-5.1:warhorse-skeleton',
        visualVariantId: 'salt-flat-charge',
        asset: 'warhorse-skeleton-salt-flat-charge',
      },
      {
        poolId: 'srd-5.1:water-elemental',
        visualVariantId: 'sunken-temple-whelm',
        asset: 'water-elemental-sunken-temple-whelm',
      },
      {
        poolId: 'srd-5.1:weasel',
        visualVariantId: 'winter-granary-listen',
        asset: 'weasel-winter-granary-listen',
      },
      {
        poolId: 'srd-5.1:werebear-bear',
        visualVariantId: 'snowmelt-river-charge',
        asset: 'werebear-bear-snowmelt-river-charge',
      },
      {
        poolId: 'srd-5.1:werebear-human',
        visualVariantId: 'alpine-shrine-scent',
        asset: 'werebear-human-alpine-shrine-scent',
      },
      {
        poolId: 'srd-5.1:werebear-hybrid',
        visualVariantId: 'alpine-bridge-greataxe',
        asset: 'werebear-hybrid-alpine-bridge-greataxe',
      },
      {
        poolId: 'srd-5.1:wereboar-boar',
        visualVariantId: 'storm-swamp-relentless',
        asset: 'wereboar-boar-storm-swamp-relentless',
      },
      {
        poolId: 'srd-5.1:wereboar-human',
        visualVariantId: 'red-rock-caravan',
        asset: 'wereboar-human-red-rock-caravan',
      },
      {
        poolId: 'srd-5.1:wereboar-hybrid',
        visualVariantId: 'moonlit-quarry-maul',
        asset: 'wereboar-hybrid-moonlit-quarry-maul',
      },
      {
        poolId: 'srd-5.1:wererat-human',
        visualVariantId: 'dawn-market-shortsword',
        asset: 'wererat-human-dawn-market-shortsword',
      },
      {
        poolId: 'srd-5.1:wererat-hybrid',
        visualVariantId: 'dawn-granary-shortsword',
        asset: 'wererat-hybrid-dawn-granary-shortsword',
      },
      {
        poolId: 'srd-5.1:wererat-rat',
        visualVariantId: 'monastery-cellar-scent',
        asset: 'wererat-rat-monastery-cellar-scent',
      },
      {
        poolId: 'srd-5.1:weretiger-human',
        visualVariantId: 'sunset-ruins-scimitar',
        asset: 'weretiger-human-sunset-ruins-scimitar',
      },
      {
        poolId: 'srd-5.1:weretiger-hybrid',
        visualVariantId: 'snowy-roof-scimitar',
        asset: 'weretiger-hybrid-snowy-roof-scimitar',
      },
      {
        poolId: 'srd-5.1:weretiger-tiger',
        visualVariantId: 'aurora-observatory-stalk',
        asset: 'weretiger-tiger-aurora-observatory-stalk',
      },
      {
        poolId: 'srd-5.1:werewolf-human',
        visualVariantId: 'dawn-marsh-spear-throw',
        asset: 'werewolf-human-dawn-marsh-spear-throw',
      },
      {
        poolId: 'srd-5.1:werewolf-hybrid',
        visualVariantId: 'dawn-chapel-claws',
        asset: 'werewolf-hybrid-dawn-chapel-claws',
      },
      {
        poolId: 'srd-5.1:werewolf-wolf',
        visualVariantId: 'crimson-coast-prowl',
        asset: 'werewolf-wolf-crimson-coast-prowl',
      },
      {
        poolId: 'srd-5.1:white-dragon-wyrmling',
        visualVariantId: 'aurora-cold-breath',
        asset: 'white-dragon-wyrmling-aurora-cold-breath',
      },
      {
        poolId: 'srd-5.1:wight',
        visualVariantId: 'rainy-battlement-longbow',
        asset: 'wight-rainy-battlement-longbow',
      },
      {
        poolId: 'srd-5.1:will-o-wisp',
        visualVariantId: 'flooded-cathedral-hunt',
        asset: 'will-o-wisp-flooded-cathedral-hunt',
      },
      {
        poolId: 'srd-5.1:winter-wolf',
        visualVariantId: 'aurora-lake-cold-breath',
        asset: 'winter-wolf-aurora-lake-cold-breath',
      },
      {
        poolId: 'srd-5.1:worg',
        visualVariantId: 'misty-ravine-stalk',
        asset: 'worg-misty-ravine-stalk',
      },
      {
        poolId: 'srd-5.1:wraith',
        visualVariantId: 'red-dawn-standing-stones',
        asset: 'wraith-red-dawn-standing-stones',
      },
      {
        poolId: 'srd-5.1:wyvern',
        visualVariantId: 'sunset-seacliff-nest',
        asset: 'wyvern-sunset-seacliff-nest',
      },
      {
        poolId: 'srd-5.1:xorn',
        visualVariantId: 'volcanic-mine-ore-carry',
        asset: 'xorn-volcanic-mine-ore-carry',
      },
      {
        poolId: 'srd-5.1:young-black-dragon',
        visualVariantId: 'rainy-causeway-acid',
        asset: 'young-black-dragon-rainy-causeway-acid',
      },
      {
        poolId: 'srd-5.1:young-blue-dragon',
        visualVariantId: 'storm-temple-lightning',
        asset: 'young-blue-dragon-storm-temple-lightning',
      },
      {
        poolId: 'srd-5.1:young-brass-dragon',
        visualVariantId: 'moonlit-canyon-sleep',
        asset: 'young-brass-dragon-moonlit-canyon-sleep',
      },
      {
        poolId: 'srd-5.1:young-bronze-dragon',
        visualVariantId: 'night-lighthouse-lightning',
        asset: 'young-bronze-dragon-night-lighthouse-lightning',
      },
      {
        poolId: 'srd-5.1:young-copper-dragon',
        visualVariantId: 'rainy-gorge-acid',
        asset: 'young-copper-dragon-rainy-gorge-acid',
      },
      {
        poolId: 'srd-5.1:young-gold-dragon',
        visualVariantId: 'crimson-cloud-fire',
        asset: 'young-gold-dragon-crimson-cloud-fire',
      },
      {
        poolId: 'srd-5.1:young-green-dragon',
        visualVariantId: 'jungle-ruin-poison',
        asset: 'young-green-dragon-jungle-ruin-poison',
      },
      {
        poolId: 'srd-5.1:young-red-dragon',
        visualVariantId: 'obsidian-fortress-fire',
        asset: 'young-red-dragon-obsidian-fortress-fire',
      },
      {
        poolId: 'srd-5.1:young-silver-dragon',
        visualVariantId: 'sunrise-peaks-cold',
        asset: 'young-silver-dragon-sunrise-peaks-cold',
      },
      {
        poolId: 'srd-5.1:young-white-dragon',
        visualVariantId: 'aurora-fjord-cold',
        asset: 'young-white-dragon-aurora-fjord-cold',
      },
      {
        poolId: 'srd-5.1:ancient-black-dragon',
        visualVariantId: 'drowned-temple-stalker',
        asset: 'ancient-black-dragon-drowned-temple-stalker',
      },
      {
        poolId: 'srd-5.1:ancient-blue-dragon',
        visualVariantId: 'ziggurat-stormbreath',
        asset: 'ancient-blue-dragon-ziggurat-stormbreath',
      },
      {
        poolId: 'srd-5.1:ancient-brass-dragon',
        visualVariantId: 'oasis-dreammist',
        asset: 'ancient-brass-dragon-oasis-dreammist',
      },
      {
        poolId: 'srd-5.1:ancient-bronze-dragon',
        visualVariantId: 'tidal-bastion',
        asset: 'ancient-bronze-dragon-tidal-bastion',
      },
      {
        poolId: 'srd-5.1:ancient-copper-dragon',
        visualVariantId: 'mooncrystal-slowmist',
        asset: 'ancient-copper-dragon-mooncrystal-slowmist',
      },
      {
        poolId: 'srd-5.1:ancient-gold-dragon',
        visualVariantId: 'stellar-sanctum',
        asset: 'ancient-gold-dragon-stellar-sanctum',
      },
      {
        poolId: 'srd-5.1:ancient-green-dragon',
        visualVariantId: 'storm-ruin-poison',
        asset: 'ancient-green-dragon-storm-ruin-poison',
      },
      {
        poolId: 'srd-5.1:ancient-red-dragon',
        visualVariantId: 'fortress-inferno',
        asset: 'ancient-red-dragon-fortress-inferno',
      },
      {
        poolId: 'srd-5.1:ancient-silver-dragon',
        visualVariantId: 'treasure-vault-repose',
        asset: 'ancient-silver-dragon-treasure-vault-repose',
      },
      {
        poolId: 'srd-5.1:ancient-white-dragon',
        visualVariantId: 'aurora-frostfall',
        asset: 'ancient-white-dragon-aurora-frostfall',
      },
      {
        poolId: 'srd-5.1:androsphinx',
        visualVariantId: 'celestial-archive',
        asset: 'androsphinx-celestial-archive',
      },
      {
        poolId: 'srd-5.1:animated-armor',
        visualVariantId: 'moonlit-ivory-sentinel',
        asset: 'animated-armor-moonlit-ivory-sentinel',
      },
      {
        poolId: 'srd-5.1:ankheg',
        visualVariantId: 'stormfield-eruption',
        asset: 'ankheg-stormfield-eruption',
      },
      {
        poolId: 'srd-5.1:ape',
        visualVariantId: 'storm-ruin-rockthrower',
        asset: 'ape-storm-ruin-rockthrower',
      },
      {
        poolId: 'srd-5.1:archmage',
        visualVariantId: 'crystal-archive',
        asset: 'archmage-crystal-archive',
      },
      {
        poolId: 'srd-5.1:assassin',
        visualVariantId: 'winter-palace-crossbow',
        asset: 'assassin-winter-palace-crossbow',
      },
      {
        poolId: 'srd-5.1:awakened-shrub',
        visualVariantId: 'autumn-thorn',
        asset: 'awakened-shrub-autumn-thorn',
      },
      {
        poolId: 'srd-5.1:awakened-tree',
        visualVariantId: 'moon-swamp-willow',
        asset: 'awakened-tree-moon-swamp-willow',
      },
      {
        poolId: 'srd-5.1:axe-beak',
        visualVariantId: 'mist-forest',
        asset: 'axe-beak-mist-forest',
      },
      {
        poolId: 'srd-5.1:bandit',
        visualVariantId: 'forest-crossbow',
        asset: 'bandit-forest-crossbow',
      },
      {
        poolId: 'srd-5.1:bandit',
        visualVariantId: 'desert-ambush',
        asset: 'bandit-desert-ambush',
      },
      {
        poolId: 'srd-5.1:bandit',
        visualVariantId: 'moon-harbor',
        asset: 'bandit-moon-harbor',
      },
      {
        poolId: 'srd-5.1:bugbear',
        visualVariantId: 'cavern-brute',
        asset: 'bugbear-cavern-brute',
      },
      {
        poolId: 'srd-5.1:kobold',
        visualVariantId: 'canyon-slinger',
        asset: 'kobold-canyon-slinger',
      },
      {
        poolId: 'srd-5.1:kobold',
        visualVariantId: 'sewer-knifeguard',
        asset: 'kobold-sewer-knifeguard',
      },
      {
        poolId: 'srd-5.1:kobold',
        visualVariantId: 'snow-raider',
        asset: 'kobold-snow-raider',
      },
      {
        poolId: 'srd-5.1:skeleton',
        visualVariantId: 'moon-archer',
        asset: 'skeleton-moon-archer',
      },
      {
        poolId: 'srd-5.1:zombie',
        visualVariantId: 'drowned-sailor',
        asset: 'zombie-drowned-sailor',
      },
      {
        poolId: 'srd-5.1:zombie',
        visualVariantId: 'mine-laborer',
        asset: 'zombie-mine-laborer',
      },
      {
        poolId: 'srd-5.1:zombie',
        visualVariantId: 'snow-soldier',
        asset: 'zombie-snow-soldier',
      },
      {
        poolId: 'srd-5.1:wolf',
        visualVariantId: 'snow-howler',
        asset: 'wolf-snow-howler',
      },
    ]
    for (const { poolId, visualVariantId, asset } of cases) {
      const projected = projectCharacterTokenPresentations([
        token({
          type: 'enemy',
          characterId: undefined,
          poolId,
          visualVariantId,
        }),
      ], [])
      expect(projected[0]).toMatchObject({
        portrait: `/assets/portraits/${asset}-initiative.png`,
        tokenPortrait: `/assets/portraits/${asset}-token.png`,
      })
    }
  })
})
