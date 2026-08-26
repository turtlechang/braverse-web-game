import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACTIVE_BANLIST_POLICY,
  createCustomDeckMatch,
  runSwissTournament,
  simulateAiMatchDetailed,
  validateCustomDeck,
  type AiDetailedResult,
  type AiLevel,
  type PlayerId,
  type SwissMatchRecord,
  type SwissRosterDeck,
  type SwissStanding,
  type SwissTournamentReport,
} from '../src/game'
import { getCardPoolEntry } from '../src/game/card-pool'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_ROUNDS = 8
const DEFAULT_SEED = 20260823
const DEFAULT_MAX_ACTIONS = 2500

type PlayoffStage = 'quarterfinal' | 'semifinal' | 'final'

interface PlayoffMatch {
  stage: PlayoffStage
  table: number
  seed: number
  firstPlayerId: PlayerId
  playerOneDeckId: string
  playerTwoDeckId: string
  winnerDeckId: string | null
  loserDeckId: string | null
  result: 'win' | 'stuck'
  actions: number
  turns: number
  reason: string | null
  error: string | null
}

interface PlayoffReport {
  status: 'PASS' | 'FAIL'
  top8: SwissStanding[]
  top4: SwissStanding[]
  finalists: SwissStanding[]
  champion: SwissStanding | null
  runnerUp: SwissStanding | null
  finalOrder: SwissStanding[]
  matches: PlayoffMatch[]
}

interface BehaviorAggregate {
  matches: number
  completed: number
  stuck: number
  invalidActions: number
  deadlocks: number
  turnCaps: number
  actions: number
  turns: number
  comboStarted: number
  comboCompleted: number
  comboAbandoned: number
  endgameForecasts: number
  refreshForecasts: number
  emptyBattleForecasts: number
  lethalOpportunities: number
  lethalConversions: number
  attackKillRateSum: number
  attackKillRateSamples: number
}

interface QualitySummary extends BehaviorAggregate {
  completionRate: number
  comboCompletionRate: number
  comboAbandonRate: number
  averageActions: number
  averageTurns: number
  averageAttackKillRate: number
  safetyPass: boolean
  completionPass: boolean
}

interface FixedControlResult {
  matches: SwissMatchRecord[]
  standings: SwissStanding[]
  quality: QualitySummary
}

interface MarkdownReport {
  generatedAt: string
  banlistPolicy: typeof ACTIVE_BANLIST_POLICY
  roster: { totalDecks: number; deckCountByColor: Record<string, number> }
  lv5: { swiss: SwissTournamentReport; playoffs: PlayoffReport; quality: QualitySummary }
  lv4FixedScheduleControl: { quality: QualitySummary } | null
  comparison: {
    sameWinnerRate: number
    pairedAdvantage: { lv5Better: number; lv4Better: number; ties: number; wilson95: { lower: number; upper: number } }
  }
  gate: { promotionReady: boolean }
}

