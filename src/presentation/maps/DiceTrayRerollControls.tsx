import DiceResultValues from './DiceResultValues'
export default function DiceTrayRerollControls({ values, sides, dieSides }: {
  dieSides?: number[]
  values: readonly number[]
  sides: number
  onReroll: (index?: number) => Promise<void>
}) {
  return <DiceResultValues values={values} sides={sides} dieSides={dieSides} />
}
