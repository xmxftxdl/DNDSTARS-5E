import { expect, it } from 'vitest'
import { createMultipartCreature } from './multipartCreature'
import { multipartTokenHeadProjections } from './multipartMapGeometry'
import { tokensInCells } from '../../lib/skillTargeting'
import type { BattleMap, Token } from '../../store/maps'

it('selects the same creature once for disjoint heads and neck intersections', () => {
  const parts = createMultipartCreature({x:2.5,y:2.5,z:0})
  parts.heads[0].position = {x:22.5,y:2.5,z:0}
  parts.heads[1].position = {x:2.5,y:22.5,z:0}
  const token: Token = {id:'hydra',label:'Hydra',type:'enemy',x:25,y:25,size:1,emoji:'',color:'',dnd5eCombatState:{monsterMultipart:parts}}
  const map: BattleMap = {id:'map',name:'Map',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token]}
  expect(tokensInCells(map,[token],[{col:4,row:0},{col:0,row:4}]).map(t=>t.id)).toEqual(['hydra'])
  expect(tokensInCells(map,[token],[{col:2,row:0}]).map(t=>t.id)).toEqual(['hydra'])
  token.x += 50
  expect(multipartTokenHeadProjections(token,map)[0].x).toBe(275)
  parts.heads[0].alive=false
  expect(tokensInCells(map,[token],[{col:5,row:0}])).toEqual([])
})
