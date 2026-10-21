import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {isDnd5eFirstOwnCombatTurn} from './firstOwnCombatTurn'
it('retains the actual first own turn across late arrival, JSON reload, later turns and a new encounter',()=>{
 const make=(id:string)=>createDnd5eCombatant({id,name:id,controller:'player',initiative:id==='hero'?20:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:10,proficiencyBonus:2,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const initial=startDnd5eHeadlessCombat('late-arrival',[make('hero'),make('other')]);initial.round=3
 const first=resolveDnd5eHeadlessAction(initial,{type:'begin-turn',actorId:'hero'})
 expect(first.ok).toBe(true)
 const marker=first.state.combatants.hero.classState.firstOwnCombatTurn!
 expect(marker.combatId).toBe('late-arrival');expect(marker.turnKey).toContain(':3:')
 expect(initial.combatants.hero.classState.firstOwnCombatTurn).toBeUndefined()
 const replay=resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(first.state)),{type:'begin-turn',actorId:'hero'})
 expect(replay.ok).toBe(true);expect(replay.state.combatants.hero.classState.firstOwnCombatTurn).toEqual(marker)
 const next=JSON.parse(JSON.stringify(replay.state));next.round=4
 const later=resolveDnd5eHeadlessAction(next,{type:'begin-turn',actorId:'hero'})
 expect(later.ok).toBe(true);expect(later.state.combatants.hero.classState.firstOwnCombatTurn).toEqual(marker)
 expect(isDnd5eFirstOwnCombatTurn(later.state.combatants.hero.classState,'late-arrival',later.state.combatants.hero.classState.turnStartResolvedTurnKey!)).toBe(false)
 const fresh=JSON.parse(JSON.stringify(later.state));fresh.combatId='next-encounter';fresh.round=1
 const restarted=resolveDnd5eHeadlessAction(fresh,{type:'begin-turn',actorId:'hero'})
 expect(restarted.ok).toBe(true);expect(restarted.state.combatants.hero.classState.firstOwnCombatTurn?.combatId).toBe('next-encounter')
 expect(isDnd5eFirstOwnCombatTurn(restarted.state.combatants.hero.classState,'next-encounter',restarted.state.combatants.hero.classState.turnStartResolvedTurnKey!)).toBe(true)
})

it('persists first own turn through the actual map result and JSON snapshot path', async()=>{
 const {normalizeCharacter}=await import('../../store/characters')
 const {createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication}=await import('./mapBridge')
 const characters=['hero','other'].map(id=>normalizeCharacter({id,name:id,charClass:'战士',level:1,maxHp:20,currentHp:20}))
 const map={id:'first-turn-map',name:'Test',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:characters.map((c,i)=>({id:c.id+'-token',label:c.name,characterId:c.id,type:'player' as const,x:25+i*50,y:25,size:1,color:'',emoji:''}))}
 const order=map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:t.emoji,color:t.color,roll:20-i}))
 const snapshot=createDnd5eMapCombatSnapshot({combatId:'map-first',round:3,map,characters,initiativeOrder:order})
 const result=resolveDnd5eHeadlessAction(snapshot.state,{type:'begin-turn',actorId:'hero-token'})
 expect(result.ok).toBe(true)
 const marker=result.state.combatants['hero-token'].classState.firstOwnCombatTurn
 const application=planDnd5eMapResultApplication({state:result.state,map,characters,characterIdByCombatantId:snapshot.characterIdByCombatantId,events:[...result.events]})
 expect(application.characters.find(c=>c.id==='hero')?.dnd5eCombatState?.firstOwnCombatTurn).toEqual(marker)
 const saved=JSON.parse(JSON.stringify({map:application.map,characters:application.characters}))
 const restored=createDnd5eMapCombatSnapshot({combatId:'map-first',round:4,map:saved.map,characters:saved.characters,initiativeOrder:order})
 expect(restored.state.combatants['hero-token'].classState.firstOwnCombatTurn).toEqual(marker)
 const next=resolveDnd5eHeadlessAction(restored.state,{type:'begin-turn',actorId:'hero-token'})
 expect(next.ok).toBe(true);expect(next.state.combatants['hero-token'].classState.firstOwnCombatTurn).toEqual(marker)
})
