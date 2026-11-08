import {useEffect,useRef,useState} from 'react'
import type {ArcaneNativeOwnerRequest} from '../../../shared/arcane-native-parent.mjs'
import type {Dnd5eHeadlessCombatState} from '../../rulesets/dnd5e/headlessCombatEngine'
import {requestSharedArcaneNative} from '../../lib/sharedApi'
import {getRoomSession,ROOM_SESSION_EVENT} from '../../lib/roomSession'
import {arcaneOwnerChoice,arcaneOwnerTargetIds,arcaneOwnerRequestKey,sameArcaneOwnerRequest} from './arcaneNativeOwnerChoice'

/** This panel runs in the controller's browser. A DM's browser cannot answer
 * on behalf of a PC; requests are already projected by authenticated identity. */
export default function ArcaneNativeOwnerPanel({mapId,state,requestApi=requestSharedArcaneNative,regionLabel='战争魔法反应'}:{mapId:string;state:(request?:ArcaneNativeOwnerRequest)=>Dnd5eHeadlessCombatState;requestApi?:typeof requestSharedArcaneNative;regionLabel?:string}){
 const [requests,setRequests]=useState<ArcaneNativeOwnerRequest[]>([]),[selected,setSelected]=useState<Record<string,string[]>>({}),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const generation=useRef(0),inflight=useRef(false),latestState=useRef(state);latestState.current=state
 useEffect(()=>{
  let alive=true;generation.current++
  const refresh=async()=>{const current=++generation.current,session=getRoomSession();if(!session||session.role==='spectator'){if(alive)setRequests([]);return}const identity=session.roomId+':'+session.memberId
   try{const result=await requestApi<{requests:ArcaneNativeOwnerRequest[]}>('requests'),now=getRoomSession();if(alive&&generation.current===current&&now&&now.roomId+':'+now.memberId===identity)setRequests(result.requests.filter(row=>row.mapId===mapId))}catch{if(alive)setRequests([])}}
  const changed=()=>{generation.current++;setRequests([]);setSelected({});setNotice('');void refresh()}
  void refresh();const timer=window.setInterval(()=>void refresh(),1000);window.addEventListener(ROOM_SESSION_EVENT,changed)
  return()=>{alive=false;generation.current++;window.clearInterval(timer);window.removeEventListener(ROOM_SESSION_EVENT,changed)}
 },[mapId,requestApi])
 const submit=async(request:ArcaneNativeOwnerRequest,decision:'use'|'decline')=>{
  if(inflight.current)return;inflight.current=true;setBusy(true);setNotice('')
  try{
   const session=getRoomSession();if(!session||session.role==='spectator')throw Error('owner-required')
   const identity=session.roomId+':'+session.memberId,visible=await requestApi<{requests:ArcaneNativeOwnerRequest[]}>('requests')
   const fresh=visible.requests.find(row=>sameArcaneOwnerRequest(row,request)&&row.mapId===mapId),now=getRoomSession()
   if(!fresh||!now||now.roomId+':'+now.memberId!==identity)throw Error('request-changed')
   const payload=arcaneOwnerChoice(fresh,decision,decision==='use'?(selected[arcaneOwnerRequestKey(request)]??[]):[],latestState.current(fresh))
   await requestApi('choice',payload)
   setRequests(rows=>rows.filter(row=>!sameArcaneOwnerRequest(row,request)));setNotice('选择已保存，等待结算。')
  }catch{
   // A lost response may already have locked the choice. Read requests before
   // showing another action; never automatically replay a POST.
   try{const fresh=await requestApi<{requests:ArcaneNativeOwnerRequest[]}>('requests');setRequests(fresh.requests.filter(row=>row.mapId===mapId));setNotice(fresh.requests.some(row=>sameArcaneOwnerRequest(row,request))?'选择暂未保存，请检查后重试。':'选择已提交，等待结算。')}catch{setRequests([]);setNotice('连接中断，请恢复连接后检查选择。')}
  }finally{inflight.current=false;setBusy(false)}
 }
 if(!requests.length&&!notice)return null
 return <section aria-label={regionLabel} className="absolute bottom-24 left-4 z-[115] max-w-sm rounded-lg bg-slate-950/95 p-4 text-sm text-violet-100">
  {requests.map(request=>{const snapshot=latestState.current(request),owner=snapshot.combatants[request.actorTokenId],eligible=arcaneOwnerTargetIds(request,snapshot),picked=(selected[arcaneOwnerRequestKey(request)]??[]).filter(id=>eligible.includes(id));return <div key={arcaneOwnerRequestKey(request)}>
   <h3>{owner?.name??'你的角色'} · {request.phase==='arcane'?'奥术偏转':'偏转帷幕'}</h3>
   <p>{request.phase==='arcane'?'是否使用奥术偏转？':'选择 60 尺内至多三个你能看见的生物。'}</p>
   {request.phase==='shroud'&&eligible.map(id=><label className="block" key={id}><input type="checkbox" checked={picked.includes(id)} disabled={busy||(!picked.includes(id)&&picked.length>=3)} onChange={event=>setSelected(rows=>({...rows,[arcaneOwnerRequestKey(request)]:event.target.checked?[...picked,id]:picked.filter(value=>value!==id)}))}/>{snapshot.combatants[id].name}</label>)}
   <button type="button" disabled={busy} onClick={()=>void submit(request,'use')}>使用</button>
   <button type="button" disabled={busy} onClick={()=>void submit(request,'decline')}>{request.phase==='arcane'?'保留反应':'跳过帷幕'}</button>
  </div>})}
  {notice&&<p role="status">{notice}</p>}
 </section>
}
