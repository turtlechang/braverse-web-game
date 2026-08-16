import type {
  AbilityCost,
  CardAbility,
  CardSkill,
  CardEffect,
  EndPhaseScope,
  EffectCondition,
  EffectTargetSelector,
  FlipAbility,
  TrapAbility,
  StageAbility,
  ReturnToHandEffect,
  SkillTrigger,
} from '../game'
import { parseOfficialCardText } from './official-text-parser'
import type { OfficialCardRecord } from './types'
import {
  P_EXACT_ATTACK_EFFECTS,
  P_EXACT_EFFECTS,
  P_EXACT_FLIP_EFFECTS,
  P_EXACT_ITEM_ACTIVATION_COST_OVERRIDES,
  P_EXACT_SKILL_COSTS,
  P_EXACT_SPECIAL_PLAY_COSTS,
  P_EXACT_SKILL_TRIGGERS,
  P_FROM_SUPPORT,
  P_FROM_TRASH,
  P_SOURCE_ENERGY,
} from './p-card-effects'

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

// 官方文字對「Rest this card.」的措辭不一致，BS2-051 用「Card Rests.」，需一併比對
const RESTS_THIS_CARD_PATTERN = /Rest this card|Card Rests/i
const STAGE_ACTIVATE_MARKER_PATTERN = /\{mob\}|【Activate】/i
// 昏厥觸發措辭不一致：多數卡是「When this Cookie faints」，P-011 用「If this Cookie has fainted」
const FAINT_TRIGGER_PATTERN = /When this Cookie faints|If this Cookie has fainted/i

const YOUR_TURN_END_PHASE_PATTERN =
  /(?:when (?:your|this) turn ends|at the end of (?:your|this) turn)/i
const OPPONENT_TURN_END_PHASE_PATTERN =
  /(?:when (?:your )?opponent[’']s turn ends|at the end of (?:your |the )?opponent[’']s turn)/i

const getEndPhaseScope = (text: string): EndPhaseScope | undefined => {
  if (OPPONENT_TURN_END_PHASE_PATTERN.test(text)) return 'opponent-turn'
  if (YOUR_TURN_END_PHASE_PATTERN.test(text)) return 'your-turn'
  return undefined
}

const getEffectText = (card: OfficialCardRecord): string | null => {
  if (card.type === 'cookie') {
    return card.skill.text
  }

  if (card.type === 'flip') {
    // 部分官方 FLIP 記錄將效果文案放在 skill.text；runtime 仍須視為 FLIP。
    return card.flipText ?? card.skill.text
  }

  return card.skill.text ?? card.attackText
}

