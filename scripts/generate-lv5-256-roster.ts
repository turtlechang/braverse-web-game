import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACTIVE_BANLIST_POLICY,
  createDeckFromCustomDeck,
  createSeededRandom,
  getCardPoolEntry,
  getDeckCopyLimit,
  OFFICIAL_DECK_RECIPES,
  validateCustomDeck,
  type BuiltInDeckChoice,
  type CustomDeckEntry,
  type TournamentColor,
} from '../src/game'
import {
  getAllCardPoolEntries,
  hasFlipAbility,
  type CardPoolEntry,
} from '../src/game/card-pool'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COLORS: TournamentColor[] = ['red', 'yellow', 'green', 'blue', 'purple']
const DEFAULT_SIZE = 256
const DEFAULT_SEED = 20260823

type Candidate = {
  card: CardPoolEntry
  cardNumber: string
  seedWeight: number
  flip: boolean
  series: string
}

interface GeneratedRosterDeck extends CustomDeck {
  color: TournamentColor
  seedChoice: string
  generation: number
  profile: {
    uniqueCards: number
    flipCards: number
    bs1Cards: number
    bs2Cards: number
    bs3Cards: number
    bs4Cards: number
    bs5Cards: number
    bs6Cards: number
    bs7Cards: number
    otherCards: number
  }
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

const shuffle = <T>(items: readonly T[], random: () => number): T[] => {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

const seriesOf = (cardNumber: string): string => {
  const match = cardNumber.match(/^(BS\d+|ST\d+|P)-/)
  return match?.[1] ?? 'other'
}

const colorOf = (card: CardPoolEntry): TournamentColor | null => {
  const color = (card.color ?? '').trim().toLowerCase().split(/\s+/)[0]
  return COLORS.includes(color as TournamentColor)
    ? (color as TournamentColor)
    : null
}

const uniqueBaseCards = (): CardPoolEntry[] => {
  const byBase = new Map<string, CardPoolEntry>()
  for (const raw of getAllCardPoolEntries()) {
    if (!raw.flags.enabled || raw.flags.hidden) continue
    if (raw.type === 'extra' || raw.type === 'unknown') continue
    const base = raw.baseCardNumber || raw.cardNumber
    const current = byBase.get(base)
    if (!current || raw.cardNumber === base) byBase.set(base, { ...raw, cardNumber: base })
  }
  return [...byBase.values()]
}

const seedChoices: Record<TournamentColor, BuiltInDeckChoice[]> = {
  red: [
    'bs7-red-arena', 'bs6-red-competitive', 'bs6-red-standard',
    'bs5-red-standard', 'bs4-red-fire-spirit', 'bs3-red-pitaya',
    'bs2-red', 'red',
  ],
  yellow: [
    'bs7-yellow-arena', 'bs6-yellow-competitive', 'bs6-yellow-standard',
    'bs5-yellow-standard', 'bs4-yellow-millennial', 'bs3-yellow-counter',
    'bs2-yellow', 'yellow',
  ],
  green: [
    'bs7-green-arena', 'bs6-green-competitive', 'bs6-green-standard',
    'bs5-green-standard', 'bs4-green-wind-archer', 'bs3-green-lily',
    'bs2-bean', 'green',
  ],
  blue: [
    'bs7-blue-arena', 'bs6-blue-competitive', 'bs6-blue-standard',
    'bs5-blue-standard', 'bs4-blue-abyss', 'bs3-blue-sorbet',
    'bs2-blue', 'blue',
  ],
  purple: [
    'bs7-purple-arena', 'bs6-purple-competitive', 'bs6-purple-standard',
    'bs5-purple-standard', 'bs4-purple-moonlight', 'bs3-purple-dark-cacao',
    'bs2-purple', 'purple',
  ],
}

const buildCandidates = (): Record<TournamentColor, Candidate[]> => {
  const cards = uniqueBaseCards()
  const seedCardSets = new Map<BuiltInDeckChoice, Set<string>>()
  for (const choices of Object.values(seedChoices)) {
    for (const choice of choices) {
      if (seedCardSets.has(choice)) continue
      const numbers = new Set<string>()
      for (const entry of OFFICIAL_DECK_RECIPES[choice]) {
        const card = getCardPoolEntry(entry.cardNumber)
        if (card) numbers.add(card.baseCardNumber || card.cardNumber)
      }
      seedCardSets.set(choice, numbers)
    }
  }

  return Object.fromEntries(COLORS.map((color) => {
    const candidates = cards
      .filter((card) => colorOf(card) === color)
      .filter((card) => getDeckCopyLimit(card.cardNumber, 'standard') > 0)
      .filter((card) => card.type === 'cookie' || card.type === 'flip' || card.type === 'item' || card.type === 'trap' || card.type === 'stage')
      .filter((card) => card.type !== 'cookie' && card.type !== 'flip' || (card.level !== null && card.hp !== null))
      .map((card) => ({
        card,
        cardNumber: card.baseCardNumber || card.cardNumber,
        seedWeight: Math.max(1, [...seedChoices[color]].reduce((sum, choice) => sum + Number(seedCardSets.get(choice)?.has(card.baseCardNumber || card.cardNumber) ?? false), 0)),
        flip: hasFlipAbility(card),
        series: seriesOf(card.baseCardNumber || card.cardNumber),
      }))
    if (candidates.length < 32) throw new Error(`${color} 合法候選卡不足：${candidates.length}`)
    return [color, candidates]
  })) as Record<TournamentColor, Candidate[]>
}

const sanitizeSeed = (choice: BuiltInDeckChoice): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const entry of OFFICIAL_DECK_RECIPES[choice]) {
    const card = getCardPoolEntry(entry.cardNumber)
    if (!card) continue
    const cardNumber = card.baseCardNumber || card.cardNumber
    const limit = getDeckCopyLimit(cardNumber, 'standard')
    if (limit === 0) continue
    counts.set(cardNumber, Math.min(limit, (counts.get(cardNumber) ?? 0) + entry.count))
  }
  return counts
}

