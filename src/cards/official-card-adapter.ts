import type { CardColor, CardKeyword, GameCard } from '../game'
import {
  convertOfficialCardEffects,
  convertOfficialAttackEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
} from './official-effect-adapter'
import { parseOfficialCardTexts } from './official-text-parser'
import type {
  OfficialCardConversion,
  OfficialCardRecord,
} from './types'

const NON_COOKIE_TYPE_MAP = {
  item: 'item',
  trap: 'trap',
  stage: 'stage',
} as const

const createInstanceId = (
  card: OfficialCardRecord,
  instanceSuffix: string,
) => `${card.cardNumber}:${instanceSuffix}`

const getCardColor = (card: OfficialCardRecord): CardColor | undefined => {
  const color = card.color?.toLowerCase()
  if (
    color === 'red' ||
    color === 'yellow' ||
    color === 'green' ||
    color === 'blue' ||
    color === 'purple' ||
    color === 'black' ||
    color === 'pure'
  ) {
    return color
  }

  return undefined
}

const getEnergyColor = (
  card: OfficialCardRecord,
  cardColor: CardColor | undefined,
): GameCard['energyColor'] => {
  if (cardColor) {
    return cardColor
  }

  if (card.energyType === 'MIX') {
    return 'wild'
  }

  return undefined
}

export const getRuntimeKeywords = (card: OfficialCardRecord): CardKeyword[] => {
  const keywords = new Set<CardKeyword>()

  if (card.keywords.some((keyword) => keyword.replace(/[{}]/g, '').trim().toLowerCase() === 'ancient')) {
    keywords.add('ancient')
  }

  if (/^Soul Jam\s*:/i.test(card.name.trim())) {
    keywords.add('soul-jam')
  }

  return [...keywords]
}

export const convertOfficialCardToGameCard = (
  card: OfficialCardRecord,
  instanceSuffix = '1',
): OfficialCardConversion => {
  const parsedText = parseOfficialCardTexts(card)
  const effectConversion = convertOfficialCardEffects(card)
  const skill = convertOfficialCookieSkill(card)
  const flip = convertOfficialFlipAbility(card)
  const trap = convertOfficialTrapAbility(card)
  const item = convertOfficialItemAbility(card)
  const stageAbility = convertOfficialStageAbility(card)
  const cardColor = getCardColor(card)
  const energyColor = getEnergyColor(card, cardColor)
  const keywords = getRuntimeKeywords(card)
  const hasSupportedEffect = effectConversion.status === 'supported'
  const effectData = hasSupportedEffect
    ? {
        effectText: effectConversion.sourceText,
        effects: effectConversion.effects,
      }
    : trap
      ? { effectText: trap.text, effects: trap.effects }
      : item
        ? { effectText: item.text, effects: item.effects }
        : stageAbility
          ? { effectText: stageAbility.text, effects: stageAbility.effects }
          : flip
            ? { effectText: flip.text, effects: flip.effects }
            : {}

  if (card.type === 'extra' || card.type === 'unknown') {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      reason: 'unsupported-card-type',
    }
  }

  if (card.type === 'cookie' || card.type === 'flip') {
    if (card.level === null || card.hp === null) {
      return {
        status: 'unsupported',
        cardNumber: card.cardNumber,
        reason: 'missing-cookie-stats',
      }
    }

    const hpOnlyFlip =
      card.type === 'flip' &&
      card.baseCardNumber === 'P-024' &&
      Boolean(flip)

    if (!parsedText.attack || parsedText.attack.damage === null) {
      if (!hpOnlyFlip) {
        return {
          status: 'unsupported',
          cardNumber: card.cardNumber,
          reason: 'missing-attack-definition',
        }
      }
    }

    const resolvedAttackEffects = convertOfficialAttackEffects(card)

    const gameCard: GameCard = {
      id: card.baseCardNumber,
      instanceId: createInstanceId(card, instanceSuffix),
      name: card.name,
      imageUrl: card.imageUrl,
      ...(cardColor ? { cardColor } : {}),
      energyColor,
      ...(keywords.length > 0 ? { keywords } : {}),
      officialType: card.type,
      type: 'cookie',
      level: card.level,
      hp: card.hp,
      attack: parsedText.attack?.damage ?? 0,
      attackCost: parsedText.attack?.totalCost ?? 0,
      attackEnergyCost: parsedText.attack?.cost ?? {},
      ...(hpOnlyFlip ? { nonAttackable: true } : {}),
      attackText: card.attackText ?? undefined,
      ...effectData,
      ...(skill ? { skill } : {}),
      ...(flip ? { flip } : {}),
      ...(resolvedAttackEffects ? { attackEffects: resolvedAttackEffects } : {}),
    }

    return {
      status: 'converted',
      gameCard,
      source: {
        cardNumber: card.cardNumber,
        baseCardNumber: card.baseCardNumber,
        variant: card.variant,
        imageUrl: card.imageUrl,
        rarity: card.rarity,
        productTitle: card.product.title,
      },
      parsedText,
    }
  }

  const mappedType = NON_COOKIE_TYPE_MAP[card.type]

  if (!mappedType) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      reason: 'unsupported-card-type',
    }
  }

  return {
    status: 'converted',
    gameCard: {
      id: card.baseCardNumber,
      instanceId: createInstanceId(card, instanceSuffix),
      name: card.name,
      imageUrl: card.imageUrl,
      ...(cardColor ? { cardColor } : {}),
      energyColor,
      ...(keywords.length > 0 ? { keywords } : {}),
      officialType: card.type,
      type: mappedType,
      ...effectData,
      ...(trap ? { trap } : {}),
      ...(item ? { item } : {}),
      ...(stageAbility ? { stageAbility } : {}),
    },
    source: {
      cardNumber: card.cardNumber,
      baseCardNumber: card.baseCardNumber,
      variant: card.variant,
      imageUrl: card.imageUrl,
      rarity: card.rarity,
      productTitle: card.product.title,
    },
    parsedText,
  }
}

export const convertOfficialCards = (
  cards: OfficialCardRecord[],
): OfficialCardConversion[] =>
  cards.map((card, index) =>
    convertOfficialCardToGameCard(card, String(index + 1)),
  )