const parseTarget = (text: string): EffectTargetSelector | null => {
  const match = text.match(
    /Select\s+(up to\s+)?(\d+)\s+of\s+(your opponent's|your)(\s+other)?(?:\s+\{[RYGBPKN]\})?\s+(?:LV\.(\d+)\s+)?Cookies/i,
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

    const textAfterTarget = text.slice(match.index ?? 0)
    const remainingHpMatch = textAfterTarget.match(
      /remaining HP is (\d+)(\s+or more)?/i,
    )
    const minimumLevelMatch = textAfterTarget.match(/LV\.(\d+) or higher/i)

    if (remainingHpMatch) {
      if (remainingHpMatch[2]) {
        target.minRemainingHp = Number(remainingHpMatch[1])
      } else {
        target.remainingHp = Number(remainingHpMatch[1])
      }
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

  // 官方文字用詞順序不一致：「contains N or more cards」與「contains N cards or more」都有。
  const supportCountMatch = text.match(
    /support area contains?\s+(\d+)\s+(?:cards?\s+or\s+more|or\s+more\s+cards?)/i,
  )
  if (supportCountMatch) {
    return {
      kind: 'support-count-at-least',
      count: Number(supportCountMatch[1]),
    }
  }

  const handCountAtMostMatch = text.match(/(\d+) cards? or less in your hand/i)
  if (handCountAtMostMatch) {
    return {
      kind: 'hand-count-at-most',
      count: Number(handCountAtMostMatch[1]),
    }
  }

  // BS4-083「if your hand contains 5 cards or more」。
  const handCountAtLeastMatch = text.match(
    /your hand contains?\s+(\d+)\s+cards?\s+or\s+more/i,
  )
  return handCountAtLeastMatch
    ? { kind: 'hand-count-at-least', count: Number(handCountAtLeastMatch[1]) }
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

    if (
      /^Place\s+\d+\s+(?:\{[A-Z]\}\s+)?Cookie\s+from\s+your\s+hand\s+into\s+your\s+break\s+area\.?$/i.test(
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
    /(?:<|《)\s*Discard\s+(\d+)\s+(?:\{([RYGBPK])\}\s+)?(?:(item|trap|cookie)\s+)?card(?:s)?\.\s*(?:>|》)/i,
  )
  const supportToTrashMatch = text.match(
    /(?:<|《)\s*Place\s+(\d+)\s+card(?:s)?\s+from\s+your\s+support\s+area\s+(?:in|into)\s+the\s+trash\.?\s*(?:>|》)/i,
  )
  const trashBattleMatch = text.match(
    /(?:<|《)\s*Place\s+(\d+)\s+(?:\{([RYGBPK])\}\s+)?LV\.(\d+)\s+Cookie\s+from\s+your\s+battle\s+area\s+into\s+the\s+trash\.?\s*(?:>|》)/i,
  )
  const makeFaintMatch = text.match(
    /(?:<|《)\s*Make\s+(\d+)\s+of\s+your\s+(?:\{([RYGBPK])\}\s+)?Cookies?\s+faint\.?\s*(?:>|》)/i,
  )
  const handToBreakMatch = text.match(
    /(?:<|《)\s*Place\s+(\d+)\s+(?:\{([RYGBPK])\}\s+)?Cookie\s+from\s+your\s+hand\s+into\s+your\s+break\s+area\.?\s*(?:>|》)/i,
  )
  // BS4-004／005／007 這類辣椒系卡的代價：從自己這張卡的 HP 頂端棄 N 張。
  // 官方文字用詞不一致：「this Cookie's HP」與「this Cookie's HP card」都有
  // （BS4-096），故「card」字尾為選用。
  const hpToTrashMatch = text.match(
    /(?:<|《)\s*Place\s+(\d+)\s+cards?\s+from\s+the\s+top\s+of\s+this\s+Cookie's\s+HP(?:\s+cards?)?\s+into\s+the\s+trash\.?\s*(?:>|》)/i,
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
    discardHandType: discardMatch?.[3]?.toLowerCase() as AbilityCost['discardHandType'],
    supportToTrash: supportToTrashMatch
      ? Number(supportToTrashMatch[1])
      : undefined,
    ...(hpToTrashMatch
      ? {
          hpToTrash: {
            amount: Number(hpToTrashMatch[1]),
            // 卡面明定 this Cookie，不能讓玩家改由另一張己方餅乾支付。
            sourceOnly: true,
          },
        }
      : {}),
    ...(handToBreakMatch ? {
      handToBreakArea: {
        count: Number(handToBreakMatch[1]),
        ...(handToBreakMatch[2]
          ? {
              energyColor:
                costColors[
                  handToBreakMatch[2].toUpperCase() as keyof typeof costColors
                ],
            }
          : {}),
      },
    } : {}),
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
    } : makeFaintMatch ? {
      trashBattleCookie: {
        count: Number(makeFaintMatch[1]),
        ...(makeFaintMatch[2]
          ? {
              energyColor:
                costColors[
                  makeFaintMatch[2].toUpperCase() as keyof typeof costColors
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
      { kind: 'inspect-deck', lookCount: 3, pickCount: 1, restDestination: 'bottom' },
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
        groupSize: 2,
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
    'BS1-074': [{ kind: 'draw-up-to', max: 1 }],
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
        // 官方繁中卡面文字為「HP 3 或以下」（含 3），英文資料庫的 "less than 3"
        // 對應到嚴格小於 4，故此處用 amount: 4 表示 HP <= 3。
        condition: { kind: 'source-hp-less-than', amount: 4 },
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
    'BS2-022': [
      {
        kind: 'prevent-effect-damage',
        duration: 'until-source-next-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS2-025': [
      {
        kind: 'draw-up-to-then-discard',
        max: 1,
        discardCount: 1,
      },
    ],
    'BS2-027': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 2 },
      },
    ],
    'BS2-033': [
      {
        kind: 'set-active',
        supportCount: 0,
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
        kind: 'split-damage',
        primaryAmount: 2,
        secondaryAmount: 1,
        target: { side: 'opponent', min: 1, max: 2 },
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
      { kind: 'inspect-deck', lookCount: 3, pickCount: 1, restDestination: 'bottom', filterColor: 'blue' },
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
      { kind: 'draw-up-to', max: 1 },
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
    'BS2-048': [
      {
        kind: 'draw-up-to-opponent-fainted-this-turn',
        amountPerFainted: 1,
      },
    ],
    'BS2-074': [
      {
        kind: 'opponent-battle-to-trash',
        maxLevel: 1,
      } satisfies CardEffect as CardEffect,
    ],
    // === 補齊尚未實作的餅乾／物品卡效果 ===
    'ST4-010': [{ kind: 'draw-up-to', max: 1 }],
    'BS1-056': [
      {
        kind: 'battle-to-support',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          maxLevel: 2,
        },
      } satisfies CardEffect as CardEffect,
    ],
    'BS1-058': [
      { kind: 'support-to-trash', amount: 1 },
      { kind: 'damage-all', amount: 1, side: 'self' },
      { kind: 'damage-all', amount: 1, side: 'opponent' },
    ],
    'BS2-015': [
      { kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 } },
      { kind: 'deck-to-support', amount: 1, rested: true },
    ],
    'BS2-018': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-055': [
      { kind: 'field-to-trash-all', maxLevel: 2 } satisfies CardEffect as CardEffect,
    ],
    'BS2-060': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'opponent-trash-count-at-least', count: 20 },
      },
    ],
    'BS2-061': [
      { kind: 'trash-to-deck', max: 3, excludeFlip: true } satisfies CardEffect as CardEffect,
    ],
    'BS2-062': [
      {
        kind: 'field-to-trash',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'purple',
          maxLevel: 2,
        },
      } satisfies CardEffect as CardEffect,
      {
        kind: 'opponent-battle-to-trash',
        maxLevel: 2,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-068': [
      { kind: 'trash-to-hand', max: 1, energyColor: 'purple' } satisfies CardEffect as CardEffect,
    ],
    'BS2-071': [
      { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
    ],
    'BS2-073': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    'BS1-036': [
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 1,
        energyColor: 'yellow',
      } satisfies CardEffect as CardEffect,
    ],
    'BS1-037': [
      { kind: 'break-to-trash', max: 1, maxLevel: 2 },
    ],
    'BS1-038': [
      { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
    ],
    'BS2-011': [
      {
        kind: 'break-to-hand-by-level-sum',
        targetSum: 3,
        energyColor: 'yellow',
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-012': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-020': [
      {
        kind: 'hp-to-support',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, energyColor: 'green' },
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-077': [
      { kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 } },
    ],
    'BS2-078': [
      {
        kind: 'field-to-trash',
        target: { side: 'self', min: 1, max: 1, maxLevel: 2 },
      } satisfies CardEffect as CardEffect,
    ],
    'BS3-008': [
      {
        kind: 'opponent-battle-to-trash',
        min: 0,
        maxLevel: 1,
        destination: 'break',
      },
    ],
    'BS3-016': [
      {
        kind: 'set-active',
        supportCount: 0,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
    ],
    'BS3-017': [
      {
        kind: 'modify-damage-received',
        amount: 0,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        minimumDamage: 3,
        setDamageTo: 2,
      },
    ],
    'BS3-010': [
      {
        kind: 'opponent-battle-to-trash',
        min: 0,
        maxLevel: 1,
        destination: 'break',
      },
    ],
    'BS3-019': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS3-017',
        attackBonus: 1,
      },
    ],
    'BS3-020': [
      {
        kind: 'hp-to-hand',
        amount: 3,
        target: { side: 'self', min: 0, max: 1, energyColor: 'red' },
      },
    ],
    'BS3-026': [
      {
        kind: 'view-hp',
        target: { side: 'self', min: 0, max: 1 },
        optional: true,
      },
    ],
    'BS3-030': [
      {
        kind: 'hand-to-hp',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        optional: true,
      },
    ],
    'BS3-036': [
      {
        kind: 'battle-to-break',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          excludeSource: true,
          energyColor: 'yellow',
        },
      },
      { kind: 'draw-up-to', max: 2 },
    ],
    'BS3-042': [
      {
        kind: 'battle-to-break',
        target: { side: 'self', min: 1, max: 1, energyColor: 'yellow' },
      },
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS3-044': [
      { kind: 'hand-to-break', amount: 1, minLevel: 2 },
      {
        kind: 'break-to-hand',
        amount: 1,
        energyColor: 'yellow',
        maxLevel: 2,
        optional: true,
      },
    ],
    'BS3-043': [
      { kind: 'damage-all', amount: 1, side: 'opponent' },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS3-025',
        gainHp: 2,
      },
    ],
    'BS3-038': [
      { kind: 'hand-to-break', amount: 1, minLevel: 2 },
      {
        kind: 'break-to-hand',
        amount: 1,
        energyColor: 'yellow',
        maxLevel: 2,
        optional: true,
      },
    ],
    'BS3-054': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'active-support-count-at-least', count: 2 },
      },
    ],
    'BS3-075': [
      {
        kind: 'battle-to-deck-top',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS3-081': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'battle-to-deck-top',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS3-082': [
      {
        kind: 'prevent-effect-damage',
        duration: 'until-source-next-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS3-055': [
      {
        kind: 'support-to-hp',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        energyColor: 'green',
        optional: true,
      },
    ],
    'BS3-060': [
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 1,
        activeOnly: true,
        optional: true,
      },
    ],
    'BS3-061': [
      // 「place 1 card from your support area into the trash」是這個昏厥觸發
      // 技能的代價，但 resolveFaintEffect 只讀 hand-to-battle 的 energyCost，
      // 完全不會去看 CardSkill.cost（同一類問題見 BS3-029 修正）；跟 BS3-064
      // 一樣，把代價改成陣列最前面一個非 optional 的效果，讓犧牲確實發生，
      // 且讓後面「支援區至少 5 張」的條件是用犧牲後的張數判定。
      { kind: 'support-to-trash', amount: 1 },
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        condition: { kind: 'support-count-at-least', count: 5 },
      },
    ],
    'BS3-062': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'green',
        },
        condition: { kind: 'support-count-at-least', count: 5 },
      },
    ],
    'BS3-063': [
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'hand-to-support', amount: 1, rested: true, optional: true },
    ],
    'BS3-064': [
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'draw-up-to', max: 1 },
    ],
    'BS3-065': [
      { kind: 'hand-to-support', amount: 1, rested: true, optional: true },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'support-count-at-least', count: 8 },
      },
    ],
    'BS3-066': [
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'deck-to-support', amount: 1, rested: false },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS3-055',
      },
    ],
    'BS3-067': [
      { kind: 'draw-up-to', max: 2 },
      {
        kind: 'set-active',
        supportCount: 1,
        selectable: true,
        condition: { kind: 'support-count-at-most', count: 6 },
      },
    ],
    'BS3-072': [
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 1,
        activeOnly: true,
        optional: true,
      },
    ],
    'BS3-077': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      { kind: 'set-active', supportCount: 0 },
    ],
    'BS3-097': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      { kind: 'deck-to-trash', amount: 1, side: 'opponent' },
    ],
    'BS3-100': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 2 },
      },
    ],
    'BS3-091': [
      { kind: 'inspect-deck', lookCount: 3, pickCount: 2, restDestination: 'top' },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS3-088',
      },
    ],
    'BS3-104': [
      { kind: 'opponent-random-discard', count: 2 },
      { kind: 'draw', amount: 2, side: 'opponent' },
    ],
    'BS3-105': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      { kind: 'deck-to-trash', amount: 2, side: 'opponent' },
    ],
    'BS3-115': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 2, maxLevel: 2 },
      },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS3-100',
      },
    ],
    'BS3-119': [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }],
    'BS3-028': [
      {
        kind: 'opponent-trash-to-break',
        max: 1,
        exactLevel: 1,
        condition: { kind: 'opponent-break-level-at-most', level: 6 },
      },
    ],
    'BS3-029': [
      {
        kind: 'hand-to-battle',
        amount: 1,
        energyColor: 'yellow',
        energyCost: { yellow: 1 },
        optional: true,
        gainHp: 1,
      },
    ],
    'BS3-073': [
      {
        kind: 'reveal-bottom-deck',
        cookieDestination: 'deck-top',
        otherwiseDestination: 'hand',
      },
    ],
    'BS3-087': [
      {
        kind: 'reveal-top-deck',
        match: { type: 'cookie', energyColor: 'blue', level: 2 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    ],
    'BS3-088': [
      {
        kind: 'draw-up-to-then-discard',
        max: 3,
        discardCount: 1,
        handDestination: 'deck-top',
      },
    ],
    'BS3-083': [
      {
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 0,
        restDestination: 'top',
      },
    ],
    'BS3-112': [
      { kind: 'trash-to-hand', max: 1, energyColor: 'purple', cookieOnly: true },
    ],
    'BS3-068': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: '將這張卡以休息狀態放入支援區',
            effects: [{ kind: 'place-source-to-support', rested: true }],
          },
          {
            label: '對手全體受到 1 傷害，然後棄 2 張支援區卡',
            effects: [
              { kind: 'damage-all', amount: 1, side: 'opponent' },
              { kind: 'support-to-trash', amount: 2 },
            ],
          },
        ],
      },
    ],
    'BS3-114': [
      {
        kind: 'inspect-deck',
        lookCount: 5,
        pickCount: 1,
        restDestination: 'trash',
        pickDestination: 'battle',
        filterColor: 'purple',
        filterType: 'cookie',
        optionalPick: true,
      },
    ],
    'BS3-040': [
      {
        kind: 'battle-to-break',
        target: { side: 'either', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    'BS3-076': [
      {
        kind: 'battle-to-deck-top',
        target: { side: 'either', min: 0, max: 1, maxLevel: 2 },
      },
    ],
    'BS3-031': [
      {
        kind: 'transfer-hp',
        amount: 1,
        direction: 'to-source',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS3-053': [
      {
        kind: 'set-cookie-active',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'green',
          restedOnly: true,
        },
      },
    ],
    'BS3-089': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'transfer-hp',
        amount: 1,
        direction: 'from-source',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS3-092': [
      {
        kind: 'draw-up-to-battle-cookie-count',
        level: 2,
        amountPerCookie: 1,
      },
    ],
    'BS3-113': [
      {
        kind: 'trash-to-deck-all',
        condition: {
          kind: 'trash-color-count-at-least',
          color: 'purple',
          count: 15,
        },
        // 洗回牌庫會清空棄牌區，傷害必須內嵌才不會被條件重判時跳過。
        thenEffects: [{ kind: 'damage-all', amount: 2, side: 'opponent' }],
      },
    ],
    'BS2-013': [
      {
        kind: 'battle-to-break',
        target: { side: 'self', min: 1, max: 1 },
      } satisfies CardEffect as CardEffect,
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 1,
      } satisfies CardEffect as CardEffect,
    ],
    'BS3-006': [
      {
        kind: 'modify-all-attack',
        amount: 1,
        duration: 'persistent',
        side: 'self',
        energyColor: 'red',
        minLevel: 2,
      },
    ],
    'BS3-007': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'break-level-at-least', level: 7 },
      },
    ],
    'BS3-014': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'any-battle-area-has-blocker' },
      },
    ],
    'BS3-098': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS3-103': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 10 },
      },
    ],
    'BS3-051': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'support-count-at-least', count: 5 },
      },
    ],
    'BS3-001': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'attack-target-remaining-hp-at-least', amount: 4 },
      },
    ],
    'BS3-018': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: 'During this turn, your opponent cannot activate Blocker.',
            effects: [{ kind: 'disable-block', duration: 'this-turn', side: 'opponent' }],
          },
          {
            label:
              'If there are no Cookies that have Blocker in your opponent\'s battle area, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
            effects: [{
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 0, max: 1 },
              condition: { kind: 'opponent-battle-area-has-no-blocker' },
            }],
          },
        ],
      },
    ],
    'BS3-090': [
      {
        kind: 'reveal-top-deck',
        match: { type: 'cookie', energyColor: 'blue', level: 2 },
        effects: [
          {
            kind: 'modify-attack',
            amount: 2,
            duration: 'this-turn',
            target: { side: 'self', min: 0, max: 1 },
          },
        ],
      },
    ],
    'BS3-116': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: 'Place 1 card from the top of 1 opponent Cookie HP in the trash.',
            effects: [{ kind: 'hp-to-trash', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }],
          },
          {
            label: 'Place 1 random card from opponent hand into the trash.',
            effects: [{ kind: 'opponent-random-discard' as const, count: 1 }],
          },
        ],
      },
    ],
    'BS3-025': [
      {
        kind: 'break-source-to-battle',
        hpCount: 1,
      },
    ],
    // === P-0XX 促銷卡 ===
    'P-001': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'P-002': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'P-003': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'P-013': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'P-014': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'P-007': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'P-008': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, minRemainingHp: 4 },
      },
    ],
    'P-010': [
      {
        kind: 'disable-attack',
        duration: 'opponent-next-turn',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    'P-011': [
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'hand-to-support', amount: 1, rested: true },
    ],
    'P-012': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      { kind: 'place-source-to-support', rested: true },
    ],
    'P-016': [
      {
        kind: 'trash-to-break',
        amount: 1,
        energyColor: 'yellow',
        exactLevel: 2,
      },
      {
        kind: 'break-to-trash',
        max: 2,
        energyColor: 'yellow',
        exactLevel: 1,
      },
    ],
    'P-018': [
      { kind: 'damage-all', amount: 1, side: 'opponent' },
      { kind: 'damage-all', amount: 1, side: 'self', excludeSource: true },
    ],
    'P-030': [
      { kind: 'damage-all', amount: 1, side: 'opponent' },
    ],
    'P-017': [
      {
        kind: 'deck-to-support',
        amount: 1,
        rested: true,
        condition: { kind: 'support-area-decreased-this-turn' },
      },
    ],
    'P-025': [
      {
        kind: 'multiply-attack-damage',
        multiplier: 2,
        condition: {
          kind: 'distinct-named-family-count',
          family: 'marzipan-cookie',
          battleAreaCount: 2,
          supportAreaCount: 4,
        },
      },
    ],
    'P-026': [
      {
        kind: 'multiply-attack-damage',
        multiplier: 2,
        condition: {
          kind: 'distinct-named-family-count',
          family: 'marzipan-cookie',
          battleAreaCount: 2,
          supportAreaCount: 4,
        },
      },
    ],
    'P-027': [
      {
        kind: 'multiply-attack-damage',
        multiplier: 2,
        condition: {
          kind: 'distinct-named-family-count',
          family: 'marzipan-cookie',
          battleAreaCount: 2,
          supportAreaCount: 4,
        },
      },
    ],
    // BS4-070「When this Cookie faints」的棄牌代價由 parseAbilityCost 自動解析，
    // 這裡只需要補上昏厥後的抽牌效果本身。
    'BS4-070': [{ kind: 'draw-up-to', max: 3 }],
    'BS4-082': [
      { kind: 'draw-up-to-then-discard', max: 3, discardCount: 2 },
    ],
    // 跟 BS3-083「View 3 cards from the top of your deck; place them on the
    // top of your deck in any order.」是同一種機制：pickCount 0、
    // restDestination 'top' 時，檢視到的卡全部照玩家決定的順序放回牌頂。
    'BS4-072': [
      { kind: 'inspect-deck', lookCount: 3, pickCount: 0, restDestination: 'top' },
    ],
    // === BS4 紅色餅乾卡技能 ===
    // 代價「Place 1 card from the top of this Cookie's HP into the trash」
    // 由 parseAbilityCost 的 hpToTrash 規則自動解析。
    'BS4-004': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS4-005': [
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        sequential: true,
        target: { side: 'opponent', min: 1, max: 2 },
      },
    ],
    'BS4-007': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'red',
        },
      },
    ],
    // BS4-011：被動觸發，官方文字沒有 {ap}/{mob} 標記，兩個子效果都要各自帶上
    // 同一個「本次戰鬥擊倒對方餅乾」條件，因為 CardEffect 是逐一判定，不是整個
    // 陣列共用一個條件。
    'BS4-011': [
      {
        kind: 'draw',
        amount: 1,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
      {
        kind: 'discard-hand',
        count: 1,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
    ],
    'BS4-012': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    'BS4-014': [
      {
        kind: 'modify-damage-received',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'attacker-level-at-most', level: 1 },
      },
    ],
    // === BS4 黃色餅乾卡技能 ===
    'BS4-038': [
      { kind: 'break-to-battle', amount: 1, maxLevel: 2, energyColor: 'yellow' },
    ],
    'BS4-026': [
      {
        kind: 'battle-to-break',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 },
        condition: { kind: 'opponent-break-level-at-most', level: 5 },
      },
    ],
    'BS4-028': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'break-level-at-least', level: 5 },
      },
      {
        kind: 'discard-hand',
        count: 1,
        condition: { kind: 'break-level-at-least', level: 5 },
      },
    ],
    // === BS4 綠色餅乾卡技能 ===
    // 代價「Place 1 card from your support area into the trash」由
    // parseAbilityCost 的 supportToTrash 規則自動解析。
    'BS4-051': [
      {
        kind: 'set-cookie-active',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS4-059': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'support-count-at-most', count: 3 },
      },
    ],
    'BS4-048': [
      {
        kind: 'set-active',
        supportCount: 1,
        condition: {
          kind: 'support-color-count-at-least',
          color: 'green',
          count: 7,
        },
      },
    ],
    'BS4-053': [
      {
        kind: 'battle-to-support',
        target: { side: 'self', min: 0, max: 1, maxLevel: 2, energyColor: 'green' },
      },
    ],
    // BS4-077：代價「Place this Cookie on the bottom of your deck」透過
    // exactCookieSkillCosts 的 selfToDeckBottom 硬編碼（官方文字沒有固定句式
    // 可泛用解析，跟 selfToBreakArea 一樣走per-card覆寫）。
    'BS4-077': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'hand-count-at-most', count: 5 },
            { kind: 'battle-area-has-color', side: 'self', color: 'blue' },
          ],
        },
      },
    ],
    // 中文卡面另一段用「或更多」明確標示「至少」，這段沒有那個字尾，
    // 確認「對手戰鬥區有2個餅乾」是剛好等於 2，不是至少 2。
    'BS4-089': [
      {
        kind: 'deck-to-trash',
        amount: 5,
        side: 'opponent',
      },
      {
        kind: 'opponent-battle-to-trash',
        min: 0,
        condition: { kind: 'opponent-battle-area-cookie-count', count: 2 },
      },
    ],
    // 中文卡面用「且」明確連接顏色與等級，是同一張卡要同時滿足紫色跟LV.3，
    // 不是分開各自判定存在（battle-area-has-color 已加上可選的 level 欄位）。
    'BS4-094': [
      {
        kind: 'deck-to-trash',
        amount: 3,
        side: 'self',
        condition: {
          kind: 'battle-area-has-color',
          side: 'self',
          color: 'purple',
          level: 3,
        },
      },
      {
        kind: 'deck-to-trash',
        amount: 3,
        side: 'opponent',
        condition: {
          kind: 'battle-area-has-color',
          side: 'self',
          color: 'purple',
          level: 3,
        },
      },
    ],
    // 中文卡面「從自己或對手的牌庫頂」確認是發動者自選要磨誰的牌庫，用既有的
    // choose-one 表達，不需要新的「可選邊」機制。
    'BS4-099': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: '磨自己牌庫',
            effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
          },
          {
            label: '磨對方牌庫',
            effects: [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }],
          },
        ],
      },
    ],
    // 中文卡面確認是兩段各自獨立的目標選擇：先選自己一隻紅色餅乾動它的 HP，
    // 再另外選對手一隻造成傷害，跟 BS3-115（hp-to-trash + equip-source 各自
    // 獨立目標）是同一種「陣列裡每個效果各自選目標」模式。
    'BS4-019': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, energyColor: 'red' },
      },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS4-058': [
      { kind: 'support-to-battle', amount: 1, energyColor: 'green' },
    ],
    'BS4-102': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: '磨自己牌庫',
            effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
          },
          {
            label: '磨對方牌庫',
            effects: [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }],
          },
        ],
      },
    ],
    'BS4-049': [
      {
        kind: 'battle-to-support',
        target: { side: 'opponent', min: 0, max: 1 },
        rested: true,
      },
    ],
    // === BS4 紫色卡技能／道具／場景 ===
    'BS4-095': [
      {
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        stageOnly: true,
      },
    ],
    // 代價「Place 1 card from the top of this Cookie's HP card into the
    // trash」由 parseAbilityCost 的 hpToTrash 規則（已放寬「HP card」用詞）自動解析。
    'BS4-096': [{ kind: 'draw-up-to', max: 1 }],
    'BS4-106': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 },
        condition: { kind: 'opponent-trash-count-at-least', count: 10 },
      },
    ],
    'BS4-107': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'opponent-trash-count-at-least', count: 15 },
      },
      {
        kind: 'choose-one',
        modes: [
          {
            label: '將牌庫頂 3 張牌放入自己的棄牌區',
            effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
          },
          {
            label: '將牌庫頂 2 張牌放入自己的棄牌區',
            effects: [{ kind: 'deck-to-trash', amount: 2, side: 'self' }],
          },
          {
            label: '將牌庫頂 1 張牌放入自己的棄牌區',
            effects: [{ kind: 'deck-to-trash', amount: 1, side: 'self' }],
          },
          {
            label: '不將牌庫頂的牌放入棄牌區',
            effects: [],
          },
        ],
        condition: { kind: 'opponent-trash-count-at-least', count: 15 },
      },
    ],
    'BS4-108': [
      { kind: 'trash-to-hand', max: 1, energyColor: 'purple' },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS4-081': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: '選對方 1 隻 LV.1 餅乾放到對方牌庫底',
            effects: [
              {
                kind: 'return-to-deck-bottom',
                target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
              },
            ],
          },
          {
            label: '抽 2 張',
            effects: [{ kind: 'draw-up-to', max: 2 }],
          },
        ],
      },
    ],
    // BS4-085 是複合效果（含 Then），通用解析器不處理 Then，需硬編碼；
    // 棄 4 張的代價一樣交給 parseAbilityCost 自動解析。
    'BS4-085': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 2 },
      },
      { kind: 'draw-up-to', max: 4 },
    ],
    // === BS4 效果稽核：可由既有 CardEffect 精確表達的能力 ===
    'BS4-020': [
      {
        kind: 'modify-attack',
        amount: 3,
        duration: 'this-turn',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          minLevel: 3,
          maxLevel: 3,
          energyColor: 'red',
        },
        condition: { kind: 'break-level-at-least', level: 6 },
      },
    ],
    'BS4-024': [
      {
        kind: 'redirect-attack',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: {
          kind: 'battle-area-has-color',
          side: 'self',
          color: 'yellow',
          level: 3,
        },
      },
    ],
    'BS4-052': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'support-color-count-at-least',
          color: 'green',
          count: 5,
        },
      },
    ],
    'BS4-025': [
      { kind: 'hand-to-break', amount: 1, energyColor: 'yellow', minLevel: 2 },
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 2,
        energyColor: 'yellow',
      },
    ],
    'BS4-030': [
      {
        kind: 'cycle-hp',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'yellow',
        },
      },
    ],
    'BS4-055': [
      { kind: 'deck-to-support', amount: 1, rested: true },
    ],
    'BS4-035': [
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 1,
        energyColor: 'yellow',
      },
    ],
    'BS4-040': [
      {
        kind: 'battle-to-break',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          minLevel: 2,
          energyColor: 'yellow',
        },
      },
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 3,
        energyColor: 'yellow',
      },
    ],
    'BS4-062': [
      {
        kind: 'rest-support-and-damage',
        supportSide: 'self',
        supportAmount: 4,
        supportEnergyColor: 'green',
        activeOnly: true,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS4-063': [
      { kind: 'deck-to-support', amount: 2, rested: true },
      { kind: 'support-to-trash', amount: 1 },
    ],
    'BS4-092': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    'BS4-093': [
      { kind: 'opponent-battle-to-trash', min: 0, maxLevel: 2 },
    ],
    'BS4-098': [
      {
        kind: 'disable-flip',
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS4-073': [
      {
        kind: 'return-to-deck-bottom',
        target: { side: 'self', min: 1, max: 1, maxLevel: 2 },
      },
      { kind: 'damage-all', amount: 1, side: 'opponent' },
    ],
    'BS4-074': [
      { kind: 'discard-hand-all' },
      { kind: 'draw-up-to', max: 4 },
    ],
    'BS4-075': [
      {
        kind: 'field-to-deck-bottom',
        target: { side: 'either', min: 1, max: 1, maxLevel: 1 },
        allowStage: true,
        battleSide: 'opponent',
      },
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS4-084': [
      { kind: 'draw-until-hand-equals-opponent' },
    ],
    // === BS5 RED ===
    // BS5-005 Mala Sauce Cookie：【Activate】【Once Per Turn】<{R}>
    // <Place 1 card from the top of your {R} LV.2 or higher Cookie's HP
    // into the trash.> 對手下 1 傷害。代價的顏色／等級條件見 exactCookieSkillCosts。
    'BS5-005': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS5-007 Fire Spirit Cookie：只選對手餅乾，不能把「this Cookie faints」
    // 誤判成來源自己的傷害目標。
    'BS5-007': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS5-011 Starfruit Cookie：<can be used as {R}.> Select up to 1 LV.1
    // opponent Cookie. 1 damage. 這個句式不是「of ... Cookies」，因此要
    // 明確覆寫目標，避免 parseTarget 把來源 faint 句誤讀成 self。
    'BS5-011': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    // BS5-010 Starch Noodle Cookie：【On Play】對手休息中 LV.2 以下餅乾 2 傷害。
    'BS5-010': [
      {
        kind: 'damage',
        amount: 2,
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
          maxLevel: 2,
          restedOnly: true,
        },
      },
    ],
    // BS5-013 Pitaya Dragon Cookie：【On Play】<Discard 1 {R} Cookie from your
    // hand.> 對手下 1 傷害。代價見 exactCookieSkillCosts。
    'BS5-013': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS5-014 Knight Cookie：【Activate】【Once Per Turn】指名對手
    // [Pitaya Dragon Cookie] 2 傷害（異畫變體同名，selector 以卡名篩選）。
    'BS5-014': [
      {
        kind: 'damage',
        amount: 2,
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
          cardName: 'Pitaya Dragon Cookie',
        },
      },
    ],
    // BS5-015 Carol Cookie：【On Play】<Place 1 card from the top of your other
    // Cookie's HP into the trash.> 對手下 1 傷害。代價見 exactCookieSkillCosts。
    'BS5-015': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS5-016 Tiramisu Cookie：【Activate】【Once Per Turn】<Place 1 card from
    // the top of this Cookie's HP into the trash.> If that card is a non-Cookie
    // card, 對手下 1 傷害。磨掉的卡類型由 payAbilityCost 寫入 costRecord。
    'BS5-016': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'last-hp-trash-card-non-cookie' },
      },
    ],
    // BS5-018 Flat Tofu Cookie：【On Play】<Discard 1 {R} trap card from your
    // hand.> 對手下 1 傷害。代價見 exactCookieSkillCosts。
    'BS5-018': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS5-019 Pudding Cookie：【Activate】【Once Per Turn】<{R}> <Discard 1 {R}
    // Cookie from your hand.> 本回合這張卡攻擊 +1。代價見 exactCookieSkillCosts。
    'BS5-019': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    // BS5-020 Crimson Dragon Mask（item）：<{R}{R}> If there are 2 Cookies
    // whose remaining HP is 1 in your battle area, 對所有對手餅乾 2 傷害。
    'BS5-020': [
      {
        kind: 'damage-all',
        amount: 2,
        side: 'opponent',
        condition: {
          kind: 'battle-area-remaining-hp-count-at-least',
          side: 'self',
          remainingHp: 1,
          count: 2,
        },
      },
    ],
    // BS5-021 Draconic Aura（trap）：<{R}> If there is a LV.3 Cookie in your
    // battle area, 選至多 2 張對手餅乾本回合攻擊 -1；Then 自 1 張己方餅乾的
    // HP 頂端回手至多 1 張卡。這裡只放效果（主效果狀態判定用）；發動門檻
    // （LV.3 Cookie 存在）與完整陷阱能力由 exactTrapEffects 的
    // TrapCondition 承載。
    'BS5-021': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 2 },
      },
      {
        kind: 'hp-to-hand',
        amount: 1,
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    // BS5-022 Pitaya Dragon Cookie's Nest（stage）：<{R}> Place in your stage
    // area. 【Activate】<{R}><Rest this card.><Place 1 card from the top of
    // your LV.2 or higher Cookie's HP into the trash.> During this turn, that
    // Cookie gains +1 attack damage. Then, if [Pitaya Dragon Cookie] is in
    // your battle area, draw up to 1 card。「that Cookie」用 costSelected
    // 指到剛付出 hpToTrash 代價的那張餅乾；代價見 exactStageCosts。
    'BS5-022': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, costSelected: true },
      },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Pitaya Dragon Cookie',
        },
      },
    ],
    // BS5-004 Lollipop Cookie／BS5-009 Butterbear Cookie（flip）：主效果欄位
    // === BS5 YELLOW ===
    // BS5-023 Dino-Sour Cookie：【Activate】【Once Per Turn】<Place 3 cards
    // from the top of this Cookie's HP into the trash.> 本回合這張卡攻擊 +2。
    // 代價由 parseAbilityCost 自動解析（this Cookie's HP，sourceOnly）。
    'BS5-023': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    // BS5-026 DJ Cookie：faint 技能「<place 1 {Y} LV.2 or lower Cookie from
    // your hand into your break area.> Return this Cookie to your hand.」。
    // faint 技能的代價由離場本身支付，方括號內的「放 1 張黃色 LV.2 以下餅乾
    // 進休息區」以第一個效果呈現（比照 BS3-061 寫法）；第二個效果把這張卡
    // 返回手牌。
    'BS5-026': [
      {
        kind: 'hand-to-break',
        amount: 1,
        energyColor: 'yellow',
        maxLevel: 2,
      },
      {
        kind: 'return-to-hand',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    // BS5-047 Cotton Cookie：【When this Cookie faints】<Place 1 card from
    // support area into the trash.> Set 1 support card active. 代價動作必須
    // 先進入效果佇列，才能在 UI 中支付後再選擇要恢復的支援卡。
    'BS5-047': [
      { kind: 'support-to-trash', amount: 1 },
      {
        kind: 'set-active',
        supportCount: 1,
        selectable: true,
        optional: false,
      },
    ],
    // BS5-028 Mango Cookie：【On Play】<{Y}> If your break area is LV.3 or
    // higher, 選至多 1 張對手的休息中 LV.2 以下餅乾，2 傷害。
    'BS5-028': [
      {
        kind: 'damage',
        amount: 2,
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
          maxLevel: 2,
          restedOnly: true,
        },
        condition: { kind: 'break-level-at-least', level: 3 },
      },
    ],
    // BS5-029 Mustard Cookie：【On Play】If there is a {Y} LV.3 Cookie in your
    // break area, 抽至多 1 張牌。
    'BS5-029': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'break-area-has-card',
          side: 'self',
          color: 'yellow',
          minLevel: 3,
          maxLevel: 3,
        },
      },
    ],
    // BS5-031 Peach Cookie：【On Play】If your break area LV. is higher than
    // your opponent's break area LV., 抽至多 1 張牌。
    'BS5-031': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'break-level-higher-than-opponent' },
      },
    ],
    // BS5-036 Milk Cookie：【Activate】<{Y}><Rest this card.><Discard 1 card.>
    // 選至多 1 張對手戰鬥區中沒有技能、LV.1 的餅乾，使其昏厥。昏厥走與傷害
    // 相同的流程：餅乾進休息區、HP 進棄牌區、觸發目標的 faint 技能。
    'BS5-036': [
      {
        kind: 'make-faint',
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
          maxLevel: 1,
          noSkillOnly: true,
        },
      },
    ],
    // BS5-039 Cheesecake Cookie：【On Play】選至多 1 張對手的 LV.2 以下、
    // 剩餘 HP 3 以上的餅乾，1 傷害。
    'BS5-039': [
      {
        kind: 'damage',
        amount: 1,
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
          maxLevel: 2,
          minRemainingHp: 3,
        },
      },
    ],
    // BS5-040 Ananas Dragon Cookie：【Activate】【Once Per Turn】<Place 1 card
    // from the top of this Cookie's HP into the trash.> 選至多 1 張對手餅乾，
    // 1 傷害。代價自動解析。
    'BS5-040': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS5-042 Sniffly Cocoa Palm（item）：<{Y}> <Place 1 of your Cookies' HP
    // cards in the trash.> If your break area is LV.5 or higher, draw up to 2
    // cards from your deck. 文字沒有「Select」目標句式，主效果要手動給；
    // HP 代價見 convertOfficialItemAbility 的 exactCosts。
    'BS5-042': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'break-level-at-least', level: 5 },
      },
    ],
    // BS5-044 Ananas Dragon Cookie's Nest（stage）：<{Y}> Place in your stage
    // area. 【Activate】<{Y}><Rest this card.> During this turn, if any of
    // your Cookies gained HP, select up to 1 of your opponent's Cookies. That
    // Cookie receives 1 damage. Then, <can be used as {Y}.> 1 of your
    // [Ananas Dragon Cookie] gains +1 HP。效果與 exactStageEffects 相同，
    // 提供 convertOfficialCardEffects 的主效果盤點（比照 BS5-022）。
    'BS5-044': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'cookie-gained-hp-this-turn' },
      },
      {
        kind: 'gain-hp',
        amount: 1,
        target: {
          side: 'self',
          min: 0,
          max: 1,
          cardName: 'Ananas Dragon Cookie',
        },
      },
    ],
    // BS5-045 Potato Cookie：【On Play】<Return 1 card from your support area
    // to your hand.> Draw up to 1 card from your deck.
    'BS5-045': [
      {
        kind: 'support-to-hand',
        amount: 1,
        optional: true,
      },
      { kind: 'draw-up-to', max: 1 },
    ],
    // BS5-048 Bellflower Cookie：【Activate】<{G}><Rest this card.>
    // <Discard 1 card.> 選至多 1 張對手戰鬥區中沒有技能、LV.1 的餅乾，使其
    // 昏厥。效果與代價寫法同 BS5-036（YELLOW）。
    'BS5-048': [
      {
        kind: 'make-faint',
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
          maxLevel: 1,
          noSkillOnly: true,
        },
      },
    ],
    // BS5-051 Beet Cookie：When your turn ends, if there are 2 active cards or
    // more in your support area, <can be used as {G}.> Place this Cookie on the
    // bottom of your deck.「can be used as {G}」是能量補充說明，不建效果；
    // 回合結束觸發由技能 endPhase 承載。
    'BS5-051': [
      {
        kind: 'return-to-deck-bottom',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'active-support-count-at-least', count: 2 },
      },
    ],
    // BS5-053 Shine Muscat Cookie：【On Play】<{G}{G}> Place up to 1 card from
    // the top of your deck into your support area as rested. 代價自動解析。
    'BS5-053': [{ kind: 'deck-to-support', amount: 1, rested: true }],
    // BS5-056 Longan Dragon Cookie：When your turn ends, if there are 3 active
    // cards or more in your support area, <can be used as {G}.> Select up to 1
    // of your opponent's Cookies. That Cookie receives 2 damage. 被動回合結束
    // 觸發（技能 endPhase）；攻擊的 Then 回合結束延遲見 exactAttackEffects。
    'BS5-056': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'active-support-count-at-least', count: 3 },
      },
    ],
    // BS5-058 Ginseng Cookie：When your turn ends, if there are 3 cards or less
    // in your support area, <can be used as {G}.> Draw up to 1 card from your
    // deck。
    'BS5-058': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'support-count-at-most', count: 3 },
      },
    ],
    // BS5-059 Purple Yam Cookie：【On Play】選至多 1 張對手的休息中 LV.2 以下
    // 餅乾，2 傷害。與 BS5-028 相同但沒有 break 條件。
    'BS5-059': [
      {
        kind: 'damage',
        amount: 2,
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
          maxLevel: 2,
          restedOnly: true,
        },
      },
    ],
    // BS5-063 Hero Cookie：When your turn ends, if there are 2 active cards or
    // more in your support area, draw up to 2 cards from your deck.
    'BS5-063': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'active-support-count-at-least', count: 2 },
      },
    ],
    // BS5-064 Dragon Orb（item）：<{G}{G}{G}> Place up to 1 card from the top
    // of your deck into your support area as rested. Then, if there are 7 cards
    // or more in your support area, draw up to 1 card from your deck. 效果與
    // item 能力相同，提供主效果盤點（比照 BS5-042）。
    'BS5-064': [
      { kind: 'deck-to-support', amount: 1, rested: true },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'support-count-at-least', count: 7 },
      },
    ],
    // BS5-065 Petrification（trap）：<{G}{G}{G}> 對手餅乾本回合攻擊 -2。
    // Then, if there are 7 cards or more in your support area, your opponent
    // selects 1 active card from their support area. Rest that card. 完整陷阱
    // 能力見 exactTrapEffects；這裡只做主效果盤點。
    'BS5-065': [
      {
        kind: 'modify-attack',
        amount: -2,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'opponent-rests-support',
        amount: 1,
        activeOnly: true,
        condition: { kind: 'support-count-at-least', count: 7 },
      },
    ],
    // BS5-087 Dino Greetings：陷阱主效果與 Then 條件分開建模；LV.6 條件
    // 只影響後續抽牌，不是陷阱的發動門檻。
    'BS5-087': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'break-level-at-least', level: 6 },
      },
    ],
    // BS5-109 Charmed Miners：第二個攻擊下降效果只鎖定對手 LV.1，且
    // 15 張棄牌條件是 Then 子句，不是陷阱的發動門檻。
    'BS5-109': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    // BS5-066 Longan Palace（stage）：<{G}> Place in your stage area. When
    // your turn ends, <discard 1 card.> Set up to 1 card from your support area
    // as active. Then, if [Longan Dragon Cookie] is in your battle area, draw
    // up to 1 card from your deck. 效果與 stageAbility 相同（棄牌為鏈中第一
    // 個效果），提供主效果盤點（比照 BS5-044）。
    'BS5-066': [
      { kind: 'discard-hand', count: 1 },
      { kind: 'set-active', supportCount: 1 },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Longan Dragon Cookie',
        },
      },
    ],
    // 是 flipText。BS5-004 的附著 +1 HP 由 FlipAbility.attachedHpBonus
    // 承載（見 exactFlipEffects），這裡空效果陣列只為讓主效果狀態判定為
    // supported；BS5-009 就是一般的抽 1。代價<Discard 1 card.>由 flip 轉接
    // 層的 parseAbilityCost 解析。
    // === BS5 BLUE ability conversions ===
    'BS5-068': [{ kind: 'draw-up-to', max: 1 }],
    'BS5-070': [
      {
        kind: 'return-to-hand',
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS5-071': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'break-level-at-least', level: 2 },
      },
    ],
    'BS5-072': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'break-level-at-least', level: 6 },
      },
    ],
    'BS5-074': [{ kind: 'draw-up-to', max: 2 }],
    'BS5-075': [
      {
        kind: 'damage',
        amount: 2,
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
          maxLevel: 2,
          restedOnly: true,
        },
        condition: { kind: 'hand-count-at-least', count: 5 },
      },
    ],
    'BS5-076': [
      {
        kind: 'make-faint',
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
          maxLevel: 1,
          noSkillOnly: true,
        },
      },
    ],
    'BS5-078': [{ kind: 'draw-up-to', max: 1 }],
    'BS5-081': [
      {
        kind: 'prevent-knockout',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS5-083': [
      {
        kind: 'gain-hp',
        amount: 2,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
      { kind: 'draw-up-to', max: 1 },
    ],
    'BS5-084': [
      {
        kind: 'set-cookie-active',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'blue',
        },
      },
    ],
    'BS5-086': [
      {
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 1,
        restDestination: 'bottom',
        pickDestination: 'battle',
        filterColor: 'blue',
        filterType: 'cookie',
        optionalPick: true,
        extraHp: 1,
        condition: { kind: 'battle-area-count-at-most', count: 1 },
      },
    ],
    'BS5-088': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
      {
        kind: 'draw-up-to',
        max: 2,
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Lotus Dragon Cookie',
        },
      },
    ],
    // === BS5 PURPLE ability conversions ===
    'BS5-091': [
      {
        kind: 'damage',
        amount: 2,
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
          maxLevel: 2,
          restedOnly: true,
        },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    'BS5-098': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, sourceOnly: true },
      },
    ],
    'BS5-100': [
      {
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 1,
        restDestination: 'trash',
        filterColor: 'purple',
        optionalPick: true,
      },
    ],
    'BS5-101': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 10 },
      },
    ],
    'BS5-102': [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
    'BS5-104': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      { kind: 'deck-to-trash', amount: 2, side: 'opponent' },
    ],
    'BS5-107': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      { kind: 'deck-to-trash', amount: 2, side: 'opponent' },
    ],
    'BS5-108': [
      {
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 1,
        restDestination: 'trash',
        filterColor: 'purple',
        filterType: 'cookie',
        optionalPick: true,
      },
    ],
    'BS5-110': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Lychee Dragon Cookie',
        },
      },
    ],
    // BS5-111 can equip any Dragon Cookie; the HP clause only gates its bonuses.
    'BS5-111': [
      {
        kind: 'equip-source',
        target: { side: 'self', min: 1, max: 1, keyword: 'dragon' },
        requiredKeyword: 'dragon',
        bonusMaxRemainingHp: 3,
        attackBonus: 1,
        damageReceivedReduction: 1,
      },
    ],
    'BS5-004': [],
    'BS5-009': [{ kind: 'draw-up-to', max: 1 }],
    'BS5-038': [{ kind: 'draw-up-to', max: 1 }],
    'BS5-046': [],
    // 其他四色的同款 flip：附著 +1 HP（041/082/095）與一般抽 1（049/090）。
    // 主效果只做狀態判定，能力實作各自在 exactFlipEffects。
    'BS5-041': [],
    'BS5-082': [],
    'BS5-095': [],
    'BS5-049': [{ kind: 'draw-up-to', max: 1 }],
    'BS5-090': [{ kind: 'draw-up-to', max: 1 }],
    // BS6 basic FLIP cards: attached +1 HP or draw up to 1 card.
    // The attachment bonus is represented by convertOfficialFlipAbility below.
    'BS6-006': [],
    'BS6-009': [{ kind: 'draw-up-to', max: 1 }],
    'BS6-027': [{ kind: 'draw-up-to', max: 1 }],
    'BS6-037': [],
    'BS6-046': [],
    'BS6-056': [{ kind: 'draw-up-to', max: 1 }],
    'BS6-067': [{ kind: 'draw-up-to', max: 1 }],
    'BS6-069': [],
    'BS6-103': [],
    'BS6-104': [{ kind: 'draw-up-to', max: 1 }],
    // BS6 RED: the first runtime batch uses existing target, HP, end-phase and
    // FLIP prevention primitives; these cards remain unavailable in the pool
    // until the full BS6 candidate is promotion-ready.
    'BS6-002': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 3 },
      },
    ],
    'BS6-001': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'BS6-004': [{ kind: 'draw-up-to', max: 2 }],
    'BS6-008': [
      {
        kind: 'disable-traps',
        duration: 'current-battle',
        condition: { kind: 'source-hp-at-most', amount: 4 },
      },
    ],
    'BS6-010': [{ kind: 'prevent-opponent-battle-movement' }],
    'BS6-011': [
      {
        kind: 'hp-to-hand',
        amount: 1,
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'BS6-012': [
      {
        kind: 'hp-to-hand',
        amount: 1,
        target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS6-014': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS6-021': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          minLevel: 2,
          maxRemainingHp: 3,
        },
        thenDrawUpToIfTargetRemainingHp: { remainingHp: 1, max: 1 },
      },
    ],
    'BS6-017': [
      {
        kind: 'disable-flip',
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS6-019：先將自己餅乾最上方的 HP 回手，再橫置對手最多 2 張支援卡。
    // 兩段都各自選擇目標，沿用既有 effect queue 逐段處理。
    'BS6-019': [
      {
        kind: 'hp-to-hand',
        amount: 1,
        target: { side: 'self', min: 1, max: 1 },
      },
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 2,
        activeOnly: true,
        optional: true,
      },
    ],
    'BS6-020': [
      {
        kind: 'modify-attack',
        amount: -2,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'hp-to-hand',
        amount: 1,
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    // BS6 YELLOW：本批只接入既有 effect primitive 可完整表示的效果。
    // 「從手牌放入休息區」保留為第一段 effect，確保先選牌並更新休息區後才進入後段。
    'BS6-023': [
      { kind: 'hand-to-break', amount: 1 },
      { kind: 'damage-all', amount: 1, side: 'opponent' },
    ],
    'BS6-025': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'break-level-at-most', level: 2 },
            { kind: 'hand-count-at-most', count: 6 },
          ],
        },
      },
    ],
    // 官方資料將 BS6-028~030 標為 NPC；匯入器已依其 Cookie 的等級、HP 與
    // 攻擊欄位正規化。這裡保留各自的登場技能結算。
    'BS6-028': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'break-area-card-count-at-least',
          side: 'self',
          count: 3,
        },
      },
    ],
    'BS6-030': [
      {
        kind: 'draw-up-to-break-cookie-count',
        minLevel: 2,
        amountPerCookie: 1,
      },
    ],
    'BS6-032': [
      { kind: 'hand-to-break', amount: 1 },
      { kind: 'draw-up-to', max: 2 },
    ],
    'BS6-033': [
      {
        kind: 'draw-up-to-then-discard',
        max: 2,
        discardCount: 2,
        condition: { kind: 'break-level-at-least', level: 4 },
      },
    ],
    'BS6-034': [
      { kind: 'reorder-hp', target: { side: 'self', min: 0, max: 1 } },
    ],
    'BS6-039': [
      {
        kind: 'opponent-break-to-trash-then-battle-to-break',
        condition: { kind: 'opponent-break-level-at-most', level: 6 },
      },
    ],
    'BS6-035': [
      {
        kind: 'set-active',
        supportCount: 1,
        selectable: true,
        optional: true,
        condition: {
          kind: 'break-area-card-count-at-least',
          side: 'self',
          count: 2,
        },
      },
    ],
    'BS6-041': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'break-area-card-count-at-least',
          side: 'self',
          count: 3,
        },
      },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'break-area-card-count-at-least',
          side: 'self',
          count: 3,
        },
      },
    ],
    'BS6-043': [
      { kind: 'hand-to-break', amount: 1, energyColor: 'yellow' },
      { kind: 'set-active', supportCount: 2, selectable: true, optional: true },
      { kind: 'draw-up-to', max: 1 },
    ],
    // BS6 GREEN：僅採用既有支援區張數條件與可表達的卡牌移動效果。
    'BS6-045': [
      {
        kind: 'draw',
        amount: 1,
        condition: { kind: 'support-count-less-than-opponent', difference: 4 },
      },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'support-count-less-than-opponent', difference: 4 },
      },
    ],
    'BS6-048': [
      {
        kind: 'draw',
        amount: 1,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
      {
        kind: 'opponent-discard-hand',
        count: 1,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    // BS6-050 Butter Pretzel Cookie："any number" 不是固定張數；僅列出
    // 綠色支援卡並保留 0 張選擇，確認後才一併返回手牌。
    'BS6-050': [
      {
        kind: 'support-to-hand',
        amount: 0,
        anyNumber: true,
        optional: true,
        energyColor: 'green',
      },
    ],
    'BS6-051': [
      {
        kind: 'support-to-hand',
        amount: 0,
        keepCount: 5,
        condition: { kind: 'support-count-at-least', count: 6 },
      },
    ],
    'BS6-052': [
      {
        kind: 'make-faint',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    'BS6-055': [
      {
        kind: 'modify-damage-received',
        amount: 0,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        minimumDamage: 0,
        setDamageTo: 0,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    'BS6-058': [
      {
        kind: 'damage-all',
        amount: 2,
        side: 'opponent',
        condition: { kind: 'support-count-less-than-opponent', difference: 2 },
      },
    ],
    'BS6-064': [
      {
        kind: 'hand-to-support',
        amount: 1,
        rested: false,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    // BS6-063 的「最多 1 張」必須讓玩家可以明確略過，不能在條件成立時
    // 一律把牌庫頂放進支援區；以既有 choose-one 呈現放置／不放置兩條路徑。
    'BS6-063': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'choose-one',
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'support-count-at-least', count: 5 },
            { kind: 'support-count-at-most', count: 5 },
          ],
        },
        modes: [
          {
            label: '將牌庫頂 1 張卡以休息狀態放入支援區',
            effects: [{ kind: 'deck-to-support', amount: 1, rested: true }],
          },
          { label: '不放置卡牌', effects: [] },
        ],
      },
    ],
    // BS6-057 Coffee Candy Cookie：自身進棄牌區與支援區餅乾回手皆為
    // 括號代價；自身離場由 skill cost 支付，接著強制選 1 張支援區餅乾
    // 返回手牌，最後抽最多 1 張。
    'BS6-057': [
      { kind: 'support-to-hand', amount: 1, cardType: 'cookie' },
      { kind: 'draw-up-to', max: 1 },
    ],
    'BS6-071': [{ kind: 'draw-up-to', max: 2 }],
    'BS6-072': [{ kind: 'draw-up-to', max: 3 }],
    // BS6-073 Schneeball Cookie：這是 On Play 技能效果，不是攻擊後效果。
    // 回手藍色 LV.1 餅乾本身由 exactCookieSkillCosts 支付。
    'BS6-073': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // BS6-066 Maple Taffy Cookie：登場代價先將己方藍色 LV.1 餅乾回手，
    // 再抽最多 1 張。
    'BS6-066': [
      {
        kind: 'return-to-hand',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          maxLevel: 1,
          energyColor: 'blue',
        },
      },
      { kind: 'draw-up-to', max: 1 },
    ],
    // BS6-079 Croissant Cookie：登場代價先將己方藍色 LV.2 以下餅乾
    // 放到牌庫底，再抽最多 2 張。
    'BS6-079': [
      {
        kind: 'field-to-deck-bottom',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          maxLevel: 2,
          energyColor: 'blue',
        },
      },
      { kind: 'draw-up-to', max: 2 },
    ],
    'BS6-080': [
      {
        kind: 'return-to-hand',
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    // BS6-081 Truffle Cookie：對手 LV.1 餅乾或任一方場景回到其擁有者
    // 牌庫底；後段的棄 1 張牌只在手牌至少 5 張時才執行。
    'BS6-081': [
      {
        kind: 'field-to-deck-bottom',
        target: { side: 'either', min: 0, max: 1, maxLevel: 1 },
        allowStage: true,
        battleSide: 'opponent',
      },
      {
        kind: 'discard-hand',
        count: 1,
        condition: { kind: 'hand-count-at-least', count: 5 },
      },
    ],
    'BS6-082': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS6-083': [{ kind: 'draw-up-to-then-discard', max: 2, discardCount: 1 }],
    'BS6-084': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS6-085': [
      {
        kind: 'modify-attack',
        amount: -2,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 4 },
      },
    ],
    'BS6-086': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, energyColor: 'blue' },
      },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'BS6-089': [{ kind: 'trash-to-hand', max: 1 }],
    'BS6-090': [{ kind: 'deck-to-trash', amount: 2, side: 'self' }],
    // BS6-091 官方資料只有異圖，且 adapter 會先把合併在 attackText 的技能
    // 拆回 skill.text。從棄牌區登場時可選己方另一張紫色 LV.1 休息區餅乾
    // 放入棄牌區。
    'BS6-091': [
      {
        kind: 'break-to-trash',
        max: 1,
        energyColor: 'purple',
        exactLevel: 1,
        excludeCardId: 'BS6-091',
      },
    ],
    'BS6-093': [
      {
        kind: 'field-to-trash',
        target: { side: 'self', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    'BS6-094': [
      {
        kind: 'field-to-trash',
        target: { side: 'self', min: 0, max: 1, maxLevel: 1 },
      },
    ],
    // BS6-101 的「最多 1 張」必須保留 0 張選擇；昏厥來源已離場，
    // 因此「can be used as {P}」不另外要求支援區付款。
    'BS6-101': [
      {
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        energyColor: 'purple',
      },
    ],
    'BS6-105': [{ kind: 'draw-up-to-then-discard', max: 2, discardCount: 1 }],
    'BS6-106': [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        energyColor: 'purple',
        maxHp: 2,
      },
    ],
    // BS6-087／098／099 只在「從棄牌區登場」時才觸發；觸發來源限制由
    // fromTrashArea 統一處理，以下只保留卡面指定的實際結算順序。
    'BS6-087': [{ kind: 'trash-to-hand', max: 1, energyColor: 'purple' }],
    'BS6-098': [{ kind: 'deck-to-trash', amount: 5, side: 'opponent' }],
    'BS6-099': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, minRemainingHp: 2 },
      },
    ],
    // BS6-107 TBD Machine Room：只有本回合已從棄牌區登場過餅乾時，才對
    // 對手全體造成效果傷害；旗標由 trash-to-battle 在實際登場後記錄。
    'BS6-107': [
      {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        condition: { kind: 'cookie-played-from-trash-this-turn' },
      },
    ],
  }
  const exactEffects = exactStarterEffects[cardKey] ?? P_EXACT_EFFECTS[cardKey]
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

  const isFaintSkill = FAINT_TRIGGER_PATTERN.test(sourceText)
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
    const strippedFaintText = stripEffectText(sourceText)
    const drawMatch = parseSimpleDraw(strippedFaintText)
    if (drawMatch !== null) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          isOptionalDraw(strippedFaintText)
            ? { kind: 'draw-up-to', max: drawMatch }
            : { kind: 'draw', amount: drawMatch },
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
    const strippedDrawText = stripEffectText(sourceText)
    const drawAmount = parseSimpleDraw(strippedDrawText)

    if (drawAmount !== null) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          isOptionalDraw(strippedDrawText)
            ? { kind: 'draw-up-to', max: drawAmount }
            : { kind: 'draw', amount: drawAmount },
        ],
      }
    }

    const conditionalDrawAmount = parseConditionalDraw(
      stripEffectText(sourceText),
    )

    // CONDITIONAL_DRAW_RE only matches "...you can draw...", so this is always optional
    if (conditionalDrawAmount !== null) {
      return {
        status: 'supported',
        cardNumber: card.cardNumber,
        sourceText,
        effects: [
          {
            kind: 'draw-up-to',
            max: conditionalDrawAmount,
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
  const abilityText = card.skill.text ?? card.attackText
  if (card.type !== 'item' || !abilityText) return undefined
  const conversion = convertOfficialCardEffects(card)
  if (conversion.status !== 'supported') {
    return undefined
  }
  const parsed = parseOfficialCardText(abilityText)
  if (!parsed) return undefined
  const cardKey = card.cardNumber.includes('@')
    ? card.baseCardNumber || card.cardNumber.split('@')[0]
    : card.cardNumber
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
    'BS2-048': { energy: { blue: 1 }, discardHand: 0 },
    'BS2-077': {
      energy: { purple: 2 },
      discardHand: 0,
      trashBattleCookie: { count: 1, level: 1, energyColor: 'purple' },
    },
    'BS4-040': {
      energy: { yellow: 2 },
      discardHand: 0,
    },
    // BS5-042 Sniffly Cocoa Palm（item）：<{Y}> <Place 1 of your Cookies' HP
    // cards in the trash.> 可選任何己方餅乾的 HP 支付（非 this Cookie 措辭，
    // parseAbilityCost 抓不到，且不能 sourceOnly）。
    'BS5-042': {
      energy: { yellow: 1 },
      discardHand: 0,
      hpToTrash: { amount: 1 },
    },
    'BS5-086': {
      energy: { blue: 2 },
      discardHand: 0,
    },
    'BS5-108': {
      energy: { purple: 1 },
      discardHand: 0,
    },
    'BS5-111': {
      energy: { neutral: 1 },
      discardHand: 0,
    },
    'BS6-084': {
      energy: { blue: 1 },
      discardHand: 1,
      discardHandAtLeast: true,
    },
    'BS6-105': {
      energy: { purple: 1 },
      discardHand: 0,
      trashBattleCookie: { count: 1, level: 1, energyColor: 'purple' },
    },
  }
  const parsedCost = parseAbilityCost(abilityText)
  const hasSpecialCost =
    (parsedCost.discardHand ?? 0) > 0 ||
    Boolean(parsedCost.supportToTrash) ||
    Boolean(parsedCost.supportToHand) ||
    Boolean(parsedCost.hpToTrash) ||
    Boolean(parsedCost.trashBattleCookie)
  return {
    cost: P_EXACT_SKILL_COSTS[cardKey] ?? exactCosts[cardKey] ?? (hasSpecialCost ? parsedCost : parsed.cost),
    text: abilityText,
    effects: conversion.effects,
    ...(P_EXACT_ITEM_ACTIVATION_COST_OVERRIDES[cardKey]
      ? { activationCostOverride: P_EXACT_ITEM_ACTIVATION_COST_OVERRIDES[cardKey] }
      : {}),
  }
}

export const convertOfficialStageAbility = (
  card: OfficialCardRecord,
): StageAbility | undefined => {
  if (card.type !== 'stage') return undefined
  const sourceText = [card.skill.text, card.attackText]
    .filter((text): text is string => Boolean(text?.trim()))
    .map((text) => text.replaceAll('\\"', '"').replace(/^"|"$/g, '').trim())
    .join('\n')
  if (!sourceText) return undefined
  const [placementText, activationText] = sourceText.split(
    STAGE_ACTIVATE_MARKER_PATTERN,
  )
  const endPhaseScope = getEndPhaseScope(sourceText)
  const placement = parseOfficialCardText(placementText)
  const activation = parseOfficialCardText(activationText ?? '')
  if (!placement) return undefined

  if (card.baseCardNumber === 'BS3-121') {
    if (!activation) return undefined

    return {
      placementCost: placement.cost,
      cost: activation.cost,
      text: sourceText,
      effects: [],
      restSource: RESTS_THIS_CARD_PATTERN.test(activationText ?? ''),
      specialVictory: {
        kind: 'distinct-named-keywords',
        requirements: [
          { keyword: 'ancient', cardType: 'cookie', count: 5 },
          { keyword: 'soul-jam', count: 5 },
        ],
      },
    }
  }

  // 複合效果（含 Then）仍需硬編碼；被動觸發階段（無 {mob}）也在此定義
  const exactStageEffects: Partial<Record<string, CardEffect[]>> = {
    'ST3-022': [
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'draw-up-to', max: 1 },
    ],
    'ST5-022': [{ kind: 'draw-up-to', max: 1 }],
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
      // 官方文字是《Place this card in the trash.》，不是「橫置」，RESTS_THIS_CARD_PATTERN
      // 抓不到，之前完全沒實作這個代價，變成可以每回合無限重複發動。
      { kind: 'stage-source-to-trash' },
    ],
    'BS3-023': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: 'During this turn, that Cookie gains +1 attack damage.',
            effects: [
              {
                kind: 'modify-attack',
                amount: 1,
                duration: 'this-turn',
                target: { side: 'self', min: 0, max: 1 },
              },
            ],
          },
          {
            label: 'Return 1 card from the top of this Cookie\'s HP to your hand.',
            effects: [
              {
                kind: 'hp-to-hand',
                amount: 1,
                target: { side: 'self', min: 0, max: 1 },
              },
            ],
          },
        ],
      },
    ],
    // BS5-022 Pitaya Dragon Cookie's Nest：<Place 1 card from the top of your
    // LV.2 or higher Cookie's HP into the trash.> 是本技能代價（見
    // exactStageCosts），「that Cookie」以 costSelected 指到代價選中的那張
    // 餅乾；抽牌段的 [Pitaya Dragon Cookie] 條件是戰鬥區指名卡名條件。
    'BS5-022': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, costSelected: true },
      },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Pitaya Dragon Cookie',
        },
      },
    ],
    'BS3-047': [
      {
        kind: 'hand-to-break-by-level-sum',
        targetSum: 3,
        energyColor: 'yellow',
      },
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 3,
        energyColor: 'yellow',
      },
    ],
    'BS3-048': [
      {
        kind: 'modify-attack-by-break-count',
        target: { side: 'self', min: 0, max: 1, minLevel: 2 },
        duration: 'this-turn',
        perCount: 1,
        exactBreakLevel: 3,
        breakEnergyColor: 'yellow',
      },
    ],
    'BS3-071': [
      {
        kind: 'disable-flip',
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 2 },
        // 官方文字「If a selected Cookie is LV.3, place this card in the
        // trash.」是依附在這次選擇結果上的場景卡自我送棄，不是看場面狀態
        // 的一般條件，見 DisableFlipEffect.trashSourceIfTargetLevel 註解。
        trashSourceIfTargetLevel: 3,
      },
    ],
    'BS3-072': [
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 1,
        activeOnly: true,
        optional: true,
        condition: { kind: 'opponent-support-count-at-least', count: 5 },
      },
    ],
    'BS3-095': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: 'View 3 cards from the top of your deck; place them back to the top of your deck in any order.',
            effects: [{ kind: 'inspect-deck', lookCount: 3, pickCount: 0, restDestination: 'top' }],
          },
          {
            label: 'Draw 1 card from your deck and place this card at the bottom of your deck.',
            effects: [
              { kind: 'draw', amount: 1 },
              { kind: 'stage-source-to-deck', destination: 'bottom' },
            ],
          },
        ],
      },
    ],
    'BS3-096': [
      {
        kind: 'draw',
        amount: 2,
        condition: { kind: 'hand-count-at-most', count: 2 },
      },
    ],
    'BS3-119': [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }],
    'BS3-120': [
      {
        kind: 'choose-one',
        modes: [
          {
            label: 'Place up to 2 cards from the top of your deck into the trash.',
            effects: [{ kind: 'deck-to-trash', amount: 2, side: 'self' }],
          },
          {
            label: 'View 3 cards from the top of your deck. Out of the 3 cards, reveal up to 1 {P} card and add that card to your hand. Then, place the remaining cards and this card in the trash.',
            effects: [
              {
                kind: 'inspect-deck',
                lookCount: 3,
                pickCount: 1,
                filterColor: 'purple',
                optionalPick: true,
                restDestination: 'trash',
              },
              { kind: 'stage-source-to-trash' },
            ],
          },
        ],
      },
    ],
    'BS3-024': [
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
      },
    ],
    'P-028': [
      {
        kind: 'hand-to-break',
        amount: 1,
        energyColor: 'yellow',
        minLevel: 2,
      },
      {
        kind: 'break-to-hand',
        amount: 1,
        energyColor: 'yellow',
        maxLevel: 1,
        optional: true,
      },
    ],
    'P-032': [
      {
        kind: 'modify-attack-cost',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          keyword: 'ancient',
        },
        energyCost: { neutral: 1 },
        duration: 'this-turn',
      },
    ],
    'BS4-110': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'trash-count-at-most', count: 15 },
      },
    ],
    'BS4-022': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: {
          side: 'self',
          min: 0,
          max: 1,
          minLevel: 2,
          energyColor: 'red',
        },
      },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS4-088': [
      {
        kind: 'return-to-hand',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          maxLevel: 2,
          minRemainingHp: 4,
          energyColor: 'blue',
        },
      },
    ],
    'BS4-044': [
      {
        kind: 'hand-to-hp',
        target: { side: 'self', min: 0, max: 1 },
        selectTarget: true,
        optional: true,
      },
    ],
    'BS4-066': [
      {
        kind: 'support-to-hp',
        target: { side: 'self', min: 0, max: 1 },
        energyColor: 'green',
        selectTarget: true,
        optional: true,
      },
    ],
    'BS4-111': [
      { kind: 'field-to-deck-bottom-all', maxLevel: 2 },
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, minLevel: 3, maxLevel: 3 },
      },
    ],
    // BS5-044 Ananas Dragon Cookie's Nest：【Activate】<{Y}><Rest this card.>
    // During this turn, if any of your Cookies gained HP, 選至多 1 張對手餅乾
    // 1 傷害。Then, 1 of your [Ananas Dragon Cookie] 獲得 +1 HP。gained HP
    // 條件由 cookiesGainedHpThisTurn 記錄（gain-hp 效果結算時寫入）。
    'BS5-044': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'cookie-gained-hp-this-turn' },
      },
      {
        kind: 'gain-hp',
        amount: 1,
        target: {
          side: 'self',
          min: 0,
          max: 1,
          cardName: 'Ananas Dragon Cookie',
        },
      },
    ],
    // BS5-066 Longan Palace：<{G}> Place in your stage area. When your turn
    // ends, <discard 1 card.> Set up to 1 card from your support area as
    // active. Then, if [Longan Dragon Cookie] is in your battle area, draw up
    // to 1 card from your deck. 被動回合結束觸發（endPhase），沒有 {mob}
    // 標記所以 cannot be manually activated；棄牌是效果鏈第一個效果（由
    // pendingAbilityEffect 通道讓玩家選要棄的手牌），代價列留空。
    'BS5-066': [
      { kind: 'discard-hand', count: 1 },
      { kind: 'set-active', supportCount: 1 },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Longan Dragon Cookie',
        },
      },
    ],
    'BS5-088': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
      {
        kind: 'draw-up-to',
        max: 2,
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Lotus Dragon Cookie',
        },
      },
    ],
    'BS5-110': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Lychee Dragon Cookie',
        },
      },
    ],
    // BS6-043 Timecraft Garage：回合結束時先將手牌黃餅乾放進休息區，
    // 然後玩家可選最多 2 張疲勞支援卡轉為活躍，最後抽最多 1 張。
    'BS6-043': [
      { kind: 'hand-to-break', amount: 1, energyColor: 'yellow' },
      { kind: 'set-active', supportCount: 2, selectable: true, optional: true },
      { kind: 'draw-up-to', max: 1 },
    ],
    'BS6-064': [
      {
        kind: 'hand-to-support',
        amount: 1,
        rested: false,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      },
    ],
    'BS6-086': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, energyColor: 'blue' },
      },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'hand-count-at-most', count: 3 },
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
    'BS3-024': {
      energy: { red: 2 },
      trashBattleCookie: { count: 1, energyColor: 'red' },
    },
    'P-028': { energy: { yellow: 1 } },
    'P-032': { energy: { neutral: 2 } },
    'BS4-110': { energy: { purple: 1 }, discardHand: 2 },
    'BS4-022': { energy: { red: 2 }, discardHand: 0 },
    'BS4-088': { energy: { blue: 1 }, discardHand: 1 },
    'BS4-044': { energy: { yellow: 2 }, discardHand: 1 },
    'BS4-066': { energy: { green: 3 }, discardHand: 0 },
    // BS5-022 Pitaya Dragon Cookie's Nest：【Activate】<{R}><Rest this
    // card.><Place 1 card from the top of your LV.2 or higher Cookie's HP
    // into the trash.> <Rest this card.> 由 RESTS_THIS_CARD_PATTERN 抓，
    // 這裡只要補能量與 hpToTrash 的等級條件。效果見 exactStageEffects。
    'BS5-022': {
      energy: { red: 1 },
      discardHand: 0,
      hpToTrash: { minLevel: 2 },
    },
    // BS5-044 Ananas Dragon Cookie's Nest：<{Y}> Place in your stage area.
    // 【Activate】<{Y}><Rest this card.> 代價（能量 + rest）由通關解析取得，
    // 效果見 exactStageEffects。
    'BS5-044': {
      energy: { yellow: 1 },
      discardHand: 0,
    },
    // BS5-066 Longan Palace：<{G}> Place in your stage area. 被動回合結束
    // 觸發，代價為 0（棄牌在效果鏈中處理，見 exactStageEffects）。
    'BS5-066': {
      energy: {},
      discardHand: 0,
    },
    'BS5-088': {
      energy: { blue: 1 },
      discardHand: 0,
    },
    'BS5-110': {
      energy: { purple: 1 },
      discardHand: 0,
    },
    // BS6-043 的黃卡手牌進休息區，是回合結束自動效果的第一段，
    // 不是場景啟動代價；避免走尚未通用化的 AbilityCost.handToBreakArea。
    'BS6-043': { energy: {}, discardHand: 0 },
    'BS6-086': { energy: {}, discardHand: 2 },
  }
  const stageEffects = exactStageEffects[card.baseCardNumber] ?? P_EXACT_EFFECTS[card.baseCardNumber]
  if (stageEffects) {
    return {
      placementCost: placement.cost,
      cost:
        exactStageCosts[card.baseCardNumber] ??
        P_EXACT_SKILL_COSTS[card.baseCardNumber] ??
        (activation?.cost ?? {}),
      text: sourceText,
      effects: stageEffects,
      // BS3-095@1 這個異畫版本的官方文字缺了「<Rest this card.>」（base／@2 都有），
      // 判斷是來源網站對該版本的資料缺漏，不是規則差異，固定以 baseCardNumber 覆寫。
      restSource:
        card.cardNumber === 'ST5-022' ||
        card.baseCardNumber === 'BS3-095' ||
        RESTS_THIS_CARD_PATTERN.test(activationText ?? ''),
      ...(card.cardNumber === 'ST5-022' ? { triggered: true } : {}),
      ...(endPhaseScope ? { endPhase: true, endPhaseScope } : {}),
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
    text: sourceText,
    effects: conversion.effects,
    restSource: RESTS_THIS_CARD_PATTERN.test(activationText ?? ''),
    ...(endPhaseScope ? { endPhase: true, endPhaseScope } : {}),
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
    !card.attackText
  ) {
    return undefined
  }

  const cardKey = card.cardNumber.includes('@')
    ? card.baseCardNumber || card.cardNumber.split('@')[0]
    : card.cardNumber
  const exactAttackEffects: Partial<Record<string, CardEffect[]>> = {
    // 已確認的 BS3 攻擊後續效果皆由既有 attack-effect pipeline 依序處理。
    // Soul Jam 僅可作為支援區 keyword 條件；附著仍待完整規則與 runtime 區域模型。
    'BS3-009': [
      {
        kind: 'damage',
        amount: 1,
        target: {
          side: 'opponent',
          min: 1,
          max: 1,
          attackTargetOnly: true,
        },
        condition: {
          kind: 'support-keyword-at-least',
          keyword: 'soul-jam',
          count: 1,
        },
      },
    ],
    'BS3-016': [
      {
        kind: 'set-active',
        supportCount: 0,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
    ],
    'BS3-002': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: {
              side: 'opponent',
              min: 1,
              max: 1,
              attackTargetOnly: true,
            },
          },
        ],
        effectText:
          'Use this Cookie as {R} to deal 1 damage to the attacked Cookie.',
      },
    ],
    'BS3-010': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
        effectText:
          'Use this Cookie as {R} to deal 1 damage to 1 opponent Cookie.',
      },
    ],
    'BS3-011': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 2 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
        effectText:
          'Use this Cookie as {R}{R} to deal 1 damage to 1 opponent Cookie.',
      },
    ],
    'BS3-013': [
      {
        kind: 'modify-damage-received',
        amount: 0,
        duration: 'opponent-next-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        minimumDamage: 2,
        setDamageTo: 1,
      },
    ],
    'BS3-017': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ],
    'BS3-028': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 6 },
      },
    ],
    'BS3-032': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'break-to-battle',
            amount: 1,
            exactLevel: 1,
            energyColor: 'yellow',
          },
        ],
        effectText:
          'Use this Cookie as {Y} to play up to 1 {Y} LV.1 Cookie from your break area.',
      },
    ],
    'BS3-037': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
            condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
          },
        ],
        effectText:
          "When your opponent's Cookie faints from this Cookie's attack, use this Cookie as {Y} to gain +1 HP.",
      },
    ],
    'BS3-033': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'opponent-battle-to-trash',
            min: 0,
            remainingHp: 1,
            destination: 'break',
          },
        ],
        effectText:
          'Use this Cookie as {Y} to place up to 1 opponent Cookie with 1 remaining HP in its break area.',
      },
    ],
    'BS3-041': [
      {
        kind: 'battle-to-break',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS3-055': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'support-to-trash',
            amount: 1,
            side: 'opponent',
            activeOnly: true,
            optional: true,
            condition: { kind: 'source-hp-at-least', amount: 5 },
          },
        ],
        effectText:
          "Use this Cookie as {G}; if it has 5 or more HP, place up to 1 active opponent support card in the trash.",
      },
    ],
    'BS3-060': [
      {
        kind: 'hp-to-trash',
        amount: 2,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
      {
        kind: 'set-active',
        supportCount: 2,
        selectable: true,
        condition: { kind: 'source-in-break-area' },
      },
    ],
    'BS3-076': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          {
            kind: 'reveal-top-deck',
            match: { type: 'cookie', energyColor: 'blue', level: 2 },
            effects: [
              {
                kind: 'damage',
                amount: 2,
                target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
              },
            ],
          },
        ],
        effectText:
          'Use this Cookie as {B}; reveal the top card of your deck. If it is a {B} LV.2 Cookie, deal 2 damage to the attacked Cookie.',
      },
    ],
    'BS3-080': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          {
            kind: 'reveal-top-deck',
            match: { type: 'cookie', energyColor: 'blue', level: 2 },
            effects: [{ kind: 'draw-up-to', max: 2 }],
          },
        ],
        effectText:
          'Use this Cookie as {B}; reveal the top card of your deck. If it is a {B} LV.2 Cookie, draw up to 2 cards.',
      },
    ],
    'BS3-086': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: {
              side: 'opponent',
              min: 1,
              max: 1,
              attackTargetOnly: true,
            },
            condition: {
              kind: 'battle-area-has-cookie-with-level',
              side: 'self',
              level: 3,
            },
          },
        ],
        effectText:
          'If you have a LV.3 Cookie in your battle area, discard 1 card to deal 1 damage to the attacked Cookie.',
      },
    ],
    'BS3-087': [
      {
        kind: 'damage',
        amount: 1,
        target: {
          side: 'opponent',
          min: 1,
          max: 1,
          maxLevel: 1,
          attackTargetOnly: true,
        },
        condition: {
          kind: 'support-keyword-at-least',
          keyword: 'soul-jam',
          count: 1,
        },
      },
    ],
    'BS3-088': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1 },
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 0, max: 1 },
          },
        ],
        effectText:
          'Discard 1 card to give up to 1 Cookie in your battle area +1 HP.',
      },
    ],
    'BS3-099': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    'BS3-100': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS3-101': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 } },
        effects: [
          {
            kind: 'opponent-battle-to-trash',
            min: 0,
            remainingHp: 2,
          },
        ],
        effectText:
          'Use this Cookie as {P} to place up to 1 opponent Cookie with 2 or less remaining HP in the trash.',
      },
    ],
    'BS3-102': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      { kind: 'deck-to-trash', amount: 2, side: 'opponent' },
    ],
    'BS3-105': [{ kind: 'deck-to-trash', amount: 1, side: 'opponent' }],
    'BS3-109': [
      {
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ],
    'BS3-111': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'support-keyword-at-least',
          keyword: 'soul-jam',
          count: 1,
        },
      },
    ],
    'BS3-113': [{ kind: 'deck-to-trash', amount: 1, side: 'self' }],
    'ST2-003': [{ kind: 'break-to-trash', max: 1, exactLevel: 1 }],
    'ST2-015': [
      {
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 1, max: 1 },
      },
      {
        kind: 'disable-attack',
        duration: 'opponent-next-turn',
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
      } satisfies CardEffect as CardEffect,
    ],
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
    'ST4-015': [{ kind: 'draw-up-to', max: 1 }],
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
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          },
        ],
        effectText:
          'You can pay {Y}{Y} more to deal an additional 3 damage to the same Cookie.',
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
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1, attackTargetOnly: true },
            condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
          },
        ],
        effectText: 'You can use this Cookie as {R} to deal 3 damage to 1 of your opponent\'s LV.1 Cookies.',
      } satisfies CardEffect as CardEffect,
    ],
    // === BS1/BS2 黃綠藍紫攻擊 Then 效果 ===
    'BS1-037': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'opponent-battle-to-trash',
            maxLevel: 1,
            destination: 'break',
          },
        ],
        effectText: 'You can use this Cookie as {Y} to select up to 1 of your opponent\'s LV.1 Cookies and place that Cookie in the break area.',
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-010': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1, attackTargetOnly: true },
            condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
          },
        ],
        effectText: 'You can use this Cookie as {Y} to deal 3 damage to 1 of your opponent\'s LV.1 Cookies.',
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-017': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1, attackTargetOnly: true },
            condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
          },
        ],
        effectText: 'You can use this Cookie as {G} to deal 3 damage to 1 of your opponent\'s LV.1 Cookies.',
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-044': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1, attackTargetOnly: true },
            condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
          },
        ],
        effectText: 'You can use this Cookie as {B} to deal 3 damage to 1 of your opponent\'s LV.1 Cookies.',
      } satisfies CardEffect as CardEffect,
    ],
    'BS2-045': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'hand-count-at-most', count: 6 },
      },
    ],
    'BS2-058': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
    ],
    'BS2-075': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 3,
            target: { side: 'opponent', min: 1, max: 1, maxLevel: 1, attackTargetOnly: true },
            condition: { kind: 'opponent-has-cookie-with-level', level: 1 },
          },
        ],
        effectText: 'You can use this Cookie as {P} to deal 3 damage to 1 of your opponent\'s LV.1 Cookies.',
      } satisfies CardEffect as CardEffect,
    ],
    // === P-0XX 促銷卡 ===
    'P-009': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'break-level-higher-than-opponent' },
      },
    ],
    'P-015': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          {
            kind: 'hp-to-trash',
            amount: 2,
            target: { side: 'self', min: 0, max: 1 },
          },
        ],
        effectText:
          'Use this Cookie as {R} to deal 1 damage to 1 of your opponent\'s Cookies, then place 2 cards from the top of 1 of your Cookie\'s HP into the trash.',
      },
    ],
    'P-019': [
      { kind: 'trash-to-deck', max: 3, excludeFlip: true },
    ],
    'P-030': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        effectText:
          'You can discard 1 card to deal 1 damage to 1 of your opponent\'s Cookies.',
      },
    ],
    // === BS4 藍色餅乾卡攻擊 Then ===
    'BS4-076': [
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS4-083': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'hand-count-at-least', count: 5 },
      },
    ],
    // === BS4 紅色餅乾卡攻擊 Then ===
    'BS4-004': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 },
        // BS4-004@1 的官方異圖文字是「remaining HP is 1」；攻擊結算時
        // 以「來源 HP 小於 2」表達同一個可觀察條件。
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    'BS4-003': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-color',
          side: 'self',
          color: 'red',
          excludeSource: true,
        },
      },
    ],
    'BS4-009': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'attack-target-level-at-most', level: 2 },
      },
    ],
    'BS4-013': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
          },
        ],
        effectText:
          'Use this Cookie as {R} to deal 1 damage to the attacked Cookie.',
      },
    ],
    'BS4-016': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1, remainingHp: 1 },
      },
    ],
    // === BS4 黃色餅乾卡攻擊 Then ===
    'BS4-038': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-color',
          side: 'self',
          color: 'yellow',
          excludeSource: true,
        },
      },
    ],
    'BS4-026': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'break-level-at-least', level: 3 },
          },
        ],
        effectText:
          "If your break area is LV.3 or higher, use this Cookie as {Y} to deal 2 damage to 1 of your opponent's Cookies.",
      },
    ],
    'BS4-039': [
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
        condition: { kind: 'source-hp-at-least', amount: 2 },
      },
    ],
    // === BS4 綠色餅乾卡攻擊 Then ===
    'BS4-053': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'support-count-at-least', count: 7 },
          },
        ],
        effectText:
          "If your support area contains 7 cards or more, use this Cookie as {G} to deal 1 damage to 1 of your opponent's Cookies.",
      },
    ],
    'BS4-049': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'opponent-support-count-at-least', count: 7 },
          },
        ],
        effectText:
          "If your opponent's support area contains 7 cards or more, use this Cookie as {G} to deal 2 damage to 1 of your opponent's Cookies.",
      },
    ],
    'BS4-054': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'support-count-at-least', count: 5 },
      },
    ],
    'BS4-061': [
      {
        kind: 'set-active',
        supportCount: 1,
        condition: { kind: 'support-count-at-least', count: 7 },
      },
    ],
    // === BS4 紫色卡攻擊 Then ===
    'BS4-103': [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
    'BS4-023': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'break-area-has-card',
          side: 'self',
          color: 'yellow',
          minLevel: 3,
          maxLevel: 3,
        },
      },
    ],
    'BS4-029': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'battle-to-break',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
          {
            kind: 'break-to-battle',
            amount: 1,
            exactLevel: 3,
            energyColor: 'yellow',
          },
        ],
        effectText:
          'Use this Cookie as {Y} to place this Cookie in your break area and play up to 1 {Y} LV.3 Cookie from your break area.',
      },
    ],
    'BS4-069': [
      {
        kind: 'opponent-discard-hand',
        count: 1,
        destination: 'deck-bottom',
      },
    ],
    'BS4-090': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'trash-flip-count-at-least', count: 3 },
      },
    ],
    'BS4-091': [
      {
        kind: 'trash-to-deck',
        max: 3,
        excludeFlip: true,
        destination: 'bottom',
      },
    ],
    'BS4-098': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: {
              kind: 'trash-color-count-at-least',
              color: 'purple',
              count: 15,
            },
          },
        ],
        effectText:
          "If your trash contains 15 {P} cards or more, use this Cookie as {P} to deal 2 damage to 1 of your opponent's Cookies.",
      },
    ],
    'BS4-089': [
      {
        kind: 'draw-up-to-then-discard',
        max: 2,
        discardCount: 1,
        condition: { kind: 'opponent-trash-count-at-least', count: 15 },
      },
    ],
    'BS4-073': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
            condition: { kind: 'hand-count-at-least', count: 5 },
          },
        ],
        effectText:
          'If your hand contains 5 cards or more, use this Cookie as {B} to deal 2 additional damage to the attacked Cookie.',
      },
    ],
    // BS4-075：中文卡面確認「棄2張手牌」沒有「可以／you may」字樣，是強制
    // 代價，不是像「can be used as」那樣的自選加費，所以不用
    // optional-cost-attack，直接照順序寫成兩個效果。
    'BS4-075': [
      { kind: 'discard-hand', count: 2 },
      {
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    // === BS5 RED 攻擊 Then ===
    // BS5-003 Strawberry Cream Cookie：Then, <discard 1 card.> Deals 1 damage.
    // 尖括號是攻擊後的可選代價；玩家可以略過棄牌與後續傷害。
    'BS5-003': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1 },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        }],
        effectText: 'Discard 1 card to deal 1 damage to the attacked Cookie.',
      },
    ],
    // BS5-006 Marshmallow Cookie：Then, if your break area is LV.6 or higher,
    // select up to 1 of your opponent's Cookies. 1 damage。
    'BS5-006': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'break-level-at-least', level: 6 },
      },
    ],
    // BS5-008 Chestnut Cookie：Then, if the attacked Cookie's remaining HP is
    // 3 or more, that Cookie receives 1 damage.
    'BS5-008': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'attack-target-remaining-hp-at-least', amount: 3 },
      },
    ],
    // BS5-010 Starch Noodle Cookie：Then, <place 1 card from the top of this
    // Cookie's HP into the trash.> Draw up to 1 card from your deck.
    'BS5-010': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, hpToTrash: { amount: 1, sourceOnly: true } },
        effects: [{ kind: 'draw-up-to', max: 1 }],
        effectText: "Trash 1 HP card from this Cookie to draw up to 1 card.",
      },
    ],
    // BS5-012 Eggnog Cookie：Then, if the attacked Cookie is LV.3, that Cookie
    // receives 1 damage.
    'BS5-012': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'attack-target-level-equals', level: 3 },
      },
    ],
    // BS5-013 Pitaya Dragon Cookie：Then, <can be used as {R}.> 是攻擊後
    // 可選的來源能量代價；未支付時不結算後續傷害。
    'BS5-013': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { red: 1 } },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 2 },
          condition: { kind: 'source-hp-less-than', amount: 5 },
        }],
        effectText:
          'Use this Cookie as {R}. If its remaining HP is 4 or less, deal 1 damage to up to 2 opponent Cookies.',
      },
    ],
    // === BS5 YELLOW 攻擊 Then ===
    // BS5-023 Dino-Sour Cookie：Then, if this Cookie's remaining HP is 3 or
    // less, this Cookie gains +1 HP。「3 or less」比照 BS3-028 慣例用
    // source-hp-less-than 4。
    'BS5-023': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 4 },
      },
    ],
    // BS5-024 Dr. Wasabi Cookie：Then, if the attacked Cookie's remaining HP
    // is 2 or less, that Cookie receives 1 damage。
    'BS5-024': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
        condition: { kind: 'attack-target-remaining-hp-at-most', amount: 2 },
      },
    ],
    // BS5-025 Leek Cookie：Then, if this Cookie's remaining HP is 1, you can
    // return this Cookie to your hand。「you can」為可選，但攻擊後條件效果在
    // 本引擎一律自動結算（條件成立即執行），與 BS5-035 等卡一致。
    'BS5-025': [
      {
        kind: 'return-to-hand',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    // BS5-030 Buttercream Choco Cookie：Then, <place this Cookie in your break
    // area.> Select up to 1 {Y} LV.1 Cookie from your break area. Play that
    // Cookie。
    'BS5-030': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, selfToBreakArea: true },
        effects: [{
          kind: 'break-to-battle',
          amount: 1,
          exactLevel: 1,
          energyColor: 'yellow',
        }],
        effectText:
          'Place this Cookie in your break area to play up to 1 {Y} LV.1 Cookie from your break area.',
      },
    ],
    // BS5-032 Birthday Cake Cookie：Then, if your break area LV. is higher
    // than your opponent's break area LV., 選至多 1 張對手餅乾 1 傷害。
    'BS5-032': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'break-level-higher-than-opponent' },
      },
    ],
    // BS5-035 Artichoke Cookie：Then, if this Cookie's remaining HP is 1,
    // 選至多 1 張對手餅乾 1 傷害。
    'BS5-035': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    // BS5-040 Ananas Dragon Cookie：Then, <can be used as {Y}.> 是可選代價。
    'BS5-040': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [{
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'source-hp-less-than', amount: 5 },
        }],
        effectText:
          'Use this Cookie as {Y}. If its remaining HP is 4 or less, it gains +1 HP.',
      },
    ],
    // === BS5 GREEN 攻擊 Then ===
    // BS5-056 Longan Dragon Cookie：Then, when your turn ends, set up to 1
    // card from your support area as active. 回合結束延遲效果：攻擊結算時只
    // 排隊（deferred-end-of-turn），由 end 階段的 processEndPhaseEffects
    // 依序結算。
    'BS5-056': [
      {
        kind: 'deferred-end-of-turn',
        effects: [{ kind: 'set-active', supportCount: 1 }],
      },
    ],
    // BS5-059 Purple Yam Cookie：Then, <return 1 card from your support area
    // to your hand.> 是可選支援區回手代價。
    'BS5-059': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, supportToHand: 1 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
        effectText:
          'Return 1 card from your support area to your hand to draw up to 1 card.',
      },
    ],
    // BS5-060 Croissant Cookie：Then, when your turn ends, set up to 3 cards
    // from your support area as active.
    'BS5-060': [
      {
        kind: 'deferred-end-of-turn',
        effects: [{ kind: 'set-active', supportCount: 3 }],
      },
    ],
    // === BS5 BLUE／PURPLE 攻擊 Then ===
    'BS5-067': [
      {
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 0,
        restDestination: 'top',
      },
    ],
    'BS5-071': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 3 },
      },
    ],
    'BS5-080': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }],
        effectText: 'Discard 2 cards to deal 1 damage to up to 1 opponent Cookie.',
      },
    ],
    'BS5-085': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
      { kind: 'draw-up-to', max: 1 },
    ],
    'BS5-089': [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
    'BS5-094': [
      {
        kind: 'optional-cost-attack',
        cost: {
          energy: {},
          trashToDeck: {
            count: 5,
            excludeFlip: true,
            energyColor: 'purple',
            cookieOnly: true,
          },
        },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }],
        effectText:
          'Return 5 {P} Cookies without FLIP from your trash to your deck to deal 1 damage to up to 1 opponent Cookie.',
      },
    ],
    'BS5-097': [
      {
        kind: 'draw-up-to-then-discard',
        max: 2,
        discardCount: 2,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
    ],
    'BS5-098': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, hpToTrash: { amount: 1, sourceOnly: true } },
        effects: [{
          kind: 'field-to-trash',
          target: {
            side: 'opponent',
            min: 1,
            max: 1,
            maxLevel: 1,
            attackTargetOnly: true,
          },
        }],
        effectText:
          "Trash 1 HP card from this Cookie to place the attacked LV.1 Cookie in the trash.",
      },
    ],
    'BS5-099': [
      { kind: 'deck-to-trash', amount: 2, side: 'self' },
      { kind: 'deck-to-trash', amount: 2, side: 'opponent' },
    ],
    'BS5-106': [
      { kind: 'draw', amount: 1 },
      { kind: 'deck-to-trash', amount: 3, side: 'self' },
    ],
    // === BS6 RED attack Then ===
    // BS6-003 Strawberry Stick Cookie：HP 是攻擊後可選代價。
    'BS6-003': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, hpToTrash: { amount: 1, energyColor: 'red' } },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }],
        effectText:
          'Place 1 card from the top of your red Cookie HP into the trash to deal 1 damage to up to 1 opponent Cookie.',
      },
    ],
    'BS6-007': [
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 2,
        activeOnly: true,
        optional: true,
        condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
      },
    ],
    'BS6-038': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'break-area-has-card',
          side: 'self',
          color: 'yellow',
          minLevel: 2,
        },
      },
    ],
    'BS6-060': [{ kind: 'support-to-hand', amount: 1 }],
    'BS6-013': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Chess Choco Cookie',
          excludeSource: true,
        },
      },
    ],
    'BS6-016': [
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    'BS6-018': [
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 0, max: 1 },
        condition: { kind: 'source-hp-less-than', amount: 2 },
      },
    ],
    // === BS6 YELLOW attack Then ===
    'BS6-022': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'return-to-hand',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
            condition: { kind: 'break-level-at-least', level: 3 },
          },
        ],
        effectText:
          'Use this Cookie as {Y}. If your break area is LV.3 or higher, return this Cookie to your hand.',
      },
    ],
    'BS6-024': [
      {
        kind: 'damage-by-break-count',
        perCount: 1,
        exactBreakLevel: 3,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
    'BS6-031': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'break-level-at-least', level: 4 },
          },
        ],
        effectText:
          'Use this Cookie as {Y}. If your break area is LV.4 or higher, deal 2 damage to up to 1 opponent Cookie.',
      },
    ],
    // === BS6 GREEN attack Then ===
    'BS6-053': [
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'support-count-at-least', count: 5 },
            { kind: 'support-count-at-most', count: 5 },
          ],
        },
      },
    ],
    'BS6-059': [
      {
        kind: 'return-to-hand',
        target: { side: 'self', min: 0, max: 1, sourceOnly: true },
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'support-count-at-least', count: 5 },
            { kind: 'support-count-at-most', count: 5 },
          ],
        },
      },
    ],
    'BS6-044': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, supportToHand: 1, supportToHandType: 'cookie' },
        effects: [{ kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 } }],
        effectText:
          'Return 1 Cookie from your support area to your hand to deal 2 damage.',
      },
    ],
    'BS6-061': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, supportToHand: 1, supportToHandType: 'cookie' },
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 0, max: 1, maxRemainingHp: 5 },
          },
        ],
        effectText:
          'Return 1 Cookie from your support area to your hand to gain 1 HP.',
      },
    ],
    'BS6-036': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { yellow: 1 } },
        effects: [
          {
            kind: 'gain-hp',
            amount: 1,
            perBreakCard: { exactLevel: 3 },
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
        effectText:
          'Use this Cookie as {Y}. This Cookie gains +1 HP for each LV.3 Cookie in your break area.',
      },
    ],
    'BS6-051': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'hand-to-support',
            amount: 2,
            rested: false,
            optional: true,
            energyColor: 'green',
            condition: {
              kind: 'opponent-support-count-at-least',
              count: 3,
            },
          },
        ],
        effectText:
          'Use this Cookie as {G}. If your opponent has 3 or more support cards, place up to 2 {G} cards from your hand into your support area as active.',
      },
    ],
    'BS6-096': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 }, selfToTrash: true },
        effects: [
          {
            kind: 'trash-to-battle',
            amount: 1,
            exactLevel: 1,
            energyColor: 'purple',
            condition: {
              kind: 'battle-area-has-cookie-with-level',
              side: 'self',
              level: 3,
            },
          },
        ],
        effectText:
          'Use this Cookie as {P}. Place this Cookie in the trash, then play 1 {P} LV.1 Cookie from your trash.',
      },
    ],
    'BS6-065': [
      {
        kind: 'discard-hand',
        count: 1,
        condition: { kind: 'hand-count-at-least', count: 6 },
      },
    ],
    'BS6-072': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [{ kind: 'draw-up-to', max: 2 }],
        effectText: 'Discard 2 cards to draw up to 2 cards.',
      },
    ],
    'BS6-074': [
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 5 },
      },
    ],
    'BS6-076': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
        effectText: 'Discard 1 card to draw up to 1 card.',
      },
    ],
    // BS6-068／077 的「can be used as {B}」是攻擊後可選來源能量代價。
    'BS6-068': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [{
          kind: 'field-to-deck-bottom',
          target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
          condition: { kind: 'hand-count-at-most', count: 5 },
        }],
        effectText:
          'Use this Cookie as {B}. If your hand has 5 or fewer cards, place up to 1 opponent LV.1 Cookie on the bottom of its deck.',
      },
    ],
    'BS6-077': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { blue: 1 } },
        effects: [{
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'hand-count-at-most', count: 5 },
        }],
        effectText:
          'Use this Cookie as {B}. If your hand has 5 or fewer cards, it gains +1 HP.',
      },
    ],
    'BS6-079': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 1 },
        effects: [
          {
            kind: 'rest-support',
            side: 'opponent',
            amount: 3,
            activeOnly: true,
            optional: true,
          },
        ],
        effectText:
          "Discard 1 card. Select up to 3 cards in your opponent's support area. Rest those cards.",
      },
    ],
    'BS6-093': [
      {
        kind: 'optional-cost-attack',
        cost: { energy: { purple: 1 } },
        effects: [
          {
            kind: 'trash-to-battle',
            amount: 1,
            optional: true,
            energyColor: 'purple',
            maxHp: 2,
          },
        ],
        effectText:
          'Use this Cookie as {P}. Play up to 1 {P} Cookie with 2 or less HP from your trash.',
      },
    ],
    'BS6-095': [
      {
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        energyColor: 'purple',
        maxHp: 2,
      },
    ],
    'BS6-102': [
      { kind: 'deck-to-trash', amount: 3, side: 'self' },
      { kind: 'deck-to-trash', amount: 3, side: 'opponent' },
    ],
  }

  if (exactAttackEffects[cardKey]) {
    return exactAttackEffects[cardKey]
  }

  if (P_EXACT_ATTACK_EFFECTS[cardKey]) {
    return P_EXACT_ATTACK_EFFECTS[cardKey]
  }

  if (!/\bThen\b/i.test(card.attackText)) {
    return undefined
  }

  return exactAttackEffects[cardKey]
}