const argumentValue = (name: string): string | undefined => {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

const positiveInteger = (name: string, fallback: number): number => {
  const value = Number(argumentValue(name) ?? fallback)
  if (!Number.isInteger(value) || value <= 0) throw new Error(`--${name} 必須是正整數。`)
  return value
}

const emptyAggregate = (): BehaviorAggregate => ({
  matches: 0, completed: 0, stuck: 0, invalidActions: 0, deadlocks: 0,
  turnCaps: 0, actions: 0, turns: 0, comboStarted: 0, comboCompleted: 0,
  comboAbandoned: 0, endgameForecasts: 0, refreshForecasts: 0,
  emptyBattleForecasts: 0, lethalOpportunities: 0, lethalConversions: 0,
  attackKillRateSum: 0, attackKillRateSamples: 0,
})

const addResult = (aggregate: BehaviorAggregate, result: AiDetailedResult | null): void => {
  aggregate.matches += 1
  if (!result) {
    aggregate.stuck += 1
    return
  }
  const completed = !result.stuck && result.state.status === 'finished' && Boolean(result.endInfo.winner)
  aggregate.completed += Number(completed)
  aggregate.stuck += Number(!completed)
  aggregate.invalidActions += result.behavior.invalidActionCount
  aggregate.deadlocks += result.behavior.deadlockCount
  aggregate.turnCaps += Number(result.endInfo.turnCapReached)
  aggregate.actions += result.actions
  aggregate.turns += result.turnProgression.totalTurns
  aggregate.comboStarted += result.behavior.comboIntentsStarted
  aggregate.comboCompleted += result.behavior.comboIntentsCompleted
  aggregate.comboAbandoned += result.behavior.comboIntentsAbandoned
  aggregate.endgameForecasts += result.behavior.endgameForecastCount
  aggregate.refreshForecasts += result.behavior.refreshForecastCount
  aggregate.emptyBattleForecasts += result.behavior.emptyBattleForecastCount
  aggregate.lethalOpportunities += result.behavior.lethalOpportunityCount
  aggregate.lethalConversions += result.behavior.lethalConversionCount
  aggregate.attackKillRateSum += result.behavior.attackKillRate
  aggregate.attackKillRateSamples += 1
}

const summarizeQuality = (aggregate: BehaviorAggregate): QualitySummary => ({
  ...aggregate,
  completionRate: aggregate.completed / Math.max(1, aggregate.matches),
  comboCompletionRate: aggregate.comboCompleted / Math.max(1, aggregate.comboStarted),
  comboAbandonRate: aggregate.comboAbandoned / Math.max(1, aggregate.comboStarted),
  averageActions: aggregate.actions / Math.max(1, aggregate.matches),
  averageTurns: aggregate.turns / Math.max(1, aggregate.matches),
  averageAttackKillRate: aggregate.attackKillRateSum / Math.max(1, aggregate.attackKillRateSamples),
  safetyPass: aggregate.stuck === 0 && aggregate.invalidActions === 0 && aggregate.deadlocks === 0 && aggregate.turnCaps === 0,
  completionPass: aggregate.completed === aggregate.matches,
})

const wilson95 = (wins: number, games: number) => {
  if (games === 0) return { lower: 0, upper: 0 }
  const z = 1.959963984540054
  const rate = wins / games
  const denominator = 1 + (z * z) / games
  const center = (rate + (z * z) / (2 * games)) / denominator
  const margin = z * Math.sqrt((rate * (1 - rate) + (z * z) / (4 * games)) / games) / denominator
  return { lower: center - margin, upper: center + margin }
}

const parseRoster = async (path: string, limit: number): Promise<SwissRosterDeck[]> => {
  const raw = JSON.parse(await readFile(path, 'utf8')) as { decks?: SwissRosterDeck[]; methodology?: unknown }
  if (!Array.isArray(raw.decks) || raw.decks.length !== 256) throw new Error(`Roster 必須有 256 副，實際為 ${raw.decks?.length ?? 0} 副。`)
  const decks = raw.decks.slice(0, limit)
  if (decks.length < 8 || decks.length % 2 !== 0) throw new Error('--limit 必須是至少 8 的偶數。')
  for (const deck of decks) {
    const validation = validateCustomDeck(deck.entries, { format: 'standard' })
    if (!validation.isValid) throw new Error(`${deck.id} 不合法：${validation.errors.join('; ')}`)
  }
  return decks
}

const standingWithEntries = (standing: SwissStanding, decks: Map<string, SwissRosterDeck>): SwissStanding => ({
  ...standing,
  entries: decks.get(standing.deckId)?.entries,
})

const runPlayoffs = async (
  swiss: SwissTournamentReport,
  decks: SwissRosterDeck[],
  aiLevel: AiLevel,
  maxActions: number,
  seed: number,
  addBehavior: (result: AiDetailedResult | null) => void,
): Promise<PlayoffReport> => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]))
  const ranked = swiss.standings.slice(0, 8).map((standing) => standingWithEntries(standing, byId))
  const rankById = new Map(ranked.map((standing) => [standing.deckId, standing.rank]))
  const matches: PlayoffMatch[] = []
  const play = (stage: PlayoffStage, table: number, leftId: string, rightId: string): string | null => {
    const left = byId.get(leftId)
    const right = byId.get(rightId)
    if (!left || !right) throw new Error(`Top cut 找不到牌組：${leftId} / ${rightId}`)
    const matchSeed = seed + 0x700000 + stage.length * 10000 + table
    const firstPlayerId: PlayerId = table % 2 === 0 ? 'player-one' : 'player-two'
    let result: AiDetailedResult | null = null
    let error: string | null = null
    try {
      result = simulateAiMatchDetailed(
        createCustomDeckMatch(matchSeed, left, right, firstPlayerId),
        maxActions,
        { levels: { 'player-one': aiLevel, 'player-two': aiLevel }, seed: matchSeed },
      )
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught)
    }
    addBehavior(result)
    const winnerPlayer = result?.endInfo.winner ?? null
    const winnerDeckId = winnerPlayer === 'player-one' ? left.id : winnerPlayer === 'player-two' ? right.id : null
    const loserDeckId = winnerPlayer === 'player-one' ? right.id : winnerPlayer === 'player-two' ? left.id : null
    matches.push({
      stage, table, seed: matchSeed, firstPlayerId, playerOneDeckId: left.id, playerTwoDeckId: right.id,
      winnerDeckId, loserDeckId, result: winnerDeckId ? 'win' : 'stuck', actions: result?.actions ?? 0,
      turns: result?.turnProgression.totalTurns ?? 0, reason: result?.endInfo.reason ?? null,
      error: error ?? result?.error ?? null,
    })
    return winnerDeckId
  }

  const quarterfinalPairs = [[ranked[0]!, ranked[7]!], [ranked[1]!, ranked[6]!], [ranked[2]!, ranked[5]!], [ranked[3]!, ranked[4]!]]
  const quarterfinalWinners: string[] = []
  const quarterfinalLosers: string[] = []
  for (const [table, [left, right]] of quarterfinalPairs.entries()) {
    const winner = play('quarterfinal', table + 1, left.deckId, right.deckId)
    if (!winner) return { status: 'FAIL', top8: ranked, top4: [], finalists: [], champion: null, runnerUp: null, finalOrder: ranked, matches }
    quarterfinalWinners.push(winner)
    quarterfinalLosers.push(winner === left.deckId ? right.deckId : left.deckId)
  }
  const semifinalWinners: string[] = []
  const semifinalLosers: string[] = []
  for (const [table, [leftId, rightId]] of [[quarterfinalWinners[0]!, quarterfinalWinners[3]!], [quarterfinalWinners[1]!, quarterfinalWinners[2]!]].entries()) {
    const winner = play('semifinal', table + 1, leftId, rightId)
    if (!winner) return { status: 'FAIL', top8: ranked, top4: [], finalists: [], champion: null, runnerUp: null, finalOrder: ranked, matches }
    semifinalWinners.push(winner)
    semifinalLosers.push(winner === leftId ? rightId : leftId)
  }
  const championId = play('final', 1, semifinalWinners[0]!, semifinalWinners[1]!)
  if (!championId) return { status: 'FAIL', top8: ranked, top4: [], finalists: [], champion: null, runnerUp: null, finalOrder: ranked, matches }
  const runnerUpId = championId === semifinalWinners[0] ? semifinalWinners[1]! : semifinalWinners[0]!
  const sortBySwissRank = (ids: string[]) => [...ids].sort((left, right) => (rankById.get(left) ?? 99) - (rankById.get(right) ?? 99))
  const finalOrderIds = [championId, runnerUpId, ...sortBySwissRank(semifinalLosers), ...sortBySwissRank(quarterfinalLosers)]
  const finalOrder = finalOrderIds.map((id, index) => ({ ...standingWithEntries(ranked.find((standing) => standing.deckId === id)!, byId), rank: index + 1 }))
  return {
    status: matches.every((match) => match.result === 'win') ? 'PASS' : 'FAIL',
    top8: ranked,
    top4: finalOrder.slice(0, 4),
    finalists: finalOrder.slice(0, 2),
    champion: finalOrder[0] ?? null,
    runnerUp: finalOrder[1] ?? null,
    finalOrder,
    matches,
  }
}

