import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import PublicBlogPage from './PublicBlogPage'
import PublicCombatPage from './PublicCombatPage'
import PublicExtensionPage from './PublicExtensionPage'
import PublicLandingPage from './PublicLandingPage'
import PublicPricingPage from './PublicPricingPage'

function renderPage(path: string, page: ReactNode) {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: [path] }, page),
  )
}

describe('产品网站独立页面', () => {
  it('首页只呈现产品内容', () => {
    const html = renderPage('/', createElement(PublicLandingPage))

    expect(html).toContain('data-public-page="product"')
    expect(html).toContain('记录每一场冒险')
    expect(html).toContain('href="/app?auth=login"')
    expect(html).toContain('href="/app?auth=register"')
    expect(html).toContain('扩展市场')
    expect(html).not.toContain('data-public-page="combat"')
    expect(html).not.toContain('房规与内容，以安全扩展交付')
    expect(html).not.toContain('开发日志与跑团实践')
    expect(html).not.toContain('先把冒险跑顺，再决定价格')
  })

  it('战斗页不会渲染其他频道正文', () => {
    const html = renderPage('/combat', createElement(PublicCombatPage))

    expect(html).toContain('data-public-page="combat"')
    expect(html).toContain('规则在后台运行')
    expect(html).not.toContain('房规与内容，以安全扩展交付')
    expect(html).not.toContain('开发日志与跑团实践')
    expect(html).not.toContain('先把冒险跑顺，再决定价格')
  })

  it('扩展页使用单数路径并保持内容隔离', () => {
    const html = renderPage('/extension', createElement(PublicExtensionPage))

    expect(html).toContain('aria-current="page"')
    expect(html).toContain('href="/extension"')
    expect(html).toContain('data-public-page="extension"')
    expect(html).toContain('房规与内容，以安全扩展交付')
    expect(html).not.toContain('规则在后台运行')
    expect(html).not.toContain('开发日志与跑团实践')
  })

  it('博客和价格各自只渲染自己的正文', () => {
    const blogHtml = renderPage('/blog', createElement(PublicBlogPage))
    const pricingHtml = renderPage('/pricing', createElement(PublicPricingPage))

    expect(blogHtml).toContain('data-public-page="blog"')
    expect(blogHtml).toContain('开发日志与跑团实践')
    expect(blogHtml).not.toContain('先把冒险跑顺，再决定价格')
    expect(pricingHtml).toContain('data-public-page="pricing"')
    expect(pricingHtml).toContain('先把冒险跑顺，再决定价格')
    expect(pricingHtml).not.toContain('开发日志与跑团实践')
  })
})
