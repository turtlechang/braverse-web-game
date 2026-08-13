import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createDeckFromCustomDeck,
  createSeededRandom,
  getAllCardPoolEntries,
  getCardPoolEntry,
  getDeckCopyLimit,
  OFFICIAL_DECK_RECIPES,
  validateCustomDeck,
  type BuiltInDeckChoice,
  type CustomDeck,
  type TournamentColor,
} from '../src/game'
import type { CardPoolEntry } from '../src/game/card-pool'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROSTER_SIZE = 512
const COLORS: TournamentColor[] = ['red', 'yellow', 'green', 'blue', 'purple']
const GENERATOR_SEED = Number(process.env.BS_SWISS_GENERATOR_SEED ?? 20260813)
const isIteration = process.argv.includes('--iteration')
const reportArgument = process.argv.find((argument) => argument.startsWith('--report='))
const reportPath = resolve(
  root,
  reportArgument?.slice('--report='.length) ??
    'docs/bs1-bs6-512-swiss-report.json',
)
const outputPath = resolve(
  root,
  process.env.BS_SWISS_ROSTER_OUTPUT ??
    (isIteration
      ? 'data/decks/bs1-bs6-512-swiss-roster-iteration-1.json'
      : 'data/decks/bs1-bs6-512-swiss-roster.json'),
)

type Role = 'cookie' | 'support'
type SeriesBucket = 'bs6' | 'bs5' | 'legacy'

interface Candidate {
  card: CardPoolEntry
  cardNumber: string
  series: string
  role: Role
}

interface GeneratedDeck extends CustomDeck {
  color: TournamentColor
  seedChoice: BuiltInDeckChoice
  generation: number
  profile: {
    bs6Cards: number
    bs5Cards: number
    legacyCards: number
    seedBiasCards: number
  }
}

interface PreviousReport {
  colors?: Array<{
    color: TournamentColor
    topCards?: Array<{
      cardNumber: string
      appearances: number
    }>
  }>
}

const SEED_CHOICES: Record<TournamentColor, BuiltInDeckChoice[]> = {
  red: [
    'bs6-red-competitive',
    'bs6-red-standard',
    'bs5-red-standard',
    'bs5-red-open',
    'bs4-red-fire-spirit',
    'bs3-red-pitaya',
    'bs2-red',
    'red',
  ],
  yellow: [
    'bs6-yellow-competitive',
    'bs6-yellow-standard',
    'bs5-yellow-standard',
    'bs5-yellow-open',
    'bs4-yellow-millennial',
    'bs3-yellow-counter',
    'bs2-yellow',
    'yellow',
  ],
  green: [
    'bs6-green-competitive',
    'bs6-green-standard',
    'bs5-green-standard',
    'bs5-green-open',
    'bs4-green-wind-archer',
    'bs3-green-lily',
    'bs2-bean',
    'green',
  ],
  blue: [
    'bs6-blue-competitive',
    'bs6-blue-standard',
    'bs5-blue-standard',
    'bs5-blue-open',
    'bs4-blue-abyss',
    'bs3-blue-sorbet',
    'bs2-blue',
    'blue',
  ],
  purple: [
    'bs6-purple-competitive',
    'bs6-purple-standard',
    'bs5-purple-standard',
    'bs5-purple-open',
    'bs4-purple-moonlight',
    'bs3-purple-dark-cacao',
    'bs2-purple',
    'purple',
  ],
}

const toSeries = (cardNumber: string): string =>
  cardNumber.match(/^BS[1-6]/)?.[0] ?? 'other'

const toBucket = (series: string): SeriesBucket => {
  if (series === 'BS6') return 'bs6'
  if (series === 'BS5') return 'bs5'
  return 'legacy'
}

const toRole = (card: CardPoolEntry): Role =>
  card.type === 'cookie' || card.type === 'flip' ? 'cookie' : 'support'

const colorMatches = (card: CardPoolEntry, color: TournamentColor): boolean =>
  (card.color ?? '').trim().toLowerCase().split(/\s+/)[0] === color

