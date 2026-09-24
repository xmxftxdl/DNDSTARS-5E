import fs from 'node:fs'
import ts from 'typescript'
const file='src/pages/mapsWorkspaceComposition.tsx'
const source=fs.readFileSync(file,'utf8')
const start=source.indexOf('export const loadEnemyPoolPicker')
const loaderEnd=source.indexOf('\n',start)+1
const runtimeStart=source.indexOf('export const {')
const loader=source.slice(start,loaderEnd)
const runtime=source.slice(runtimeStart)
const imports=source.slice(0,start).replace("import { lazy } from 'react'\n",'')
fs.writeFileSync('src/pages/mapsWorkspaceRuntime.ts',imports+loader+runtime)
fs.writeFileSync(file,"import { lazy } from 'react'\nimport { loadEnemyPoolPicker } from './mapsWorkspaceRuntime'\n"+source.slice(loaderEnd,runtimeStart))
const ast=ts.createSourceFile('runtime.ts',loader+runtime,ts.ScriptTarget.Latest,true)
const names=new Set()
for(const statement of ast.statements) if(ts.isVariableStatement(statement)) for(const declaration of statement.declarationList.declarations) {
  if(ts.isIdentifier(declaration.name)) names.add(declaration.name.text)
  else for(const element of declaration.name.elements) names.add(element.name.getText(ast))
}
const pageFile='src/pages/MapsWorkspacePage.tsx'
let page=fs.readFileSync(pageFile,'utf8')
page=page.replace(/import \{ ([^\n]+) \} from '\.\/mapsWorkspaceComposition'/,(_match,list)=>{
  const all=list.split(', ').map(name=>name.trim())
  return `import { ${all.filter(name=>!names.has(name)).join(', ')} } from './mapsWorkspaceComposition'\nimport { ${all.filter(name=>names.has(name)).join(', ')} } from './mapsWorkspaceRuntime'`
})
fs.writeFileSync(pageFile,page)
const auditFile='scripts/audit-architecture.mjs'
let audit=fs.readFileSync(auditFile,'utf8')
audit=audit.replace("[await source('src/pages/mapsWorkspaceComposition.tsx'), \"from '../composition/browserCombatController'\"", "[await source('src/pages/mapsWorkspaceRuntime.ts'), \"from '../composition/browserCombatController'\"")
fs.writeFileSync(auditFile,audit)
