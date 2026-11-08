/** Exact actual before/proposed browser callback initializers, not substitute producers. */
export const actualProbeProducers={
  "before": "async(parentId:string)=>{const response=await request.post(DM+'/api/state/bountiful-damage-zero-original/probe?room='+created.roomId,{headers,maxRetries:0,data:{mapId,combatId:(await saved('combat')).combatId,parentId}});expect(response.status(),await response.text()).toBe(200);return response.json()}",
  "proposed": "async(parentId:string)=>{const response=await request.post(DM+'/api/state/bountiful-damage-zero-original/probe?room='+created.roomId,{headers:{...headers,'X-Stars-Protocol':'5'},maxRetries:0,data:{mapId,combatId:(await saved('combat')).combatId,parentId}});expect(response.status(),await response.text()).toBe(200);return response.json()}"
} as const
