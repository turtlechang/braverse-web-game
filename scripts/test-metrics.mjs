import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const playwrightRoot = process.env.PLAYWRIGHT_NODE_MODULES
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightRoot ? [playwrightRoot] : [root],
})
const playwrightModule = await import(pathToFileURL(playwrightEntry).href)
const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium

const port = 4173
const baseUrl = `http://127.0.0.1:${port}`
const viteEntry = resolve(root, 'node_modules/vite/bin/vite.js')

const server = spawn(
  process.execPath,
  [viteEntry, 'preview', '--host', '127.0.0.1', '--port', String(port)],
  {
    cwd: root,
    stdio: 'ignore',
  },
)

const waitForServer = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {
      // Preview server is still starting.
    }
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, 100),
    )
  }
  throw new Error(`Vite preview 未在 ${baseUrl} 啟動。`)
}

try {
  await waitForServer()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })

  await page.goto(baseUrl, { waitUntil: 'networkidle' })

  // 完成開局設定流程
  const completeOpeningSetup = async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const modal = page.locator('.opening-setup-modal')
      if ((await modal.count()) === 0 || !(await modal.isVisible())) return

      const heading = await modal.locator('h2').innerText()
      if (heading.includes('選擇牌組')) {
        await modal.getByRole('button', { name: /紅色起始牌組/ }).click()
      } else if (heading.includes('猜拳')) {
        await modal.getByRole('button', { name: '石頭' }).click()
      } else if (heading.includes('先攻或後攻')) {
        await modal.getByRole('button', { name: '選擇先攻' }).click()
      } else if (heading.includes('第一次調度')) {
        await modal.getByRole('button', { name: '保留手牌' }).click()
      } else if (heading.includes('起始餅乾')) {
        await modal
          .locator('.modal-card-options > button:not(:disabled)')
          .first()
          .click()
      }
      await page.waitForTimeout(60)
    }
  }

  await completeOpeningSetup()

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1907, height: 868 },
    { width: 1600, height: 900 },
    { width: 1440, height: 960 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    const metrics = await page.evaluate(() => {
      const shell = document.querySelector('.game-shell')
      const bottomField = document.querySelector('.bottom-field')
      const bottomHand = document.querySelector('.bottom-hand')
      const rect = shell.getBoundingClientRect()
      const bottomFieldRect = bottomField.getBoundingClientRect()
      const bottomHandRect = bottomHand.getBoundingClientRect()
      const bottomSupport = document.querySelector(
        '.bottom-field .support-zone',
      )
      const bottomSupportRect = bottomSupport?.getBoundingClientRect()
      return {
        shellBottom: rect.bottom,
        bottomFieldBottom: bottomFieldRect.bottom,
        bottomHandBottom: bottomHandRect.bottom,
        bottomSupportTop: bottomSupportRect?.top ?? 0,
        handAboveSupport:
          bottomSupportRect == null ||
          bottomHandRect.bottom <= bottomSupportRect.top + 1,
      }
    })
    console.log(`Viewport: ${viewport.width}x${viewport.height}`)
    console.log(`  shellBottom:       ${metrics.shellBottom}`)
    console.log(`  bottomFieldBottom: ${metrics.bottomFieldBottom}`)
    console.log(`  bottomHandBottom:  ${metrics.bottomHandBottom}`)
    console.log(`  Field Ok:          ${metrics.bottomFieldBottom <= metrics.shellBottom + 1}`)
    console.log(`  Hand Ok:           ${metrics.bottomHandBottom <= metrics.shellBottom + 1}`)
    console.log(`  Hand above support:${metrics.handAboveSupport} (hand ${metrics.bottomHandBottom}, support top ${metrics.bottomSupportTop})`)
  }

  await browser.close()
} finally {
  server.kill()
}
process.exit(0)
