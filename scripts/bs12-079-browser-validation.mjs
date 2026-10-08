import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-079-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      hand: field?.querySelectorAll('.hand-card').length ?? 0,
      stage: field?.querySelector('.stage-zone img')?.getAttribute('src') ?? null,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        attack: Number(node.querySelector('.badge-atk')?.textContent ?? NaN),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
        equipped: node.querySelector('.badge-equip')?.getAttribute('aria-label') ?? null })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(entry => ({ commandKind: entry.commandKind, summary: entry.summary, steps: entry.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') &&
  ![...document.querySelectorAll('button')].some(button => button.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const cases = ['deploy', 'positive', 'blue-energy', 'purple-energy', 'green-energy', 'yellow-energy', 'spare-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main', 'cancel-payment', 'cancel-target', 'payment-deselect', 'target-faints']
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({ viewport })
    const result = { number: 'BS12-079', scenario, viewport, printedSourceAttested: true, status: 'FAIL', errors: [], networkFailures: [] }
    page.on('pageerror', error => result.errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') result.errors.push(message.text()) })
    page.on('requestfailed', request => result.networkFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, route => route.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const routeCase = ['cancel-payment', 'cancel-target', 'payment-deselect'].includes(scenario) ? 'positive' : scenario
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'positive' ? 'card:BS12-079' : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'few-energy' ? 'card-negative:BS12-079' : 'bs12-079:'+routeCase
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card='+cards.map(card=>card.cardNumber).join(','))
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      result.before = await state(page)
      assert.equal(result.before.bottom.battle.length, 1)
      assert.equal(result.before.top.battle.length, 2)
      assert.equal(result.before.bottom.battle[0].hp, 2)
      assert.equal(result.before.bottom.deck, 12)
      assert.equal(result.before.bottom.hand, scenario === 'deploy' ? 1 : 0)
      assert.equal(result.before.bottom.trash, 0)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-079-source"]')
      if (scenario === 'deploy') {
        const hand = page.locator('.bottom-field .hand-card-wrap').filter({ has: page.locator('img[alt="Currant Cream Cookie"]') })
        await hand.locator('button.card-face').click()
        await hand.getByRole('button', { name: '登場', exact: true }).click()
        await source.waitFor()
        await settle(page)
        const entered = await state(page)
        assert.deepEqual(entered.bottom.battle.map(c => c.hp), [2, 2])
        assert.equal(entered.bottom.deck, 10)
        assert.equal(entered.bottom.hand, 0)
        assert.deepEqual(entered.bottom.support, result.before.bottom.support)
        assert.deepEqual(entered.top, result.before.top)
        assert.deepEqual((await trace(page)).map(e => e.commandKind), ['deploy-cookie'])
      }
      await source.locator('img').first().evaluate(image => image.decode())
      assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(card=>card.cardNumber==='BS12-079').imageUrl)
      assert.equal(await source.locator('.skill-action').count(), 0)
      const blocked = ['few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'].includes(scenario)
      if (scenario === 'deploy') {
        assert.equal(await source.locator('.skill-action').count(), 0)
      } else if (blocked) {
        assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
        await shot('blocked')
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), [])
      } else {
        await source.locator('.card-face.is-attackable').click()
        const support = index => page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-079-payment-${index}"] .card-face`)
        const target = page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-079-opponent"] .card-face:not(.hp-card)')
        if (scenario === 'cancel-payment') {
          await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), [])
        } else {
          await support(0).click()
          assert.match(await target.getAttribute('aria-label'), /^選擇攻擊目標：/)
          const paidPreview = { ...result.before, bottom: { ...result.before.bottom, support: result.before.bottom.support.map((s, i) => ({ ...s, rested: i === 0 })) } }
          assert.deepEqual(await state(page), paidPreview)
          if (scenario === 'payment-deselect') {
            await support(0).click()
            assert.deepEqual(await state(page), result.before)
            assert.equal(await target.getAttribute('aria-label') === '選擇攻擊目標：Langue de Chat Cookie', false)
            await support(0).click()
          }
          await shot('payment')
          assert.match(await target.getAttribute('aria-label'), /^選擇攻擊目標：/)
          assert.deepEqual(await state(page), paidPreview)
          assert.deepEqual(await trace(page), [])
          if (scenario === 'cancel-target') {
            await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual(await trace(page), [])
          } else {
            await target.click()
            await page.waitForFunction(faint => {
              const node = document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-079-opponent"]')
              return faint ? !node : /HP 卡 3 張/.test(node?.querySelector('.hp-card-stack')?.getAttribute('aria-label') ?? '')
            }, scenario === 'target-faints', { timeout: 20000 })
            await settle(page)
            await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
            result.attackAfter = await state(page)
            assert.equal(result.attackAfter.top.battle.find(c => c.id === 'bs12-079-opponent')?.hp, scenario === 'target-faints' ? undefined : 3)
            assert.deepEqual(result.attackAfter.top.battle.find(c => c.id === 'bs12-079-opponent-other'), result.before.top.battle[1])
            assert.equal(result.attackAfter.top.trash, 1)
            assert.equal(result.attackAfter.bottom.battle[0].rested, true)
            assert.equal(result.attackAfter.bottom.battle[0].hp, 2)
            assert.deepEqual(result.attackAfter.bottom.support, result.before.bottom.support.map((s, i) => ({ ...s, rested: i === 0 })))
            assert.equal(result.attackAfter.bottom.deck, 12)
            assert.equal(result.attackAfter.bottom.hand, 0)
            assert.equal(result.attackAfter.bottom.trash, 0)
            assert.equal(result.attackAfter.top.deck, result.before.top.deck)
            const commands = (await trace(page)).map(entry => entry.commandKind)
            assert.equal(commands.filter(kind => kind === 'declare-attack').length, 1)
            assert.equal(commands.includes('resolve-attack-effect'), false)
            assert.equal(commands.some(kind => kind.includes('activate-skill')), false)
            await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
            await page.getByRole('button', { name: /Currant Cream Cookie 攻擊 玩家/ }).click()
            result.publicAttackText = await page.locator('body').innerText()
            assert.match(result.publicAttackText,scenario==='target-faints'?/Currant Cream Cookie.*Pink Choco Cookie/:/Currant Cream Cookie.*Langue de Chat Cookie/)
            assert.match(result.publicAttackText, /自動結算了戰鬥/)
            await shot('public-trace')
            await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
          }
        }
      }
      result.after = await state(page)
      result.trace = await trace(page)
      await shot('result')
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
      result.status = 'PASS'
    } catch (error) {
      result.error = String(error.stack ?? error)
      result.dom = await page.locator('body').innerText().catch(() => '')
      results.push(result)
      writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
      throw error
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
    console.log(`PASS BS12-079 ${scenario} ${viewport.width}x${viewport.height}`)
  }
  console.log(`BS12-079 Browser ${results.length}/${results.length}`)
} finally { await browser.close() }
