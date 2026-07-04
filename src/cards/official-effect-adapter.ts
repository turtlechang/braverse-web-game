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
  ReturnToHandEffect,
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
    /Select\s+(up to\s+)?(\d+)\s+of\s+(your opponent's|your)(\s+other)?\s+(?:LV\.(\d+)\s+)?Cookies/i,
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

    if (match[5]) {
      target.maxLevel = Number(match[5])
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
  const breakLevelMatch = text.match(/break area is LV\.(\d+) or higher/i)
  if (breakLevelMatch) {
    return {
      kind: 'break-level-at-least',
      level: Number(breakLevelMatch[1]),
    }
  }

  const supportCountMatch = text.match(
    /support area contains? (\d+) or more cards/i,
  )
  if (supportCountMatch) {
    return {
      kind: 'support-count-at-least',
      count: Number(supportCountMatch[1]),
    }
  }

  const handCountMatch = text.match(/(\d+) cards? or less in your hand/i)
  return handCountMatch
    ? { kind: 'hand-count-at-most', count: Number(handCountMatch[1]) }
    : undefined
}

const isUnsupportedBracketCost = (text: string): boolean => {
  const brackets = text.match(BRACKET_COST_RE) ?? []

  for (const bracket of brackets) {
    const inner = bracket.slice(1, -1).trim()

    if (/^(?:\{[A-Z]\})+$/.test(inner)) {
      continue
    }

    if (/^Discard\s+\d+\s+card(?:s)?\.?$/i.test(inner)) {
      continue
    }

    if (
      /^Place\s+\d+\s+card(?:s)?\s+from\s+your\s+support\s+area\s+into\s+the\s+trash\.?$/i.test(
        inner,
      )
    ) {
      continue
    }

    if (
      /Place\s+.+Cookie\s+from\s+your\s+battle\s+area\s+into\s+the\s+trash/i.test(
        inner,
      )
    ) {
      continue
    }

    if (/(?:Place|Take|Discard)/i.test(inner)) {
      return true
    }
  }

  return false
}

const COST_OR_MARKER_RE = /\{[A-Za-z0-9_]+\}/g
const BRACKET_COST_RE = /(?:<|《)[^>》]*(?:>|》)/g
const DRAW_ONLY_RE = /^(?:You can\s+)?Draw\s+(up to\s+)?(\d+)\s+card(?:s)?\s+from\s+your\s+deck\.?$/i
const DECK_TO_SUPPORT_RE = /^Take\s+(\d+)\s+card(?:s)?\s+from\s+the\s+top(?:\s+of)?\s+your\s+deck\s+and\s+place\s+(?:it|them)\s+in\s+your\s+support\s+area\s+as\s+active\.?$/i
const BREAK_TO_TRASH_RE = /^(?:If\s+your\s+break\s+area\s+is\s+LV\.(\d+)\s+or\s+higher,\s+)?Select\s+up\s+to\s+(\d+)\s+LV\.(\d+)\s+(?:card|Cookie)\s+(?:in|from)\s+your\s+break\s+area(?:\s+and|\.)\s+place\s+(?:it|that Cookie)\s+in\s+the\s+trash\.?$/i

const stripEffectText = (text: string): string =>
  text.replace(COST_OR_MARKER_RE, '').replace(BRACKET_COST_RE, '').replace(/\s+/g, ' ').trim()

const parseAbilityCost = (text: string): AbilityCost => {
  const parsed = parseOfficialCardText(text)
  const discardMatch = text.match(
    /(?:<|《)\s*Discard\s+(\d+)\s+(?:\{([RYGBPK])\}\s+)?card(?:s)?\.\s*(?:>|》)/i,
  )
  const supportToTrashMatch = text.match(
    /(?:<|《)\s*Place\s+(\d+)\s+card(?:s)?\s+from\s+your\s+support\s+area\s+into\s+the\s+trash\.?\s*(?:>|》)/i,
  )
  const trashBattleMatch = text.match(
    /(?:<|《)\s*Place\s+(\d+)\s+(?:\{([RYGBPK])\}\s+)?LV\.(\d+)\s+Cookie\s+from\s+your\s+battle\s+area\s+into\s+the\s+trash\.?\s*(?:>|》)/i,
  )
  const costColors = {
    R: 'red',
    Y: 'yellow',
    G: 'green',
    B: 'blue',
    P: 'purple',
    K: 'black',
  } as const

  return {
    energy: parsed?.cost ?? {},
    discardHand: discardMatch ? Number(discardMatch[1]) : 0,
    discardHandColor: discardMatch?.[2]
      ? costColors[discardMatch[2].toUpperCase() as keyof typeof costColors]
      : undefined,
    supportToTrash: supportToTrashMatch
      ? Number(supportToTrashMatch[1])
      : undefined,
    ...(trashBattleMatch ? {
      trashBattleCookie: {
        count: Number(trashBattleMatch[1]),
        level: Number(trashBattleMatch[3]),
        ...(trashBattleMatch[2]
          ? {
              energyColor:
                costColors[
                  trashBattleMatch[2].toUpperCase() as keyof typeof costColors
                ],
            }
          : {}),
      },
    } : {}),
  }
}

const parseSimpleDraw = (stripped: string): number | null => {
  const match = stripped.match(DRAW_ONLY_RE)
  return match ? Number(match[2]) : null
}

const isOptionalDraw = (stripped: string): boolean =>
  /^\s*You can\s+draw\b/i.test(stripped) || /\bDraw\s+up to\b/i.test(stripped)

const CONDITIONAL_DRAW_RE =
  /^If\s+.+?,\s*you\s+can\s+draw\s+(?:up\s+to\s+)?(\d+)\s+card(?:s)?\s+from\s+your\s+deck\.?$/i

const parseConditionalDraw = (stripped: string): number | null => {
  const match = stripped.match(CONDITIONAL_DRAW_RE)
  return match ? Number(match[1]) : null
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
  const normalized = stripped.replace(/^When this Cookie faints,\s*/i, '')
  const match = normalized.match(BREAK_TO_TRASH_RE)
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
  const cardKey = card.cardNumber.includes('@')
    ? card.baseCardNumber || card.cardNumber.split('@')[0]
    : card.cardNumber

  if (!sourceText) {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'no-effect-text',
    }
  }

  const exactStarterEffects: Partial<Record<string, CardEffect[]>> = {
    // 複合效果（含 Then）仍需硬編碼，因通用解析器不處理 Then
    'ST1-002': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1 },
        condition: { kind: 'break-level-at-least', level: 6 },
      },
    ],
    'ST1-017': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, remainingHp: 1, minLevel: 2 },
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
    'ST3-004': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
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
    'ST4-004': [
      { kind: 'set-active' as const, supportCount: 1 } satisfies CardEffect as CardEffect,
    ],
    'ST4-013': [
      { kind: 'inspect-deck', lookCount: 3, pickCount: 1, restToBottom: true },
    ],
    'ST4-016': [
      {
        kind: 'return-to-hand',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          energyColor: 'blue',
          minRemainingHp: 3,
        },
      },
    ],
    'ST4-017': [
      {
        kind: 'return-to-hand',
        target: { side: 'self', min: 1, max: 1, maxLevel: 1 },
      },
    ],
    'ST4-018': [{ kind: 'draw-up-to', max: 2 }],
    'ST4-019': [{ kind: 'hand-to-deck-and-draw' }],
    'ST5-019': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'opponent-trash-count-at-least', count: 20 },
      },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'opponent-trash-count-at-least', count: 20 },
      },
    ],
    'ST5-001': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
        allowStage: true,
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-006': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 2 },
        allowStage: true,
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-007': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
        allowStage: true,
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-010': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1, remainingHp: 2 },
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-013': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-015': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1 },
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-016': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'opponent-trash-count-at-least', count: 30 },
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-018': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1, remainingHp: 4 },
      } satisfies CardEffect as CardEffect,
    ],
    'ST5-021': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 1, max: 1, remainingHp: 2 },
      } satisfies CardEffect as CardEffect,
    ],
    'BS1-029': [
      {
        kind: 'draw',
        amount: 1,
        condition: { kind: 'break-level-at-least', level: 3 },
      },
      {
        kind: 'discard-hand',
        count: 1,
        condition: { kind: 'break-level-at-least', level: 3 },
      },
    ],
    'BS1-053': [
      {
        kind: 'support-to-hand',
        amount: 1,
        condition: { kind: 'hand-count-at-most', count: 6 },
      },
      {
        kind: 'deck-to-support',
        amount: 1,
        rested: true,
        condition: { kind: 'hand-count-at-most', count: 6 },
      },
    ],
    'BS1-022': [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS1-023': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'BS1-048': [
      {
        kind: 'modify-attack-by-break-count',
        perCount: 1,
        exactBreakLevel: 1,
        breakEnergyColor: 'yellow',
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'BS1-049': [
      {
        kind: 'damage-by-break-count',
        perCount: 1,
        minBreakLevel: 2,
        breakEnergyColor: 'yellow',
        target: { side: 'opponent', min: 1, max: 1 },
      },
    ],
    'BS1-074': [{ kind: 'draw', amount: 1 }],
    'BS1-075': [{ kind: 'place-source-to-support', rested: true }],
    'BS1-001': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS1-003': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS1-004': [
      {
        kind: 'return-to-hand',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS1-008': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS1-012': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'break-level-at-least', level: 9 },
      },
    ],
    'BS1-014': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS1-016': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'hand-count-at-most', count: 4 },
      },
    ],
    'BS1-017': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS2-002': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-003': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS2-006': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'hp-to-trash',
        amount: 2,
        target: { side: 'self', min: 1, max: 1 },
      },
    ],
    // === BS1/BS2 黃色餅乾卡技能 ===
    'BS1-028': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS1-034': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS1-035': [
      {
        kind: 'break-to-trash',
        max: 1,
        exactLevel: 1,
      },
    ],
    'BS1-044': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    // === BS1/BS2 綠色餅乾卡技能 ===
    'BS1-054': [
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
      },
    ],
    'BS1-063': [
      {
        kind: 'deck-to-support',
        amount: 1,
      },
    ],
    'BS1-066': [
      {
        kind: 'set-active',
        supportCount: 1,
      },
    ],
    'BS1-068': [
      { kind: 'draw', amount: 1 },
    ],
    'BS1-071': [
      {
        kind: 'trash-to-support',
        amount: 1,
      },
    ],
    'BS1-073': [
      {
        kind: 'set-active',
        supportCount: 1,
      },
    ],
    // === BS1/BS2 藍色餅乾卡技能 ===
    'BS2-027': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 2 },
      },
    ],
    'BS2-029': [
      {
        kind: 'return-to-hand',
        target: { side: 'self', min: 1, max: 1, maxLevel: 2 },
      },
    ],
    'BS2-031': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 1, max: 2 },
      } satisfies CardEffect as CardEffect,
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-047': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 1, max: 2 },
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-039': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 2 },
      },
    ],
    'BS2-040': [
      { kind: 'inspect-deck', lookCount: 3, pickCount: 1, restToBottom: true, filterColor: 'blue' },
    ],
    'BS2-043': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 2 },
      },
    ],
    'BS2-046': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-036': [
      {
        kind: 'return-to-deck-bottom',
        target: { side: 'self', min: 1, max: 1, maxLevel: 1 },
      } satisfies CardEffect as CardEffect,
      { kind: 'draw', amount: 1 },
    ],
    // === BS1/BS2 紫色餅乾卡技能 ===
    'BS2-057': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-058': [
      {
        kind: 'opponent-battle-to-trash',
        maxLevel: 3,
        minLevel: 3,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-064': [
      {
        kind: 'opponent-battle-to-trash',
        remainingHp: 2,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-065': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-069': [
      {
        kind: 'opponent-battle-to-trash',
        maxLevel: 1,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-074': [
      {
        kind: 'opponent-battle-to-trash',
        maxLevel: 1,
      } satisfies CardEffect as CardEffect,
    ],
  }
  const exactEffects = exactStarterEffects[cardKey]
  if (exactEffects) {
    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: exactEffects,
    }
  }

  if (/\{bl\}/i.test(sourceText) && /redirect\s+the\s+attack\s+to\s+this\s+Cookie/i.test(sourceText)) {
    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: [
        {
          kind: 'redirect-attack',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ],
    }
  }

  if (/opponent\s+cannot\s+activate\s+\{bl\}/i.test(sourceText)) {
    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: [
        {
          kind: 'disable-block',
          duration: 'this-turn',
          side: 'opponent',
        },
      ],
    }
  }

  const isFaintSkill = /When this Cookie faints/i.test(sourceText)
  if (isFaintSkill && card.type !== 'cookie') {
    return {
      status: 'unsupported',
      cardNumber: card.cardNumber,
      sourceText,
      reason: 'unsupported-effect-text',
    }
  }

  if (isFaintSkill) {
    const target = parseTarget(sourceText)
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
            target: target ?? { side: 'opponent', min: 1, max: 1 },
            condition,
          },
        ],
      }
    }
    const drawMatch = parseSimpleDraw(stripEffectText(sourceText))
    if (drawMatch !== null) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'draw',
            amount: drawMatch,
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

  if (isUnsupportedBracketCost(sourceText)) {
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

    const conditionalDrawAmount = parseConditionalDraw(
      stripEffectText(sourceText),
    )

    if (conditionalDrawAmount !== null) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'draw',
            amount: conditionalDrawAmount,
            condition: parseCondition(sourceText),
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

    // 通用物品/場景效果解析
    if (/flip\s+effect\s+cannot\s+be\s+activated/i.test(sourceText)) {
      const dfTarget = parseTarget(sourceText) ?? {
        side: 'opponent',
        min: 0,
        max: 1,
      }
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'disable-flip',
            duration: 'this-turn',
            target: dfTarget,
          },
        ],
      }
    }

    if (/view\s+(?:the\s+)?HP\s+cards/i.test(sourceText)) {
      const vhTarget = parseTarget(sourceText) ?? {
        side: 'opponent',
        min: 0,
        max: 1,
      }
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'view-hp',
            target: vhTarget,
            optional: true,
          },
        ],
      }
    }

    const allAttackMatch = sourceText.match(
      /all\s+(?:your\s+)?Cookies(?:\s+currently\s+in\s+your\s+battle\s+area)?\s+gain\s+\+(\d+)\s+attack\s+damage/i,
    )
    if (allAttackMatch) {
      const condition = parseCondition(sourceText)
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'modify-all-attack',
            amount: Number(allAttackMatch[1]),
            duration: /this\s+turn/i.test(sourceText)
              ? 'this-turn'
              : 'persistent',
            side: 'self',
            condition,
          },
        ],
      }
    }

    const battleToSupportMatch = sourceText.match(
      /Select\s+(?:up to\s+)?(\d+)\s+(?:of\s+)?(?:your\s+)?(?:.*\s+)?Cookie.*?\s+(?:LV\.(\d+)\s+or\s+lower\s+)?(?:and\s+)?place\s+it\s+in\s+your\s+support\s+area/i,
    )
    if (battleToSupportMatch) {
      const btsTarget: EffectTargetSelector = {
        side: 'self',
        min: Number(battleToSupportMatch[1]),
        max: Number(battleToSupportMatch[1]),
      }
      if (battleToSupportMatch[2]) {
        btsTarget.maxLevel = Number(battleToSupportMatch[2])
      }
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'battle-to-support',
            target: btsTarget,
          },
        ],
      }
    }

    const trashToBattleMatch = sourceText.match(
      /(?:Select|Play)\s+(\d+)\s+(?:LV\.(\d+)\s+)?Cookie\s+from\s+your\s+trash/i,
    )
    if (trashToBattleMatch) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'trash-to-battle',
            amount: Number(trashToBattleMatch[1]),
          },
        ],
      }
    }

    const returnToHandMatch = sourceText.match(
      /Return\s+(\d+)\s+(?:LV\.(\d+)\s+)?(?:([RYGBPKN])\s+)?Cookie\s+(?:from\s+your\s+battle\s+area\s+)?to\s+your\s+hand/i,
    )
    if (returnToHandMatch) {
      const effect: ReturnToHandEffect = {
        kind: 'return-to-hand',
        target: {
          side: /from\s+your\s+battle\s+area/i.test(sourceText) ? 'self' : 'opponent',
          min: Number(returnToHandMatch[1]),
          max: Number(returnToHandMatch[1]),
        },
      }
      if (returnToHandMatch[2]) effect.target.minLevel = Number(returnToHandMatch[2])
      const hpMatch = sourceText.match(/remaining HP is (\d+) or more/i)
      if (hpMatch) effect.target.minRemainingHp = Number(hpMatch[1])
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [effect],
      }
    }

    if (/Return\s+this\s+Cookie\s+to\s+your\s+hand/i.test(sourceText)) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'return-to-hand',
            target: {
              side: 'self',
              min: 1,
              max: 1,
              sourceOnly: true,
            },
          },
        ],
      }
    }

    const randomDiscardMatch = sourceText.match(
      /Place\s+(\d+)\s+random\s+card(?:s)?\s+from\s+your\s+opponent['']s\s+hand\s+into\s+the\s+trash/i,
    )
    if (randomDiscardMatch) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'opponent-random-discard' as const,
            count: Number(randomDiscardMatch[1]),
          },
        ],
      }
    }

    const opponentDiscardHandMatch = sourceText.match(
      /Your opponent must place (\d+) card(?:s)? from their hand into the trash/i,
    )
    if (opponentDiscardHandMatch) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'opponent-discard-hand',
            count: Number(opponentDiscardHandMatch[1]),
          },
        ],
      }
    }

    const battleToTrashMatch = sourceText.match(
      /Place\s+(\d+)\s+of\s+your\s+opponent['']s\s+(?:LV\.(\d+)(?:\s+or\s+lower)?\s+)?Cookies?\s+(?:from\s+their\s+battle\s+area\s+)?into\s+the\s+trash/i,
    )
    if (battleToTrashMatch) {
      const hpMatch = sourceText.match(/remaining HP is (\d+) or less/i)
      const lvLowerMatch = sourceText.match(/LV\.(\d+) or lower/i)
      const lvExactMatch = sourceText.match(
        /LV\.(\d+)\s+(?!or lower)/i,
      )
      const stageMatch = /or\s+\d+\s+stage\s+card/i.test(sourceText)
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'opponent-battle-to-trash' as const,
            ...(hpMatch ? { remainingHp: Number(hpMatch[1]) } : {}),
            ...(lvLowerMatch ? { maxLevel: Number(lvLowerMatch[1]) } : {}),
            ...(lvExactMatch ? { minLevel: Number(lvExactMatch[1]), maxLevel: Number(lvExactMatch[1]) } : {}),
            ...(stageMatch ? { allowStage: true } : {}),
          } satisfies CardEffect as CardEffect,
        ],
      }
    }

    const supportToHandMatch = sourceText.match(
      /Select\s+(\d+)\s+card\s+from\s+your\s+support\s+area\s+and\s+place\s+it\s+in\s+your\s+hand/i,
    )
    if (supportToHandMatch) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'support-to-hand',
            amount: Number(supportToHandMatch[1]),
          },
        ],
      }
    }

    const setSupportActiveMatch = sourceText.match(
      /set\s+(?:up to\s+)?(\d+)\s+(?:of\s+)?card\s+from\s+your\s+support\s+area\s+as\s+active/i,
    )
    if (setSupportActiveMatch) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'set-active',
            supportCount: Number(setSupportActiveMatch[1]),
          },
        ],
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

  const gainHpMatch = sourceText.match(/gains?\s+\+(\d+)\s+HP/i)
  if (gainHpMatch && target && card.type !== 'flip') {
    return {
      status: 'supported',
      cardNumber: card.cardNumber,
      sourceText,
      effects: [
        {
          kind: 'gain-hp',
          amount: Number(gainHpMatch[1]),
          target,
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
  if (conversion.status !== 'supported') {
    return undefined
  }
  const parsed = parseOfficialCardText(card.attackText)
  if (!parsed) return undefined
  const exactCosts: Partial<Record<string, AbilityCost>> = {
    'BS1-022': { energy: { red: 3 }, discardHand: 1 },
    'BS1-023': {
      energy: { red: 1 },
      discardHand: 0,
      hpToTrash: { untilRemainingHp: 1 },
    },
    'BS1-048': { energy: { yellow: 3 }, discardHand: 0 },
    'BS1-049': { energy: { yellow: 2 }, discardHand: 0 },
    'BS1-074': {
      energy: { green: 1 },
      discardHand: 0,
      supportToHand: 1,
    },
    'BS1-075': { energy: { green: 2 }, discardHand: 0 },
    'BS2-006': { energy: { red: 2 }, discardHand: 0 },
  }
  const parsedCost = parseAbilityCost(card.attackText)
  const hasSpecialCost =
    (parsedCost.discardHand ?? 0) > 0 ||
    Boolean(parsedCost.supportToTrash) ||
    Boolean(parsedCost.supportToHand) ||
    Boolean(parsedCost.hpToTrash) ||
    Boolean(parsedCost.trashBattleCookie)
  return {
    cost: exactCosts[card.cardNumber] ?? (hasSpecialCost ? parsedCost : parsed.cost),
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
  if (!placement) return undefined

  // 複合效果（含 Then）仍需硬編碼；被動觸發階段（無 {mob}）也在此定義
  const exactStageEffects: Partial<Record<string, CardEffect[]>> = {
    'ST3-022': [
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'draw', amount: 1 },
    ],
    'ST5-022': [{ kind: 'draw', amount: 1 }],
    'BS1-026': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'BS1-052': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1 },
      },
    ],
    'BS1-078': [
      {
        kind: 'set-active',
        supportCount: 1,
        condition: { kind: 'support-area-decreased-this-turn' },
      },
    ],
    // === BS2 場景卡 ===
    'BS2-051': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'BS2-081': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
  }
  const exactStageCosts: Partial<Record<string, AbilityCost>> = {
    'BS1-026': {
      energy: {},
      discardHand: 0,
      hpToTrash: { amount: 1 },
    },
    'BS1-052': { energy: { yellow: 2 }, discardHand: 0 },
    'BS1-078': { energy: {}, discardHand: 0 },
    'BS2-051': { energy: {}, discardHand: 1 },
    'BS2-081': { energy: { purple: 1 }, discardHand: 0 },
  }
  const stageEffects = exactStageEffects[card.cardNumber]
  if (stageEffects) {
    return {
      placementCost: placement.cost,
      cost:
        exactStageCosts[card.cardNumber] ??
        (activation?.cost ?? {}),
      text: card.attackText,
      effects: stageEffects,
      restSource:
        card.cardNumber === 'ST5-022' ||
        /Rest this card/i.test(activationText ?? ''),
      ...(card.cardNumber === 'ST5-022' ? { triggered: true } : {}),
    }
  }

  if (!activation) return undefined

  // 通用化解析：使用 activation 部分作為效果文字
  const conversion = convertOfficialCardEffects({
    ...card,
    type: 'stage',
    attackText: activationText ?? card.attackText,
  })
  if (conversion.status !== 'supported') return undefined

  return {
    placementCost: placement.cost,
    cost: activation.cost,
    text: card.attackText,
    effects: conversion.effects,
    restSource: /Rest this card/i.test(activationText ?? ''),
  }
}

