import { expect, test } from '@playwright/test'
interface DiceTestMessage { type: string; requestId?: string; values?: number[]; fallback?: boolean }
declare global { interface Window { diceMessages: DiceTestMessage[] } }

test('player can confirm fire bolt with seven room dice entries', async ({ page }) => {
 page.on('console',msg=>console.log(msg.text()));
 await page.goto('http://127.0.0.1:6373/e2e/fixtures/player-roll-prompt.html',{waitUntil:'commit'})
 await expect(page.getByTestId('player-dice-roll-confirm')).toBeVisible()
 await page.screenshot({path:'test-results/player-roll-prompt.png'})
 await page.getByTestId('player-dice-roll-confirm').click({timeout:5000})
 await expect(page.getByText('已点击投掷')).toBeVisible({timeout:15000})
})

for (const dismissed of [false,true]) test(`DM can confirm attack after ${dismissed?'dismissing room panel':'closing dice dock'}`, async ({page})=>{
 await page.goto('http://127.0.0.1:6373/e2e/fixtures/player-roll-prompt.html?dm',{waitUntil:'commit'})
 if(dismissed){
  await page.getByRole('button',{name:'打开骰盘',exact:true}).click()
  await page.getByRole('button',{name:'关闭并清空已完成的投掷记录'}).click()
 }
 await page.getByRole('button',{name:'收到攻击骰结果'}).click()
 await page.getByTestId('dice-tray-secret-confirm').click({timeout:4000})
 await expect(page.locator('iframe[title="10-sided dice roller"]')).toBeVisible()
 await expect(page.getByText('伤害骰完成：22')).toBeVisible({timeout:15000})
})

for (const count of [4,8]) test(`player throws fire bolt ${count}d10 and returns all damage values`, async ({page})=>{
 await page.goto(`http://127.0.0.1:6373/e2e/fixtures/player-damage.html?count=${count}`,{waitUntil:'commit'})
 await page.getByRole('button',{name:'命中后请求伤害骰'}).click()
 await expect(page.locator('iframe')).toHaveCount(0)
 await page.getByTestId('player-dice-roll-confirm').click()
 await expect(page.locator('iframe[title="10-sided dice roller"]')).toBeVisible()
 await expect(page.getByText(`DM 收到 ${count} 枚伤害骰，总计 ${count*7}`)).toBeVisible({timeout:15000})
})

for (const count of [4,2]) test(`player throws acid arrow ${count}d4 including delayed damage`, async ({page})=>{
 await page.goto(`http://127.0.0.1:6373/e2e/fixtures/player-damage.html?count=${count}&sides=4`,{waitUntil:'commit'})
 await page.getByRole('button',{name:'命中后请求伤害骰'}).click()
 await page.getByTestId('player-dice-roll-confirm').click()
 await expect(page.locator('iframe[title="4-sided dice roller"]')).toBeVisible()
 await expect(page.getByText(`DM 收到 ${count} 枚伤害骰，总计 ${count*4}`)).toBeVisible({timeout:15000})
})
test('DM plays queued free rolls in order after a long pause, including mixed dice', async ({page})=>{
 test.setTimeout(45000)
 await page.goto('http://127.0.0.1:6373/e2e/fixtures/dice-queue.html',{waitUntil:'commit'})
 await page.getByRole('button',{name:'接收三次自由投掷并暂停'}).click()
 await page.waitForTimeout(11000)
 await expect(page.locator('iframe')).toHaveCount(0)
 await page.getByRole('button',{name:'继续队列'}).click()
 await expect(page.getByText('播放顺序：一、二、三',{exact:true})).toBeVisible({timeout:25000})
 await expect(page.getByTestId('dice-tray-secret-confirm')).toHaveCount(0)
 await expect(page.getByTestId('dice-tray-drawer').getByText('1d20 + 1d6',{exact:true}).first()).toBeVisible()
})

for (const [count, sides] of [[1, 20], [4, 10], [2, 4]]) test(`DM animates player ${count}d${sides} with identical faces`, async ({ context, page }) => {
  const dm = await context.newPage()
  await dm.goto(`http://127.0.0.1:6373/e2e/fixtures/player-damage.html?dm=1&count=${count}&sides=${sides}`)
  await page.goto(`http://127.0.0.1:6373/e2e/fixtures/player-damage.html?count=${count}&sides=${sides}`)
  await page.getByRole('button', {name: '命中后请求伤害骰'}).click()
  await page.getByRole('button', {name: '确认并投掷'}).click()
  await expect(dm.locator('iframe')).toBeVisible()
  await expect(page.locator('iframe')).toBeVisible()
  await expect(dm.getByText(`DM mirrored ${Array(count).fill(Math.min(7, sides)).join(',')}`, {exact: true})).toBeVisible({timeout: 15000})
})

test('damage receipt separates visible dice from reduced damage after animation', async ({page}) => {
 await page.goto('http://127.0.0.1:6373/e2e/fixtures/dice-queue.html')
 await page.getByRole('button',{name:'Reduced damage'}).click()
 await expect(page.getByText('播放顺序：reduced-damage')).toBeVisible({timeout:15000})
 await expect(page.getByTestId('dice-damage-breakdown')).toContainText('骰面合计：3 + 2 = 5')
 await expect(page.getByTestId('dice-damage-breakdown')).toContainText('衰弱射线')
 await expect(page.locator('.dice-tray-drawer__total')).toContainText('最终伤害')
 await expect(page.locator('.dice-tray-drawer__total strong')).toHaveText('4')
 await page.screenshot({path:'test-results/dice-damage-breakdown.png'})
})

