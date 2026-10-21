/// <reference lib="webworker" />
import {rasterizeContinuousLight,type ContinuousLightRasterInput} from './continuousLightRaster'

self.onmessage=(event:MessageEvent<ContinuousLightRasterInput>)=>{
  // First show a coarse mask, then refine to one display pixel. All passes use
  // the same authority sampler; work never blocks the map's main UI thread.
  try{
    for(const factor of [8,2,1]){
      const result=rasterizeContinuousLight({...event.data,pixelSize:event.data.pixelSize*factor})
      self.postMessage({...result,factor},[result.rgba.buffer])
    }
  }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)})}
}
export {}
