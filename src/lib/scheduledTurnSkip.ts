/** Release a cancelled, unstarted skip so a replacement effect can schedule it again. */
export function scheduleTurnSkip(keys:Set<string>,key:string,run:()=>void,delay=50):()=>void {
  if(keys.has(key))return ()=>{}
  keys.add(key)
  let started=false
  const timer=setTimeout(()=>{started=true;run()},delay)
  return ()=>{
    clearTimeout(timer)
    if(!started)keys.delete(key)
  }
}
