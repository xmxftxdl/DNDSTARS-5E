import type { Character } from '../../types/character'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'
import { dnd5eTokenIntersectsPersistentAreaAt } from './persistentAreaGeometry'
import { tokenOccupiedCellsAt } from '../../lib/gridCombat'
import type { Dnd5eCombatEvent } from './headlessCombatEngine'
import { replaceDnd5eCombatantActiveEffects, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import type { Dnd5eSrdSpellDefinition } from './spells'
import { mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint } from '../../lib/mapGeometry'
import { tokenCenterForAnchorCell } from '../../lib/gridCombat'

const WEB_BURN_TRIGGER_ID = 'web-burning-turn-start'

function isWebArea(area: Dnd5ePluginArea): boolean {
  return area.sourceKind === 'core-spell' && area.coreSpellId === 'web'
}

function cellKey(cell: { col: number; row: number }): string {
  return `${cell.col}:${cell.row}`
}

export function setDnd5eWebAreaUnsupported(input: {
  map: BattleMap
  areaId: string
  collapseAtRound?: number
}): BattleMap | undefined {
  const area = input.map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.areaId)
  if (!area || !isWebArea(area)) return undefined
  const collapseAtRound = input.collapseAtRound == null
    ? undefined
    : Math.max(area.createdRound + 1, Math.min(area.expiresAfterRound, Math.floor(input.collapseAtRound)))
  return {
    ...input.map,
    dnd5ePluginAreas: input.map.dnd5ePluginAreas?.map((candidate) => candidate.id !== area.id
      ? candidate
      : {
          ...candidate,
          webState: collapseAtRound == null && !(candidate.webState?.burningCells?.length)
            ? undefined
            : { ...candidate.webState, unsupportedCollapseAtRound: collapseAtRound },
        }),
  }
}

export function igniteDnd5eWebAreaCell(input: {
  map: BattleMap
  areaId: string
  cell: { col: number; row: number }
  round: number
  turnTokenId: string
}): BattleMap | undefined {
  const area = input.map.dnd5ePluginAreas?.find((candidate) => candidate.id === input.areaId)
  if (
    !area || !isWebArea(area) || !input.turnTokenId ||
    !area.cells.some((cell) => cell.col === input.cell.col && cell.row === input.cell.row)
  ) return undefined
  const key = cellKey(input.cell)
  // Repeated exposure must not restart the one-round burn timer.
  if (area.webState?.burningCells?.some((cell) => cellKey(cell) === key)) return input.map
  const burningCells = [
    ...(area.webState?.burningCells ?? []).filter((cell) => cellKey(cell) !== key),
    {
      col: input.cell.col,
      row: input.cell.row,
      ignitedRound: Math.max(area.createdRound, Math.floor(input.round)),
      expiresAtRound: Math.max(area.createdRound, Math.floor(input.round)) + 1,
      expiresAtTurnTokenId: input.turnTokenId,
    },
  ]
  const triggers = [
    ...(area.triggers ?? []).filter((trigger) => trigger.id !== WEB_BURN_TRIGGER_ID),
    {
      id: WEB_BURN_TRIGGER_ID,
      label: '蛛网术·燃烧蛛网',
      timing: 'turn-start' as const,
      oncePerTurn: true,
      targetKinds: ['creature'] as const,
      damage: { count: 2, sides: 4, type: 'fire' as const },
      cells: burningCells.map(({ col, row }) => ({ col, row })),
      dmAdjustable: false,
    },
  ]
  return {
    ...input.map,
    dnd5ePluginAreas: input.map.dnd5ePluginAreas?.map((candidate) => candidate.id === area.id
      ? { ...candidate, webState: { ...candidate.webState, burningCells }, triggers }
      : candidate),
  }
}

