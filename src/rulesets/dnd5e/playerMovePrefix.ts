import{prepareDnd5ePlayerMove,resolvePreparedDnd5ePlayerMove,type PreparedDnd5ePlayerMove}from'./playerMoveAction'
/** Mechanical replay only. No private brand, original-queue authority, reaction
 * authorization, HTTP mutation or publication is issued by this pure helper. */
export function replayDnd5ePlayerMovePrefix(input:{originalInput:Parameters<typeof prepareDnd5ePlayerMove>[0];prepared:PreparedDnd5ePlayerMove;position:{x:number;y:number};elevationFeet:number;firstHostNow:number;transactionId:string}){
 if(!Number.isSafeInteger(input.firstHostNow)||input.firstHostNow<=0||!input.transactionId||input.originalInput.action.id!==input.prepared.action.id||input.originalInput.action.actorTokenId!==input.prepared.actorToken.id||!Number.isFinite(input.elevationFeet))throw Error('player-move-prefix:original-input-clock-required')
 const points=(prepared:PreparedDnd5ePlayerMove)=>[{...prepared.actorToken,elevationFeet:prepared.actorToken.elevationFeet??0},...prepared.path.map((p,i)=>({...p,elevationFeet:prepared.pathElevationsFeet[i]??prepared.actorToken.elevationFeet??0})),{...prepared.to,elevationFeet:prepared.toElevationFeet}].filter((p,i,all)=>i===0||p.x!==all[i-1].x||p.y!==all[i-1].y||p.elevationFeet!==all[i-1].elevationFeet)
 const originalPath=points(input.prepared),index=originalPath.findIndex(p=>p.x===input.position.x&&p.y===input.position.y&&Math.abs(p.elevationFeet-input.elevationFeet)<1e-6)
 if(index<0)throw Error('player-move-prefix:actual-host-path-anchor-required')
 const action={...input.originalInput.action,targetPosition:{...input.position},targetElevationFeet:input.elevationFeet},prefix=prepareDnd5ePlayerMove({...input.originalInput,action})
 if(!prefix.ok)throw Error('player-move-prefix:preparation-rejected:'+prefix.reason)
 const actual=points(prefix.prepared),expected=originalPath.slice(0,index+1)
 if(actual.length!==expected.length||actual.some((p,i)=>p.x!==expected[i].x||p.y!==expected[i].y||Math.abs(p.elevationFeet-expected[i].elevationFeet)>1e-6)||prefix.prepared.movementCostFeet>input.prepared.movementCostFeet+1e-6)throw Error('player-move-prefix:exact-original-path-required')
 const originalIds=Object.keys(input.prepared.state.combatants).sort(),prefixIds=Object.keys(prefix.prepared.state.combatants).sort()
 if(originalIds.length!==prefixIds.length||originalIds.some((id,i)=>id!==prefixIds[i]))throw Error('player-move-prefix:original-roster-required')
 for(const id of originalIds)prefix.prepared.state.combatants[id].turn={...input.prepared.state.combatants[id].turn}
 const resolution=resolvePreparedDnd5ePlayerMove({prepared:prefix.prepared,transactionId:input.transactionId},{now:input.firstHostNow})
 if(!resolution.result.ok||!resolution.application)throw Error('player-move-prefix:native-rejected:'+(!resolution.result.ok?resolution.result.reason:'application-required'))
 const actor=resolution.result.state.combatants[input.prepared.actorToken.id]
 if(!actor||actor.position.x!==input.position.x||actor.position.y!==input.position.y||Math.abs((actor.elevationFeet??0)-input.elevationFeet)>1e-6)throw Error('player-move-prefix:requested-anchor-not-reached')
 return{prepared:prefix.prepared,resolution,movementCostFeet:prefix.prepared.movementCostFeet,completeMovementCostFeet:input.prepared.movementCostFeet,originalActionId:input.originalInput.action.id}
}
