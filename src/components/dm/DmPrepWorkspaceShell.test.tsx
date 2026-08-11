import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import DmPrepWorkspaceShell from './DmPrepWorkspaceShell'

describe('DmPrepWorkspaceShell', () => {
  it('提供五类备团导航、保存状态和就绪度', () => {
    const html = renderToStaticMarkup(
      <DmPrepWorkspaceShell
        activeSection="session"
        onSectionChange={vi.fn()}
        saveStatus="dirty"
        readiness={63}
        taskCount={2}
      >
        <div>工作区内容</div>
      </DmPrepWorkspaceShell>,
    )

    expect(html).toContain('本次备团')
    expect(html).toContain('剧情')
    expect(html).toContain('世界')
    expect(html).toContain('资源')
    expect(html).toContain('团务复盘')
    expect(html).toContain('有修改等待自动保存')
    expect(html).toContain('63%')
    expect(html).toContain('工作区内容')
  })
})
