export function normalizeFortressServices(value) {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>
  !['authorizedCreatureIds','mealDay','mealsServed','mealReceipts','mealTemplateId','servants'].includes(key)))return undefined
 const {authorizedCreatureIds,mealDay,mealsServed,mealReceipts}=value
 const ids=(values,max)=>Array.isArray(values)&&values.length<=max&&new Set(values).size===values.length&&
  values.every(id=>typeof id==='string'&&id.length>0&&id.length<=160&&id.trim()===id)
 if(!ids(authorizedCreatureIds,256)||!Number.isSafeInteger(mealDay)||mealDay<0||
  !Number.isInteger(mealsServed)||mealsServed<0||mealsServed>100||!ids(mealReceipts,100)||
  mealReceipts.length>mealsServed||(mealsServed>0&&mealReceipts.length===0))return undefined
 if(value.mealTemplateId!=null&&(typeof value.mealTemplateId!=='string'||!/^[a-z0-9][a-z0-9._:-]{0,199}$/.test(value.mealTemplateId)))return undefined
 let servants
 if(value.servants!==undefined){
  if(!Array.isArray(value.servants)||value.servants.length!==100)return undefined
  servants=[]
  for(let index=0;index<100;index++){
   const servant=value.servants[index]
   if(!servant||typeof servant!=='object'||Array.isArray(servant)||
    Object.keys(servant).some(key=>!['number','assignment','tokenId'].includes(key))||servant.number!==index+1)return undefined
   if(servant.tokenId!==undefined&&(!ids([servant.tokenId],1)||servants.some(prior=>prior.tokenId===servant.tokenId)))return undefined
   const assignment=servant.assignment
   if(assignment!==undefined&&(!assignment||typeof assignment!=='object'||Array.isArray(assignment)||
    Object.keys(assignment).some(key=>!['actorId','instruction'].includes(key))||
    !ids([assignment.actorId],1)||typeof assignment.instruction!=='string'||
    !assignment.instruction.trim()||assignment.instruction.length>1000))return undefined
   servants.push({number:servant.number,...(servant.tokenId?{tokenId:servant.tokenId}:{}),...(assignment?{assignment:{actorId:assignment.actorId,instruction:assignment.instruction}}:{})})
  }
 }
 return {authorizedCreatureIds:[...authorizedCreatureIds],mealDay,mealsServed,mealReceipts:[...mealReceipts],
  ...(value.mealTemplateId?{mealTemplateId:value.mealTemplateId}:{}),...(servants?{servants}:{})}
}

export function createFortressServants(){return Array.from({length:100},(_,index)=>({number:index+1}))}
