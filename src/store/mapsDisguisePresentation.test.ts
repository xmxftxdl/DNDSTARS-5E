import {it,expect} from 'vitest'
import {projectCharacterTokenPresentations,type Token} from './maps'
import {createDnd5eMechanicalEffect} from '../rulesets/dnd5e/activeEffects'
const effect={...createDnd5eMechanicalEffect({definitionId:'disguise',label:'Disguise',targetId:'owner',source:{kind:'dm'}}),
 disguisedCreatureIdentity:{actorId:'dead',name:'Remembered person',presentationCaptured:true as const,presentation:{emoji:'D',color:'#111',size:2,tokenPortrait:'disguise-image',tokenPortraitImageId:'disguise-asset'}}}
it.each(['player','enemy'] as const)('projects and restores %s disguise without copying physical or control data',type=>{
 const token:Token={id:'owner',type,label:'Original',emoji:'O',color:'#222',size:1,x:50,y:50,hp:21,maxHp:30,poolId:type==='enemy'?'srd-5.1:ice-mephit':undefined,
 characterId:type==='player'?'character':undefined,portraitImageId:'original-asset',dnd5eCombatState:type==='enemy'?{activeEffects:[effect]}:undefined}
 const characters=type==='player'?[{id:'character',name:'Original',avatar:'O',tokenPortrait:'original-image',dnd5eCombatState:{activeEffects:[effect]}}]:[]
 const snapshot=structuredClone({token,characters})
 const [projected]=projectCharacterTokenPresentations([token],characters)
 expect(projected).toMatchObject({id:'owner',label:'Remembered person',emoji:'D',portraitImageId:'disguise-asset',tokenPortrait:'disguise-image',size:1,hp:21,maxHp:30,characterId:token.characterId,poolId:token.poolId,type})
 expect({token,characters}).toEqual(snapshot)
 const restoredToken={...token,dnd5eCombatState:{activeEffects:[]}}
 const restoredCharacters=characters.map(c=>({...c,dnd5eCombatState:{activeEffects:[]}}))
 expect(projectCharacterTokenPresentations([restoredToken],restoredCharacters)[0]).toMatchObject({label:'Original',portraitImageId:'original-asset',size:1,hp:21})
 const suspended={...effect,suspendedBy:['antimagic']}
 const [hidden]=projectCharacterTokenPresentations([{...token,dnd5eCombatState:{activeEffects:[suspended]}}],characters.map(c=>({...c,dnd5eCombatState:{activeEffects:[suspended]}})))
 expect(hidden.label).toBe('Original')
})
it('does not resurrect a stale token disguise when the character effect is removed',()=>{
 const token:Token={id:'owner',type:'player',characterId:'character',label:'Original',emoji:'O',color:'#222',size:1,x:0,y:0,dnd5eCombatState:{activeEffects:[effect]}}
 const [rendered]=projectCharacterTokenPresentations([token],[{id:'character',name:'Original',avatar:'O',dnd5eCombatState:{activeEffects:[]}}])
 expect(rendered.label).toBe('Original')
})