export const convertOfficialCardEffectSet = (
  cards: OfficialCardRecord[],
): OfficialEffectConversion[] => cards.map(convertOfficialCardEffects)

export const convertOfficialAttackEffects = (
  card: OfficialCardRecord,
): CardEffect[] | undefined => {
  if (
    (card.type !== 'cookie' && card.type !== 'flip') ||
    !card.attackText ||
    !/\bThen\b/i.test(card.attackText)
  ) {
    return undefined
  }

  const cardKey = card.cardNumber.includes('@')
    ? card.baseCardNumber || card.cardNumber.split('@')[0]
    : card.cardNumber
  const exactAttackEffects: Partial<Record<string, CardEffect[]>> = {
    'ST2-003': [{ kind: 'break-to-trash', max: 1, exactLevel: 1 }],
    'ST4-013': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
        effectText:
          'Discard 2 cards from your hand to deal 1 damage to 1 opponent cookie.',
      },
    ],
    'ST4-015': [{ kind: 'draw', amount: 1 }],
    'BS1-005': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS1-013': [{ kind: 'discard-hand', count: 1 }],
    'BS1-028': [
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        condition: { kind: 'break-level-at-least', level: 5 },
      },
    ],
    'BS1-033': [
      {
        kind: 'damage-by-break-count',
        perCount: 1,
        minBreakLevel: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS1-039': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'opponent-next-turn',
        target: { side: 'opponent', min: 0, max: 2 },
      },
    ],
    'BS1-044': [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 1, max: 1 },
      },
    ],
    'BS1-064': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, excludeSource: true },
        condition: { kind: 'support-count-at-least', count: 7 },
      },
    ],
    'BS1-070': [
      { kind: 'support-to-hand', amount: 1, maxLevel: 1 },
    ],
    'BS2-004': [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
        condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
      },
    ],
    // === BS1/BS2 黃綠藍紫攻擊 Then 效果 ===
    'BS1-037': [
      {
        kind: 'opponent-battle-to-trash',
        maxLevel: 1,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-010': [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
        condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
      },
    ],
    'BS2-017': [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
        condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
      },
    ],
    'BS2-044': [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
        condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
      },
    ],
    'BS2-045': [
      {
        kind: 'draw',
        amount: 1,
        condition: { kind: 'hand-count-at-most', count: 6 },
      },
    ],
    'BS2-058': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'opponent-trash-count-at-least', count: 15 },
      },
    ],
    'BS2-075': [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
        condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
      },
    ],
  }

  return exactAttackEffects[cardKey]
}

