import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {createDnd5eMechanicalEffect} from '../../rulesets/dnd5e/activeEffects'
import {settleDnd5eSolidMaterialExit} from '../../rulesets/dnd5e/solidMaterialExitSettlement'
import {planDnd5eMapResultApplication} from '../../rulesets/dnd5e/mapBridge'
import { describe, expect, it, vi } from 'vitest'
import type { BattleMap } from '../../store/maps'
import type { Dnd5eHeadlessCombatState } from '../../rulesets/dnd5e/headlessCombatEngine'
import { createDnd5eMapCombatSnapshot } from '../../rulesets/dnd5e/mapBridge'
import { coordinateDnd5eMovementHazards } from './MovementHazardCoordinator'

describe('coordinateDnd5eMovementHazards', () => {
  it.each([10, -5])('keeps exploration inactive and retains creatures at height %s when rebuilding a stopped movement', async height => {
    const map = {
      id: 'exploration-checkpoint', width: 500, height: 500, gridSize: 50, feetPerCell: 5,
      tokens: ['actor', 'bystander'].map((id, index) => ({
        id, label: id, type: 'enemy', poolId: 'srd-5.1:ogre',
        x: 125 + index * 100, y: 125, size: 1, color: '#000000', emoji: '',
        hp: 59, maxHp: 59, elevationFeet: 0,
      })),
    } as unknown as BattleMap
    const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'exploration:checkpoint',
      round: 1, map, characters: [], initiativeOrder: [],
      additionalCreatureTokenIds: ['actor', 'bystander'] })
    snapshot.state.active = false
    const stoppedMap = { ...map, tokens: map.tokens.map(token => token.id === 'actor'
      ? { ...token, x: 175, elevationFeet: height, hp: 40 } : token) }
    const endpoint = vi.fn(async (settled) => {
      expect(settled.state.active).toBe(false)
      expect(Object.keys(settled.state.combatants).sort()).toEqual(['actor', 'bystander'])
      expect(settled.state.combatants.actor.position).toEqual({ x: 175, y: 125 })
      expect(settled.state.combatants.actor.elevationFeet).toBe(height)
      expect(settled.state.combatants.actor.currentHp).toBe(40)
      return settled
    })
    const result = await coordinateDnd5eMovementHazards({
      state: snapshot.state, map, characters: [], characterIdByCombatantId: {},
      initiativeOrder: [], movements: [{ tokenId: 'actor', to: { x: 225, y: 125 },
        path: [{ x: 125, y: 125 }, { x: 175, y: 125 }, { x: 225, y: 125 }],
        pathElevationsFeet: [0, 10, 20] }],
      settleStep: async () => ({ state: snapshot.state, map: stoppedMap,
        application: { map: stoppedMap, characters: [], changedCharacterIds: [], changedTokenIds: ['actor'] },
        finalPosition: { x: 175, y: 125 }, logs: [] }),
      settleEndpoint: endpoint,
    })
    expect(endpoint).toHaveBeenCalledOnce()
    expect(result.state.active).toBe(false)
    expect(result.completedPathsByCombatantId.actor).toEqual([{ x: 125, y: 125 }, { x: 175, y: 125 }])
  })

  it('filters missing tokens and preserves an unchanged authority snapshot', async () => {
    const map = {
      id: 'map-1',
      tokens: [],
    } as unknown as BattleMap
    const state = {
      combatId: 'combat-1',
      round: 1,
      turnSlotId: 'slot-1',
      initiativeIndex: 0,
      initiativeOrder: [],
      combatants: {},
    } as unknown as Dnd5eHeadlessCombatState
    const settleStep = vi.fn()

    const result = await coordinateDnd5eMovementHazards({
      state,
      map,
      characters: [],
      characterIdByCombatantId: {},
      movements: [{ tokenId: 'missing', to: { x: 1, y: 1 }, path: [{ x: 1, y: 1 }] }],
      initiativeOrder: [],
      settleStep,
    })

    expect(settleStep).not.toHaveBeenCalled()
    expect(result.state).toBe(state)
    expect(result.map).toBe(map)
    expect(result.logs).toEqual([])
    expect(result.finalPositionByCombatantId).toEqual({})
    expect(result.application).toEqual({
      map,
      characters: [],
      changedCharacterIds: [],
      changedTokenIds: [],
    })
  })

  it('does not resurrect pruned Activity extra-turn slots while refreshing movement hazards', async () => {
    const map = {
      id: 'map-time-stop',
      width: 500,
      height: 500,
      gridSize: 50,
      feetPerCell: 5,
      tokens: [
        {
          id: 'actor', label: '施法者', type: 'enemy', poolId: 'srd-5.1:ogre',
          x: 50, y: 50, size: 1, color: '#000', emoji: '🧙', hp: 59, maxHp: 59,
        },
        {
          id: 'other', label: '其他生物', type: 'enemy', poolId: 'srd-5.1:ogre',
          x: 200, y: 50, size: 1, color: '#000', emoji: '👹', hp: 59, maxHp: 59,
        },
      ],
    } as unknown as BattleMap
    const initiativeOrder = [
      { slotId: 'actor:normal', tokenId: 'actor', label: '施法者', emoji: '🧙', color: '#000', roll: 20 },
      { slotId: 'time-stop:1', tokenId: 'actor', label: '施法者', emoji: '🧙', color: '#000', roll: 20, turnKind: 'activity-extra-turn' as const },
      { slotId: 'time-stop:2', tokenId: 'actor', label: '施法者', emoji: '🧙', color: '#000', roll: 20, turnKind: 'activity-extra-turn' as const },
      { slotId: 'other:normal', tokenId: 'other', label: '其他生物', emoji: '👹', color: '#000', roll: 10 },
    ]
    const snapshot = createDnd5eMapCombatSnapshot({
      combatId: 'combat-time-stop',
      round: 1,
      turnSlotId: 'time-stop:1',
      map,
      characters: [],
      initiativeOrder,
    })
    snapshot.state.companionScene!.worldMinute = 99
    const prunedState = structuredClone(snapshot.state)
    prunedState.initiativeOrder = ['actor', 'actor', 'other']
    prunedState.initiativeSlotIds = ['actor:normal', 'time-stop:1', 'other:normal']
    prunedState.oneShotInitiativeSlotIds = ['time-stop:1']
    prunedState.initiativeIndex = 1

    const result = await coordinateDnd5eMovementHazards({
      state: snapshot.state,
      map,
      characters: [],
      characterIdByCombatantId: {},
      movements: [{ tokenId: 'actor', to: { x: 100, y: 50 }, path: [{ x: 50, y: 50 }, { x: 100, y: 50 }] }],
      initiativeOrder,
      settleStep: async () => ({
        state: prunedState,
        map,
        application: {
          map,
          characters: [],
          changedCharacterIds: [],
          changedTokenIds: [],
        },
        finalPosition: { x: 100, y: 50 },
        logs: [],
      }),
    })

    expect(result.state.initiativeSlotIds).toEqual([
      'actor:normal',
      'time-stop:1',
      'other:normal',
    ])
    expect(result.state.oneShotInitiativeSlotIds).toEqual(['time-stop:1'])
    expect(result.state.initiativeIndex).toBe(1)
    expect(result.state.companionScene?.worldMinute).toBe(99)
  })
})

