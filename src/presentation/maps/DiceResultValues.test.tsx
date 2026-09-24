import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import DiceResultValues from './DiceResultValues'

it('keeps the die type visible when equal values come from different dice', () => {
  const html = renderToStaticMarkup(createElement(DiceResultValues, {
    values: [8, 8], sides: 20, dieSides: [8, 20],
  }))
  expect(html).toContain('aria-label="D8：8"')
  expect(html).toContain('aria-label="D20：8"')
  expect(html).toContain('data-die-sides="8"')
  expect(html).toContain('data-die-sides="20"')
})
