import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
const root=process.cwd()
const nodes=new Map(), reverse=new Map()
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.(?:ts|tsx|mjs|js)$/.test(e.name)?[path.join(dir,e.name)]:[])}
const all=files(path.join(root,'src'))
function resolve(file,spec){if(!spec.startsWith('.')||spec.includes('?raw'))return;const base=path.resolve(path.dirname(file),spec);return [base,base+'.ts',base+'.tsx',base+'.mjs',base+'.js',path.join(base,'index.ts'),path.join(base,'index.tsx')].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile())}
for(const file of all){
 const text=fs.readFileSync(file,'utf8'), ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true)
 const inputs=new Set(), deps=[]
 function walk(n){
  if(ts.isStringLiteralLike(n)&&/^(?:\.codex-temp|local-content)\/.*\.(?:starmod|json|tsx?|zip|pdf|txt)$/.test(n.text))inputs.add(n.text)
  if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&!n.isTypeOnly&&!n.importClause?.isTypeOnly){const dep=resolve(file,n.moduleSpecifier.text);if(dep)deps.push(dep)}
  ts.forEachChild(n,walk)
 }
 walk(ast);nodes.set(file,inputs)
 for(const dep of deps){const parents=reverse.get(dep)??[];parents.push(file);reverse.set(dep,parents)}
}
const queue=[...nodes].filter(([,s])=>s.size).map(([f])=>f), queued=new Set(queue)
while(queue.length){const file=queue.shift();queued.delete(file);for(const parent of reverse.get(file)??[]){const target=nodes.get(parent), prior=target.size;for(const input of nodes.get(file))target.add(input);if(target.size!==prior&&!queued.has(parent)){queue.push(parent);queued.add(parent)}}}
const manifest=Object.fromEntries([...nodes].filter(([f,s])=>/\.test\.(ts|tsx)$/.test(f)&&s.size).map(([f,s])=>[path.relative(root,f).replaceAll('\\','/'),[...s].sort()]))
fs.writeFileSync('scripts/testing/private-test-inputs.json',JSON.stringify(manifest,null,2)+'\n')
console.log({tests:Object.keys(manifest).length,inputs:new Set(Object.values(manifest).flat()).size})