test('check outcomes show gold hit and shadow save failure', async ({page}) => {
 await page.goto('http://127.0.0.1:6373/e2e/fixtures/dice-queue.html')
 await page.getByRole('button',{name:'Hit outcome'}).click()
 await expect(page.getByTestId('dice-check-outcome')).toHaveClass(/success/)
 await expect(page.getByTestId('dice-check-outcome')).toContainText('命中')
 await page.getByRole('button',{name:'Save failure',exact:true}).click()
 await expect(page.getByTestId('dice-check-outcome')).toHaveClass(/failure/)
 await expect(page.getByTestId('dice-check-outcome')).toContainText('豁免失败')
})

test('confirmation preserves the existing dice iframe', async ({page}) => {
 await page.goto('http://127.0.0.1:6373/e2e/fixtures/dice-queue.html')
 await page.getByRole('button',{name:'Stable confirmation'}).click()
 await expect(page.locator('iframe')).toBeVisible()
 await page.locator('iframe').evaluate((frame: Element & { continuityMarker?: string })=>frame.continuityMarker='original')
 await expect(page.getByTestId('dice-tray-secret-confirm')).toBeVisible({timeout:15000})
 expect(await page.locator('iframe').evaluate((frame: Element & { continuityMarker?: string })=>frame.continuityMarker)).toBe('original')
 await page.getByTestId('dice-tray-secret-confirm').click()
 expect(await page.locator('iframe').evaluate((frame: Element & { continuityMarker?: string })=>frame.continuityMarker)).toBe('original')
 await expect(page.locator('iframe')).toBeVisible()
})

test('hit is visible while DM confirmation is still waiting', async ({page}) => {
 await page.goto('http://127.0.0.1:6373/e2e/fixtures/dice-queue.html')
 await page.getByRole('button',{name:'Waiting hit'}).click()
 await expect(page.getByTestId('dice-tray-secret-confirm')).toBeVisible()
 await expect(page.getByTestId('dice-check-outcome')).toContainText('命中')
})

test('native staged d20 upper faces follow authoritative values through corrections', async ({page}) => {
 await page.addInitScript(()=>{window.diceMessages=[];window.addEventListener('message',e=>window.diceMessages.push(e.data))})
 await page.goto('http://127.0.0.1:6373/dice-box-frame.html?sides=20&qty=1&badge=0')
 await page.waitForFunction(()=>window.diceMessages.some((m)=>m.type==='dice-box-ready'))
 for(const [index,value] of [15,15,12,15,1,20].entries()) {
   const id=`face-${index}`
   await page.evaluate(({id,value,index})=>window.postMessage({type:index===0?'roll-dice':'stage-dice',requestId:id,qty:1,sides:20,values:[value]},location.origin),{id,value,index})
   await page.waitForFunction(id=>window.diceMessages.some((m)=>m.type==='dice-box-roll-result'&&m.requestId===id),id)
   expect(await page.evaluate(id=>window.diceMessages.find((m)=>m.type==='dice-box-roll-result'&&m.requestId===id)?.values,id)).toEqual([value])
 }
})

test('overlapping rolls and DM corrections keep real dice visible and ordered', async ({page}) => {
 const errors:string[]=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
 await page.addInitScript(()=>{window.diceMessages=[];window.addEventListener('message',event=>window.diceMessages.push(event.data))})
 await page.goto('http://127.0.0.1:6373/dice-box-frame.html?sides=20&qty=1&badge=0')
 await page.waitForFunction(()=>window.diceMessages.some((m)=>m.type==='dice-box-ready'))
 const commands=[['first','roll-dice',15],['first-confirm','stage-dice',12],['second','roll-dice',1],['second-confirm','stage-dice',20]] as const
 await page.evaluate(commands=>{
   for(const [requestId,type,value] of commands) window.postMessage({type,requestId,qty:1,sides:20,values:[value]},location.origin)
 },commands)
 await page.waitForFunction(()=>window.diceMessages.some((m)=>m.type==='dice-box-roll-result'&&m.requestId==='second-confirm'))
 const results=await page.evaluate(()=>window.diceMessages.filter((m)=>m.type==='dice-box-roll-result'))
 expect(results.map((m)=>[m.requestId,m.values,m.fallback === true])).toEqual(commands.map(([id,,value])=>[id,[value],false]))
 expect(errors).toEqual([])
 // A visible iframe can contain an empty WebGL canvas. Inspect rendered pixels.
 const screenshot=await page.screenshot({path:'test-results/dice-overlap-visible.png'})
 const purplePixels=await page.evaluate(async base64=>{
   const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode()
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height
   const context=canvas.getContext('2d')!;context.drawImage(image,0,0)
   const pixels=context.getImageData(0,0,canvas.width,canvas.height).data
   let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>45&&pixels[i+2]>pixels[i]*1.15&&pixels[i+2]>pixels[i+1]*1.25)count++
   return count
 },screenshot.toString('base64'))
 expect(purplePixels).toBeGreaterThan(100)
})

test('background completion can enter DM confirmation before physics finishes', async ({page}) => {
 const errors:string[]=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
 await page.goto('http://127.0.0.1:6373/e2e/fixtures/dice-queue.html')
 await page.getByRole('button',{name:'Stable confirmation',exact:true}).click()
 await page.locator('iframe.dice-box-frame--ready').waitFor()
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))})
 await expect(page.getByTestId('dice-tray-secret-confirm')).toBeVisible()
 await page.getByTestId('dice-tray-secret-confirm').click()
 await page.getByRole('button',{name:'Waiting hit',exact:true}).click()
 await expect(page.getByTestId('dice-check-outcome')).toContainText('命中')
 await page.waitForTimeout(6500)
 expect(errors).toEqual([])
 await page.screenshot({path:'test-results/dice-background-confirmation.png'})
})

