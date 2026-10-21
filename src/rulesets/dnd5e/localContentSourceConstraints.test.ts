import {expect,it} from 'vitest'
import {dnd5eLocalContentSourceConstraintIssues} from './localContentSourceConstraints'
it('rejects split mixed damage, fixed attack mode and accidental self exclusion for an explicit rolled-type source',()=>{
 const source='击中时，目标受到 2d8+1d6 点伤害。选择一颗 d8 投出的\n数字来决定它的伤害类型。'
 const good={spells:[{id:'synthetic'}],activities:[{id:'cast',legacySource:{kind:'spell',id:'synthetic'},target:{kind:'creature',includeSelf:true},checks:[{kind:'attack-roll',delivery:'ranged',rollMode:'host-derived'}],outcomes:[{operations:[{kind:'damage',amount:{kind:'add',values:[{kind:'dice',count:1,sides:6},{kind:'dice',count:2,sides:8}]}}]}]}]}
 const run=(value:unknown)=>dnd5eLocalContentSourceConstraintIssues(source,JSON.stringify(value),'spell')
 expect(run(good)).toEqual([])
 for(const change of ['split','mode','self']){
  const bad:any=structuredClone(good)
  if(change==='split')bad.activities[0].outcomes[0].operations=[{kind:'damage',amount:{kind:'dice',count:2,sides:8}},{kind:'damage',amount:{kind:'dice',count:1,sides:6}}]
  if(change==='mode')bad.activities[0].checks[0].rollMode='normal'
  if(change==='self')delete bad.activities[0].target.includeSelf
  expect(run(bad)).toHaveLength(1)
 }
 expect(dnd5eLocalContentSourceConstraintIssues('受到2d8伤害，再受到1d6伤害。',JSON.stringify({spells:[{}]}),'spell')).toEqual([])
})
it('catches lost unarmed coverage and missing weapon classification in explicit hit riders',()=>{
  const rule='你的近战武器攻击在击中时会造成额外 1d6 力场伤害。'
  const configured=(requirements:unknown[])=>JSON.stringify({spells:[{id:'sample'}],activities:[{
    invocation:{kind:'triggered',event:'attack-hit'},requirements,outcomes:[{operations:[{kind:'damage',amount:{kind:'dice',count:1,sides:6}}]}],
  }]})
  const category={kind:'attack-category',category:'weapon'},modes={kind:'attack-mode',modes:['melee','unarmed']}
  for(const requirements of [[],[category],[modes],[category,{kind:'attack-mode',mode:'melee'}]]){
    expect(dnd5eLocalContentSourceConstraintIssues(rule,configured(requirements),'spell')).toHaveLength(1)
  }
  expect(dnd5eLocalContentSourceConstraintIssues(rule,configured([category,modes]),'spell')).toEqual([])
  expect(dnd5eLocalContentSourceConstraintIssues('近战法术攻击命中造成额外1d6伤害。',configured([]),'spell')).toEqual([])
})
const source='智力值为 2 或更\n低的生物不受这个法术的影响。'
it.each([
  '持续时间：立即。球形区域内的所有生物必须进行一次敏捷豁免检定。',
  '持续时间：立即。在该线中的生物必须进行一次敏捷豁免检定。',
  '持续时间：立即。除你之外，在你周围5英尺范围内的生物必须进行一次体质豁免检定。',
])('rejects invented target ceilings in explicit instantaneous all-occupant clauses: %s', rule => {
  for (const pattern of [false, true]) for (const maximumTargets of [undefined, 1, 64, 256]) {
    const target = { kind: 'area', ...(maximumTargets == null ? {} : { maximumTargets }) }
    const json = JSON.stringify({ spells: [{ id: 'burst' }], ...(pattern ? {
      activityPatterns: [{ id: 'burst-cast', source: { kind: 'spell', id: 'burst' }, pattern: 'roll-effect', check: { kind: 'save' }, target }],
    } : { activities: [{ id: 'burst-cast', legacySource: { kind: 'spell', id: 'burst' }, target, checks: [{ kind: 'saving-throw' }] }] }) })
    const before = json
    expect(dnd5eLocalContentSourceConstraintIssues(rule, json, 'spell')).toHaveLength(maximumTargets == null ? 0 : 1)
    expect(json).toBe(before)
  }
})
it('does not infer uncapped initial targets from ongoing or selected-target prose', () => {
  const json = JSON.stringify({ spells: [{ id: 'burst' }], activities: [{ id: 'cast', legacySource: { kind: 'spell', id: 'burst' }, target: { kind: 'area', maximumTargets: 1 }, checks: [{ kind: 'saving-throw' }] }] })
  for (const rule of ['持续时间：1分钟。区域内的所有生物必须进行一次敏捷豁免检定。', '持续时间：立即。你选择区域内一个生物进行敏捷豁免。']) {
    expect(dnd5eLocalContentSourceConstraintIssues(rule, json, 'spell')).toEqual([])
  }
})
it('rejects selective targeting invented for a source that affects all occupants', () => {
  for (const pattern of [false, true]) {
    const target = { kind: 'area', selection: 'choose-any' }
    const json = JSON.stringify({ spells: [{ id: 'burst' }], ...(pattern ? {
      activityPatterns: [{ id: 'cast', source: { kind: 'spell', id: 'burst' }, pattern: 'roll-effect', check: { kind: 'save' }, target }],
    } : { activities: [{ id: 'cast', legacySource: { kind: 'spell', id: 'burst' }, target, checks: [{ kind: 'saving-throw' }] }] }) })
    expect(dnd5eLocalContentSourceConstraintIssues('持续时间：立即。区域内的所有生物必须进行一次敏捷豁免。', json, 'spell')).toEqual([
      expect.stringContaining('selection:choose-any'),
    ])
  }
})
it('rejects dropped ground-contact clauses and accepts an explicit conditional form area', () => {
  const groundSource = '当你在地面上时，你周围 15 英尺的地面对于你\n的敌人而言是困难地形。'
  const configured = {spells:[{id:'ground-example'}],activities:[{
    legacySource:{kind:'spell',id:'ground-example'},target:{kind:'self'},
    choices:[{options:[{targetOverride:{kind:'area',origin:'self',relation:'enemy',radiusFeet:15}}]}],
    outcomes:[{operations:[{kind:'create-persistent-area',anchorMode:'source-token',movementCostMultiplier:2,movementRequiresGroundedSource:true}]}],
  }]}
  expect(dnd5eLocalContentSourceConstraintIssues(groundSource,JSON.stringify(configured),'spell')).toEqual([])
  for (const value of [undefined,false,'true']) {
    const bad=JSON.parse(JSON.stringify(configured))
    bad.activities[0].outcomes[0].operations[0].movementRequiresGroundedSource=value
    expect(dnd5eLocalContentSourceConstraintIssues(groundSource,JSON.stringify(bad),'spell')).toHaveLength(1)
  }
  const missing=JSON.stringify({spells:[{id:'ground-example'}],activities:[]})
  expect(dnd5eLocalContentSourceConstraintIssues(groundSource,missing,'spell')).toHaveLength(1)
  expect(dnd5eLocalContentSourceConstraintIssues('地面是困难地形。你可以飞行。',missing,'spell')).toEqual([])
})
const content=(minimum?:number)=>JSON.stringify({spells:[{id:'example'}],activities:[{id:'cast',legacySource:{kind:'spell',id:'example'},target:{kind:'area',...(minimum==null?{}:{minimumAbilityScores:{int:minimum}})},checks:[{kind:'saving-throw'}]}]})
it('rejects omitted, weakened and stronger immunity boundaries without rewriting configuration',()=>{
  for(const minimum of [undefined,2,4])expect(dnd5eLocalContentSourceConstraintIssues(source,content(minimum),'spell')).toHaveLength(1)
  expect(dnd5eLocalContentSourceConstraintIssues(source,content(3),'spell')).toEqual([])
})
it('does not infer immunity from save DCs, damage numbers or unrelated sources',()=>{
  expect(dnd5eLocalContentSourceConstraintIssues('智力豁免DC12；造成2点伤害。',content(),'spell')).toEqual([])
  expect(dnd5eLocalContentSourceConstraintIssues(source,content(),'subclass')).toEqual([])
  expect(dnd5eLocalContentSourceConstraintIssues(source,JSON.stringify({spells:[{id:'a'},{id:'b'}]}),'spell')).toEqual([])
})
const penaltySource='投掷一个 d6，每次它进行攻击检定、属性检定和因为维持专注进行体质豁免检定时，它都要从结果上减去这个数值。'
const penaltyContent=(scopes?:string[])=>{
  const parsed=JSON.parse(content(3))
  parsed.activities[0].effects=[{modifiers:scopes?[{kind:'roll-dice',dice:{count:1,sides:6,direction:'subtract',appliesTo:scopes}}]:[]}]
  return JSON.stringify(parsed)
}
it('rejects a missing, incomplete or broadened concentration-only penalty',()=>{
  for(const scopes of [undefined,['attack','ability-check','saving-throw'],['attack','ability-check'],['attack','ability-check','concentration-save','saving-throw']]){
    expect(dnd5eLocalContentSourceConstraintIssues(penaltySource,penaltyContent(scopes),'spell')).toHaveLength(1)
  }
  expect(dnd5eLocalContentSourceConstraintIssues(penaltySource,penaltyContent(['attack','ability-check','concentration-save']),'spell')).toEqual([])
})
it('handles PDF line breaks without inferring scopes from unrelated concentration prose',()=>{
  expect(dnd5eLocalContentSourceConstraintIssues(penaltySource.replace('属性','属\n性'),penaltyContent(['saving-throw']),'spell')).toHaveLength(1)
  expect(dnd5eLocalContentSourceConstraintIssues('需要专注。所有豁免检定减去1d6。',penaltyContent(['saving-throw']),'spell')).toEqual([])
  expect(dnd5eLocalContentSourceConstraintIssues(penaltySource,penaltyContent(['saving-throw']),'feature')).toEqual([])
})


