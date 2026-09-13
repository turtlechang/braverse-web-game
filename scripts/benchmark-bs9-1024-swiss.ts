import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AI_STRATEGY_VERSION,
  createAiTournamentExperienceAccumulator,
  createCustomDeckMatch,
  finalizeAiTournamentExperience,
  getCardPoolEntry,
  recordAiTournamentMatchExperience,
  runSwissTournament,
  simulateAiMatchDetailed,
  validateCustomDeckDefinition,
  type AiDetailedResult,
  type AiTournamentExperienceProfile,
  type PlayerId,
  type SwissMatchRecord,
  type SwissRosterDeck,
  type SwissStanding,
  type SwissTournamentReport,
} from '../src/game'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_ROSTER = 'data/decks/bs9-lv5-1024-roster.json'
const DEFAULT_OUTPUT = 'data/decks/bs9-lv5-1024-report.json'
const DEFAULT_MARKDOWN = 'docs/bs9-lv5-1024-report.md'
const DEFAULT_EXPERIENCE = 'data/ai/bs9-lv5-experience.json'
const DEFAULT_ROUNDS = 10
const DEFAULT_SEED = 20260913
const DEFAULT_MAX_ACTIONS = 2500
const DEFAULT_HOLDOUT_SIZE = 256
const DEFAULT_HOLDOUT_ROUNDS = 8

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

interface MatchSummary {
  matches: number
  completed: number
  stuck: number
  actions: number
  turns: number
  playerOneWins: number
  playerTwoWins: number
}

const argumentValue = (name: string): string | undefined => {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

const positiveInteger = (name: string, fallback: number): number => {
  const value = Number(argumentValue(name) ?? fallback)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} 必須是正整數。`)
  }
  return value
}

const nonNegativeInteger = (name: string, fallback: number): number => {
  const value = Number(argumentValue(name) ?? fallback)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} 必須是非負整數。`)
  }
  return value
}

const parseRoster = async (
  path: string,
  limit: number,
): Promise<SwissRosterDeck[]> => {
  const raw = JSON.parse(await readFile(path, 'utf8')) as {
    decks?: SwissRosterDeck[]
  }
  if (!Array.isArray(raw.decks) || raw.decks.length < limit) {
    throw new Error(`BS9 roster 不足 ${limit} 副，實際為 ${raw.decks?.length ?? 0} 副。`)
  }
  if (limit < 8 || limit % 2 !== 0) {
    throw new Error('--limit 必須是至少 8 的偶數。')
  }
  const decks = raw.decks.slice(0, limit)
  const ids = new Set<string>()
  for (const deck of decks) {
    if (ids.has(deck.id)) throw new Error(`Roster 有重複 deck id：${deck.id}`)
    ids.add(deck.id)
    if (deck.color === undefined || !deck.id.startsWith('bs9-lv5-1024-')) {
      throw new Error(`${deck.id} 不是 BS9 1024 roster deck。`)
    }
    const extraDeckEntries = deck.extraDeckEntries ?? []
    const extraDeckCards = extraDeckEntries.reduce((total, entry) => total + entry.count, 0)
    if (extraDeckCards !== 4 || extraDeckEntries.length !== 1) {
      throw new Error(`${deck.id} 缺少 4 張同色 BS9 EXTRA Deck。`)
    }
    if (extraDeckEntries.some((entry) => {
      const card = getCardPoolEntry(entry.cardNumber)
      return !entry.cardNumber.startsWith('BS9-') || card?.type !== 'extra' ||
        card.color?.toLowerCase() !== deck.color
    })) {
      throw new Error(`${deck.id} 的 EXTRA Deck 必須全部是 ${deck.color} BS9 EXTRA。`)
    }
    const validation = validateCustomDeckDefinition(deck)
    if (!validation.isValid) {
      throw new Error(`${deck.id} 牌組驗證失敗：${validation.errors.join('；')}`)
    }
  }
  return decks
}

