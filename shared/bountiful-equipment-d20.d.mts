import type {BountifulEquipmentD20Receipt} from '../src/rulesets/dnd5e/bountifulEquipmentD20Receipt'
export function validateBountifulEquipmentD20Command(value:unknown):boolean
export function validateBountifulEquipmentD20Receipt(value:unknown,parent?:unknown):value is BountifulEquipmentD20Receipt
export function bountifulEquipmentD20ReceiptComplete(value:BountifulEquipmentD20Receipt):boolean
export function projectBountifulEquipmentD20Prompt(row:unknown,memberId:string):undefined|Record<string,unknown>
