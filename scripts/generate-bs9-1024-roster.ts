import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import bs9RedTruthDeck from '../data/decks/bs9-red-truth.json'
import bs9YellowProphecyDeck from '../data/decks/bs9-yellow-prophecy.json'
import bs9GreenSupportDeck from '../data/decks/bs9-green-support.json'
import bs9BlueDeceitDeck from '../data/decks/bs9-blue-deceit.json'
import bs9PurpleMillDeck from '../data/decks/bs9-purple-mill.json'
import {
  getAllCardPoolEntries,
  getCardPoolEntry,
  validateCustomDeck,
  validateCustomDeckDefinition,
  type CustomDeck,
  type CustomDeckEntry,
  type TournamentColor,
} from '../src/game'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COLORS: TournamentColor[] = ['red', 'yellow', 'green', 'blue', 'purple']
const ROSTER_SIZE = 1024
const SEED = 20260913
const GENERATED_AT = '2026-09-13T00:00:00.000+08:00'
const OUTPUT = 'data/decks/bs9-lv5-1024-roster.json'

/** These cards have a formal runtime record but no safe Lv.5 decision model yet. */
const AI_UNSUPPORTED_CARDS = new Set([
  'BS9-043',
  'BS9-079',
  'BS9-096',
  'BS9-106',
  'BS9-107',
  'BS9-108',
  'BS9-111',
])

interface SeedDeck {
  color: TournamentColor
  choice: string
  entries: CustomDeckEntry[]
  extraDeckEntries: CustomDeckEntry[]
}

interface GeneratedRosterDeck extends CustomDeck {
  extraDeckEntries: CustomDeckEntry[]
  color: TournamentColor
  seedChoice: string
  generation: number
  profile: {
    series: 'BS9'
    bs9Cards: number
    extraDeckCards: number
    extraDeckBs9Cards: number
    uniqueCards: number
    flipCards: number
  }
}

const seedDecks: SeedDeck[] = [
  {
    color: 'red',
    choice: 'bs9-red-truth',
    entries: bs9RedTruthDeck.entries,
    extraDeckEntries: bs9RedTruthDeck.extraDeckEntries,
  },
  {
    color: 'yellow',
    choice: 'bs9-yellow-prophecy',
    entries: bs9YellowProphecyDeck.entries,
    extraDeckEntries: bs9YellowProphecyDeck.extraDeckEntries,
  },
  {
    color: 'green',
    choice: 'bs9-green-support',
    entries: bs9GreenSupportDeck.entries,
    extraDeckEntries: bs9GreenSupportDeck.extraDeckEntries,
  },
  {
    color: 'blue',
    choice: 'bs9-blue-deceit',
    entries: bs9BlueDeceitDeck.entries,
    extraDeckEntries: bs9BlueDeceitDeck.extraDeckEntries,
  },
  {
    color: 'purple',
    choice: 'bs9-purple-mill',
    entries: bs9PurpleMillDeck.entries,
    extraDeckEntries: bs9PurpleMillDeck.extraDeckEntries,
  },
]

const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

const shuffled = <T>(items: readonly T[], random: () => number): T[] => {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

const colorOf = (cardNumber: string): TournamentColor | null => {
  const card = getCardPoolEntry(cardNumber)
  const color = card?.color?.trim().toLowerCase().split(/\s+/)[0]
  return COLORS.includes(color as TournamentColor)
    ? color as TournamentColor
    : null
}

const baseEntries = (entries: readonly CustomDeckEntry[]): Map<string, number> =>
  new Map(entries.map((entry) => [entry.cardNumber, entry.count]))

const entriesFromCounts = (counts: Map<string, number>): CustomDeckEntry[] =>
  [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cardNumber, count]) => ({ cardNumber, count }))

const signature = (entries: readonly CustomDeckEntry[]): string =>
  entries.map((entry) => `${entry.cardNumber}:${entry.count}`).join('|')

const bs9Candidates = (color: TournamentColor): string[] =>
  getAllCardPoolEntries()
    .filter((card) =>
      card.baseCardNumber === card.cardNumber &&
      card.cardNumber.startsWith('BS9-') &&
      card.type !== 'extra' &&
      card.type !== 'unknown' &&
      !AI_UNSUPPORTED_CARDS.has(card.cardNumber) &&
      colorOf(card.cardNumber) === color &&
      card.flags.enabled &&
      !card.flags.hidden,
    )
    .map((card) => card.cardNumber)
    .sort()

const makeVariant = (
  seedDeck: SeedDeck,
  generation: number,
  random: () => number,
  used: Set<string>,
): CustomDeckEntry[] => {
  const candidates = bs9Candidates(seedDeck.color)
  const base = baseEntries(seedDeck.entries)
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const counts = new Map(base)
    const swaps = generation === 0 ? 0 : 1 + Math.floor(random() * 5)
    for (let swap = 0; swap < swaps; swap += 1) {
      const removable = shuffled(
        candidates.filter((cardNumber) => (counts.get(cardNumber) ?? 0) > 1),
        random,
      )
      const outgoing = removable[0]
      if (!outgoing) continue
      const incoming = shuffled(
        candidates.filter((cardNumber) =>
          cardNumber !== outgoing && (counts.get(cardNumber) ?? 0) < 4,
        ),
        random,
      )[0]
      if (!incoming) continue
      counts.set(outgoing, (counts.get(outgoing) ?? 0) - 1)
      counts.set(incoming, (counts.get(incoming) ?? 0) + 1)
    }
    const entries = entriesFromCounts(counts)
    const validation = validateCustomDeck(entries, { format: 'standard' })
    const key = signature(entries)
    if (validation.isValid && !used.has(key)) {
      used.add(key)
      return entries
    }
  }
  throw new Error(`無法為 ${seedDeck.choice} 產生第 ${generation} 副唯一合法變體。`)
}