const standingWithEntries = (
  standing: SwissStanding,
  decks: Map<string, SwissRosterDeck>,
): SwissStanding => ({
  ...standing,
  entries: decks.get(standing.deckId)?.entries,
  extraDeckEntries: decks.get(standing.deckId)?.extraDeckEntries,
})

const matchResult = (
  left: SwissRosterDeck,
  right: SwissRosterDeck,
  firstPlayerId: PlayerId,
  seed: number,
  maxActions: number,
  experienceProfile: AiTournamentExperienceProfile | null,
): { record: Omit<PlayoffMatch, 'stage' | 'table'>; result: AiDetailedResult | null } => {
  let result: AiDetailedResult | null = null
  let error: string | null = null
  try {
    result = simulateAiMatchDetailed(
      createCustomDeckMatch(seed, left, right, firstPlayerId),
      maxActions,
      {
        levels: { 'player-one': 5, 'player-two': 5 },
        seed,
        experienceProfile,
      },
    )
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught)
  }
  const winnerPlayer = result?.endInfo.winner ?? null
  const winnerDeckId = winnerPlayer === 'player-one'
    ? left.id
    : winnerPlayer === 'player-two'
      ? right.id
      : null
  return {
    result,
    record: {
      seed,
      firstPlayerId,
      playerOneDeckId: left.id,
      playerTwoDeckId: right.id,
      winnerDeckId,
      loserDeckId: winnerPlayer === 'player-one'
        ? right.id
        : winnerPlayer === 'player-two'
          ? left.id
          : null,
      result: winnerDeckId ? 'win' : 'stuck',
      actions: result?.actions ?? 0,
      turns: result?.turnProgression.totalTurns ?? 0,
      reason: result?.endInfo.reason ?? null,
      error: error ?? result?.error ?? null,
    },
  }
}

const runPlayoffs = (
  swiss: SwissTournamentReport,
  decks: SwissRosterDeck[],
  maxActions: number,
  seed: number,
  experienceProfile: AiTournamentExperienceProfile | null,
): PlayoffReport => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]))
  const ranked = swiss.standings
    .slice(0, 8)
    .map((standing) => standingWithEntries(standing, byId))
  const rankById = new Map(ranked.map((standing) => [standing.deckId, standing.rank]))
  const matches: PlayoffMatch[] = []
  const play = (
    stage: PlayoffStage,
    table: number,
    leftId: string,
    rightId: string,
  ): string | null => {
    const left = byId.get(leftId)
    const right = byId.get(rightId)
    if (!left || !right) throw new Error(`Top cut 找不到牌組：${leftId} / ${rightId}`)
    const matchSeed = seed + 0x700000 + stage.length * 10000 + table
    const firstPlayerId: PlayerId = table % 2 === 0 ? 'player-one' : 'player-two'
    const played = matchResult(
      left,
      right,
      firstPlayerId,
      matchSeed,
      maxActions,
      experienceProfile,
    )
    matches.push({ stage, table, ...played.record })
    return played.record.winnerDeckId
  }

  if (ranked.length < 8) {
    return {
      status: 'FAIL',
      top8: ranked,
      top4: [],
      finalists: [],
      champion: null,
      runnerUp: null,
      finalOrder: ranked,
      matches,
    }
  }

  const quarterfinalPairs: [SwissStanding, SwissStanding][] = [
    [ranked[0]!, ranked[7]!],
    [ranked[1]!, ranked[6]!],
    [ranked[2]!, ranked[5]!],
    [ranked[3]!, ranked[4]!],
  ]
  const quarterfinalWinners: string[] = []
  const quarterfinalLosers: string[] = []
  for (const [table, [left, right]] of quarterfinalPairs.entries()) {
    const winner = play('quarterfinal', table + 1, left.deckId, right.deckId)
    if (!winner) {
      return {
        status: 'FAIL', top8: ranked, top4: [], finalists: [], champion: null,
        runnerUp: null, finalOrder: ranked, matches,
      }
    }
    quarterfinalWinners.push(winner)
    quarterfinalLosers.push(winner === left.deckId ? right.deckId : left.deckId)
  }

  const semifinalWinners: string[] = []
  const semifinalLosers: string[] = []
  const semifinalPairs: [string, string][] = [
    [quarterfinalWinners[0]!, quarterfinalWinners[3]!],
    [quarterfinalWinners[1]!, quarterfinalWinners[2]!],
  ]
  for (const [table, [leftId, rightId]] of semifinalPairs.entries()) {
    const winner = play('semifinal', table + 1, leftId, rightId)
    if (!winner) {
      return {
        status: 'FAIL', top8: ranked, top4: [], finalists: [], champion: null,
        runnerUp: null, finalOrder: ranked, matches,
      }
    }
    semifinalWinners.push(winner)
    semifinalLosers.push(winner === leftId ? rightId : leftId)
  }

  const championId = play('final', 1, semifinalWinners[0]!, semifinalWinners[1]!)
  if (!championId) {
    return {
      status: 'FAIL', top8: ranked, top4: [], finalists: [], champion: null,
      runnerUp: null, finalOrder: ranked, matches,
    }
  }
  const runnerUpId = championId === semifinalWinners[0]
    ? semifinalWinners[1]!
    : semifinalWinners[0]!
  const sortBySwissRank = (ids: string[]) => [...ids].sort(
    (left, right) => (rankById.get(left) ?? 99) - (rankById.get(right) ?? 99),
  )
  const finalOrderIds = [
    championId,
    runnerUpId,
    ...sortBySwissRank(semifinalLosers),
    ...sortBySwissRank(quarterfinalLosers),
  ]
  const finalOrder = finalOrderIds.map((id, index) => ({
    ...standingWithEntries(ranked.find((standing) => standing.deckId === id)!, byId),
    rank: index + 1,
  }))
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

