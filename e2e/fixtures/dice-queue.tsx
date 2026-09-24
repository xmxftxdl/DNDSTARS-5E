import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import Overlays from '../../src/presentation/maps/DicePresentationOverlays'
import { useDicePresentation } from '../../src/presentation/maps/useDicePresentation'
import '../../src/index.css'
function App() {
 const dice = useDicePresentation(() => 1)
 const [confirmation,setConfirmation] = useState<React.ComponentProps<typeof Overlays>['secretConfirmation']>(null)
 const [completed,setCompleted] = useState<string[]>([])
 const receive = () => {
   dice.setDicePreviewPaused(true)
   for(const [id, sides, values] of [['一',4,[3]],['二',6,[5,2]],['三',20,[18,4]]] as const) {
     dice.setRollRequestPreview({id,kind:'dice',count:values.length,sides,values:[...values],
       dieSides:id==='三'?[20,6]:undefined,formula:id==='三'?'1d20 + 1d6':undefined,
       total:values.reduce((sum,value)=>sum+value,0),label:`自由投掷${id}`,targetName:`玩家${id}`})
   }
 }
 const damage = () => dice.setRollRequestPreview({id:'reduced-damage',kind:'dice',count:2,sides:12,values:[3,2],
   formula:'2d12 + 3',total:4,label:'攻击伤害',targetName:'目标',
   settlement:{label:'最终伤害',details:['骰面合计：3 + 2 = 5','伤害加值：3','衰弱射线：力量武器伤害减半（向下取整）','最终造成 4 点伤害']}})
 const stable = () => dice.setRollRequestPreview({id:'stable',kind:'d20',count:1,sides:20,values:[18],label:'命中',targetName:'目标'})
 const pair = (mode: 'advantage' | 'disadvantage', kind: 'attack' | 'save', values: number[]) => {
   const id = `pair-${mode}-${kind}-${values.join('-')}`
   const selected = mode === 'advantage' ? Math.max(...values) : Math.min(...values)
   const check = {mode,kind,success:selected + 4 >= 15}
   dice.setRollRequestPreview({id,kind:'dice',count:2,sides:20,values,label:kind==='attack'?'法术攻击':'敏捷豁免',targetName:'测试目标',check})
   dice.enqueueCheckOutcome({id:`${id}-cue`,rollId:id,mode,values,kind,success:check.success,actorName:'测试角色',provisional:true})
 }
 return <><button onClick={()=>pair('advantage','attack',[3,18])}>Pair advantage</button>
 <button onClick={()=>pair('disadvantage','attack',[18,3])}>Pair disadvantage</button>
 <button onClick={()=>pair('advantage','save',[3,18])}>Pair save success</button>
 <button onClick={()=>pair('disadvantage','save',[18,3])}>Pair save failure</button>
 <button onClick={()=>pair('advantage','attack',[12,12])}>Pair tie</button>
 <button onClick={()=>{dice.setDicePreviewPaused(true);setConfirmation({id:'waiting',label:'攻击',targetName:'目标',sides:20,values:[15],visibility:'public'});dice.enqueueCheckOutcome({id:'live',kind:'attack',success:true,actorName:'法师',targetName:'目标',provisional:true})}}>Waiting hit</button><button onClick={stable}>Stable confirmation</button>
 <button onClick={()=>dice.enqueueCheckOutcome({id:'success',kind:'attack',success:true,actorName:'法师',targetName:'目标'})}>Hit outcome</button>
 <button onClick={()=>dice.enqueueCheckOutcome({id:'failure',kind:'save',success:false,actorName:'目标'})}>Save failure</button>
 <button onClick={damage}>Reduced damage</button><button onClick={receive}>接收三次自由投掷并暂停</button>
 <button onClick={()=>dice.setDicePreviewPaused(false)}>继续队列</button>
 <p>播放顺序：{completed.join('、')}</p>
 <Overlays historyScope="paired-d20-browser-test" {...dice} secretConfirmation={confirmation} isDM activeRollStatus={null} dockTab="dice" onRollDone={()=>{}}
 onD20Complete={dice.completeDiceBoxD20} onDiceComplete={dice.completeDiceBoxRoll}
 onPreviewComplete={id=>{if(id==='stable')setConfirmation({id:'stable',label:'命中',targetName:'目标',sides:20,values:[18],visibility:'public'});setCompleted(old=>old.includes(id)?old:[...old,id]);dice.completeRollRequestPreview(id,0)}}
 onSecretConfirm={()=>setConfirmation(null)} renderFreeRollControls={()=><div>骰盘</div>} /></>
}
createRoot(document.getElementById('root')!).render(<App />)
