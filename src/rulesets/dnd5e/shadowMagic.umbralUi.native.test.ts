import { expect, it } from 'vitest'
import pageSource from '../../pages/MapsWorkspacePage.tsx?raw'
import canvasSource from '../../components/map/MapCanvas.tsx?raw'
import { nativeUmbralFixture } from './shadowMagic.umbral.native.fixture'
import { umbralFeatureId, namespace } from './shadowMagic.umbralSource.native.fixture'
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from './pluginFeatureAction'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { planDnd5eMapResultApplication } from './mapBridge'
import { dnd5eActiveEnvironmentalCapabilities, dnd5eActiveObjectCreatureTraversal } from './activeEffects'
import { createEmptyMapGeometry, setMapGeometryRuntime, mapGeometryTerrainElevationAtPoint, mapGeometryTokenElevation } from '../../lib/mapGeometry'
import { findMapGeometryPath } from '../../lib/mapPathfinding'
import { dnd5ePersistentAreaDifficultTerrainMultiplierAt, dnd5ePersistentAreaSpeedCostMultiplierAt } from './persistentAreaGeometry'

const page=pageSource.replaceAll('\r\n','\n'),canvas=canvasSource.replaceAll('\r\n','\n')
function evaluate(expression:string,context:Record<string,unknown>) {
  return new Function(...Object.keys(context),'return ('+expression+')')(...Object.values(context))
}
function declaration(source:string,start:string,end:string) {
  const at=source.indexOf(start);if(at<0)throw Error('Actual presentation source missing:'+start)
  const stop=source.indexOf(end,at+start.length);if(stop<0)throw Error('Actual presentation source end missing:'+end)
  return source.slice(at+start.length,stop).trim()
}