const buildFixedStandings = (decks: SwissRosterDeck[], matches: SwissMatchRecord[]): SwissStanding[] => {
  const byId = new Map(decks.map((deck, index) => [deck.id, {
    deck, drawOrder: index, points: 0, wins: 0, losses: 0, draws: 0, stuckMatches: 0, opponents: new Set<string>(), buchholz: 0,
  }]))
  for (const match of matches) {
    const left = byId.get(match.playerOneDeckId)!
    const right = byId.get(match.playerTwoDeckId)!
    left.opponents.add(right.deck.id); right.opponents.add(left.deck.id)
    if (match.winnerDeckId === left.deck.id) { left.wins += 1; left.points += 3; right.losses += 1 }
    else if (match.winnerDeckId === right.deck.id) { right.wins += 1; right.points += 3; left.losses += 1 }
    else { left.draws += 1; right.draws += 1; left.points += 1; right.points += 1; left.stuckMatches += 1; right.stuckMatches += 1 }
  }
  for (const standing of byId.values()) standing.buchholz = [...standing.opponents].reduce((sum, id) => sum + (byId.get(id)?.points ?? 0), 0)
  return [...byId.values()].sort((left, right) => right.points - left.points || right.buchholz - left.buchholz || left.drawOrder - right.drawOrder).map((standing, index) => ({
    rank: index + 1, deckId: standing.deck.id, name: standing.deck.name, color: standing.deck.color,
    seedChoice: standing.deck.seedChoice, generation: standing.deck.generation, points: standing.points,
    wins: standing.wins, losses: standing.losses, draws: standing.draws, games: standing.opponents.size,
    buchholz: standing.buchholz, stuckMatches: standing.stuckMatches, entries: standing.deck.entries,
  }))
}