it.each([true, false])('settles solid-material exit after the actual hazard endpoint (stopped=%s)', async stopped => {
  const map = {id:'solid-hazard',name:'Map',width:250,height:150,gridSize:50,feetPerCell:5,
    gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'actor',type:'enemy',poolId:'srd-5.1:goblin',
      label:'Actor',x:25,y:75,size:1,color:'',emoji:'',hp:30,maxHp:30}]} as BattleMap
  const initiativeOrder=[{tokenId:'actor',label:'Actor',emoji:'',color:'',roll:20}]
  const snapshot=createDnd5eMapCombatSnapshot({map,characters:[],combatId:'solid-hazard',initiativeOrder})
  const actor=snapshot.state.combatants.actor
  actor.concentrating=true
  actor.classState.concentrationSpellId='test:stone'
  actor.classState.activeEffects=[createDnd5eMechanicalEffect({definitionId:'test:stone',label:'Stone',targetId:'actor',
    source:{kind:'spell',actorId:'actor',rulesId:'test:stone'},duration:{type:'concentration',sourceActorId:'actor',remainingRounds:100},
    modifiers:{solidMaterialTraversal:{materials:['stone'],endInside:'eject-end-source-stun-until-next-turn-end'}}})]
  actor.position={x:125,y:75}
  const geometry=createEmptyMapGeometry(map.id,1)
  geometry.obstacles.push({id:'rock',kind:'obstacle',label:'Rock',surfaceMaterial:'stone',
    points:[{x:100,y:50},{x:150,y:50},{x:150,y:100},{x:100,y:100}],baseHeightFeet:0,heightFeet:10,
    blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,cover:'total',createdAt:1})
  const phases:string[]=[]
  const result=await coordinateDnd5eMovementHazards({state:snapshot.state,map,characters:[],characterIdByCombatantId:{},initiativeOrder,
    movements:[{tokenId:'actor',to:{x:125,y:75},path:[{x:25,y:75},{x:75,y:75},{x:125,y:75}]}],
    settleStep:async input=>{
      phases.push('hazard')
      expect(input.state.combatants.actor.concentrating).toBe(true)
      expect(input.state.combatants.actor.conditions).not.toContain('stunned')
      const state=structuredClone(input.state)
      state.combatants.actor.position={x:stopped?75:125,y:75}
      state.combatants.actor.currentHp=20
      const application=planDnd5eMapResultApplication({state,map,characters:[],characterIdByCombatantId:{},events:[]})
      return {state:input.state,map:application.map,application,finalPosition:state.combatants.actor.position,logs:[]}
    },
    settleEndpoint:async (settled,movement)=>{
      phases.push('endpoint')
      expect(settled.state.combatants.actor.currentHp).toBe(20)
      expect(settled.state.combatants.actor.position).toEqual({x:stopped?75:125,y:75})
      const exit=settleDnd5eSolidMaterialExit({state:settled.state,map:settled.map,geometry,actorId:movement.tokenId})
      if(!exit.ok)throw new Error(exit.reason)
      const application=planDnd5eMapResultApplication({state:exit.state,map:settled.map,characters:[],characterIdByCombatantId:{},events:exit.events})
      return {...settled,state:exit.state,map:application.map,application,finalPosition:exit.state.combatants.actor.position}
    },
  })
  expect(phases).toEqual(['hazard','endpoint'])
  expect(result.state.combatants.actor.concentrating).toBe(stopped)
  expect(result.state.combatants.actor.conditions.includes('stunned')).toBe(!stopped)
  expect(result.finalPositionByCombatantId.actor).not.toEqual({x:125,y:75})
  expect(result.application.map.tokens[0].x).toBe(result.finalPositionByCombatantId.actor.x)
  expect(result.completedPathsByCombatantId.actor.some(point => point.x === 125 && point.y === 75)).toBe(!stopped)
  expect(result.completedPathsByCombatantId.actor.at(-1)).toEqual(result.finalPositionByCombatantId.actor)
})