const emptySummary = (): MatchSummary => ({
  matches: 0,
  completed: 0,
  stuck: 0,
  actions: 0,
  turns: 0,
  playerOneWins: 0,
  playerTwoWins: 0,
})

const addResult = (
  summary: MatchSummary,
  record: Pick<SwissMatchRecord, 'winnerDeckId' | 'playerOneDeckId' | 'actions' | 'turns' | 'result'>,
): void => {
  summary.matches += 1
  summary.actions += record.actions
  summary.turns += record.turns
  if (record.result === 'win' && record.winnerDeckId) {
    summary.completed += 1
    if (record.winnerDeckId === record.playerOneDeckId) summary.playerOneWins += 1
    else summary.playerTwoWins += 1
  } else {
    summary.stuck += 1
  }
}

const replaySchedule = (
  schedule: readonly SwissMatchRecord[],
  decks: SwissRosterDeck[],
  maxActions: number,
  scheduleSeed: number,
  experienceProfile: AiTournamentExperienceProfile | null,
): { matches: SwissMatchRecord[]; summary: MatchSummary } => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]))
  const matches: SwissMatchRecord[] = []
  const summary = emptySummary()
  for (const source of schedule) {
    const left = byId.get(source.playerOneDeckId)
    const right = byId.get(source.playerTwoDeckId)
    if (!left || !right) throw new Error(`Holdout schedule 找不到牌組：${source.playerOneDeckId}`)
    const matchSeed = scheduleSeed + source.round * 1_000_000 + (source.table - 1)
    const played = matchResult(
      left,
      right,
      source.firstPlayerId,
      matchSeed,
      maxActions,
      experienceProfile,
    )
    const record: SwissMatchRecord = {
      ...source,
      winnerDeckId: played.record.winnerDeckId,
      loserDeckId: played.record.loserDeckId,
      result: played.record.result === 'win' ? 'win' : 'stuck',
      actions: played.record.actions,
      turns: played.record.turns,
      reason: played.record.reason,
      error: played.record.error,
    }
    matches.push(record)
    addResult(summary, record)
  }
  return { matches, summary }
}