const replayFixedSchedule = async (
  swiss: SwissTournamentReport,
  decks: SwissRosterDeck[],
  aiLevel: AiLevel,
  maxActions: number,
  seed: number,
): Promise<FixedControlResult> => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]))
  const matches: SwissMatchRecord[] = []
  const aggregate = emptyAggregate()
  for (const source of swiss.matches) {
    const left = byId.get(source.playerOneDeckId)!
    const right = byId.get(source.playerTwoDeckId)!
    const matchSeed = seed + source.round * 1_000_000 + (source.table - 1)
    let result: AiDetailedResult | null = null
    let error: string | null = null
    try {
      result = simulateAiMatchDetailed(
        createCustomDeckMatch(matchSeed, left, right, source.firstPlayerId),
        maxActions,
        { levels: { 'player-one': aiLevel, 'player-two': aiLevel }, seed: matchSeed },
      )
    } catch (caught) { error = caught instanceof Error ? caught.message : String(caught) }
    addResult(aggregate, result)
    const winnerPlayer = result?.endInfo.winner ?? null
    const winnerDeckId = winnerPlayer === 'player-one' ? left.id : winnerPlayer === 'player-two' ? right.id : null
    matches.push({
      ...source, winnerDeckId,
      loserDeckId: winnerPlayer === 'player-one' ? right.id : winnerPlayer === 'player-two' ? left.id : null,
      result: winnerDeckId ? 'win' : 'stuck', actions: result?.actions ?? 0,
      turns: result?.turnProgression.totalTurns ?? 0, reason: result?.endInfo.reason ?? null,
      error: error ?? result?.error ?? null,
    })
  }
  return { matches, standings: buildFixedStandings(decks, matches), quality: summarizeQuality(aggregate) }
}

const decklistMarkdown = (standing: SwissStanding): string => {
  const entries = standing.entries ?? []
  const lines = entries.map((entry) => {
    const card = getCardPoolEntry(entry.cardNumber)
    return `  - ${entry.count}x ${entry.cardNumber} ${card?.name ?? ''}`.trimEnd()
  })
  return [`### ${standing.rank}. ${standing.name}（${standing.color}，${standing.points} 分）`, '', ...lines].join('\n')
}

