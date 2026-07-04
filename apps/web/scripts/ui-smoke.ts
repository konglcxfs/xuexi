/**
 * 通过 Chrome DevTools Protocol（CDP）做端到端 UI 测试 + 截图。
 * 不依赖 playwright/puppeteer，直接用 Node 内置的 ws + http。
 *
 * 这里只做一个最简流程：登录 → 进入仪表盘 → 截图保存到 artifacts/。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { setTimeout as wait } from 'node:timers/promises'
import { WebSocket } from 'ws'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ART = path.resolve(process.cwd(), 'artifacts')
fs.mkdirSync(ART, { recursive: true })

const userDataDir = path.join(ART, '.chrome-profile')

function startChrome() {
  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--remote-debugging-port=9333',
      `--user-data-dir=${userDataDir}`,
      '--window-size=1280,900',
    ],
    { detached: true, stdio: 'ignore' }
  )
  proc.unref()
  return proc
}

async function getJson<T = unknown>(port: number, path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')))
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

async function waitForChrome(port = 9333, maxMs = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    try {
      const v = await getJson<{ webSocketDebuggerUrl?: string }>(port, '/json/version')
      if (v.webSocketDebuggerUrl) return v
    } catch {
      /* not yet */
    }
    await wait(300)
  }
  throw new Error('Chrome did not start in time')
}

class CDP {
  private ws!: WebSocket
  private id = 0
  private pending = new Map<number, (v: any) => void>()
  constructor(private url: string) {}
  async connect() {
    this.ws = new WebSocket(this.url)
    await new Promise<void>((r, e) => {
      this.ws.once('open', () => r())
      this.ws.once('error', e)
    })
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString('utf-8'))
      if (msg.id && this.pending.has(msg.id)) {
        const cb = this.pending.get(msg.id)!
        this.pending.delete(msg.id)
        if (msg.error) cb({ error: msg.error })
        else cb({ result: msg.result })
      }
    })
  }
  send(method: string, params: Record<string, unknown> = {}): Promise<{ result: any }> {
    const id = ++this.id
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async eval(expression: string, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
    })
    return r.result?.result?.value
  }
}

async function main() {
  startChrome()
  const v = await waitForChrome()
  console.log('Chrome', v.Browser)

  // 等浏览器列出可创建的 target
  let newTab: any = null
  for (let i = 0; i < 30; i++) {
    const list = await getJson<any[]>(9333, '/json/list')
    // 找 "about:blank" 或 page type 的 target，然后导航；否则 PUT 新建
    let page = list.find((t) => t.type === 'page')
    if (page) {
      newTab = page
      break
    }
    await wait(300)
  }
  if (!newTab) throw new Error('no page target')
  console.log('use target:', newTab.title, newTab.url)

  const cdp = new CDP(newTab.webSocketDebuggerUrl)
  await cdp.connect()

  // 导航到登录页
  await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/login' })
  await wait(2000)

  // 填写昵称
  await cdp.eval(`document.querySelector('input').focus()`)
  await cdp.eval(
    `(()=>{const i=document.querySelector('input');const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(i,'小明');i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`
  )
  // 选小学生（默认）
  await wait(200)
  // 点进入按钮
  await cdp.eval(
    `document.querySelectorAll('button').forEach(b=>{if(b.textContent.includes('进入'))b.click()})`
  )
  await wait(2500)

  // 截图：仪表盘
  await cdp.send('Page.enable')
  const shot1 = await cdp.send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(ART, '01-dashboard.png'), Buffer.from(shot1.result.data, 'base64'))
  console.log('✓ 仪表盘截图已保存')

  // 跳转到薄弱点
  await cdp.eval(`history.pushState({},'','/weakness');window.dispatchEvent(new PopStateEvent('popstate'))`)
  await wait(800)
  // 跑诊断
  await cdp.eval(
    `document.querySelectorAll('button').forEach(b=>{if(b.textContent.includes('立即诊断'))b.click()})`
  )
  await wait(1800)
  const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(ART, '02-weakness.png'), Buffer.from(shot2.result.data, 'base64'))
  console.log('✓ 薄弱点截图已保存')

  // 跳转到计划
  await cdp.eval(`history.pushState({},'','/plan');window.dispatchEvent(new PopStateEvent('popstate'))`)
  await wait(800)
  await cdp.eval(
    `(async()=>{const inp=document.querySelector('input');const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(inp,'两周搞定四年级乘法');inp.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,200));document.querySelectorAll('button').forEach(b=>{if(b.textContent.includes('生成计划'))b.click()});})()`
  )
  await wait(2000)
  const shot3 = await cdp.send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(ART, '03-plan.png'), Buffer.from(shot3.result.data, 'base64'))
  console.log('✓ 计划截图已保存')

  // 跳转到知识图谱
  await cdp.eval(`history.pushState({},'','/graph');window.dispatchEvent(new PopStateEvent('popstate'))`)
  await wait(1500)
  const shot4 = await cdp.send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(ART, '04-graph.png'), Buffer.from(shot4.result.data, 'base64'))
  console.log('✓ 知识图谱截图已保存')

  // 跳转到聊天
  await cdp.eval(`history.pushState({},'','/chat');window.dispatchEvent(new PopStateEvent('popstate'))`)
  await wait(1000)
  const shot5 = await cdp.send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(ART, '05-chat.png'), Buffer.from(shot5.result.data, 'base64'))
  console.log('✓ AI 对话截图已保存')

  // 关闭 Chrome
  await cdp.send('Browser.close')
  console.log('\n所有截图保存在:', ART)
}

main().catch((e) => {
  console.error('UI 测试失败:', e)
  process.exit(1)
})
