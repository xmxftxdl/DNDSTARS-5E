import { useEffect, useState, type CSSProperties } from 'react'
import { getImage } from '../../lib/imageStore'
import type { CombatLogEntry } from '../../lib/sharedCombatTypes'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { migrateLegacyApCombatLogText } from '../mapsPageHelpers'
import {
  resolveCombatLogSubject,
  type CombatLogSubjectPresentation,
} from './combatLogPresentation'

function CombatLogSubjectToken({
  subject,
}: {
  subject: CombatLogSubjectPresentation
}) {
  const [loaded, setLoaded] = useState<{ imageId: string; src: string }>()

  useEffect(() => {
    if (!subject.portraitImageId) return
    const imageId = subject.portraitImageId
    let disposed = false
    let objectUrl: string | undefined
    void getImage(imageId).then((blob) => {
      if (!blob || disposed) return
      objectUrl = URL.createObjectURL(blob)
      setLoaded({ imageId, src: objectUrl })
    })
    return () => {
      disposed = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [subject.portraitImageId])

  const sharedSrc =
    subject.portraitImageId && loaded?.imageId === subject.portraitImageId
      ? loaded.src
      : undefined
  const src = sharedSrc ?? subject.portrait
  return (
    <span
      data-testid="combat-log-subject-token"
      data-subject-token-id={subject.token?.id}
      data-subject-side={subject.side}
      data-subject-resolution={subject.resolution}
      data-subject-class-id={subject.classId}
      data-portrait-image-id={subject.portraitImageId}
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-void-950/90 text-lg shadow-lg"
      style={{ borderColor: subject.borderColor }}
      role="img"
      aria-label={`${subject.label} Token`}
      title={subject.label}
    >
      {src
        ? <img src={src} alt="" className="h-full w-full object-cover" />
        : <span aria-hidden="true">{subject.emoji}</span>}
    </span>
  )
}

export interface CombatLogEntryCardProps {
  entry: CombatLogEntry
  tokens: readonly Token[]
  characters: readonly Character[]
  currentTurnTokenId?: string
}

export default function CombatLogEntryCard({
  entry,
  tokens,
  characters,
  currentTurnTokenId,
}: CombatLogEntryCardProps) {
  const subject = resolveCombatLogSubject({
    entry,
    tokens,
    characters,
    currentTurnTokenId,
  })
  const tone =
    entry.kind === 'damage'
      ? 'bg-rose-500/10 text-rose-100'
      : entry.kind === 'attack'
        ? 'bg-sky-500/10 text-sky-100'
        : entry.kind === 'turn'
          ? 'bg-amber-500/10 text-amber-100'
          : 'bg-white/[0.04] text-slate-200'
  const style = {
    '--combat-log-subject-color': subject.borderColor,
    borderColor: subject.borderColor,
    boxShadow: `inset 3px 0 0 ${subject.borderColor}`,
  } as CSSProperties

  return (
    <article
      data-testid={`combat-log-entry-${entry.id}`}
      data-actor-token-id={entry.actorTokenId}
      className={`combat-log-entry-card rounded-lg border px-2 py-1.5 ${tone}`}
      style={style}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2 text-[10px] font-semibold text-slate-400">
            <span className="tabular-nums">R{entry.round}</span>
            <span className="tabular-nums">{entry.time}</span>
            <span className="rounded bg-black/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
              {entry.kind === 'damage'
                ? '结算'
                : entry.kind === 'attack'
                  ? '攻击'
                  : entry.kind === 'turn'
                    ? '回合'
                    : '规则'}
            </span>
          </div>
          <p className="text-xs font-semibold leading-snug">
            {migrateLegacyApCombatLogText(entry.text)}
          </p>
          {entry.details && entry.details.length > 0 && (
            <details className="group mt-2 border-t border-white/10 pt-1.5 text-[11px] leading-relaxed text-slate-300">
              <summary className="cursor-pointer select-none font-semibold text-slate-400 marker:text-slate-500 hover:text-slate-200">
                查看 Headless 结算依据（{entry.details.length}）
              </summary>
              <div className="mt-1.5 space-y-1.5 border-l border-white/10 pl-2">
                {entry.details.map((detail, index) => (
                  <div key={`${entry.id}-detail-${index}`} className="flex gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-current opacity-55"
                    />
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
        <CombatLogSubjectToken subject={subject} />
      </div>
    </article>
  )
}
