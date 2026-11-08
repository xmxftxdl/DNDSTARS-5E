import type{resolvePreparedDnd5eSpellCast,dnd5ePreparedSpellAttackModeResolution}from'./spellAction'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
type Source=Parameters<typeof resolvePreparedDnd5eSpellCast>[0]
type ModeResolution=ReturnType<typeof dnd5ePreparedSpellAttackModeResolution>
/** Presentation controls from the actual original collector only. No result,
 * state, events, cost, or opaque permission is stored or recovered here. */
export interface BountifulDamageZeroSpellUi{schemaVersion:1;savingThrowTraceDetails:readonly string[];targetAttackModeResolutions:readonly ModeResolution[]}
export type BountifulDamageZeroSpellUiSource=Source&{hostDamageZeroSpellUi:BountifulDamageZeroSpellUi}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
export function readBountifulDamageZeroSpellUi(source:Source):BountifulDamageZeroSpellUi{const ui=(source as Source&{hostDamageZeroSpellUi?:unknown}).hostDamageZeroSpellUi;if(!record(ui)||Object.keys(ui).some(key=>!['schemaVersion','savingThrowTraceDetails','targetAttackModeResolutions'].includes(key))||ui.schemaVersion!==1||!Array.isArray(ui.savingThrowTraceDetails)||ui.savingThrowTraceDetails.length>10000||ui.savingThrowTraceDetails.some(v=>typeof v!=='string'||v.length>100000)||!Array.isArray(ui.targetAttackModeResolutions)||ui.targetAttackModeResolutions.length>10000||ui.targetAttackModeResolutions.some(v=>!record(v)||!['normal','advantage','disadvantage'].includes(String(v.mode))))throw Error('spell-zero-ui:original-presentation-controls-required');return cloneDnd5eHostTransactionInput(ui)as unknown as BountifulDamageZeroSpellUi}
export function withBountifulDamageZeroSpellUi(source:Source,ui:BountifulDamageZeroSpellUi):BountifulDamageZeroSpellUiSource{const out={...source,hostDamageZeroSpellUi:cloneDnd5eHostTransactionInput(ui)};readBountifulDamageZeroSpellUi(out);return out}
