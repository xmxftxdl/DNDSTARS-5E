export function normalizeSurfaceDrawing(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined
  const raw=value
  if(raw.version!==1||Object.keys(raw).some(key=>key!=='version'&&key!=='strokes')||
    !Array.isArray(raw.strokes)||raw.strokes.length<1||raw.strokes.length>64)return undefined
  let pointsCount=0
  const strokes=[]
  for(const stroke of raw.strokes){
    if(!stroke||typeof stroke!=='object'||Array.isArray(stroke))return undefined
    const s=stroke
    if(Object.keys(s).some(key=>!['points','color','width'].includes(key))||!Array.isArray(s.points)||
      s.points.length<4||s.points.length%2!==0||s.points.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)||
      typeof s.color!=='string'||!/^#[0-9a-f]{6}$/iu.test(s.color)||
      typeof s.width!=='number'||!Number.isFinite(s.width)||s.width<0.002||s.width>0.2)return undefined
    pointsCount+=s.points.length/2
    if(pointsCount>2048)return undefined
    strokes.push({points:[...s.points],color:s.color.toLowerCase(),width:s.width})
  }
  return {version:1,strokes}
}