/** Explicit fire footprints include empty squares; damage events cover targeted attacks. */
export function igniteDnd5eWebAreasFromFire(input: {
  map: BattleMap
  round: number
  turnTokenId: string
  events?: readonly Dnd5eCombatEvent[]
  cells?: readonly { col: number; row: number }[]
  minimumElevationFeet?: number
  maximumElevationFeet?: number
}): BattleMap {
  let map = input.map
  const exposures = new Set((input.cells ?? []).map(cellKey))
  for (const area of input.map.dnd5ePluginAreas ?? []) {
    if (!isWebArea(area)) continue
    const exposed = new Set(exposures)
    const vertical = area.vertical
    if (vertical?.mode === 'volume' && input.minimumElevationFeet != null &&
      input.maximumElevationFeet != null &&
      (vertical.baseElevationFeet >= input.maximumElevationFeet ||
        vertical.baseElevationFeet + vertical.heightFeet <= input.minimumElevationFeet)) exposed.clear()
    for (const fire of input.map.dnd5ePluginAreas ?? []) {
      if (fire.coreSpellId === 'web' || !fire.triggers?.some((trigger) => trigger.damage?.type === 'fire')) continue
      if (vertical?.mode === 'volume' && fire.vertical?.mode === 'volume' &&
        (vertical.baseElevationFeet >= fire.vertical.baseElevationFeet + fire.vertical.heightFeet ||
          fire.vertical.baseElevationFeet >= vertical.baseElevationFeet + vertical.heightFeet)) continue
      for (const trigger of fire.triggers ?? []) {
        if (trigger.damage?.type !== 'fire') continue
        for (const cell of trigger.cells ?? fire.cells) exposed.add(cellKey(cell))
      }
    }
    for (const event of input.events ?? []) {
      if (event.type !== 'damage-applied' || !event.damageTypes?.includes('fire')) continue
      if (input.events?.some((candidate) => candidate.type === 'persistent-area-triggered' &&
        candidate.triggerId === WEB_BURN_TRIGGER_ID && candidate.targetId === event.targetId)) continue
      const token = input.map.tokens.find((candidate) => candidate.id === event.targetId)
      if (token && dnd5eTokenIntersectsPersistentAreaAt(token, input.map, area, token)) {
        for (const cell of tokenOccupiedCellsAt(token, input.map, token)) exposed.add(cellKey(cell))
      }
    }
    for (const cell of area.cells) {
      if (!exposed.has(cellKey(cell))) continue
      map = igniteDnd5eWebAreaCell({ map, areaId: area.id, cell,
        round: input.round, turnTokenId: input.turnTokenId }) ?? map
    }
  }
  return map
}

export function igniteDnd5eWebAreasFromSpell(input: {
  map: BattleMap
  spell: Dnd5eSrdSpellDefinition
  /** The actual selected damage type, not a higher-slot allocation choice. */
  damageType?: Dnd5eSrdSpellDefinition['damageType']
  cells?: readonly { col: number; row: number }[]
  elevationFeet?: number
  round: number
  turnTokenId: string
}): BattleMap {
  const hasFire = (input.damageType ?? input.spell.damageType) === 'fire' ||
    input.spell.additionalDamageComponents?.some(component => component.damageType === 'fire')
  if (!hasFire || !input.cells?.length) return igniteDnd5eWebAreasFromFire({
    map: input.map, round: input.round, turnTokenId: input.turnTokenId,
  })
  const shape = input.spell.area
  const center = tokenCenterForAnchorCell(input.cells[0], { size: 1 }, input.map)
  const elevation = input.elevationFeet ?? mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(input.map.id), center)
  const radius = shape?.shape === 'circle' ? shape.radiusFeet : 0
  const height = shape?.shape === 'cone' ? shape.lengthFeet : 5
  return igniteDnd5eWebAreasFromFire({ ...input,
    minimumElevationFeet: elevation - radius,
    maximumElevationFeet: elevation + (radius || height),
  })
}

/** Leaving a web ends only restraints belonging to that web's caster. */
export function reconcileDnd5eWebRestraints(state: Dnd5eHeadlessCombatState, map: BattleMap,
  events: Dnd5eCombatEvent[] = []): void {
  for (const token of map.tokens) {
    const target = state.combatants[token.id]
    if (!target) continue
    const effects = target.classState.activeEffects ?? []
    const retained = effects.filter((effect) => {
      if (effect.source.kind !== 'spell' || effect.source.rulesId !== 'web' ||
        effect.standardCondition !== 'restrained' || effect.duration.type !== 'concentration') return true
      // Entry is being settled before the movement transaction commits its stop point.
      if (events.some((event) => (event.type === 'active-effect-applied' || event.type === 'active-effect-refreshed') &&
        event.targetId === token.id && event.effectId === effect.id)) return true
      const inside = map.dnd5ePluginAreas?.some((area) => isWebArea(area) &&
        area.sourceTokenId === effect.source.actorId &&
        dnd5eTokenIntersectsPersistentAreaAt({ ...token, elevationFeet: target.elevationFeet }, map, area, target.position))
      if (!inside) events.push({ type: 'active-effect-removed', targetId: token.id, effectId: effect.id,
        definitionId: effect.definitionId, reason: 'out-of-range' })
      return inside
    })
    if (retained.length !== effects.length) replaceDnd5eCombatantActiveEffects(target, retained)
  }
}

