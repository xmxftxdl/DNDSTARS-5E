import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import RuleChoiceCard from './RuleChoiceCard'

it('keeps detailed rules readable outside the disabled selection button', () => {
  const html = renderToStaticMarkup(createElement(RuleChoiceCard, { name: '测试战技', summary: '简明效果', description: '使用时机\n消耗与限制', selected: false, disabled: true, onClick: () => undefined }))
  expect(html).toContain('disabled=""')
  expect(html.indexOf('<details')).toBeGreaterThan(html.indexOf('</button>'))
  expect(html).toContain('详细规则')
  expect(html).toContain('使用时机\n消耗与限制')
  expect(html).not.toContain('<details open')
})

it('supports old summary-only options without an empty detail control', () => {
  const html = renderToStaticMarkup(createElement(RuleChoiceCard, { name: '旧选项', summary: '摘要', selected: true, disabled: false, onClick: () => undefined }))
  expect(html).toContain('aria-pressed="true"')
  expect(html).not.toContain('<details')
})
