const resources=['characters','maps','combat','player-action-requests','campaign-time','map-geometry','player-action-processed','player-action-ack']as const
type Revisions=Record<string,number>
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
/** Read-only optimistic data. This never mints a Native, raw or publication cap. */
export function readPluginTempestuousPublicationRevisions(value:unknown,expected:{identity:unknown;book:string;parentId:string;effectTimestamp:number}):Revisions{
 if(!record(value)||!record(expected.identity)||Object.keys(value).sort().join('|')!==['ok','sourceKind','parentId','mapId','combatId','timing','roomId','hostMemberId','effectTimestamp','bookSignature','expectedRevisions'].sort().join('|')||value.ok!==true||value.sourceKind!=='tempestuous-plugin-publication-readset-v1'||value.parentId!==expected.parentId||value.effectTimestamp!==expected.effectTimestamp||value.bookSignature!==expected.book)throw Error('plugin-tempestuous-publication:exact-private-source-readset-required')
 const identity=expected.identity,book:unknown=JSON.parse(expected.book);if(!record(book)||!['parentId','mapId','combatId','timing'].every(k=>value[k]===identity[k]&&value[k]===book[k])||value.roomId!==book.roomId||value.hostMemberId!==book.hostMemberId||!record(value.expectedRevisions)||Object.keys(value.expectedRevisions).sort().join('|')!==[...resources].sort().join('|'))throw Error('plugin-tempestuous-publication:exact-identity-required')
 const result:Revisions={};for(const name of resources){const revision=value.expectedRevisions[name];if(typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<0)throw Error('plugin-tempestuous-publication:exact-revision-required');result[name]=revision}return result
}
/** Preserve every existing dependency, including names unknown to this family. */
export function mergePluginTempestuousPublicationRevisions(existing:Revisions|undefined,own:Revisions|undefined):Revisions|undefined{
 if(!own)return existing
 const merged:Revisions={...existing};for(const[name,revision]of Object.entries(own)){if(!Number.isSafeInteger(revision)||revision<0||Object.hasOwn(merged,name)&&merged[name]!==revision)throw Error('plugin-tempestuous-publication:conflicting-revision');merged[name]=revision}return merged
}

