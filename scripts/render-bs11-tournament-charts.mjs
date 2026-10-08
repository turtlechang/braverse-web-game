import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const sourcePath = resolve('data/decks/bs11-1024-report.json')
const source = await readFile(sourcePath, 'utf8')
const report = JSON.parse(source)
assert.equal(report.status, 'PASS', 'Only a completed tournament may produce final charts')
assert.equal(report.swiss.metrics.completedMatches, 5120)
assert.equal(report.swiss.metrics.stuckMatches, 0)
const colors = { red: '#D34D56', yellow: '#E4B63E', green: '#36A879', blue: '#468EDA', purple: '#9669C9', black: '#343946' }
const panels = [['entrants', '參賽牌組', 1024], ['top8', 'TOP 8', 8], ['top4', '四強', 4]]
const cx = 232, cy = 268, radius = 132
const point = (angle) => [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]
const pie = (rows, total) => {
  let angle = -Math.PI / 2
  return rows.filter((row) => row.count).map((row) => {
    const next = angle + row.count / total * Math.PI * 2
    const start = point(angle), end = point(next)
    const shape = row.count === total
      ? `<circle cx="${cx}" cy="${cy}" r="${radius}"/>`
      : `<path d="M ${cx} ${cy} L ${start.join(' ')} A ${radius} ${radius} 0 ${next - angle > Math.PI ? 1 : 0} 1 ${end.join(' ')} Z"/>`
    angle = next
    return `<g fill="${colors[row.color]}" stroke="white" stroke-width="2">${shape}</g>`
  }).join('')
}
const contents = panels.map(([key, title, total], index) => {
  const rows = report.distributions[key]
  assert.equal(rows.reduce((sum, row) => sum + row.count, 0), total)
  for (const row of rows) assert.ok(Math.abs(row.percentage - row.count / total * 100) < 0.00001)
  const legend = rows.map((row, i) => `<g transform="translate(92 ${439 + i * 30})"><rect width="15" height="15" rx="3" fill="${colors[row.color]}"/><text x="26" y="13" font-size="17">${row.name}色</text><text x="285" y="13" text-anchor="end" font-size="17">${row.count} 副 · ${row.percentage.toFixed(2)}%</text></g>`).join('')
  return `<g transform="translate(${index * 464 + 24} 0)"><rect x="8" y="100" width="440" height="550" rx="18" fill="white"/><text x="232" y="140" text-anchor="middle" font-size="23" font-weight="700">${title} · n=${total}</text>${pie(rows, total)}${legend}</g>`
}).join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="752" viewBox="0 0 1440 752"><rect width="1440" height="752" fill="#F0F3F7"/><g font-family="Microsoft JhengHei, Noto Sans CJK TC, sans-serif" fill="#242C3A"><text x="48" y="48" font-size="29" font-weight="700">BS11 六色 1024 副牌組 · 瑞士輪賽事顏色比例</text><text x="48" y="78" font-size="16" fill="#566274">10 輪瑞士輪＋TOP 8 單淘汰 · AI Lv.5 · 固定種子 20260930</text>${contents}<text x="48" y="693" font-size="17">冠軍：${report.playoff.champion.name}</text><text x="48" y="725" font-size="15" fill="#566274">參賽比例為人工配置的六色平衡母體；TOP 8 與四強為本次模擬結果，並非外部環境使用率。</text></g></svg>`
const directory = resolve('output/bs11-1024')
await mkdir(directory, { recursive: true })
const svgPath = resolve(directory, 'color-distribution.svg')
const pngPath = resolve(directory, 'color-distribution.png')
await writeFile(svgPath, svg)
const require = createRequire(import.meta.url)
const sharp = require(require.resolve('sharp', { paths: process.env.SHARP_NODE_MODULES ? [process.env.SHARP_NODE_MODULES] : [process.cwd()] }))
await sharp(Buffer.from(svg)).png().toFile(pngPath)
await writeFile(resolve(directory, 'chart-provenance.json'), JSON.stringify({ sourcePath, sourceSha256: createHash('sha256').update(source).digest('hex'), svgPath, pngPath, distributions: report.distributions }, null, 2))
console.log(JSON.stringify({ svgPath, pngPath }, null, 2))
