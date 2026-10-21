import {it,expect,vi} from 'vitest'
import {schemaNeedsJsonObjectMode,openAiStrictJsonSchema,generateStructured} from '../../scripts/local-ai-bridge-core.mjs'
import {normalizeAiStructuredGenerationRequest} from '../../shared/ai-provider.mjs'
it('retains strict schemas for closed extraction and uses JSON mode for open content objects',()=>{
 expect(schemaNeedsJsonObjectMode({type:'object',properties:{content:{type:'object',additionalProperties:true}}})).toBe(true)
 expect(schemaNeedsJsonObjectMode({type:'object',additionalProperties:false,properties:{name:{type:'string'}}})).toBe(false)
 expect(openAiStrictJsonSchema({type:'object',properties:{name:{type:'string'}}})).toMatchObject({required:['name'],additionalProperties:false})
})

it('preserves bounded reasoning controls and sends the schema in JSON object mode', async () => {
 const request={schemaVersion:1 as const,jobId:'test',task:'resource-structuring' as const,systemPrompt:'Return data.',userPrompt:'Convert source.',reasoningEffort:'medium' as const,outputSchema:{type:'object',properties:{content:{type:'object',additionalProperties:true}}}}
 expect(normalizeAiStructuredGenerationRequest(request)).toMatchObject({ok:true,value:{reasoningEffort:'medium'}})
 expect(normalizeAiStructuredGenerationRequest({...request,reasoningEffort:'unbounded'})).toMatchObject({ok:false})
 const fetchMock=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:'{"content":{}}'}}],usage:{prompt_tokens:10,completion_tokens:20}}),{headers:{'Content-Type':'application/json'}}))
 vi.stubGlobal('fetch',fetchMock)
 try {
  await generateStructured({baseUrl:new URL('https://example.invalid/v1'),engine:'external',modelId:'external:gpt-5.6-luna',upstreamModelId:'gpt-5.6-luna',request})
  const body=JSON.parse((fetchMock.mock.calls[0] as unknown as [unknown,{body:string}])[1].body)
  expect(body.reasoning_effort).toBe('medium')
  expect(body.response_format).toEqual({type:'json_object'})
  expect(body.messages[0].content).toContain(JSON.stringify(request.outputSchema))
 } finally {vi.unstubAllGlobals()}
})
