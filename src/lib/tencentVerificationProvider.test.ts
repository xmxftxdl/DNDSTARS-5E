import { describe, expect, it, vi } from 'vitest'
import {
  buildTencentCloudApiRequest,
  deliverTencentVerification,
  tencentVerificationCapabilities,
} from '../../scripts/tencent-verification-provider.mjs'

const BASE_ENV = {
  STARS_TENCENTCLOUD_EDITION: 'international',
  STARS_TENCENTCLOUD_SECRET_ID: 'AKIDEXAMPLE',
  STARS_TENCENTCLOUD_SECRET_KEY: 'secret-key-for-tests',
}

describe('腾讯云验证码发送适配器', () => {
  it('只有完整配置的渠道才会对注册页开放', () => {
    expect(tencentVerificationCapabilities(BASE_ENV)).toEqual({ email: false, phone: false })
    expect(tencentVerificationCapabilities({
      ...BASE_ENV,
      STARS_TENCENT_SES_FROM_EMAIL: 'Astral Trace <no-reply@mail.astraltracevtt.com>',
      STARS_TENCENT_SES_TEMPLATE_ID: '10001',
    })).toEqual({ email: true, phone: false })
    expect(tencentVerificationCapabilities({
      ...BASE_ENV,
      STARS_TENCENT_SMS_SDK_APP_ID: '2400000000',
      STARS_TENCENT_SMS_TEMPLATE_ID: '20001',
    })).toEqual({ email: false, phone: true })
    expect(tencentVerificationCapabilities({
      ...BASE_ENV,
      STARS_TENCENTCLOUD_EDITION: 'unknown',
      STARS_TENCENT_SES_FROM_EMAIL: 'no-reply@mail.astraltracevtt.com',
      STARS_TENCENT_SES_TEMPLATE_ID: '10001',
    })).toEqual({ email: false, phone: false })
  })

  it('生成固定时间下可复现的 TC3 请求且不把 SecretKey 放入请求', () => {
    const first = buildTencentCloudApiRequest({
      endpoint: 'ses.intl.tencentcloudapi.com',
      service: 'ses',
      action: 'SendEmail',
      version: '2020-10-02',
      region: 'ap-singapore',
      payload: { Destination: ['player@example.com'] },
      secretId: BASE_ENV.STARS_TENCENTCLOUD_SECRET_ID,
      secretKey: BASE_ENV.STARS_TENCENTCLOUD_SECRET_KEY,
      timestamp: 1_700_000_000,
    })
    const second = buildTencentCloudApiRequest({
      endpoint: 'ses.intl.tencentcloudapi.com',
      service: 'ses',
      action: 'SendEmail',
      version: '2020-10-02',
      region: 'ap-singapore',
      payload: { Destination: ['player@example.com'] },
      secretId: BASE_ENV.STARS_TENCENTCLOUD_SECRET_ID,
      secretKey: BASE_ENV.STARS_TENCENTCLOUD_SECRET_KEY,
      timestamp: 1_700_000_000,
    })
    expect(first).toEqual(second)
    expect(first.url).toBe('https://ses.intl.tencentcloudapi.com')
    expect(first.headers.Authorization).toMatch(
      /^TC3-HMAC-SHA256 Credential=AKIDEXAMPLE\/2023-11-14\/ses\/tc3_request,/,
    )
    expect(first.headers.Authorization).toContain('SignedHeaders=content-type;host;x-tc-action')
    expect(JSON.stringify(first)).not.toContain(BASE_ENV.STARS_TENCENTCLOUD_SECRET_KEY)
  })

  it('按审核模板发送邮件验证码', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      Response: { MessageId: 'message-1', RequestId: 'request-1' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await deliverTencentVerification('email', 'player@example.com', '123456', {
      env: {
        ...BASE_ENV,
        STARS_TENCENT_SES_FROM_EMAIL: 'Astral Trace <no-reply@mail.astraltracevtt.com>',
        STARS_TENCENT_SES_TEMPLATE_ID: '10001',
      },
      fetchImpl,
      timestamp: 1_700_000_000,
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://ses.intl.tencentcloudapi.com')
    expect(JSON.parse(String(init?.body))).toMatchObject({
      FromEmailAddress: 'Astral Trace <no-reply@mail.astraltracevtt.com>',
      Destination: ['player@example.com'],
      Template: {
        TemplateID: 10001,
        TemplateData: '{"code":"123456"}',
      },
      TriggerType: 1,
    })
  })

  it('按 Global SMS 模板发送手机号验证码并拒绝业务失败', async () => {
    const env = {
      ...BASE_ENV,
      STARS_TENCENT_SMS_SDK_APP_ID: '2400000000',
      STARS_TENCENT_SMS_TEMPLATE_ID: '20001',
      STARS_TENCENT_SMS_SIGN_NAME: 'Astral Trace',
    }
    const successFetch = vi.fn(async () => new Response(JSON.stringify({
      Response: {
        SendStatusSet: [{ Code: 'Ok', Message: 'send success' }],
        RequestId: 'request-2',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await deliverTencentVerification('phone', '+8613800138000', '654321', {
      env,
      fetchImpl: successFetch,
      timestamp: 1_700_000_000,
    })
    const [, init] = successFetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init?.body))).toMatchObject({
      PhoneNumberSet: ['+8613800138000'],
      SmsSdkAppId: '2400000000',
      TemplateId: '20001',
      TemplateParamSet: ['654321'],
      SignName: 'Astral Trace',
    })

    const rejectedFetch = vi.fn(async () => new Response(JSON.stringify({
      Response: {
        SendStatusSet: [{ Code: 'FailedOperation', Message: 'rejected' }],
        RequestId: 'request-3',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await expect(deliverTencentVerification('phone', '+8613800138000', '654321', {
      env,
      fetchImpl: rejectedFetch,
      timestamp: 1_700_000_000,
    })).rejects.toThrow('tencent-sms-rejected:FailedOperation')
  })
})
