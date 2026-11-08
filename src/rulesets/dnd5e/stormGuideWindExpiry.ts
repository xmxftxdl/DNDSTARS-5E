import type{Dnd5eActiveEffectInstance}from'./activeEffects'
export const STORM_GUIDE_WIND_EXPIRY_TAG='storm-guide:wind-expiry-second:'
/** Expiry is cleanup data only. Neither a tag nor this reader issues a source,
 * choice, die, owner decision, or commit capability. null means malformed. */
export function readDnd5eStormGuideWindExpiry(effect:Pick<Dnd5eActiveEffectInstance,'definitionId'|'source'|'tags'>):number|null|undefined{
 const entries=effect.tags?.filter(tag=>tag.startsWith(STORM_GUIDE_WIND_EXPIRY_TAG))??[]
 if(!entries.length)return undefined
 if(entries.length!==1||!effect.tags?.includes('storm-guide:wind-control:100')||!effect.source.rulesId||effect.definitionId!=='activity:'+effect.source.rulesId+':storm-guide-wind-direction:marker')return null
 const text=entries[0].slice(STORM_GUIDE_WIND_EXPIRY_TAG.length),value=Number(text)
 return Number.isSafeInteger(value)&&value>=0&&String(value)===text?value:null
}