export const convertOfficialFlipAbility = (
  card: OfficialCardRecord,
): FlipAbility | undefined => {
  if (card.type !== 'flip' || !card.flipText) {
    return undefined
  }

  const exactFlipEffects: Partial<Record<string, { effects: CardEffect[]; cost?: AbilityCost }>> = {
    'BS1-040': {
      effects: [
        {
          kind: 'gain-hp',
          amount: 2,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'break-level-at-least', level: 6 },
        },
      ],
    },
    'BS2-034': {
      effects: [
        {
          kind: 'draw-up-to',
          max: 2,
          condition: { kind: 'break-level-at-least', level: 4 },
        },
      ],
    },
    'BS2-063': {
      effects: [
        {
          kind: 'field-to-trash',
          target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 },
          condition: { kind: 'break-level-at-least', level: 3 },
        } satisfies CardEffect as CardEffect,
      ],
    },
  }
  const exactFlip = exactFlipEffects[card.cardNumber]
  if (exactFlip) {
    return {
      text: card.flipText,
      cost: exactFlip.cost ?? parseAbilityCost(card.flipText),
      effects: exactFlip.effects,
    }
  }

  const stripped = stripEffectText(card.flipText)
  const drawAmount = parseSimpleDraw(stripped)

  if (drawAmount !== null) {
    return {
      text: card.flipText,
      cost: parseAbilityCost(card.flipText),
      effects: isOptionalDraw(stripped)
        ? [{ kind: 'draw-up-to', max: drawAmount }]
        : [{ kind: 'draw', amount: drawAmount }],
    }
  }

  const conditionalDrawAmount = parseConditionalDraw(stripped)
  if (conditionalDrawAmount !== null) {
    return {
      text: card.flipText,
      cost: parseAbilityCost(card.flipText),
      effects: [
        {
          kind: 'draw-up-to',
          max: conditionalDrawAmount,
          condition: parseCondition(stripped),
        },
      ],
    }
  }

  const target = parseTarget(card.flipText)
  const damageMatch = card.flipText.match(/receives?\s+(\d+)\s+damage/i)
  if (target && damageMatch) {
    return {
      text: card.flipText,
      cost: parseAbilityCost(card.flipText),
      effects: [
        {
          kind: 'damage',
          amount: Number(damageMatch[1]),
          target,
        },
      ],
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

  const selfHpEquals = text.match(/If\s+1\s+of\s+your\s+Cookies\s+has\s+(\d+)\s+HP/i)
  if (selfHpEquals) {
    return {
      kind: 'self-cookie-hp-equals',
      amount: Number(selfHpEquals[1]),
    }
  }

  const trashCountMatch = text.match(/(\d+)\s+cards?\s+or\s+more\s+in\s+your\s+trash/i)
  if (trashCountMatch) {
    return {
      kind: 'opponent-trash-count-at-least',
      count: Number(trashCountMatch[1]),
    }
  }

  const faintedColor = text.match(
    /(?:any|if\s+\d+)\s+of\s+your\s+\{([RYGBPK])\}\s+Cookies?\s+(?:fainted|faints)/i,
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
  const afterThen = text.split(/then/i).pop() ?? ''
  const strippedAfterThen = stripEffectText(afterThen).replace(
    /^[^A-Za-z]+/,
    '',
  )
  const trapDrawAmount = parseSimpleDraw(strippedAfterThen)
  const redirectAttack =
    /Redirect your opponent's attack to a different Cookie of your own/i.test(text)
  const setActive = text.match(
    /set\s+(?:up to\s+)?(\d+)\s+of\s+card\s+from\s+your\s+support\s+area\s+as\s+active/i,
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

  if (redirectAttack) {
    effects.push({
      kind: 'redirect-attack',
      target: { side: 'self', min: 1, max: 1 },
    })
  }

  if (supportToTrash) {
    effects.push({
      kind: 'support-to-trash',
      amount: Number(supportToTrash[1]),
    })
  }

  if (trapDrawAmount !== null) {
    effects.push({
      kind: 'draw',
      amount: trapDrawAmount,
    })
  }

  const trapDrawUpToAndDiscard = text.match(
    /draw\s+up\s+to\s+(\d+)\s+card(?:s)?\s+from\s+your\s+deck\s+and\s+discard\s+(\d+)\s+card(?:s)?\s+from\s+your\s+hand/i,
  )
  if (trapDrawUpToAndDiscard && effects.length === 0) {
    effects.push(
      { kind: 'draw-up-to', max: Number(trapDrawUpToAndDiscard[1]) },
      { kind: 'discard-hand', count: Number(trapDrawUpToAndDiscard[2]) },
    )
  }

  const battleToTrash = text.match(
    /Place\s+(\d+)\s+of\s+your\s+opponent['']s\s+(?:LV\.(\d+)(?:\s+or\s+lower)?\s+)?Cookies?\s+(?:whose\s+remaining\s+HP\s+is\s+\d+\s+or\s+less\s+)?(?:from\s+their\s+battle\s+area\s+)?into\s+the\s+trash/i,
  )
  if (battleToTrash) {
    const trapHpMatch = text.match(/remaining HP is (\d+) or less/i)
    effects.push({
      kind: 'field-to-trash',
      target: {
        side: 'opponent',
        min: Number(battleToTrash[1]),
        max: Number(battleToTrash[1]),
        ...(battleToTrash[2]
          ? { maxLevel: Number(battleToTrash[2]) }
          : {}),
        ...(trapHpMatch ? { remainingHp: Number(trapHpMatch[1]) } : {}),
      },
    } satisfies CardEffect as CardEffect)
  }

  if (deckToRestedSupport) {
    effects.push({
      kind: 'deck-to-support',
      amount: 1,
      rested: true,
    })
  }

  const gainHp = text.match(/gains?\s+\+(\d+)\s+HP/i)
  if (gainHp && target) {
    effects.push({
      kind: 'gain-hp',
      amount: Number(gainHp[1]),
      target,
    })
  }

  if (setActive) {
    effects.push({
      kind: 'set-active',
      supportCount: Number(setActive[1]),
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
  const cost = parseAbilityCost(card.skill.text)
  const parsed = parseOfficialCardText(card.skill.text)

  if (
    conversion.status !== 'supported' ||
    !parsed
  ) {
    return undefined
  }

  return {
    trigger:
      parsed.markers.includes('bl') &&
      /redirect\s+the\s+attack\s+to\s+this\s+Cookie/i.test(card.skill.text)
        ? 'block'
        : parsed.markers.includes('mob')
          ? 'activate'
          : parsed.markers.includes('ap')
            ? 'on-play'
            : 'passive',
    oncePerTurn: parsed.markers.includes('t1'),
    yourTurn: parsed.markers.includes('mt'),
    restSource: /Rest this card/i.test(card.skill.text),
    cost,
    text: conversion.sourceText,
    effects: conversion.effects,
    faint: /When this Cookie faints/i.test(card.skill.text),
    endPhase: /(?:at the )?end of (?:your|this) turn|your turn ends/i.test(
      card.skill.text,
    ),
    afterDamage: /(?:after|when)\s+(?:receiving|taking)\s+damage/i.test(
      card.skill.text,
    ),
  }
}
