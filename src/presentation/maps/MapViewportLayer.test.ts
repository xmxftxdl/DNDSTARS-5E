import { describe, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import { buildMapViewportPresentation } from './MapViewportLayer'

function character(id: string, charClass: string, sourceActorId?: string): Character {
  return {
    id,
    name: id,
    player: 'player',
    avatar: 'hero',
    accent: 'blue',
    race: 'human',
    charClass,
    level: 1,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 10,
    currentHp: 10,
    tempHp: 0,
    hitDice: '1d8',
    ac: 10,
    initiativeBonus: 0,
    speed: 30,
    passivePerception: 10,
    inspiration: 0,
    saveDC: 12,
    conditions: [],
    equipment: {},
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...(sourceActorId ? {
      dnd5eCombatState: {
        activeEffects: [{
          schemaVersion: 1 as const,
          id: `${id}:prone`,
          definitionId: 'condition:prone',
          label: '倒地',
          kind: 'condition' as const,
          standardCondition: 'prone' as const,
          source: { kind: 'feature' as const, actorId: sourceActorId, rulesId: 'trip' },
          duration: { type: 'permanent' as const },
          appliedAt: 1,
          stackingKey: 'condition:prone',
          stackingPolicy: 'replace' as const,
        }],
      },
    } : {}),
  }
}

function token(id: string, characterId: string, x: number): Token {
  return {
    id,
    characterId,
    type: 'player',
    label: id,
    emoji: 'hero',
    color: '#fff',
    x,
    y: 50,
    size: 1,
  }
}

describe('map viewport standard condition presentation', () => {
  it('shows the selected Imprisonment mode above a monster token', () => {
    const wizard = character('archmage', 'wizard')
    const wizardToken = token('archmage-token', wizard.id, 50)
    const monsterToken: Token = {
      id: 'imprisoned-monster', type: 'enemy', label: '怪物', emoji: 'monster', color: '#fff',
      x: 100, y: 50, size: 1,
      dnd5eCombatState: {
        activeEffects: [createDnd5eMechanicalEffect({
          definitionId: 'activity:imprisonment:imprisonment-burial:extension',
          label: '禁锢术：埋葬',
          legacyCondition: 'imprisonment-burial',
          source: { kind: 'spell', actorId: 'archmage-token', rulesId: 'imprisonment', magical: true },
          targetId: 'imprisoned-monster',
          duration: { type: 'permanent' },
        })],
      },
    }
    const map: BattleMap = {
      id: 'imprisonment-map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [wizardToken, monsterToken],
    }

    expect(buildMapViewportPresentation(map, [wizard])
      .dnd5eTokenStatusMarkersByToken[monsterToken.id]).toContainEqual(
        expect.objectContaining({
          statusId: 'imprisoned',
          label: '禁锢术：埋葬',
          activeEffectId: expect.any(String),
          mechanical: true,
          backgroundColor: '#071A38',
          borderColor: '#3B82F6',
          glowColor: '#60A5FA',
        }),
      )
  })

  it('marks a Blinked character token as ethereal without marking it defeated', () => {
    const wizard = character('wizard', 'wizard')
    wizard.dnd5eCombatState = {
      activeEffects: [{
        schemaVersion: 1 as const,
        id: 'blink:banished',
        definitionId: 'blink-ethereal-phase',
        label: '闪现术·以太位面',
        kind: 'condition' as const,
        legacyCondition: 'banished',
        source: {
          kind: 'spell' as const, actorId: wizard.id, rulesId: 'blink', magical: true,
        },
        duration: { type: 'until-turn-boundary' as const, boundary: 'target-turn-start' as const },
        appliedAt: 1,
        stackingKey: 'blink:banished',
        stackingPolicy: 'replace' as const,
      }],
    }
    const wizardToken = token('wizard-token', wizard.id, 50)
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [wizardToken],
    }

    const presentation = buildMapViewportPresentation(map, [wizard])
    expect(presentation.etherealTokenIds).toEqual([wizardToken.id])
    expect(presentation.defeatedTokenIds).toEqual([])
  })

  it('projects a creature form HP pool instead of the linked character base HP', () => {
    const druid = character('druid', 'druid')
    druid.currentHp = 203
    druid.maxHp = 203
    druid.dnd5eCombatState = {
      wildShapeCurrentHp: 114,
      wildShapeFormId: 'srd-5.1:tyrannosaurus-rex',
    }
    const druidToken = {
      ...token('druid-token', druid.id, 50),
      hp: 114,
      maxHp: 136,
    }
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [druidToken],
    }

    expect(buildMapViewportPresentation(map, [druid]).hpByToken[druidToken.id]).toEqual({
      hp: 114,
      max: 136,
      temp: 0,
    })
  })

  it('projects temporary HP for an unlinked monster token into the map canvas', () => {
    const monster = {
      id: 'monster-token',
      type: 'enemy',
      label: '雄性斯芬克斯',
      emoji: 'monster',
      color: '#ef4444',
      x: 50,
      y: 50,
      size: 1,
      hp: 163,
      maxHp: 199,
      dnd5eCombatState: { temporaryHp: 50 },
    } as Token
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [monster],
    }

    expect(buildMapViewportPresentation(map, []).hpByToken[monster.id]).toEqual({
      hp: 163,
      max: 199,
      temp: 50,
    })
  })

  it('projects Active Effect light into the canvas map without mutating the room token', () => {
    const target = character('target', 'fighter')
    target.dnd5eCombatState = {
      activeEffects: [{
        schemaVersion: 1 as const,
        id: 'branding-smite:target',
        definitionId: 'srd-5.1:spell:branding-smite:on-hit-target',
        label: 'Branding Smite',
        kind: 'debuff' as const,
        source: { kind: 'spell' as const, actorId: 'paladin', rulesId: 'branding-smite', magical: true },
        duration: {
          type: 'concentration' as const, sourceActorId: 'paladin',
          concentrationId: 'branding-smite', remainingRounds: 10,
        },
        modifiers: {
          emittedLight: { brightRadiusFeet: 0, dimRadiusFeet: 5, color: '#fef3c7' },
          conditionImmunities: ['invisible' as const],
        },
        appliedAt: 1,
        stackingKey: 'branding-smite:target',
        stackingPolicy: 'replace' as const,
        visibility: 'public' as const,
      }],
    }
    const targetToken = token('target-token', target.id, 50)
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [targetToken],
    }

    const presentation = buildMapViewportPresentation(map, [target])

    expect(presentation.map.tokens[0].lightSource).toEqual({
      enabled: true, brightRadiusFeet: 0, dimRadiusFeet: 5,
      color: '#fef3c7', sourceKind: 'spell',
    })
    expect(map.tokens[0].lightSource).toBeUndefined()
  })

  it('shows a Zone of Truth failed-save badge only while the target occupies its originating area', () => {
    const caster = character('truth-caster', 'cleric')
    const target = character('truth-target', 'fighter')
    target.dnd5eCombatState = {
      activeEffects: [{
        schemaVersion: 1 as const,
        id: 'truth-effect',
        definitionId: 'srd-5.1:spell:zone-of-truth:failed-save',
        label: '诚实之域：区域内无法故意说谎',
        tags: ['semantic-compliance', 'speech-restriction', 'persistent-area:truth-area'],
        kind: 'debuff' as const,
        legacyCondition: 'truth-bound',
        source: {
          kind: 'spell' as const, actorId: 'truth-caster-token',
          rulesId: 'zone-of-truth', magical: true,
        },
        duration: { type: 'rounds' as const, remainingRounds: 100, tickOn: 'target-turn-end' as const },
        appliedAt: 1,
        stackingKey: 'truth-effect:truth-area:truth-target-token',
        stackingPolicy: 'refresh-duration' as const,
      }],
    }
    const casterToken = token('truth-caster-token', caster.id, 50)
    const targetToken = token('truth-target-token', target.id, 150)
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [casterToken, targetToken],
      dnd5ePluginAreas: [{
        id: 'truth-area', pluginId: 'srd-5.1', featureId: 'spell:zone-of-truth',
        sourceKind: 'core-spell', coreSpellId: 'zone-of-truth',
        label: '诚实之域', color: '#2563eb',
        sourceCharacterId: caster.id, sourceTokenId: casterToken.id,
        cells: [{ col: 3, row: 1 }], createdRound: 1, expiresAfterRound: 101,
      }],
    }

    const inside = buildMapViewportPresentation(map, [caster, target])
    expect(inside.dnd5eTokenStatusMarkersByToken[targetToken.id]).toContainEqual(
      expect.objectContaining({
        statusId: 'truth-bound', activeEffectId: 'truth-effect', mechanical: true,
      }),
    )

    const outside = buildMapViewportPresentation({
      ...map,
      tokens: map.tokens.map((entry) => entry.id === targetToken.id ? { ...entry, x: 250 } : entry),
    }, [caster, target])
    expect(outside.dnd5eTokenStatusMarkersByToken[targetToken.id]).toBeUndefined()
  })

  it('projects an active Disguise Self effect onto the character Token', () => {
    const wizard = character('disguised-wizard', 'wizard')
    wizard.dnd5eCombatState = {
      activeEffects: [{
        schemaVersion: 1 as const,
        id: 'disguise-self:appearance',
        definitionId: 'srd-5.1:spell:disguise-self:appearance',
        label: '易容术',
        kind: 'buff' as const,
        legacyCondition: '易容术',
        source: {
          kind: 'spell' as const,
          actorId: wizard.id,
          rulesId: 'disguise-self',
          magical: true,
        },
        duration: { type: 'rounds' as const, remainingRounds: 600, tickOn: 'target-turn-end' as const },
        appliedAt: 1,
        stackingKey: 'disguise-self:appearance',
        stackingPolicy: 'replace' as const,
        visibility: 'public' as const,
      }],
    }
    const wizardToken = token('disguised-wizard-token', wizard.id, 50)
    const map: BattleMap = {
      id: 'disguise-map', name: 'Disguise map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [wizardToken],
    }

    expect(buildMapViewportPresentation(map, [wizard])
      .dnd5eTokenStatusMarkersByToken[wizardToken.id]).toContainEqual(
        expect.objectContaining({
          statusId: 'disguised',
          label: '易容术',
          activeEffectId: 'disguise-self:appearance',
          mechanical: true,
        }),
      )
  })

  it('shows a token-persisted Nondetection badge even when the linked character has other effects', () => {
    const caster = character('nondetection-caster', 'wizard')
    const target = character('nondetection-target', 'fighter', 'nondetection-caster-token')
    const casterToken = token('nondetection-caster-token', caster.id, 50)
    const targetToken = token('nondetection-target-token', target.id, 100)
    targetToken.dnd5eCombatState = {
      activeEffects: [createDnd5eMechanicalEffect({
        definitionId: 'srd-5.1:spell:nondetection',
        label: '回避侦测',
        source: {
          kind: 'spell', actorId: casterToken.id, actorName: caster.name,
          rulesId: 'nondetection', magical: true,
        },
        targetId: targetToken.id,
        duration: { type: 'rounds', remainingRounds: 4_800, tickOn: 'target-turn-end' },
      })],
    }
    const map: BattleMap = {
      id: 'nondetection-map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [casterToken, targetToken],
    }

    expect(buildMapViewportPresentation(map, [caster, target])
      .dnd5eTokenStatusMarkersByToken[targetToken.id]).toContainEqual(
        expect.objectContaining({
          statusId: 'nondetection',
          label: '回避侦测',
          activeEffectId: expect.any(String),
          backgroundColor: '#071A38',
          borderColor: '#3B82F6',
          glowColor: '#60A5FA',
        }),
      )
  })

  it('preserves a spell light source that explicitly counts as sunlight', () => {
    const target = character('sunbeam-caster', 'wizard')
    target.dnd5eCombatState = {
      activeEffects: [{
        schemaVersion: 1 as const,
        id: 'sunbeam:caster',
        definitionId: 'srd-5.1:spell:sunbeam',
        label: 'Sunbeam',
        kind: 'buff' as const,
        source: { kind: 'spell' as const, actorId: target.id, rulesId: 'sunbeam', magical: true },
        duration: {
          type: 'concentration' as const, sourceActorId: target.id,
          concentrationId: 'sunbeam', remainingRounds: 10,
        },
        modifiers: {
          emittedLight: {
            brightRadiusFeet: 30, dimRadiusFeet: 30, color: '#fef3c7', sunlight: true,
          },
        },
        appliedAt: 1,
        stackingKey: 'sunbeam:caster',
        stackingPolicy: 'replace' as const,
        visibility: 'public' as const,
      }],
    }
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [token('caster-token', target.id, 50)],
    }

    expect(buildMapViewportPresentation(map, [target]).map.tokens[0].lightSource).toEqual({
      enabled: true, brightRadiusFeet: 30, dimRadiusFeet: 30,
      color: '#fef3c7', sourceKind: 'spell', sunlight: true,
    })
  })

  it('colors the same prone icon from the effect source class', () => {
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [
        token('wizard-token', 'wizard', 50),
        token('fighter-token', 'fighter', 100),
        token('wizard-target-token', 'wizard-target', 150),
        token('fighter-target-token', 'fighter-target', 200),
      ],
    }
    const presentation = buildMapViewportPresentation(map, [
      character('wizard', 'wizard'),
      character('fighter', 'fighter'),
      character('wizard-target', 'fighter', 'wizard-token'),
      character('fighter-target', 'wizard', 'fighter'),
    ])

    expect(presentation.standardConditionTokenMarks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tokenId: 'wizard-target-token', condition: 'prone',
        backgroundColor: '#071A38', borderColor: '#3B82F6', glowColor: '#60A5FA',
      }),
      expect.objectContaining({
        tokenId: 'fighter-target-token', condition: 'prone',
        backgroundColor: '#111827', borderColor: '#94A3B8', glowColor: '#CBD5E1',
      }),
    ]))
    expect('tokenHoverLabels' in presentation).toBe(false)
  })

  it('renders spell-granted invisibility as one standard condition badge', () => {
    for (const spellId of ['invisibility', 'greater-invisibility'] as const) {
      const wizard = character(`wizard-${spellId}`, 'wizard')
      wizard.dnd5eCombatState = {
        activeEffects: [{
          schemaVersion: 1 as const,
          id: `${spellId}:invisible`,
          definitionId: `srd-5.1:spell:${spellId}`,
          label: spellId === 'invisibility' ? '隐形术' : '高等隐形术',
          kind: 'condition' as const,
          standardCondition: 'invisible' as const,
          source: {
            kind: 'spell' as const,
            actorId: wizard.id,
            rulesId: spellId,
            magical: true,
          },
          duration: { type: 'concentration' as const, sourceActorId: wizard.id, concentrationId: spellId },
          appliedAt: 1,
          stackingKey: `condition:invisible:${spellId}`,
          stackingPolicy: 'replace' as const,
        }],
      }
      const wizardToken = token(`${wizard.id}-token`, wizard.id, 50)
      const map: BattleMap = {
        id: `map-${spellId}`, name: 'Map', width: 500, height: 300,
        gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
        tokens: [wizardToken],
      }

      const presentation = buildMapViewportPresentation(map, [wizard])
      expect(presentation.standardConditionTokenMarks).toEqual([
        expect.objectContaining({
          tokenId: wizardToken.id,
          condition: 'invisible',
          backgroundColor: '#071A38',
          borderColor: '#3B82F6',
          glowColor: '#60A5FA',
        }),
      ])
      expect(presentation.spellStatusTokenMarks).not.toContainEqual(
        expect.objectContaining({
          tokenId: wizardToken.id,
          statusId: spellId,
        }),
      )
      expect(presentation.dnd5eTokenStatusMarkersByToken[wizardToken.id] ?? []).not.toContainEqual(
        expect.objectContaining({ statusId: 'hidden' }),
      )
    }
  })

  it('colors a granted Longstrider marker from the caster class instead of the target class', () => {
    const wizard = character('longstrider-caster', 'wizard')
    const target = character('longstrider-target', 'fighter')
    target.dnd5eCombatState = {
      activeEffects: [{
        schemaVersion: 1 as const,
        id: 'longstrider:target',
        definitionId: 'srd-5.1:spell:longstrider',
        label: '大步奔行',
        kind: 'buff' as const,
        source: {
          kind: 'spell' as const,
          actorId: wizard.id,
          rulesId: 'longstrider',
          magical: true,
        },
        duration: { type: 'rounds' as const, remainingRounds: 600, tickOn: 'target-turn-end' as const },
        appliedAt: 1,
        stackingKey: 'longstrider:target',
        stackingPolicy: 'replace' as const,
      }],
    }
    const map: BattleMap = {
      id: 'longstrider-map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [
        token('longstrider-caster-token', wizard.id, 50),
        token('longstrider-target-token', target.id, 100),
      ],
    }

    expect(buildMapViewportPresentation(map, [wizard, target]).spellStatusTokenMarks).toContainEqual(
      expect.objectContaining({
        tokenId: 'longstrider-target-token',
        statusId: 'longstrider',
        backgroundColor: '#071A38',
        borderColor: '#3B82F6',
        glowColor: '#60A5FA',
        classId: 'wizard',
      }),
    )
  })

  it('keeps two same-condition ActiveEffects as two clickable Token instances', () => {
    const target = character('target', 'fighter')
    target.dnd5eCombatState = {
      activeEffects: ['wizard-token', 'fighter-token'].map((sourceActorId, index) => ({
        schemaVersion: 1 as const,
        id: `effect:prone:${index + 1}`,
        definitionId: 'condition:prone',
        label: '倒地',
        kind: 'condition' as const,
        standardCondition: 'prone' as const,
        source: { kind: 'feature' as const, actorId: sourceActorId, rulesId: 'trip' },
        duration: { type: 'permanent' as const },
        appliedAt: index + 1,
        stackingKey: `condition:prone:${index + 1}`,
        stackingPolicy: 'stack' as const,
      })),
    }
    const map: BattleMap = {
      id: 'map', name: 'Map', width: 500, height: 300,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [
        token('wizard-token', 'wizard', 50),
        token('fighter-token', 'fighter', 100),
        token('target-token', 'target', 150),
      ],
    }

    const marks = buildMapViewportPresentation(map, [
      character('wizard', 'wizard'),
      character('fighter', 'fighter'),
      target,
    ]).standardConditionTokenMarks.filter((mark) => mark.tokenId === 'target-token')

    expect(marks.map((mark) => mark.instance.id)).toEqual([
      'effect:prone:1',
      'effect:prone:2',
    ])
    expect(marks.map((mark) => mark.borderColor)).toEqual(['#3B82F6', '#94A3B8'])
  })
})
