import{it,expect,vi}from'vitest'
import{automationCapabilityFromLegacyStatus}from'../../domain/automation/automationCapability'
import{registerContentDefinitionPackage,contentDefinitionRegistryRevision}from'../../domain/content/contentDefinitionRegistry'
import{listAvailableRegisteredDnd5eActivitiesV1,listRegisteredDnd5eActivityPackages,type AvailableRegisteredDnd5eActivityV1}from'./activities/dnd5eActivityRegistry'
import{resolveDnd5eActivityInvocationV1,matchDnd5eActivityInvocationV1}from'./activities/dnd5eActivityInvocation'
import type{Dnd5eActivityTriggerContextV1}from'./activities/dnd5eActivityContracts'

const context:Dnd5eActivityTriggerContextV1={eventId:'test.catalog-hit',event:'attack-hit',source:{kind:'attack',mode:'melee',result:'hit'},eligibleActorIds:['actor'],eligibleTargetIds:['target']}
const input={triggerContext:context,actorId:'actor',targetIds:['target']}
const activity=(id:string,priority=0)=>({schemaVersion:1 as const,id,name:id,activation:{kind:'reaction' as const,cost:1},target:{kind:'self' as const},invocation:{kind:'triggered' as const,event:'attack-hit' as const,confirmation:'actor-choice' as const,retention:'single-event' as const,priority},outcomes:[{id:'resolve',when:{kind:'always' as const},operations:[{id:'heal',kind:'healing' as const,target:'actor' as const,amount:{kind:'constant' as const,value:1}}]}],automation:automationCapabilityFromLegacyStatus('full')})
function register(id:string,activities:readonly unknown[],version='1.0.0'){return registerContentDefinitionPackage({packageId:id,packageVersion:version,definitions:[{schemaVersion:1,id:'activities',namespace:id,version,kind:'feature',name:'Catalog view reference data',source:{packageId:id,packageVersion:version},payload:{},activities,automation:automationCapabilityFromLegacyStatus('full')}]})}

it('the private frozen catalog matches the exact old selection reference across fresh contexts and epochs while selected copies stay editable',()=>{
 const id='test.runtime-catalog',rows=[activity('low',1),activity('high',9),{...activity('engine'),authorityBinding:{kind:'declarative-subclass-mechanic',subclassId:'test',abilityId:'engine',mechanicKind:'combat-maneuver',execution:'headless-event-engine'}},{...activity('other'),invocation:{kind:'triggered',event:'spell-cast',confirmation:'actor-choice'}}];let reg=register(id,rows);const same=(i:typeof input)=>expect(listAvailableRegisteredDnd5eActivitiesV1(i)).toEqual(oldReferenceAvailable(i))
 try{
  const frozen:object[]=[];const spy=vi.spyOn(Object,'freeze');let selected:readonly AvailableRegisteredDnd5eActivityV1[]=[];try{selected=listAvailableRegisteredDnd5eActivitiesV1(input)}finally{for(const [value]of spy.mock.calls)if(value!==null&&typeof value==='object')frozen.push(value);spy.mockRestore()}expect(frozen.length).toBeGreaterThan(0);const seen=new WeakSet<object>(),pending=[...frozen];while(pending.length){const row=pending.pop()!;if(seen.has(row))continue;seen.add(row);expect(Object.isFrozen(row)).toBe(true);for(const child of Object.values(row))if(child!==null&&typeof child==='object')pending.push(child)}
  expect(selected!).toEqual(oldReferenceAvailable(input));expect(selected!.filter(x=>x.packageId===id).map(x=>x.activity.id)).toEqual(['high','low']);expect(Object.isFrozen(selected![0].activity)).toBe(false);selected![0].activity.name='external-change';same(input)
  same({...input,actorId:'other'});same({...input,triggerContext:{...context,eligibleTargetIds:[]}});same({...input,triggerContext:{...context,event:'attack-missed'}})
  const unmatched={...input,actorId:'not-eligible'},clone=vi.spyOn(globalThis,'structuredClone');try{clone.mockClear();expect(listAvailableRegisteredDnd5eActivitiesV1(unmatched)).toEqual([]);expect(clone).not.toHaveBeenCalled();oldReferenceAvailable(unmatched);expect(clone.mock.calls.length).toBeGreaterThan(0);clone.mockClear();const matched=listAvailableRegisteredDnd5eActivitiesV1(input);expect(clone.mock.calls.length).toBe(matched.length)}finally{clone.mockRestore()}
  const old=reg;old.dispose();same(input);expect(listAvailableRegisteredDnd5eActivitiesV1(input).some(x=>x.packageId===id)).toBe(false);reg=register(id,rows);old.dispose();same(input);reg.dispose();reg=register(id,[activity('changed',15)],'2.0.0');same(input);expect(listAvailableRegisteredDnd5eActivitiesV1(input).filter(x=>x.packageId===id).map(x=>x.activity.id)).toEqual(['changed'])
 }finally{reg.dispose()}
},60000)

