
/** Narrow data reader. It issues no capability and never evaluates wire nodes. */
export function bountifulOpportunityMoveSourceFacts(wire){try{
 const object=ref=>{const node=wire.nodes[ref?.ref];if(node?.kind!=='object')throw Error('object');return Object.fromEntries(node.entries)}
 const plain=(value,depth=0)=>{if(depth>100)throw Error('depth');if(value===undefined||value===null||['string','number','boolean'].includes(typeof value))return value;if(value?.undefined===true)return undefined;const node=wire.nodes[value?.ref];if(node?.kind==='array')return node.items.map(item=>plain(item,depth+1));if(node?.kind==='object')return Object.fromEntries(node.entries.map(([key,item])=>[key,plain(item,depth+1)]));throw Error('non-json-fact')}
 const source=object(wire.root),prepared=object(source.prepared),opportunity=object(prepared.opportunity),movement=object(prepared.movement),state=object(prepared.state)
 const combatants=object(state.combatants),turns=Object.fromEntries(Object.entries(combatants).map(([id,value])=>[id,plain(object(value).turn)]))
 return {transactionNow:plain(prepared.transactionNow),turns,initiativeOrder:plain(state.initiativeOrder),initiativeSlotIds:plain(state.initiativeSlotIds),action:plain(prepared.action),map:plain(prepared.map),characters:plain(prepared.characters),movementAction:plain(movement.action),movementMap:plain(movement.map),movementCharacters:plain(movement.characters),attackMap:plain(opportunity.map),attackCharacters:plain(opportunity.characters),actorToken:plain(opportunity.actorToken),targetToken:plain(opportunity.targetToken),mode:plain(prepared.rawMode),combatId:plain(state.combatId),round:plain(state.round),initiativeIndex:plain(state.initiativeIndex)}
 }catch{return null}}