const buildCandidates = (): Record<TournamentColor, Candidate[]> => {
  const byBase = new Map<string, CardPoolEntry>()
  for (const rawCard of getAllCardPoolEntries()) {
    if (!/^BS[1-6]-/.test(rawCard.cardNumber)) continue
    if (!rawCard.flags.enabled || rawCard.flags.hidden) continue
    const baseCardNumber = rawCard.baseCardNumber || rawCard.cardNumber
    if (!byBase.has(baseCardNumber)) {
      byBase.set(baseCardNumber, getCardPoolEntry(baseCardNumber) ?? rawCard)
    }
  }

  return Object.fromEntries(
    COLORS.map((color) => {
      const candidates = [...byBase.values()]
        .filter((card) => colorMatches(card, color))
        .filter((card) => getDeckCopyLimit(card.cardNumber, 'standard') >= 4)
        .filter((card) => card.type !== 'unknown' && card.type !== 'extra')
        .filter((card) =>
          card.type === 'cookie' || card.type === 'flip'
            ? card.level !== null && card.hp !== null
            : true,
        )
        .map((card) => ({
          card,
          cardNumber: card.baseCardNumber || card.cardNumber,
          series: toSeries(card.baseCardNumber || card.cardNumber),
          role: toRole(card),
        }))
      return [color, candidates]
    }),
  ) as Record<TournamentColor, Candidate[]>
}

const weightedPick = (
  candidates: Candidate[],
  used: Set<string>,
  random: () => number,
  seedCards: Set<string>,
  eliteWeights: Map<string, number>,
): Candidate => {
  const available = candidates.filter((candidate) => !used.has(candidate.cardNumber))
  if (available.length === 0) {
    throw new Error('候選卡不足以組成 15 種不同卡牌。')
  }
  const weights = available.map((candidate) => {
    const seedWeight = seedCards.has(candidate.cardNumber) ? 8 : 1
    const eliteWeight = eliteWeights.get(candidate.cardNumber) ?? 0
    return seedWeight + eliteWeight
  })
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let cursor = random() * total
  for (let index = 0; index < available.length; index += 1) {
    cursor -= weights[index]
    if (cursor <= 0) return available[index]
  }
  return available[available.length - 1]
}

const readPreviousReport = async (): Promise<PreviousReport | null> => {
  if (!isIteration) return null
  try {
    return JSON.parse(await readFile(reportPath, 'utf8')) as PreviousReport
  } catch {
    throw new Error(`找不到迭代所需的 Swiss report：${reportPath}`)
  }
}

const buildEliteWeights = (
  report: PreviousReport | null,
  color: TournamentColor,
): Map<string, number> => {
  const weights = new Map<string, number>()
  const colorReport = report?.colors?.find((entry) => entry.color === color)
  for (const card of colorReport?.topCards ?? []) {
    weights.set(card.cardNumber, Math.max(1, card.appearances) * 5)
  }
  return weights
}

const seedCardNumbers = (choice: BuiltInDeckChoice): Set<string> => {
  const numbers = new Set<string>()
  for (const entry of OFFICIAL_DECK_RECIPES[choice]) {
    const poolEntry = getCardPoolEntry(entry.cardNumber)
    numbers.add(poolEntry?.baseCardNumber ?? entry.cardNumber)
  }
  return numbers
}

const getSlotPlan = (): Array<{ bucket: SeriesBucket; role: Role; count: number }> =>
  isIteration
    ? [
        { bucket: 'bs6', role: 'cookie', count: 7 },
        // Yellow/green/purple each have only three legal BS6 support cards;
        // keep the iteration roster valid for every color and move the fourth
        // support slot to BS5 instead of silently reusing a card.
        { bucket: 'bs6', role: 'support', count: 3 },
        { bucket: 'bs5', role: 'cookie', count: 2 },
        { bucket: 'bs5', role: 'support', count: 2 },
        { bucket: 'legacy', role: 'cookie', count: 1 },
      ]
    : [
        { bucket: 'bs6', role: 'cookie', count: 6 },
        { bucket: 'bs6', role: 'support', count: 3 },
        { bucket: 'bs5', role: 'cookie', count: 2 },
        { bucket: 'bs5', role: 'support', count: 1 },
        { bucket: 'legacy', role: 'cookie', count: 2 },
        { bucket: 'legacy', role: 'support', count: 1 },
      ]