function matchingWebEffect(
  effect: NonNullable<Token['dnd5eCombatState']>['activeEffects'] extends (infer T)[] | undefined ? T : never,
  area: Dnd5ePluginArea,
): boolean {
  return effect.source.kind === 'spell' && effect.source.rulesId === 'web' &&
    effect.source.actorId === area.sourceTokenId &&
    effect.duration.type === 'concentration' &&
    (effect.duration.concentrationId == null || effect.duration.concentrationId === (area.concentrationId ?? 'web'))
}

function removeWebEffects<T extends {
  conditions?: string[]
  dnd5eCombatState?: Character['dnd5eCombatState']
  concentrating?: boolean
}>(
  subject: T,
  area: Dnd5ePluginArea,
  endSourceConcentration: boolean,
): T {
  const state = subject.dnd5eCombatState
  if (!state) return subject
  const activeEffects = (state.activeEffects ?? []).filter((effect) => !matchingWebEffect(effect, area))
  const controlsThisConcentration = endSourceConcentration &&
    state.concentrationSpellId === (area.concentrationId ?? area.coreSpellId)
  if (activeEffects.length === (state.activeEffects ?? []).length && !controlsThisConcentration) return subject
  const nextState: typeof state & { conditions?: string[] } = {
    ...state,
    activeEffects: activeEffects.length ? activeEffects : undefined,
  }
  const projectedConditions = dnd5eConditionsFromActiveEffects(activeEffects)
  // Unlinked map Tokens store the legacy condition projection inside
  // dnd5eCombatState, while Characters keep it on the top-level object.  Web
  // cleanup used to update only the latter, leaving a Token with no active Web
  // effect but a stale `restrained` projection.  The shared-state validator then
  // rejected the whole combat commit and rolled the visible damage back.
  if ('conditions' in state) {
    nextState.conditions = projectedConditions.length ? projectedConditions : undefined
  }
  if (controlsThisConcentration) {
    delete nextState.concentrationSpellId
    delete nextState.concentrationSpellLevel
    delete nextState.concentrationTargetIds
    delete nextState.concentrationRoundsRemaining
  }
  return {
    ...subject,
    concentrating: controlsThisConcentration ? false : subject.concentrating,
    ...('conditions' in subject ? { conditions: projectedConditions } : {}),
    dnd5eCombatState: nextState,
  } as T
}

export function reconcileDnd5eWebRestraintsOnMap(map: BattleMap, characters: readonly Character[]): {
  map: BattleMap; characters: Character[]
} {
  const areas = (map.dnd5ePluginAreas ?? []).filter(isWebArea)
  const clearOutside = <T extends { dnd5eCombatState?: Character['dnd5eCombatState'] }>(subject: T, token: Token): T => {
    let next = subject
    for (const area of areas) {
      if (!areas.some((candidate) => candidate.sourceTokenId === area.sourceTokenId &&
        dnd5eTokenIntersectsPersistentAreaAt(token, map, candidate, token))) {
        next = removeWebEffects(next, area, false)
      }
    }
    return next
  }
  const tokens = map.tokens.map((token) => clearOutside(token, token))
  return { map: { ...map, tokens }, characters: characters.map((character) => {
    const token = tokens.find((candidate) => candidate.characterId === character.id)
    return token ? clearOutside(character, token) : character
  }) }
}