const buildMarkdown = (report: MarkdownReport): string => {
  const lv5 = report.lv5
  const control = report.lv4FixedScheduleControl
  const controlQuality = control?.quality ?? null
  const comparison = report.comparison
  const top8 = lv5.playoffs.finalOrder.slice(0, 8).map((standing: SwissStanding) => decklistMarkdown(standing)).join('\n\n')
  const colorRows = lv5.swiss.colors.map((color) => `| ${color.color} | ${color.deckCount} | ${color.averagePoints.toFixed(2)} | ${(color.averageWinRate * 100).toFixed(2)}% |`).join('\n')
  return `# Lv.5 AI 256 副牌組 Swiss 實戰報告

> 產生時間：${report.generatedAt}；本報告是專案 runtime benchmark，不等同官方賽事結果。

## 結論

- Lv.5 Swiss：${lv5.swiss.status}，${lv5.swiss.metrics.completedMatches}/${lv5.swiss.metrics.completedMatches + lv5.swiss.metrics.stuckMatches} 場完成，Top cut：${lv5.playoffs.status}。
- 冠軍：${lv5.playoffs.champion?.name ?? '未產生'}；亞軍：${lv5.playoffs.runnerUp?.name ?? '未產生'}。
- Lv.5 對同一批固定 pairing 的 Lv.4 控制組：${controlQuality ? `${controlQuality.completed}/${controlQuality.matches} 場完成；同一勝者比例 ${(comparison.sameWinnerRate * 100).toFixed(2)}%。` : '本次模式未執行。'}
- Lv.5 相對 Lv.4 的不一致場：Lv.5 較佳 ${comparison.pairedAdvantage.lv5Better}、Lv.4 較佳 ${comparison.pairedAdvantage.lv4Better}、平手 ${comparison.pairedAdvantage.ties}；Wilson 95% CI ${(comparison.pairedAdvantage.wilson95.lower * 100).toFixed(2)}%–${(comparison.pairedAdvantage.wilson95.upper * 100).toFixed(2)}%。
- 本輪「高手感」只以安全完成率、終局預判 telemetry、Combo 完成率、同 pairing 對照與淘汰賽收斂作為可重現 proxy，不把勝率直接等同真人強度。

## 賽事設定

| 項目 | 值 |
|---|---|
| 牌組數 | ${report.roster.totalDecks}（${Object.entries(report.roster.deckCountByColor).map(([color, count]) => `${color} ${count}`).join('／')}） |
| Swiss 輪數 | ${lv5.swiss.methodology.rounds} |
| Lv.5 maxActions | ${lv5.swiss.methodology.maxActions} |
| seed | ${lv5.swiss.methodology.seed} |
| 賽制 | standard；${report.banlistPolicy.region} ${report.banlistPolicy.updatedAt} |
| 禁限卡來源 | [BraverseFan 禁限卡表](${report.banlistPolicy.sourceUrl})；[官方公告](${report.banlistPolicy.officialSourceUrl}) |

## 顏色統計（Lv.5 Swiss）

| 顏色 | 副數 | 平均積分 | 平均勝率 |
|---|---:|---:|---:|
${colorRows}

## Top 8／Top 4／冠軍

Top 4：${lv5.playoffs.top4.map((standing: SwissStanding) => `${standing.rank}. ${standing.name}`).join('、')}

冠軍：**${lv5.playoffs.champion?.name ?? '未產生'}**；亞軍：**${lv5.playoffs.runnerUp?.name ?? '未產生'}**。

${top8}

## Lv.5 vs Lv.4 對照

| 指標 | Lv.5 Swiss／Top cut | Lv.4 固定 pairing |
|---|---:|---:|
| 完成率 | ${(lv5.quality.completionRate * 100).toFixed(2)}% | ${controlQuality ? `${(controlQuality.completionRate * 100).toFixed(2)}%` : '—'} |
| stuck / invalid / deadlock / turn cap | ${lv5.quality.stuck} / ${lv5.quality.invalidActions} / ${lv5.quality.deadlocks} / ${lv5.quality.turnCaps} | ${controlQuality ? `${controlQuality.stuck} / ${controlQuality.invalidActions} / ${controlQuality.deadlocks} / ${controlQuality.turnCaps}` : '—'} |
| Combo started / completed / abandoned | ${lv5.quality.comboStarted} / ${lv5.quality.comboCompleted} / ${lv5.quality.comboAbandoned} | ${controlQuality ? `${controlQuality.comboStarted} / ${controlQuality.comboCompleted} / ${controlQuality.comboAbandoned}` : '—'} |
| Refresh／空場 forecast | ${lv5.quality.refreshForecasts} / ${lv5.quality.emptyBattleForecasts} | ${controlQuality ? `${controlQuality.refreshForecasts} / ${controlQuality.emptyBattleForecasts}` : '—'} |
| 平均行動／回合 | ${lv5.quality.averageActions.toFixed(2)} / ${lv5.quality.averageTurns.toFixed(2)} | ${controlQuality ? `${controlQuality.averageActions.toFixed(2)} / ${controlQuality.averageTurns.toFixed(2)}` : '—'} |

### 門檻判讀

${report.gate.promotionReady ? '本輪達到預先設定的安全、完成、Top cut 與 paired advantage 門檻。' : '本輪未達到預先設定的完整升格門檻；請依下方 telemetry 針對 Combo、Refresh／空場預判或 matchup 弱點迭代，不能只用排名宣稱 Lv.5 已顯著超越 Lv.4。'}

## 限制

1. Swiss pairing 依實際勝負動態變化；Lv.4 控制組固定重播 Lv.5 pairing，故是 paired control，不是另一場獨立 Swiss。
2. 「高手感」是可量測 proxy，不是人工盲測；後續仍應加入真人玩家盲評、更多 seed 與 Browser 實戰抽樣。
3. banlist 是 ${report.banlistPolicy.updatedAt} 的 ASIA 版本化快照；官方公告更新後必須重新產生 roster 與報告。
`
}