const createDeck = (
  index: number,
  color: TournamentColor,
  candidates: Candidate[],
  report: PreviousReport | null,
): GeneratedDeck => {
  const random = createSeededRandom(GENERATOR_SEED + index * 7919)
  const choices = SEED_CHOICES[color]
  const seedChoice = choices[Math.floor(random() * choices.length)]
  const used = new Set<string>()
  const seedCards = seedCardNumbers(seedChoice)
  const eliteWeights = buildEliteWeights(report, color)
  const entries: Array<{ cardNumber: string; count: number }> = []

  for (const slot of getSlotPlan()) {
    const pool = candidates.filter(
      (candidate) =>
        toBucket(candidate.series) === slot.bucket && candidate.role === slot.role,
    )
    const fallback = candidates.filter((candidate) => candidate.role === slot.role)
    for (let copy = 0; copy < slot.count; copy += 1) {
      const candidate = weightedPick(
        pool.length > 0 ? pool : fallback,
        used,
        random,
        seedCards,
        eliteWeights,
      )
      used.add(candidate.cardNumber)
      entries.push({ cardNumber: candidate.cardNumber, count: 4 })
    }
  }

  const deck: GeneratedDeck = {
    id: `bs1-bs6-swiss-${isIteration ? 'g1' : 'g0'}-${String(index + 1).padStart(3, '0')}`,
    name: `BS1-BS6 Swiss ${isIteration ? '迭代一代' : '初代'} ${color.toUpperCase()} #${String(index + 1).padStart(3, '0')}`,
    color,
    seedChoice,
    generation: isIteration ? 1 : 0,
    format: 'standard',
    entries,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profile: {
      bs6Cards: entries.filter((entry) => entry.cardNumber.startsWith('BS6-')).reduce((sum, entry) => sum + entry.count, 0),
      bs5Cards: entries.filter((entry) => entry.cardNumber.startsWith('BS5-')).reduce((sum, entry) => sum + entry.count, 0),
      legacyCards: entries.filter((entry) => !entry.cardNumber.startsWith('BS5-') && !entry.cardNumber.startsWith('BS6-')).reduce((sum, entry) => sum + entry.count, 0),
      seedBiasCards: entries.filter((entry) => seedCards.has(entry.cardNumber)).reduce((sum, entry) => sum + entry.count, 0),
    },
  }
  const validation = validateCustomDeck(deck.entries, { format: 'standard' })
  if (!validation.isValid) {
    throw new Error(`${deck.id} 不合法：${validation.errors.join('; ')}`)
  }
  if (createDeckFromCustomDeck(deck, 'player-one').length !== 60) {
    throw new Error(`${deck.id} 沒有產生 60 張 runtime deck。`)
  }
  return deck
}

const main = async () => {
  const report = await readPreviousReport()
  const candidatesByColor = buildCandidates()
  const decks: GeneratedDeck[] = []
  for (let index = 0; index < ROSTER_SIZE; index += 1) {
    const color = COLORS[index % COLORS.length]
    decks.push(createDeck(index, color, candidatesByColor[color], report))
  }

  const deckCountByColor = Object.fromEntries(
    COLORS.map((color) => [color, decks.filter((deck) => deck.color === color).length]),
  )
  const profileAverages = Object.fromEntries(
    COLORS.map((color) => {
      const colorDecks = decks.filter((deck) => deck.color === color)
      return [
        color,
        {
          bs6Cards: colorDecks.reduce((sum, deck) => sum + deck.profile.bs6Cards, 0) / colorDecks.length,
          bs5Cards: colorDecks.reduce((sum, deck) => sum + deck.profile.bs5Cards, 0) / colorDecks.length,
          legacyCards: colorDecks.reduce((sum, deck) => sum + deck.profile.legacyCards, 0) / colorDecks.length,
        },
      ]
    }),
  )
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: 'READY',
    methodology: {
      description: isIteration
        ? '以初代 Swiss 各色上位卡表加權迭代；每副 40 張 BS6、16 張 BS5、4 張 BS1-BS4，並保留合法 standard 禁限卡規則。'
        : '以既有官方 BS1-BS6／BS5／BS6 牌組配方為種子；每副 36 張 BS6、12 張 BS5、12 張 BS1-BS4，五色各自取牌，每種卡 4 張。',
      totalDecks: ROSTER_SIZE,
      format: 'standard',
      generatorSeed: GENERATOR_SEED,
      generation: isIteration ? 1 : 0,
      deckCountByColor,
      profileAverages,
      seedChoices: SEED_CHOICES,
      sourceReport: isIteration ? reportPath : null,
    },
    decks,
  }
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`Generated ${decks.length} BS1-BS6 Swiss decks: ${outputPath}`)
  console.log(JSON.stringify({ deckCountByColor, profileAverages }, null, 2))
}

await main()
