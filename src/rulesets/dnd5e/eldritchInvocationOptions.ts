import type {Character} from '../../types/character'
import type {Dnd5eClassChoiceOption} from './classes'
type Candidate=Pick<Character,'level'|'dnd5eClassChoices'>&Partial<Character>
type Readers={options:()=>readonly Dnd5eClassChoiceOption[];available:(character:Candidate,featureId:string)=>boolean}
const empty:readonly Dnd5eClassChoiceOption[]=Object.freeze([])
let readers:Readers={options:()=>empty,available:()=>false}
/** The actual catalogue installs these readers. No runtime imports, persisted
 * character facts, copied feature lists or client-defined option providers. */
export function setEldritchInvocationReaders(next:Readers){readers=next}
export function registeredEldritchInvocationOptions(){return readers.options()}
export function registeredEldritchInvocationAvailable(character:Candidate,featureId:string){return readers.available(character,featureId)}
