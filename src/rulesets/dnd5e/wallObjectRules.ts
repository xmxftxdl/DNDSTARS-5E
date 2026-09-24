import type { GridCell } from '../../lib/gridCombat'
import type { StoneWallState, StoneWallPanel } from './stoneWall'
import type { Dnd5ePluginArea } from '../../store/maps'

/** Recover the saved straight-wall footprint without guessing an axis-aligned strip. */
export function iceWallFromCells(cells: readonly GridCell[], feetPerCell = 5, saveDc = 10): StoneWallState | undefined {
  if (!cells.length) return undefined
  const cx=cells.reduce((n,c)=>n+c.col,0)/cells.length,cy=cells.reduce((n,c)=>n+c.row,0)/cells.length
  const xx=cells.reduce((n,c)=>n+(c.col-cx)**2,0),yy=cells.reduce((n,c)=>n+(c.row-cy)**2,0),xy=cells.reduce((n,c)=>n+(c.col-cx)*(c.row-cy),0)
  const angle=Math.atan2(2*xy,xx-yy)/2,ux=Math.cos(angle),uy=Math.sin(angle)
  const projected=cells.map(c=>({cell:c,t:(c.col-cx)*ux+(c.row-cy)*uy}))
  const minimum=Math.min(...projected.map(c=>c.t))-.5,maximum=Math.max(...projected.map(c=>c.t))+.5
  const length=10/Math.max(1,feetPerCell),count=Math.min(10,Math.max(1,Math.ceil((maximum-minimum)/length-1e-6)))
  const panels:StoneWallPanel[]=Array.from({length:count},(_,index)=>{
    const start=minimum+index*length,end=index===count-1?maximum:Math.min(maximum,start+length)
    return {id:`panel-${index+1}`,start:{col:cx+ux*start,row:cy+uy*start},end:{col:cx+ux*end,row:cy+uy*end},
      cells:projected.filter(c=>Math.min(count-1,Math.floor((c.t-minimum)/length))===index).map(c=>({...c.cell})),hitPoints:30,maxHitPoints:30}
  })
  return {mode:'ice',panels,saveDc}
}
export const wallArmorClass = (area: Pick<Dnd5ePluginArea,'coreSpellId'>) => area.coreSpellId==='wall-of-ice'?12:15
export function wallDamageAfterDefenses(area: Pick<Dnd5ePluginArea,'coreSpellId'>, amount:number,type:string):number {
  if(area.coreSpellId==='wall-of-force' || type==='poison' || type==='psychic')return 0
  return Math.max(0,amount)*(area.coreSpellId==='wall-of-ice' && type==='fire'?2:1)
}
