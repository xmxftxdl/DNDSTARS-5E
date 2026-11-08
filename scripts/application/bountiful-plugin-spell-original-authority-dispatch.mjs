import {authenticatedBountifulPluginSpellSavingOriginal,preflightBountifulPluginSpellSavingOriginalCommandAppend,readBountifulPluginSpellSavingOriginalForCommandAppend} from './bountiful-plugin-spell-saving-original-authority.mjs'
import {authenticatedBountifulPluginSpellCompoundPrimaryOriginal,preflightBountifulPluginSpellCompoundPrimaryCommandAppend,readBountifulPluginSpellCompoundPrimaryOriginalForCommandAppend} from './bountiful-plugin-spell-compound-primary-original-authority.mjs'

async function primary(ctx,row,api){
 const id=row?.rawIssuer?.rollId
 if(typeof id!=='string'||!/^bountiful-plugin-spell-saving-original:[a-f0-9]{64}$/.test(id))return false
 const pointer=await api.load(ctx,'plugin-spell-saving-original-request:'+id)
 return pointer?.roomId===ctx.roomId&&pointer.poolKind==='primary'
}

/** Private index discrimination, never a caller-selected family or prefix-only
 * permission. Each selected family still performs its full independent checks. */
export async function authenticatedBountifulPluginSpellSavingOrPrimaryOriginal(ctx,row,principal,api){
 return await primary(ctx,row,api)?authenticatedBountifulPluginSpellCompoundPrimaryOriginal(ctx,row,principal,api):authenticatedBountifulPluginSpellSavingOriginal(ctx,row,principal,api)
}

async function commandRow(ctx,action,api){
 const scope=action?.bountifulLuck
 if(!scope)return undefined
 const d=await api.context(ctx)
 return d.combat?.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',scope.parentId,scope.occurrence])]
}

export async function preflightBountifulPluginSpellSavingOrPrimaryCommandAppend(ctx,action,principal,api){
 return await primary(ctx,await commandRow(ctx,action,api),api)?preflightBountifulPluginSpellCompoundPrimaryCommandAppend(ctx,action,principal,api):preflightBountifulPluginSpellSavingOriginalCommandAppend(ctx,action,principal,api)
}

export async function readBountifulPluginSpellSavingOrPrimaryForCommandAppend(ctx,action,principal,api){
 return await primary(ctx,await commandRow(ctx,action,api),api)?readBountifulPluginSpellCompoundPrimaryOriginalForCommandAppend(ctx,action,principal,api):readBountifulPluginSpellSavingOriginalForCommandAppend(ctx,action,principal,api)
}
