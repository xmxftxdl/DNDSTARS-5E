import { parseSurfaceDrawing } from '../surfaceDrawing'
/** Deterministic mixed-language policy: Han characters count individually;
 * other words are separated by whitespace or punctuation (apostrophes retained).
 */
export function countDnd5eActivityTextWords(value: string): number {
  return (value.match(/\p{Script=Han}|[^\p{Script=Han}\s\p{P}\p{S}]+(?:['’][^\p{Script=Han}\s\p{P}\p{S}]+)*/gu) ?? []).length
}
export function validDnd5eActivityTextInput(value: unknown, maximumLength: number, format?: 'hex-color' | 'surface-drawing', maximumWords?: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximumLength &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) &&
    (format !== 'hex-color' || /^#[0-9a-f]{6}$/iu.test(value)) &&
    (format !== 'surface-drawing' || parseSurfaceDrawing(value)!=null) &&
    (maximumWords == null || (Number.isInteger(maximumWords) && maximumWords > 0 &&
      countDnd5eActivityTextWords(value) > 0 && countDnd5eActivityTextWords(value) <= maximumWords))
}