it.each(['success','always','failure','zero','other-ability','other-type','actor','pattern-half','pattern-none'] as const)(
  'preserves explicit save-or-damage semantics without inventing success damage: %s',mode=>{
  const source='目标必须通过一次敏捷豁免检定，否则受到 2d6 点寒冷伤害。'
  const activity={id:'burst',legacySource:{kind:'spell',id:'synthetic'},checks:[{id:'save',kind:'saving-throw',ability:mode==='other-ability'?'con':'dex'}],
    outcomes:[{id:'damage',when:mode==='always'?{kind:'always'}:{kind:'check',checkId:'save',result:mode==='failure'?'failure':'success'},
      operations:[{kind:'damage',target:mode==='actor'?'actor':'target',damageType:mode==='other-type'?'fire':'cold',amount:mode==='zero'?{kind:'constant',value:0}:{kind:'dice',count:2,sides:6}}]}]}
  const content={spells:[{id:'synthetic'}],activities:mode.startsWith('pattern')?[]:[activity],activityPatterns:mode.startsWith('pattern')?[{
    id:'burst',source:{kind:'spell',id:'synthetic'},pattern:'roll-effect',check:{kind:'save',ability:'dex'},saveSuccess:mode==='pattern-half'?'half':'none',result:{kind:'damage',damageType:'cold'}}]:[]}
  const json=JSON.stringify(content)
  const run=(rule:string)=>dnd5eLocalContentSourceConstraintIssues(rule,json,'spell')
  expect(run(source)).toHaveLength(['success','always','pattern-half'].includes(mode)?1:0)
  expect(run(source+'豁免成功时伤害减半。')).toEqual([])
  expect(run(source+'随后再进行一次敏捷豁免。')).toEqual([])
  expect(JSON.stringify(content)).toBe(json)
})


