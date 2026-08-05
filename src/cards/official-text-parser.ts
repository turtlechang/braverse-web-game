import type {
  EnergySymbol,
  ParsedCardText,
  ParsedOfficialCard,
} from './types'

const ENERGY_SYMBOLS: Record<string, EnergySymbol> = {
  R: 'red',
  Y: 'yellow',
  G: 'green',
  B: 'blue',
  P: 'purple',
  K: 'black',
  N: 'neutral',
}

const DISPLAY_MARKERS: Record<string, string> = {
  sk: '',
  eq: '[Equip]',
  mou: '[Equip]',
  mob: '[Activate]',
  ap: '[OnPlay]',
  t1: '[Once per turn]',
  mt: '[Your Turn]',
  bl: '[Blocker]',
}

const KNOWN_NON_ENERGY_TOKENS = new Set([
  'da',
  'sk',
  'ap',
  'mob',
  't1',
  'bl',
  'mt',
  'eq',
  'mou',
])

const COST_PATTERN = /(?:<|《)((?:\{[A-Z]\})+)(?:>|》)/
const COST_PATTERN_GLOBAL = /(?:<|《)((?:\{[A-Z]\})+)(?:>|》)/g

const extractCost = (raw: string) => {
  const costMatch = raw.match(COST_PATTERN)
  const cost: Partial<Record<EnergySymbol, number>> = {}

  if (!costMatch) {
    return { cost, totalCost: 0 }
  }

  for (const tokenMatch of costMatch[1].matchAll(/\{([A-Z])\}/g)) {
    const energy = ENERGY_SYMBOLS[tokenMatch[1]]

    if (energy) {
      cost[energy] = (cost[energy] ?? 0) + 1
    }
  }

  return {
    cost,
    totalCost: Object.values(cost).reduce(
      (total, amount) => total + (amount ?? 0),
      0,
    ),
  }
}

const createDisplayText = (raw: string) =>
  raw
    .replace(COST_PATTERN_GLOBAL, (_, costTokens: string) => {
      const symbols = [...costTokens.matchAll(/\{([A-Z])\}/g)].map(
        (match) => match[1],
      )
      return `[Cost: ${symbols.join(' ')}]`
    })
    .replace(/\{da\}\s*(\d+)/g, 'Damage $1')
    .replace(/\{([A-Za-z0-9_]+)\}/g, (_, token: string) => {
      if (token in DISPLAY_MARKERS) {
        return DISPLAY_MARKERS[token]
      }

      if (token in ENERGY_SYMBOLS) {
        return `[${token}]`
      }

      return `[${token}]`
    })
    .replace(/\s+/g, ' ')
    .trim()

/**
 * BS5 起官方 JSON 改用全形【…】時機標記（【Activate】【On Play】…），
 * 舊系列用 {mob}/{ap} 大括號 token；在解析前正規化成同義 token，
 * 讓觸發判定與顯示文字共用同一條路徑。
 */
const normalizeTimingMarkers = (raw: string): string =>
  raw
    .replace(/【Activate】/g, '{mob}')
    .replace(/【On Play】/g, '{ap}')
    .replace(/【Once Per Turn】/g, '{t1}')
    .replace(/【Your Turn】/g, '{mt}')
    .replace(/【Blocker】/g, '{bl}')
    .replace(/【Equip】/g, '{eq}')

export const parseOfficialCardText = (
  rawText: string | null,
): ParsedCardText | null => {
  if (!rawText?.trim()) {
    return null
  }

  const raw = normalizeTimingMarkers(rawText.trim())
  const tokenNames = [...raw.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(
    (match) => match[1],
  )
  const { cost, totalCost } = extractCost(raw)
  const damageMatch =
    raw.match(/\{da\}\s*(\d+)/) ?? raw.match(/Deals?\s+(\d+)\s+damage/i)
  const markers = [
    ...new Set(
      tokenNames.filter(
        (token) => token in DISPLAY_MARKERS || KNOWN_NON_ENERGY_TOKENS.has(token),
      ),
    ),
  ]
  const unknownTokens = [
    ...new Set(
      tokenNames.filter(
        (token) =>
          !(token in ENERGY_SYMBOLS) && !KNOWN_NON_ENERGY_TOKENS.has(token),
      ),
    ),
  ]

  return {
    raw,
    displayText: createDisplayText(raw),
    cost,
    totalCost,
    damage: damageMatch ? Number(damageMatch[1]) : null,
    markers,
    unknownTokens,
  }
}

export const parseOfficialCardTexts = ({
  skill,
  attackText,
  flipText,
}: {
  skill: { name: string | null; text: string | null }
  attackText: string | null
  flipText: string | null
}): ParsedOfficialCard => ({
  skillName: parseOfficialCardText(skill.name),
  skillText: parseOfficialCardText(skill.text),
  attack: parseOfficialCardText(attackText),
  flip: parseOfficialCardText(flipText),
})
