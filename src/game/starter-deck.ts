import officialRedSample from '../../data/cards/official-sample.en.json'
import officialGreenSample from '../../data/cards/official-starter-deck-green.en.json'
import officialYellowSample from '../../data/cards/official-starter-deck-yellow.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
} from '../cards/official-effect-adapter'
import { parseOfficialCardText } from '../cards/official-text-parser'
import type { OfficialCardRecord } from '../cards/types'
import type { GameCard, PlayerId } from './types'

export type DeckChoice = 'red' | 'yellow' | 'green'

export interface StarterDeckEntry {
  cardNumber: string
  name: string
  count: number
}

export const OFFICIAL_RED_STARTER_DECK: StarterDeckEntry[] = [
  { cardNumber: 'ST1-001', name: 'Princess Cookie', count: 4 },
  { cardNumber: 'ST1-002', name: 'Ninja Cookie', count: 2 },
  { cardNumber: 'ST1-003', name: 'Dino-Sour Cookie', count: 2 },
  { cardNumber: 'ST1-004', name: 'Carrot Cookie', count: 4 },
  { cardNumber: 'ST1-005', name: 'Leek Cookie', count: 4 },
  { cardNumber: 'ST1-006', name: 'GingerBright', count: 4 },
  { cardNumber: 'ST1-007', name: 'Mint Choco Cookie', count: 2 },
  { cardNumber: 'ST1-008', name: 'Cherry Blossom Cookie', count: 2 },
  { cardNumber: 'ST1-009', name: 'Espresso Cookie', count: 2 },
  { cardNumber: 'ST1-010', name: 'Alchemist Cookie', count: 2 },
  { cardNumber: 'ST1-011', name: 'GingerBrave', count: 4 },
  { cardNumber: 'ST1-012', name: 'Zombie Cookie', count: 4 },
  { cardNumber: 'ST1-013', name: 'Adventurer Cookie', count: 4 },
  { cardNumber: 'ST1-014', name: 'Peperoncino Cookie', count: 2 },
  { cardNumber: 'ST1-015', name: 'Pistachio Cookie', count: 4 },
  { cardNumber: 'ST1-016', name: 'Icky Sticky Jelly', count: 2 },
  { cardNumber: 'ST1-017', name: 'Exceptional Cake Knife', count: 2 },
  { cardNumber: 'ST1-018', name: 'Sugar-Coated Snail Shell', count: 2 },
  { cardNumber: 'ST1-019', name: 'Fiery Jelly Clump', count: 2 },
  { cardNumber: 'ST1-020', name: 'Overhydrated Dough Swamp', count: 2 },
  { cardNumber: 'ST1-021', name: 'Ouch-Inducing Star Jelly', count: 2 },
  { cardNumber: 'ST1-022', name: 'Burning Jelly Volcano', count: 2 },
]

export const OFFICIAL_YELLOW_STARTER_DECK: StarterDeckEntry[] = [
  { cardNumber: 'ST2-001', name: 'Roguefort Cookie', count: 2 },
  { cardNumber: 'ST2-002', name: 'Strawberry Cookie', count: 4 },
  { cardNumber: 'ST2-003', name: 'Wizard Cookie', count: 2 },
  { cardNumber: 'ST2-004', name: 'Macaron Cookie', count: 2 },
  { cardNumber: 'ST2-005', name: 'Mustard Cookie', count: 4 },
  { cardNumber: 'ST2-006', name: 'GingerBright', count: 4 },
  { cardNumber: 'ST2-007', name: 'Chestnut Cookie', count: 4 },
  { cardNumber: 'ST2-008', name: 'Eclair Cookie', count: 2 },
  { cardNumber: 'ST2-009', name: 'GingerBrave', count: 4 },
  { cardNumber: 'ST2-010', name: 'Purple Yam Cookie', count: 4 },
  { cardNumber: 'ST2-011', name: 'Cherry Cookie', count: 4 },
  { cardNumber: 'ST2-012', name: 'Cheerleader Cookie', count: 4 },
  { cardNumber: 'ST2-013', name: 'Cheesecake Cookie', count: 4 },
  { cardNumber: 'ST2-014', name: 'Custard Cookie III', count: 4 },
  { cardNumber: 'ST2-015', name: 'Hero Cookie', count: 2 },
  { cardNumber: 'ST2-016', name: 'Flimsy Screwdriver', count: 2 },
  { cardNumber: 'ST2-018', name: 'Time Travel Ticket', count: 2 },
  { cardNumber: 'ST2-019', name: 'Multi-Vitamin Honey Bomb', count: 2 },
  { cardNumber: 'ST2-020', name: 'Winding Key Shield', count: 2 },
  { cardNumber: 'ST2-021', name: 'Pretzel Snare', count: 2 },
]

