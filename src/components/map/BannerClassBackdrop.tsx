import { Dnd5eClassBackdrop } from './Dnd5eActionIcon'

interface BannerClassBackdropProps {
  classId: string
  color: string
  glow: string
}

export default function BannerClassBackdrop({
  classId,
  color,
  glow,
}: BannerClassBackdropProps) {
  return (
    <div
      className="combat-banner-class-backdrop"
      data-combat-class-backdrop={classId}
      aria-hidden="true"
    >
      <svg
        className="combat-banner-class-backdrop__main"
        viewBox="0 0 80 80"
        role="presentation"
      >
        <Dnd5eClassBackdrop classId={classId} color={color} glow={glow} />
      </svg>
      {classId === 'wizard' ? (
        <>
          {(['left', 'right'] as const).map((position) => (
            <svg
              className={`combat-banner-class-backdrop__mini combat-banner-class-backdrop__mini--${position}`}
              viewBox="0 0 80 80"
              role="presentation"
              data-combat-mini-sigil={position}
              key={position}
            >
              <Dnd5eClassBackdrop classId={classId} color={color} glow={glow} />
            </svg>
          ))}
        </>
      ) : null}
      {classId === 'bard' ? (
        <div className="combat-banner-class-backdrop__bard-notes">
          {(['left', 'right'] as const).flatMap((side) => (
            [
              <span
                className={`combat-banner-class-backdrop__bard-note combat-banner-class-backdrop__bard-note--${side}-primary`}
                key={`${side}-primary`}
              >
                🎵
              </span>,
              <span
                className={`combat-banner-class-backdrop__bard-note combat-banner-class-backdrop__bard-note--${side}-secondary`}
                key={`${side}-secondary`}
              >
                ♪
              </span>,
            ]
          ))}
        </div>
      ) : null}
    </div>
  )
}
