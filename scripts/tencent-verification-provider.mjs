import { createHash, createHmac } from 'node:crypto'

const TENCENT_CLOUD_EDITIONS = {
  international: {
    sesEndpoint: 'ses.intl.tencentcloudapi.com',
    smsEndpoint: 'sms.intl.tencentcloudapi.com',
    defaultSesRegion: 'ap-singapore',
    sesRegions: new Set(['ap-singapore']),
    defaultSmsRegion: 'ap-singapore',
    smsRegions: new Set(['ap-singapore', 'eu-frankfurt']),
  },
  mainland: {
    sesEndpoint: 'ses.tencentcloudapi.com',
    smsEndpoint: 'sms.tencentcloudapi.com',
    defaultSesRegion: 'ap-guangzhou',
    sesRegions: new Set(['ap-guangzhou', 'ap-hongkong']),
    defaultSmsRegion: 'ap-guangzhou',
    smsRegions: new Set(['ap-guangzhou']),
  },
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function positiveInteger(value) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding)
}

function credentialConfig(env) {
  const edition = nonEmpty(env.STARS_TENCENTCLOUD_EDITION)?.toLowerCase()
  const secretId = nonEmpty(env.STARS_TENCENTCLOUD_SECRET_ID)
  const secretKey = nonEmpty(env.STARS_TENCENTCLOUD_SECRET_KEY)
  if (
    !edition ||
    !TENCENT_CLOUD_EDITIONS[edition] ||
    !secretId ||
    !/^AKID[A-Za-z0-9]+$/.test(secretId) ||
    !secretKey ||
    secretKey.length < 16
  ) return null
  return { secretId, secretKey, edition, provider: TENCENT_CLOUD_EDITIONS[edition] }
}

function emailConfig(env) {
  const credentials = credentialConfig(env)
  const fromEmailAddress = nonEmpty(env.STARS_TENCENT_SES_FROM_EMAIL)
  const templateId = positiveInteger(env.STARS_TENCENT_SES_TEMPLATE_ID)
  const region = nonEmpty(env.STARS_TENCENT_SES_REGION) ?? credentials?.provider.defaultSesRegion
  if (
    !credentials ||
    !fromEmailAddress ||
    !/^[^\r\n]*<[^<>\s@]+@[^<>\s@]+>$|^[^<>\s@]+@[^<>\s@]+$/.test(fromEmailAddress) ||
    !templateId ||
    !credentials.provider.sesRegions.has(region)
  ) return null
  return {
    ...credentials,
    fromEmailAddress,
    templateId,
    region,
    subject: nonEmpty(env.STARS_TENCENT_SES_SUBJECT) ?? 'Astral Trace 账号验证码',
  }
}

function smsConfig(env) {
  const credentials = credentialConfig(env)
  const sdkAppId = nonEmpty(env.STARS_TENCENT_SMS_SDK_APP_ID)
  const templateId = nonEmpty(env.STARS_TENCENT_SMS_TEMPLATE_ID)
  const region = nonEmpty(env.STARS_TENCENT_SMS_REGION) ?? credentials?.provider.defaultSmsRegion
  if (
    !credentials ||
    !sdkAppId ||
    !/^\d+$/.test(sdkAppId) ||
    !templateId ||
    !/^\d+$/.test(templateId) ||
    !credentials.provider.smsRegions.has(region)
  ) return null
  return {
    ...credentials,
    sdkAppId,
    templateId,
    region,
    signName: nonEmpty(env.STARS_TENCENT_SMS_SIGN_NAME),
  }
}

export function tencentVerificationCapabilities(env = process.env) {
  return {
    email: Boolean(emailConfig(env)),
    phone: Boolean(smsConfig(env)),
  }
}

export function buildTencentCloudApiRequest({
  endpoint,
  service,
  action,
  version,
  region,
  payload,
  secretId,
  secretKey,
  timestamp = Math.floor(Date.now() / 1000),
}) {
  const contentType = 'application/json; charset=utf-8'
  const body = JSON.stringify(payload)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${endpoint}`,
    `x-tc-action:${action.toLowerCase()}`,
    '',
  ].join('\n')
  const signedHeaders = 'content-type;host;x-tc-action'
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256(body),
  ].join('\n')
  const credentialScope = `${date}/${service}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n')
  const secretDate = hmac(`TC3${secretKey}`, date)
  const secretService = hmac(secretDate, service)
  const secretSigning = hmac(secretService, 'tc3_request')
  const signature = hmac(secretSigning, stringToSign, 'hex')
  const authorization = [
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ')
  return {
    url: `https://${endpoint}`,
    body,
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      Host: endpoint,
      'X-TC-Action': action,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': version,
      ...(region ? { 'X-TC-Region': region } : {}),
    },
  }
}

async function callTencentCloud(input, {
  fetchImpl = fetch,
  timestamp = Math.floor(Date.now() / 1000),
} = {}) {
  const request = buildTencentCloudApiRequest({ ...input, timestamp })
  let response
  try {
    response = await fetchImpl(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new Error('tencent-network-error')
  }
  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('tencent-invalid-response')
  }
  const apiError = result?.Response?.Error
  if (!response.ok || apiError) {
    const code = typeof apiError?.Code === 'string' ? apiError.Code : `http-${response.status}`
    throw new Error(`tencent-api-error:${code}`)
  }
  return result.Response
}

export async function deliverTencentVerification(
  channel,
  destination,
  code,
  {
    env = process.env,
    fetchImpl = fetch,
    timestamp = Math.floor(Date.now() / 1000),
  } = {},
) {
  if (channel === 'email') {
    const config = emailConfig(env)
    if (!config) throw new Error('tencent-email-not-configured')
    await callTencentCloud({
      service: 'ses',
      action: 'SendEmail',
      version: '2020-10-02',
      endpoint: config.provider.sesEndpoint,
      region: config.region,
      secretId: config.secretId,
      secretKey: config.secretKey,
      payload: {
        FromEmailAddress: config.fromEmailAddress,
        Destination: [destination],
        Subject: config.subject,
        Template: {
          TemplateID: config.templateId,
          TemplateData: JSON.stringify({ code }),
        },
        TriggerType: 1,
        Unsubscribe: '0',
      },
    }, { fetchImpl, timestamp })
    return
  }

  if (channel === 'phone') {
    const config = smsConfig(env)
    if (!config) throw new Error('tencent-sms-not-configured')
    const response = await callTencentCloud({
      endpoint: config.provider.smsEndpoint,
      service: 'sms',
      action: 'SendSms',
      version: '2021-01-11',
      region: config.region,
      secretId: config.secretId,
      secretKey: config.secretKey,
      payload: {
        PhoneNumberSet: [destination],
        SmsSdkAppId: config.sdkAppId,
        TemplateId: config.templateId,
        TemplateParamSet: [code],
        ...(config.signName ? { SignName: config.signName } : {}),
      },
    }, { fetchImpl, timestamp })
    const status = response?.SendStatusSet?.[0]
    if (!status || status.Code !== 'Ok') {
      const codeValue = typeof status?.Code === 'string' ? status.Code : 'missing-status'
      throw new Error(`tencent-sms-rejected:${codeValue}`)
    }
    return
  }

  throw new Error('tencent-unsupported-channel')
}
