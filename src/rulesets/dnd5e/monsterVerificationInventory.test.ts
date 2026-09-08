import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DND5E_SRD_MONSTERS } from './monsters'
import { parseDnd5eMonsterStatBlock } from './monsterSchema'
import { auditDnd5eMonsterHeadlessCoverage } from './monsterHeadlessCoverage'

describe('complete monster verification inventory', () => {
  it.each(DND5E_SRD_MONSTERS)('$slug survives the public monster import boundary', (monster) => {
    expect(parseDnd5eMonsterStatBlock(structuredClone(monster)), monster.id).toEqual({ ok: true, value: monster })
  })

  it('exports the exact catalog and structural inventory when explicitly requested', () => {
    const destination = process.env.STARS_MONSTER_INVENTORY_DIR
    if (!destination) return
    const directory = path.resolve(destination)
    const relative = path.relative(process.cwd(), directory)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('inventory destination must be inside repository')
    mkdirSync(directory, { recursive: true })
    writeFileSync(path.join(directory, 'catalog.json'), JSON.stringify(DND5E_SRD_MONSTERS, null, 2))
    writeFileSync(path.join(directory, 'structural-coverage.json'), JSON.stringify(auditDnd5eMonsterHeadlessCoverage(), null, 2))
  })
})
