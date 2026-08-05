import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6176'

for (const registration of [
  {
    label: '邮箱',
    channelButton: '邮箱注册',
    destinationPlaceholder: '邮箱地址',
    destination: (suffix: number) => `account-${suffix}@example.com`,
  },
  {
    label: '手机号',
    channelButton: '手机号注册',
    destinationPlaceholder: '手机号（中国号码可直接输入）',
    destination: (suffix: number) => `186${String(suffix).slice(-8).padStart(8, '0')}`,
  },
] as const) {
  test(`${registration.label}验证码注册、退出和新设备重新登录`, async ({ browser }) => {
    const suffix = Date.now() + (registration.label === '邮箱' ? 0 : 1)
    const username = `星痕${registration.label}${String(suffix).slice(-8)}`
    const password = 'Stars!Pass123'
    const destination = registration.destination(suffix)
    const firstContext = await browser.newContext()
    const firstPage = await firstContext.newPage()

    await firstPage.goto(`${DM}/app/extensions`, { waitUntil: 'domcontentloaded' })
    const auth = firstPage.getByTestId('account-identity-panel')
    await auth.getByRole('button', { name: '注册', exact: true }).click()
    await auth.getByRole('button', { name: registration.channelButton }).click()
    await auth.getByPlaceholder(registration.destinationPlaceholder).fill(destination)
    await auth.getByRole('button', { name: '发送验证码' }).click()
    await expect(auth.getByText(/开发环境验证码：\d{6}/)).toBeVisible()
    await expect(auth.getByPlaceholder('6 位验证码')).toHaveValue(/^\d{6}$/)
    await auth.getByPlaceholder('用户名（3～24 个字符）').fill(username)
    await auth.getByPlaceholder(/密码（至少/).fill(password)
    await auth.getByPlaceholder('再次输入密码').fill(password)
    await auth.getByRole('button', { name: '创建账号' }).click()
    await expect(auth.getByText(username, { exact: true })).toBeVisible()

    await firstPage.getByTestId('account-nav-campaigns').click()
    await expect(firstPage).toHaveURL(`${DM}/app`)
    await expect(firstPage.getByTestId('account-nav-extensions')).toBeVisible()
    await firstPage.getByTestId('account-nav-extensions').click()
    await expect(firstPage).toHaveURL(`${DM}/app/extensions`)
    await expect(firstPage.getByTestId('account-nav-extensions')).toHaveAttribute('aria-current', 'page')

    await auth.getByRole('button', { name: '退出' }).click()
    await firstPage.getByTestId('app-dialog-confirm').click()
    await expect(auth.getByRole('button', { name: '登录账号' })).toBeVisible()
    await firstContext.close()

    const secondContext = await browser.newContext()
    const secondPage = await secondContext.newPage()
    await secondPage.goto(`${DM}/app/extensions`, { waitUntil: 'domcontentloaded' })
    const secondAuth = secondPage.getByTestId('account-identity-panel')
    await secondAuth.getByPlaceholder('用户名、邮箱或手机号').fill(destination)
    await secondAuth.getByPlaceholder('密码').fill(password)
    await secondAuth.getByRole('button', { name: '登录账号' }).click()
    await expect(secondAuth.getByText(username, { exact: true })).toBeVisible()
    await secondContext.close()
  })
}
