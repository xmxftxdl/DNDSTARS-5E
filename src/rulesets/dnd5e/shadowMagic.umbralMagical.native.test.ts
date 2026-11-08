import { expect, it } from 'vitest'
import { nativeUmbralFixture } from './shadowMagic.umbral.native.fixture'
import { umbralFeatureId } from './shadowMagic.umbralSource.native.fixture'
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from './pluginFeatureAction'

it('the actual native18 magically transformed form marks every saved traversal/resistance instance magical',async()=>{
  const f=await nativeUmbralFixture('human','legacy',18)
  try {
    const map={...f.map(),tokens:[...f.map().tokens].reverse()},order=map.tokens.map((token:any,i:number)=>({tokenId:token.id,label:token.label,roll:20-i,color:'',emoji:''}))
    const prepared=prepareDnd5ePluginFeatureAction({map,characters:f.characters(),initiativeOrder:order,action:{id:'actual-umbral-magical-source',mapId:map.id,
      combatId:'umbral-magical',sourceMode:'player',status:'pending',type:'dnd5e-plugin-action',actorTokenId:'soul-token',characterId:f.soul().id,targetTokenId:'soul-token',
      round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5ePluginAction:{featureId:umbralFeatureId,payload:{selectedActivityId:'umbral-form'}}}})
    expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
    const used=await resolvePreparedDnd5ePluginFeatureAction({prepared:prepared.prepared,combatRevision:1,rolls:{}})
    expect(used.result.ok).toBe(true);if(!used.result.ok)throw Error(used.result.reason)
    const effects=used.result.state.combatants['soul-token'].classState.activeEffects!.filter(effect=>effect.modifiers?.objectCreatureTraversal || effect.modifiers?.damageResistance)
    expect(effects.length).toBeGreaterThanOrEqual(11)
    expect(effects.every(effect=>effect.source.magical===true)).toBe(true)
  }finally{f.dispose()}
})
