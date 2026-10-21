import { describe, expect, it } from 'vitest'
import { preflightPdfSpellDraft } from './pdfSpellHeadlessPreflight'

function draft() {
  return { schemaVersion: 1 as const, assumptions: [], unsupported: [] as string[], contentJson: JSON.stringify({
    name: 'Synthetic preflight', spells: [{
      id: 'test-spell', name: 'Test Spell', level: 0, school: 'evocation', ritual: false,
      castingTime: { value: 1, unit: 'action' }, range: { type: 'self' },
      components: { verbal: true, somatic: true, material: false }, duration: { type: 'instantaneous', concentration: false },
      classes: ['wizard'], description: 'Synthetic fixture.', automation: { mode: 'reference-only' },
    }],
  }) }
}

describe('PDF Headless preflight', () => {
  it('queues a validated advantage reroll through roll confirmation without certifying behavior', async () => {
    const ability: any = { schemaVersion: 1, id: 'accuracy', name: 'Accuracy', description: 'Synthetic.', level: 1,
      trigger: { kind: 'after-d20-roll' }, cost: { economy: 'none' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
      mechanic: { kind: 'd20-choice-reroll', rollKinds: ['attack'], scopes: ['self-roll'], additionalDice: 1,
        selection: 'highest', requiresAdvantage: true, attackAbilities: ['dex', 'int', 'wis', 'cha'] } }
    const check = () => preflightPdfSpellDraft({ schemaVersion: 1, assumptions: [], unsupported: [], contentJson: JSON.stringify({
      name: 'Accuracy', feats: [{ id: 'accuracy', name: 'Accuracy', summary: 'Synthetic.', description: 'Synthetic.', automation: 'full', declarativeAbility: ability }],
    }) }, 'feat')
    expect(await check()).toMatchObject({ status: 'ready-for-behavior-tests', executionKinds: ['d20-roll-confirmation'], behaviorVerified: false })
    ability.mechanic.attackAbilities = ['invented']
    expect((await check()).status).toBe('blocked')
    ability.mechanic.attackAbilities = ['dex']
    ability.automation = 'manual'
    expect((await check()).status).toBe('blocked')
  })
  it('recognizes a contracted damage reaction entry without claiming behavior certification', async () => {
    const value = draft(), content = JSON.parse(value.contentJson)
    content.spells[0].level = 1
    content.spells[0].castingTime = { value: 1, unit: 'reaction', reactionTrigger: 'Synthetic damage.' }
    content.activities = [{ schemaVersion: 1, id: 'ward', name: 'Ward', activation: { kind: 'reaction' }, target: { kind: 'self' },
      invocation: { kind: 'triggered', event: 'before-damage', confirmation: 'actor-choice' }, legacySource: { kind: 'spell', id: 'test-spell' },
      consumption: [{ kind: 'spell-slot', minimumLevel: 1, level: 'selected', amount: 1, consumeOn: 'resolve' }],
      outcomes: [{ id: 'ward', when: { kind: 'always' }, operations: [{ id: 'ward', kind: 'temporary-hit-points', target: 'actor', amount: { kind: 'constant', value: 2 } }] }],
      automation: { schemaVersion: 1, level: 'full', supportedPhases: ['effects'], manualPhases: [], limitations: [] } }]
    const result = await preflightPdfSpellDraft({ ...value, contentJson: JSON.stringify(content) })
    expect(result.contentParsed).toBe(true)
    expect(result.issues.join('\n')).not.toContain('缺少无需效果授权')
    expect(result.spellEntryAudit?.selectedActivityId).toBe('ward')
    expect(result.spellEntryAudit?.candidates[0]).toMatchObject({ eligible: true, entryKind: 'reaction', reasons: [] })
    expect(result.issues.join('\n')).toContain('before-damage')
    expect(result.behaviorVerified).toBe(false)
    expect(result.status).toBe('blocked')
  })
  it('rejects missing material recipes and source duration/price drift even in cached full declarations',async()=>{
    const value=draft(),content=JSON.parse(value.contentJson),spell=content.spells[0]
    spell.components={verbal:true,somatic:true,material:true,materialText:'500gp metal',materialConsumed:true}
    spell.duration={type:'timed',value:60,unit:'minute',concentration:true}
    const source={id:'source',name:'Synthetic',documentName:'Synthetic',startPage:1,endPage:1,text:'示例\n法术成分：材料（价值至少500GP的金属，消耗）\n持续时间：专注，至多10分钟\n正文'}
    const check=()=>preflightPdfSpellDraft({...value,contentJson:JSON.stringify(content)},'spell',{source})
    const failed=await check()
    expect(failed.issues.join('\n')).toContain('materialRequirement')
    expect(failed.issues.join('\n')).toContain('materialCostGp 应为 500')
    expect(failed.issues.join('\n')).toContain('应为 100 轮')
    spell.duration.value=10
    spell.components.materialCostGp=500
    spell.components.materialRequirement={label:'metal',options:[{label:'metal',components:[{tag:'metal',label:'metal',quantity:1,minimumUnitValueGp:500,consumed:true}]}]}
    const fixed=await check()
    expect(fixed.contentParsed).toBe(true)
    expect(fixed.issues.join('\n')).not.toMatch(/materialRequirement|materialCostGp|持续时间与原文/)
    expect(fixed.behaviorVerified).toBe(false)
  })
  it('rechecks cached drafts against current source constraints and metadata without trusting prior readiness',async()=>{
    const value=draft(),content=JSON.parse(value.contentJson)
    content.spells[0].name='星光'
    content.activities=[{schemaVersion:1,id:'cast',name:'Cast',activation:{kind:'action'},target:{kind:'area',origin:'point',shape:'sphere',radiusFeet:10,placeRangeFeet:30,relation:'any'},legacySource:{kind:'spell',id:'test-spell'},
      automation:{schemaVersion:1,level:'full',supportedPhases:['damage'],manualPhases:[],limitations:[]},outcomes:[{id:'damage',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',amount:{kind:'constant',value:1},damageType:'force'}]}]}]
    const cached={...value,contentJson:JSON.stringify(content)}
    expect((await preflightPdfSpellDraft(cached)).status).toBe('ready-for-behavior-tests')
    const source={kind:'spell' as const,id:'source',name:'星光',documentName:'Synthetic',startPage:1,endPage:1,text:'星光\n1环塑能系\n持续时间：专注，至多1分钟\n智力值为2或更低的生物不受这个法术的影响。'}
    const checked=await preflightPdfSpellDraft(cached,'spell',{source,classReference:'术士法术\n星光（塑能）'})
    expect(checked).toMatchObject({status:'blocked',contentParsed:true,behaviorVerified:false})
    expect(checked.issues.join('\n')).toContain('minimumAbilityScores')
    expect(checked.issues.join('\n')).toContain('法术环级与原文不一致')
    expect(checked.issues.join('\n')).toContain('法术专注要求与原文不一致')
    expect(checked.issues.join('\n')).toContain('sorcerer')
    expect(cached.contentJson).toBe(JSON.stringify(content))
  })
  it.each(['long-rest-complete','short-rest-complete'])('keeps %s blocked until room-level rest settlement is wired',async event=>{
    const value=draft(),content=JSON.parse(value.contentJson)
    const activity={schemaVersion:1,id:'rest',name:'Rest',activation:{kind:'free'},target:{kind:'self'},invocation:{kind:'triggered',event,confirmation:'actor-choice'},legacySource:{kind:'spell',id:'test-spell'},
      automation:{schemaVersion:1,level:'full',supportedPhases:['damage'],manualPhases:[],limitations:[]},
      outcomes:[{id:'apply',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'actor',amount:{kind:'constant',value:1},damageType:'force'}]}]}
    const result=await preflightPdfSpellDraft({...value,contentJson:JSON.stringify({...content,activities:[activity]})})
    expect(result.status).toBe('blocked')
    expect(result.issues.join('\n')).toContain('房间事件调度')
  })
  it('does not certify missing or duplicated spell attack critical damage', async () => {
    const value = draft(), content = JSON.parse(value.contentJson)
    const activity: any = {
      schemaVersion: 1, id: 'attack', name: 'Attack', activation: { kind: 'action' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 5 },
      checks: [{ id: 'hit', kind: 'attack-roll', rollId: 'attack', scope: 'per-target', attackBonus: { kind: 'constant', value: 5 } }],
      outcomes: [{ id: 'damage', when: { kind: 'check', checkId: 'hit', result: 'success' }, operations: [{ id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 10 }, damageType: 'acid' }] }],
      automation: { schemaVersion: 1, level: 'full', supportedPhases: ['attack-roll', 'damage'], manualPhases: [], limitations: [] },
      legacySource: { kind: 'spell', id: 'test-spell' },
    }
    const check = () => preflightPdfSpellDraft({ ...value, contentJson: JSON.stringify({ ...content, activities: [activity] }) })
    expect((await check()).issues.join('\n')).toContain('未声明 critical:double-dice')
    activity.outcomes[0].operations[0].critical = 'double-dice'
    expect((await check()).status).toBe('ready-for-behavior-tests')
    activity.outcomes.push({ ...structuredClone(activity.outcomes[0]), id: 'critical', when: { kind: 'check', checkId: 'hit', result: 'critical-success' } })
    activity.outcomes[1].operations[0].id = 'critical-damage'
    expect((await check()).issues.join('\n')).toContain('success 已包含重击')
  })

  it('distinguishes malformed content from a valid reference-only entry', async () => {
    expect(await preflightPdfSpellDraft(draft())).toMatchObject({status:'blocked',contentParsed:true,behaviorVerified:false})
    expect(await preflightPdfSpellDraft({...draft(),contentJson:'{invalid'})).toMatchObject({status:'blocked',contentParsed:false,behaviorVerified:false})
  })
  it('queues a validated feat passive defense and rejects malformed condition names', async () => {
    const entry = { id: 'condition-defense', name: 'Defense', summary: 'Synthetic.', description: 'Synthetic.', automation: 'full', declarativeAbility: {
      schemaVersion: 1, id: 'defense', name: 'Defense', description: 'Synthetic.', level: 1,
      trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
      mechanic: { kind: 'passive-defense', savingThrowAdvantageAgainstConditions: ['poisoned'] },
    } }
    const value = { schemaVersion: 1 as const, assumptions: [], unsupported: [], contentJson: JSON.stringify({ name: 'Defense', feats: [entry] }) }
    expect(await preflightPdfSpellDraft(value, 'feat')).toMatchObject({ status: 'ready-for-behavior-tests', executionKinds: ['passive-effects'], behaviorVerified: false })
    entry.declarativeAbility.mechanic.savingThrowAdvantageAgainstConditions = ['invented']
    value.contentJson = JSON.stringify({ name: 'Defense', feats: [entry] })
    expect((await preflightPdfSpellDraft(value, 'feat')).status).toBe('blocked')
  })
  it('recognizes a validated subclass passive defense without claiming behavioral certification', async () => {
    const value = { schemaVersion: 1 as const, assumptions: [], unsupported: [] as string[], contentJson: JSON.stringify({
      name: 'Passive subclass', subclasses: [{
        schemaVersion: 1, id: 'guard', classId: 'fighter', name: 'Guard', summary: 'Synthetic.',
        abilities: [{
          schemaVersion: 1, id: 'armor', name: 'Armor', description: 'Synthetic.', level: 3,
          trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
          mechanic: { kind: 'passive-defense', armorClassBonus: { value: 1, requiresHeavyArmor: true } },
        }],
      }],
    }) }
    expect(await preflightPdfSpellDraft(value, 'subclass')).toMatchObject({
      status: 'ready-for-behavior-tests', executionKinds: ['activity', 'passive-effects'], behaviorVerified: false,
    })
    value.unsupported.push('A separate mechanic remains unimplemented')
    expect((await preflightPdfSpellDraft(value, 'subclass')).status).toBe('blocked')
  })
  it('queues validated static modifiers without requiring a fake active button', async () => {
    const entry = { id: 'test-passive', name: 'Test passive', summary: 'Synthetic.', description: 'Synthetic static bonus.', automation: 'full', staticModifiers: { initiativeBonus: 2 } }
    const value = { schemaVersion: 1 as const, assumptions: [], unsupported: [] as string[], contentJson: JSON.stringify({ name: 'Test passive package', feats: [entry] }) }
    expect(await preflightPdfSpellDraft(value, 'feat')).toMatchObject({ status: 'ready-for-behavior-tests', activityCount: 0, executionKinds: ['static-modifiers'], behaviorVerified: false })
    value.unsupported.push('Other required effect is missing')
    expect((await preflightPdfSpellDraft(value, 'feat')).status).toBe('blocked')
    value.unsupported = []
    value.contentJson = JSON.stringify({ name: 'Test passive package', feats: [{ ...entry, automation: 'partial' }] })
    expect((await preflightPdfSpellDraft(value, 'feat')).status).toBe('blocked')
    value.contentJson = JSON.stringify({ name: 'Test passive package', feats: [{ ...entry, staticModifiers: { inventedModifier: 2 } }] })
    expect((await preflightPdfSpellDraft(value, 'feat')).status).toBe('blocked')
  })
  it('queues a build advancement for behavior verification and rejects invalid static numbers', async () => {
    const entry = { id: 'test-build', name: 'Test build', summary: 'Synthetic.', description: 'Synthetic ability increase.', automation: 'full',
      advancements: [{ schemaVersion: 1, id: 'boost', level: 1, kind: 'ability-score', points: 1, maximumScore: 20 }] }
    const value = { schemaVersion: 1 as const, assumptions: [], unsupported: [], contentJson: JSON.stringify({ name: 'Test build', feats: [entry] }) }
    expect(await preflightPdfSpellDraft(value, 'feat')).toMatchObject({ status: 'ready-for-behavior-tests', activityCount: 0, executionKinds: ['advancement'], behaviorVerified: false })
    value.contentJson = JSON.stringify({ name: 'Test build', feats: [{ ...entry, staticModifiers: { initiativeBonus: 9999 } }] })
    expect((await preflightPdfSpellDraft(value, 'feat')).status).toBe('blocked')
  })
  it('queues a valid executable Activity for behavior tests without claiming certification', async () => {
    const value = draft()
    const content = JSON.parse(value.contentJson)
    content.activities = [{
      schemaVersion: 1, id: 'test-heal', name: 'Test heal', activation: { kind: 'action', cost: 1 },
      invocation: { kind: 'active', confirmation: 'actor-choice' }, target: { kind: 'self' },
      outcomes: [{ id: 'heal', when: { kind: 'always' }, operations: [{ id: 'healing', kind: 'healing', target: 'actor', amount: { kind: 'constant', value: 1 } }] }],
      automation: { schemaVersion: 1, level: 'full', supportedPhases: ['eligibility', 'cost', 'targeting', 'healing', 'persistence'], manualPhases: [], limitations: [] },
      legacySource: { kind: 'spell', id: 'test-spell' },
    }]
    value.contentJson = JSON.stringify(content)
    const report = await preflightPdfSpellDraft(value)
    expect(report).toMatchObject({ status: 'ready-for-behavior-tests', activityCount: 1, behaviorVerified: false, issues: [] })
    expect(report.activityMechanismAudit).toHaveLength(1)
    expect(report.activityMechanismAudit?.[0]).toMatchObject({ activityId: 'test-heal',
      manualOperations: [], validationIssues: [], analysis: { missingComponents: [], capability: { level: 'full' } },
      compatibility: { supported: true } })
    value.unsupported.push('仍需实现持续效果')
    expect((await preflightPdfSpellDraft(value)).status).toBe('blocked')
    content.activities[0].outcomes[0].operations = [{ id: 'dm-ruling', kind: 'manual-adjudication', prompt: 'Review synthetic rule', reason: 'Synthetic unresolved rule', requiresDmApproval: true }]
    const manual = await preflightPdfSpellDraft({ ...value, contentJson: JSON.stringify(content) })
    expect(manual.status).toBe('blocked')
    expect(manual.behaviorVerified).toBe(false)
    expect(manual.activityMechanismAudit?.[0]).toMatchObject({ activityId: 'test-heal',
      manualOperations: [{ outcomeId: 'heal', operationId: 'dm-ruling' }] })
  })
  it('does not certify reference data or trust AI full-automation labels', async () => {
    for (const mode of ['reference-only', 'full']) {
      const value = draft()
      value.contentJson = value.contentJson.replace('reference-only', mode)
      const report = await preflightPdfSpellDraft(value)
      expect(report.status).toBe('blocked')
      expect(report.behaviorVerified).toBe(false)
      expect(report.issues.length).toBeGreaterThan(0)
    }
  })
  it('includes declared unsupported mechanics and handles malformed drafts as blocked', async () => {
    const value = draft(); value.unsupported = ['反应与期限尚未实现']
    expect((await preflightPdfSpellDraft(value)).issues).toContain('反应与期限尚未实现')
    value.contentJson = '{'
    const report = await preflightPdfSpellDraft(value)
    expect(report.status).toBe('blocked')
    expect(report.behaviorVerified).toBe(false)
  })
})


it('does not report a direct before-damage Activity as ready merely because its data validates',async()=>{
 const activity={schemaVersion:1,id:'guard',name:'Guard',activation:{kind:'reaction'},invocation:{kind:'triggered',event:'before-damage',confirmation:'actor-choice',retention:'single-event'},target:{kind:'self'},legacySource:{kind:'feature',id:'guard'},outcomes:[{id:'grant',when:{kind:'always'},operations:[{id:'grant',kind:'temporary-hit-points',target:'actor',amount:{kind:'constant',value:10}}]}],automation:{schemaVersion:1,level:'full',supportedPhases:['effects'],manualPhases:[],limitations:[]}}
 const content={name:'Synthetic guard',features:[{id:'guard',name:'Guard',summary:'Synthetic',description:'Synthetic',automation:'full'}],activities:[activity]}
 const value={schemaVersion:1 as const,assumptions:[],unsupported:[],contentJson:JSON.stringify(content)}
 const result=await preflightPdfSpellDraft(value,'feature')
 expect(result.contentParsed).toBe(true)
 expect(result.status).toBe('blocked')
 expect(result.issues.join('\n')).toContain('伤害提交前暂停/恢复入口')
})

 it('rejects invented and omitted components from cached drafts without mutating them', async () => {
   const value = draft(), content = JSON.parse(value.contentJson)
   const source = { id: 'fixture', name: 'Fixture', documentName: 'fixture', startPage: 1, endPage: 1, text: '法术成分：姿势，材料（一滴水）\n持续时间：立即' }
   const original = JSON.stringify(content)
   const result = await preflightPdfSpellDraft({ ...value, contentJson: original }, 'spell', { source })
   expect(result.issues.join('\n')).toContain('verbal 应为 false')
   expect(result.issues.join('\n')).toContain('material 应为 true')
   expect(JSON.stringify(content)).toBe(original)
   content.spells[0].components = { verbal: false, somatic: true, material: true, materialText: 'water' }
   const correct = await preflightPdfSpellDraft({ ...value, contentJson: JSON.stringify(content) }, 'spell', { source })
   expect(correct.issues.join('\n')).not.toContain('法术成分与原文不一致')
   expect(correct.behaviorVerified).toBe(false)
 })
