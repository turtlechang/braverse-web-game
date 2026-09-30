import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACTIVE_BANLIST_POLICY, AI_STRATEGY_VERSION, createSeededRandom, getAllCardPoolEntries, getCardPoolEntry,
  getDeckCopyLimit, validateCustomDeckDefinition, type CustomDeckEntry, type SwissRosterDeck, type TournamentColor,
} from '../src/game'
import { convertOfficialCardToGameCard } from '../src/cards/official-card-adapter'

export const COLORS: TournamentColor[] = ['red', 'yellow', 'green', 'blue', 'purple', 'black']
export const COLOR_NAMES: Record<TournamentColor, string> = { red: '紅', yellow: '黃', green: '綠', blue: '藍', purple: '紫', black: '黑' }
const date = '2026-09-30T00:00:00+08:00'
const numbers = (ids: number[]): CustomDeckEntry[] => ids.map((id) => ({ cardNumber: `BS11-${String(id).padStart(3, '0')}`, count: 4 }))
export const RECIPES: Record<TournamentColor, { name: string; plan: string; cards: number[]; anchors: number[] }> = {
  red: { name: '樂隊烈焰', plan: 'Macaron／Castanets 配合紅色物品；Fire Spirit 與 Nutmeg Tiger 調整 HP，Hollyberry 與 White Lily 串接 Ancient。', cards: [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 14, 16, 17, 18, 90], anchors: [2, 6, 16, 17, 90] },
  yellow: { name: '魔法休息區', plan: 'Wizard／Book 回收 FLIP；Smoked Cheese 與 Golden Cheese 操作休息區，Millennial Tree 續航，Eternal Sugar 加攻擊費用。', cards: [19, 20, 21, 23, 24, 25, 26, 28, 29, 30, 32, 34, 35, 36, 90], anchors: [21, 24, 26, 34, 35, 90] },
  green: { name: '風弓再活躍', plan: 'Director Q／Shine Muscat 恢復支援，Grand Dust Hotel 再活躍；Wind Archer 追加傷害與抽牌，Emerald 回收，Peach Blossom 群體補 HP。', cards: [38, 39, 40, 41, 42, 43, 44, 45, 46, 48, 49, 51, 52, 53, 90], anchors: [38, 42, 45, 49, 52, 90] },
  blue: { name: '海流控制', plan: 'Cream Soda／Soda Dollop 與 Sea Fairy 維持手牌；Net Cookie 與 Mirror 限制對手，Pure Vanilla／White Lily 支援 Ancient 與 EXTRA。', cards: [54, 56, 57, 58, 59, 60, 61, 63, 64, 65, 66, 68, 69, 70, 90], anchors: [56, 58, 65, 69, 70, 90] },
  purple: { name: '暗可可循環', plan: 'Espresso／Crunchy Chip 從棄牌區登場 Dark Cacao；Moonlight 回收高等級、Silent Salt 磨牌，White Lily 補 Ancient 搭配。', cards: [72, 74, 75, 76, 77, 78, 79, 82, 83, 84, 86, 87, 88, 89, 90], anchors: [79, 86, 87, 88, 89, 90] },
  black: { name: '魔女特殊登場', plan: '低等級黑色餅乾供 Mold／Pom-pom／Venom Special Play，再接 Dark Enchantress；Castle／Emblem 維持資源與 Awaken 條件。', cards: [92, 94, 95, 98, 100, 102, 103, 104, 106, 108, 109, 111, 112, 113, 115], anchors: [98, 108, 109, 111, 112, 113, 115] },
}
export const signature = (entries: CustomDeckEntry[]): string => [...entries].sort((a, b) => a.cardNumber.localeCompare(b.cardNumber))
  .map((entry) => `${entry.cardNumber}:${entry.count}`).join('|')
export const bs11Copies = (entries: CustomDeckEntry[]): number => entries.reduce((sum, entry) => sum + (entry.cardNumber.startsWith('BS11-') ? entry.count : 0), 0)

export const seedDeck = (color: TournamentColor): SwissRosterDeck => ({
  id: `bs11-${color}-seed`, name: `${COLOR_NAMES[color]}色｜${RECIPES[color].name}`, color, format: 'standard',
  entries: numbers(RECIPES[color].cards),
  extraDeckEntries: color === 'black' ? [{ cardNumber: 'BS11-116', count: 4 }, { cardNumber: 'BS11-091', count: 2 }] : [{ cardNumber: 'BS11-091', count: 4 }],
  createdAt: date, updatedAt: date,
})

