import {normalizeFortressServices} from './fortress-services.mjs'
import {normalizeTempleWard} from './temple-ward.mjs'
/** Explicit entity ownership prevents expiry from matching unrelated ID prefixes. */
export function normalizeStructureLifetimes(value) {
  if(!Array.isArray(value)||value.length>128)return undefined
  const ids=new Set(),owned=new Set(),result=[]
  const text=value=>typeof value==='string'&&value.length>0&&value.length<=160
  for(const item of value){
    if(!item||typeof item!=='object'||Array.isArray(item)||
      Object.keys(item).some(key=>!['id','casterId','createdWorldMinute','expiresWorldMinute','entityIds','replacementGroup','siteKey','objectBoundary','fortressServices','doorAccess','templeWard'].includes(key))||
      ((item.replacementGroup!=null||item.siteKey!=null)&&(!text(item.replacementGroup)||!text(item.siteKey)))||
      !text(item.id)||ids.has(item.id)||!text(item.casterId)||
      !Number.isSafeInteger(item.createdWorldMinute)||item.createdWorldMinute<0||
      (item.expiresWorldMinute!==null&&(!Number.isSafeInteger(item.expiresWorldMinute)||item.expiresWorldMinute<=item.createdWorldMinute))||
      !Array.isArray(item.entityIds)||!item.entityIds.length||item.entityIds.length>4096)return undefined
    ids.add(item.id)
    const templeWard=normalizeTempleWard(item.templeWard)
    if(item.templeWard!=null&&(!templeWard||item.replacementGroup!=='temple-of-the-gods'||!item.objectBoundary))return undefined
    const access=item.doorAccess
    if(access!=null&&(typeof access!=='object'||Array.isArray(access)||Object.keys(access).some(key=>key!=='authorizedCreatureIds')||
      !Array.isArray(access.authorizedCreatureIds)||access.authorizedCreatureIds.length>256||
      access.authorizedCreatureIds.some(id=>!text(id)||id.trim()!==id)||new Set(access.authorizedCreatureIds).size!==access.authorizedCreatureIds.length))return undefined
    const fortressServices=normalizeFortressServices(item.fortressServices)
    if(item.fortressServices!=null&&(!fortressServices||item.replacementGroup!=='mighty-fortress'))return undefined
    const boundary=item.objectBoundary
    if(boundary!=null){
      if(typeof boundary!=='object'||Array.isArray(boundary)||Object.keys(boundary).some(key=>!['points','bottomFeet','topFeet'].includes(key))||
        !Number.isFinite(boundary.bottomFeet)||!Number.isFinite(boundary.topFeet)||boundary.topFeet<=boundary.bottomFeet||
        !Array.isArray(boundary.points)||boundary.points.length!==4||boundary.points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return undefined
      const edges=boundary.points.map((p,i)=>({x:boundary.points[(i+1)%4].x-p.x,y:boundary.points[(i+1)%4].y-p.y}))
      let sign=0
      for(let i=0;i<4;i++){
        const a=edges[i],b=edges[(i+1)%4],length=Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y),cross=a.x*b.y-a.y*b.x
        if(length<=1e-8||Math.abs(a.x*b.x+a.y*b.y)>length*1e-6||Math.abs(cross)<1e-8||(sign&&Math.sign(cross)!==sign))return undefined
        sign=Math.sign(cross)
      }
    }
    for(const id of item.entityIds){if(!text(id)||owned.has(id))return undefined;owned.add(id)}
    result.push({id:item.id,casterId:item.casterId,createdWorldMinute:item.createdWorldMinute,
      expiresWorldMinute:item.expiresWorldMinute,entityIds:[...item.entityIds],
      ...(item.replacementGroup!=null?{replacementGroup:item.replacementGroup,siteKey:item.siteKey}:{}),
      ...(boundary?{objectBoundary:{points:boundary.points.map(p=>({x:p.x,y:p.y})),bottomFeet:boundary.bottomFeet,topFeet:boundary.topFeet}}:{}),
      ...(fortressServices?{fortressServices}:{}),
      ...(templeWard?{templeWard}:{}),
      ...(access?{doorAccess:{authorizedCreatureIds:[...access.authorizedCreatureIds]}}:{})})
  }
  return result
}
