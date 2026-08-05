import {
  cellKey,
  occupiedCells,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import {
  mapGeometryCanSeeToken,
  mapGeometryPlacementBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { dnd5eStandardConditionId } from './conditions'
import type {
  MonsterDecisionCandidate,
  MonsterDecisionContext,
} from './monsterDecisionContracts'
import type { Dnd5eMonsterTurnPlan } from './monsterTurnPlan'
import type {
  Dnd5eMonsterBehaviorStyle,
  Dnd5eMonsterStatBlock,
} from './monsters'
import { dnd5eMonsterActionAutomation } from './monsterSchema'

export interface MonsterStructuredSpecialCandidateServices {
  hitPoints(target: Token, characters: readonly Character[]): { current: number; maximum: number }
  armorClass(target: Token, characters: readonly Character[]): number
  distanceFeet(map: BattleMap, actor: Token, target: Token): number
  preferredDistanceFeet(
    monster: Dnd5eMonsterStatBlock,
    role: MonsterDecisionContext['tacticalRole'],
    behaviorStyle: Dnd5eMonsterBehaviorStyle,
  ): number
  conditions(target: Token, characters: readonly Character[]): readonly string[]
  tacticalDistanceImprovement(
    role: MonsterDecisionContext['tacticalRole'],
    beforeFeet: number,
    afterFeet: number,
    preferredFeet: number,
  ): number
  coverBonus(map: BattleMap, actor: Token, target: Token): number
}

export function createMonsterStructuredSpecialActionCandidates(input: {
  map: BattleMap
  enemy: Token
  monster: Dnd5eMonsterStatBlock
  target: Token
  characters: readonly Character[]
  canUseAction: boolean
  requiredActionId?: string
  role: MonsterDecisionContext['tacticalRole']
  behaviorStyle: Dnd5eMonsterBehaviorStyle
  services: MonsterStructuredSpecialCandidateServices
}): MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>[] {
  if (!input.canUseAction) return []
  const { map, enemy, monster, target, characters, services } = input
  const geometry = mapGeometryRuntimeForMap(map.id)
  const hp = services.hitPoints(target, characters)
  const targetAc = services.armorClass(target, characters)
  const startDistanceFeet = services.distanceFeet(map, enemy, target)
  const preferred = services.preferredDistanceFeet(monster, input.role, input.behaviorStyle)
  const actions = monster.actions.filter((action) =>
    action.kind === 'other' &&
    dnd5eMonsterActionAutomation(action) === 'headless' &&
    (action.rule?.kind === 'teleport' || action.rule?.kind === 'invisibility') &&
    (input.requiredActionId == null || action.id === input.requiredActionId) &&
    (
      action.usage?.kind !== 'recharge' ||
      enemy.dnd5eCombatState?.monsterRechargeReadyByActionId?.[action.id] !== false
    ) &&
    (
      action.usage?.kind !== 'per-day' ||
      (enemy.dnd5eCombatState?.monsterActionUsesByActionId?.[action.id]?.current ??
        action.usage.max) > 0
    ))
  if (actions.length === 0) return []

  return actions.flatMap<MonsterDecisionCandidate<Dnd5eMonsterTurnPlan>>((action) => {
    const rule = action.rule
    if (rule?.kind === 'invisibility') {
      const alreadyInvisible = services.conditions(enemy, characters).some((condition) =>
        dnd5eStandardConditionId(condition) === 'invisible')
      if (alreadyInvisible || enemy.dnd5eCombatState?.concentrationSpellId) return []
      const actorHp = services.hitPoints(enemy, characters)
      return [{
        id: `special:invisibility:${action.id}`,
        kind: 'support' as const,
        payload: {
          moved: false,
          attacked: false,
          attackerTokenId: enemy.id,
          targetTokenId: target.id,
          specialAction: {
            kind: 'invisibility' as const,
            actionId: action.id,
            actionName: action.name,
          },
          message: `${enemy.label}使用${action.name}进入隐形。`,
        },
        metrics: {
          expectedDamage: 0,
          targetCurrentHp: hp.current,
          targetMaximumHp: hp.maximum,
          targetArmorClass: targetAc,
          hitProbability: 1,
          supportValue: 16 + (1 - actorHp.current / actorHp.maximum) * 24,
          resourceCost: action.usage ? 4 : 0,
          targetDistanceFeet: startDistanceFeet,
          preferredDistanceFeet: preferred,
          movementFeet: 0,
          distanceImprovementFeet: 0,
          defensiveCoverBonus: 0,
          opportunityAttackRisk: 0,
          attacksThisTurn: false,
          consumesAction: true,
          dodges: false,
          dashes: false,
          usesNimbleEscape: false,
          usesPreciseCoverRoute: false,
        },
      }]
    }
    if (rule?.kind !== 'teleport') return []

    const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
    const columns = Math.max(1, Math.floor((map.width - map.gridOffsetX) / Math.max(1, map.gridSize)))
    const rows = Math.max(1, Math.floor((map.height - map.gridOffsetY) / Math.max(1, map.gridSize)))
    const startCell = tokenAnchorCellFromPixel(enemy.x, enemy.y, enemy, map)
    const occupied = occupiedCells(map.tokens, map, enemy.id)
    const legal: Array<{
      cell: GridCell
      elevationFeet: number
      targetDistanceFeet: number
      improvement: number
      coverBonus: number
    }> = []
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const cell = { col, row }
        const horizontalDistanceFeet = Math.max(
          Math.abs(col - startCell.col),
          Math.abs(row - startCell.row),
        ) * feetPerCell
        if (horizontalDistanceFeet > rule.rangeFeet + 1e-4) continue
        const position = tokenCenterForAnchorCell(cell, enemy, map)
        const elevationFeet = mapGeometryTerrainElevationAtPoint(geometry, position)
        if (Math.max(
          horizontalDistanceFeet,
          Math.abs(elevationFeet - mapGeometryTokenElevation(geometry, enemy)),
        ) > rule.rangeFeet + 1e-4) continue
        const footprint = tokenOccupiedCellsAt(enemy, map, position)
        if (footprint.some((candidate) =>
          candidate.col < 0 || candidate.row < 0 ||
          candidate.col >= columns || candidate.row >= rows ||
          occupied.has(cellKey(candidate)))) continue
        if (mapGeometryPlacementBlocked({
          geometry,
          map,
          token: enemy,
          at: position,
          elevationFeet,
        }).blocked) continue
        const at = { ...enemy, ...position, elevationFeet }
        if (!mapGeometryCanSeeToken({
          geometry,
          map,
          viewer: enemy,
          target: at,
          forceEnabled: true,
          fallbackRangeFeet: rule.rangeFeet,
        })) continue
        const distanceFeet = services.distanceFeet(map, at, target)
        const improvement = services.tacticalDistanceImprovement(
          input.role,
          startDistanceFeet,
          distanceFeet,
          preferred,
        )
        if (improvement <= 0 && input.requiredActionId == null) continue
        legal.push({
          cell,
          elevationFeet,
          targetDistanceFeet: distanceFeet,
          improvement,
          coverBonus: services.coverBonus(map, at, target),
        })
      }
    }
    legal.sort((left, right) =>
      right.improvement - left.improvement ||
      right.coverBonus - left.coverBonus ||
      left.targetDistanceFeet - right.targetDistanceFeet ||
      left.cell.row - right.cell.row ||
      left.cell.col - right.cell.col)
    return legal.slice(0, 16).map((destination) => ({
      id: `special:teleport:${action.id}:${destination.cell.col},${destination.cell.row}:${destination.elevationFeet}`,
      kind: 'support' as const,
      payload: {
        moved: false,
        attacked: false,
        attackerTokenId: enemy.id,
        targetTokenId: target.id,
        specialAction: {
          kind: 'teleport' as const,
          actionId: action.id,
          actionName: action.name,
          destinationCell: destination.cell,
          destinationElevationFeet: destination.elevationFeet,
        },
        message: `${enemy.label}使用${action.name}传送到合法可见空位。`,
      },
      metrics: {
        expectedDamage: 0,
        targetCurrentHp: hp.current,
        targetMaximumHp: hp.maximum,
        targetArmorClass: targetAc,
        hitProbability: 1,
        controlValue: Math.min(12, destination.improvement / 5),
        resourceCost: action.usage ? 4 : 0,
        targetDistanceFeet: destination.targetDistanceFeet,
        preferredDistanceFeet: preferred,
        movementFeet: 0,
        distanceImprovementFeet: destination.improvement,
        defensiveCoverBonus: destination.coverBonus,
        opportunityAttackRisk: 0,
        attacksThisTurn: false,
        consumesAction: true,
        dodges: false,
        dashes: false,
        usesNimbleEscape: false,
        usesPreciseCoverRoute: destination.coverBonus > 0,
      },
    }))
  })
}
