import type { Dnd5eMonsterStatBlock, Dnd5eMonsterAction, Dnd5eMonsterSourceLinkedConditionOnHitEffect } from '../monsters'

export function falseHydraHeadGrapple(headId: string): Dnd5eMonsterSourceLinkedConditionOnHitEffect {
  return {id:`grapple-${headId}`,kind:'source-linked-condition',relation:{kind:'grapple',slotGroup:`false-hydra-${headId}`,
    capacity:1,maxDistanceFeet:305,targetMaxSizeRank:3,whenCapacityFull:'skip-application',movement:'drag-target',endsOnSourceIncapacitated:true},
    escapeDc:16,conditions:[{condition:'grappled'}]}
}

export function falseHydraHeadSwallow(headId:string):Dnd5eMonsterSourceLinkedConditionOnHitEffect {
  return {id:`swallow-${headId}`,kind:'source-linked-condition',relation:{kind:'swallowed',slotGroup:`false-hydra-swallow-${headId}`,
    capacity:1000,maxDistanceFeet:305,targetMaxSizeRank:2,whenCapacityFull:'skip-application',movement:'carry-target',endsOnSourceIncapacitated:false},
    conditions:[{condition:'restrained'},{condition:'blinded',dependsOnCondition:'restrained'}],
    escapeSavingThrow:{ability:'str',alternativeAbility:'dex',dc:16,economy:'action'},
    periodicDamage:{timing:'target-turn-end',count:1,sides:10,modifier:5,type:'acid'},
    removeSourceRelationSlotGroupOnApply:`false-hydra-${headId}`}
}

const headActions: Dnd5eMonsterAction[] = Array.from({length:9},(_,index)=>{
  const headId=`head-${index+1}`
  return [
    {id:`swallow-${headId}`,name:`头${index+1} · 吞噬`,multipartHeadId:headId,kind:'other',automation:'headless',
      description:'吞下这个头擒抱的中型或更小目标，束缚、目盲、对外全掩护；目标回合结束受到1d10+5强酸伤害。',
      relationRequirement:{kind:'target-linked-to-source',slotGroup:`false-hydra-${headId}`},
      rule:{kind:'source-linked-engulf',targetMaxSizeRank:2,effect:falseHydraHeadSwallow(headId)}},
    {id:`bite-${headId}`,name:`头${index+1} · 啃咬`,multipartHeadId:headId,kind:'weapon-attack',automation:'headless',
      description:'以这个头啃咬；命中大型或更小目标时擒抱，DC16挣脱。',
      attack:{mode:'melee',naturalWeapon:true,toHit:8,reachFeet:5,target:'一个目标',
        damage:[{average:10,count:1,sides:10,bonus:5,type:'piercing'}],onHitEffects:[falseHydraHeadGrapple(headId)]}},
    {id:`screech-${headId}`,name:`头${index+1} · 嘶啸`,multipartHeadId:headId,kind:'other',automation:'headless',
      description:'以这个头为起点的15尺锥形，DC16体质豁免，3d6雷鸣，成功减半。',
      rule:{kind:'area-saving-throw',area:{shape:'cone',origin:'self',lengthFeet:15,aimRangeFeet:15},
        target:'all-creatures-except-self',ability:'con',dc:16,
        damage:{average:10,count:3,sides:6,bonus:0,type:'thunder'},damageOnSuccessfulSave:'half'}},
  ] as Dnd5eMonsterAction[]
}).flat()

/** User-supplied homebrew. Fixed HP is intentional; the supplied dice text is retained. */
export const FALSE_HYDRA: Dnd5eMonsterStatBlock = {
  id:'room-monster:false-hydra', slug:'false-hydra',name:'伪海德拉',englishName:'False Hydra',source:'DM 自定义',
  multipartRule:'false-hydra-v1',size:'巨型',creatureType:'异怪',alignment:'中立邪恶',
  armorClass:{value:16,note:'天生护甲'},hitPoints:{average:184,dice:'16d12+20'},speed:{walk:40,swim:10},
  abilities:{str:20,dex:12,con:20,int:14,wis:16,cha:10},savingThrows:{con:8,wis:6},
  skills:[{key:'acrobatics',name:'特技',bonus:4},{key:'perception',name:'察觉',bonus:6},{key:'performance',name:'表演',bonus:6}],
  conditionImmunities:['charmed','frightened'],senses:[{name:'黑暗视觉',distanceFeet:300},{name:'震颤感知',distanceFeet:60}],
  passivePerception:16,languages:['理解吞噬过的生物生前知道的全部语言，但不会说话'],challenge:{rating:'8',xp:3900},
  legendaryActionPoints:3,
  traits:[
    {name:'负伤',description:'法师菲约克曾摧毁它的大多数头。此版本初始有四个头，最多九个；未提供其他头数的独立属性表。'},
    {name:'多重攻击',description:'一个动作中，每个存活的头各执行一次啃咬、嘶啸、吞噬或寂静挽歌。每个头不能重复；也可用整个动作发动多头齐啸。'},
    {name:'多头',description:'累计每受到50点伤害，由DM选择一个头死亡。至少两个头时，智力、感知和魅力豁免具有优势。过去24小时吞噬过类人生物且完成长休，可以再生一个头。'},
    {name:'长颈',description:'每个头与本体的距离至多300尺；分离于本体时占据中型生物空间。每个头每回合可独立移动30尺，包括垂直移动，并引发借机攻击。本体移动时全部头一同平移。头、颈与身体共享生命；同一范围效应只影响本体一次。'},
    {name:'多头反应',description:'超过一个的每个头增加一次只能用于借机攻击的反应。'},
    {name:'多头韧性',description:'豁免失败后可选择受到25点心灵伤害，将结果改为成功。此伤害同样累计断头阈值。'},
    {name:'异界本质',description:'伪海德拉不需要睡眠。'},
    {name:'被遗忘者的安魂曲',description:'吞噬一小时内死亡的尸体，或被吞噬者在体内死亡时，认识死者的生物开始遗忘，持续20减智力值分钟（至少1分钟）。期间主动回忆者可察觉并记录；完成后也遗忘重塑过程。心灵屏障或类似效应保护记忆。受害者只能以完全复生术、祈愿术或神力干预复活。具体记忆内容由DM叙事裁定。'},
  ],
  actions:[
    ...headActions,
    {id:'many-headed-scream',name:'多头齐啸',kind:'other',automation:'headless',rule:{kind:'area-saving-throw',area:{shape:'circle',origin:'self',radiusFeet:60},target:'all-creatures-except-self',ability:'con',dc:16,damage:{average:27,count:5,sides:10,bonus:0,type:'thunder'},damageOnSuccessfulSave:'half',conditionOnFailedSave:{condition:'stunned',durationRounds:1,repeatSaveAtEndOfTargetTurn:false}},usage:{kind:'recharge',dieSides:6,minimum:5},description:'所有头60尺发散范围的并集；每个目标仅结算一次DC16体质豁免。失败受到5d10雷鸣伤害并震慑至其下一回合结束；成功伤害减半。'},
  ],
  legendaryActions:headActions.filter(action=>action.kind==='weapon-attack' || action.rule?.kind==='area-saving-throw')
    .map(action=>({...action,id:`legendary-${action.id}`,name:action.name,legendaryCost:1})),
  description:'用户提供的四头负伤版伪海德拉。本资料不是SRD官方怪物。固定生命值184，保留原文生命骰16d12+20（两者算术不一致）。需要支持false-hydra-v1多部位规则的服务器。',
}