const profileFor = (
  entries: readonly CustomDeckEntry[],
  extraDeckEntries: readonly CustomDeckEntry[],
) => {
  const validation = validateCustomDeck(entries, { format: 'standard' })
  return {
    series: 'BS9' as const,
    bs9Cards: entries.reduce(
      (total, entry) => total + (entry.cardNumber.startsWith('BS9-') ? entry.count : 0),
      0,
    ),
    extraDeckCards: extraDeckEntries.reduce((total, entry) => total + entry.count, 0),
    extraDeckBs9Cards: extraDeckEntries.reduce(
      (total, entry) => total + (entry.cardNumber.startsWith('BS9-') ? entry.count : 0),
      0,
    ),
    uniqueCards: entries.length,
    flipCards: validation.stats.flipCards,
  }
}

const main = async () => {
  const random = createSeededRandom(SEED)
  const used = new Set<string>()
  const decks: GeneratedRosterDeck[] = []
  const deckCounts = [205, 205, 205, 205, 204]

  for (const [colorIndex, seedDeck] of seedDecks.entries()) {
    for (let index = 0; index < deckCounts[colorIndex]!; index += 1) {
      const entries = makeVariant(seedDeck, index, random, used)
      const profile = profileFor(entries, seedDeck.extraDeckEntries)
      decks.push({
        id: `bs9-lv5-1024-${seedDeck.color}-${String(index + 1).padStart(3, '0')}`,
        name: `BS9 ${seedDeck.color} ${seedDeck.choice} #${String(index + 1).padStart(3, '0')}`,
        entries,
        extraDeckEntries: seedDeck.extraDeckEntries,
        format: 'standard',
        color: seedDeck.color,
        seedChoice: seedDeck.choice,
        generation: index,
        profile,
        createdAt: GENERATED_AT,
        updatedAt: GENERATED_AT,
      })
    }
  }

  if (decks.length !== ROSTER_SIZE || new Set(decks.map((deck) => deck.id)).size !== ROSTER_SIZE) {
    throw new Error(`BS9 roster 數量錯誤：${decks.length}。`)
  }
  for (const deck of decks) {
    const validation = validateCustomDeckDefinition(deck)
    if (!validation.isValid) throw new Error(`${deck.id} 不合法：${validation.errors.join('; ')}`)
    if (deck.entries.some((entry) => colorOf(entry.cardNumber) !== deck.color)) {
      throw new Error(`${deck.id} 含有非 ${deck.color} 卡片。`)
    }
    if (
      deck.extraDeckEntries.length !== 1 ||
      deck.extraDeckEntries[0]?.count !== 4 ||
      deck.extraDeckEntries.some((entry) =>
        !entry.cardNumber.startsWith('BS9-') || colorOf(entry.cardNumber) !== deck.color,
      )
    ) {
      throw new Error(`${deck.id} 的 EXTRA Deck 必須是 4 張同色 BS9 EXTRA。`)
    }
    if (deck.profile.bs9Cards !== 60) throw new Error(`${deck.id} 並非 60 張 BS9。`)
    if (deck.profile.extraDeckCards !== 4 || deck.profile.extraDeckBs9Cards !== 4) {
      throw new Error(`${deck.id} 的 EXTRA Deck 統計錯誤。`)
    }
  }

  const output = {
    schemaVersion: 1,
    generatedAt: GENERATED_AT,
    methodology: {
      tournamentId: 'bs9-lv5-1024-swiss',
      totalDecks: decks.length,
      deckCountByColor: Object.fromEntries(seedDecks.map((deck, index) => [deck.color, deckCounts[index]])),
      series: 'BS9',
      format: 'standard',
      seed: SEED,
      mutation: '五色 BS9 seed deck 的 0–4 張同色合法交換；保留每卡最多 4 張與 FLIP 最多 16 張。',
      extraDeck: '每副牌組附 4 張與主牌組同色的 BS9 EXTRA 核心 Cookie；不佔 60 張主牌組。',
      excludedForAiSafety: [...AI_UNSUPPORTED_CARDS].sort(),
      allCardsAreBs9: decks.every((deck) => deck.profile.bs9Cards === 60),
      allExtraDecksAreSameColorBs9: decks.every((deck) =>
        deck.profile.extraDeckCards === 4 && deck.profile.extraDeckBs9Cards === 4,
      ),
    },
    decks,
  }
  const outputPath = resolve(root, OUTPUT)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  console.log(`BS9 roster written: ${outputPath}`)
  console.log(JSON.stringify(output.methodology, null, 2))
}

await main()
