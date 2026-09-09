import { afterEach, describe, expect, it } from 'vitest'
import { formatDnd5eCombatLogDetails as full, formatDnd5eSecretCombatOutcomeDetails as shared } from './combatLogDetails'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, type Dnd5eCombatEvent } from '../rulesets/dnd5e/headlessCombatEngine'
import { createDnd5eMechanicalEffect } from '../rulesets/dnd5e/activeEffects'
import { snapshotCombatLogContext } from '../rulesets/dnd5e/combatLogContext'
import { dnd5ePluginRegistryStore } from '../rulesets/dnd5e/plugins/pluginRegistryStore'
import { resolveDnd5eActivity, type Dnd5eActivityActorSnapshot } from '../rulesets/dnd5e/activities/dnd5eActivityExecutor'
import type { Dnd5eActivityDefinitionV1 } from '../rulesets/dnd5e/activities/dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../domain/automation/automationCapability'
import { dnd5eActivityRollLogEvidence } from '../pages/maps/dnd5eActivityHandoffLogDetails'
import { publicActivityRollDetails } from '../pages/maps/combatRollVisibility'

const players = new Set(['player'])
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion:1,id:'custom-action',name:'自定义冲击',activation:{kind:'action'},target:{kind:'creature',relation:'any',count:2,rangeFeet:30},
  checks:[{id:'save',kind:'saving-throw',rollId:'arbitrary-roll-key',ability:'dex',dc:{kind:'constant',value:17},scope:'per-target'}],
  outcomes:[{id:'failed',when:{kind:'check',checkId:'save',result:'failure'},operations:[{id:'hurt',kind:'damage',target:'target',amount:{kind:'constant',value:5},damageType:'force',magical:true}]}],
  automation:automationCapabilityFromLegacyStatus('full'),
}
const saves: Dnd5eCombatEvent[] = [
  {type:'saving-throw-resolved',targetId:'player',ability:'dex',d20:11,modifier:2,total:13,dc:17,success:false},
  {type:'saving-throw-resolved',targetId:'monster',ability:'dex',d20:4,modifier:1,total:5,dc:17,success:false},
]
describe('four combat log audit fixes', () => {
  afterEach(() => dnd5ePluginRegistryStore.features.delete('custom-test-feature'))
  it('uses structured ownership with arbitrary check ids, keeping player saves during a monster cast', () => {
    const evidence = dnd5eActivityRollLogEvidence(activity, {
      'arbitrary-roll-key:player':{values:[11],modifier:8,total:19},
      'arbitrary-roll-key:monster':{values:[4],modifier:1,total:5},
      'custom-color:player':{values:[8],modifier:0,total:8},
    }, saves, 'monster')
    expect(evidence[0]).toMatchObject({adoptedValue:11,modifier:2,total:13,dc:17})
    expect(evidence.map(item => item.rollerId)).toEqual(['player','monster','monster'])
    expect(publicActivityRollDetails(evidence,players)).toEqual([evidence[0].text])
    expect(publicActivityRollDetails(['Activity 骰据：spell-attack-d20:player｜20 = 20'],players,true)).toEqual([])
  })
  it('attributes random per-target dice to the player caster', () => {
    const evidence = dnd5eActivityRollLogEvidence(activity, {'custom-color:monster':{values:[5],modifier:0,total:5}}, [], 'player')
    expect(publicActivityRollDetails(evidence,players)).toEqual([evidence[0].text])
  })
  it('records the actual selected outcome, excluding a branch whose save succeeded', () => {
    const actor: Dnd5eActivityActorSnapshot = {id:'player',controller:'players',level:5,proficiencyBonus:3,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:10,conditions:[],currentHp:20,maxHp:20}
    const result = resolveDnd5eActivity({activity,actor,distanceFeetByTargetId:{fail:10,pass:10},targets:[{...actor,id:'fail'},{...actor,id:'pass'}],rolls:{'arbitrary-roll-key:fail':{values:[3]},'arbitrary-roll-key:pass':{values:[19]}}})
    expect(result, JSON.stringify(result)).toMatchObject({ok:true})
    if (!result.ok) return
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0]).toMatchObject({targetId:'fail',amount:5,logTrigger:{activityName:'自定义冲击',outcomeId:'failed',conditions:['目标豁免失败']}})
  })
  it('persists a custom registered name and effect duration across registry unload and state mutation', () => {
    dnd5ePluginRegistryStore.features.set('custom-test-feature',{id:'custom-test-feature',name:'星辉护盾',summary:'',description:'',automation:'full',ownerPluginId:'test',ownerPluginName:'测试',ownerPluginLicense:'MIT'})
    const actor = createDnd5eCombatant({id:'player',name:'玩家',controller:'player',initiative:20,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:12,currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
    const before = startDnd5eHeadlessCombat('audit',[actor])
    const after = structuredClone(before)
    const effect = createDnd5eMechanicalEffect({id:'effect',definitionId:'custom-test-feature',label:'星辉防护',kind:'buff',targetId:'player',source:{kind:'feature',actorId:'player',rulesId:'custom-test-feature'},duration:{type:'rounds',remainingRounds:3,tickOn:'target-turn-end'}})
    after.combatants.player.classState.activeEffects = [effect]
    const events = snapshotCombatLogContext([{type:'active-effect-applied',targetId:'player',effectId:'effect',definitionId:'custom-test-feature'},{type:'declarative-death-prevention-applied',actorId:'player',featureId:'custom-test-feature',hitPointsAfter:1}],before,after,{type:'end-turn',actorId:'player'})
    dnd5ePluginRegistryStore.features.delete('custom-test-feature')
    effect.duration = {type:'permanent'}
    const text = full(JSON.parse(JSON.stringify(events))).join('\n')
    expect(text).toContain('星辉防护')
    expect(text).toContain('星辉护盾')
    expect(text).toContain('持续：3 回合')
    expect(text).not.toContain('custom-test-feature')
  })
  it('provides an honest readable fallback for an unregistered feature', () => {
    expect(full([{type:'declarative-death-prevention-applied',actorId:'player',featureId:'unknown-feature',hitPointsAfter:1}])[0]).toContain('未命名特性（编号：unknown-feature）')
  })
  it('shows player gaze saves without revealing the monster gaze save', () => {
    const event: Dnd5eCombatEvent = {type:'monster-turn-start-gaze-save-resolved',sourceId:'monster',targetId:'player',ruleId:'gaze',effectKind:'gaze',condition:'petrified',ability:'con',dc:17,total:13,success:false,immediatelyPetrified:true}
    expect(shared([event],{publicRollerIds:players})[0]).toContain('13 对抗难度 17')
    expect(shared([{...event,targetId:'monster'}],{publicRollerIds:players})[0]).not.toMatch(/13|17/)
  })
  it('redacts each side independently for a monster on-hit contest', () => {
    const event: Dnd5eCombatEvent = {type:'monster-on-hit-contest-resolved',actorId:'player',targetId:'monster',actionId:'bite',effectId:'grab',sourceAbility:'str',targetAbility:'dex',sourceTotal:16,targetTotal:9,sourceWins:true}
    expect(shared([event],{publicRollerIds:players})[0]).toContain('力量 16 对抗敏捷 暗骰')
  })
  it('does not expose a monster save through a public caster reaction', () => {
    const event: Dnd5eCombatEvent = {type:'hellish-rebuke-resolved',actorId:'player',targetId:'monster',slotLevel:1,dc:17,saveTotal:9,success:false,damage:12}
    expect(shared([event],{publicRollerIds:players})[0]).not.toMatch(/17|9/)
    expect(shared([event],{publicRollerIds:players})[0]).toContain('伤害 12')
  })
  it('describes death effects, recharge, periodic damage and ready triggers', () => {
    const events: Dnd5eCombatEvent[] = [{type:'monster-death-area-effect-resolved',sourceId:'monster',ruleId:'burst',targetIds:['player'],damage:12},{type:'monster-recharge-resolved',actorId:'monster',actionId:'breath',roll:6,ready:true},{type:'active-effect-periodic-damage-triggered',targetId:'player',effectId:'effect',definitionId:'burning',amount:5,damageType:'fire'},{type:'readied-action-triggered',actorId:'player',trigger:'敌人进入门口',actionKind:'attack'}]
    const text = shared(events,{publicRollerIds:players}).join('\n')
    expect(text).toContain('死亡区域效果生效')
    expect(text).toContain('恢复可用')
    expect(text).not.toContain('骰值 6')
    expect(text).toContain('受到 5 点火焰伤害')
    expect(text).toContain('满足条件：敌人进入门口')
  })
})
