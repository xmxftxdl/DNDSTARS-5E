/** Table rule: one unmodified d20, DC 2, regardless of recipient location. */
export function resolveSendingDeliveryCheck(d20: number) {
  if (!Number.isInteger(d20) || d20 < 1 || d20 > 20) throw new Error('短讯术鉴定需要有效的 20 面骰结果。')
  const success = d20 >= 2
  return { d20, dc: 2, success, log: `讯息发送鉴定：20 面骰 ${d20} vs DC 2，${success ? '讯息发送成功' : '讯息发送失败'}。` }
}
