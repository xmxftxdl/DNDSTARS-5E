import {parseSurfaceDrawing} from '../rulesets/dnd5e/surfaceDrawing'
export interface PluginChoiceField {
  id: string
  label: string
  kind: 'text' | 'color' | 'surface-drawing' | 'multi-select'
  options?: readonly {id:string;label:string}[]
  required?: boolean
  defaultValue?: string
}

export function readPluginChoiceSelection(field:PluginChoiceField,value:unknown):string[]|undefined{
  const options=field.options
  if(field.kind!=='multi-select'||!Array.isArray(options)||options.length>256||
    options.some(o=>!o||typeof o.id!=='string'||!o.id||o.id.length>160||o.id.trim()!==o.id||typeof o.label!=='string'||!o.label||o.label.length>200)||
    new Set(options.map(o=>o.id)).size!==options.length||typeof value!=='string'||value.length>65536)return undefined
  try{
    const selected:unknown=JSON.parse(value)
    if(!Array.isArray(selected)||selected.length>options.length||new Set(selected).size!==selected.length||
      selected.some(id=>typeof id!=='string'||!options.some(o=>o.id===id))||(field.required&&selected.length===0))return undefined
    return selected as string[]
  }catch{return undefined}
}

/** Values are data only. Unknown keys, oversized strings and invalid colors fail closed. */
export function readPluginChoiceFields(fields: readonly PluginChoiceField[], raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || fields.length > 8) return undefined
  const values = raw as Record<string, unknown>
  const ids = new Set(fields.map(field => field.id))
  if (ids.size !== fields.length || Object.keys(values).some(key => !ids.has(key))) return undefined
  const result: Record<string, string> = Object.create(null)
  for (const field of fields) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(field.id) || !['text', 'color','surface-drawing','multi-select'].includes(field.kind)) return undefined
    if(field.kind==='multi-select'){
      const selected=readPluginChoiceSelection(field,values[field.id]??field.defaultValue??'[]')
      if(!selected)return undefined
      result[field.id]=JSON.stringify(selected)
      continue
    }
    const value = values[field.id] ?? field.defaultValue ?? ''
    if (typeof value !== 'string' || value.length > (field.kind==='surface-drawing'?65536:500)) return undefined
    const trimmed = value.trim()
    if (!trimmed) { if (field.required) return undefined; continue }
    if (field.kind === 'color' && !/^#[0-9a-f]{6}$/i.test(trimmed)) return undefined
    if (field.kind === 'surface-drawing' && !parseSurfaceDrawing(trimmed)) return undefined
    result[field.id] = trimmed
  }
  return result
}
