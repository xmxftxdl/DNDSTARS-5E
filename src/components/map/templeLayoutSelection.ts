import {validTempleLayout,type TempleLayout,type TempleSide} from '../../rulesets/dnd5e/templeLayout'
import type {PluginChoiceField} from '../../lib/pluginChoiceFields'

interface LayoutPrompt {prompt:string;options:{id:string;label:string}[];fields:PluginChoiceField[]}
export async function requestTempleLayout(input:{widthFeet:number;depthFeet:number;heightFeet:number;
 choose:(request:LayoutPrompt)=>Promise<{id:string;values:Record<string,string>}|undefined>}):Promise<TempleLayout|undefined>{
 const sides=[{id:'north',label:'上侧'},{id:'east',label:'右侧'},{id:'south',label:'下侧'},{id:'west',label:'左侧'}]
 const fields=(window:boolean):PluginChoiceField[]=>[
  {id:'offset',label:'距该侧起点（尺）',kind:'text',required:true,defaultValue:'0'},
  {id:'width',label:'宽度（尺）',kind:'text',required:true,defaultValue:String(Math.min(5,input.widthFeet,input.depthFeet))},
  {id:'height',label:'高度（尺）',kind:'text',required:true,defaultValue:String(Math.min(window?5:10,input.heightFeet))},
  ...(window?[{id:'bottom',label:'窗台离地（尺）',kind:'text' as const,required:true,defaultValue:'0'}]:[])]
 let layout:TempleLayout|undefined,error=''
 for(let attempt=0;attempt<1024;attempt++){
  const isWindow=!!layout
  const answer=await input.choose({prompt:error+(isWindow?'添加窗户，或完成布局。':'设置唯一入口。')+'上下侧从左端计，左右侧从上端计；方向随范围旋转。',
   options:[...sides,...(isWindow?[{id:'done',label:'完成门窗'}]:[]),{id:'cancel',label:'取消施放'}],fields:fields(isWindow)})
  if(!answer||answer.id==='cancel')return undefined
  if(answer.id==='done'&&layout)return layout
  if(!sides.some(side=>side.id===answer.id))return undefined
  const opening={side:answer.id as TempleSide,offsetFeet:Number(answer.values.offset),widthFeet:Number(answer.values.width),
   heightFeet:Number(answer.values.height),bottomFeet:isWindow?Number(answer.values.bottom):0}
  const next:TempleLayout=layout?{...layout,windows:[...layout.windows,opening]}:{door:opening,windows:[]}
  if(!validTempleLayout(next,input.widthFeet,input.depthFeet,input.heightFeet)){
   error='尺寸越界或与已有开口重叠，请重新填写。';continue
  }
  layout=next;error=''
 }
 return undefined
}
