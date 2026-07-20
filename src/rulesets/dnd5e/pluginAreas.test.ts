import { describe, expect, it } from 'vitest'
import type { Dnd5ePluginArea } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  collectDnd5ePersistentAreaTriggers,
  reconcileDnd5ePluginAreas,
  reconcileDnd5ePluginAreasOnMap,
} from './pluginAreas'
import {
  prepareDnd5ePersistentAreaTrigger,
  resolvePreparedDnd5ePersistentAreaTrigger,
} from './pluginAreaTransactions'

const area = (patch: Partial<Dnd5ePluginArea> = {}): Dnd5ePluginArea => ({
  id: 'area-1', pluginId: 'com.example.area', featureId: 'com.example.area:mist', label: '迷雾', color: '#8b5cf6',
  sourceCharacterId: 'caster', sourceTokenId: 'caster-token', cells: [{ col: 1, row: 1 }],
  createdRound: 1, expiresAfterRound: 3, ...patch,
})

const character = (patch: Partial<Character> = {}): Character => ({
  id: 'caster', name: 'caster', player: '', avatar: '', accent: '', race: '人类', charClass: '法师', level: 3,
  background: '', experience: 0, reputation: 0, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savingThrows: [], skills: [], maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '3d6', ac: 10, speed: 30,
  initiativeBonus: 0, saveDC: 12, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
  visibleToPlayers: true, ...patch,
})

