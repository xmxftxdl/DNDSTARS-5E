import {bountifulOriginalDiePhase,bountifulPreparedReplayFacts} from './bountifulLuckReceipt'
export function bountifulConfirmedReplayFacts(input:Parameters<typeof bountifulPreparedReplayFacts>[0]){
 const end=input.receipts.findIndex(row=>!['ready','declined'].includes(bountifulOriginalDiePhase(row)))
 const receipts=end<0?input.receipts:input.receipts.slice(0,end)
 return bountifulPreparedReplayFacts({...input,receipts})
}
