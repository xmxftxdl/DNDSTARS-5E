import {expect,it,vi} from 'vitest'
import {migrateMapsState,type BattleMap} from '../../store/maps'
import {normalizeMapGeometryEntity,type MapGeometryLight} from '../../lib/mapGeometry'
import {reconcileDnd5ePluginAreasOnMap} from './pluginAreas'
import {prepareStrongWindGeometryFlames} from './strongWindGeometryFlames'
import {collectStrongWindProtectedFlames} from './strongWindFlames'
import {settleStrongWindFlamesAlongMovement} from './strongWindFlameMovement'
import {validateAndMigrateSharedResource} from '../../lib/sharedResourceValidation'
import {validateSharedStateShape} from '../../../scripts/shared-server-core.mjs'
import {compileDnd5eActivityPatternV1} from './activities/dnd5eActivityPatterns'

function fixture(){
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'fire',label:'Fire',type:'obstacle',x:75,y:75,size:1,color:'#ffffff',emoji:'',lightSource:{enabled:true,sourceKind:'torch',startedAtWorldMinute:0,durationMinutes:60,expiresAtWorldMinute:60,brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffffff'}}],
  dnd5ePluginAreas:[{id:'ward',pluginId:'test.ward',featureId:'ward',label:'Ward',color:'#ffffff',sourceTokenId:'caster',sourceCharacterId:'caster',cells:[{col:1,row:1}],vertical:{mode:'volume',baseElevationFeet:0,heightFeet:10},extinguishesUnprotectedFlames:'torch-or-smaller',createdRound:1,expiresAfterRound:100}]}
 return map
}
it('uses the actual sphere for scene flames instead of its bounding cells',()=>{
 const map=fixture(),area=map.dnd5ePluginAreas![0]
 area.anchorCell={col:1,row:1};area.vertical={mode:'volume',shape:'sphere',baseElevationFeet:-10,heightFeet:20}
 area.cells=Array.from({length:16},(_,i)=>({col:i%4,row:Math.floor(i/4)}))
 const base={...map.tokens[0].lightSource!,id:'scene',kind:'light' as const,label:'Flame',createdAt:0}
 const result=prepareStrongWindGeometryFlames({map,worldMinute:1,round:1,lights:[
  {...base,points:[{x:75,y:75}],elevationFeet:0},
  {...base,id:'corner',points:[{x:150,y:150}],elevationFeet:8},
 ]})
 expect(result.lights.map(l=>l.enabled)).toEqual([false,true])
})
it.each([false,true])('limited flame ward honors explicit protection for magical fire (%s)',protectedFlame=>{
 const map=fixture(),light:MapGeometryLight={...map.tokens[0].lightSource!,id:'scene',kind:'light',label:'Magic torch',createdAt:0,points:[{x:75,y:75}],elevationFeet:0,flameProtected:protectedFlame,
  controlledFlame:{id:'scene',magical:true,burning:true,extentFeet:1,brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffffff',alterations:[]}}
 const result=prepareStrongWindGeometryFlames({map,lights:[light],worldMinute:1,round:1})
 expect(result.lights[0].enabled).toBe(protectedFlame)
 expect(result.candidates).toHaveLength(0)
})
it.each(['torch','small-custom','large-custom','unknown-custom','protected','nonfire','outside','above','expired','paused'] as const)('small flame ward handles %s without protected-flame dice',mode=>{
 const map=fixture(),token=map.tokens[0],light=token.lightSource!
 if(mode.includes('custom')){light.sourceKind='custom';light.flame=true;light.flameSize=mode==='small-custom'?'torch-or-smaller':mode==='large-custom'?'larger':undefined}
 if(mode==='protected')light.flameProtected=true
 if(mode==='nonfire')light.flame=false
 if(mode==='outside')token.x=325
 if(mode==='above')token.elevationFeet=20
 if(mode==='expired')map.dnd5ePluginAreas![0].expiresAfterRound=0
 if(mode==='paused')map.dnd5ePluginAreas![0].modeState={paused:true,profiles:[{id:'wind'}],selectedModeId:'wind',changeReceipts:[]}
 const scene:MapGeometryLight={...light,id:'scene',kind:'light',label:'Scene',points:[{x:token.x,y:token.y}],elevationFeet:token.elevationFeet??0,createdAt:0}
 const extinguished=['torch','small-custom'].includes(mode)
 expect(reconcileDnd5ePluginAreasOnMap(map,[],1).tokens[0].lightSource===undefined).toBe(extinguished)
 const result=prepareStrongWindGeometryFlames({map,lights:[scene],worldMinute:1,round:1})
 expect(result.lights[0].enabled).toBe(!extinguished)
 expect(result.candidates).toHaveLength(0);expect(collectStrongWindProtectedFlames(map)).toHaveLength(0)
 expect(light.enabled).toBe(true)
})
it('preserves small-flame declaration and physical size through JSON and both shared validators',()=>{
 const map=fixture();map.tokens[0].lightSource!.flameSize='larger'
 const saved=migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0]
 expect(saved.dnd5ePluginAreas![0].extinguishesUnprotectedFlames).toBe('torch-or-smaller')
 expect(saved.tokens[0].lightSource?.flameSize).toBe('larger')
 expect(validateAndMigrateSharedResource('maps',{maps:[saved]}).status).not.toBe('invalid')
 expect(validateSharedStateShape('maps',{maps:[saved]})).toEqual({ok:true})
 saved.tokens[0].lightSource!.flameSize='maybe' as any
 expect(validateAndMigrateSharedResource('maps',{maps:[saved]}).status).toBe('invalid')
 expect(validateSharedStateShape('maps',{maps:[saved]})).toMatchObject({ok:false})
 const scene={...map.tokens[0].lightSource,id:'scene',kind:'light',label:'Scene',points:[{x:75,y:75}],elevationFeet:0,createdAt:0}
 expect(normalizeMapGeometryEntity(scene)).toMatchObject({flameSize:'larger'})
 expect(normalizeMapGeometryEntity({...scene,flameSize:'maybe'})).toBeUndefined()
})
it('extinguishes a carried torch crossing a ward and ending outside without dice',async()=>{
 const before=fixture();before.tokens[0].x=25
 const map={...before,tokens:before.tokens.map(t=>({...t,x:225}))},roll=vi.fn(async()=>1)
 const result=await settleStrongWindFlamesAlongMovement({beforeMap:before,map,tokenId:'fire',round:1,transactionId:'move',path:[{x:25,y:75},{x:225,y:75}],roll})
 expect(result.map.tokens[0]).toMatchObject({x:225,y:75})
 expect(result.map.tokens[0].lightSource).toBeUndefined();expect(roll).not.toHaveBeenCalled()
})
it('validates an importable bounded flame declaration',()=>{
 const pattern={schemaVersion:1 as const,id:'ward',name:'Ward',source:{kind:'spell' as const,id:'ward'},pattern:'area' as const,target:{kind:'area' as const,relation:'any' as const,origin:'self' as const,shape:'circle' as const,radiusFeet:10,includeSelf:true},area:{label:'Ward',durationRounds:100,concentration:true,extinguishesUnprotectedFlames:'torch-or-smaller' as const}}
 const activity=compileDnd5eActivityPatternV1(pattern)
 expect(activity.outcomes[0].operations[0]).toMatchObject({extinguishesUnprotectedFlames:'torch-or-smaller'})
 expect(()=>compileDnd5eActivityPatternV1({...pattern,area:{...pattern.area,extinguishesUnprotectedFlames:'all'} } as any)).toThrow()
})
