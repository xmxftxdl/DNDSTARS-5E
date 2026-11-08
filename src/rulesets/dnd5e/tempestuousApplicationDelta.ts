import type{BattleMap,Token}from'../../store/maps'
import type{Character}from'../../types/character'
import type{Dnd5eMapResultPlan}from'./mapBridge'
const fact=(value:unknown):string=>value===undefined?'undefined':value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(fact).join(',')+']':'{'+Object.entries(value as Record<string,unknown>).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>JSON.stringify(key)+':'+fact(v)).join(',')+'}'
function delta<T extends object>(before:T|undefined,after:T):Partial<T>{const changed:Partial<T>={};for(const key of new Set([...Object.keys(before??{}),...Object.keys(after)])){const field=key as keyof T;if(fact(before?.[field])!==fact(after[field]))changed[field]=after[field]}return changed}
/** Pure rebasing only: the actual completed map/characters, areas, geometry and
 * reactions are retained. No effect, inventory cost or movement is replayed. */
export function rebaseTempestuousSpellApplication(input:{map:BattleMap;characters:readonly Character[];application:Dnd5eMapResultPlan}):Dnd5eMapResultPlan{
 const {application}=input,tokenPatches:Record<string,Partial<Token>>={},characterPatches:Record<string,Partial<Character>>={},changedTokenIds:string[]=[],changedCharacterIds:string[]=[]
 const oldTokens=new Map(input.map.tokens.map(token=>[token.id,token])),oldCharacters=new Map(input.characters.map(character=>[character.id,character]))
 for(const token of application.map.tokens){const patch=delta(oldTokens.get(token.id),token);if(Object.keys(patch).length){tokenPatches[token.id]=patch;changedTokenIds.push(token.id)}oldTokens.delete(token.id)}
 changedTokenIds.push(...oldTokens.keys())
 for(const character of application.characters){const patch=delta(oldCharacters.get(character.id),character);if(Object.keys(patch).length){characterPatches[character.id]=patch;changedCharacterIds.push(character.id)}oldCharacters.delete(character.id)}
 changedCharacterIds.push(...oldCharacters.keys())
 return{...application,changedTokenIds,changedCharacterIds,tokenPatches,characterPatches}
}
