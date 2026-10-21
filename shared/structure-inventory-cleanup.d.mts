import type {Character} from '../src/types/character';
export function expireStructureInventoryItems(character:Character,expired:readonly {mapId:string;structureId:string}[]):Character;
