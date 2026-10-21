import {it,expect} from 'vitest'
import {getDnd5eSrdMonster} from './monsters'
import {validateDnd5eMonsterCatalog} from './monsterSchema'
import {buildDnd5eCustomMonster,dnd5eCustomMonsterDraftFromStatBlock,restoreDnd5eCustomMonsterDraft} from './customMonsterWorkshop'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {parseDnd5eContentPackageV2,dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {createDnd5eMapCombatSnapshot} from './mapBridge'

it.each([true,false])('keeps explicitly authored anatomy through editing, package import and Host snapshot: %s',async head=>{
 const original=structuredClone(getDnd5eSrdMonster('srd-5.1:bandit')!)
 const monster={...original,id:'room-monster:anatomy-test',slug:'anatomy-test',source:'DM 自定义' as const,bodyPartPresence:{head}}
 expect(validateDnd5eMonsterCatalog([monster])).toEqual([])
 const rebuilt=buildDnd5eCustomMonster(restoreDnd5eCustomMonsterDraft(JSON.parse(JSON.stringify(dnd5eCustomMonsterDraftFromStatBlock(monster)))))
 expect(rebuilt.bodyPartPresence).toEqual({head})
 const prepared=await prepareDnd5eLocalContentJson(JSON.stringify({name:'Anatomy test',version:'1.0.0',monsters:[rebuilt]}))
 const pkg=parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(prepared.package)).buffer)!
 expect(pkg.content.monsters?.[0].bodyPartPresence).toEqual({head})
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
  const id=pkg.content.monsters![0].id
  const map:any={id:'map',name:'Map',width:200,height:200,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'target',type:'enemy',poolId:id,label:'Target',size:1,x:25,y:25,hp:20,maxHp:20,color:'',emoji:''}]}
  const snapshot=createDnd5eMapCombatSnapshot({combatId:'anatomy-import',map,characters:[],initiativeOrder:[{tokenId:'target',label:'Target',roll:10,emoji:'',color:''}]})
  expect(snapshot.state.combatants.target.classState.bodyPartPresence).toEqual({head})
 }finally{dispose()}
})
it.each([{head:'yes'},[],{'invalid key':true}])('rejects malformed anatomy facts %j',bodyPartPresence=>{
 const monster={...structuredClone(getDnd5eSrdMonster('srd-5.1:bandit')!),bodyPartPresence} as any
 expect(validateDnd5eMonsterCatalog([monster]).some(issue=>issue.message.includes('身体结构'))).toBe(true)
})
