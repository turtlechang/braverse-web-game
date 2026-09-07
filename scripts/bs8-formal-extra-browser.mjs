import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4198)
const baseUrl = process.env.BRAVERSE_BASE_URL ?? `http://127.0.0.1:${port}/`
const server = process.env.BRAVERSE_BASE_URL ? null : spawn(process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { stdio: 'ignore', windowsHide: true })
const output = 'test-results/bs8-formal-extra'
const deck = {
  name: 'BS8 Formal EXTRA Browser', format: 'standard',
  entries: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
    .map(number => ({ cardNumber: `BS8-${String(number).padStart(3, '0')}`, count: 4 })),
  extraDeckEntries: [
    { cardNumber: 'BS8-005', count: 2 }, { cardNumber: 'BS8-027', count: 1 },
    { cardNumber: 'BS8-069', count: 1 }, { cardNumber: 'BS8-090', count: 1 },
    { cardNumber: 'BS8-104', count: 1 },
  ],
}
const official = JSON.parse(await readFile('data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json', 'utf8')).cards
const sorted = entries => entries.map(entry => ({ cardNumber: entry.cardNumber, count: entry.count })).sort((a, b) => a.cardNumber.localeCompare(b.cardNumber))
const chooseDurableCookie = async options => {
  const names = await options.evaluateAll(nodes => nodes.map(node => ({
    name: node.querySelector(':scope > span')?.textContent?.trim(), disabled: node.disabled,
  })))
  const best = names.map((option, index) => ({ ...option, index, hp: Number(official.find(card => card.name === option.name)?.hp ?? 0) }))
    .filter(option => !option.disabled).sort((a, b) => b.hp - a.hp)[0]
  assert.ok(best, 'normal opening/replacement must provide a legal Cookie')
  await options.nth(best.index).click()
}
const zones = async page => ({
  ownSupport: await page.locator('.bottom-field .support-card-wrap').count(),
  opponentSupport: await page.locator('.top-field .support-card-wrap').count(),
  ownBattle: await page.locator('.bottom-field .combat-card-wrap').count(),
  ownHp: await page.locator('.bottom-field .badge-hp').allInnerTexts(),
  turn: await page.locator('.phase-rail .turn-indicator').innerText(),
})
const results = []
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const importDeck = async (page, payload, valid) => {
  await page.getByRole('button', { name: '匯入 JSON', exact: true }).click()
  const modal = page.getByTestId('deck-editor-import-modal')
  await modal.locator('textarea').fill(JSON.stringify(payload))
  await modal.getByRole('button', { name: '確認匯入', exact: true }).click()
  if (valid) await modal.waitFor({ state: 'hidden' })
  else {
    await page.waitForTimeout(200)
    assert.equal(await modal.isVisible(), true, 'invalid EXTRA import must remain rejected')
    const text = await page.locator('body').innerText()
    assert.match(text, /EXTRA|額外牌組/)
    await modal.getByRole('button', { name: '取消', exact: true }).click()
    return text
  }
}
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(baseUrl)).ok) break } catch { /* preview starting */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  for (const viewport of [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]) {
    const context = await browser.newContext({ viewport, permissions: ['clipboard-read', 'clipboard-write'] })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const errors = []
    const navigations = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('dialog', dialog => dialog.accept())
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations.push(frame.url()) })
    try {
      await page.goto(baseUrl)
      await page.getByRole('button', { name: '建立第一副牌組', exact: true }).click()
      await importDeck(page, deck, true)
      const count = page.getByTestId('deck-editor-extra-count')
      assert.match(await count.innerText(), /6\s*\/\s*6/)
      assert.equal((await page.locator('.deck-editor-page-counter strong').innerText()).trim(), '60')
      const add005 = page.getByTestId('formal-extra-add-BS8-005')
      assert.equal(await add005.isEnabled(), false, 'seventh EXTRA slot must be unavailable')
      await page.getByTestId('deck-editor-extra-card-BS8-005').getByRole('button', { name: /移除/ }).click()
      assert.match(await count.innerText(), /5\s*\/\s*6/)
      assert.equal(await page.getByTestId('formal-extra-add-BS8-069').isEnabled(), false, '069 is limited to one even with a free EXTRA slot')
      assert.equal(await add005.isEnabled(), true)
      await add005.click()
      assert.match(await count.innerText(), /6\s*\/\s*6/)
      const overflow = await importDeck(page, { ...deck, extraDeckEntries: deck.extraDeckEntries.map(entry => entry.cardNumber === 'BS8-005' ? { ...entry, count: 3 } : entry) }, false)
      assert.match(overflow, /6/)
      assert.match(await count.innerText(), /6\s*\/\s*6/)
      const limited = await importDeck(page, { ...deck, extraDeckEntries: [
        { cardNumber: 'BS8-005', count: 1 }, { cardNumber: 'BS8-027', count: 1 },
        { cardNumber: 'BS8-069', count: 1 }, { cardNumber: 'BS8-069@1', count: 1 },
        { cardNumber: 'BS8-090', count: 1 }, { cardNumber: 'BS8-104', count: 1 },
      ] }, false)
      assert.match(limited, /069|Peak of Apathy/)
      assert.match(await count.innerText(), /6\s*\/\s*6/)
      await page.getByTestId('deck-editor-page-save').click()
      await page.locator('.main-menu-deck-card').filter({ hasText: deck.name }).waitFor()
      await page.reload()
      await page.locator('.main-menu-deck-card').filter({ hasText: deck.name }).getByRole('button', { name: '編輯', exact: true }).click()
      assert.match(await page.getByTestId('deck-editor-extra-count').innerText(), /6\s*\/\s*6/)
      await page.getByRole('button', { name: '匯出 JSON', exact: true }).click()
      await page.waitForTimeout(200)
      const exported = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))
      assert.deepEqual(sorted(exported.entries), sorted(deck.entries))
      assert.deepEqual(sorted(exported.extraDeckEntries), sorted(deck.extraDeckEntries))
      assert.equal(exported.candidateStaging, undefined)
      await page.screenshot({ path: `${output}/${viewport.width}-editor.png`, fullPage: true })
      await page.getByTestId('deck-editor-page-back').click()
      await page.locator('.main-menu-ai-options select').nth(0).selectOption('bs6-red-standard')
      await page.locator('.main-menu-ai-options select').nth(1).selectOption('1')
      await page.getByRole('button', { name: '對戰入口', exact: true }).click()
      await page.locator('.opening-setup-modal').waitFor()
      for (let step = 0; step < 60 && await page.locator('.opening-setup-modal').count(); step++) {
        const setup = page.locator('.opening-setup-modal')
        const text = await setup.innerText()
        if (text.includes('猜拳決定')) await setup.getByRole('button', { name: '石頭', exact: true }).click()
        else if (text.includes('選擇先攻或後攻')) await setup.getByRole('button', { name: '選擇先攻', exact: true }).click()
        else if (text.includes('第一次調度')) await setup.getByRole('button', { name: '保留手牌', exact: true }).click()
        else if (text.includes('放置起始餅乾')) await chooseDurableCookie(setup.locator('.setup-hand button'))
        await page.waitForTimeout(200)
      }
      await page.locator('.opening-setup-modal').waitFor({ state: 'hidden' })
      const ownDock = page.getByLabel('玩家 EXTRA Deck 6 張', { exact: true })
      await ownDock.waitFor()
      await ownDock.click()
      const ownDialog = page.getByRole('dialog', { name: '玩家 EXTRA Deck', exact: true })
      const entries = ownDialog.locator('.extra-deck-card-entry')
      assert.equal(await entries.count(), 6)
      const visibleIds = await entries.locator('.extra-deck-card-details small:first-of-type').allInnerTexts()
      assert.deepEqual(visibleIds.sort(), deck.extraDeckEntries.flatMap(entry => Array(entry.count).fill(entry.cardNumber)).sort())
      const expectedImages = deck.extraDeckEntries.map(entry => official.find(record => record.cardNumber === entry.cardNumber).imageUrl)
      await page.waitForFunction(urls => urls.every(url => [...document.querySelectorAll('.bottom-field .extra-deck-popover img')]
        .some(image => image.src === url && image.complete && image.naturalWidth > 0)), expectedImages, { timeout: 10000 })
      const imageEvidence = await ownDialog.locator('img').evaluateAll((images, urls) => urls.map(url => ({ url, matching: images.filter(image => image.src === url).length, loaded: images.filter(image => image.src === url && image.complete && image.naturalWidth > 0).length })), expectedImages)
      assert.ok(imageEvidence.every(image => image.loaded > 0), 'own EXTRA must show the actual card images')
      const negativeZones = await zones(page)
      assert.ok(negativeZones.opponentSupport - negativeZones.ownSupport < 2)
      const negative069 = entries.filter({ hasText: 'Peak of Apathy' })
      assert.equal(await negative069.getByRole('button', { name: '從 EXTRA 登場', exact: true }).count(), 0)
      assert.match(await negative069.innerText(), /目前無法登場/)
      await page.screenshot({ path: `${output}/${viewport.width}-own-extra.png` })
      await ownDock.click()
      const opponentDock = page.locator('.top-field .extra-zone > button')
      await opponentDock.click()
      const opponentDialog = page.locator('.top-field .extra-deck-popover')
      assert.match(await opponentDialog.innerText(), /內容為私密資訊/)
      assert.equal(await opponentDialog.locator('.extra-deck-card-entry, img').count(), 0)
      const opponentCount = await opponentDock.getAttribute('aria-label')
      await page.screenshot({ path: `${output}/${viewport.width}-opponent-extra.png` })
      await opponentDock.click()
      const progression = []
      let ready = false
      for (let step = 0; step < 180; step++) {
        const current = await zones(page)
        const endMain = page.getByRole('button', { name: '結束主要階段', exact: true })
        if (current.opponentSupport - current.ownSupport >= 2 && await endMain.count() && await endMain.isEnabled()) {
          ready = true
          break
        }
        const replacement = page.locator('.decision-modal .decision-card-options button')
        const declineFlip = page.locator('.flip-response-modal').getByRole('button', { name: '不發動', exact: true })
        const phase = page.locator('.phase-rail .next-phase-button')
        if (await declineFlip.count() && await declineFlip.isEnabled()) {
          await declineFlip.click()
          progression.push({ action: 'decline-flip', ...current })
        } else if (await replacement.count()) {
          if (current.ownBattle === 0) await chooseDurableCookie(replacement)
          else await page.getByRole('button', { name: '不補餅乾', exact: true }).click()
          progression.push({ action: 'replacement-choice', ...current })
        } else if (await phase.isEnabled()) {
          const action = await phase.innerText()
          assert.match(action, /略過支援階段|結束主要階段|結束回合/)
          await phase.click()
          progression.push({ action, ...current })
        }
        await page.waitForTimeout(250)
      }
      assert.ok(ready, 'normal AI turns did not reach the true support-count condition within the bounded UI sequence')
      const beforeExtraPlay = await zones(page)
      assert.equal(beforeExtraPlay.ownSupport, 0, 'player skipped support normally')
      assert.ok(beforeExtraPlay.opponentSupport >= 2, 'AI genuinely placed support over its turns')
      assert.equal(beforeExtraPlay.ownBattle, 1, 'EXTRA must have a real empty battle slot')
      await page.getByLabel('玩家 EXTRA Deck 6 張', { exact: true }).click()
      const playable069 = page.getByRole('dialog', { name: '玩家 EXTRA Deck', exact: true })
        .locator('.extra-deck-card-entry').filter({ hasText: 'Peak of Apathy' })
      await playable069.getByRole('button', { name: '從 EXTRA 登場', exact: true }).click()
      await page.getByLabel('玩家 EXTRA Deck 5 張', { exact: true }).waitFor()
      await page.waitForTimeout(300)
      let onPlayChoice = 'no-eligible-target-prompt-cleared'
      if (await page.locator('.effect-panel').count()) {
        await page.locator('.effect-panel .skip-effect').click()
        await page.locator('.effect-panel').waitFor({ state: 'hidden' })
        onPlayChoice = 'skip-on-play'
      }
      const afterExtraPlay = await zones(page)
      assert.equal(afterExtraPlay.ownBattle, beforeExtraPlay.ownBattle + 1)
      assert.equal(await page.locator('.bottom-field .combat-card-wrap > .card-face[title="Peak of Apathy"]').count(), 1)
      assert.equal(await page.getByRole('button', { name: '結束主要階段', exact: true }).isEnabled(), true, 'OnPlay must not leave a blocking pending decision')
      await page.screenshot({ path: `${output}/${viewport.width}-real-extra-deployed.png` })
      assert.deepEqual(errors, [])
      assert.ok(navigations.every(url => !url.includes('test-state')))
      results.push({ viewport, status: 'PASS', mainCount: 60, extraCount: 6, exported, overflowRejected: true, combined069LimitRejected: true, ownVisibleIds: visibleIds, imageEvidence, opponentCount, opponentPrivate: true, negativeZones, negative069Blocked: true, progression, beforeExtraPlay, afterExtraPlay, onPlayChoice, extraAfterDeployment: 5, navigations, errors })
      console.log(`PASS ${viewport.width} formal EXTRA`)
    } catch (error) {
      results.push({ viewport, status: 'FAIL', error: error.message, body: await page.locator('body').innerText(), errors, navigations })
      console.log(`FAIL ${viewport.width}: ${error.message}`)
      await page.screenshot({ path: `${output}/${viewport.width}-failure.png` })
    } finally { await context.close() }
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ generatedAt: new Date().toISOString(), scope: 'Normal Standard editor import/save/reload/export and random local opening, actual BS8-069 condition-negative then AI support progression to real EXTRA deployment. No test-state, seed, injected state or storage. Opponent preset has no EXTRA: privacy UI check does not prove nonempty opponent browser masking. Not full-match/online acceptance.', deck, results }, null, 2))
  await browser.close()
  server?.kill()
}
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
