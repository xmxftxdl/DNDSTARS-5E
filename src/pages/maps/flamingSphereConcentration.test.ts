import { describe, expect, it, vi } from 'vitest'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import { cellsForAoe } from '../../lib/skillTargeting'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  createDnd5eCoreSpellArea,
  getDnd5eCoreSpellAreaDeclaration,
} from '../../rulesets/dnd5e/coreSpellAreas'
import {
  collectDnd5ePersistentAreaTriggers,
} from '../../rulesets/dnd5e/pluginAreas'
import {
  prepareDnd5ePersistentAreaTrigger,
  resolvePreparedDnd5ePersistentAreaTrigger,
} from '../../rulesets/dnd5e/pluginAreaTransactions'
import { settleDnd5eConcentrationChecks } from './settleDnd5eCombatResult'

function character(id: string, patch: Partial<Character> = {}): Character {
  return {
    id,
    name: id,
    player: '',
    avatar: '',
    accent: '',
    race: 'Human',
    charClass: 'Wizard',
    level: 5,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 100,
    currentHp: 100,
    tempHp: 0,
    hitDice: '5d6',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 16,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    ...patch,
  }
}

function token(id: string, characterId: string, x: number, y: number): Token {
  return {
    id,
    characterId,
    label: id,
    x,
    y,
    color: '#fff',
    emoji: '',
    size: 1,
    type: 'player',
    hp: 100,
    maxHp: 100,
  }
}

describe('Flaming Sphere concentration damage transaction', () => {
  it('settles one concentration save when turn-end area damage hits a structured concentrator', async () => {
    const declaration = getDnd5eCoreSpellAreaDeclaration('flaming-sphere')!
    const anchorCell = { col: 2, row: 2 }
    const area = createDnd5eCoreSpellArea({
      declaration,
      actionId: 'flaming-sphere-concentration-regression',
      sourceCharacterId: 'sphere-caster',
      sourceTokenId: 'sphere-caster-token',
      slotLevel: 2,
      sourceSaveDc: 16,
      round: 1,
      cells: cellsForAoe(declaration.template, anchorCell, anchorCell),
      anchorCell,
      baseElevationFeet: 0,
    })
    const casterToken = token('sphere-caster-token', 'sphere-caster', 25, 125)
    const targetToken = token('target-token', 'target', 175, 125)
    const initiativeOrder: InitiativeEntry[] = [
      { tokenId: casterToken.id, slotId: 'caster-slot', label: casterToken.label, emoji: '', color: '#fff', roll: 15 },
      { tokenId: targetToken.id, slotId: 'target-slot', label: targetToken.label, emoji: '', color: '#fff', roll: 10 },
    ]
    const map: BattleMap = {
      id: 'flaming-sphere-concentration-map',
      name: 'Flaming Sphere Concentration',
      width: 500,
      height: 500,
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
      showGrid: true,
      feetPerCell: 5,
      tokens: [casterToken, targetToken],
      dnd5ePluginAreas: [area],
    }
    const characters = [
      character('sphere-caster', {
        concentrating: true,
        dnd5eCombatState: {
          concentrationSpellId: 'flaming-sphere',
          concentrationSpellLevel: 2,
        },
      }),
      character('target', {
        // Reproduces the short sync window from the app: the structured state
        // and badge are current while the legacy sheet boolean is still false.
        concentrating: false,
        dnd5eCombatState: {
          concentrationSpellId: 'bless',
          concentrationSpellLevel: 1,
          concentrationTargetIds: [targetToken.id],
        },
      }),
    ]
    const turnKey = '1:target-slot'
    const candidate = collectDnd5ePersistentAreaTriggers({
      map,
      timing: 'turn-end',
      round: 1,
      targetTokenId: targetToken.id,
      turnKey,
    })[0]
    expect(candidate).toBeDefined()
    if (!candidate) return

    const prepared = prepareDnd5ePersistentAreaTrigger({
      combatId: 'flaming-sphere-concentration-combat',
      round: 1,
      map,
      characters,
      initiativeOrder,
      candidate,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.state.combatants[targetToken.id].concentrating).toBe(true)

    const damaged = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: prepared.prepared,
      d20: 20,
      damageRolls: [6, 6],
    })
    expect(damaged.result.ok).toBe(true)
    expect(damaged.application).toBeDefined()
    if (!damaged.result.ok || !damaged.application) return
    expect(damaged.result.events).toContainEqual({
      type: 'concentration-check-required',
      targetId: targetToken.id,
      dc: 10,
    })

    const rollD20 = vi.fn(async () => 1)
    const settled = await settleDnd5eConcentrationChecks({
      result: damaged.result,
      map: damaged.application.map,
      characters: damaged.application.characters,
      priorApplication: damaged.application,
      characterIdByCombatantId: prepared.prepared.characterIdByCombatantId,
      rollD20,
      rollD4: async () => 1,
      rollDice: async () => [],
    })

    expect(rollD20).toHaveBeenCalledTimes(1)
    expect(rollD20).toHaveBeenCalledWith('专注·体质豁免 DC 10', targetToken.label)
    expect(settled.result.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved',
      actorId: targetToken.id,
      success: false,
    }))
    const settledTarget = settled.application.characters.find((entry) => entry.id === 'target')
    expect(settledTarget).toMatchObject({
      currentHp: 94,
      concentrating: false,
    })
    expect(settledTarget?.dnd5eCombatState?.concentrationSpellId).toBeUndefined()

    // The authoritative area receipt makes a retry of the same end-turn command
    // a no-op, so damage and its concentration save cannot be duplicated.
    expect(collectDnd5ePersistentAreaTriggers({
      map: settled.application.map,
      timing: 'turn-end',
      round: 1,
      targetTokenId: targetToken.id,
      turnKey,
    })).toEqual([])
  })
})
