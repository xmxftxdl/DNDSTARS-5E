import { wallArmorClass } from './wallObjectRules'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import { createDnd5eMapCombatSnapshot, dnd5eMapTokenCanThreatenRangedAttacker } from './mapBridge'
import { dnd5eFrightenedAttackDisadvantage } from './headlessCombatEngine'
import { dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type { SharedPlayerActionState, Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { mapGeometryLineOfEffectBlocked, mapGeometryRuntimeForMap, mapGeometryTokenElevation } from '../../lib/mapGeometry'
import { dnd5eWeaponAttackProfile, dnd5eOffHandWeaponAttackProfile, dnd5eWeaponRangeFeet, dnd5eWeaponPropertyIds, dnd5eWearingUnproficientArmor } from './equipment'
import { dnd5eEffectiveAttacksPerAttackAction } from './pluginApi'
import { dnd5eConditionIncapacitated } from './conditions'
import { dnd5eActiveMagicWeaponBonus, dnd5eConditionsFromActiveEffects } from './activeEffects'
import { consumeDnd5eWeaponAmmunition } from './items'
import { resolvePersistentAreaEntityAttackByDm } from './persistentAreaRemoval'

export function prepareStoneWallAttack(input: { map: BattleMap; characters: readonly Character[]; action: SharedPlayerActionState; economy: Dnd5eTurnEconomyCounts }) {
  const { map, action, economy } = input
  const reject = (reason: string) => ({ ok: false as const, reason })
  const target = action.dnd5eWallTarget
  const area = map.dnd5ePluginAreas?.find(a => a.id === target?.areaId)
  const panel = area?.stoneWall?.panels.find(p => p.id === target?.panelId && p.hitPoints > 0)
  const actor = input.characters.find(c => c.id === action.characterId)
  const token = map.tokens.find(t => t.id === action.actorTokenId && t.characterId === actor?.id)
  if (action.type !== 'dnd5e-weapon-attack' || !area || !panel || !actor || !token) return reject('invalid-target')
  const conditions = dnd5eConditionsFromActiveEffects(actor.dnd5eCombatState?.activeEffects, actor.conditions)
  if (actor.currentHp <= 0 || dnd5eConditionIncapacitated({ conditions })) return reject('invalid-actor')
  const options = action.dnd5eWeaponAttackOptions ?? {}
  // Creature-specific riders must never be silently consumed against an object.
  if (Object.entries(options).some(([key, value]) => !['offHandAttack', 'shillelaghAbility', 'declarativeIntentFeatureIds'].includes(key) && value != null && value !== false) || options.declarativeIntentFeatureIds?.length) return reject('wall-attack-options-unsupported')
  const offHand = options.offHandAttack === true
  const profile = offHand ? dnd5eOffHandWeaponAttackProfile(actor) : dnd5eWeaponAttackProfile(actor, { shillelaghAbility: options.shillelaghAbility })
  if (!profile) return reject('no-weapon')
  const ammunition = consumeDnd5eWeaponAmmunition(actor, profile.weaponId)
  if (!ammunition.ok) return reject('ammunition-unavailable')
  const perAction = dnd5eWeaponPropertyIds(profile.properties).includes('loading') ? 1 : dnd5eEffectiveAttacksPerAttackAction(actor)
  const used = economy.attacksUsed ?? 0
  const spendsAction = !offHand && used % perAction === 0
  if (offHand ? used < 1 || economy.bonusAction.current < 1 : used >= perAction * economy.action.max || spendsAction && economy.action.current < 1) return reject('attack-action-spent')
  const grid = map.gridSize, feet = map.feetPerCell ?? 5
  const a = { x: map.gridOffsetX + (panel.start.col + .5) * grid, y: map.gridOffsetY + (panel.start.row + .5) * grid }
  const b = { x: map.gridOffsetX + (panel.end.col + .5) * grid, y: map.gridOffsetY + (panel.end.row + .5) * grid }
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((token.x - a.x) * dx + (token.y - a.y) * dy) / Math.max(1, dx * dx + dy * dy)))
  const point = { x: a.x + dx * t, y: a.y + dy * t }
  const geometry = mapGeometryRuntimeForMap(map.id)
  const elevation = mapGeometryTokenElevation(geometry, token)
  const base = area.vertical?.mode === 'volume' ? area.vertical.baseElevationFeet : 0
  const zDistance = Math.max(0, base - elevation, elevation - base - 10)
  const distance = Math.max(0, Math.max(Math.abs(point.x - token.x), Math.abs(point.y - token.y)) / grid * feet - Math.max(0, (token.size - 1) * feet / 2), zDistance)
  if (distance > dnd5eWeaponRangeFeet(profile)) return reject('target-out-of-range')
  // Ignore only the attacked segment, retaining every other wall as cover.
  const rayMap = { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas?.map(candidate => candidate.id === area.id ? { ...candidate, stoneWall: { ...candidate.stoneWall!, panels: candidate.stoneWall!.panels.filter(p => p.id !== panel.id) } } : candidate) }
  if (mapGeometryLineOfEffectBlocked({ map: rayMap, geometry, from: token, to: point, fromElevationFeet: elevation, toElevationFeet: Math.max(base, Math.min(base + 10, elevation)) })) return reject('target-behind-total-cover')
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: action.combatId ?? map.id, round: action.round, map, characters: input.characters, initiativeOrder: [] })
  const combatant = snapshot.state.combatants[token.id]
  const frightened = combatant && dnd5eFrightenedAttackDisadvantage(snapshot.state, combatant)
  const threatened = profile.mode === 'ranged' && combatant && map.tokens.some(enemy => enemy.id !== token.id && enemy.type !== 'obstacle' &&
    areOpposedCombatTokens(token, enemy) && dnd5eMapTokenCanThreatenRangedAttacker(combatant, enemy, snapshot.state.combatants[enemy.id]) &&
    dnd5eMapTokenDistanceFeet({map, geometry, left:token, right:enemy}) <= 5)
  const disadvantage = frightened || threatened || conditions.some(c => ['blinded', 'restrained', 'poisoned', 'prone'].includes(c)) ||
    dnd5eWearingUnproficientArmor(actor) || (profile.mode === 'ranged' && distance > (profile.rangeFeet?.normal ?? Infinity))
  const magicBonus = dnd5eActiveMagicWeaponBonus(actor.dnd5eCombatState?.activeEffects, profile.weaponId)
  return { ok: true as const, armorClass: wallArmorClass(area), actor, token, area, panel, profile, point, ammunition, spendsAction, offHand,
    attackNumber: offHand ? used : used + 1, mode: disadvantage ? 'disadvantage' as const : 'normal' as const,
    attackModifier: profile.attackModifier + magicBonus, damageBonus: profile.damage.bonus + magicBonus,
    label: `${area.label} · 第 ${area.stoneWall!.panels.indexOf(panel) + 1} 段` }
}

export function stoneWallAttackRoll(attack: Extract<ReturnType<typeof prepareStoneWallAttack>, { ok: true }>, d20: number, second?: number) {
  const natural = second == null ? d20 : attack.mode === 'disadvantage' ? Math.min(d20, second) : d20
  const total = natural + attack.attackModifier
  return { natural, total, hit: natural === 20 || natural !== 1 && total >= attack.armorClass, critical: natural >= attack.profile.criticalThreshold }
}

export function settleStoneWallAttack(input: { map: BattleMap; characters: readonly Character[]; areaId: string; panelId: string; hit: boolean; total: number; damage: number; damageType: string }) {
  const area = input.map.dnd5ePluginAreas?.find(area => area.id === input.areaId)
  if (!area || area.coreSpellId === 'wall-of-force') return undefined
  const ac = wallArmorClass(area)
  return resolvePersistentAreaEntityAttackByDm({ ...input, attackTotal: input.hit ? Math.max(ac, input.total) : Math.min(ac - 1, input.total), damage: Math.max(0, input.damage) })
}
