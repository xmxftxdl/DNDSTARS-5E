import { describe, expect, it } from 'vitest'
import {
  mapAoeSelectMode,
  mapAoeTargetingSessionKey,
  mapSpellTargetIdsForAuthoritySubmission,
  mapTargetSelectionTokenIds,
  pluginAreaTargetingAllowsEmptyArea,
  playerGrantedActivityAoeSelectActive,
  sculptSpellSelectableTokenIds,
  spellAreaSelectionLocked,
  spellAreaModifierSelectionActive,
} from './aoeTargetingSession'

describe('sculptSpellSelectableTokenIds', () => {
  it('keeps visible player and enemy characters in the area directly selectable', () => {
    expect(sculptSpellSelectableTokenIds({
      affectedTargetIds: ['caster-token', 'ally-token', 'enemy-token', 'hidden-token', 'door'],
      casterCharacterId: 'wizard',
      tokens: [
        { id: 'caster-token', type: 'player', characterId: 'wizard' },
        { id: 'ally-token', type: 'player', characterId: 'fighter' },
        { id: 'enemy-token', type: 'enemy' },
        { id: 'hidden-token', type: 'npc', perceptionVisibility: 'detected-unseen' },
        { id: 'door', type: 'obstacle' },
      ],
    })).toEqual(['ally-token', 'enemy-token'])
  })

  it('uses the locked template coverage when the transient target cache is stale', () => {
    expect(sculptSpellSelectableTokenIds({
      affectedTargetIds: ['enemy-token'],
      committedAreaTargetIds: ['ally-token', 'enemy-token'],
      casterCharacterId: 'wizard',
      tokens: [
        { id: 'caster-token', type: 'player', characterId: 'wizard' },
        { id: 'ally-token', type: 'player', characterId: 'fighter' },
        { id: 'enemy-token', type: 'enemy' },
      ],
    })).toEqual(['ally-token', 'enemy-token'])
  })
})

describe('mapAoeSelectMode', () => {
  const base = {
    playerSpellAoeSelectActive: false,
    playerActivityAoeSelectActive: false,
    coreAreaMoveTargetingActive: false,
    playerCombatLocked: true,
    activeAoeTargeting: false,
    itemAreaTargetingActive: false,
    guessedSpellTargetingActive: false,
  }

  it('keeps a player-owned persistent spell move clickable after combat settlement', () => {
    expect(mapAoeSelectMode({ ...base, coreAreaMoveTargetingActive: true })).toBe(true)
  })

  it('does not unlock unrelated generic targeting while post-combat presentation is locked', () => {
    expect(mapAoeSelectMode({ ...base, activeAoeTargeting: true })).toBe(false)
  })

  it('preserves ordinary area targeting when there is no post-combat lock', () => {
    expect(mapAoeSelectMode({
      ...base,
      playerCombatLocked: false,
      activeAoeTargeting: true,
    })).toBe(true)
  })

  it('turns off area re-aiming while a committed template selects modifier targets', () => {
    expect(mapAoeSelectMode({
      ...base,
      playerCombatLocked: false,
      playerSpellAoeSelectActive: true,
      activeAoeTargeting: true,
      spellAreaSelectionLocked: true,
    })).toBe(false)
  })
})

describe('spellAreaSelectionLocked', () => {
  it('locks a committed single cone independently of the modifier toggle', () => {
    const committed = {
      area: { shape: 'cone' },
      areaTargetSelected: true,
      areaTargetCell: { col: 6, row: 2 },
      areaTargetCount: 1,
      sculpting: false,
    }

    expect(spellAreaSelectionLocked(committed)).toBe(true)
  })

  it('keeps an unfinished multi-area spell placeable until its final area is committed', () => {
    const targeting = {
      area: { shape: 'circle' },
      areaTargetSelected: true,
      areaTargetCell: { col: 2, row: 2 },
      areaTargetCells: [{ col: 2, row: 2 }],
      areaTargetCount: 4,
    }

    expect(spellAreaSelectionLocked(targeting)).toBe(false)
    expect(spellAreaSelectionLocked({ ...targeting, sculpting: true })).toBe(true)
    expect(spellAreaSelectionLocked({
      ...targeting,
      areaTargetCells: [
        { col: 2, row: 2 },
        { col: 3, row: 2 },
        { col: 4, row: 2 },
        { col: 5, row: 2 },
      ],
    })).toBe(true)
  })
})

