import fs from 'node:fs'
import assert from 'node:assert/strict'
const pagePath = 'src/pages/MapsWorkspacePage.tsx'
let page = fs.readFileSync(pagePath, 'utf8')
const start = page.indexOf('const loadEnemyPoolPicker =')
const end = page.indexOf('interface CombatInitiativeConfirmationDraft')
assert(start > 0 && end > start)
const block = page.slice(start, end)
const exported = [...block.matchAll(/^const (\w+)\s*=/gm)].map(match => match[1])
const serviceNames = block.match(/const \{([\s\S]*?)\} = browserSharedRoomService/)[1].split(',').map(s => s.trim()).filter(Boolean)
exported.push(...serviceNames)
const imports = `import { lazy } from 'react'
import { browserSharedRoomService } from '../composition/browserSharedRoomService'
import { browserCombatController } from '../composition/browserCombatController'
import { browserRuntime } from '../adapters/browser/browserRuntime'
import { createBrowserCombatInterruptCoordinator } from '../composition/maps/createBrowserCombatInterruptCoordinator'
import { publishNamedActionPresentation as publishNamedActionPresentationWithRuntime, publishSingleTargetAttackPresentation as publishSingleTargetAttackPresentationWithRuntime } from '../presentation/maps/combatPresentationController'
`
fs.writeFileSync('src/pages/mapsWorkspaceComposition.tsx', imports + block.replace(/^const /gm, 'export const '))
page = page.slice(0, start) + page.slice(end)
page = `import { ${exported.join(', ')} } from './mapsWorkspaceComposition'\n` + page
page = page.replace(/import \{ createBrowserCombatInterruptCoordinator \} from '[^']+'\r?\n/, '')
page = page.replace(/import \{\s*publishNamedActionPresentation as publishNamedActionPresentationWithRuntime,\s*publishSingleTargetAttackPresentation as publishSingleTargetAttackPresentationWithRuntime,\s*\} from '[^']+'\r?\n/, '')
page = page.replace(/\blazy,\s*/, '')
fs.writeFileSync(pagePath, page)

// Pure geometry helpers: unchanged calculations, no combat or pointer state.
const canvasPath = 'src/components/map/MapCanvas.tsx'
let canvas = fs.readFileSync(canvasPath, 'utf8')
const cstart = canvas.indexOf('interface Point {')
const cend = canvas.indexOf('export default function MapCanvas')
assert(cstart > 0 && cend > cstart)
const helpers = canvas.slice(cstart, cend).replace('readonly MapTabletopPoint[]', 'readonly Point[]').replace(/^interface Point/gm, 'export interface Point').replace(/^function /gm, 'export function ')
fs.writeFileSync('src/components/map/mapCanvasGeometry.ts', helpers)
fs.writeFileSync(canvasPath, "import { measurePointsEqual, tabletopLinePoints, type Point } from './mapCanvasGeometry'\n" + canvas.slice(0, cstart) + canvas.slice(cend))

const tokenPath = 'src/components/map/MapTokenNode.tsx'
let token = fs.readFileSync(tokenPath, 'utf8')
const tstart = token.indexOf('function tokenScale(')
const tend = token.indexOf('function rightBadgeSize(')
assert(tstart > 0 && tend > tstart)
fs.writeFileSync('src/components/map/tokenStrokeGeometry.ts', token.slice(tstart, tend).replace(/^function /gm, 'export function '))
fs.writeFileSync(tokenPath, "import { tokenScale, tokenLineWidth, tokenDash } from './tokenStrokeGeometry'\n" + token.slice(0, tstart) + token.slice(tend))
