import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  AI_STRATEGY_VERSION, createCustomDeckMatch, MAX_TOURNAMENT_ACTIONS, runSwissTournament, simulateAiMatchDetailed,
  validateCustomDeckDefinition, getCardPoolEntry, type SwissRosterDeck,
} from '../src/game'
import { COLORS, COLOR_NAMES, signature, bs11Copies, RECIPES } from './generate-bs11-1024-roster'
import { runTop8, type PlayoffGame } from './lib/bs11-playoffs'
import { Bs11SimulationPool } from './lib/bs11-simulation-pool'

const root = process.cwd()
const rosterPath = resolve('data/decks/bs11-1024-roster.json')
const rosterSource = await readFile(rosterPath, 'utf8')
const roster = JSON.parse(rosterSource) as { decks: SwissRosterDeck[]; banlist: unknown; sourceHashes: unknown }
const decks = roster.decks
const smoke = process.argv.includes('--smoke')
const selected = smoke ? COLORS.flatMap((color) => decks.filter((deck) => deck.color === color).slice(0, 2)) : decks
const rounds = smoke ? 2 : 10
const output = resolve(smoke ? 'test-results/bs11-tournament-smoke' : 'data/decks/bs11-1024-report.json')
const artifactDir = resolve('test-results/bs11-1024', smoke ? 'smoke' : 'full')
await mkdir(artifactDir, { recursive: true })
if (decks.length !== 1024 || new Set(decks.map((deck) => signature(deck.entries))).size !== 1024) throw new Error('Expected 1024 distinct deck compositions')
for (const deck of decks) {
  const validation = validateCustomDeckDefinition(deck)
  if (!validation.isValid || bs11Copies(deck.entries) < 48) throw new Error(`${deck.id}: invalid or insufficient BS11 composition: ${validation.errors.join('; ')}`)
}
const seed = 20260930
const failures: unknown[] = []
const actionCoverage: Record<string, number> = {}
const startedAt = new Date().toISOString()
const logPath = resolve(artifactDir, `matches-${Date.now()}.jsonl`)
let played = 0
console.log(`BS11 ${selected.length} decks; ${rounds} Swiss rounds; AI Lv.5; seed=${seed}; maxActions=500`)
const pool = new Bs11SimulationPool(4)
const swiss = await runSwissTournament(selected, {
  rounds, seed, maxActions: MAX_TOURNAMENT_ACTIONS, aiLevel: 5, experienceProfile: null, progressEvery: 32,
  simulateRound: (inputs) => pool.simulateRound(inputs),
  deterministicSearch: true,
  avoidRematches: true,
  onMatch: async ({ record, result }) => {
    played++
    await appendFile(logPath, `${JSON.stringify(record)}\n`)
    if (record.result !== 'win') failures.push(record)
    if (result) {
      for (const profile of Object.values(result.decisionProfileByPlayer)) {
        // Actual AI action counts remain coverage hints, not semantic acceptance.
        for (const [id, actions] of Object.entries(profile.byCardAction)) {
          actionCoverage[id] = (actionCoverage[id] ?? 0) + Object.values(actions).reduce((sum, count) => sum + count, 0)
        }
      }
    }
    if (played % 32 === 0) await writeFile(resolve(artifactDir, 'progress.json'), JSON.stringify({ played, failures: failures.length, round: record.round, total: selected.length / 2 * rounds }))
  },
  onProgress: (progress) => console.log(`Swiss round ${progress.round}/${progress.rounds}: ${progress.completedMatches}/${progress.totalMatches}; unresolved=${failures.length}`),
}).finally(() => pool.close())
const byId = new Map(decks.map((deck) => [deck.id, deck]))
const playoff = runTop8(swiss.standings, (stage, table, leftId, rightId): PlayoffGame => {
  const stageOffset = stage === 'quarterfinal' ? 1 : stage === 'semifinal' ? 2 : 3
  const matchSeed = seed + 20_000_000 + stageOffset * 100 + table
  const firstPlayerId = table % 2 === 0 ? 'player-one' : 'player-two'
  const base = { stage, table, leftId, rightId, seed: matchSeed, firstPlayerId } as const
  try {
    const result = simulateAiMatchDetailed(createCustomDeckMatch(matchSeed, byId.get(leftId)!, byId.get(rightId)!, firstPlayerId), MAX_TOURNAMENT_ACTIONS,
      { levels: { 'player-one': 5, 'player-two': 5 }, seed: matchSeed, experienceProfile: null, searchNow: () => 0 })
    const winnerId = result.stuck || !result.endInfo.winner ? null : result.endInfo.winner === 'player-one' ? leftId : rightId
    const record = { ...base, winnerId, actions: result.actions, turns: result.state.turnNumber - 1,
      error: winnerId ? null : result.error ?? result.endInfo.reason ?? 'unresolved' }
    console.log(`${stage} ${table}: ${leftId} vs ${rightId} -> ${winnerId ?? 'UNRESOLVED'}`)
    return record
  } catch (error) { return { ...base, winnerId: null, actions: 0, turns: 0, error: error instanceof Error ? error.message : String(error) } }
})
const colorDistribution = (ids: string[]) => COLORS.map((color) => ({ color, name: COLOR_NAMES[color], count: ids.filter((id) => byId.get(id)?.color === color).length,
  percentage: ids.length ? ids.filter((id) => byId.get(id)?.color === color).length / ids.length * 100 : 0 }))
