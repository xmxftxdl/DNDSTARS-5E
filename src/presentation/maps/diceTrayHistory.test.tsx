import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readDiceTrayHistory, writeDiceTrayHistory } from './diceTrayHistory'
import DicePresentationOverlays from './DicePresentationOverlays'

describe('dice tray display recovery', () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal('window', { sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } })
  })
  afterEach(() => vi.unstubAllGlobals())
  const record = { id: 'roll-1', label: '伤害', targetName: '地精', sides: 6, values: [4, 3], total: 9, formula: '2d6+2' }

  it('retains dice and totals across module reload, separately for each room endpoint/map', async () => {
    writeDiceTrayHistory('room:player:map', record, true)
    vi.resetModules()
    const restored = await import('./diceTrayHistory')
    expect(restored.readDiceTrayHistory('room:player:map')).toEqual({ record, open: true })
    expect(restored.readDiceTrayHistory('room:other-player:map')).toBeNull()
    expect(restored.readDiceTrayHistory('other-room:player:map')).toBeNull()
    expect(restored.readDiceTrayHistory('room:player:other-map')).toBeNull()
  })

  it('does not erase the previous dice for an unrolled prompt or unknown physical result', () => {
    writeDiceTrayHistory('scope', record, true)
    writeDiceTrayHistory('scope', { ...record, values: [] }, true)
    expect(readDiceTrayHistory('scope')?.record.values).toEqual([4, 3])
    writeDiceTrayHistory('scope', { ...record, values: [7] }, true)
    expect(readDiceTrayHistory('scope')?.record.values).toEqual([4, 3])
  })

  it('restores the player result and dice world without callbacks or reroll permissions', () => {
    const unsafeRecord = { ...record, sourceRoll: record, resolve: vi.fn() }
    writeDiceTrayHistory('scope', unsafeRecord, true)
    expect(readDiceTrayHistory('scope')?.record).not.toHaveProperty('sourceRoll')
    expect(readDiceTrayHistory('scope')?.record).not.toHaveProperty('resolve')
    const complete = vi.fn()
    const html = renderToStaticMarkup(<DicePresentationOverlays
      historyScope="scope" isDM={false} roll={null} diceBoxD20={null} diceBoxRoll={null}
      rollRequestPreview={null} activeRollStatus={null} secretConfirmation={null}
      onRollDone={complete} onD20Complete={complete} onDiceComplete={complete}
      onPreviewComplete={complete} onSecretConfirm={complete}
    />)
    expect(html).toContain('aria-label="D6：4"')
    expect(html).toContain('aria-label="D6：3"')
    expect(html).toContain('2d6+2')
    expect(html).toContain('<strong>9</strong>')
    expect(html).toContain('6-sided dice roller')
    expect(html).not.toContain('全部重投')
    expect(complete).not.toHaveBeenCalled()
  })

  it('offers the last result to players even when the tray was collapsed', () => {
    writeDiceTrayHistory('scope', record, false)
    const complete = vi.fn()
    const html = renderToStaticMarkup(<DicePresentationOverlays
      historyScope="scope" isDM={false} roll={null} diceBoxD20={null} diceBoxRoll={null}
      rollRequestPreview={null} activeRollStatus={null} secretConfirmation={null}
      onRollDone={complete} onD20Complete={complete} onDiceComplete={complete}
      onPreviewComplete={complete} onSecretConfirm={complete}
    />)
    expect(html).toContain('展开上次掷骰结果，总值 9')
  })
})
