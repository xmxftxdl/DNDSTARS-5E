const prefix='["bountiful-ready-d20-followup",'
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<2000
export function isBountifulReadyD20Interrupt(row){return !!row&&(row.payload?.bountifulReadyParent!=null||typeof row.payload?.rollId==='string'&&row.payload.rollId.startsWith(prefix)||typeof row.id==='string'&&row.id.startsWith('roll-confirmation:'+prefix))}
export function validateBountifulReadyD20Followup(value,rollId){
 if(!record(value)||Object.keys(value).some(key=>!['frameId','rawRollId','dieIndex'].includes(key))||!text(value.frameId)||!text(value.rawRollId)||!Number.isSafeInteger(value.dieIndex)||value.dieIndex<0||value.dieIndex>1)return false
 let frame;try{frame=JSON.parse(value.frameId)}catch{return false}
 return Array.isArray(frame)&&frame.length===5&&frame[0]==='bountiful-original-ready'&&text(frame[1])&&Number.isSafeInteger(frame[2])&&frame[2]>=0&&text(frame[3])&&['saving-throw','attack'].includes(frame[4])&&value.frameId===JSON.stringify(frame)&&rollId===JSON.stringify(['bountiful-ready-d20-followup',value.frameId,value.rawRollId,value.dieIndex])
}
