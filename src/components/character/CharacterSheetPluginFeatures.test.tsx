import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {afterEach,expect,it,vi} from 'vitest'
import type {Character} from '../../types/character'
import {normalizeCharacter,useCharacterStore} from '../../store/characters'
import CharacterSheet from './CharacterSheet'
const captured=vi.hoisted(()=>({onChange:undefined as undefined|((patch:Partial<Character>)=>void)}))
vi.mock('../../store/characters',async importOriginal=>{
 const actual=await importOriginal<typeof import('../../store/characters')>()
 const hook=Object.assign((selector?:(state:ReturnType<typeof actual.useCharacterStore.getState>)=>unknown)=>selector?selector(actual.useCharacterStore.getState()):actual.useCharacterStore.getState(),actual.useCharacterStore)
 return{...actual,useCharacterStore:hook}
})
vi.mock('react',async importOriginal=>{
 const actual=await importOriginal<typeof import('react')>()
 const hooks={useState:(initial:unknown)=>actual.useState(initial==='sheet'?'class':initial),useSyncExternalStore:(_subscribe:unknown,getSnapshot:()=>unknown)=>getSnapshot()}
 return{...actual,...hooks,default:{...actual,...hooks}}
})
vi.mock('./Dnd5ePluginFeaturesPanel',()=>({default:({onChange}:{onChange:(patch:Partial<Character>)=>void})=>{captured.onChange=onChange;return createElement('button',{'data-test-feature-button':true},'Synthetic feature')}}))
afterEach(()=>{vi.clearAllMocks();vi.restoreAllMocks();captured.onChange=undefined})
for(const isDM of [false,true])for(const readOnly of [false,true])it('mounts feature selection on class tab through real guarded updateCharacter: isDM='+isDM+', readOnly='+readOnly,()=>{
 const character=normalizeCharacter({id:'owner',name:'Owner',charClass:'邪术师',level:7,dnd5eClassLevels:{warlock:7},dnd5ePluginFeatureIds:[],dnd5eFeatIds:['srd5.1:grappler'],maxHp:50,currentHp:50})
 useCharacterStore.setState({characters:[character],selectedId:'owner'})
 const update=vi.spyOn(useCharacterStore.getState(),'update')
 update.mockClear()
 const html=renderToStaticMarkup(createElement(CharacterSheet,{id:'owner',isDM,readOnly}))
 expect(html).toContain('data-test-feature-button="true"')
 expect(html).toContain('已获得专长')
 expect(html).toContain('擒抱者')
 expect(html.indexOf('已获得专长')).toBeLessThan(html.indexOf('升级记录'))
 expect(html).toContain(readOnly?'<fieldset disabled=""><button data-test-feature-button="true">':'<fieldset><button data-test-feature-button="true">')
 expect(captured.onChange).toBeDefined()
 const patch={dnd5ePluginFeatureIds:['test.ui:personal-sight']}
 captured.onChange!(patch)
 if(readOnly){expect(update).not.toHaveBeenCalled();expect(useCharacterStore.getState().characters[0].dnd5ePluginFeatureIds).toEqual([])}
 else{expect(update).toHaveBeenCalledWith('owner',patch);expect(useCharacterStore.getState().characters[0].dnd5ePluginFeatureIds).toEqual(patch.dnd5ePluginFeatureIds)}
})
