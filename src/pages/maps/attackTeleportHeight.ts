/** Undefined follows terrain; null cancels the entire attack selection. */
export async function chooseAttackTeleportHeight(
  prompt: (message: string, defaultValue: string) => Promise<string | null>,
): Promise<{ elevationFeet?: number } | null> {
  let message = '攻击前传送：输入落点的绝对高度（尺），留空随地形。空中无支撑时会先结算坠落。'
  for (;;) {
    const value = await prompt(message, '')
    if (value === null) return null
    if (!value.trim()) return {}
    const elevationFeet = Number(value)
    if (Number.isFinite(elevationFeet)) return { elevationFeet }
    message = '请输入有效的高度数值（尺），或留空随地形。'
  }
}