const jaccard = (left: readonly CustomDeckEntry[], right: readonly CustomDeckEntry[]): number => {
  const a = new Set(left.map((entry) => entry.cardNumber))
  const b = new Set(right.map((entry) => entry.cardNumber))
  const intersection = [...a].filter((cardNumber) => b.has(cardNumber)).length
  return intersection / Math.max(1, new Set([...a, ...b]).size)
}

const createDeck = (
  index: number,
  color: TournamentColor,
  candidates: Candidate[],
  generatedAt: string,
  generatorSeed: number,
  previous: GeneratedRosterDeck[],
): GeneratedRosterDeck => {
  const random = createSeededRandom(generatorSeed + index * 7919)
  const choices = seedChoices[color]
  const seedChoice = choices[Math.floor(random() * choices.length)]
  const seed = sanitizeSeed(seedChoice)
  const targetUnique = 20 + (index * 7) % 9
  const seedCandidates = candidates.filter((candidate) => seed.has(candidate.cardNumber))
  const core = shuffle(seedCandidates, random).slice(0, Math.min(11 + (index % 5), targetUnique - 4))
  const chosen = new Map<string, Candidate>(core.map((candidate) => [candidate.cardNumber, candidate]))
  for (const candidate of shuffle(candidates, random)) {
    if (chosen.size >= targetUnique) break
    if (!chosen.has(candidate.cardNumber)) chosen.set(candidate.cardNumber, candidate)
  }
  if (chosen.size < targetUnique) throw new Error(`${color} 無法湊足 ${targetUnique} 種卡牌。`)

  const entries = [...chosen.values()].map((candidate) => ({
    cardNumber: candidate.cardNumber,
    count: Math.min(getDeckCopyLimit(candidate.cardNumber, 'standard'), seed.get(candidate.cardNumber) ?? 1),
  }))
  let total = entries.reduce((sum, entry) => sum + entry.count, 0)
  const candidateByNumber = new Map(candidates.map((candidate) => [candidate.cardNumber, candidate]))
  let flipTotal = entries.reduce((sum, entry) => sum + (candidateByNumber.get(entry.cardNumber)?.flip ? entry.count : 0), 0)
  while (flipTotal > 16) {
    const reducible = shuffle(entries, random).find((entry) => entry.count > 1 && candidateByNumber.get(entry.cardNumber)?.flip)
    if (!reducible) throw new Error(`${color} 初始核心超過 FLIP 上限且無法縮減。`)
    reducible.count -= 1
    total -= 1
    flipTotal -= 1
  }
  while (total > 60) {
    const reducible = shuffle(entries, random).find((entry) => entry.count > 1)
    if (!reducible) throw new Error(`${color} 初始牌組超過 60 張且無法縮減。`)
    reducible.count -= 1
    total -= 1
  }

  while (total < 60) {
    const order = shuffle(entries, random)
    const next = order.find((entry) => {
      const candidate = candidateByNumber.get(entry.cardNumber)
      const limit = getDeckCopyLimit(entry.cardNumber, 'standard')
      if (!candidate || entry.count >= limit) return false
      return !candidate.flip || flipTotal < 16
    })
    if (!next) throw new Error(`${color} 無法在 FLIP／copy limit 下補足 60 張。`)
    next.count += 1
    total += 1
    if (candidateByNumber.get(next.cardNumber)?.flip) flipTotal += 1
  }

  const normalizedEntries = entries.sort((left, right) => left.cardNumber.localeCompare(right.cardNumber))
  const duplicate = previous.some((deck) => jaccard(deck.entries, normalizedEntries) > 0.86)
  if (duplicate) {
    if (index > DEFAULT_SIZE * 3) throw new Error(`${color} 多樣性重試超過上限。`)
    return createDeck(index + DEFAULT_SIZE, color, candidates, generatedAt, generatorSeed, previous)
  }
  const validation = validateCustomDeck(normalizedEntries, { format: 'standard' })
  if (!validation.isValid) throw new Error(`lv5-256-${color}-${index} 不合法：${validation.errors.join('; ')}`)
  if (createDeckFromCustomDeck({ id: 'roster-check', name: 'roster-check', entries: normalizedEntries, createdAt: generatedAt, updatedAt: generatedAt }, 'player-one').length !== 60) {
    throw new Error(`${color} runtime deck 不是 60 張。`)
  }

  const profile = normalizedEntries.reduce<GeneratedRosterDeck['profile']>((summary, entry) => {
    const series = seriesOf(entry.cardNumber)
    summary.uniqueCards += 1
    summary.flipCards += Number(candidateByNumber.get(entry.cardNumber)?.flip ?? false) * entry.count
    if (series === 'BS1') summary.bs1Cards += entry.count
    else if (series === 'BS2') summary.bs2Cards += entry.count
    else if (series === 'BS3') summary.bs3Cards += entry.count
    else if (series === 'BS4') summary.bs4Cards += entry.count
    else if (series === 'BS5') summary.bs5Cards += entry.count
    else if (series === 'BS6') summary.bs6Cards += entry.count
    else if (series === 'BS7') summary.bs7Cards += entry.count
    else summary.otherCards += entry.count
    return summary
  }, { uniqueCards: 0, flipCards: 0, bs1Cards: 0, bs2Cards: 0, bs3Cards: 0, bs4Cards: 0, bs5Cards: 0, bs6Cards: 0, bs7Cards: 0, otherCards: 0 })

  return {
    id: `lv5-swiss-256-${String(index + 1).padStart(3, '0')}`,
    name: `Lv.5 Swiss 256 ${color.toUpperCase()} #${String(index + 1).padStart(3, '0')}`,
    color,
    seedChoice,
    generation: 0,
    format: 'standard',
    entries: normalizedEntries,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    profile,
  }
}