it('shared typed-array activity data and every nonplain form remain fresh without a revision and never enter the frozen view',()=>{
 const memory=new SharedArrayBuffer(1),shared=new Uint8Array(memory);shared[0]=1
 for(const [label,value]of[['shared-view',shared],['date',new Date('2020-01-01T00:00:00Z')],['map',new Map([['a',1]])],['set',new Set([1])],['typed',new Uint8Array([1])]]as const){const id='test.runtime-nonplain.'+label,reg=register(id,[{...activity('extra'),extra:value}]);try{const revision=contentDefinitionRegistryRevision(),before=listAvailableRegisteredDnd5eActivitiesV1(input);expect(before).toEqual(oldReferenceAvailable(input));const beforeJson=JSON.stringify(before);shared[0]++;expect(contentDefinitionRegistryRevision()).toBe(revision);const after=listAvailableRegisteredDnd5eActivitiesV1(input);expect(after).toEqual(oldReferenceAvailable(input));if(label==='shared-view')expect(JSON.stringify(after)).not.toBe(beforeJson);const unmatched={...input,actorId:'not-eligible'},clone=vi.spyOn(globalThis,'structuredClone');try{clone.mockClear();expect(listAvailableRegisteredDnd5eActivitiesV1(unmatched)).toEqual([]);expect(clone.mock.calls.length).toBeGreaterThan(0);clone.mockClear();listAvailableRegisteredDnd5eActivitiesV1(unmatched);expect(clone.mock.calls.length).toBeGreaterThan(0)}finally{clone.mockRestore()}}finally{reg.dispose()}}
},60000)

it('optional private-view inspection or freezing failures preserve the old successful reference and never leak a shared selected object',()=>{
 for(const method of['getPrototypeOf','freeze']as const){const id='test.runtime-inspection.'+(method==='freeze'?'freeze':'inspect'),reg=register(id,[activity('fallback')]);try{const expected=oldReferenceAvailable(input),sentinel=Error('intentional optional-view failure'),spy=vi.spyOn(Object,method).mockImplementationOnce(()=>{throw sentinel});let actual:readonly AvailableRegisteredDnd5eActivityV1[]|undefined,caught:unknown;try{actual=listAvailableRegisteredDnd5eActivitiesV1(input)}catch(error){caught=error}finally{spy.mockRestore()}expect(caught).toBeUndefined();expect(actual).toEqual(expected);actual![0].activity.name='caller-mutates-copy';expect(listAvailableRegisteredDnd5eActivitiesV1(input)).toEqual(oldReferenceAvailable(input))}finally{reg.dispose()}}
},60000)

function oldReferenceAvailable(input: {
  triggerContext: Dnd5eActivityTriggerContextV1
  actorId: string
  targetIds: readonly string[]
}): readonly AvailableRegisteredDnd5eActivityV1[] {
  const available: AvailableRegisteredDnd5eActivityV1[] = []
  for (const value of listRegisteredDnd5eActivityPackages()) {
    for (const activity of value.activities) {
      // These Activities are the unified catalog entry for mechanics already
      // dispatched inside the authoritative attack/spell/turn transaction.
      // Offering a second generic trigger window would settle them twice.
      if (activity.authorityBinding?.execution === 'headless-event-engine') continue
      const invocation = resolveDnd5eActivityInvocationV1(activity)
      if (invocation.kind !== 'triggered') continue
      const confirmedBy = invocation.confirmation === 'automatic'
        ? 'system' as const
        : invocation.confirmation === 'target-choice'
          ? 'target' as const
          : invocation.confirmation === 'dm-approval'
            ? 'dm' as const
            : 'actor' as const
      const match = matchDnd5eActivityInvocationV1({
        activity,
        actorId: input.actorId,
        targetIds: input.targetIds,
        triggerContext: input.triggerContext,
        confirmedBy,
        dmApproved: invocation.confirmation === 'dm-approval',
      })
      if (!match.ok) continue
      available.push({
        packageId: value.packageId,
        packageVersion: value.packageVersion,
        activity: structuredClone(activity),
        confirmation: invocation.confirmation,
        retention: invocation.retention ?? 'single-event',
      })
    }
  }
  return available.sort((a,b)=>(b.activity.invocation?.kind==='triggered'?b.activity.invocation.priority??0:0)-
    (a.activity.invocation?.kind==='triggered'?a.activity.invocation.priority??0:0))
}
