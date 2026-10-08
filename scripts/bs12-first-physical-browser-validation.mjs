import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const pw = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = pw.chromium ?? pw.default.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-first-physical-browser')
mkdirSync(out, { recursive: true })
const records = ['data/candidates/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(file => file.endsWith('.json')).map(file => `data/cards/${file}`)]
  .flatMap(file => JSON.parse(readFileSync(resolve(root, file), 'utf8')).cards ?? [])
const numbers = ['BS12-001', 'BS12-002', 'BS12-003', 'BS12-004', 'BS12-005', 'BS12-006', 'BS12-007', 'BS12-008', 'BS12-009', 'BS12-010', 'BS12-011', 'BS12-012', 'BS12-013', 'BS12-019', 'BS12-024', 'BS12-028', 'BS12-029', 'BS12-030', 'BS12-031', 'BS12-037', 'BS12-046', 'BS12-048', 'BS12-068', 'BS6-017', 'ST4-001']
const art = numbers.map(number => ({ record: records.find(record => record.cardNumber === number), path: resolve(root, `test-results/bs12-official-art/${number}.webp`) }))
for (const item of art) assert.ok(item.record && existsSync(item.path), item.path)
const state = page => page.evaluate(() => Object.fromEntries(['player-one', 'player-two'].map(id => {
  const field = document.querySelector(`.battle-row[data-animation-player="${id}"]`)
  return [id, {
    deck: Number(field.querySelector('.deck-zone .resource-summary > strong').textContent),
    trash: Number(field.querySelector('.discard-zone.resource-summary > strong').textContent),
    hand: Number(field.querySelector('[aria-label^="手牌 "]').getAttribute('aria-label').match(/手牌 (\d+)/)[1]),
    battle: [...field.querySelectorAll('.combat-card-wrap')].map(node => ({ id: node.getAttribute('data-card-instance-id'), hp: Number(node.querySelector('.hp-card-stack').getAttribute('aria-label').match(/HP 卡 (\d+) 張/)[1]) })),
    support: [...field.querySelectorAll('.support-card-wrap')].map(node => ({ id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face').classList.contains('is-rested') })),
  }]
})))
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(row => ({ kind: row.commandKind, summary: row.summary, steps: row.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(button => button.textContent.trim() === '略過目前演出'))
const results = []
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
try {
  for (const number of ['BS12-001', 'BS12-002', 'BS12-003', 'BS12-004']) {
    const flip = ['BS12-002', 'BS12-004'].includes(number)
    for (const scenario of flip ? ['positive', 'negative', 'zero', 'skip'] : ['positive', 'negative', 'cancel']) {
      for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) {
        const page = await browser.newPage({ viewport })
        const row = { number, scenario, viewport, status: 'FAIL', errors: [], networkFailures: [] }
        page.on('pageerror', error => row.errors.push(error.message))
        page.on('console', message => { if (message.type() === 'error') row.errors.push(message.text()) })
        page.on('requestfailed', request => row.networkFailures.push({ url: request.url(), error: request.failure()?.errorText }))
        const shot = suffix => page.screenshot({ path: resolve(out, `${number}-${scenario}-${viewport.width}-${suffix}.png`) })
        try {
          for (const item of art) await page.route(item.record.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(item.path) }))
          row.route = `${scenario === 'negative' ? 'card-negative' : 'card'}:${number}`
          await page.goto(`${process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:4173'}/?test-state=${row.route}&contract-card=${number},BS6-017`)
          await page.locator('.game-shell').waitFor()
          await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
          await settle(page)
          row.before = await state(page)
          if (flip) {
            const modal = page.locator('.flip-response-modal')
            if (number === 'BS12-004' && scenario === 'negative') {
              assert.equal(await modal.count(), 0)
              assert.equal(row.before['player-two'].battle[0].hp, 4)
              assert.equal(row.before['player-one'].hand, 1)
              assert.ok((await trace(page)).every(command => command.kind !== 'resolve-flip'))
              await page.locator('img[alt="Cherry Cookie"]').first().evaluate(image => image.decode())
            } else {
              await modal.waitFor()
              const image = modal.locator('img').filter({ visible: true }).first()
              await image.evaluate(image => image.decode())
              assert.equal(await image.getAttribute('src'), records.find(record => record.cardNumber === number).imageUrl)
              const bounds = await modal.boundingBox()
              assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1)
              if (scenario === 'skip' || scenario === 'negative') {
                if (scenario === 'negative') {
                  assert.equal(row.before['player-one'].hand, 0)
                  assert.equal(await modal.getByRole('button', { name: '發動 FLIP', exact: true }).isEnabled(), false)
                }
                await modal.getByRole('button', { name: '不發動', exact: true }).click()
              } else {
                if (number === 'BS12-002') await modal.getByRole('button', { name: 'Luxury Red Carpet Luxury Red Carpet', exact: true }).click()
                if (scenario !== 'zero') await modal.getByRole('group', { name: 'FLIP 效果目標' }).getByRole('button').filter({ hasText: number === 'BS12-002' ? 'Langue de Chat Cookie' : 'Pink Choco Cookie' }).click()
                await modal.getByRole('button', { name: '發動 FLIP', exact: true }).click()
              }
              await modal.waitFor({ state: 'hidden' }); await settle(page)
              const after = await state(page)
              assert.equal(after['player-one'].battle[0].hp, number === 'BS12-002' && scenario === 'positive' ? 2 : 1)
              assert.equal(after['player-one'].deck, number === 'BS12-002' && scenario === 'positive' ? 9 : 10)
              assert.equal(after['player-two'].battle[0].hp, number === 'BS12-004' && scenario === 'positive' ? 3 : 4)
              assert.equal(after['player-one'].hand, number === 'BS12-002' && ['positive', 'zero', 'negative'].includes(scenario) ? 0 : 1)
              assert.ok((await trace(page)).some(command => command.kind === 'resolve-flip'))
            }
          } else {
            const source = page.locator(`.combat-card-wrap[data-card-instance-id="bs12-${number}-source"]`)
            const image = source.locator('img').first()
            await image.evaluate(image => image.decode())
            assert.equal(await image.getAttribute('src'), records.find(record => record.cardNumber === number).imageUrl)
            if (scenario === 'negative') {
              assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
              assert.deepEqual(await state(page), row.before)
              assert.deepEqual(await trace(page), [])
            } else {
              await source.locator('.card-face.is-attackable').click()
              const payment = page.locator('.battle-row[data-animation-player="player-one"] .support-card-wrap .card-face')
              for (const card of await payment.all()) await card.click()
              if (scenario === 'cancel') {
                await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
                assert.deepEqual(await state(page), row.before); assert.deepEqual(await trace(page), [])
              } else {
                await page.locator('.combat-card-wrap[data-card-instance-id="bs12-attack-opponent"] .card-face[aria-label^="選擇攻擊目標："]').click()
                const hp = number === 'BS12-001' ? 1 : 4
                await page.waitForFunction(hp => document.querySelector('.combat-card-wrap[data-card-instance-id="bs12-attack-opponent"] .hp-card-stack')?.getAttribute('aria-label')?.includes(`HP 卡 ${hp} 張`), hp)
                await settle(page)
                const after = await state(page)
                assert.equal(after['player-two'].battle[0].hp, hp)
                assert.equal(after['player-two'].trash, number === 'BS12-001' ? 4 : 1)
                assert.ok(after['player-one'].support.every(card => card.rested))
                assert.ok((await trace(page)).some(command => command.kind === 'declare-attack'))
              }
            }
          }
          row.after = await state(page); row.trace = await trace(page)
          if (flip) {
            row.phaseBeforeInspection = await page.getByRole('complementary', { name: '回合階段' }).innerText()
            await page.waitForTimeout(1500)
            assert.equal(await page.getByRole('complementary', { name: '回合階段' }).innerText(), row.phaseBeforeInspection)
            assert.deepEqual(await state(page), row.after, 'AI must preserve the physical fixture resources while the user inspects the result')
          }
          if (scenario === 'positive') {
            await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
            const log = page.getByRole('complementary', { name: '對戰紀錄側欄' })
            await log.getByRole('button').filter({ hasText: flip ? 'Pink Choco Cookie' : records.find(record => record.cardNumber === number).name }).first().click()
            row.visiblePublicLog = await log.innerText()
            assert.match(row.visiblePublicLog, /宣告攻擊：/)
            if (number === 'BS12-002') {
              assert.match(row.visiblePublicLog, /FLIP 代價：棄置手牌：Luxury Red Carpet/)
              assert.match(row.visiblePublicLog, /「Langue de Chat Cookie」增加 1 點 HP/)
            }
            if (number === 'BS12-004') assert.match(row.visiblePublicLog, /FLIP 效果結果：已發動「Cherry Cookie」/)
            for (const image of await log.locator('img').all()) await image.evaluate(image => image.decode())
            await shot('public-log')
            await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
          }
          await shot('result')
          assert.deepEqual(row.errors, []); assert.deepEqual(row.networkFailures, [])
          row.status = 'PASS'
        } catch (error) {
          row.error = String(error.stack ?? error); row.dom = await page.locator('body').innerText(); await shot('failed'); throw error
        } finally {
          results.push(row); writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2)); await page.close()
        }
        console.log(`PASS ${number} ${scenario} ${viewport.width}x${viewport.height}`)
      }
    }
  }
  console.log(`Physical BS12 first batch Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
