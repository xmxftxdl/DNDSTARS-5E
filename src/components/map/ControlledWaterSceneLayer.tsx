import {Group,Line,Text} from 'react-konva'
import {useEffect,useRef} from 'react'
import Konva from 'konva'
import {projectDnd5eControlledWater} from '../../rulesets/dnd5e/controlledWater'
import type {ControlledFlameSceneInput} from './ControlledFlameSceneLayer'
import type {Token} from '../../store/maps'
import {playerVisibleCanvasTokens} from './playerTokenVisibility'

function AnimatedWaterDrawing({marker,pixelsPerFoot}:{marker:ReturnType<typeof controlledWaterSceneMarkers>[number];pixelsPerFoot:number}){
 const ref=useRef<Konva.Group>(null),frame=marker.drawingFrameFeet
 useEffect(()=>{
  const node=ref.current;if(!node||!frame)return
  node.position({x:0,y:0});if(marker.frozen)return
  const animation=new Konva.Animation(()=>{
   node.x(Math.sin(Date.now()/650)*frame.width*pixelsPerFoot*0.025)
   node.y(Math.cos(Date.now()/850)*frame.height*pixelsPerFoot*0.025)
  },node.getLayer())
  animation.start();return()=>{animation.stop()}
 },[frame?.x,frame?.y,frame?.width,frame?.height,pixelsPerFoot,marker.frozen])
 if(!frame||!marker.drawing)return null
 return <Group name="controlled-water-shape-clip" listening={false} clipFunc={context=>{
  context.beginPath();context.moveTo(marker.points[0],marker.points[1]);for(let i=2;i<marker.points.length;i+=2)context.lineTo(marker.points[i],marker.points[i+1]);context.closePath()
 }}><Group ref={ref} name="controlled-water-shape-motion" listening={false}>
  {marker.drawing.strokes.map((stroke,i)=><Line key={i} name="controlled-water-shape-stroke"
   points={stroke.points.map((v,j)=>(j%2?frame.y+v*frame.height:frame.x+v*frame.width)*pixelsPerFoot)}
   stroke={stroke.color} strokeWidth={stroke.width*Math.min(frame.width,frame.height)*pixelsPerFoot}
   opacity={marker.opacity} lineCap="round" lineJoin="round" listening={false}/>)}
 </Group></Group>
}

export function controlledWaterSceneMarkers(input:ControlledFlameSceneInput){
 return (input.geometry?.obstacles??[]).flatMap(body=>{
  if(!body.controlledWater||body.points.length<3)return []
  const appearance=projectDnd5eControlledWater(body.controlledWater,input.worldMinute)
  const x=body.points.reduce((sum,p)=>sum+p.x,0)/body.points.length
  const y=body.points.reduce((sum,p)=>sum+p.y,0)/body.points.length
  const marker:Token={id:`controlled-water:${body.id}`,type:'obstacle',label:'',emoji:'',color:appearance.color,
   x,y,elevationFeet:body.baseHeightFeet+body.heightFeet,size:1}
  if(!input.isDM&&!playerVisibleCanvasTokens({...input,map:{...input.map,tokens:[...input.map.tokens,marker]}}).some(token=>token.id===marker.id))return []
  return [{id:body.id,x,y,points:body.points.flatMap(p=>[p.x,p.y]),...appearance}]
 })
}

/** Uses original polygon coordinates; expiry projects base water without rewriting the saved scene. */
export function ControlledWaterSceneLayer(input:ControlledFlameSceneInput&{inv:number}){
 return <Group name="controlled-water-surfaces" listening={false}>
  {controlledWaterSceneMarkers(input).map(marker=><Group key={marker.id} listening={false}>
   <Line name={marker.frozen?'controlled-water-ice':'controlled-water-liquid'} points={marker.points} closed
    fill={marker.color} opacity={marker.opacity} stroke={marker.frozen?'#e0f7ff':marker.color}
    strokeWidth={(marker.frozen?2:0.5)*input.inv} listening={false}/>
   {marker.frozen&&<Line name="controlled-water-ice-edge" points={marker.points} closed stroke="#e0f7ff"
    strokeWidth={2*input.inv} dash={[5*input.inv,3*input.inv]} opacity={0.8} listening={false}/>}
   {marker.drawing&&marker.drawingFrameFeet&&<AnimatedWaterDrawing marker={marker} pixelsPerFoot={input.map.gridSize/(input.map.feetPerCell??5)}/>}
   {marker.shape&&<Text name="controlled-water-shape-description" x={marker.x} y={marker.y} text={marker.shape}
    width={140*input.inv} fontSize={12*input.inv} fill="#e0f7ff" stroke="#082f49" strokeWidth={2*input.inv}
    fillAfterStrokeEnabled listening={false}/>}
  </Group>)}
 </Group>
}
