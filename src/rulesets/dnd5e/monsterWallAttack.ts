import { wallArmorClass } from './wallObjectRules'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { getDnd5eSrdMonster, getDnd5eSrdMonsterBySlug, dnd5eMonsterActionUsageId, type Dnd5eMonsterAction } from './monsters'
import { dnd5eMonsterEffectiveWeaponAttack, dnd5eMonsterWeaponAttackAtDistance } from './monsterGenericAbilities'
import { dnd5eMonsterMultiattackConstraint } from './monsterMultiattackConstraints'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'
import { dnd5eConditionIncapacitated } from './conditions'
import { createDnd5eMapCombatSnapshot, dnd5eMapTokenCanThreatenRangedAttacker } from './mapBridge'
import { dnd5eFrightenedAttackDisadvantage } from './headlessCombatEngine'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import { dnd5eMapTokenDistanceFeet } from './verticalCombatGeometry'
import { mapGeometryLineOfEffectBlocked, mapGeometryRuntimeForMap, mapGeometryTokenElevation } from '../../lib/mapGeometry'

export function spendMonsterWallAttackUses(token: Token, actions: readonly Dnd5eMonsterAction[]): Token | undefined {
  const state = { ...token.dnd5eCombatState, monsterActionUsesByActionId: { ...token.dnd5eCombatState?.monsterActionUsesByActionId }, monsterRechargeReadyByActionId: { ...token.dnd5eCombatState?.monsterRechargeReadyByActionId } }
  for (const action of actions) {
    const id = dnd5eMonsterActionUsageId(action)
    if (action.usage?.kind === 'recharge') {
      if (state.monsterRechargeReadyByActionId[id] === false) return undefined
      state.monsterRechargeReadyByActionId[id] = false
    } else if (action.usage?.kind === 'per-day') {
      const uses = state.monsterActionUsesByActionId[id] ?? {current:action.usage.max,max:action.usage.max}
      if (uses.current < 1) return undefined
      state.monsterActionUsesByActionId[id] = {...uses,current:uses.current-1}
    }
  }
  return {...token,dnd5eCombatState:state}
}

