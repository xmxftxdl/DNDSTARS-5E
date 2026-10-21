import { getDnd5eSrdCombatSpell, type Dnd5eSrdSpellDefinition } from './spells'

// Monster-only targeting metadata. Effects come from the audited Activity;
// adding this entry must not redirect player casts into the legacy spell path.
const detectMagic: Dnd5eSrdSpellDefinition = {
  id:'detect-magic',name:'侦测魔法',englishName:'Detect Magic',level:1,school:'预言',
  classes:['bard','cleric','druid','paladin','ranger','sorcerer','wizard'],
  castingTime:'action',rangeFeet:0,target:'creature',effect:'active-effect',
  dice:{count:0,sides:4,bonus:0},maximumTargets:1,concentration:true,
  concentrationDurationRounds:100,description:'感知自身周围30尺内的魔法；以动作查看可见魔法灵光。',
}

const confusion: Dnd5eSrdSpellDefinition = {
  id:'confusion',name:'困惑术',englishName:'Confusion',level:4,school:'附魔',
  classes:['bard','druid','sorcerer','wizard'],castingTime:'action',rangeFeet:90,target:'area',
  effect:'saving-throw',saveAbility:'wis',damageOnSuccessfulSave:'none',dice:{count:0,sides:4,bonus:0},
  maximumTargets:256,areaIncludesSelf:true,area:{shape:'circle',origin:'point',radiusFeet:10,placeRangeFeet:90},
  areaRadiusFeetPerHigherSlot:5,concentration:true,concentrationDurationRounds:10,onFailedSaveEffect:'confusion',
  description:'区域内生物进行感知豁免；失败者陷入困惑，每回合结束可再次豁免。',
}

export function getDnd5eMonsterCombatSpell(id:string):Dnd5eSrdSpellDefinition|undefined {
  return getDnd5eSrdCombatSpell(id) ?? (id==='detect-magic'?detectMagic:id==='confusion'?confusion:undefined)
}
