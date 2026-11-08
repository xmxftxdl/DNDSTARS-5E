import type{Dnd5eClassId}from'../classes'
type Reader=(subclassId:string,classLevel:number,classId:Dnd5eClassId)=>readonly Dnd5eClassId[]
let reader:Reader=()=>[]
/** Installed by the canonical Host catalog; no wire field supplies this resolver. */
export function setDnd5eSubclassLiveSpellListReader(value:Reader):void{reader=value}
export function dnd5eSubclassLiveSpellListClassIdsV1(subclassId:string|undefined,classLevel:number,classId:Dnd5eClassId):readonly Dnd5eClassId[]{return subclassId&&Number.isInteger(classLevel)&&classLevel>=1?reader(subclassId,classLevel,classId):[]}
