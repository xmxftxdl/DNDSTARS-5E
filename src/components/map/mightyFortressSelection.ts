import {fortressAreaPlacement} from '../../rulesets/dnd5e/fortressAreaPlacement'
import type {BattleMap} from '../../store/maps'
import type {MapGeometryState} from '../../lib/mapGeometry'
import type {AppActionChoiceOptions,AppMultiChoiceOptions} from '../../lib/appDialog'
import type {Dnd5eActivityAreaMapSelectionV1} from '../../rulesets/dnd5e/activities/dnd5eActivityMapInteraction'
import {buildDnd5eMightyFortressShell,prepareDnd5eMightyFortressStructure,type Dnd5eFortressLayoutSelection} from '../../rulesets/dnd5e/mightyFortressStructure'
import {type GridCell} from '../../lib/gridCombat'
import {prepareDnd5eStructureEmergence,dnd5eStructureEmergenceDestinations,type Dnd5eStructureEmergencePlacements} from '../../rulesets/dnd5e/structureEmergence'
import type {Dnd5eFortressRoomBlueprint} from '../../rulesets/dnd5e/fortressRoomBlueprint'
import type {FortressFurnishingPreview} from './FortressFurnishingDialog'
import type {Dnd5eFortressFurnishingRecipe,Dnd5eFortressFurnishingPlacement} from '../../rulesets/dnd5e/fortressFurnishingDefinition'
import {placeDnd5eFortressFurnishings} from '../../rulesets/dnd5e/fortressFurnishings'