export function prepareMonsterWallAttack(input: {
  map: BattleMap; characters: readonly Character[]; actorTokenId: string; areaId: string; panelId: string;
  actionIndex: number; resourceKind: 'action' | 'bonus-action'; economy: Dnd5eTurnEconomyCounts;
  rollMode?: 'normal' | 'advantage' | 'disadvantage'
}) {
  const fail = (reason: string) => ({ok:false as const,reason})
  const {map} = input
  const token = map.tokens.find(t=>t.id===input.actorTokenId)
  const monster = token?.poolId && (getDnd5eSrdMonster(token.poolId) ?? getDnd5eSrdMonsterBySlug(token.poolId))
  const area = map.dnd5ePluginAreas?.find(a=>a.id===input.areaId)
  const panel = area?.stoneWall?.panels.find(p=>p.id===input.panelId && p.hitPoints>0)
  if (!token || !monster || !area || !panel) return fail('目标或怪物已不存在。')
  const conditions=dnd5eConditionsFromActiveEffects(token.dnd5eCombatState?.activeEffects,token.dnd5eCombatState?.conditions)
  if ((token.hp ?? monster.hitPoints.average)<=0 || dnd5eConditionIncapacitated({conditions})) return fail('怪物当前无法攻击。')
  const resource=input.resourceKind==='bonus-action'?'bonusAction' as const:'action' as const
  if(input.economy[resource].current<1) return fail('本回合该行动资源已用完。')
  const action=(input.resourceKind==='bonus-action'?monster.bonusActions:monster.actions)?.[input.actionIndex]
  if(!action || !['weapon-attack','multiattack'].includes(action.kind)) return fail('请选择怪物的武器攻击动作。')
  if(action.randomRepeat || action.kind==='multiattack' && dnd5eMonsterMultiattackConstraint(monster.id,action.id)) return fail('这个特殊多重攻击不能对墙段使用，请选择其中的独立武器攻击。')
  const children=action.kind==='multiattack'?action.sequence?.map(id=>monster.actions.find(a=>a.id===id)):[action]
  if(!children?.length || children.length>32 || children.some(a=>!a?.attack || a.kind!=='weapon-attack' || a.targetEligibility || a.relationRequirement || a.requiredActiveEffectDefinitionId || a.forbiddenActiveEffectDefinitionId)) return fail('此动作含有生物目标或特殊前置要求，请选择独立武器攻击。')
  const attacks=children as Dnd5eMonsterAction[]
  const resourceActions=action.kind==='multiattack'?[action,...attacks]:attacks
  if(!spendMonsterWallAttackUses(token,resourceActions))return fail('充能或每日攻击次数不足。')
  const grid=map.gridSize,feet=map.feetPerCell??5
  const a={x:map.gridOffsetX+(panel.start.col+.5)*grid,y:map.gridOffsetY+(panel.start.row+.5)*grid}
  const b={x:map.gridOffsetX+(panel.end.col+.5)*grid,y:map.gridOffsetY+(panel.end.row+.5)*grid}
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((token.x-a.x)*dx+(token.y-a.y)*dy)/Math.max(1,dx*dx+dy*dy)))
  const point={x:a.x+dx*t,y:a.y+dy*t}
  const geometry=mapGeometryRuntimeForMap(map.id), elevation=mapGeometryTokenElevation(geometry,token)
  const base=area.vertical?.mode==='volume'?area.vertical.baseElevationFeet:0
  const distance=Math.max(0,Math.max(Math.abs(point.x-token.x),Math.abs(point.y-token.y))/grid*feet-Math.max(0,(token.size-1)*feet/2),base-elevation,elevation-base-10)
  const rayMap={...map,dnd5ePluginAreas:map.dnd5ePluginAreas?.map(candidate=>candidate.id===area.id?{...candidate,stoneWall:{...candidate.stoneWall!,panels:candidate.stoneWall!.panels.filter(p=>p.id!==panel.id)}}:candidate)}
  if(mapGeometryLineOfEffectBlocked({map:rayMap,geometry,from:token,to:point,fromElevationFeet:elevation,toElevationFeet:Math.max(base,Math.min(base+10,elevation))}))return fail('另一面墙或障碍物挡住了攻击路径。')
  const snapshot=createDnd5eMapCombatSnapshot({combatId:map.id,map,characters:input.characters,initiativeOrder:[]})
  const actor=snapshot.state.combatants[token.id]
  const frightened=actor && dnd5eFrightenedAttackDisadvantage(snapshot.state,actor)
  const threatened=actor && map.tokens.some(enemy=>enemy.id!==token.id && enemy.type!=='obstacle' && areOpposedCombatTokens(token,enemy) && dnd5eMapTokenCanThreatenRangedAttacker(actor,enemy,snapshot.state.combatants[enemy.id]) && dnd5eMapTokenDistanceFeet({map,geometry,left:token,right:enemy})<=5)
  const entries=attacks.map(child=>{
    const attack=dnd5eMonsterWeaponAttackAtDistance(dnd5eMonsterEffectiveWeaponAttack(child.attack!,token.hp??monster.hitPoints.average,token.maxHp??monster.hitPoints.average),distance,action.sequenceAttackMode)
    const disadvantage=frightened || conditions.some(c=>['blinded','poisoned','restrained','prone'].includes(c)) || attack.mode==='ranged' && (threatened || distance>(attack.rangeFeet?.normal??Infinity))
    return {action:child,attack,mode:input.rollMode??(disadvantage?'disadvantage' as const:'normal' as const)}
  })
  if(entries.some(e=>distance>(e.attack.mode==='melee'?(e.attack.reachFeet??5):(e.attack.rangeFeet?.long??0))))return fail('墙段超出所选攻击的触及或射程。')
  const siege=monster.traits.some(trait=>/^siege monster$/i.test(trait.name.trim()) || trait.name==='攻城怪物')
  return {ok:true as const,armorClass:wallArmorClass(area),token,monster,area,panel,action,entries,resource,resourceActions,siege,label:`${area.label} · 第 ${area.stoneWall!.panels.indexOf(panel)+1} 段`}
}
