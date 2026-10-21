export function structureSolidBodyBlocked(
 obstacle:{points:{x:number;y:number}[];baseHeightFeet:number;heightFeet:number},
 from:{x:number;y:number;elevationFeet:number},to:{x:number;y:number;elevationFeet:number},
 halfWidth:number,bodyHeight:number
):boolean;
export function structureSolidBodyHit(
 obstacle:{points:{x:number;y:number}[];baseHeightFeet:number;heightFeet:number},
 from:{x:number;y:number;elevationFeet:number},to:{x:number;y:number;elevationFeet:number},
 halfWidth:number,bodyHeight:number
):number|undefined;