const decklistMarkdown = (standing: SwissStanding): string => {
  const entries = standing.entries ?? []
  const lines = entries.map((entry) => {
    const card = getCardPoolEntry(entry.cardNumber)
    return `  - ${entry.count}x ${entry.cardNumber} ${card?.name ?? ''}`.trimEnd()
  })
  const extraLines = (standing.extraDeckEntries ?? []).map((entry) => {
    const card = getCardPoolEntry(entry.cardNumber)
    return `  - ${entry.count}x ${entry.cardNumber} ${card?.name ?? ''}`.trimEnd()
  })
  return [
    `### ${standing.rank}. ${standing.name}（${standing.color}，${standing.points} 分）`,
    '',
    '主牌組：',
    ...lines,
    '',
    'EXTRA Deck：',
    ...(extraLines.length > 0 ? extraLines : ['  - （未配置）']),
  ].join('\n')
}

const pct = (value: number): string => `${(value * 100).toFixed(2)}%`

const buildMarkdown = (report: {
  generatedAt: string
  tournament: {
    swiss: SwissTournamentReport
    playoffs: PlayoffReport
  }
  experience: AiTournamentExperienceProfile
  holdout: {
    rosterSize: number
    rounds: number
    scheduleMatches: number
    baseline: MatchSummary
    trained: MatchSummary
    trainedWinsOverBaseline: number
    baselineWinsOverTrained: number
    sameWinner: number
  } | null
}): string => {
  const { swiss, playoffs } = report.tournament
  const top8 = playoffs.finalOrder
    .slice(0, 8)
    .map((standing) => decklistMarkdown(standing))
    .join('\n\n')
  const colorRows = swiss.colors
    .map((color) => `| ${color.color} | ${color.deckCount} | ${color.averagePoints.toFixed(2)} | ${pct(color.averageWinRate)} |`)
    .join('\n')
  const profileCardCount = Object.keys(report.experience.cardActionWeights).length
  const holdout = report.holdout
  return `# BS9 Lv.5 AI 1024 人瑞士制實戰報告

> 產生時間：${report.generatedAt}；這是專案 runtime 的可重現模擬，不是官方賽事結果。

## 結論

- 1024 副 BS9 五色牌組完成 ${swiss.methodology.rounds} 輪 Swiss：${swiss.metrics.completedMatches}/${swiss.metrics.totalMatches} 場完成，狀態 **${swiss.status}**。
- 每副主牌組都載入 4 張同色 BS9 EXTRA Deck；對局開局與 AI 決策使用同一份正式 EXTRA runtime 卡片。
- Top cut：${playoffs.status}；冠軍：**${playoffs.champion?.name ?? '未產生'}**；亞軍：**${playoffs.runnerUp?.name ?? '未產生'}**。
- 四強：${playoffs.top4.map((standing) => standing.name).join('、') || '未產生'}。
- 經驗 profile 已由 ${report.experience.source.rosterSize} 副、${report.experience.source.swissMatches} 場 Swiss 的公開 Lv.5 決策樣本產生；啟用 ${profileCardCount} 張 BS9 卡片的卡片／動作權重。
${holdout ? `- ${holdout.rosterSize} 副、${holdout.rounds} 輪固定 pairing holdout：訓練後勝出 ${holdout.trainedWinsOverBaseline} 場、baseline 勝出 ${holdout.baselineWinsOverTrained} 場、同勝者 ${holdout.sameWinner} 場。` : '- 未執行 holdout。'}

## 賽事設定

| 項目 | 值 |
|---|---|
| 參賽副數 | ${swiss.methodology.rosterSize}（紅／黃／綠／藍／紫各約 204–205） |
| Swiss 輪數／場數 | ${swiss.methodology.rounds}／${swiss.methodology.totalMatches} |
| Top cut | 8 → 四強 → 冠軍（7 場淘汰賽） |
| AI | Lv.5；strategy ${report.experience.strategyVersion} |
| maxActions | ${swiss.methodology.maxActions} |
| seed | ${swiss.methodology.seed} |
| 賽制 | standard；正式 BS9 卡池 |
| EXTRA Deck | 每副 4 張同色 BS9 核心 EXTRA Cookie；不佔主牌組 60 張 |

## 五色統計

| 顏色 | 副數 | 平均積分 | 平均勝率 |
|---|---:|---:|---:|
${colorRows}

## Top 8／四強／冠軍

${top8}

## Lv.5 經驗注入

經驗只在候選動作的來源卡片仍位於自己的公開手牌／戰鬥區／支援區／棄牌區／破壞區／場景時套用；每筆權重限制在 -24～+24，終局結果與規則合法性仍由原有核心決定。

- profile id：${report.experience.id}
- public action weights：${Object.keys(report.experience.actionWeights).length}
- card/action weights：${profileCardCount}
- strategy version：${report.experience.strategyVersion}

${holdout ? `## Holdout 對照

| 指標 | 無經驗 baseline | 注入 BS9 經驗 |
|---|---:|---:|
| 完成場數 | ${holdout.baseline.completed}/${holdout.baseline.matches} | ${holdout.trained.completed}/${holdout.trained.matches} |
| 卡住場數 | ${holdout.baseline.stuck} | ${holdout.trained.stuck} |
| player-one 勝場 | ${holdout.baseline.playerOneWins} | ${holdout.trained.playerOneWins} |
| 平均行動 | ${(holdout.baseline.actions / Math.max(1, holdout.baseline.matches)).toFixed(2)} | ${(holdout.trained.actions / Math.max(1, holdout.trained.matches)).toFixed(2)} |

「訓練後勝出」是同一 fixed schedule 下逐場比較 winner，不將同一場兩次 replay 當成獨立樣本；此結果是本輪 holdout 的證據，仍需更多 seed 與真人盲評。` : ''}

## 限制

1. 牌組是 BS9 正式卡池內的五色 60 張同色變異，另附 4 張同色 BS9 EXTRA；為維持 Lv.5 訓練安全，排除目前尚未有安全 AI decision model 的 BS9 主牌卡片，EXTRA 卡則由正式 EXTRA runtime 載入。
2. Swiss／淘汰賽由純規則 runtime 模擬，不能把排名直接宣稱為真人競技強度。
3. 經驗是有界的公開資訊先驗，不會跨局保存隱藏牌資訊；若官方規則、禁限卡表或 BS9 runtime 改變，必須重新產生 roster、報告與 profile。
`
}