it('actual Page pre-submit and Canvas preview consume the legitimately acquired saved18 effect and stop after genuine dismissal',async()=>{
  const f=await nativeUmbralFixture('human','legacy',18)
  try {
    const map={...f.map(),width:500,height:250,tokens:[...f.map().tokens].reverse().map((token:any)=>({...token,x:token.id==='soul-token'?25:425,y:25}))}
    const geometry=createEmptyMapGeometry(map.id)
    geometry.walls.push({id:'wood',kind:'wall',label:'Wood',material:'wood',points:[{x:125,y:0},{x:125,y:250}],baseHeightFeet:0,heightFeet:15,
      blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,createdAt:1});setMapGeometryRuntime([geometry])
    const order=map.tokens.map((token:any,i:number)=>({tokenId:token.id,label:token.label,roll:20-i,color:'',emoji:''}))
    const prepared=prepareDnd5ePluginFeatureAction({map,characters:f.characters(),initiativeOrder:order,action:{id:'actual-ui-umbral',mapId:map.id,combatId:'umbral-ui',
      sourceMode:'player',status:'pending',type:'dnd5e-plugin-action',actorTokenId:'soul-token',characterId:f.soul().id,targetTokenId:'soul-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,
      dnd5ePluginAction:{featureId:umbralFeatureId,payload:{selectedActivityId:'umbral-form'}}}})
    expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
    const used=await resolvePreparedDnd5ePluginFeatureAction({prepared:prepared.prepared,combatRevision:1,rolls:{}})
    expect(used.result.ok).toBe(true);if(!used.result.ok||!used.application)throw Error('Actual source form required')
    const readFlag=declaration(page,'  const activeMoverObjectTraversal =','\n  const activeMoverSolidMaterials =')
    const field='passThroughObjectsAndCreatures: activeMoverObjectTraversal',fieldAt=page.indexOf(field)
    expect(fieldAt).toBeGreaterThan(0)
    const from=page.lastIndexOf('const path = ',fieldAt),to=page.indexOf('\n    })',fieldAt)
    const pageExpression=page.slice(from+'const path = '.length,to+'\n    })'.length)
    const canvasBody=declaration(canvas,'  const movePreviewPath = useMemo(() => {','\n  }, [')
    const run=(application:typeof used.application,expected:boolean)=>{
      if(!application)throw Error('Actual canonical application required')
      const current=application.map,character=application.characters.find(entry=>entry.id==='soul')!,token=current.tokens.find(entry=>entry.id==='soul-token')!
      const flag=evaluate(readFlag,{dnd5eActiveObjectCreatureTraversal,turnCharacter:character,currentInitiativeToken:token})
      expect(flag).toBe(expected)
      const env=dnd5eActiveEnvironmentalCapabilities(character.dnd5eCombatState?.activeEffects)
      const context={findMapGeometryPath,activeMap:current,activeGeometry:geometry,myPlayerToken:token,pos:{x:125,y:25},dnd5eTraversalMode:'walk',
        activeMoverEnvironmentalCapabilities:env,activeMoverIgnoresMaterialCollision:false,targetElevationFeet:0,usesLongJump:false,
        activeMoverSolidMaterials:[],activeMoverObjectTraversal:flag,dnd5ePersistentAreaDifficultTerrainMultiplierAt,dnd5ePersistentAreaSpeedCostMultiplierAt}
      const actual=evaluate(pageExpression,context)
      const preview=new Function(...Object.keys(context),'map','geometry','moveSelectMode','moveCircle','cursor','selectedTokenId','moveTraversalMode',
        'moveTreatsLiquidSurfacesAsSolidGround','moveIgnoreMaterialCollision','movePassThroughSolidMaterials','movePassThroughObjectsAndCreatures',
        'moveTargetElevationFeet','moveCanOccupyCreatureSpaces','moveMinimumPassageGapInches','moveIgnoreDifficultTerrainMaterials','moveIgnoreDifficultTerrain',
        'difficultTerrainMultiplierAtPosition','speedCostMultiplierAtPosition','mapGeometryTerrainElevationAtPoint','mapGeometryTokenElevation',canvasBody)(
        ...Object.values(context),current,geometry,true,{centerX:25,centerY:25},{x:125,y:25},token.id,'walk',env.treatsLiquidSurfacesAsSolidGround,false,[],flag,0,
        env.canOccupyCreatureSpaces,env.minimumPassageGapInches,env.ignoredDifficultTerrainMaterials,env.ignoresDifficultTerrain,
        (stepToken:any,position:any)=>dnd5ePersistentAreaDifficultTerrainMultiplierAt({map:current,token:stepToken,position}),
        (stepToken:any,position:any)=>dnd5ePersistentAreaSpeedCostMultiplierAt({map:current,token:stepToken,position}),mapGeometryTerrainElevationAtPoint,mapGeometryTokenElevation)
      expect(!!actual).toBe(expected);expect(!!preview).toBe(expected)
      if(expected){expect(actual).toMatchObject({distanceFeet:10,movementCostFeet:15});expect(preview).toEqual(actual)}
    }
    run(used.application,true)
    const end=resolveDnd5eHeadlessAction(used.result.state,{type:'end-turn',actorId:'soul-token'});expect(end.ok).toBe(true)
    const next=resolveDnd5eHeadlessAction(end.state,{type:'end-turn',actorId:'foe-token'});expect(next.ok).toBe(true)
    const effect=next.state.combatants['soul-token'].classState.activeEffects!.find(entry=>entry.modifiers?.objectCreatureTraversal)!
    const dismissed=resolveDnd5eHeadlessAction(next.state,{type:'plugin',pluginId:namespace,actionId:'dismiss-umbral-form',featureId:namespace+':effect-control.dismiss-umbral-form',
      actorId:'soul-token',targetId:'soul-token',targetIds:['soul-token'],rolls:{},hostEntitlement:{kind:'active-effect',effectId:effect.id}})
    expect(dismissed.ok).toBe(true)
    run(planDnd5eMapResultApplication({map:used.application.map,characters:used.application.characters,state:dismissed.state,events:[...dismissed.events],
      characterIdByCombatantId:{'soul-token':'soul','foe-token':'foe'}}),false)
  }finally{setMapGeometryRuntime([]);f.dispose()}
})
