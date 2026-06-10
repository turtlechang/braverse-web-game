import type {
  AbilityCost,
  CardAbility,
  CardSkill,
  CardEffect,
  EffectCondition,
  EffectTargetSelector,
  FlipAbility,
  TrapAbility,
  StageAbility,
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

const parseAbilityCost = (text: string): AbilityCost => {
  const parsed = parseOfficialCardText(text)
  const discardMatch = text.match(
    /(?:<|《)\s*Discard\s+(\d+)\s+card(?:s)?\.\s*(?:>|》)/i,
  )

  return {
    energy: parsed?.cost ?? {},
    discardHand: discardMatch ? Number(discardMatch[1]) : 0,
  }
}

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

  const exactStarterEffects: Partial<Record<string, CardEffect[]>> = {
    'ST2-016': [
      {
        kind: 'disable-flip',
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'ST2-018': [
      { kind: 'draw', amount: 1 },
      {
        kind: 'view-hp',
        target: { side: 'self', min: 0, max: 1 },
        optional: true,
      },
    ],
    'ST2-019': [
      {
        kind: 'modify-all-attack',
        amount: 1,
        duration: 'this-turn',
        side: 'self',
        condition: { kind: 'break-level-at-least', level: 6 },
      },
    ],
    'ST3-016': [
      {
        kind: 'battle-to-support',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          maxLevel: 2,
        },
      },
    ],
    'ST3-017': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 2 },
      },
      { kind: 'support-to-trash', amount: 1 },
    ],
    'ST3-018': [{ kind: 'trash-to-battle', amount: 1 }],
  }
  const exactEffects = exactStarterEffects[card.cardNumber]
  if (exactEffects) {
    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: exactEffects,
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

export const convertOfficialItemAbility = (
  card: OfficialCardRecord,
): CardAbility | undefined => {
  if (card.type !== 'item' || !card.attackText) return undefined
  const conversion = convertOfficialCardEffects(card)
  const parsed = parseOfficialCardText(card.attackText)
  if (conversion.status !== 'supported' || !parsed) return undefined
  return {
    cost: parsed.cost,
    text: card.attackText,
    effects: conversion.effects,
  }
}

export const convertOfficialStageAbility = (
  card: OfficialCardRecord,
): StageAbility | undefined => {
  if (card.type !== 'stage' || !card.attackText) return undefined
  const [placementText, activationText] = card.attackText.split(/\{mob\}/i)
  const placement = parseOfficialCardText(placementText)
  const activation = parseOfficialCardText(activationText ?? '')
  if (!placement || !activation) return undefined

  const effects: Partial<Record<string, CardEffect[]>> = {
    'ST1-022': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1 },
      },
    ],
    'ST3-022': [
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'draw', amount: 1 },
    ],
  }
  const stageEffects = effects[card.cardNumber]
  if (!stageEffects) return undefined

  return {
    placementCost: placement.cost,
    cost: activation.cost,
    text: card.attackText,
    effects: stageEffects,
    restSource: /Rest this card/i.test(activationText ?? ''),
  }
}

export const convertOfficialCardEffectSet = (
  cards: OfficialCardRecord[],
): OfficialEffectConversion[] => cards.map(convertOfficialCardEffects)

export const convertOfficialFlipAbility = (
  card: OfficialCardRecord,
): FlipAbility | undefined => {
  if (card.type !== 'flip' || !card.flipText) {
    return undefined
  }

  const stripped = stripEffectText(card.flipText)
  const drawAmount = parseSimpleDraw(stripped)

  if (drawAmount !== null) {
    return {
      text: card.flipText,
      cost: parseAbilityCost(card.flipText),
      effects: [{ kind: 'draw', amount: drawAmount }],
    }
  }

  const gainHpMatch = stripped.match(
    /^The Cookie with this card attached for HP gains \+(\d+) HP\.?$/i,
  )

  if (gainHpMatch) {
    return {
      text: card.flipText,
      cost: parseAbilityCost(card.flipText),
      effects: [
        {
          kind: 'gain-hp',
          amount: Number(gainHpMatch[1]),
        },
      ],
    }
  }

  return undefined
}

const parseTrapCondition = (
  text: string,
): TrapAbility['condition'] | undefined => {
  const breakLevel = text.match(/break area is LV\.(\d+) or higher/i)
  if (breakLevel) {
    return {
      kind: 'break-level-at-least',
      level: Number(breakLevel[1]),
    }
  }

  const attackThreshold = text.match(
    /opponent's Cookies? attacks? more than (\d+) damage/i,
  )
  if (attackThreshold) {
    return {
      kind: 'attacker-attack-more-than',
      amount: Number(attackThreshold[1]),
    }
  }

  const faintedColor = text.match(
    /any of your \{([RYGBPK])\} Cookies fainted during this battle/i,
  )
  const colors = {
    R: 'red',
    Y: 'yellow',
    G: 'green',
    B: 'blue',
    P: 'purple',
    K: 'black',
  } as const
  const color = faintedColor
    ? colors[faintedColor[1] as keyof typeof colors]
    : undefined

  return color
    ? {
        kind: 'friendly-color-fainted-this-battle',
        color,
      }
    : undefined
}

export const convertOfficialTrapAbility = (
  card: OfficialCardRecord,
): TrapAbility | undefined => {
  if (card.type !== 'trap' || !card.attackText) {
    return undefined
  }

  const text = card.attackText
  const condition = parseTrapCondition(text)
  const target = parseTarget(text)
  const effects: CardEffect[] = []
  const attackDecrease = text.match(
    /deals?\s+-(\d+)\s+attack damage/i,
  )
  const damage = text.match(/receives?\s+(\d+)\s+damage/i)
  const preventKnockout = /HP cannot reach 0 during this battle/i.test(text)
  const supportToTrash = text.match(
    /place\s+(\d+)\s+card(?:s)?\s+from your support area into the trash/i,
  )
  const deckToRestedSupport = text.match(
    /take the top card from your deck and place it in your support area as rested/i,
  )

  if (attackDecrease && target) {
    effects.push({
      kind: 'modify-attack',
      amount: -Number(attackDecrease[1]),
      duration: 'this-turn',
      target,
    })
  }

  if (damage && target) {
    effects.push({
      kind: 'damage',
      amount: Number(damage[1]),
      target,
    })
  }

  if (preventKnockout && target) {
    effects.push({
      kind: 'prevent-knockout',
      target,
    })
  }

  if (supportToTrash) {
    effects.push({
      kind: 'support-to-trash',
      amount: Number(supportToTrash[1]),
    })
  }

  if (deckToRestedSupport) {
    effects.push({
      kind: 'deck-to-support',
      amount: 1,
      rested: true,
    })
  }

  if (effects.length === 0) {
    return undefined
  }

  return {
    text,
    cost: parseAbilityCost(text),
    condition,
    effects,
  }
}

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
