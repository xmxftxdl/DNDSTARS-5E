import{it,expect,vi}from'vitest'
import{automationCapabilityFromLegacyStatus}from'../../domain/automation/automationCapability'
import{registerContentDefinitionPackage,unregisterContentDefinitionPackage,contentDefinitionRegistryRevision}from'../../domain/content/contentDefinitionRegistry'
import{registerDnd5eActivityPackage,listRegisteredDnd5eActivityPackages,registeredDnd5eActivityCatalogSignature}from'./activities/dnd5eActivityRegistry'

it('the primitive current Activity catalog keeps the complete editable JSON guard across mutation duplicate disposal identical re-registration and changed content without warm cloning',()=>{
 const id='test.catalog-signature',other=id+'.content-only',activity={schemaVersion:1 as const,id:'heal',name:'Original',activation:{kind:'action' as const,cost:1},target:{kind:'self' as const},outcomes:[{id:'resolve',when:{kind:'always' as const},operations:[{id:'heal',kind:'healing' as const,target:'actor' as const,amount:{kind:'constant' as const,value:1}}]}],automation:automationCapabilityFromLegacyStatus('full')};let current:ReturnType<typeof registerDnd5eActivityPackage>|undefined,neighbor:ReturnType<typeof registerContentDefinitionPackage>|undefined
 const same=()=>expect(registeredDnd5eActivityCatalogSignature()).toBe(JSON.stringify(listRegisteredDnd5eActivityPackages()))
 try{
  same();neighbor=registerContentDefinitionPackage({packageId:other,packageVersion:'7.0.0',definitions:[]});same();expect(listRegisteredDnd5eActivityPackages().find(p=>p.packageId===other)).toMatchObject({packageVersion:'7.0.0',activities:[]})
  const input={packageId:id,packageVersion:'1.0.0',activities:[structuredClone(activity)]};current=registerDnd5eActivityPackage(input);same();const original=registeredDnd5eActivityCatalogSignature();input.packageVersion='caller-edit';input.activities[0].name='caller-edit';const editable=listRegisteredDnd5eActivityPackages().find(p=>p.packageId===id)!;editable.packageVersion='external-edit';editable.activities[0].name='external-edit';expect(registeredDnd5eActivityCatalogSignature()).toBe(original);same()
  expect(()=>registerDnd5eActivityPackage({packageId:id,packageVersion:'9.0.0',activities:[activity]})).toThrow();expect(registeredDnd5eActivityCatalogSignature()).toBe(original)
  const clone=vi.spyOn(globalThis,'structuredClone');try{clone.mockClear();expect(registeredDnd5eActivityCatalogSignature()).toBe(original);expect(registeredDnd5eActivityCatalogSignature()).toBe(original);expect(clone).not.toHaveBeenCalled();JSON.stringify(listRegisteredDnd5eActivityPackages());expect(clone.mock.calls.length).toBeGreaterThan(0)}finally{clone.mockRestore()}
  const old=current;old.dispose();same();expect(registeredDnd5eActivityCatalogSignature()).not.toBe(original);current=registerDnd5eActivityPackage({packageId:id,packageVersion:'1.0.0',activities:[activity]});same();expect(registeredDnd5eActivityCatalogSignature()).toBe(original);old.dispose();same();expect(registeredDnd5eActivityCatalogSignature()).toBe(original)
  current.dispose();current=registerDnd5eActivityPackage({packageId:id,packageVersion:'2.0.0',activities:[{...activity,name:'Changed real content'}]});same();expect(registeredDnd5eActivityCatalogSignature()).not.toBe(original)
  const doomed=neighbor;expect(unregisterContentDefinitionPackage(other)).toBe(true);same();doomed.dispose();same();neighbor=registerContentDefinitionPackage({packageId:other,packageVersion:'8.0.0',definitions:[]})
  const sentinel=Error('intentional serialization failure'),stringify=vi.spyOn(JSON,'stringify').mockImplementationOnce(()=>{throw sentinel});let caught:unknown;try{registeredDnd5eActivityCatalogSignature()}catch(error){caught=error}finally{stringify.mockRestore()}expect(caught).toBe(sentinel)
  const retryClone=vi.spyOn(globalThis,'structuredClone');try{retryClone.mockClear();registeredDnd5eActivityCatalogSignature();expect(retryClone.mock.calls.length).toBeGreaterThan(0);retryClone.mockClear();registeredDnd5eActivityCatalogSignature();expect(retryClone).not.toHaveBeenCalled()}finally{retryClone.mockRestore()}same()
 }finally{current?.dispose();neighbor?.dispose()}
},60000)

