import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
test('reverse gravity draws a rising area and fades without renderer errors',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-09-10T12:00:00Z'))
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:6373/e2e/fixtures/reverse-gravity.html')
 await page.getByRole('button',{name:'反重力',exact:true}).click()
 await page.clock.setFixedTime(new Date('2026-09-10T12:00:00.700Z'))
 await page.waitForTimeout(100)
 const rising=await page.locator('canvas').evaluate(node=>(node as HTMLCanvasElement).toDataURL())
 writeFileSync('docs/verification/2026-09-10/reverse-gravity.png', Buffer.from(rising.split(',')[1], 'base64'))
 await page.clock.setFixedTime(new Date('2026-09-10T12:00:02Z'))
 await page.waitForTimeout(100)
 const ended=await page.locator('canvas').evaluate(node=>(node as HTMLCanvasElement).toDataURL())
 expect(rising).not.toBe(ended)
 expect(errors).toEqual([])
})
