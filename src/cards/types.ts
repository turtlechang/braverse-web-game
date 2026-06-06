import type { GameCard } from '../game'

export type OfficialCardType =
  | 'cookie'
  | 'item'
  | 'trap'
  | 'stage'
  | 'flip'
  | 'extra'
  | 'unknown'

export type EnergySymbol =
  | 'red'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'black'
  | 'neutral'

export interface OfficialCardRecord {
  sourceId: number
  locale: string
  cardNumber: string
  baseCardNumber: string
  variant: string | null
  name: string
  type: OfficialCardType
  officialType: string
  rarity: string | null
  grade: string | null
  level: number | null
  hp: number | null
  energyType: string | null
  color: string | null
  skill: {
    name: string | null
    text: string | null
  }
  attackText: string | null
  flipText: string | null
  keywords: string[]
  product: {
    id: number | null
    title: string | null
    category: string | null
  }
  restrictions: {
    banned: boolean
    limited: boolean
  }
  flags: {
    enabled: boolean
    hidden: boolean
    extra: boolean
  }
  imageUrl: string
  officialUpdatedAt: string | null
  sourceUrl: string
}

export interface ParsedCardText {
  raw: string
  displayText: string
  cost: Partial<Record<EnergySymbol, number>>
  totalCost: number
  damage: number | null
  markers: string[]
  unknownTokens: string[]
}

export interface ParsedOfficialCard {
  skillName: ParsedCardText | null
  skillText: ParsedCardText | null
  attack: ParsedCardText | null
  flip: ParsedCardText | null
}

export interface ConvertedOfficialCard {
  status: 'converted'
  gameCard: GameCard
  source: {
    cardNumber: string
    baseCardNumber: string
    variant: string | null
    imageUrl: string
    rarity: string | null
    productTitle: string | null
  }
  parsedText: ParsedOfficialCard
}

export interface UnsupportedOfficialCard {
  status: 'unsupported'
  cardNumber: string
  reason:
    | 'unsupported-card-type'
    | 'missing-cookie-stats'
    | 'missing-attack-definition'
}

export type OfficialCardConversion =
  | ConvertedOfficialCard
  | UnsupportedOfficialCard
