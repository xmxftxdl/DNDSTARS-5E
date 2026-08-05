import { Moon, Sun } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { getAppTheme, setAppTheme, subscribeAppTheme } from '../lib/appTheme'

export default function ThemeToggle({
  compact = false,
  className = '',
}: {
  compact?: boolean
  className?: string
}) {
  const theme = useSyncExternalStore(subscribeAppTheme, getAppTheme, getAppTheme)
  const light = theme === 'light'
  const nextTheme = light ? 'dark' : 'light'
  const label = light ? '切换为深色主题' : '切换为浅色主题'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={light}
      data-testid="theme-toggle"
      onClick={() => setAppTheme(nextTheme)}
      className={`theme-toggle inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white ${compact ? 'h-9 w-9 p-0' : 'w-full px-3 py-2.5'} ${className}`}
    >
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {!compact && <span>{light ? '深色主题' : '浅色主题'}</span>}
    </button>
  )
}