it('a legal activity extra shared typed-array field changes the original JSON without a registry epoch and therefore must never use a cached signature',()=>{
 const id='test.catalog-shared',memory=new SharedArrayBuffer(1),view=new Uint8Array(memory);view[0]=1
 const registration=registerContentDefinitionPackage({packageId:id,packageVersion:'1.0.0',definitions:[{schemaVersion:1,id:'shared',namespace:id,version:'1.0.0',kind:'feature',name:'Shared activity data',source:{packageId:id,packageVersion:'1.0.0'},payload:{},activities:[{id:'shared-activity',extraSharedView:view}],automation:automationCapabilityFromLegacyStatus('full')}]})
 try{const revision=contentDefinitionRegistryRevision(),before=JSON.stringify(listRegisteredDnd5eActivityPackages());expect(registeredDnd5eActivityCatalogSignature()).toBe(before);view[0]=2;expect(contentDefinitionRegistryRevision()).toBe(revision);const after=JSON.stringify(listRegisteredDnd5eActivityPackages());expect(after).not.toBe(before);expect(registeredDnd5eActivityCatalogSignature()).toBe(after);view[0]=3;expect(registeredDnd5eActivityCatalogSignature()).toBe(JSON.stringify(listRegisteredDnd5eActivityPackages()));expect(contentDefinitionRegistryRevision()).toBe(revision)}finally{registration.dispose()}
},60000)

it('Date Map Set and ordinary typed-array activity data preserve the original per-read JSON path and expose no mutable cached payload',()=>{
 for(const [label,value]of[['date',new Date('2020-01-01T00:00:00Z')],['map',new Map([['a',1]])],['set',new Set([1])],['typed',new Uint8Array([1])],['shared-buffer',new SharedArrayBuffer(1)]]as const){
  const id='test.catalog-nonplain.'+label,registration=registerContentDefinitionPackage({packageId:id,packageVersion:'1.0.0',definitions:[{schemaVersion:1,id:'data',namespace:id,version:'1.0.0',kind:'feature',name:'Nonplain activity data',source:{packageId:id,packageVersion:'1.0.0'},payload:{},activities:[{id:'activity',extra:value}],automation:automationCapabilityFromLegacyStatus('full')}]})
  try{const expected=JSON.stringify(listRegisteredDnd5eActivityPackages());expect(registeredDnd5eActivityCatalogSignature()).toBe(expected);const clone=vi.spyOn(globalThis,'structuredClone');try{clone.mockClear();expect(registeredDnd5eActivityCatalogSignature()).toBe(expected);expect(clone.mock.calls.length).toBeGreaterThan(0);clone.mockClear();expect(registeredDnd5eActivityCatalogSignature()).toBe(expected);expect(clone.mock.calls.length).toBeGreaterThan(0)}finally{clone.mockRestore()}}finally{registration.dispose()}
 }
},60000)

it('optional plain-data inspection failure preserves the original successful JSON value and never publishes a guessed eligibility result',()=>{
 const id='test.catalog-inspection-failure',registration=registerContentDefinitionPackage({packageId:id,packageVersion:'1.0.0',definitions:[]})
 try{const expected=JSON.stringify(listRegisteredDnd5eActivityPackages()),sentinel=Error('intentional eligibility inspection error'),inspect=vi.spyOn(Object,'getPrototypeOf').mockImplementationOnce(()=>{throw sentinel});let actual:string|undefined,caught:unknown;try{actual=registeredDnd5eActivityCatalogSignature()}catch(error){caught=error}finally{inspect.mockRestore()}expect(caught).toBeUndefined();expect(actual).toBe(expected);expect(registeredDnd5eActivityCatalogSignature()).toBe(expected)}finally{registration.dispose()}
},60000)
