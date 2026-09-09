import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMapReferencePanel } from './MapReferencePanel'
import { Activity, BookOpen, Swords, X } from 'lucide-react'
import { getEnemyStatBlock } from '../../lib/enemyStatBlocks'
import { resolveMapTokenPortrait } from '../../lib/portraitPresentation'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'

export type MapCombatUnitDrawerTab = 'actions' | 'management' | 'stats' | 'status'

interface MapCombatUnitDrawerProps {
  open: boolean
  unitKey?: string
  activeTab: MapCombatUnitDrawerTab
  actionsAvailable: boolean
  managementAvailable?: boolean
  statusAvailable?: boolean
  onTabChange: (tab: MapCombatUnitDrawerTab) => void
  onClose: () => void
  children: ReactNode
}

const TABS = [
  { id: 'actions', label: '行动', icon: Swords },
  { id: 'management', label: '管理', icon: BookOpen },
  { id: 'stats', label: '数据卡', icon: BookOpen },
  { id: 'status', label: '状态', icon: Activity },
] as const

export default function MapCombatUnitDrawer({
  open,
  unitKey,
  activeTab,
  actionsAvailable,
  managementAvailable = false,
  statusAvailable = false,
  onTabChange,
  onClose,
  children,
}: MapCombatUnitDrawerProps) {
  const reference = useMapReferencePanel()
  const shared = reference?.enabled ?? false
  const registerUnit = reference?.registerUnit
  useEffect(() => {
    if (!shared || !registerUnit) return
    registerUnit(open ? unitKey ?? 'selected-unit' : null)
    return () => registerUnit(null)
  }, [shared, registerUnit, open, unitKey])
  if (!open) return null
  const drawer = (
    <aside
      className="map-combat-unit-drawer"
      data-testid="map-combat-unit-drawer"
      aria-label="单位面板"
    >
      <nav className="map-combat-unit-drawer__tabs" aria-label="单位面板页签">
        {TABS.map(({ id, label, icon: Icon }) => {
          if (id === 'management' && !managementAvailable) return null
          if (id === 'status' && !statusAvailable) return null
          const disabled = id === 'actions' && !actionsAvailable
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              data-active={activeTab === id || undefined}
              aria-pressed={activeTab === id}
              onClick={() => onTabChange(id)}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          )
        })}
        <button type="button" className="map-combat-unit-drawer__close" onClick={onClose} aria-label="收起单位面板">
          <X className="h-4 w-4" />
        </button>
      </nav>
      <div className="map-combat-unit-drawer__body">{children}</div>
    </aside>
  )
  return shared ? (reference?.host ? createPortal(drawer, reference.host) : null) : drawer
}

export function MapCombatUnitStatusPanel({
  token,
  character,
  compact = false,
}: {
  token: Token
  character?: Character
  compact?: boolean
}) {
  const currentHp = token.hp ?? character?.currentHp ?? 0
  const maximumHp = token.maxHp ?? character?.maxHp ?? currentHp
  const armorClass = character?.ac ?? (token.poolId ? getEnemyStatBlock(token.poolId)?.ac : undefined)
  const portrait = resolveMapTokenPortrait(character, token)
  const conditions = [...new Set([
    ...(character?.conditions ?? []),
    ...(token.dnd5eCombatState?.conditions ?? []),
  ])]
  const effects = (token.dnd5eCombatState?.activeEffects ?? character?.dnd5eCombatState?.activeEffects ?? [])

  return (
    <section className="map-combat-unit-status" style={compact ? { height: 'auto' } : undefined} data-testid="map-combat-unit-status">
      {!compact && <header>
        <span className="map-combat-unit-status__avatar">
          {portrait
            ? <img src={portrait} alt="" />
            : token.emoji || character?.avatar || '◉'}
        </span>
        <div>
          <h3>{character?.name ?? token.label}</h3>
          <p>HP {currentHp}/{maximumHp}{armorClass != null ? ` · AC ${armorClass}` : ''}</p>
        </div>
      </header>}
      <div className="map-combat-unit-status__content">
        <h4>当前状态</h4>
        {conditions.length > 0 ? (
          <div className="map-combat-unit-status__chips">
            {conditions.map((condition) => <span key={condition}>{condition}</span>)}
          </div>
        ) : <p>没有状态标记</p>}
        <h4>持续效果</h4>
        {effects.length > 0 ? (
          <div className="map-combat-unit-status__effects">
            {effects.map((effect) => (
              <article key={effect.id}>
                <strong>{effect.label || effect.definitionId || '未命名效果'}</strong>
                {effect.suspendedBy?.length ? <span>暂时压制</span> : null}
              </article>
            ))}
          </div>
        ) : <p>没有持续效果</p>}
      </div>
    </section>
  )
}
