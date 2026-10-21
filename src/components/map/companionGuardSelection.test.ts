import { expect, it, vi } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { requestCompanionGuardSelections } from './companionGuardSelection'

const map: BattleMap = { id:'map',name:'Map',width:600,height:400,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:['a','b'].map(id=>({id,label:id,x:25,y:25,size:1,type:'enemy',emoji:'',color:''} as Token)) }
const base={map,operationIds:['guard'],recipientIds:['a','b'],isCurrent:()=>true}

it('uses both selected cells, including reversed corners, for one group rectangle',async()=>{
  const chooseCorner=vi.fn(async (_token:Token,corner:1|2)=>corner===1?{x:225,y:175}:{x:75,y:25})
  expect(await requestCompanionGuardSelections({...base,chooseCorner})).toEqual({guard:{mapId:'map',minX:50,minY:0,maxX:250,maxY:200}})
  expect(chooseCorner).toHaveBeenCalledTimes(2)
})
it('allows a single-cell region when both selected corners are the same cell',async()=>{
  expect(await requestCompanionGuardSelections({...base,chooseCorner:async()=>({x:25,y:25})}))
    .toEqual({guard:{mapId:'map',minX:0,minY:0,maxX:50,maxY:50}})
})
it.each(['cancel','context-change','outside-map','nonfinite'] as const)('abandons the selection on %s',async failure=>{
  let current=true
  expect(await requestCompanionGuardSelections({...base,isCurrent:()=>current,chooseCorner:async(_token,corner)=>{
    if(corner===1)return {x:25,y:25}
    if(failure==='context-change')current=false
    return failure==='cancel'?undefined:{x:failure==='outside-map'?625:failure==='nonfinite'?NaN:75,y:25}
  }})).toBeNull()
})
it('does not prompt for a missing recipient',async()=>{
  const chooseCorner=vi.fn(async()=>({x:25,y:25}))
  expect(await requestCompanionGuardSelections({...base,recipientIds:['missing'],chooseCorner})).toBeNull()
  expect(chooseCorner).not.toHaveBeenCalled()
})
it('rejects a region too narrow for a selected creature',async()=>{
  const large=structuredClone(map)
  large.tokens[1].size=2
  expect(await requestCompanionGuardSelections({...base,map:large,chooseCorner:async()=>({x:25,y:25})})).toBeNull()
})
