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
  const match = text.match(
    /Select\s+(up to\s+)?(\d+)\s+of\s+(your opponent's|your)(\s+other)?\s+Cookies/i,
  )

  if (match) {
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

  if (/\bthis Cookie\b/i.test(text)) {
    return {
      side: 'self',
      min: 1,
      max: 1,
      sourceOnly: true,
    }
  }

  return null
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

const COST_OR_MARKER_RE = /\{[A-Za-z0-9_]+\}/g
const BRACKET_COST_RE = /(?:<|《)[^>》]*(?:>|》)/g
const DRAW_ONLY_RE = /^Draw\s+(up to\s+)?(\d+)\s+card(?:s)?\s+from\s+your\s+deck\.?$/i
const DECK_TO_SUPPORT_RE = /^Take\s+(\d+)\s+card(?:s)?\s+from\s+the\s+top\s+your\s+deck\s+and\s+place\s+(?:it|them)\s+in\s+your\s+support\s+area\s+as\s+active\.?$/i
const BREAK_TO_TRASH_RE = /^(?:If\s+your\s+break\s+area\s+is\s+LV\.(\d+)\s+or\s+higher,\s+)?Select\s+up\s+to\s+(\d+)\s+LV\.(\d+)\s+card\s+from\s+your\s+break\s+area\s+and\s+place\s+it\s+in\s+the\s+trash\.?$/i

const stripEffectText = (text: string): string =>
  text.replace(COST_OR_MARKER_RE, '').replace(BRACKET_COST_RE, '').replace(/\s+/g, ' ').trim()

const parseSimpleDraw = (stripped: string): number | null => {
  const match = stripped.match(DRAW_ONLY_RE)
  return match ? Number(match[2]) : null
}

const parseDeckToSupport = (stripped: string): number | null => {
  const match = stripped.match(DECK_TO_SUPPORT_RE)
  return match ? Number(match[1]) : null
}

interface ParsedBreakToTrash {
  max: number
  exactLevel: number
  conditionLevel?: number
}

const parseBreakToTrash = (stripped: string): ParsedBreakToTrash | null => {
  const match = stripped.match(BREAK_TO_TRASH_RE)
  return match
    ? {
        max: Number(match[2]),
        exactLevel: Number(match[3]),
        conditionLevel: match[1] ? Number(match[1]) : undefined,
      }
    : null
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

  if (/When this Cookie faints/i.test(sourceText)) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  if (/\bThen\b/i.test(sourceText)) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  if (/If\s+(?:\d+\s+of\s+)?your opponent's Cookies?\s+attacks?\s+more than\s+\d+/i.test(sourceText)) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  if (/(?:<|《)[^>》]*?(?:Place|Take|Discard)[^>》]*(?:>|》)/i.test(sourceText)) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  if (card.type === 'stage' && /Place in your stage area/i.test(sourceText)) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  if (card.type !== 'flip') {
    const drawAmount = parseSimpleDraw(stripEffectText(sourceText))

    if (drawAmount !== null) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'draw',
            amount: drawAmount,
          },
        ],
      }
    }

    const deckToSupportAmount = parseDeckToSupport(stripEffectText(sourceText))

    if (deckToSupportAmount !== null) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'deck-to-support',
            amount: deckToSupportAmount,
          },
        ],
      }
    }

    const breakToTrashParsed = parseBreakToTrash(stripEffectText(sourceText))

    if (breakToTrashParsed) {
      const effect: CardEffect = {
        kind: 'break-to-trash',
        max: breakToTrashParsed.max,
        exactLevel: breakToTrashParsed.exactLevel,
      }

      if (breakToTrashParsed.conditionLevel) {
        effect.condition = {
          kind: 'break-level-at-least',
          level: breakToTrashParsed.conditionLevel,
        }
      }

      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [effect],
      }
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
    trigger: parsed.markers.includes('mob')
      ? 'activate'
      : parsed.markers.includes('ap')
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