export const convertOfficialFlipAbility = (
  card: OfficialCardRecord,
): FlipAbility | undefined => {
  const flipText = card.flipText ?? card.skill.text
  // 官方資料也會把帶有 FLIP 能力的餅乾記成 COOKIE（例如 BS5-073/074）。
  // 是否能翻面應以 FLIP 文案判斷，不能只看 card.type。
  const hasFlipRecord =
    card.type === 'flip' ||
    (card.type === 'cookie' && Boolean(card.flipText?.trim()))
  if (!hasFlipRecord || !flipText) {
    return undefined
  }

  const cardKey = card.cardNumber.includes('@')
    ? card.baseCardNumber || card.cardNumber.split('@')[0]
    : card.cardNumber

  // 官方 BS4-032@1 異圖的 card_flip 欄位只重複攻擊名稱；依官方卡圖補回
  // 與同卡基礎版本一致的抽牌效果。
  if (
    card.cardNumber === 'BS4-032@1' &&
    /^<\{Y\}\{Y\}>\s*Creamcraft Magic!\s*$/i.test(flipText.trim())
  ) {
    return {
      text: 'Draw up to 1 card from your deck.',
      cost: parseAbilityCost(flipText),
      effects: [{ kind: 'draw-up-to', max: 1 }],
    }
  }

  const exactFlipEffects: Partial<Record<string, { effects: CardEffect[]; cost?: AbilityCost; attachedHpBonus?: number }>> = {
    'P-024': {
      cost: { energy: {}, discardHand: 1 },
      effects: [
        {
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ],
    },
    // BS5-004 Lollipop Cookie／BS5-041 Firecracker Cookie／BS5-082 Ion Cookie
    // Robot／BS5-095 Mint Wafer Cookie：「The Cookie with this card attached
    // for HP gains +1 HP.」是附著期間的連續效果，不是一次性 gain-hp——
    // 只要這張卡還附在目標餅乾的 HP 上，剩餘 HP 就 +1，卡離開加成就消失。
    // 因此 effects 為空，附著加成由 FlipAbility.attachedHpBonus 承載，
    // 剩餘 HP 計算走 helpers.getCookieEffectiveHp。代價 <Discard 1 card.>
    // 由 parseAbilityCost 解析。
    'BS5-004': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS5-046': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS5-009': {
      effects: [{ kind: 'draw-up-to', max: 1 }],
    },
    'BS5-041': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS5-082': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS5-095': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS6-006': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS6-009': {
      effects: [{ kind: 'draw-up-to', max: 1 }],
    },
    'BS6-027': {
      effects: [{ kind: 'draw-up-to', max: 1 }],
    },
    'BS6-037': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS6-046': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS6-056': {
      effects: [{ kind: 'draw-up-to', max: 1 }],
    },
    'BS6-067': {
      effects: [{ kind: 'draw-up-to', max: 1 }],
    },
    'BS6-069': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS6-103': {
      effects: [],
      attachedHpBonus: 1,
    },
    'BS6-104': {
      effects: [{ kind: 'draw-up-to', max: 1 }],
    },
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
          allowStage: true,
          autoSelect: true,
          condition: { kind: 'break-level-at-least', level: 3 },
        } satisfies CardEffect as CardEffect,
      ],
    },
    'BS1-067': {
      effects: [
        {
          kind: 'flip-to-support',
          rested: true,
          condition: { kind: 'support-count-at-least', count: 4 },
        } satisfies CardEffect as CardEffect,
      ],
    },
    // 跟 BS3-083 的技能是同一種機制，見 exactStarterEffects 裡的註解。
    'BS4-072': {
      effects: [
        { kind: 'inspect-deck', lookCount: 3, pickCount: 0, restDestination: 'top' },
      ],
    },
    'BS4-057': {
      effects: [
        {
          kind: 'flip-to-support',
          rested: true,
          condition: { kind: 'break-level-at-least', level: 6 },
        },
      ],
    },
    'BS4-031': {
      effects: [
        {
          kind: 'break-to-hand',
          amount: 1,
          minLevel: 1,
          maxLevel: 1,
          optional: true,
        },
        {
          kind: 'flip-to-break',
          condition: { kind: 'break-level-at-least', level: 5 },
        },
      ],
    },
    // 中文卡面「從自己或對手的牌庫頂」跟 BS4-099 是同一種「自選磨誰的牌庫」，
    // 一樣用 choose-one 表達。
    'BS4-102': {
      effects: [
        {
          kind: 'choose-one',
          modes: [
            {
              label: '磨自己牌庫',
              effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
            },
            {
              label: '磨對方牌庫',
              effects: [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }],
            },
          ],
        },
      ],
    },
  }
  const exactFlip = exactFlipEffects[cardKey]
  const pExactFlip = P_EXACT_FLIP_EFFECTS[cardKey]
  if (exactFlip) {
    return {
      text: flipText,
      cost: exactFlip.cost ?? parseAbilityCost(flipText),
      effects: exactFlip.effects,
      ...(exactFlip.attachedHpBonus !== undefined
        ? { attachedHpBonus: exactFlip.attachedHpBonus }
        : {}),
    }
  }
  if (pExactFlip) {
    return {
      text: flipText,
      cost: pExactFlip.cost ?? parseAbilityCost(flipText),
      effects: pExactFlip.effects,
      ...(pExactFlip.attachedHpBonus !== undefined
        ? { attachedHpBonus: pExactFlip.attachedHpBonus }
        : {}),
    }
  }

  const stripped = stripEffectText(flipText)
  const drawAmount = parseSimpleDraw(stripped)

  if (drawAmount !== null) {
    return {
      text: flipText,
      cost: parseAbilityCost(flipText),
      effects: isOptionalDraw(stripped)
        ? [{ kind: 'draw-up-to', max: drawAmount }]
        : [{ kind: 'draw', amount: drawAmount }],
    }
  }

  const conditionalDrawAmount = parseConditionalDraw(stripped)
  if (conditionalDrawAmount !== null) {
    return {
      text: flipText,
      cost: parseAbilityCost(flipText),
      effects: [
        {
          kind: 'draw-up-to',
          max: conditionalDrawAmount,
          condition: parseCondition(stripped),
        },
      ],
    }
  }

  const target = parseTarget(flipText)
  const damageMatch = flipText.match(/receives?\s+(\d+)\s+damage/i)
  if (target && damageMatch) {
    return {
      text: flipText,
      cost: parseAbilityCost(flipText),
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
      text: flipText,
      cost: parseAbilityCost(flipText),
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
  if (card.type !== 'trap' || !(card.skill.text ?? card.attackText)) {
    return undefined
  }

  const text = card.skill.text ?? card.attackText!
  const condition = parseTrapCondition(text)
  const target = parseTarget(text)
  const effects: CardEffect[] = []
  const attackDecrease = text.match(
    /deals?\s+-(\d+)\s+attack damage/i,
  )
  const damage = text.match(/receives?\s+(\d+)\s+damage/i)
  const preventKnockout = /HP cannot reach 0 during this battle/i.test(text)
  const supportToTrash = text.match(
    /place\s+(\d+)\s+card(?:s)?\s+from your support area (?:in|into) the trash/i,
  )
  const deckToRestedSupport = text.match(
    /take the top card from your deck and place it in your support area as rested/i,
  )
  const supportToHand = text.match(
    /return (\d+) card(?:s)? from your support area to your hand/i,
  )
  const handToSupport = text.match(
    /place (\d+) card(?:s)? from your hand into your support area as rested/i,
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

  if (supportToHand) {
    effects.push({
      kind: 'support-to-hand',
      amount: Number(supportToHand[1]),
      optional: true,
    })
  }

  if (handToSupport) {
    effects.push({
      kind: 'hand-to-support',
      amount: Number(handToSupport[1]),
      rested: true,
    })
  }

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
      target: { side: 'self', min: 1, max: 1, excludeAttackTarget: true },
    })
  }

  if (supportToTrash) {
    effects.push({
      kind: 'support-to-trash',
      amount: Number(supportToTrash[1]),
    })
  }

  if (trapDrawAmount !== null) {
    effects.push(
      isOptionalDraw(strippedAfterThen)
        ? { kind: 'draw-up-to', max: trapDrawAmount }
        : { kind: 'draw', amount: trapDrawAmount },
    )
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

  const exactTrapEffects: Partial<
    Record<
      string,
      {
        effects: CardEffect[]
        cost?: AbilityCost
        alternativeCosts?: AbilityCost[]
        condition?: TrapAbility['condition']
        ignoreParsedCondition?: boolean
      }
    >
  > = {
    'P-036': {
      cost: { energy: { red: 3 } },
      effects: [
        { kind: 'damage-all', amount: 1, side: 'self' },
        { kind: 'damage-all', amount: 1, side: 'opponent' },
      ],
    },
    'BS3-046': {
      // 條件在戰鬥中延後判定：本次戰鬥有己方 {Y} LV.2 以上餅乾昏厥才發動。
      condition: {
        kind: 'friendly-color-fainted-this-battle',
        color: 'yellow',
        minLevel: 2,
      },
      effects: [
        {
          kind: 'break-to-battle',
          amount: 1,
          exactLevel: 1,
          energyColor: 'yellow',
        },
      ],
    },
    'BS2-050': {
      effects: [
        {
          kind: 'return-to-deck-bottom',
          target: { side: 'opponent', min: 1, max: 1, remainingHp: 3 },
        },
      ],
      cost: { energy: { blue: 3 }, discardHand: 1 },
    },
    'BS2-079': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        { kind: 'trash-to-deck', max: 5, excludeFlip: true },
      ],
    },
    'BS3-021': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -3,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'self', min: 1, max: 1 },
        },
      ],
    },
    'BS3-022': {
      condition: {
        kind: 'break-level-at-least',
        level: 6,
      },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    },
    'BS3-045': {
      effects: [
        {
          kind: 'damage-by-break-count',
          perCount: 1,
          exactBreakLevel: 3,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    },
    'BS4-043': {
      effects: [
        {
          kind: 'damage-by-break-level-difference',
          target: { side: 'opponent', min: 0, max: 1 },
          condition: { kind: 'break-level-higher-than-opponent' },
        },
      ],
    },
    'BS4-065': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        { kind: 'deck-to-support', amount: 1, rested: true },
      ],
    },
    'BS4-109': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'inspect-deck',
          lookCount: 3,
          pickCount: 1,
          filterColor: 'purple',
          optionalPick: true,
          restDestination: 'trash',
        },
      ],
    },
    'BS3-069': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'support-to-trash',
          amount: 2,
        },
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    },
    'BS3-070': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 2 },
        },
        // 官方文字「if your support area contains 5 or more, draw up to 2
        // cards ... and discard 1 card」是單一個「若 X 則抽 N 張再棄 M 張」
        // 的複合子句，不是兩個各自獨立判斷條件的動作。過去拆成 draw-up-to
        // 與 discard-hand 兩個各掛同一條件的獨立效果，會被 playTrap 的
        // 陷阱效果迴圈連續呼叫 executeCardEffect（迴圈只在 pendingRevealTopDeck
        // 時才 break，pendingDrawUpTo 不會），導致 pendingDrawUpTo 與
        // pendingOpponentHandDiscard 在同一次結算裡就同時被設置，UI 只是
        // 剛好疊圖只顯示前者，玩家會覺得抽完牌後突然又跳出一個「無關」的
        // 棄牌視窗。改用 draw-up-to-then-discard（跟 BS3-088 同一種複合效果）
        // 才會走 resolveDrawUpTo 的 afterEffects 銜接流程，UI 才能正確顯示
        // 「步驟 1/2 → 2/2」的接續提示。
        {
          kind: 'draw-up-to-then-discard',
          max: 2,
          discardCount: 1,
          condition: { kind: 'support-count-at-least', count: 5 },
        },
      ],
    },
    'BS3-093': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'reveal-top-deck',
          match: { type: 'cookie', energyColor: 'blue', level: 2 },
          effects: [
            {
              kind: 'modify-attack',
              amount: -1,
              duration: 'this-turn',
              target: { side: 'opponent', min: 0, max: 1 },
            },
          ],
        },
      ],
    },
    'BS3-094': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'inspect-deck',
          lookCount: 3,
          pickCount: 0,
          restDestination: 'top',
        },
      ],
    },
    'BS3-117': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -3,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'field-to-trash',
          target: { side: 'opponent', min: 0, max: 1, remainingHp: 2 },
          condition: { kind: 'trash-count-at-least', count: 15 },
        } satisfies CardEffect as CardEffect,
      ],
    },
    'BS3-118': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        { kind: 'deck-to-trash', amount: 2, side: 'self' },
      ],
    },
    'P-031': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1, minLevel: 3, maxLevel: 3 },
        },
        {
          kind: 'hp-to-trash',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1, minLevel: 3, maxLevel: 3 },
        },
      ],
    },
    'P-082': {
      cost: { energy: { yellow: 1, neutral: 1 } },
      alternativeCosts: [
        {
          energy: {},
          trashCookieToBreakArea: {
            count: 1,
            hp: 1,
            excludeFlip: true,
          },
        },
      ],
      effects: [
        {
          kind: 'gain-hp',
          amount: 2,
          target: { side: 'self', min: 1, max: 1 },
        },
        {
          kind: 'gain-hp',
          amount: 2,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
    },
    'P-029': {
      condition: { kind: 'friendly-cookie-fainted-this-battle' },
      effects: [
        {
          kind: 'trash-to-battle',
          amount: 1,
          energyColor: 'green',
        },
      ],
    },
    // BS5-021 Draconic Aura：<{R}> If there is a LV.3 Cookie in your battle
    // area, 選至多 2 張對手餅乾本回合攻擊 -1；Then 自 1 張己方餅乾的 HP 頂端
    // 回手至多 1 張卡。LV.3 條件是「發動門檻」（TrapCondition），不是個別
    // 效果的條件，條件不成立時整張陷阱不能發動。
    'BS5-021': {
      condition: { kind: 'battle-area-has-cookie-with-level', level: 3 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 2 },
        },
        {
          kind: 'hp-to-hand',
          amount: 1,
          target: { side: 'self', min: 0, max: 1 },
        },
      ],
    },
    // BS5-065 Petrification：<{G}{G}{G}> Select up to 1 of your opponent's
    // Cookies. This attack deals -2 attack damage this turn. Then, if there
    // are 7 cards or more in your support area, your opponent selects 1
    // active card from their support area. Rest that card. 無發動門檻（7 張
    // 支援區條件屬於 Then 子句，不是陷阱的 play 條件）；對手選擇橫置由
    // opponent-rests-support 效果通道處理。
    'BS5-065': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'opponent-rests-support',
          amount: 1,
          activeOnly: true,
          condition: { kind: 'support-count-at-least', count: 7 },
        },
      ],
    },
    'BS5-087': {
      ignoreParsedCondition: true,
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'draw-up-to',
          max: 2,
          condition: { kind: 'break-level-at-least', level: 6 },
        },
      ],
    },
    'BS5-109': {
      ignoreParsedCondition: true,
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1, maxLevel: 1 },
          condition: { kind: 'trash-count-at-least', count: 15 },
        },
      ],
    },
    'BS6-020': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'hp-to-hand',
          amount: 1,
          target: { side: 'self', min: 0, max: 1 },
        },
      ],
    },
    // BS6-042 的「休息區有 3 張以上餅乾」是陷阱發動門檻，不是只略過
    // 效果的 Then 條件；用 TrapCondition 保證條件不成立時不會出現在可發動清單。
    'BS6-063': {
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'choose-one',
          condition: {
            kind: 'all-of',
            conditions: [
              { kind: 'support-count-at-least', count: 5 },
              { kind: 'support-count-at-most', count: 5 },
            ],
          },
          modes: [
            {
              label: '將牌庫頂 1 張卡以休息狀態放入支援區',
              effects: [{ kind: 'deck-to-support', amount: 1, rested: true }],
            },
            { label: '不放置卡牌', effects: [] },
          ],
        },
      ],
    },
    'BS6-042': {
      condition: { kind: 'break-area-card-count-at-least', count: 3 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1, minLevel: 2 },
        },
        { kind: 'draw-up-to', max: 1 },
      ],
    },
    'BS6-085': {
      cost: { energy: { blue: 1 }, discardHand: 2 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'draw-up-to',
          max: 2,
          condition: { kind: 'hand-count-at-most', count: 4 },
        },
      ],
    },
    'BS6-106': {
      cost: { energy: { purple: 2 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'trash-to-battle',
          amount: 1,
          optional: true,
          energyColor: 'purple',
          maxHp: 2,
        },
      ],
    },
  }

  const exactTrap =
    exactTrapEffects[card.cardNumber] ?? exactTrapEffects[card.baseCardNumber]
  if (exactTrap) {
    return {
      text,
      cost: exactTrap.cost ?? parseAbilityCost(text),
      ...(exactTrap.alternativeCosts
        ? { alternativeCosts: exactTrap.alternativeCosts }
        : {}),
      condition: exactTrap.ignoreParsedCondition
        ? exactTrap.condition
        : exactTrap.condition ?? condition,
      effects: exactTrap.effects,
    }
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

const exactCookieSkillCosts: Partial<Record<string, AbilityCost>> = {
  // 這兩張的手牌餅乾進休息區，需由 effect queue 帶出選卡 UI 並先結算，
  // 不能當成僅有陷阱路徑支援的 AbilityCost.handToBreakArea。
  'BS6-023': { energy: {}, discardHand: 0 },
  'BS6-032': { energy: {}, discardHand: 0 },
  'BS6-045': {
    energy: { green: 1 },
    discardHand: 0,
    trashBattleCookie: { count: 1, sourceOnly: true },
  },
  'BS6-052': {
    energy: { green: 2 },
    discardHand: 0,
    supportToHand: 2,
  },
  'BS6-057': {
    energy: { green: 1 },
    discardHand: 0,
    trashBattleCookie: { count: 1, sourceOnly: true },
  },
  'BS6-073': {
    energy: { blue: 1 },
    discardHand: 0,
    battleCookieToHand: {
      count: 1,
      maxLevel: 1,
      energyColor: 'blue',
    },
  },
  'BS6-082': {
    energy: {},
    discardHand: 1,
    discardHandAtLeast: true,
  },
  'BS6-001': {
    energy: {},
    discardHand: 0,
    hpToTrash: { amount: 2, energyColor: 'red' },
  },
  'BS6-004': {
    energy: {},
    discardHand: 0,
    hpToTrash: { amount: 1, energyColor: 'red' },
  },
  'BS6-014': {
    energy: {},
    discardHand: 0,
    hpToTrash: { amount: 2 },
  },
  'BS2-015': {
    energy: { green: 4 },
    discardHand: 0,
    trashBattleCookie: { count: 1, sourceOnly: true },
  },
  'BS1-038': {
    energy: { yellow: 2 },
    discardHand: 0,
    selfToBreakArea: true,
  },
  'BS2-011': {
    energy: { yellow: 2 },
    discardHand: 0,
    selfToBreakArea: true,
  },
  'BS4-077': {
    energy: { blue: 1 },
    discardHand: 0,
    selfToDeckBottom: true,
  },
  'BS4-001': {
    energy: { red: 2 },
    discardHand: 0,
    selfToBreakArea: true,
  },
  'BS4-092': {
    energy: { purple: 1 },
    discardHand: 0,
    trashBattleCookie: {
      count: 1,
      maxLevel: 2,
      energyColor: 'purple',
      excludeSource: true,
    },
  },
  'BS2-071': {
    energy: { purple: 1 },
    discardHand: 0,
    trashBattleCookie: { count: 1, sourceOnly: true },
  },
  'BS3-075': { energy: {}, discardHand: 1 },
  'BS3-081': { energy: { blue: 2 }, discardHand: 1 },
  'BS3-112': {
    energy: { purple: 1 },
    discardHand: 0,
    trashToDeckBottom: { count: 2, nonCookieOnly: true },
  },
  'BS3-051': { energy: { green: 1 }, discardHand: 0 },
  'BS3-098': {
    energy: { purple: 1 },
    discardHand: 0,
    trashToDeck: { count: 5, energyColor: 'purple', excludeFlip: true },
  },
  // 「<Place this Cookie in the trash.>」是這個技能的代價（比照 BS2-015／
  // BS2-071 的 trashBattleCookie 寫法），generic parseAbilityCost 只認得
  // 「Place N (energy) LV.X Cookie from your battle area into the trash」
  // 這種措辭，「this Cookie」是自我指涉、抓不到，沒有這個覆寫的話發動這個
  // 技能就完全不用犧牲自己。
  'BS3-105': {
    energy: { purple: 1 },
    discardHand: 0,
    trashBattleCookie: { count: 1, sourceOnly: true },
  },
  'BS3-025': { energy: { yellow: 1 }, discardHand: 0 },
  'P-016': { energy: { yellow: 1 }, discardHand: 0 },
  'P-018': { energy: {}, discardHand: 1 },
  'P-030': { energy: {}, discardHand: 2 },
  // BS5 RED 系列代價覆寫（詳細文字在 data/candidates/ 的原始 JSON）。
  // BS5-005 Mala Sauce Cookie：【Activate】<{R}><Place 1 card from the top of
  // your {R} LV.2 or higher Cookie's HP into the trash.> 技能效果是選對手餅乾
  // 1 傷害，見 exactStarterEffects。
  'BS5-005': {
    energy: { red: 1 },
    discardHand: 0,
    hpToTrash: { energyColor: 'red', minLevel: 2 },
  },
  // BS5-007 Fire Spirit Cookie：【When this Cookie faints】<Discard 1 {R}
  // item card from your hand.> 這個棄牌是昏厥技能的代價，不能只依賴一般
  // faint 效果轉接，否則會出現技能提示但沒有支付入口的狀態。
  'BS5-007': {
    energy: {},
    discardHand: 1,
    discardHandColor: 'red',
    discardHandType: 'item',
  },
  // BS5-013 Pitaya Dragon Cookie：【On Play】<Discard 1 {R} Cookie from your
  // hand.> 紅龍 Cookie 是 DRAGON 關鍵字，本身是餅乾。
  'BS5-013': {
    energy: {},
    discardHand: 1,
    discardHandColor: 'red',
    discardHandType: 'cookie',
  },
  // BS5-015 Carol Cookie：【On Play】<Place 1 card from the top of your other
  // Cookie's HP into the trash.>（不能犧牲自己）
  'BS5-015': {
    energy: {},
    discardHand: 0,
    hpToTrash: { excludeSource: true },
  },
  // BS5-018 Flat Tofu Cookie：【On Play】<Discard 1 {R} trap card from your
  // hand.>
  'BS5-018': {
    energy: {},
    discardHand: 1,
    discardHandColor: 'red',
    discardHandType: 'trap',
  },
  // BS5-019 Pudding Cookie：【Activate】【Once Per Turn】<{R}><Discard 1 {R}
  // Cookie from your hand.> 效果是本回合自身攻擊 +1（見 exactStarterEffects）。
  'BS5-019': {
    energy: { red: 1 },
    discardHand: 1,
    discardHandColor: 'red',
    discardHandType: 'cookie',
  },
  'BS5-071': {
    energy: {},
    discardHand: 3,
    discardHandAtLeast: true,
    discardHandColor: 'blue',
  },
  'BS5-074': {
    energy: { blue: 1 },
    discardHand: 0,
  },
  'BS5-076': {
    energy: { blue: 1 },
    discardHand: 1,
  },
  'BS5-078': {
    energy: { blue: 1 },
    discardHand: 0,
  },
  'BS5-081': {
    energy: {},
    discardHand: 4,
  },
  'BS5-083': {
    energy: {},
    discardHand: 0,
    discardAllHand: true,
  },
  'BS5-084': {
    energy: {},
    discardHand: 1,
  },
}

const exactCookieSkillSourceEnergy: Partial<
  Record<string, CardSkill['sourceEnergy']>
> = {
  'P-017': { green: 1 },
}

/**
 * 通用觸發判斷靠 `{mob}`／`{ap}` 標記，但 BS3-025 的文字沒有這兩種標記
 * （只有 `{mt}`），只以「once per game」與「休息區」文意表達可主動發動，
 * 一般解析會誤判成 passive，需要明確覆寫。
 */
const exactCookieSkillTriggers: Partial<Record<string, SkillTrigger>> = {
  'BS3-025': 'activate',
  'BS4-004': 'on-play',
  'BS5-081': 'opponent-attack',
}

/**
 * P-002／P-003／P-013／P-014（GingerBright 黃/綠/藍/紫版本）的官方文字把
 * `{mt}` 誤植成 `{mt)`（少了右大括號），一般的 token 解析抓不到合法標記，
 * 導致 yourTurn 被判成 false。P-001（紅版本）文字正確，不需要覆寫。
 */
const exactCookieSkillYourTurn: Partial<Record<string, boolean>> = {
  'P-002': true,
  'P-003': true,
  'P-013': true,
  'P-014': true,
}

export const convertOfficialCookieSkill = (
  card: OfficialCardRecord,
): CardSkill | undefined => {
  if ((card.type !== 'cookie' && card.type !== 'flip') || !card.skill.text) {
    return undefined
  }

  const cardKey = card.cardNumber.includes('@')
    ? card.baseCardNumber || card.cardNumber.split('@')[0]
    : card.cardNumber
  const conversion = convertOfficialCardEffects(
    card.type === 'flip' ? { ...card, type: 'cookie' } : card,
  )
  const cost = P_EXACT_SKILL_COSTS[cardKey] ?? exactCookieSkillCosts[cardKey] ?? parseAbilityCost(card.skill.text)
  const parsed = parseOfficialCardText(card.skill.text)
  const endPhaseScope = getEndPhaseScope(card.skill.text)

  if (
    conversion.status !== 'supported' ||
    !parsed
  ) {
    return undefined
  }

  return {
    trigger:
      P_EXACT_SKILL_TRIGGERS[cardKey] ??
      exactCookieSkillTriggers[cardKey] ??
      (/when this Cookie is played from the trash/i.test(card.skill.text)
        ? 'on-play'
        : undefined) ??
      (parsed.markers.includes('bl') &&
      /redirect\s+the\s+attack\s+to\s+this\s+Cookie/i.test(card.skill.text)
        ? 'block'
        : parsed.markers.includes('mob')
          ? 'activate'
          : parsed.markers.includes('ap')
            ? 'on-play'
            : 'passive'),
    oncePerTurn: parsed.markers.includes('t1'),
    yourTurn: exactCookieSkillYourTurn[cardKey] ?? parsed.markers.includes('mt'),
    restSource: RESTS_THIS_CARD_PATTERN.test(card.skill.text),
    cost,
    ...(P_EXACT_SPECIAL_PLAY_COSTS[cardKey]
      ? { specialPlayCost: P_EXACT_SPECIAL_PLAY_COSTS[cardKey] }
      : {}),
    ...(P_SOURCE_ENERGY[cardKey] ?? exactCookieSkillSourceEnergy[cardKey]
      ? { sourceEnergy: P_SOURCE_ENERGY[cardKey] ?? exactCookieSkillSourceEnergy[cardKey] }
      : {}),
    text: conversion.sourceText,
    effects: conversion.effects,
    faint: FAINT_TRIGGER_PATTERN.test(card.skill.text),
    endPhase: endPhaseScope !== undefined,
    ...(endPhaseScope ? { endPhaseScope } : {}),
    afterDamage: /(?:after|when)\s+(?:receiving|taking)\s+damage/i.test(
      card.skill.text,
    ),
    oncePerGame: /once per game/i.test(card.skill.text),
    // 只認「來源自己目前在休息區」這個前提句式（BS3-025），不能用寬鬆的
    // 「文字裡有提到 break area」去比對——P-016／BS3-036／BS1-035／BS1-038
    // 的文字都提到 break area，但那是效果的目標／去向（送某張卡進休息區），
    // 不是這個技能本身只能從休息區發動的前提，誤判會讓 findSkillSource 在
    // 這些卡意外流落休息區時把它們當成可發動的技能來源。
    fromBreakArea: /this Cookie is in your break area/i.test(card.skill.text),
    fromTrashArea:
      P_FROM_TRASH.has(cardKey) ||
      /when this Cookie is played from the trash/i.test(card.skill.text),
    fromSupportArea: P_FROM_SUPPORT.has(cardKey),
  }
}
