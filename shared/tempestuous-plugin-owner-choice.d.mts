export function tempestuousPluginChoiceKey(id:string):string
export function tempestuousPluginBookSignature(book:unknown):string
export function tempestuousPluginWindowSignature(row:unknown):string
export function tempestuousPluginOwnerWindow(book:unknown,row:unknown):{featureId:string;kind:'use'|'destination'|'height'}|null
export function validTempestuousPluginOwnerResponse(book:unknown,row:unknown,response:unknown):boolean
export function projectTempestuousPluginOwnerChoice(book:unknown,queue:unknown,answers:unknown):{ok:false;error:string}|{ok:true;decision:{kind:'decline'}|{kind:'use';selection:{frameId:string;featureId:string;cell:{col:number;row:number};elevationFeet:number}};interruptIds:string[]}
