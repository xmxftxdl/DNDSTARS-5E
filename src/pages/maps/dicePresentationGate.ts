export interface SettleAuthoritativeDicePresentationInput {
  authoritativeValues: readonly number[]
  presentation: Promise<readonly number[]>
  maximumWaitMs: number
}

/**
 * 骰子动画只负责表现，不能成为 Headless 权威结算的无限等待点。
 *
 * 骰值在展示开始前已经由 Host 生成；iframe 正常完成时等它完成，
 * iframe 丢失消息或 WebGL 卡住时则在有界时间后继续。无论动画返回
 * 什么内容，规则结算始终使用 Host 已生成的权威骰值。
 */
export async function settleAuthoritativeDicePresentation(
  input: SettleAuthoritativeDicePresentationInput,
): Promise<number[]> {
  const maximumWaitMs = Math.max(0, Math.round(input.maximumWaitMs))
  let timeout: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<void>((resolve) => {
    timeout = setTimeout(resolve, maximumWaitMs)
  })

  try {
    await Promise.race([
      input.presentation.then(() => undefined, () => undefined),
      deadline,
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }

  return [...input.authoritativeValues]
}
