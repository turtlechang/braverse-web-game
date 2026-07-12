import type { GameCard } from '../game'
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

const getEnergyColor = (
  card: OfficialCardRecord,
): GameCard['energyColor'] => {
  const color = card.color?.toLowerCase()
  if (
    color === 'red' ||
    color === 'yellow' ||
    color === 'green' ||
    color === 'blue' ||
    color === 'purple' ||
    color === 'black'
  ) {
    return color
  }

  if (card.energyType === 'MIX') {
    return 'wild'
  }

  return undefined
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
  const energyColor = getEnergyColor(card)
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

    if (!parsedText.attack || parsedText.attack.damage === null) {
      return {
        status: 'unsupported',
        cardNumber: card.cardNumber,
        reason: 'missing-attack-definition',
      }
    }

    const resolvedAttackEffects = convertOfficialAttackEffects(card)

    const gameCard: GameCard = {
      id: card.baseCardNumber,
      instanceId: createInstanceId(card, instanceSuffix),
      name: card.name,
      imageUrl: card.imageUrl,
      energyColor,
      officialType: card.type,
      type: 'cookie',
      level: card.level,
      hp: card.hp,
      attack: parsedText.attack.damage,
      attackCost: parsedText.attack.totalCost,
      attackEnergyCost: parsedText.attack.cost,
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
      energyColor,
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
