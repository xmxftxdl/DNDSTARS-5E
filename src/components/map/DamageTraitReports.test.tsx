import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DamageTraitReports } from './DamageTraitReports'
import type { Dnd5eDamageTraitReceipt } from '../../rulesets/dnd5e/damageTraitReport'

it('renders conditional defenses and identifies the result as a historical observation', () => {
  const receipt: Dnd5eDamageTraitReceipt = {
    sourceActivityId: 'sense', targetId: 'target', targetName: '<Target>', round: 3,
    report: { immunities: ['poison'], resistances: [], vulnerabilities: [],
      conditional: [{ outcome: 'resistant', damageTypes: ['slashing'],
        magical: false, weaponMaterialNot: 'silvered', attackOnly: true }] },
  }
  const html = renderToStaticMarkup(<DamageTraitReports reports={[receipt]} />)
  expect(html).toContain('毒素')
  expect(html).toContain('非魔法伤害')
  expect(html).toContain('非镀银武器')
  expect(html).toContain('不随目标状态自动更新')
  expect(html).toContain('&lt;Target&gt;')
  expect(html).not.toContain('<Target>')
})

it('renders empty defenses without revealing divination protection', () => {
  const html = renderToStaticMarkup(<DamageTraitReports reports={[{
    sourceActivityId: 'sense', targetId: 'target', round: 1,
    report: { immunities: [], resistances: [], vulnerabilities: [], conditional: [] },
  }]} />)
  expect(html).toContain('免疫：无')
  expect(html).toContain('抗性：无')
  expect(html).not.toContain('屏蔽')
})

it('keeps source-scoped resistance conditional after a serialized report is restored', () => {
  const receipt: Dnd5eDamageTraitReceipt={sourceActivityId:'sense',targetId:'target',round:1,
    report:{immunities:[],resistances:[],vulnerabilities:[],conditional:[{outcome:'resistant',sourceCreatureProtection:true}]}}
  const html=renderToStaticMarkup(<DamageTraitReports reports={[JSON.parse(JSON.stringify(receipt))]} />)
  expect(html).toContain('抗性：无')
  expect(html).toContain('所有伤害')
  expect(html).toContain('按来源生物分别生效')
  expect(html).toContain('对防护已失效的生物不适用')
})
