import{it,expect}from'vitest'
import{normalizeCharacter}from'../../store/characters'
import type{BattleMap}from'../../store/maps'
import{createDnd5eMapCombatSnapshot}from'./mapBridge'
import{createDnd5eTurnEconomyCounts,spendDnd5eTurnResource}from'./turnEconomy'
import{completeDnd5eCombatStartEconomies}from'../../pages/maps/combatStartEconomies'

function actualStart(){
 const characters=[normalizeCharacter({id:'first',name:'First',charClass:'战士',level:4,currentHp:36,maxHp:36}),normalizeCharacter({id:'next',name:'Next',charClass:'战士',level:4,currentHp:36,maxHp:36})]
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((character,index)=>({id:character.id+'-token',characterId:character.id,label:character.name,x:450+index*100,y:375,size:1,type:'player',dnd5eSide:index?'enemy':'player',hp:36,maxHp:36,color:'',emoji:''}))}
 const initiativeOrder=[{tokenId:'first-token',slotId:'first-extra-slot',label:'First extra',emoji:'',color:'',roll:25},{tokenId:'next-token',slotId:'next-extra-slot',label:'Next',emoji:'',color:'',roll:20},{tokenId:'first-token',slotId:'first-normal-slot',label:'First normal',emoji:'',color:'',roll:15}]
 return{...createDnd5eMapCombatSnapshot({combatId:'combat',round:1,map,characters,initiativeOrder}),initiativeOrder}
}
it('canonical start supplies every real native actor once, using active slot and off-turn actor turn keys',()=>{
 const started=actualStart(),constraints:string[]=[],economies=completeDnd5eCombatStartEconomies({state:started.state,initiativeOrder:started.initiativeOrder,existing:{},constrain:(id,economy)=>{constraints.push(id);return economy}})
 expect(Object.keys(economies).sort()).toEqual(Object.keys(started.state.combatants).sort());expect(Object.keys(economies)).toHaveLength(2);expect(constraints.sort()).toEqual(Object.keys(economies).sort())
 expect(economies['first-token'].turnKey).toBe('combat:1:first-extra-slot');expect(economies['next-token'].turnKey).toBe('combat:1:next-token')
 for(const[id,actor]of Object.entries(started.state.combatants)){expect(economies[id].reaction.current).toBe(actor.turn.reactionAvailable?1:0);expect(economies[id].action.current).toBe(actor.turn.actionAvailable?1:0);expect(economies[id].bonusAction.current).toBe(actor.turn.bonusActionAvailable?1:0);expect(economies[id].movement).toMatchObject({max:actor.speed,current:actor.turn.movementRemaining})}
})
it('canonical missing-row completion preserves every existing spent economy and remains idempotent',()=>{
 const started=actualStart(),spent=spendDnd5eTurnResource(createDnd5eTurnEconomyCounts('combat:1:first-extra-slot',started.state.combatants['first-token'].speed),'reaction');if(!spent.ok)throw Error('Actual available reaction required')
 const existing={'first-token':{...spent.economy,attacksUsed:1,movement:{...spent.economy.movement,current:10,spent:20}}},constrained:string[]=[],complete=completeDnd5eCombatStartEconomies({state:started.state,initiativeOrder:started.initiativeOrder,existing,constrain:(id,economy)=>{constrained.push(id);return economy}})
 expect(complete['first-token']).toBe(existing['first-token']);expect(complete['first-token'].reaction.current).toBe(0);expect(complete['first-token'].attacksUsed).toBe(1);expect(complete['first-token'].movement.current).toBe(10);expect(constrained).toEqual(['next-token'])
 const again=completeDnd5eCombatStartEconomies({state:started.state,initiativeOrder:started.initiativeOrder,existing:complete,constrain:()=>{throw Error('No existing economy may be refreshed')}});for(const id of Object.keys(complete))expect(again[id]).toBe(complete[id])
})
