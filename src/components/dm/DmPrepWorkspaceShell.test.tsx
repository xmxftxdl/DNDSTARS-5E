import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import DmPrepWorkspaceShell from './DmPrepWorkspaceShell'

describe('DmPrepWorkspaceShell', () => {
  it('提供六类备团导航和宽内容区', () => {
    const html = renderToStaticMarkup(
      <DmPrepWorkspaceShell
        activeSection="session"
        onSectionChange={vi.fn()}
      >
        <div>工作区内容</div>
      </DmPrepWorkspaceShell>,
    )

    expect(html).toContain('本次备团')
    expect(html).toContain('剧情')
    expect(html).toContain('世界')
    expect(html).toContain('资源')
    expect(html).toContain('团务复盘')
    expect(html).toContain('导入与复核')
    expect(html).not.toContain('备团就绪度')
    expect(html).toContain('2xl:grid-cols-[13rem_minmax(0,1fr)]')
    expect(html).toContain('工作区内容')
  })
})