const report = {
  status: swiss.status === 'PASS' && playoff.status === 'PASS' ? 'PASS' : 'FAIL', startedAt, generatedAt: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean),
  methodology: { seed, rounds, aiLevel: 5, maxActions: 500, format: 'standard', aiStrategyVersion: AI_STRATEGY_VERSION,
    rosterHash: createHash('sha256').update(rosterSource).digest('hex'), banlist: roster.banlist, sourceHashes: roster.sourceHashes,
    runtime: 'Node pure rules simulation, no Browser or online claim', experienceProfile: null,
    searchBudget: 'Existing Lv.4/Lv.5 node and depth caps; injected constant clock avoids load-dependent elapsed-time fallback. Four isolated workers. Decision elapsed telemetry is not wall-clock timing.',
    unresolvedPolicy: 'Keep existing Swiss engine one-point unresolved handling and FAIL status. Never replay with favorable seeds; no winner for unresolved playoffs.',
    population: 'Balanced designed roster; participation proportions are assigned, not observed external metagame share.',
    pairing: 'No rematches; repair greedy repeated pairs by a deterministic two-table exchange minimizing score distance, or stop if no exchange exists.' },
  swiss, playoff, failures, actionCoverage,
  distributions: { entrants: colorDistribution(selected.map((deck) => deck.id)), top8: colorDistribution(playoff.top8.map((row) => row.deckId)), top4: colorDistribution(playoff.top4.map((row) => row.deckId)) },
  topDecks: playoff.top8.map((standing) => ({ ...standing, deck: byId.get(standing.deckId) })),
}
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
if (!smoke) {
  const deckRows = playoff.top8.map((standing) => `| ${standing.rank} | ${standing.name} | ${COLOR_NAMES[standing.color]} | ${standing.points} | ${standing.wins}-${standing.losses}-${standing.draws} | ${standing.buchholz} |`)
  const blocks = playoff.top8.map((standing) => {
    const deck = byId.get(standing.deckId)!
    return `### ${standing.name}\n\n${RECIPES[deck.color].plan}\n\nBS11 主牌 ${bs11Copies(deck.entries)}/60；${standing.stuckMatches} 場未完成。\n\n| 卡號 | 卡名 | 張數 |\n| --- | --- | --- |\n${deck.entries.map((entry) => `| ${entry.cardNumber} | ${getCardPoolEntry(entry.cardNumber)?.name} | ${entry.count} |`).join('\n')}\n\nEXTRA：${deck.extraDeckEntries?.map((entry) => `${entry.cardNumber} ${getCardPoolEntry(entry.cardNumber)?.name} ×${entry.count}`).join('、')}\n`
  })
  const md = [
    '# BS11 六色 1024 副牌組瑞士輪', '', `結果：**${report.status}**。Swiss ${swiss.metrics.completedMatches}/${swiss.methodology.totalMatches} 完成，${swiss.metrics.stuckMatches} 場卡住／超限；決賽 ${playoff.status}。`,
    `冠軍：${playoff.champion?.name ?? '未產生'}；亞軍：${playoff.runnerUp?.name ?? '未產生'}。`,
    `四強：${playoff.top4.map((row) => row.name).join('、') || '未產生'}。`,
    report.status === 'FAIL' ? '有未完成對局，排名與決賽結果為本輪模擬暫定結果，不能宣稱完整賽事驗收通過。' : '所有對局均已取得實際勝者。', '',
    '10 輪 Swiss，勝3分、未完成沿用現行引擎各1分並標記 FAIL；Buchholz／勝率／預先種子次序排序。TOP 8 採 1v8、4v5、2v7、3v6 固定單淘汰。',
    'AI Lv.5 baseline、seed 20260930、單局 500 步；參賽比例由六色平衡分配，並非外部環境使用率。每副主牌至少48/60張 BS11，所有構築皆依 checkout 的 Standard 禁限快照驗證。',
    '本報告使用 Node 純規則模擬，不代表 Browser／線上逐卡驗收，也不是已證明真人最強的構築。', '',
    '## TOP 8（瑞士輪種子順位）', '', '| 種子 | 牌組 | 顏色 | 分數 | 勝-敗-未完成 | Buchholz |', '| --- | --- | --- | --- | --- | --- |', ...deckRows, '',
    '## 各色比例', '', '| 顏色 | 參賽副數 | 參賽比例 | TOP 8 | 四強 |', '| --- | --- | --- | --- | --- |',
    ...report.distributions.entrants.map((entry, index) => `| ${entry.name} | ${entry.count} | ${entry.percentage.toFixed(2)}% | ${report.distributions.top8[index].count} | ${report.distributions.top4[index].count} |`), '',
    '## 八強完整牌表', '', ...blocks,
  ].join('\n')
  await writeFile(resolve(root, 'docs/bs11-1024-tournament-2026-09-30.md'), `${md}\n`)
}
console.log(JSON.stringify({ output, status: report.status, completed: swiss.metrics.completedMatches, unresolved: swiss.metrics.stuckMatches,
  champion: playoff.champion?.name, top4: playoff.top4.map((row) => row.name) }, null, 2))
process.exitCode = report.status === 'PASS' ? 0 : 1
