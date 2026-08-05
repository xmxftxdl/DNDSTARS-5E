import DiceRollOverlay, { type DiceRoll } from '../../components/DiceRollOverlay'
import DiceBoxD20Overlay from '../../components/DiceBoxD20Overlay'
import DiceBoxRollOverlay from '../../components/DiceBoxRollOverlay'
import type {
  DiceBoxD20Request,
  DiceBoxRollRequest,
  SharedRollRequestPreview,
} from './useDicePresentation'

export interface DicePresentationOverlaysProps {
  roll: DiceRoll | null
  diceBoxD20: DiceBoxD20Request | null
  diceBoxRoll: DiceBoxRollRequest | null
  rollRequestPreview: SharedRollRequestPreview | null
  onRollDone: () => void
  onD20Complete: (request: DiceBoxD20Request, value: number) => void
  onDiceComplete: (request: DiceBoxRollRequest, values: number[]) => void
  onPreviewComplete: (id: string, delayMs: number) => void
}

/** Highest-layer visual consumers of already-authoritative dice outcomes. */
export default function DicePresentationOverlays(props: DicePresentationOverlaysProps) {
  const { roll, diceBoxD20, diceBoxRoll, rollRequestPreview } = props
  return (
    <>
      {roll && <DiceRollOverlay roll={roll} onDone={props.onRollDone} />}
      {diceBoxD20 && (
        <DiceBoxD20Overlay
          key={`local-d20-${diceBoxD20.id}`}
          active
          label={diceBoxD20.label || 'D20'}
          targetName={diceBoxD20.targetName}
          value={diceBoxD20.value}
          requestId={diceBoxD20.requestKey}
          flyIndex={diceBoxD20.flyIndex}
          onComplete={(value) => props.onD20Complete(diceBoxD20, value)}
        />
      )}
      {diceBoxRoll && (
        <DiceBoxRollOverlay
          key={diceBoxRoll.id}
          count={diceBoxRoll.count}
          sides={diceBoxRoll.sides}
          label={diceBoxRoll.label}
          targetName={diceBoxRoll.targetName}
          values={diceBoxRoll.values}
          requestId={diceBoxRoll.requestKey}
          flyIndex={diceBoxRoll.flyIndex}
          showHud={false}
          onComplete={(values) => props.onDiceComplete(diceBoxRoll, values)}
        />
      )}
      {rollRequestPreview?.kind === 'd20' && (
        <DiceBoxD20Overlay
          key={`rr-d20-${rollRequestPreview.id}`}
          active
          label={rollRequestPreview.label}
          targetName={rollRequestPreview.targetName}
          value={rollRequestPreview.values[0]}
          requestId={rollRequestPreview.id}
          onComplete={() => props.onPreviewComplete(rollRequestPreview.id, 800)}
        />
      )}
      {rollRequestPreview?.kind === 'dice' && (
        <DiceBoxRollOverlay
          key={`rr-dice-${rollRequestPreview.id}`}
          count={rollRequestPreview.count}
          sides={rollRequestPreview.sides}
          label={rollRequestPreview.label}
          targetName={rollRequestPreview.targetName}
          values={rollRequestPreview.values}
          requestId={rollRequestPreview.id}
          showHud={false}
          onComplete={() => props.onPreviewComplete(rollRequestPreview.id, 1500)}
        />
      )}
    </>
  )
}
