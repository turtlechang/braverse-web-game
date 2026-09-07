import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

// Finish both viewport checks for one source before starting the next source.
const root = process.cwd()
const start = Number(process.env.BRAVERSE_SERIAL_START ?? 62)
const end = Number(process.env.BRAVERSE_SERIAL_END ?? 125)
const directory = resolve(root, 'test-results/bs8-desktop-tablet-2026-09-07')
await mkdir(directory, { recursive: true })
const { cards } = JSON.parse(await readFile('data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json', 'utf8'))
// 065 uses the dedicated support-count met/unmet routes in the normal audit;
// its generic card-skill fixture does not satisfy the printed condition.
const strict = new Set([2,3,4,9,10,11,12,13,16,17,18,20,31,32,34,35,37,38,39,42,51,52,53,57,59,60,61,62,64,66,68,77,78,79,82,83,84,85,86,87,88,89,92,95,107,111,113,114,115,117,118,119,120])
const results = []
for (let number = start; number <= end; number++) {
  const id = `BS8-${String(number).padStart(3, '0')}`
  const card = cards.find(card => card.cardNumber === id) ?? cards.find(card => card.baseCardNumber === id)
  if (!card) throw new Error(`Missing ${id}`)
  if (card.type === 'extra') {
    results.push({ id, status: 'separate-extra-route-required' })
    continue
  }
  const vanilla = (card.type === 'cookie' || card.type === 'flip') && !card.skill?.text && !card.flipText && !/Then|\{sk\}/i.test(card.attackText ?? '')
  for (const [width, height, label] of [[1907,863,'desktop'],[1164,777,'tablet']]) {
    const modes = strict.has(number) ? [['--bs8-strict-abilities']] : [vanilla ? ['--vanilla-attacks'] : [], ['--negative']]
    for (const flags of modes) {
      const suffix = flags.includes('--negative') ? '-negative' : ''
      const report = resolve(directory, `${String(number).padStart(3,'0')}-${label}${suffix}.json`)
      const args = ['scripts/p-browser-effect-audit.mjs','--series=BS8',`--card=${id}`,'--all-variants','--fail-fast',...flags]
      const exitCode = await new Promise((resolveExit, reject) => {
        const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env,
          BRAVERSE_TEST_WIDTH: String(width), BRAVERSE_TEST_HEIGHT: String(height), BRAVERSE_AUDIT_REPORT: report,
        } })
        child.on('error', reject)
        child.on('exit', resolveExit)
      })
      results.push({ id, viewport: `${width}x${height}`, flags, report, exitCode })
      await writeFile(resolve(directory,'serial-progress.json'), JSON.stringify(results,null,2))
      if (exitCode !== 0) throw new Error(`${id} ${label}${suffix} failed; serial audit stopped`)
    }
  }
}
