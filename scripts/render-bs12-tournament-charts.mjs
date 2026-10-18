import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'

const sourcePath = 'data/decks/bs12-1028-report.json'
const source = await readFile(sourcePath, 'utf8')
const report = JSON.parse(source)
assert.equal(report.status, 'PASS')
assert.equal(report.swiss.metrics.completedMatches, 5654)
assert.equal(report.swiss.metrics.stuckMatches, 0)
const palette = { red: '#D34D56', yellow: '#E4B63E', green: '#36A879', blue: '#468EDA', purple: '#9669C9', black: '#343946' }
const panels = [['entrants', '參賽', 1028], ['top16', '16 強', 16], ['top8', '八強', 8], ['top4', '四強', 4]]
const point = angle => [224 + 120 * Math.cos(angle), 280 + 120 * Math.sin(angle)]
const contents = panels.map(([key, title, total], panel) => {
  const rows = report.distributions[key]
  assert.equal(rows.reduce((sum, row) => sum + row.count, 0), total)
  let angle = -Math.PI / 2
  const slices = rows.filter(row => row.count).map(row => {
    assert.ok(Math.abs(row.percentage - row.count / total * 100) < 0.00001)
    const next = angle + row.count / total * Math.PI * 2
    const a = point(angle), b = point(next)
    const path = row.count === total ? '<circle cx="224" cy="280" r="120"/>'
      : `<path d="M 224 280 L ${a.join(' ')} A 120 120 0 ${next - angle > Math.PI ? 1 : 0} 1 ${b.join(' ')} Z"/>`
    angle = next
    return `<g fill="${palette[row.color]}" stroke="white" stroke-width="2">${path}</g>`
  }).join('')
  const legend = rows.map((row, index) => `<g transform="translate(60 ${440 + index * 31})"><rect width="16" height="16" rx="3" fill="${palette[row.color]}"/><text x="28" y="14">${row.name}色</text><text x="315" y="14" text-anchor="end">${row.count} · ${row.percentage.toFixed(2)}%</text></g>`).join('')
  return `<g transform="translate(${panel % 2 * 456} ${Math.floor(panel / 2) * 580})"><rect x="12" y="112" width="432" height="545" rx="18" fill="white"/><text x="224" y="152" text-anchor="middle" font-size="24" font-weight="700">${title} · n=${total}</text>${slices}<g font-size="19">${legend}</g></g>`
}).join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="912" height="1352" viewBox="0 0 912 1352"><rect width="912" height="1352" fill="#F0F3F7"/><g font-family="Microsoft JhengHei, Noto Sans CJK TC, sans-serif" fill="#242C3A"><text x="40" y="46" font-size="30" font-weight="700">BS12 六色 · 1,028 人賽事顏色比例</text><text x="40" y="80" font-size="19">11 輪瑞士輪 5,654 場＋16 強單淘汰 15 場 · AI Lv.5 · seed 20261009</text>${contents}<text x="40" y="1285" font-size="21">冠軍：${report.playoff.champion.name}</text><text x="40" y="1317" font-size="17">參賽比例為人工配置；晉級比例為固定牌表模擬結果，並非外部環境使用率。</text></g></svg>`
const directory = 'output/bs12-1028'
await writeFile(`${directory}/color-distribution.svg`, svg)
const require = createRequire(import.meta.url)
const sharp = require(require.resolve('sharp', { paths: process.env.SHARP_NODE_MODULES ? [process.env.SHARP_NODE_MODULES] : [process.cwd()] }))
await sharp(Buffer.from(svg)).png().toFile(`${directory}/color-distribution.png`)
await writeFile(`${directory}/chart-provenance.json`, JSON.stringify({ sourcePath,
  sourceSha256: createHash('sha256').update(source).digest('hex'), distributions: report.distributions }, null, 2))
console.log(`${directory}/color-distribution.png`)
