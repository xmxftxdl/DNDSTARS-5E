import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
import {planDnd5ePersistentAreaCarry} from './persistentAreaCarry'
import {captureDnd5eAreaObjects} from './persistentAreaObjectCapture'

/** Transient authority state only; fractional anchors must never be published as saved map data. */
export function stageDnd5eSphereAreaContact(input:{map:BattleMap;characters:readonly Character[];areaId:string;
 pendingContactTargetId?:string;
 pendingContactTargetIds?:readonly string[];
 path:readonly {x:number;y:number;elevationFeet:number}[]}):BattleMap|undefined{
 const area=input.map.dnd5ePluginAreas?.find(a=>a.id===input.areaId),point=input.path.at(-1)
 if(!area||area.vertical?.mode!=='volume'||(area.vertical.shape!=='sphere'&&!area.circularGeometry?.radiusFeet)||!point||!input.path.length)return undefined
 if(input.path.some(p=>![p.x,p.y,p.elevationFeet].every(Number.isFinite)))return undefined
 const start=input.path[0],anchor=area.anchorCell
 if(!anchor||Math.abs(start.x-(input.map.gridOffsetX+(anchor.col+.5)*input.map.gridSize))>1e-6||
  Math.abs(start.y-(input.map.gridOffsetY+(anchor.row+.5)*input.map.gridSize))>1e-6||Math.abs(start.elevationFeet-area.vertical.baseElevationFeet)>1e-6)return undefined
 const radius=(area.vertical.shape==='sphere'?area.vertical.heightFeet/2:area.circularGeometry!.radiusFeet)*input.map.gridSize/(input.map.feetPerCell??5)
 const cells=[]
 const minCol=Math.floor((point.x-radius-input.map.gridOffsetX)/input.map.gridSize),maxCol=Math.floor((point.x+radius-input.map.gridOffsetX)/input.map.gridSize)
 const minRow=Math.floor((point.y-radius-input.map.gridOffsetY)/input.map.gridSize),maxRow=Math.floor((point.y+radius-input.map.gridOffsetY)/input.map.gridSize)
 for(let col=minCol;col<=maxCol;col++)for(let row=minRow;row<=maxRow;row++){
  const x=input.map.gridOffsetX+col*input.map.gridSize,y=input.map.gridOffsetY+row*input.map.gridSize
  const dx=Math.max(x-point.x,0,point.x-x-input.map.gridSize),dy=Math.max(y-point.y,0,point.y-y-input.map.gridSize)
  if(dx*dx+dy*dy<=radius*radius+1e-7)cells.push({col,row})
 }
 const next={...area,cells,anchorCell:{col:(point.x-input.map.gridOffsetX)/input.map.gridSize-.5,row:(point.y-input.map.gridOffsetY)/input.map.gridSize-.5},
  vertical:{...area.vertical,baseElevationFeet:point.elevationFeet}}
 const captured=captureDnd5eAreaObjects(input.map,area,input.path)
 if(!captured)return undefined
 const carried=planDnd5ePersistentAreaCarry({...input,area,nextArea:next,areaPath:input.path})
 if(!carried)return undefined
 return {...captured,dnd5ePluginAreas:captured.dnd5ePluginAreas!.map(a=>a.id===area.id?next:a),
  tokens:captured.tokens.map(token=>{
   const move=carried.find(m=>m.targetId===token.id)
   return move?{...token,...move.to,...(move.toElevationFeet!==undefined?{elevationFeet:move.toElevationFeet}:{})}:token
  })}
}