it('finishes both carried traces before a group endpoint displacement and retains both return paths', async () => {
  const map = { id:'group',name:'Map',width:250,height:250,gridSize:50,feetPerCell:5,
    gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:['carrier','carried'].map((id,index)=>({
      id,type:'enemy',poolId:'srd-5.1:goblin',label:id,x:25,y:25+index*50,size:1,color:'',emoji:'',hp:7,maxHp:7,
    })) } as BattleMap
  const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.id,emoji:'',color:'',roll:20-index}))
  const {state}=createDnd5eMapCombatSnapshot({map,characters:[],combatId:'group',initiativeOrder})
  const phases:string[]=[]
  const movements=map.tokens.map(token=>({tokenId:token.id,to:{x:125,y:token.y},
    path:[{x:25,y:token.y},{x:75,y:token.y},{x:125,y:token.y}]}))
  const result=await coordinateDnd5eMovementHazards({state,map,characters:[],characterIdByCombatantId:{},initiativeOrder,movements,
    settleStep:async input=>{
      phases.push('path:'+input.token.id)
      const application=planDnd5eMapResultApplication({state:input.state,map:input.map,characters:[],characterIdByCombatantId:{},events:[]})
      return {state:input.state,map:application.map,application,logs:[],finalPosition:input.movement.to}
    },
    settleEndpoint:async (settled,movement)=>{
      phases.push('end:'+movement.tokenId)
      const state=structuredClone(settled.state)
      if(movement.tokenId==='carrier'){
        expect(state.combatants.carried.position.x).toBe(125)
        state.combatants.carrier.position.x=75
        state.combatants.carried.position.x=75
      }
      const application=planDnd5eMapResultApplication({state,map:settled.map,characters:[],characterIdByCombatantId:{},events:[]})
      return {...settled,state,map:application.map,application,finalPosition:state.combatants[movement.tokenId].position}
    },
  })
  expect(phases).toEqual(['path:carrier','path:carried','end:carrier','end:carried'])
  for(const token of map.tokens){
    expect(result.finalPositionByCombatantId[token.id]).toEqual({x:75,y:token.y})
    expect(result.completedPathsByCombatantId[token.id].map(point=>point.x)).toEqual([25,75,125,75])
    expect(result.application.map.tokens.find(value=>value.id===token.id)?.x).toBe(75)
  }
})