const main = async () => {
  const size = positiveInteger('size', DEFAULT_SIZE)
  if (size !== DEFAULT_SIZE) throw new Error(`本報告固定要求 ${DEFAULT_SIZE} 副，請使用 --size=${DEFAULT_SIZE}。`)
  const seed = Number(argumentValue('seed') ?? DEFAULT_SEED)
  if (!Number.isInteger(seed) || seed <= 0) throw new Error('--seed 必須是正整數。')
  const outputPath = resolve(root, argumentValue('output') ?? 'data/decks/lv5-swiss-256-roster.json')
  const generatedAt = new Date().toISOString()
  const candidates = buildCandidates()
  const decks: GeneratedRosterDeck[] = []
  for (let index = 0; index < size; index += 1) {
    const color = COLORS[index % COLORS.length]
    const colorDecks = decks.filter((deck) => deck.color === color)
    decks.push(createDeck(index, color, candidates[color], generatedAt, seed, colorDecks))
  }

  const deckCountByColor = Object.fromEntries(COLORS.map((color) => [color, decks.filter((deck) => deck.color === color).length]))
  const averageUniqueByColor = Object.fromEntries(COLORS.map((color) => {
    const colorDecks = decks.filter((deck) => deck.color === color)
    return [color, colorDecks.reduce((sum, deck) => sum + deck.profile.uniqueCards, 0) / colorDecks.length]
  }))
  const output = {
    schemaVersion: 1,
    generatedAt,
    status: 'READY',
    methodology: {
      description: '以 BS1–BS7、Starter、P 卡正式 runtime card pool 建立同色合法牌組；每副保留不同 seed 核心，再以 deterministic 變異與 Jaccard 相似度門檻提高構築差異。',
      totalDecks: size,
      format: 'standard',
      generatorSeed: seed,
      generation: 0,
      banlistPolicy: ACTIVE_BANLIST_POLICY,
      formalCardPoolEntries: uniqueBaseCards().length,
      deckCountByColor,
      averageUniqueByColor,
      similarityGuard: '同色新牌組與既有牌組的 card-number Jaccard <= 0.86。',
      seedChoices,
    },
    decks,
  }
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`Generated ${decks.length} Lv.5 Swiss roster decks: ${outputPath}`)
  console.log(JSON.stringify({ deckCountByColor, averageUniqueByColor }, null, 2))
}

await main()