/** Host classifications never come from the player payload. */
export async function requestDnd5eFortressSelection(input:{
 map:BattleMap;geometry:MapGeometryState;area:Dnd5eActivityAreaMapSelectionV1;isCurrent:()=>boolean;
 casterId?:string;
 choose:(options:AppActionChoiceOptions)=>Promise<string|null>;
 chooseMany:(options:AppMultiChoiceOptions)=>Promise<string[]|null>;
 promptThickness:(label:string)=>Promise<string|null>;
 chooseRoomLayout?:(floor:number,stair:number)=>Promise<Dnd5eFortressRoomBlueprint[]|null>;
 furnishingCatalog?:readonly Dnd5eFortressFurnishingRecipe[];
 chooseFurnishings?:(preview:FortressFurnishingPreview)=>Promise<Dnd5eFortressFurnishingPlacement[]|null>;
 chooseLanding?:(label:string,cells:readonly GridCell[])=>Promise<GridCell|undefined>;
}){
 if(!input.isCurrent()||!input.area.cells.length)return undefined
 const thickness=async(label:string)=>{
  const choice=await input.choose({title:`坚固堡垒 · ${label}`,message:'规则未规定此处厚度，由 DM 选择。楼梯连接各层。',
   options:[{id:'6',label:'6 英寸'},{id:'12',label:'12 英寸'},{id:'18',label:'18 英寸'},{id:'custom',label:'自定义厚度'}]})
  if(choice==null||!input.isCurrent())return undefined
  const raw=choice==='custom'?await input.promptThickness(label):choice
  if(raw==null||!input.isCurrent()||!raw.trim())return undefined
  const value=Number(raw)
  return Number.isFinite(value)&&value>0&&Number.isSafeInteger(value*30)&&value*30<=1000000?value:undefined
 }
 const tower=await thickness('塔楼墙厚')
 if(tower==null||tower>=120)return undefined
 const floor=await thickness('楼板厚度')
 if(floor==null)return undefined
 const stair=await thickness('楼梯厚度')
 if(stair==null)return undefined
 const eastRoomsPerLevel:number[]=[]
 let roomBlueprint:Dnd5eFortressRoomBlueprint[]|undefined
 for(let level=1;level<=3;level++){
  const selected=await input.choose({title:`坚固堡垒 · 第 ${level} 层房间`,message:'可保留整层大厅，或在东侧设置带石门的独立房间。楼梯和西侧大厅保留，各房间净尺寸不少于 5 尺。',
   options:[...Array.from({length:9},(_,count)=>({id:String(count),label:count?`东侧 ${count} 间房`:'整层大厅'})),
    ...(level===1&&input.chooseRoomLayout?[{id:'custom',label:'自定义三层房间布局'}]:[])]})
  if(selected==='custom'&&level===1&&input.chooseRoomLayout){
   const rooms=await input.chooseRoomLayout(floor,stair)
   if(!rooms||!input.isCurrent())return undefined
   roomBlueprint=rooms;break
  }
  if(selected==null||!input.isCurrent()||!/^([0-8])$/.test(selected))return undefined
  eastRoomsPerLevel.push(Number(selected))
 }
 const roomOptions=eastRoomsPerLevel.flatMap((count,level)=>Array.from({length:count},(_,room)=>({
  id:`room-${level+1}-${room+1}-door.0.0`,label:`第 ${level+1} 层 · 东侧第 ${room+1} 间（由北向南）`})))
 const roomArchways=roomOptions.length?await input.chooseMany({title:'坚固堡垒 · 房间拱门',
  message:'勾选以开放拱门连接大厅的房间。未勾选的房间使用可开关石门。',options:roomOptions,selectedIds:[]}):[]
 if(!roomArchways||!input.isCurrent()||new Set(roomArchways).size!==roomArchways.length||roomArchways.some(id=>!roomOptions.some(room=>room.id===id)))return undefined
 const candidates=buildDnd5eMightyFortressShell({towerThicknessInches:tower}).filter(section=>section.bottomFeet===0)
 const sides:Record<string,string>={north:'北',south:'南',west:'西',east:'东'}
 const label=(id:string)=>id.replace(/^outer-/,'外墙 · ').replace(/^keep-/,'主楼 · ').replace(/^tower-nw-/,'西北塔 · ')
  .replace(/^tower-ne-/,'东北塔 · ').replace(/^tower-sw-/,'西南塔 · ').replace(/^tower-se-/,'东南塔 · ').replace(/north|south|west|east/g,side=>sides[side])
 const doors=await input.chooseMany({title:'坚固堡垒 · 石门',message:'选择地面层的石门。外墙最多四扇；未选的墙段保持封闭。',
  options:candidates.map(section=>({id:section.id,label:`${label(section.wallId)} · 第 ${Number(section.id.split('.').at(-1))+1} 段`})),
  selectedIds:['outer-north.0.3','keep-north.0.2']})
 if(!doors||!input.isCurrent()||new Set(doors).size!==doors.length||doors.some(id=>!candidates.some(section=>section.id===id))||doors.filter(id=>id.startsWith('outer-')).length>4)return undefined
 const obstacles=input.geometry.obstacles.filter(obstacle=>!obstacle.terrainRegion)
 const naturalObstacleIds=obstacles.length?await input.chooseMany({title:'坚固堡垒 · 自然地物',message:'仅勾选自然地物。未勾选的障碍按构造物检查，区域内已有构造物不能施法。',
  options:obstacles.map(obstacle=>({id:obstacle.id,label:obstacle.label||obstacle.id})),selectedIds:[]}):[]
 if(!naturalObstacleIds||!input.isCurrent())return undefined
 const objects=input.map.tokens.filter(token=>token.type==='obstacle')
 const naturalObjectTokenIds=objects.length?await input.chooseMany({title:'坚固堡垒 · 自然物体',message:'仅勾选树木、岩石等自然物体。',
  options:objects.map(token=>({id:token.id,label:token.label})),selectedIds:[]}):[]
 if(!naturalObjectTokenIds||!input.isCurrent())return undefined
 const creatures=input.map.tokens.filter(token=>token.type!=='obstacle'&&!token.dnd5eSpellEffect)
 const delegates=creatures.length?await input.chooseMany({title:'坚固堡垒 · 仆役授权',message:'选择可以指挥堡垒仆役的生物。施法者始终具有权限。',
  options:creatures.map(token=>({id:token.id,label:token.label})),selectedIds:[]}):[]
 if(!delegates||!input.isCurrent()||new Set(delegates).size!==delegates.length||delegates.some(id=>!creatures.some(token=>token.id===id)))return undefined
 const authorizedCreatureIds=[...new Set(delegates.map(id=>{const token=creatures.find(token=>token.id===id)!;return token.characterId??token.id}))]
 const rise=10+floor/12
 const fortressSelection:Dnd5eFortressLayoutSelection={towerThicknessInches:tower,floorThicknessInches:floor,authorizedCreatureIds,eastRoomsPerLevel,roomArchways,
  ...(roomBlueprint?{roomBlueprint,eastRoomsPerLevel:undefined}:{}),
  openings:doors.map(sectionId=>({sectionId,kind:'door',open:false})),
  stairOpenings:[...Array.from({length:3},(_,column)=>({level:2 as const,column,row:1})),...Array.from({length:3},(_,column)=>({level:3 as const,column,row:3}))],
  stairs:[{id:'lower',from:{x:47.5,y:47.5,elevationFeet:0},to:{x:62.5,y:47.5,elevationFeet:rise},widthFeet:5,thicknessInches:stair},
   {id:'upper',from:{x:47.5,y:67.5,elevationFeet:rise},to:{x:62.5,y:67.5,elevationFeet:2*rise},widthFeet:5,thicknessInches:stair}]}
 const fortressQualifications={naturalObstacleIds,naturalObjectTokenIds}
 const placement=fortressAreaPlacement(input.map,input.area)
 if(!placement)return undefined
 if(input.area.areaPlacement.elevationFeet==null)return undefined
 const preview=prepareDnd5eMightyFortressStructure({...fortressSelection,map:input.map,geometry:input.geometry,structureId:'fortress-preview',
  ...placement,elevationFeet:input.area.areaPlacement.elevationFeet,
  createdAt:0,qualifications:fortressQualifications,lifetime:{casterId:input.casterId??'fortress-preview',worldMinute:0}})
 if(!preview.ok)return undefined
 const fortressEmergencePlacements:Dnd5eStructureEmergencePlacements={}
 for(let attempt=0;attempt<=input.map.tokens.length;attempt++){
  const context={map:preview.map,before:input.geometry,after:preview.geometry,placements:fortressEmergencePlacements}
  const plan=prepareDnd5eStructureEmergence(context)
  if(plan.ok){
   if(input.furnishingCatalog?.length){
    if(!input.chooseFurnishings)return undefined
    const furnishingPreview={map:plan.map,geometry:preview.geometry,structureId:'fortress-preview',catalog:input.furnishingCatalog}
    const placements=await input.chooseFurnishings(furnishingPreview)
    if(!placements||!input.isCurrent())return undefined
    try{placeDnd5eFortressFurnishings({...furnishingPreview,placements})}catch{return undefined}
    fortressSelection.furnishings=placements
   }
   return {fortressSelection,fortressQualifications,fortressEmergencePlacements}
  }
  const tokenId=plan.tokenIds[0]
  if(!tokenId||!input.chooseLanding||!input.isCurrent())return undefined
  const options=dnd5eStructureEmergenceDestinations({...context,tokenId})
  if(!options.length)return undefined
  const selected=await input.chooseLanding(`坚固堡垒 · ${input.map.tokens.find(token=>token.id===tokenId)?.label??'生物'}的安全落点`,options.map(option=>option.cell))
  if(!selected||!input.isCurrent())return undefined
  const chosen=options.find(option=>option.cell.col===selected.col&&option.cell.row===selected.row)
  if(!chosen)return undefined
  fortressEmergencePlacements[tokenId]={x:chosen.x,y:chosen.y,elevationFeet:chosen.elevationFeet}
 }
 return undefined
}
