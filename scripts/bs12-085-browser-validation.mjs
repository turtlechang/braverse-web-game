import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-085-browser')
mkdirSync(out, { recursive: true })
const candidate=JSON.parse(readFileSync(resolve(root,'data/cards/official-festival-arena-bs12.en.json'),'utf8')).cards
const formal=readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards=[...candidate,...formal].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'), hand: field?.querySelectorAll('.hand-card').length ?? 0,
      break: field?.querySelector('.break-zone .break-summary')?.getAttribute('title'),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'), rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const blocked = ['wrong-energy', 'rested-energy', 'no-energy', 'opponent-turn', 'outside-main', 'dj-no-hand']
const cases = ['positive', 'four', 'six', 'zero', 'wrong-zones', ...blocked, 'short-deck', 'spare-energy', 'cancel-payment', 'deselect-payment', 'reopen', 'cancel-confirm', 'minimize', 'details', 'dj-four-blocker', 'dj-four-non-blocker', 'dj-five', 'dj-cancel', 'dj-deselect', 'dj-limit']
const route = scenario => scenario.startsWith('dj-four-') || ['dj-cancel', 'dj-deselect', 'dj-limit'].includes(scenario) ? 'dj-four' : ['cancel-payment', 'deselect-payment', 'reopen', 'cancel-confirm', 'minimize', 'details'].includes(scenario) ? 'positive' : scenario
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-085', scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, request => request.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      result.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='positive'?'card:'+'BS12-085':process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='four'?'card-negative:'+'BS12-085':'bs12-085:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card='+cards.map(card=>card.cardNumber).join(','))
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      result.before = await state(page)
      assert.ok(result.before.bottom.battle.length <= 2 && result.before.top.battle.length <= 2)
      const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-085-item"]')
      await hand.locator('button.card-face').click()
      const use = hand.getByRole('button', { name: '使用', exact: true })
      const dialog = () => page.getByRole('alertdialog')
      if (scenario === 'details') {
        await hand.getByRole('button', { name: '詳情', exact: true }).click()
        const detail = page.getByRole('dialog', { name: 'Rainbow Headphones 卡牌詳情', exact: true })
        assert.match(await detail.innerText(), /5 Cookies.*Blocker.*return all cards.*shuffle/s)
        assert.equal(await detail.locator('img[alt="Rainbow Headphones"]').getAttribute('src'), cards.find(card=>card.cardNumber==='BS12-085').imageUrl)
        await detail.getByRole('button', { name: '關閉', exact: true }).click()
        assert.deepEqual(await state(page), result.before)
      } else if (blocked.includes(scenario)) {
        assert.ok(await use.count() === 0 || !await use.isEnabled())
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await use.click()
        const dj = scenario.startsWith('dj-')
        const nextName = '確認發動'
        assert.equal(await dialog().getByRole('button', { name: nextName, exact: true }).isEnabled(), false)
        await dialog().locator('.effect-candidates-payment button').first().click()
        if (scenario === 'deselect-payment') {
          await dialog().locator('.effect-candidates-payment button').first().click()
          assert.equal(await dialog().getByRole('button', { name: nextName, exact: true }).isEnabled(), false)
          await dialog().locator('.effect-candidates-payment button').first().click()
        }
        assert.match(await dialog().innerText(), /至少有 5 張具有 Blocker.*包含本牌/s)
        assert.equal(await dialog().locator('.effect-candidates-target button').count(), 0)
        if (scenario === 'reopen') {
          await dialog().getByRole('button', { name: '取消技能', exact: true }).click()
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
          await hand.locator('button.card-face').click()
          await use.click()
          assert.equal(await dialog().getByRole('button', { name: '確認發動', exact: true }).isEnabled(), false)
          await dialog().locator('.effect-candidates-payment button').first().click()
        }
        if (scenario === 'minimize') {
          await dialog().getByRole('button', { name: '縮小', exact: true }).click()
          await page.getByRole('button', { name: 'Rainbow Headphones 使用物品', exact: true }).click()
          assert.match(await dialog().innerText(), /已選 1／1/)
        }
        await shot('confirmation')
        if (['cancel-payment', 'cancel-confirm'].includes(scenario)) {
          await dialog().getByRole('button', { name: '取消技能', exact: true }).click()
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
        } else {
          await dialog().getByRole('button', { name: nextName, exact: true }).click()
          if (dj) {
            assert.deepEqual(await state(page), result.before)
            if (scenario === 'dj-cancel') {
              await dialog().getByRole('button', { name: '取消使用道具', exact: true }).click()
              assert.deepEqual(await state(page), result.before)
              assert.deepEqual((await trace(page)).map(entry => entry.commandKind), ['begin-play-item', 'cancel-item-activation'])
            } else {
              const cost = dialog().getByRole('button', { name: scenario === 'dj-four-non-blocker' ? 'Gnome Band Gnome Band' : 'Affogato Cookie Affogato Cookie', exact: true })
              assert.equal(await dialog().getByRole('button', { name: '確認棄置 (0)', exact: true }).isEnabled(), false)
              await cost.click()
              if (scenario === 'dj-deselect') { await cost.click(); assert.equal(await dialog().getByRole('button', { name: '確認棄置 (0)', exact: true }).isEnabled(), false); await cost.click() }
              if (scenario === 'dj-limit') {
                await dialog().getByRole('button', { name: 'Gnome Band Gnome Band', exact: true }).click()
                assert.equal(await dialog().getByRole('button', { name: '確認棄置 (1)', exact: true }).count(), 1)
              }
              await shot('additional-cost')
              await dialog().getByRole('button', { name: '確認棄置 (1)', exact: true }).click()
            }
          }
          if (scenario !== 'dj-cancel') {
            if (scenario !== 'cancel-confirm') {
              await settle(page)
              const after = await state(page)
              const returns = !['four', 'zero', 'wrong-zones', 'dj-four-non-blocker'].includes(scenario)
              assert.equal(after.bottom.hand, result.before.bottom.hand - (dj ? 2 : 1))
              assert.equal(after.bottom.deck, result.before.bottom.deck + (returns ? result.before.bottom.trash + (dj ? 2 : 1) : 0))
              assert.equal(after.bottom.trash, returns ? 0 : result.before.bottom.trash + (dj ? 2 : 1))
              assert.deepEqual(after.top, result.before.top)
              assert.deepEqual(after.bottom.battle, result.before.bottom.battle)
              assert.deepEqual(after.bottom.break, result.before.bottom.break)
              assert.equal(after.bottom.support[0].rested, true)
              if (scenario === 'spare-energy') assert.equal(after.bottom.support[1].rested, false)
              assert.ok(await page.getByRole('button', { name: '結束主要階段', exact: true }).isEnabled())
              const commands = await trace(page)
              assert.deepEqual(commands.map(entry => entry.commandKind), ['begin-play-item', ...(dj ? ['resolve-opponent-hand-discard'] : []), ...(returns && !dj ? ['resolve-ability-effect'] : [])])
              const text = commands.flatMap(entry => entry.steps ?? []).join('\n')
              assert.match(text, returns ? /全部洗回牌庫並洗牌/ : /道具效果結果：條件不成立/)
              if (returns) assert.doesNotMatch(text, /條件不成立/)
            }
          }
        }
      }
      result.after = await state(page)
      result.trace = await trace(page)
      result.images = await page.locator('img').evaluateAll(images => images.filter(img => img.getBoundingClientRect().width > 0).map(img => ({ alt: img.alt, loaded: img.complete && img.naturalWidth > 0 })))
      assert.ok(result.images.every(img => img.loaded), JSON.stringify(result.images.filter(img => !img.loaded)))
      assert.deepEqual(result.errors, [])
      // Transient HP faces can be removed before their original-art request
      // finishes. Keep every cancellation, and require all mounted original
      // images (including payment/target/log faces) to decode successfully.
      result.mountedOriginalArt = await page.evaluate(async urls => {
        const mounted = [...document.images].filter(img => urls.includes(img.src))
        return Promise.all(mounted.map(async img => {
          await img.decode()
          if (!img.naturalWidth) throw new Error(`Original card art failed: ${img.src}`)
          return { url: img.src, alt: img.alt, naturalWidth: img.naturalWidth }
        }))
      }, cards.map(card => card.imageUrl))
      result.cancelledOriginalImageRequests = result.networkFailures.filter(entry =>
        entry.resourceType === 'image' && entry.error === 'net::ERR_ABORTED' && cards.some(card => card.imageUrl === entry.url))
      result.networkFailures = result.networkFailures.filter(entry => !result.cancelledOriginalImageRequests.includes(entry))
      assert.deepEqual(result.networkFailures, [])
      await shot('final')
      result.status = 'PASS'
      console.log(`PASS ${scenario} ${viewport.width}`)
    } catch (error) {
      result.error = String(error?.stack ?? error)
      result.trace = await trace(page).catch(() => [])
      await shot('failure').catch(() => {})
      console.log(`FAIL ${scenario} ${viewport.width}: ${result.error}`)
      results.push(result)
      writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify({ results }, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'), JSON.stringify({ results }, null, 2))
  }
} finally { await browser.close() }
console.log(`BS12-085 Browser ${results.length}/${results.length} passed`)
