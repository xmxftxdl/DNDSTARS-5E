import {useEffect,useRef,useState} from 'react'
import {Group,Image as KonvaImage} from 'react-konva'
import type Konva from 'konva'
import type {ContinuousLightRasterInput} from '../../lib/continuousLightRaster'

type Scene=Omit<ContinuousLightRasterInput,'bounds'|'pixelSize'>

/** The current viewport is sampled off-thread. A changed scene cancels the old
 * job, so a late worker result cannot restore a moved or expired light wall. */
export function ContinuousSpellLightMask(props:Scene){
  const node=useRef<Konva.Group>(null)
  const [view,setView]=useState<{bounds:ContinuousLightRasterInput['bounds'];pixelSize:number}>()
  const [mask,setMask]=useState<{canvas:HTMLCanvasElement;key:string;factor:number}>()
  const sceneKey=JSON.stringify(props)
  const jobKey=JSON.stringify([sceneKey,view])
  useEffect(()=>{
    const stage=node.current?.getStage();if(!stage)return
    let frame=0
    const update=()=>{
      const inverse=stage.getAbsoluteTransform().copy().invert()
      const a=inverse.point({x:0,y:0}),b=inverse.point({x:stage.width(),y:stage.height()})
      const x=Math.max(0,Math.min(a.x,b.x)),y=Math.max(0,Math.min(a.y,b.y))
      const right=Math.min(props.map.width,Math.max(a.x,b.x)),bottom=Math.min(props.map.height,Math.max(a.y,b.y))
      const next={bounds:{x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)},pixelSize:1/Math.max(.01,Math.abs(stage.scaleX()))}
      setView(old=>JSON.stringify(old)===JSON.stringify(next)?old:next)
    }
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update)}
    stage.on('xChange.continuousLight yChange.continuousLight scaleXChange.continuousLight scaleYChange.continuousLight widthChange.continuousLight heightChange.continuousLight',schedule)
    update()
    return()=>{cancelAnimationFrame(frame);stage.off('.continuousLight')}
  },[props.map.width,props.map.height])
  useEffect(()=>{
    if(!view?.bounds.width||!view.bounds.height||!props.sources.length)return
    const worker=new Worker(new URL('../../lib/continuousLightRaster.worker.ts',import.meta.url),{type:'module'})
    let active=true
    worker.onmessage=event=>{
      if(!active)return
      const {width,height,rgba,factor,error}=event.data
      if(error){console.error('Continuous light raster failed:',error);return}
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
      const context=canvas.getContext('2d');if(!context)return
      context.putImageData(new ImageData(new Uint8ClampedArray(rgba),width,height),0,0)
      setMask({canvas,key:jobKey,factor})
    }
    worker.postMessage({...props,...view})
    return()=>{active=false;worker.terminate()}
  // The serializable scene key avoids restarting work for identical store snapshots.
  },[jobKey])
  return <Group ref={node} name="continuous-spell-light-mask" listening={false}>
    {view&&mask?.key===jobKey&&<KonvaImage name={`continuous-light-resolution-${mask.factor}`} image={mask.canvas}
      {...view.bounds} globalCompositeOperation="destination-out" listening={false}/>} 
  </Group>
}