describe('spellAreaModifierSelectionActive', () => {
  it('requires a committed area and an active creature modifier picker', () => {
    const committed = {
      area: { shape: 'cone' },
      areaTargetSelected: true,
      areaTargetCell: { col: 6, row: 2 },
    }
    expect(spellAreaModifierSelectionActive({ ...committed, sculpting: true })).toBe(true)
    expect(spellAreaModifierSelectionActive({ ...committed, carefulSelecting: true })).toBe(true)
    expect(spellAreaModifierSelectionActive({ ...committed, heightenedSelecting: true })).toBe(true)
    expect(spellAreaModifierSelectionActive({ ...committed, excludingAreaTargets: true })).toBe(true)
    expect(spellAreaModifierSelectionActive(committed)).toBe(false)
    expect(spellAreaModifierSelectionActive({ ...committed, areaTargetCell: undefined, sculpting: true })).toBe(false)
  })
})

describe('mapAoeTargetingSessionKey', () => {
  it('keeps one spell targeting session stable while its selected targets change', () => {
    const spellArea = {
      characterId: 'wizard',
      castingClassId: 'wizard',
      spellId: 'fireball',
      slotLevel: 3,
    }

    expect(mapAoeTargetingSessionKey({ spellArea }))
      .toBe(mapAoeTargetingSessionKey({ spellArea: { ...spellArea } }))
  })

  it('starts a new session for a different cast configuration', () => {
    const base = {
      characterId: 'wizard',
      castingClassId: 'wizard',
      spellId: 'fireball',
      slotLevel: 3,
    }

    expect(mapAoeTargetingSessionKey({ spellArea: base }))
      .not.toBe(mapAoeTargetingSessionKey({ spellArea: { ...base, slotLevel: 4 } }))
  })

  it('uses a stable identity for a racial innate spell without a class id', () => {
    expect(mapAoeTargetingSessionKey({
      spellArea: {
        characterId: 'dragonborn',
        spellId: 'burning-hands',
        slotLevel: 1,
      },
    })).toBe('spell:dragonborn:racial-innate:burning-hands:1:')
  })

  it('uses the active targeting source priority and clears when none is active', () => {
    expect(mapAoeTargetingSessionKey({
      coreAreaMove: { characterId: 'wizard', areaId: 'flaming-sphere' },
      spellArea: {
        characterId: 'wizard',
        castingClassId: 'wizard',
        spellId: 'fireball',
        slotLevel: 3,
      },
    })).toBe('core:wizard:flaming-sphere')
    expect(mapAoeTargetingSessionKey({})).toBeNull()
  })
})

describe('playerGrantedActivityAoeSelectActive', () => {
  it('keeps player-owned persistent area and effect Activities clickable outside combat', () => {
    expect(playerGrantedActivityAoeSelectActive({
      isDM: false,
      pluginArea: { persistentAreaId: 'project-image-area' },
    })).toBe(true)
    expect(playerGrantedActivityAoeSelectActive({
      isDM: false,
      pluginArea: { activeEffectId: 'controlled-spell-effect' },
    })).toBe(true)
  })

  it('does not bypass the lock for DM mode or an ungranted plugin action', () => {
    expect(playerGrantedActivityAoeSelectActive({
      isDM: true,
      pluginArea: { persistentAreaId: 'project-image-area' },
    })).toBe(false)
    expect(playerGrantedActivityAoeSelectActive({
      isDM: false,
      pluginArea: {},
    })).toBe(false)
  })
})

describe('pluginAreaTargetingAllowsEmptyArea', () => {
  it('allows an active-effect-granted Activity to select an empty destination cell', () => {
    expect(pluginAreaTargetingAllowsEmptyArea({
      activeEffectId: 'blink-return-pending',
    })).toBe(true)
  })

  it('keeps ordinary creature-area plugin actions from submitting an empty template', () => {
    expect(pluginAreaTargetingAllowsEmptyArea({})).toBe(false)
  })
})

describe('mapSpellTargetIdsForAuthoritySubmission', () => {
  it('submits only the anchor for an area spell so the Host discovers affected creatures', () => {
    expect(mapSpellTargetIdsForAuthoritySubmission({
      hasArea: true,
      targetKind: 'area',
      selectedTargetIds: ['visible-goblin', 'stale-goblin'],
    })).toEqual([])
  })

  it('preserves explicitly selected targets for selective spells', () => {
    expect(mapSpellTargetIdsForAuthoritySubmission({
      hasArea: true,
      targetKind: 'creature',
      selectedTargetIds: ['cleric', 'fighter', 'fighter'],
    })).toEqual(['cleric', 'fighter'])
  })
})

describe('mapTargetSelectionTokenIds', () => {
  it('projects every selected spell target into the shared dashed Token outline', () => {
    expect(mapTargetSelectionTokenIds(
      ['longstrider-target', 'invisibility-target'],
      ['monster-attack-target'],
      ['invisibility-target'],
    )).toEqual([
      'longstrider-target',
      'invisibility-target',
      'monster-attack-target',
    ])
  })

  it('ignores inactive targeting groups', () => {
    expect(mapTargetSelectionTokenIds(undefined, null, [])).toEqual([])
  })
})