export const generateRoster = (size = 1024, seed = 20260930): SwissRosterDeck[] => {
  if (!Number.isInteger(size) || size < 6 || size % 2) throw new Error('Roster size must be an even integer >= 6')
  const random = createSeededRandom(seed)
  const used = new Set<string>()
  const decks: SwissRosterDeck[] = []
  const pool = getAllCardPoolEntries().filter((card) => card.cardNumber === card.baseCardNumber && card.flags.enabled && !card.flags.hidden &&
    card.type !== 'extra' && card.type !== 'unknown' && getDeckCopyLimit(card.cardNumber) > 0 &&
    convertOfficialCardToGameCard(card).status === 'converted')
  for (const [colorIndex, color] of COLORS.entries()) {
    const base = seedDeck(color)
    const baseValidation = validateCustomDeckDefinition(base)
    if (!baseValidation.isValid) throw new Error(`${color}: ${baseValidation.errors.join('; ')}`)
    const count = Math.floor(size / COLORS.length) + (colorIndex < size % COLORS.length ? 1 : 0)
    const candidates = pool.filter((card) => card.color?.toLowerCase() === color)
    const anchors = new Set(RECIPES[color].anchors.map((id) => `BS11-${String(id).padStart(3, '0')}`))
    for (let generation = 0; generation < count; generation++) {
      let selected: CustomDeckEntry[] | null = null
      for (let attempt = 0; attempt < 1000; attempt++) {
        const counts = new Map(base.entries.map((entry) => [entry.cardNumber, entry.count]))
        const changes = generation === 0 ? 0 : 2 + Math.floor(random() * 7)
        for (let swap = 0; swap < changes; swap++) {
          const removable = [...counts].filter(([id, count]) => count > (anchors.has(id) ? 2 : 0) && getCardPoolEntry(id)?.color?.toLowerCase() === color)
          const outgoing = removable[Math.floor(random() * removable.length)]
          if (!outgoing) continue
          const original = getCardPoolEntry(outgoing[0])!
          const cookie = original.type === 'cookie' || original.type === 'flip'
          let incoming = candidates.filter((card) => card.cardNumber !== original.cardNumber && (counts.get(card.cardNumber) ?? 0) < getDeckCopyLimit(card.cardNumber) &&
            (cookie ? (card.type === 'cookie' || card.type === 'flip') && card.level === original.level : card.type === original.type))
          if (random() < 0.75) {
            const current = incoming.filter((card) => card.cardNumber.startsWith('BS11-'))
            if (current.length) incoming = current
          }
          const next = incoming[Math.floor(random() * incoming.length)]
          if (!next) continue
          counts.set(original.cardNumber, outgoing[1] - 1)
          counts.set(next.cardNumber, (counts.get(next.cardNumber) ?? 0) + 1)
        }
        const entries = [...counts].filter(([, count]) => count > 0).map(([cardNumber, count]) => ({ cardNumber, count }))
          .sort((a, b) => a.cardNumber.localeCompare(b.cardNumber))
        const key = signature(entries)
        if (bs11Copies(entries) >= 48 && !used.has(key) && validateCustomDeckDefinition({ ...base, entries }).isValid) {
          used.add(key); selected = entries; break
        }
      }
      if (!selected) throw new Error(`Cannot generate unique legal ${color} deck ${generation}`)
      const validation = validateCustomDeckDefinition({ ...base, entries: selected })
      decks.push({ ...base, id: `bs11-1024-${color}-${String(generation + 1).padStart(3, '0')}`,
        name: `${COLOR_NAMES[color]}色｜${RECIPES[color].name} #${String(generation + 1).padStart(3, '0')}`,
        entries: selected, generation, seedChoice: base.id,
        profile: { bs11Cards: bs11Copies(selected), uniqueCards: selected.length, flipCards: validation.stats.flipCards },
      })
    }
  }
  return decks
}

const main = async () => {
  const output = resolve('data/decks/bs11-1024-roster.json')
  const decks = generateRoster()
  const sourcePaths = getAllCardPoolEntries().map((card) => card.poolId)
  const datasetFiles = (await import('node:fs/promises')).readdir('data/cards')
  const hashes = await Promise.all((await datasetFiles).filter((name) => name.endsWith('.json')).sort().map(async (name) => ({
    file: `data/cards/${name}`, sha256: createHash('sha256').update(await readFile(`data/cards/${name}`)).digest('hex'),
  })))
  await mkdir(resolve('data/decks'), { recursive: true })
  const report = { generatedAt: new Date().toISOString(), seed: 20260930, aiStrategyVersion: AI_STRATEGY_VERSION,
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), banlist: ACTIVE_BANLIST_POLICY,
    methodology: 'Six balanced color groups; hand-designed BS11 seeds, 2-8 same-type/level swaps, >=48/60 BS11; unique main-deck compositions. PURE White Lily is shared in five colored shells. No outcome-based exclusions or seed selection.',
    sourceRecords: sourcePaths.length, sourceHashes: hashes, recipes: RECIPES,
    summary: { decks: decks.length, distinctMainDecks: new Set(decks.map((deck) => signature(deck.entries))).size,
      colors: COLORS.map((color) => ({ color, count: decks.filter((deck) => deck.color === color).length,
        minBs11: Math.min(...decks.filter((deck) => deck.color === color).map((deck) => bs11Copies(deck.entries))),
      })) }, decks }
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  for (const color of COLORS) await writeFile(resolve(`data/decks/bs11-${color}-seed.json`), `${JSON.stringify(seedDeck(color), null, 2)}\n`)
  console.log(JSON.stringify({ output, ...report.summary }, null, 2))
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main()