const main = async () => {
  const rosterPath = resolve(root, argumentValue('roster') ?? DEFAULT_ROSTER)
  const limit = positiveInteger('limit', 1024)
  const rounds = positiveInteger('rounds', DEFAULT_ROUNDS)
  const seed = positiveInteger('seed', DEFAULT_SEED)
  const maxActions = positiveInteger('max-actions', DEFAULT_MAX_ACTIONS)
  const holdoutSize = Math.min(
    limit,
    nonNegativeInteger('holdout-size', Math.min(DEFAULT_HOLDOUT_SIZE, limit)),
  )
  const holdoutRounds = positiveInteger('holdout-rounds', DEFAULT_HOLDOUT_ROUNDS)
  const decks = await parseRoster(rosterPath, limit)
  const experienceAccumulator = createAiTournamentExperienceAccumulator()
  const swiss = await runSwissTournament(decks, {
    rounds,
    seed,
    maxActions,
    aiLevel: 5,
    experienceProfile: null,
    progressEvery: 32,
    onMatch: ({ result }) => {
      if (result) {
        recordAiTournamentMatchExperience(
          experienceAccumulator,
          result.decisionProfileByPlayer,
          result.endInfo.winner,
        )
      }
    },
    onProgress: (progress) => {
      process.stdout.write(`\rBS9 Lv.5 Swiss ${progress.round}/${progress.rounds} ${progress.completedMatches}/${progress.totalMatches}`)
    },
  })
  process.stdout.write('\n')

  const playoffs = runPlayoffs(swiss, decks, maxActions, seed, null)
  const generatedAt = new Date().toISOString()
  const experience = finalizeAiTournamentExperience(experienceAccumulator, {
    id: 'bs9-lv5-1024-swiss',
    strategyVersion: AI_STRATEGY_VERSION,
    series: 'BS9',
    source: {
      tournamentId: 'bs9-lv5-1024-swiss',
      rosterSize: limit,
      rounds,
      swissMatches: swiss.matches.length,
      seed,
      generatedAt,
    },
  })

  const holdout = holdoutSize > 0
    ? (() => {
        const holdoutDecks = decks.slice(0, holdoutSize)
        return { holdoutDecks }
      })()
    : null
  let holdoutReport: {
    rosterSize: number
    rounds: number
    scheduleMatches: number
    baseline: MatchSummary
    trained: MatchSummary
    trainedWinsOverBaseline: number
    baselineWinsOverTrained: number
    sameWinner: number
  } | null = null
  if (holdout) {
    process.stdout.write(`BS9 fixed holdout baseline ${holdoutSize} decks × ${holdoutRounds} rounds...\n`)
    const holdoutSchedule = await runSwissTournament(holdout.holdoutDecks, {
      rounds: holdoutRounds,
      seed: seed ^ 0x13579bdf,
      maxActions,
      aiLevel: 5,
      experienceProfile: null,
      progressEvery: 64,
    })
    const baseline = replaySchedule(
      holdoutSchedule.matches,
      holdout.holdoutDecks,
      maxActions,
      seed ^ 0x13579bdf,
      null,
    )
    const trained = replaySchedule(
      holdoutSchedule.matches,
      holdout.holdoutDecks,
      maxActions,
      seed ^ 0x13579bdf,
      experience,
    )
    let trainedWinsOverBaseline = 0
    let baselineWinsOverTrained = 0
    let sameWinner = 0
    for (const [index, baselineMatch] of baseline.matches.entries()) {
      const trainedMatch = trained.matches[index]
      if (baselineMatch.winnerDeckId === trainedMatch?.winnerDeckId) {
        sameWinner += 1
      } else if (trainedMatch?.winnerDeckId) {
        trainedWinsOverBaseline += 1
      } else if (baselineMatch.winnerDeckId) {
        baselineWinsOverTrained += 1
      }
    }
    holdoutReport = {
      rosterSize: holdoutSize,
      rounds: holdoutRounds,
      scheduleMatches: holdoutSchedule.matches.length,
      baseline: baseline.summary,
      trained: trained.summary,
      trainedWinsOverBaseline,
      baselineWinsOverTrained,
      sameWinner,
    }
  }

  const outputPath = resolve(root, argumentValue('output') ?? DEFAULT_OUTPUT)
  const markdownPath = resolve(root, argumentValue('markdown') ?? DEFAULT_MARKDOWN)
  const experiencePath = resolve(root, argumentValue('experience-output') ?? DEFAULT_EXPERIENCE)
  const output = {
    schemaVersion: 1,
    generatedAt,
    status: swiss.status === 'PASS' && playoffs.status === 'PASS' &&
      (!holdoutReport || holdoutReport.baseline.stuck === 0 && holdoutReport.trained.stuck === 0)
      ? 'PASS'
      : 'FAIL',
    tournament: { swiss, playoffs },
    experience: {
      ...experience,
      trainingMatches: experienceAccumulator.matches,
      decisiveTrainingMatches: experienceAccumulator.decisiveMatches,
    },
    holdout: holdoutReport,
  }
  await mkdir(dirname(outputPath), { recursive: true })
  await mkdir(dirname(markdownPath), { recursive: true })
  await mkdir(dirname(experiencePath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  await writeFile(experiencePath, `${JSON.stringify(experience, null, 2)}\n`, 'utf8')
  await writeFile(markdownPath, buildMarkdown(output), 'utf8')
  console.log(`Report written: ${outputPath}`)
  console.log(`Markdown written: ${markdownPath}`)
  console.log(`Experience written: ${experiencePath}`)
  console.log(JSON.stringify({
    status: output.status,
    champion: playoffs.champion?.name ?? null,
    runnerUp: playoffs.runnerUp?.name ?? null,
    top4: playoffs.top4.map((standing) => standing.name),
    trainedExperienceMatches: experienceAccumulator.matches,
    holdout: holdoutReport,
  }, null, 2))
}

await main()
