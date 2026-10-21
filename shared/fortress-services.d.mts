export interface FortressServant {number:number;tokenId?:string;assignment?:{actorId:string;instruction:string}}
export interface FortressServices {authorizedCreatureIds:string[];mealDay:number;mealsServed:number;mealReceipts:string[];mealTemplateId?:string;servants?:FortressServant[]}
export function normalizeFortressServices(value:unknown):FortressServices|undefined;
export function createFortressServants():FortressServant[];