/** Runs after turn-start Web damage settles so an ignited cube damages occupants before burning away. */
export function expireDnd5eWebAreaAtTurnBoundary(input: {
  map: BattleMap
  characters: readonly Character[]
  timing: 'turn-start' | 'turn-end'
  round: number
  tokenId: string
}): { map: BattleMap; characters: Character[]; logs: string[] } {
  if (input.timing !== 'turn-start') return { map: input.map, characters: [...input.characters], logs: [] }
  const previousAreas = input.map.dnd5ePluginAreas ?? []
  const collapsed: Dnd5ePluginArea[] = []
  const burnedCellsByArea = new Map<string, Set<string>>()
  const nextAreas = previousAreas.flatMap((area) => {
    if (!isWebArea(area)) return [area]
    if (
      area.sourceTokenId === input.tokenId &&
      area.webState?.unsupportedCollapseAtRound != null &&
      input.round >= area.webState.unsupportedCollapseAtRound
    ) {
      collapsed.push(area)
      return []
    }
    const burningCells = area.webState?.burningCells ?? []
    const expiredBurning = burningCells.filter((cell) =>
      cell.expiresAtTurnTokenId === input.tokenId && input.round >= cell.expiresAtRound)
    if (expiredBurning.length === 0) return [area]
    const removedKeys = new Set(expiredBurning.map(cellKey))
    burnedCellsByArea.set(area.id, removedKeys)
    const cells = area.cells.filter((cell) => !removedKeys.has(cellKey(cell)))
    if (cells.length === 0) {
      collapsed.push(area)
      return []
    }
    const remainingBurning = burningCells.filter((cell) => !removedKeys.has(cellKey(cell)))
    const triggers = (area.triggers ?? []).flatMap((trigger) => {
      if (trigger.id !== WEB_BURN_TRIGGER_ID) return [trigger]
      return remainingBurning.length > 0
        ? [{ ...trigger, cells: remainingBurning.map(({ col, row }) => ({ col, row })) }]
        : []
    })
    const triggerReceipts = (area.triggerReceipts ?? []).filter((receipt) =>
      receipt.triggerId !== WEB_BURN_TRIGGER_ID)
    return [{
      ...area,
      cells,
      webState: area.webState?.unsupportedCollapseAtRound != null || remainingBurning.length > 0
        ? {
            unsupportedCollapseAtRound: area.webState?.unsupportedCollapseAtRound,
            burningCells: remainingBurning.length ? remainingBurning : undefined,
          }
        : undefined,
      triggers: triggers.length ? triggers : undefined,
      triggerReceipts: triggerReceipts.length ? triggerReceipts : undefined,
    }]
  })
  if (collapsed.length === 0 && burnedCellsByArea.size === 0) {
    return { map: input.map, characters: [...input.characters], logs: [] }
  }

  const nextMapBase = { ...input.map, dnd5ePluginAreas: nextAreas }
  const affectedAreas = previousAreas.filter((area) => collapsed.includes(area) || burnedCellsByArea.has(area.id))
  const collapsedIds = new Set(collapsed.map((area) => area.id))
  const shouldRetainEffect = (token: Token, area: Dnd5ePluginArea) => {
    if (collapsedIds.has(area.id)) return false
    return nextAreas.some((candidate) =>
      isWebArea(candidate) && candidate.sourceTokenId === area.sourceTokenId &&
      dnd5eTokenIntersectsPersistentAreaAt(token, nextMapBase, candidate, token))
  }
  const tokens = input.map.tokens.map((token) => {
    let next = token
    for (const area of affectedAreas) {
      if (!shouldRetainEffect(next, area)) {
        next = removeWebEffects(next, area, collapsedIds.has(area.id) && next.id === area.sourceTokenId)
      }
    }
    return next
  })
  const tokenByCharacterId = new Map(tokens.flatMap((token) => token.characterId ? [[token.characterId, token] as const] : []))
  const characters = input.characters.map((character) => {
    let next = character
    for (const area of affectedAreas) {
      const token = tokenByCharacterId.get(character.id)
      if (!token || !shouldRetainEffect(token, area)) {
        next = removeWebEffects(next, area, collapsedIds.has(area.id) && character.id === area.sourceCharacterId)
      }
    }
    return next
  })
  return {
    map: { ...nextMapBase, tokens },
    characters,
    logs: [
      ...[...burnedCellsByArea.values()].map((cells) => `蛛网术的 ${cells.size} 个已点燃 5 尺立方燃尽并消失。`),
      ...collapsed.map((area) => `${area.label}因没有固定支撑，在施法者回合开始时坍塌。`),
    ],
  }
}