export const OFFICIAL_GREEN_STARTER_DECK: StarterDeckEntry[] = [
  { cardNumber: 'ST3-001', name: 'Muscle Cookie', count: 4 },
  { cardNumber: 'ST3-002', name: 'Strawberry Crepe Cookie', count: 2 },
  { cardNumber: 'ST3-003', name: 'GingerBright', count: 2 },
  { cardNumber: 'ST3-004', name: 'Vampire Cookie', count: 4 },
  { cardNumber: 'ST3-005', name: 'Blackberry Cookie', count: 4 },
  { cardNumber: 'ST3-006', name: 'Beet Cookie', count: 4 },
  { cardNumber: 'ST3-007', name: 'Sparkling Cookie', count: 2 },
  { cardNumber: 'ST3-008', name: 'Spinach Cookie', count: 2 },
  { cardNumber: 'ST3-009', name: 'Avocado Cookie', count: 2 },
  { cardNumber: 'ST3-010', name: 'Aloe Cookie', count: 2 },
  { cardNumber: 'ST3-011', name: 'Onion Cookie', count: 4 },
  { cardNumber: 'ST3-012', name: 'GingerBrave', count: 4 },
  { cardNumber: 'ST3-013', name: 'Knight Cookie', count: 4 },
  { cardNumber: 'ST3-014', name: 'Angel Cookie', count: 2 },
  { cardNumber: 'ST3-015', name: 'Chili Pepper Cookie', count: 4 },
  { cardNumber: 'ST3-016', name: "Ancient Healer's Gaze", count: 2 },
  { cardNumber: 'ST3-017', name: 'Viney Vines', count: 2 },
  { cardNumber: 'ST3-018', name: 'Parsley Tea of Invigoration', count: 2 },
  { cardNumber: 'ST3-019', name: 'Supreme Whipped Cream', count: 2 },
  { cardNumber: 'ST3-020', name: 'Divine Light Crystal', count: 2 },
  { cardNumber: 'ST3-021', name: 'Breath of the Flute', count: 2 },
  { cardNumber: 'ST3-022', name: "Guardian Tree's Blessing", count: 2 },
]

export const OFFICIAL_STARTER_DECK_RED = OFFICIAL_RED_STARTER_DECK

export const OFFICIAL_DECK_RECIPES: Record<DeckChoice, StarterDeckEntry[]> = {
  red: OFFICIAL_RED_STARTER_DECK,
  yellow: OFFICIAL_YELLOW_STARTER_DECK,
  green: OFFICIAL_GREEN_STARTER_DECK,
}

const getEnergyColor = (
  source: OfficialCardRecord,
): GameCard['energyColor'] => {
  const value =
    source.energyType === 'MIX' ? 'wild' : source.color?.toLowerCase()

  return value === 'red' ||
    value === 'yellow' ||
    value === 'green' ||
    value === 'blue' ||
    value === 'purple' ||
    value === 'black' ||
    value === 'wild'
    ? value
    : undefined
}

const createCard = (
  source: OfficialCardRecord,
  playerId: PlayerId,
  copyNumber: number,
): GameCard => {
  const effectConversion = convertOfficialCardEffects(source)
  const skill = convertOfficialCookieSkill(source)
  const flip = convertOfficialFlipAbility(source)
  const trap = convertOfficialTrapAbility(source)
  const item = convertOfficialItemAbility(source)
  const stageAbility = convertOfficialStageAbility(source)
  const base = {
    id: source.baseCardNumber,
    instanceId: `${playerId}-${source.cardNumber}-${copyNumber}`,
    name: source.name,
    imageUrl: source.imageUrl,
    energyColor: getEnergyColor(source),
    officialType: (source.type === 'flip'
      ? 'flip'
      : 'cookie') as GameCard['officialType'],
    ...(effectConversion.status === 'supported'
      ? {
          effectText: effectConversion.sourceText,
          effects: effectConversion.effects,
        }
      : {}),
  }

  if (
    (source.type === 'cookie' || source.type === 'flip') &&
    source.level !== null &&
    source.hp !== null
  ) {
    const parsedAttack = parseOfficialCardText(source.attackText)

    return {
      ...base,
      type: 'cookie',
      level: source.level,
      hp: source.hp,
      attack: Number(
        source.attackText?.match(/Deals?\s+(\d+)\s+damage/i)?.[1] ?? 1,
      ),
      attackCost: parsedAttack?.totalCost ?? 0,
      attackEnergyCost: parsedAttack?.cost ?? {},
      attackText: source.attackText ?? undefined,
      ...(skill ? { skill } : {}),
      ...(flip ? { flip } : {}),
    }
  }

  const runtimeType =
    source.type === 'trap' || source.type === 'stage'
      ? source.type
      : 'item'

  return {
    ...base,
    officialType: runtimeType,
    type: runtimeType,
    ...(trap ? { trap } : {}),
    ...(item ? { item } : {}),
    ...(stageAbility ? { stageAbility } : {}),
  }
}

const createOfficialStarterDeckFromRecipe = (
  playerId: PlayerId,
  recipe: StarterDeckEntry[],
  records: OfficialCardRecord[],
): GameCard[] => {
  const recordsByNumber = new Map(
    records.map((record) => [record.cardNumber, record]),
  )

  return recipe.flatMap((entry) => {
    const source = recordsByNumber.get(entry.cardNumber)
    if (!source) {
      throw new Error(`Missing official sample card ${entry.cardNumber}`)
    }

    return Array.from({ length: entry.count }, (_, index) =>
      createCard(source, playerId, index + 1),
    )
  })
}

export const createOfficialRedStarterDeck = (
  playerId: PlayerId,
): GameCard[] =>
  createOfficialStarterDeckFromRecipe(
    playerId,
    OFFICIAL_RED_STARTER_DECK,
    officialRedSample.cards as OfficialCardRecord[],
  )

export const createOfficialYellowStarterDeck = (
  playerId: PlayerId,
): GameCard[] =>
  createOfficialStarterDeckFromRecipe(
    playerId,
    OFFICIAL_YELLOW_STARTER_DECK,
    officialYellowSample.cards as OfficialCardRecord[],
  )

export const createOfficialGreenStarterDeck = (
  playerId: PlayerId,
): GameCard[] =>
  createOfficialStarterDeckFromRecipe(
    playerId,
    OFFICIAL_GREEN_STARTER_DECK,
    officialGreenSample.cards as OfficialCardRecord[],
  )

export const createOfficialStarterDeck = createOfficialRedStarterDeck

export const DECK_CREATORS: Record<
  DeckChoice,
  (playerId: PlayerId) => GameCard[]
> = {
  red: createOfficialRedStarterDeck,
  yellow: createOfficialYellowStarterDeck,
  green: createOfficialGreenStarterDeck,
}
