import type {
  CardSkill,
  CardEffect,
  EffectCondition,
  EffectTargetSelector,
} from '../game'
import { parseOfficialCardText } from './official-text-parser'
import type { OfficialCardRecord } from './types'

export type OfficialEffectConversion =
  | {
      status: 'supported'
      cardNumber: string
      sourceText: string
      effects: CardEffect[]
    }
  | {
      status: 'unsupported'
      cardNumber: string
      sourceText: string | null
      reason: 'no-effect-text' | 'unsupported-effect-text'
    }

const getEffectText = (card: OfficialCardRecord): string | null => {
  if (card.type === 'cookie') {
    return card.skill.text
  }

  if (card.type === 'flip') {
    return card.flipText
  }

  return card.attackText
}

const parseTarget = (text: string): EffectTargetSelector | null => {
  if (/\bthis Cookie\b/i.test(text)) {
    return {
      side: 'self',
      min: 1,
      max: 1,
      sourceOnly: true,
    }
  }

  const match = text.match(
    /Select\s+(up to\s+)?(\d+)\s+of\s+(your opponent's|your)(\s+other)?\s+Cookies/i,
  )

  if (!match) {
    return null
  }

  const target: EffectTargetSelector = {
    side: match[3].toLowerCase().includes("opponent's")
      ? 'opponent'
      : 'self',
    min: match[1] ? 0 : Number(match[2]),
    max: Number(match[2]),
  }

  if (match[4]) {
    target.excludeSource = true
  }

  const remainingHpMatch = text.match(/remaining HP is (\d+)/i)
  const minimumLevelMatch = text.match(/LV\.(\d+) or higher/i)

  if (remainingHpMatch) {
    target.remainingHp = Number(remainingHpMatch[1])
  }

  if (minimumLevelMatch) {
    target.minLevel = Number(minimumLevelMatch[1])
  }

  return target
}

const parseCondition = (text: string): EffectCondition | undefined => {
  const match = text.match(/break area is LV\.(\d+) or higher/i)

  return match
    ? {
        kind: 'break-level-at-least',
        level: Number(match[1]),
      }
    : undefined
}

export const convertOfficialCardEffects = (
  card: OfficialCardRecord,
): OfficialEffectConversion => {
  const sourceText = getEffectText(card)

  if (!sourceText) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'no-effect-text',
    }
  }

  const target = parseTarget(sourceText)

  if (!target) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  const condition = parseCondition(sourceText)
  const damageMatch = sourceText.match(/receives?\s+(\d+)\s+damage/i)

  if (damageMatch) {
    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: [
        {
          kind: 'damage',
          amount: Number(damageMatch[1]),
          target,
          condition,
        },
      ],
    }
  }

  const increaseMatch = sourceText.match(
    /gains?\s+\+(\d+)\s+attack damage/i,
  )
  const attackDecreaseMatch = sourceText.match(
    /deals?\s+-(\d+)\s+attack damage/i,
  )
  const receivedDamageMatch = sourceText.match(
    /receives?\s+-(\d+)\s+attack damage/i,
  )

  if (increaseMatch || attackDecreaseMatch || receivedDamageMatch) {
    const amount = increaseMatch
      ? Number(increaseMatch[1])
      : -Number((attackDecreaseMatch ?? receivedDamageMatch)![1])

    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: [
        {
          kind: receivedDamageMatch
            ? 'modify-damage-received'
            : 'modify-attack',
          amount,
          duration: /opponent's next turn/i.test(sourceText)
            ? 'opponent-next-turn'
            : 'this-turn',
          target,
          condition,
        },
      ],
    }
  }

  return {
    status: 'unsupported',
    cardNumber: card.cardNumber,
    sourceText,
    reason: 'unsupported-effect-text',
  }
}

export const convertOfficialCardEffectSet = (
  cards: OfficialCardRecord[],
): OfficialEffectConversion[] => cards.map(convertOfficialCardEffects)

export const convertOfficialCookieSkill = (
  card: OfficialCardRecord,
): CardSkill | undefined => {
  if (card.type !== 'cookie' || !card.skill.text) {
    return undefined
  }

  const conversion = convertOfficialCardEffects(card)
  const parsed = parseOfficialCardText(card.skill.text)

  if (conversion.status !== 'supported' || !parsed) {
    return undefined
  }

  return {
    trigger: parsed.markers.includes('ap')
      ? 'activate'
      : parsed.markers.includes('mob')
        ? 'on-play'
        : 'passive',
    oncePerTurn: parsed.markers.includes('t1'),
    yourTurn: parsed.markers.includes('mt'),
    restSource: /Rest this card/i.test(card.skill.text),
    cost: parsed.cost,
    text: conversion.sourceText,
    effects: conversion.effects,
  }
}
