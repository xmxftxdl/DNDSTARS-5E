import{loadDmUndoHistory,type DmUndoTransactionSummary}from'../../composition/browserSharedRoomResources'
import{getRoomSession}from'../../lib/roomSession'
type Port={session:typeof getRoomSession;loadHistory:()=>Promise<readonly DmUndoTransactionSummary[]>}
/** Completion classification only: the actual authenticated durable Host undo
 * journal confirms a prior original publication. It cannot issue any native
 * result, new resource write, owner decision or fresh spell dispatch. */
export async function readMastermindSpellWindowNativeCompletion(parentId:string,mapId:string,port:Port={session:getRoomSession,loadHistory:loadDmUndoHistory}){
 const session=port.session();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('spell-window-native-completion:current-Host-required')
 if(!/^mm-spell-window:[a-f0-9]{64}$/.test(parentId)||!mapId)return false
 const rows=await port.loadHistory(),current=port.session();if(current?.role!=='dm'||current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('spell-window-native-completion:Host-changed')
 return rows.some(row=>row.transactionId==='mastermind-native-spell-window:'+parentId&&row.status==='applied'&&row.combat?.mapId===mapId&&row.resources.length===3&&['characters','maps','combat'].every(name=>row.resources.includes(name)))
}
