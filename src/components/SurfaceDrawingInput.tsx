import { useEffect, useRef, useState } from 'react'
import type { SurfaceDrawing } from '../rulesets/dnd5e/surfaceDrawing'

export function SurfaceDrawingInput({onChange}:{onChange:(value:string)=>void}){
  const [strokes,setStrokes]=useState<SurfaceDrawing['strokes']>([])
  const [color,setColor]=useState('#f5deb3'),[width,setWidth]=useState(0.02)
  const active=useRef(false)
  const onChangeRef=useRef(onChange)
  onChangeRef.current=onChange
  useEffect(()=>{onChangeRef.current(strokes.length?JSON.stringify({version:1,strokes}):'')},[strokes])
  const point=(event:React.PointerEvent<SVGSVGElement>)=>{
    const bounds=event.currentTarget.getBoundingClientRect()
    return [Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width)),Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height))].map(n=>Math.round(n*10000)/10000)
  }
  return <div className="space-y-3">
    <div className="flex items-center gap-3">
      <label>颜色 <input aria-label="笔画颜色" type="color" value={color} onChange={e=>setColor(e.target.value)} /></label>
      <label>粗细 <input aria-label="笔画粗细" type="range" min="0.002" max="0.1" step="0.002" value={width} onChange={e=>setWidth(Number(e.target.value))} /></label>
      <button type="button" onClick={()=>setStrokes(s=>s.slice(0,-1))}>撤销</button>
      <button type="button" onClick={()=>setStrokes([])}>清空</button>
    </div>
    <svg aria-label="绘制地表图案" data-testid="surface-drawing-canvas" viewBox="0 0 1 1" className="w-full aspect-square rounded-lg border border-white/20 bg-black/40" style={{touchAction:'none'}}
      onPointerDown={event=>{if(strokes.length>=64||strokes.reduce((n,s)=>n+s.points.length/2,0)>=2047)return;event.currentTarget.setPointerCapture(event.pointerId);active.current=true;const p=point(event);setStrokes(s=>[...s,{points:[...p,...p],color,width}])}}
      onPointerMove={event=>{if(!active.current)return;const p=point(event);setStrokes(s=>{if(!s.length||s.reduce((n,stroke)=>n+stroke.points.length/2,0)>=2048)return s;return s.map((stroke,i)=>i===s.length-1?{...stroke,points:[...stroke.points,...p]}:stroke)})}}
      onPointerUp={()=>{active.current=false}} onPointerCancel={()=>{active.current=false}}>
      {strokes.map((stroke,i)=><polyline key={i} points={stroke.points.reduce((s,n,index)=>s+(index%2?',':' ')+n,'').trim()} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
    <p className="text-xs text-slate-400">拖动绘制图案，可更换颜色、撤销或清空。绘制后点击确认。</p>
  </div>
}