describe('D&D 5e plugin persistent areas', () => {
  it('expires finite areas after their declared round', () => {
    expect(reconcileDnd5ePluginAreas([area()], [character()], 3)).toHaveLength(1)
    expect(reconcileDnd5ePluginAreas([area()], [character()], 4)).toHaveLength(0)
  })

  it('removes concentration areas as soon as the source concentration no longer matches', () => {
    const concentrated = area({ concentrationId: 'plugin-area:action-1' })
    expect(reconcileDnd5ePluginAreas([concentrated], [character({
      concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'plugin-area:action-1' },
    })], 2)).toHaveLength(1)
    expect(reconcileDnd5ePluginAreas([concentrated], [character({ concentrating: false })], 2)).toHaveLength(0)
  })

  it('persists old trigger-receipt cleanup even when the area count does not change', () => {
    const retained = area({
      expiresAfterRound: 10,
      triggerReceipts: [
        { triggerId: 'tick', targetTokenId: 'target', round: 1, transactionId: 'old' },
        { triggerId: 'tick', targetTokenId: 'target', round: 5, transactionId: 'recent' },
      ],
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [], dnd5ePluginAreas: [retained],
    }
    const reconciled = reconcileDnd5ePluginAreasOnMap(map, [character()], 6)
    expect(reconciled).not.toBe(map)
    expect(reconciled.dnd5ePluginAreas?.[0].triggerReceipts).toEqual([
      expect.objectContaining({ transactionId: 'recent' }),
    ])
    expect(reconcileDnd5ePluginAreasOnMap(reconciled, [character()], 6)).toBe(reconciled)
  })

  it('detects entry along the complete movement path and deduplicates once-per-round triggers', () => {
    const moving = {
      id: 'target-token', label: 'target', x: 25, y: 25, color: '#fff', emoji: 'T', size: 1,
      type: 'player' as const, characterId: 'target',
    }
    const source = {
      id: 'caster-token', label: 'caster', x: 25, y: 125, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const triggerArea = area({
      cells: [{ col: 2, row: 0 }],
      triggers: [{
        id: 'cloud-entry', label: '毒云', timing: 'on-enter', oncePerRound: true,
        damage: { count: 1, sides: 6, modifier: 0, type: 'poison' },
      }],
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source, moving], dnd5ePluginAreas: [triggerArea],
    }
    const found = collectDnd5ePersistentAreaTriggers({
      map, timing: 'on-enter', round: 2, movement: { token: moving, to: { x: 225, y: 25 } },
    })
    expect(found).toHaveLength(1)
    expect(found[0].enteredAt).toEqual({ col: 2, row: 0 })

    const withReceipt = {
      ...map,
      dnd5ePluginAreas: [{
        ...triggerArea,
        triggerReceipts: [{
          triggerId: 'cloud-entry', targetTokenId: 'target-token', round: 2,
          transactionId: found[0].transactionId,
        }],
      }],
    }
    expect(collectDnd5ePersistentAreaTriggers({
      map: withReceipt, timing: 'on-enter', round: 2,
      movement: { token: moving, to: { x: 225, y: 25 } },
    })).toHaveLength(0)
  })

  it('collects creation, turn-start and turn-end triggers only for tokens inside the area', () => {
    const source = {
      id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const target = {
      id: 'target-token', label: 'target', x: 75, y: 25, color: '#fff', emoji: 'T', size: 1,
      type: 'player' as const, characterId: 'target',
    }
    const triggerArea = area({
      cells: [{ col: 1, row: 0 }],
      triggers: [
        { id: 'created', label: '首次创建', timing: 'on-create', oncePerRound: true },
        { id: 'started', label: '回合开始', timing: 'turn-start', oncePerRound: true },
        { id: 'ended', label: '回合结束', timing: 'turn-end', oncePerRound: true },
      ],
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source, target], dnd5ePluginAreas: [triggerArea],
    }

    expect(collectDnd5ePersistentAreaTriggers({ map, timing: 'on-create', round: 2, areaId: triggerArea.id }))
      .toMatchObject([{ trigger: { id: 'created' }, targetToken: { id: target.id } }])
    expect(collectDnd5ePersistentAreaTriggers({ map, timing: 'turn-start', round: 2, targetTokenId: target.id }))
      .toMatchObject([{ trigger: { id: 'started' } }])
    expect(collectDnd5ePersistentAreaTriggers({ map, timing: 'turn-end', round: 2, targetTokenId: target.id }))
      .toMatchObject([{ trigger: { id: 'ended' } }])
  })

  it('resolves saves, half damage and ActiveEffect conditions through Headless', () => {
    const triggerArea = area({
      sourceTokenId: 'caster-token',
      cells: [{ col: 1, row: 0 }],
      includeSelf: false,
      triggers: [{
        id: 'moonlight', label: '月华区域', timing: 'turn-start', oncePerRound: true,
        savingThrow: { ability: 'con', dc: 12, onSuccess: 'half' },
        damage: { count: 2, sides: 6, modifier: 0, type: 'radiant' },
        condition: {
          condition: 'blinded',
          duration: { expiresAt: 'target-next-turn-start' },
        },
      }],
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [
        { id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C', size: 1, type: 'player' as const, characterId: 'caster' },
        { id: 'target-token', label: 'target', x: 75, y: 25, color: '#fff', emoji: 'T', size: 1, type: 'player' as const, characterId: 'target' },
      ],
      dnd5ePluginAreas: [triggerArea],
    }
    const characters = [character({ id: 'caster', name: 'caster' }), character({ id: 'target', name: 'target', currentHp: 20, maxHp: 20 })]
    const candidate = collectDnd5ePersistentAreaTriggers({
      map, timing: 'turn-start', round: 2, targetTokenId: 'target-token',
    })[0]
    const prepared = prepareDnd5ePersistentAreaTrigger({
      combatId: 'combat', round: 2, map, characters,
      initiativeOrder: [
        { tokenId: 'caster-token', roll: 15, label: 'caster', emoji: 'C', color: '#fff', slotId: 'caster-slot' },
        { tokenId: 'target-token', roll: 10, label: 'target', emoji: 'T', color: '#fff', slotId: 'target-slot' },
      ],
      candidate,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: prepared.prepared,
      d20: 20,
      damageRolls: [6, 6],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', saveSuccess: true, damage: 6,
    }))
    expect(resolved.application?.characters.find((entry) => entry.id === 'target')?.currentHp).toBe(14)
    expect(resolved.application?.characters.find((entry) => entry.id === 'target')?.conditions).not.toContain('blinded')
    expect(resolved.application?.map.dnd5ePluginAreas?.[0].triggerReceipts).toHaveLength(1)
  })
})