const main = async () => {
  const rosterPath = resolve(root, argumentValue('roster') ?? 'data/decks/lv5-swiss-256-roster.json')
  const limit = positiveInteger('limit', 256)
  const rounds = positiveInteger('rounds', DEFAULT_ROUNDS)
  const seed = positiveInteger('seed', DEFAULT_SEED)
  const maxActions = positiveInteger('max-actions', DEFAULT_MAX_ACTIONS)
  const mode = argumentValue('mode') ?? 'both'
  if (mode !== 'both' && mode !== 'lv5') throw new Error('--mode 必須是 both 或 lv5。')
  const outputPath = resolve(root, argumentValue('output') ?? 'data/decks/lv5-swiss-256-report.json')
  const markdownPath = resolve(root, argumentValue('markdown') ?? 'docs/lv5-swiss-256-report.md')
  const decks = await parseRoster(rosterPath, limit)
  const behavior = emptyAggregate()
  const swiss = await runSwissTournament(decks, {
    rounds, seed, maxActions, aiLevel: 5, progressEvery: 64,
    onMatch: ({ result }) => { addResult(behavior, result) },
    onProgress: (progress) => process.stdout.write(`\rLv.5 Swiss round ${progress.round}/${progress.rounds} ${progress.completedMatches}/${progress.totalMatches}`),
  })
  process.stdout.write('\n')
  const playoffBehavior = emptyAggregate()
  const playoffs = await runPlayoffs(swiss, decks, 5, maxActions, seed, (result) => addResult(playoffBehavior, result))
  const lv5Quality = summarizeQuality({
    ...behavior,
    matches: behavior.matches + playoffBehavior.matches,
    completed: behavior.completed + playoffBehavior.completed,
    stuck: behavior.stuck + playoffBehavior.stuck,
    invalidActions: behavior.invalidActions + playoffBehavior.invalidActions,
    deadlocks: behavior.deadlocks + playoffBehavior.deadlocks,
    turnCaps: behavior.turnCaps + playoffBehavior.turnCaps,
    actions: behavior.actions + playoffBehavior.actions,
    turns: behavior.turns + playoffBehavior.turns,
    comboStarted: behavior.comboStarted + playoffBehavior.comboStarted,
    comboCompleted: behavior.comboCompleted + playoffBehavior.comboCompleted,
    comboAbandoned: behavior.comboAbandoned + playoffBehavior.comboAbandoned,
    endgameForecasts: behavior.endgameForecasts + playoffBehavior.endgameForecasts,
    refreshForecasts: behavior.refreshForecasts + playoffBehavior.refreshForecasts,
    emptyBattleForecasts: behavior.emptyBattleForecasts + playoffBehavior.emptyBattleForecasts,
    lethalOpportunities: behavior.lethalOpportunities + playoffBehavior.lethalOpportunities,
    lethalConversions: behavior.lethalConversions + playoffBehavior.lethalConversions,
    attackKillRateSum: behavior.attackKillRateSum + playoffBehavior.attackKillRateSum,
    attackKillRateSamples: behavior.attackKillRateSamples + playoffBehavior.attackKillRateSamples,
  })
  let control: FixedControlResult | null = null
  if (mode === 'both') {
    process.stdout.write('Lv.4 fixed pairing control...\n')
    control = await replayFixedSchedule(swiss, decks, 4, maxActions, seed)
  }
  const paired = { lv5Better: 0, lv4Better: 0, ties: 0 }
  if (control) {
    for (const [index, source] of swiss.matches.entries()) {
      const lv5Winner = source.winnerDeckId
      const lv4Winner = control.matches[index]?.winnerDeckId ?? null
      if (lv5Winner && !lv4Winner) paired.lv5Better += 1
      else if (lv4Winner && !lv5Winner) paired.lv4Better += 1
      else if (lv5Winner && lv4Winner && lv5Winner !== lv4Winner) {
        if (lv5Winner === source.playerOneDeckId) paired.lv5Better += 1
        else paired.lv4Better += 1
      } else paired.ties += 1
    }
  }
  const discordant = paired.lv5Better + paired.lv4Better
  const pairedWilson = wilson95(paired.lv5Better, discordant)
  const comparison = {
    pairedGames: control?.matches.length ?? 0,
    sameWinnerRate: control ? control.matches.filter((match, index) => match.winnerDeckId === swiss.matches[index]?.winnerDeckId).length / Math.max(1, control.matches.length) : 0,
    pairedAdvantage: { ...paired, wilson95: pairedWilson },
  }
  const rosterRaw = JSON.parse(await readFile(rosterPath, 'utf8')) as { methodology?: { deckCountByColor?: Record<string, number>; totalDecks?: number } }
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: swiss.status === 'PASS' && playoffs.status === 'PASS' && (!control || control.quality.safetyPass ? true : false) ? 'PASS' : 'FAIL',
    banlistPolicy: ACTIVE_BANLIST_POLICY,
    roster: { totalDecks: limit, deckCountByColor: rosterRaw.methodology?.deckCountByColor ?? {} },
    lv5: { swiss, playoffs, quality: lv5Quality },
    lv4FixedScheduleControl: control ? { quality: control.quality, standings: control.standings, matches: control.matches } : null,
    comparison,
    gate: {
      safetyPass: lv5Quality.safetyPass && (!control || control.quality.safetyPass),
      completionPass: lv5Quality.completionPass && (!control || control.quality.completionPass),
      topCutPass: playoffs.status === 'PASS',
      pairedAdvantagePass: discordant > 0 && pairedWilson.lower > 0.5,
      promotionReady: lv5Quality.safetyPass && lv5Quality.completionPass && playoffs.status === 'PASS' && discordant > 0 && pairedWilson.lower > 0.5,
    },
  }
  await mkdir(dirname(outputPath), { recursive: true })
  await mkdir(dirname(markdownPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  await writeFile(markdownPath, buildMarkdown(output), 'utf8')
  console.log(`Report written: ${outputPath}`)
  console.log(`Markdown written: ${markdownPath}`)
  console.log(JSON.stringify({ status: output.status, gate: output.gate, champion: output.lv5.playoffs.champion?.name, runnerUp: output.lv5.playoffs.runnerUp?.name }, null, 2))
}

await main()
