import type{Dnd5eClassId}from'../classes'
export interface Dnd5eAdditionalKnownSpellSourceV1{sourceId:string;name:string;classId:Dnd5eClassId;spellId:string;choiceGroupId:string;choiceOptionId:string;grantedAtClassLevel:number;replacementClassSpellListIds?:readonly Dnd5eClassId[]}
export interface Dnd5eAdditionalKnownSpellContextV1{classId:Dnd5eClassId;classLevel:number;subclassId?:string;selections:Readonly<Record<string,readonly string[]>>}
type Reader=(subclassId:string,classLevel:number,classId:Dnd5eClassId,selections:Readonly<Record<string,readonly string[]>>)=>readonly Dnd5eAdditionalKnownSpellSourceV1[]
let reader:Reader=()=>[]
export function setDnd5eSubclassAdditionalKnownSpellReader(value:Reader):void{reader=value}
export function dnd5eSubclassAdditionalKnownSpellSourcesV1(input:Dnd5eAdditionalKnownSpellContextV1):readonly Dnd5eAdditionalKnownSpellSourceV1[]{return input.subclassId&&Number.isInteger(input.classLevel)&&input.classLevel>=1&&input.classLevel<=20?reader(input.subclassId,input.classLevel,input.classId,input.selections):[]}