it.each([undefined,'actor','granting-area'] as const)('keeps area displacement independent of caster placement range: %s',rangeOrigin=>{
  const source='在你的回合中以一个附赠动作，你可以移动精魂\n30 英尺至你可以看见的另一个空间。'
  const content={spells:[{id:'synthetic'}],activities:[{id:'move-area',legacySource:{kind:'spell',id:'synthetic'},
    target:{kind:'area',origin:'point',placeRangeFeet:30,rangeOrigin},outcomes:[{operations:[{kind:'relocate-granting-area',maximumFeet:{kind:'constant',value:30}}]}]}]}
  const json=JSON.stringify(content)
  expect(dnd5eLocalContentSourceConstraintIssues(source,json,'spell')).toHaveLength(rangeOrigin==='granting-area'?0:1)
  expect(dnd5eLocalContentSourceConstraintIssues(source+'精魂必须始终在你周围30尺内。',json,'spell')).toEqual([])
  expect(dnd5eLocalContentSourceConstraintIssues('选择你周围30尺内的空间放置精魂。',json,'spell')).toEqual([])
  expect(JSON.stringify(content)).toBe(json)
})


it.each([30,60])('checks additional dim light rather than the outer radius: %s',dimRadiusFeet=>{
 const source='照亮周围30英尺半径的区域，并在外围30英尺范围内产生微弱的亮光。'
 const json=JSON.stringify({spells:[{id:'light'}],activities:[{id:'light-cast',legacySource:{kind:'spell',id:'light'},effects:[{modifiers:[{kind:'emitted-light',brightRadiusFeet:30,dimRadiusFeet}]}]}]})
 expect(dnd5eLocalContentSourceConstraintIssues(source,json,'spell')).toHaveLength(dimRadiusFeet===30?0:1)
 expect(dnd5eLocalContentSourceConstraintIssues('照亮周围区域。',json,'spell')).toEqual([])
})
it.each([0,1])('checks explicit cantrip tier totals against additive pattern steps: %s',offset=>{
 const source='否则受到1d6点光耀伤害。伤害在你达到5级（2d6），11级（3d6）和17级（4d6）时提高。'
 const json=JSON.stringify({spells:[{id:'radiance',level:0}],activityPatterns:[{id:'cast',source:{kind:'spell',id:'radiance'},pattern:'roll-effect',
   result:{kind:'damage',amount:{kind:'dice',count:1,sides:6}},scaling:[{basis:'custom-table',table:[1,5,11,17].map((level,i)=>({level,value:i+offset}))}]}]})
 expect(dnd5eLocalContentSourceConstraintIssues(source,json,'spell')).toHaveLength(offset===0?0:4)
 expect(dnd5eLocalContentSourceConstraintIssues('基础伤害1d6，其他升级须裁定。',json,'spell')).toEqual([])
})
