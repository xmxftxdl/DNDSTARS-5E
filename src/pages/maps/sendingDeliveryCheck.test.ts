import { expect, it } from 'vitest'
import { resolveSendingDeliveryCheck } from './sendingDeliveryCheck'
it.each([1, 2, 20])('resolves and logs Sending d20=%s against DC 2', value => {
  const result = resolveSendingDeliveryCheck(value)
  expect(result.success).toBe(value >= 2)
  expect(result.log).toContain(`20 面骰 ${value} vs DC 2`)
  expect(result.log).toContain(value >= 2 ? '发送成功' : '发送失败')
})
it.each([0, 21, NaN, 1.5])('rejects invalid dice %s', value => {
  expect(() => resolveSendingDeliveryCheck(value)).toThrow()
})
