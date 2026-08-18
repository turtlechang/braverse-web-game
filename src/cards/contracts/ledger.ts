import { createHash } from 'node:crypto'
import type {
  CardEffect,
  EnergyCost,
  EffectTargetSelector,
  GameCard,
} from '../../game'
import {
  convertOfficialCardToGameCard,
  normalizeOfficialCardRecord,
} from '../official-card-adapter'
import { parseOfficialCardText } from '../official-text-parser'
import type { OfficialCardRecord } from '../types'
import type {
  CardBehaviorAudit,
  CardBehaviorContract,
  CardClauseFragment,
  CardTextSource,
  ContractCost,
  ContractPayment,
  ContractResolutionStep,
  ContractTiming,
  ContractTarget,
  RuntimeCardEvidence,
} from './types'

const ENERGY_TOKEN_TO_COLOR: Record<string, keyof EnergyCost> = {
  R: 'red',
  Y: 'yellow',
  G: 'green',
  B: 'blue',
  P: 'purple',
  K: 'black',
  N: 'neutral',
}

const ACTION_PATTERNS: readonly [RegExp, CardClauseFragment['role']][] = [
  [/\b(?:draw\w*|reveal\w*|inspect\w*|look at|view\w*|rearrange\w*)\b/i, 'effect'],
  [/\b(?:deal\w*|receiv\w*|gain\w*|damage\w*|attack\w*|faint\w*|equip\w*|redirect\w*|mou\w*|discard\w*)\b|\{da\}/i, 'effect'],
  [
    /\b(?:play|place|return|move|put|take|trash|discard|rest|set|make)\b/i,
    'effect',
  ],
  [
    /\b(?:if|when|while|as long as|whenever|cannot\s+(?:activate|be activated|reach|be selected|be trashed)|only be used|sum reaches|higher than|lower than|less than|more than)\b/i,
    'condition',
  ],
  [/\bselect\b/i, 'target'],
]

const stripMarkupTags = (text: string): string =>
  text
    // Official exports occasionally contain presentation-only HTML around a
    // FLIP label.  Do not strip the rule brackets: those are parsed below.
    .replace(/<\/?(?:em|strong|b|i|span|br|p)(?:\s[^>]*)?>/gi, '')
    .replace(/&nbsp;/gi, ' ')

const normalizeWhitespace = (text: string): string =>
  stripMarkupTags(text).replace(/\s+/g, ' ').trim()

const hashSource = (record: OfficialCardRecord): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        cardNumber: record.cardNumber,
        baseCardNumber: record.baseCardNumber,
        type: record.type,
        skill: record.skill,
        attackText: record.attackText,
        flipText: record.flipText,
      }),
    )
    .digest('hex')

const sourceSegments = (
  record: OfficialCardRecord,
): Partial<Record<CardTextSource, string>> => {
  const segments: Partial<Record<CardTextSource, string>> = {}
  if (record.skill.text?.trim()) segments.skill = record.skill.text.trim()
  if (record.attackText?.trim()) segments.attack = record.attackText.trim()
  if (record.flipText?.trim()) segments.flip = record.flipText.trim()
  if (!segments.skill && !segments.attack && !segments.flip) {
    if (record.skill.name?.trim()) segments.ability = record.skill.name.trim()
  }
  return segments
}

// `{bl}` is the printed Blocker keyword, not a skill timing marker.  Treating
// it as timing made every item containing "cannot activate Blocker" fail the
// contract even though the runtime effect was present.
const TIMING_MARKERS = new Set(['mob', 'ap', 't1', 'mt'])

const tokenize = (text: string): string[] =>
  [...text.matchAll(/\{([A-Za-z0-9_]+)\}|(?:<|《)([^>》]+)(?:>|》)/g)].map(
    (match) => match[1] ?? match[2]?.trim() ?? '',
  )

const addClause = (
  clauses: CardClauseFragment[],
  source: CardTextSource,
  text: string,
  role: CardClauseFragment['role'],
  start: number,
  end: number,
  confidence: CardClauseFragment['confidence'],
): void => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return
  clauses.push({
    id: `${source}-${clauses.length + 1}`,
    source,
    text: normalized,
    role,
    start,
    end,
    confidence,
    tokens: tokenize(normalized),
  })
}

const parseEnergy = (text: string): EnergyCost => {
  const energy: EnergyCost = {}
  for (const match of text.matchAll(/\{([RYGBPKN])\}/gi)) {
    const color = ENERGY_TOKEN_TO_COLOR[match[1].toUpperCase()]
      if (color) energy[color] = (energy[color] ?? 0) + 1
  }
  // A small number of official exports omit the braces around a single
  // energy icon (for example `<R>`).  Only accept a string made entirely of
  // standalone energy letters so skill/attack names are never misread as a
  // payment.
  if (Object.keys(energy).length === 0 && /^[RYGBPKN](?:\s*[RYGBPKN])*$/i.test(text.trim())) {
    for (const token of text.trim().split(/\s+/)) {
      const color = ENERGY_TOKEN_TO_COLOR[token.toUpperCase()]
      if (color) energy[color] = (energy[color] ?? 0) + 1
    }
  }
  return energy
}

const hasEnergy = (energy: EnergyCost): boolean =>
  Object.values(energy).some((amount) => (amount ?? 0) > 0)

const energyMatches = (expected: EnergyCost, actual: EnergyCost): boolean =>
  Object.entries(expected).every(
    ([color, amount]) => (actual[color as keyof EnergyCost] ?? 0) >= (amount ?? 0),
  )

const selectorMatches = (
  expected: Partial<EffectTargetSelector>,
  actual: Partial<EffectTargetSelector>,
): boolean => {
  if (expected.side !== actual.side) return false
  if (expected.min !== undefined && actual.min !== expected.min) return false
  if (expected.max !== undefined && actual.max !== expected.max) return false
  for (const key of [
    'energyColor',
    'minLevel',
    'maxLevel',
    'remainingHp',
    'minRemainingHp',
    'maxRemainingHp',
    'excludeSource',
    'sourceOnly',
    'attackTargetOnly',
    'excludeAttackTarget',
    'restedOnly',
    'activeOnly',
    'excludeFlip',
    'cardType',
    'nonCookieOnly',
    'keyword',
    'cardName',
    'costSelected',
    'noSkillOnly',
  ] as const) {
    if (expected[key] !== undefined && actual[key] !== expected[key]) {
      // LV.1 is the lower bound of the Cookie level domain.  A number of
      // legacy effects express an exact LV.1 target with only `maxLevel: 1`;
      // adding `minLevel: 1` to the shadow selector would claim a runtime
      // distinction that does not exist (there is no LV.0 Cookie).  Keep all
      // other level bounds exact so LV.2+ and HP qualifiers cannot be hidden.
      if (
        key === 'minLevel' &&
        expected.minLevel === 1 &&
        actual.minLevel === undefined &&
        actual.maxLevel === 1
      ) {
        continue
      }
      // Older runtime selectors used `remainingHp` for an upper-bound
      // qualifier (“N or less”).  Treat that representation as equivalent to
      // the explicit `maxRemainingHp` field in the shadow contract.
      if (
        key === 'maxRemainingHp' &&
        expected.maxRemainingHp !== undefined &&
        actual.maxRemainingHp === undefined &&
        actual.remainingHp === expected.maxRemainingHp
      ) {
        continue
      }
      // An exact HP target may be represented by the runtime as the paired
      // lower/upper bounds.  This preserves evidence without widening a
      // one-point target into an upper-bound-only selector.
      if (
        key === 'remainingHp' &&
        expected.remainingHp !== undefined &&
        actual.remainingHp === undefined &&
        actual.minRemainingHp === expected.remainingHp &&
        actual.maxRemainingHp === expected.remainingHp
      ) {
        continue
      }
      return false
    }
  }
  return true
}

/**
 * Some CardEffect variants intentionally keep a movement/selection domain in
 * their discriminated fields instead of an EffectTargetSelector.  The
 * runtime still exposes that domain to the player, so the shadow ledger must
 * project it without changing the formal rule object.
 */
const additionalRuntimeSelectorsForEffect = (
  record: Record<string, unknown>,
): Partial<EffectTargetSelector>[] => {
  if (typeof record.kind !== 'string') return []
  const amount =
    typeof record.amount === 'number'
      ? record.amount
      : typeof record.count === 'number'
        ? record.count
        : undefined
  const selector =
    record.target && typeof record.target === 'object'
      ? (record.target as Partial<EffectTargetSelector>)
      : undefined
  const side =
    record.side === 'opponent' || record.side === 'either'
      ? (record.side as EffectTargetSelector['side'])
      : 'self'
  const movementFields: Partial<EffectTargetSelector> = {
    side,
    ...(typeof record.energyColor === 'string'
      ? { energyColor: record.energyColor as EffectTargetSelector['energyColor'] }
      : {}),
    ...(typeof record.exactLevel === 'number'
      ? { minLevel: record.exactLevel, maxLevel: record.exactLevel }
      : {}),
    ...(typeof record.minLevel === 'number' ? { minLevel: record.minLevel } : {}),
    ...(typeof record.maxLevel === 'number' ? { maxLevel: record.maxLevel } : {}),
    ...(record.cookieOnly === true ? { cardType: 'cookie' as const } : {}),
    ...(record.nonCookieOnly === true ? { nonCookieOnly: true } : {}),
  }
  const fixed = (count: number): Partial<EffectTargetSelector> => ({
    ...movementFields,
    min: count,
    max: count,
  })
  const upTo = (count: number): Partial<EffectTargetSelector> => ({
    ...movementFields,
    min: 0,
    max: count,
  })

  switch (record.kind) {
    case 'deck-to-support':
      return amount === undefined ? [] : [upTo(amount), fixed(amount)]
    case 'trash-to-support':
      return amount === undefined ? [] : [upTo(amount), fixed(amount)]
    case 'opponent-random-discard':
    case 'opponent-discard-hand':
      return amount === undefined ? [] : [
        { side: 'opponent', min: 0, max: amount },
        { side: 'opponent', min: amount, max: amount },
      ]
    case 'discard-hand':
      return record.destination === 'deck-top' || record.destination === 'deck-bottom'
        ? amount === undefined
          ? []
          : [fixed(amount)]
        : []
    case 'draw-up-to-then-discard':
      return record.handDestination === 'deck-top'
        ? [{ side: 'self', min: 1, max: 1 }]
        : []
    case 'opponent-break-to-trash-then-battle-to-break':
      // The first step chooses a Cookie from the opponent's break area; the
      // second step optionally chooses an opponent battle Cookie.  The
      // compound effect keeps both decisions in its own fields rather than a
      // single `target`, so project both public selection domains here.
      return [
        { side: 'opponent', min: 1, max: 1 },
        { side: 'opponent', min: 0, max: 1 },
      ]
    case 'hand-to-hp':
      // Without selectTarget the actual choice is a hand card; the target
      // field points at the destination Cookie and is therefore a second,
      // source-only domain.
      return [{ side: 'self', min: 0, max: 1 }]
    case 'hp-to-support':
      // The target field identifies the destination Cookie.  The attached HP
      // card is a separate support-area selection exposed by the UI.
      return [{ side: 'self', min: record.optional === true ? 0 : 1, max: 1 }]
    case 'field-to-deck-bottom':
    case 'field-to-trash':
      if (!selector || record.allowStage !== true) return []
      return [
        {
          ...selector,
          side:
            record.battleSide === 'opponent' ? 'opponent' : selector.side,
          cardType: 'cookie',
        },
        {
          side: selector.side ?? 'either',
          min: selector.min,
          max: selector.max,
          cardType: 'stage',
        },
      ]
    default:
      return []
  }
}

const runtimeSelectorForEffect = (
  record: Record<string, unknown>,
): Partial<EffectTargetSelector> | null => {
  if (typeof record.kind !== 'string') return null
  const amount =
    typeof record.amount === 'number'
      ? record.amount
      : typeof record.max === 'number'
        ? record.max
        : undefined
  const optional = record.optional === true
  const side =
    record.side === 'opponent' || record.side === 'either'
      ? (record.side as EffectTargetSelector['side'])
      : record.supportSide === 'opponent'
        ? 'opponent'
        : 'self'
  const common: Partial<EffectTargetSelector> = {
    side,
    ...(typeof record.energyColor === 'string'
      ? { energyColor: record.energyColor as EffectTargetSelector['energyColor'] }
      : {}),
    ...(typeof record.maxLevel === 'number' ? { maxLevel: record.maxLevel } : {}),
    ...(typeof record.exactLevel === 'number'
      ? { minLevel: record.exactLevel, maxLevel: record.exactLevel }
      : {}),
    ...(typeof record.minLevel === 'number' ? { minLevel: record.minLevel } : {}),
    ...(typeof record.remainingHp === 'number' ? { remainingHp: record.remainingHp } : {}),
    ...(typeof record.maxRemainingHp === 'number'
      ? { maxRemainingHp: record.maxRemainingHp }
      : {}),
    ...(typeof record.minRemainingHp === 'number'
      ? { minRemainingHp: record.minRemainingHp }
      : {}),
    ...(typeof record.excludeSource === 'boolean'
      ? { excludeSource: record.excludeSource }
      : {}),
    ...(typeof record.sourceOnly === 'boolean' ? { sourceOnly: record.sourceOnly } : {}),
    ...(typeof record.activeOnly === 'boolean' ? { activeOnly: record.activeOnly } : {}),
    ...(typeof record.noSkillOnly === 'boolean'
      ? { noSkillOnly: record.noSkillOnly }
      : {}),
  }
  const movementKinds = new Set([
    'trash-to-battle',
    'break-to-battle',
    'break-to-hand',
    'support-to-battle',
    'hand-to-battle',
    'hand-to-break',
    'trash-to-break',
    'break-to-trash',
    'support-to-hand',
    'support-to-support',
    'hand-to-support',
    'trash-to-support',
    'trash-to-hand',
    'trash-to-deck',
    'flip-to-support',
  ])
  if (movementKinds.has(record.kind)) {
    // break-to-battle/support-to-battle are defined as "up to" selections in
    // the rules layer even when the adapter has no optional flag.  Preserve
    // that evidence instead of manufacturing a required target of one.
    const upToByRule =
      record.kind === 'break-to-battle' || record.kind === 'support-to-battle'
    const max =
      record.kind === 'support-to-hand' && typeof record.keepCount === 'number'
        ? record.keepCount
        : record.kind === 'support-to-hand' && record.anyNumber === true
          ? Number.MAX_SAFE_INTEGER
          : amount
    const min =
      record.kind === 'trash-to-deck'
        ? typeof record.min === 'number'
          ? record.min
          : 0
        : record.kind === 'break-to-trash' || record.kind === 'trash-to-hand'
          ? 0
          : record.kind === 'support-to-hand' && typeof record.keepCount === 'number'
            ? record.keepCount
            : upToByRule || optional
              ? 0
              : max
    return {
      ...common,
      ...(max !== undefined ? { min, max } : {}),
      ...(record.kind === 'trash-to-deck'
        ? {
            ...(record.excludeFlip === true ? { excludeFlip: true } : {}),
            ...(record.cookieOnly === true ? { cardType: 'cookie' as const } : {}),
            ...(record.nonCookieOnly === true ? { nonCookieOnly: true } : {}),
          }
        : {}),
    }
  }
  if (
    record.kind === 'support-to-trash' ||
    record.kind === 'rest-support' ||
    record.kind === 'opponent-rests-support'
  ) {
    const max = amount
    return {
      ...common,
      ...(max !== undefined ? { min: optional ? 0 : max, max } : {}),
    }
  }
  if (record.kind === 'rest-support-and-damage') {
    const max =
      typeof record.supportAmount === 'number' ? record.supportAmount : undefined
    return {
      ...common,
      ...(max !== undefined ? { min: 0, max } : {}),
      ...(record.activeOnly === true ? { activeOnly: true } : {}),
    }
  }
  if (record.kind === 'inspect-deck') {
    const max = typeof record.pickCount === 'number' ? record.pickCount : undefined
    return {
      side: 'self',
      ...(max !== undefined
        ? { min: record.optionalPick === true ? 0 : max, max }
        : {}),
      ...(typeof record.filterColor === 'string'
        ? { energyColor: record.filterColor as EffectTargetSelector['energyColor'] }
        : {}),
      ...(typeof record.filterType === 'string'
        ? { cardType: record.filterType as EffectTargetSelector['cardType'] }
        : {}),
    }
  }
  if (record.kind === 'opponent-trash-to-break') {
    const max = typeof record.max === 'number' ? record.max : undefined
    return {
      side: 'opponent',
      ...(max !== undefined ? { min: 0, max } : {}),
      ...(typeof record.exactLevel === 'number'
        ? { minLevel: record.exactLevel, maxLevel: record.exactLevel }
        : {}),
      ...(typeof record.maxLevel === 'number' ? { maxLevel: record.maxLevel } : {}),
    }
  }
  if (record.kind === 'opponent-battle-to-trash') {
    return {
      side: 'opponent',
      min: typeof record.min === 'number' ? record.min : 0,
      max: typeof record.max === 'number' ? record.max : 1,
      ...(typeof record.remainingHp === 'number'
        // This effect field is the upper-bound form of the target wording
        // (“N or less HP”), while the shared selector names that dimension
        // `maxRemainingHp`.
        ? { maxRemainingHp: record.remainingHp }
        : {}),
      ...(typeof record.minRemainingHp === 'number'
        ? { minRemainingHp: record.minRemainingHp }
        : {}),
      ...(typeof record.maxLevel === 'number' ? { maxLevel: record.maxLevel } : {}),
      ...(typeof record.minLevel === 'number' ? { minLevel: record.minLevel } : {}),
    }
  }
  return null
}

/** Convert a structured AbilityCost movement into selector evidence. */
const runtimeSelectorsForCost = (
  value: Record<string, unknown>,
): Partial<EffectTargetSelector>[] => {
  const selectors: Partial<EffectTargetSelector>[] = []
  const add = (
    amount: number,
    fields: Partial<EffectTargetSelector> = {},
  ): void => {
    selectors.push({ side: 'self', min: amount, max: amount, ...fields })
  }
  if (typeof value.supportToTrash === 'number' && value.supportToTrash > 0) {
    add(value.supportToTrash)
  }
  if (typeof value.supportToHand === 'number' && value.supportToHand > 0) {
    add(value.supportToHand, {
      ...(typeof value.supportToHandType === 'string'
        ? { cardType: value.supportToHandType as EffectTargetSelector['cardType'] }
        : {}),
    })
  }
  const hpToTrash = value.hpToTrash
  if (hpToTrash && typeof hpToTrash === 'object') {
    const hp = hpToTrash as Record<string, unknown>
    add(typeof hp.amount === 'number' ? hp.amount : 1, {
      ...(hp.sourceOnly === true ? { sourceOnly: true } : {}),
      ...(hp.excludeSource === true ? { excludeSource: true } : {}),
      ...(typeof hp.energyColor === 'string'
        ? { energyColor: hp.energyColor as EffectTargetSelector['energyColor'] }
        : {}),
      ...(typeof hp.minLevel === 'number' ? { minLevel: hp.minLevel } : {}),
      ...(typeof hp.maxLevel === 'number' ? { maxLevel: hp.maxLevel } : {}),
    })
  }
  const battleCookie = value.trashBattleCookie ?? value.battleCookieToHand
  if (battleCookie && typeof battleCookie === 'object') {
    const battle = battleCookie as Record<string, unknown>
    add(typeof battle.count === 'number' ? battle.count : 1, {
      ...(battle.sourceOnly === true ? { sourceOnly: true } : {}),
      ...(battle.excludeSource === true ? { excludeSource: true } : {}),
      ...(typeof battle.energyColor === 'string'
        ? { energyColor: battle.energyColor as EffectTargetSelector['energyColor'] }
        : {}),
      ...(typeof battle.level === 'number'
        ? { minLevel: battle.level, maxLevel: battle.level }
        : {}),
      ...(typeof battle.minLevel === 'number' ? { minLevel: battle.minLevel } : {}),
      ...(typeof battle.maxLevel === 'number' ? { maxLevel: battle.maxLevel } : {}),
    })
  }
  const trashCookie = value.trashCookieToBreakArea
  if (trashCookie && typeof trashCookie === 'object') {
    const trash = trashCookie as Record<string, unknown>
    add(typeof trash.count === 'number' ? trash.count : 1, {
      ...(typeof trash.energyColor === 'string'
        ? { energyColor: trash.energyColor as EffectTargetSelector['energyColor'] }
        : {}),
      ...(trash.excludeFlip === true ? { excludeFlip: true } : {}),
    })
  }
  const trashToDeck = value.trashToDeck ?? value.trashToDeckBottom
  if (trashToDeck && typeof trashToDeck === 'object') {
    const trash = trashToDeck as Record<string, unknown>
    add(typeof trash.count === 'number' ? trash.count : 1, {
      ...(typeof trash.energyColor === 'string'
        ? { energyColor: trash.energyColor as EffectTargetSelector['energyColor'] }
        : {}),
      ...(trash.excludeFlip === true ? { excludeFlip: true } : {}),
      ...(trash.cookieOnly === true ? { cardType: 'cookie' } : {}),
      ...(trash.nonCookieOnly === true ? { nonCookieOnly: true } : {}),
    })
  }
  const handToBreak = value.handToBreakArea
  if (handToBreak && typeof handToBreak === 'object') {
    const hand = handToBreak as Record<string, unknown>
    add(typeof hand.count === 'number' ? hand.count : 1, {
      cardType: 'cookie',
      ...(typeof hand.energyColor === 'string'
        ? { energyColor: hand.energyColor as EffectTargetSelector['energyColor'] }
        : {}),
    })
  }
  return selectors
}

const bracketClauses = (
  source: CardTextSource,
  text: string,
  clauses: CardClauseFragment[],
): { payments: ContractPayment[]; costs: ContractCost[] } => {
  const payments: ContractPayment[] = []
  const costs: ContractCost[] = []
  for (const match of text.matchAll(/(?:<|《)([^>》]+)(?:>|》)/g)) {
    const inner = normalizeWhitespace(match[1])
    const start = match.index ?? 0
    const end = start + match[0].length
    const energy = parseEnergy(inner)
    const clauseId = `${source}-${clauses.length + 1}`
    if (/^(?:\{[RYGBPKN]\}|[RYGBPKN])(?:\s*(?:\{[RYGBPKN]\}|[RYGBPKN]))*$/i.test(inner)) {
      addClause(clauses, source, match[0], 'payment', start, end, 'exact')
      payments.push({ kind: 'energy', energy, clauseIds: [clauseId] })
      continue
    }
    if (/can be used as\s+\{[RYGBPKN]\}/i.test(inner)) {
      addClause(clauses, source, match[0], 'payment', start, end, 'pattern')
      payments.push({ kind: 'source-energy', energy, clauseIds: [clauseId] })
      continue
    }
    const discard = inner.match(
      /discard\s+(\d+)(?:\s+or\s+more)?\s+(?:(?:\{[RYGBPK]\}|【[^】]+】)\s+)*(?:cards?|cookies?|traps?|items?)/i,
    )
    const discardAll = /discard\s+(?:your|the)\s+entire\s+hand/i.test(inner)
    const supportTrash = inner.match(/place\s+(\d+)\s+cards?\s+from\s+your\s+support/i)
    const hpTrash =
      inner.match(
        /place\s+(\d+)(?:\s+cards?)?\s+from\s+the\s+top\s+of\s+[\s\S]*?cookies?(?:['’]s?)?\s+hp(?:\s+cards?)?\s+(?:into|in)\s+the\s+trash/i,
      ) ??
      inner.match(/place\s+(\d+)\s+of\s+your\s+cookies?(?:['’]s?)?\s+hp\s+cards?\s+in\s+the\s+trash/i)
    const battleTrash = inner.match(/place\s+(\d+)\s+.*cookie.*battle\s+area.*trash/i)
    const selfTrash = /place\s+this\s+(?:cookie|card)\s+in\s+(?:the|your)\s+trash/i.test(inner)
    const selfBreak = /(?:make\s+this\s+cookie\s+faint|place\s+this\s+cookie\s+in\s+(?:the|your)\s+break\s+area)/i.test(inner)
    const battleFaint = inner.match(/make\s+(\d+)\s+.*cookies?\s+faint/i)
    const battleBreak = inner.match(/place\s+(\d+)\s+.*cookie.*battle\s+area.*break\s+area/i)
    const handBreak = inner.match(/place\s+(\d+)\s+.*cookie.*hand.*break\s+area/i)
    const restCookie = /rest\s+\d+\s+cookie\s+in\s+your\s+battle\s+area/i.test(inner)
    const restSource = /(?:rest\s+this\s+card|card\s+rests?)/i.test(inner)
    const fieldToDeckBottom = /\b(?:place|select)\b[\s\S]*\b(?:battle\s+area|stage\s+area)\b[\s\S]*\b(?:on|at|to)\s+the\s+bottom\s+of\s+(?:the|your|the\s+owner's)\s+deck/i.test(inner)
    const selfDeckBottom = /place\s+this\s+cookie\s+(?:on|at|to)\s+the\s+bottom\s+of\s+your\s+deck/i.test(inner)
    const breakToTrash = /place\s+this\s+cookie\s+from\s+(?:the\s+)?break\s+area\s+into\s+the\s+trash/i.test(inner)
    const handToDeckBottom = /place\s+(?:\d+\s+)?cards?\s+from\s+your\s+hand\s+(?:on|at)\s+the\s+bottom\s+of\s+your\s+deck/i.test(inner)
    const supportHand = inner.match(/return\s+(?:up\s+to\s+)?(\d+)\s+(?:(?:\{[RYGBPK]\}|【[^】]+】)\s+)?(?:cards?|cookies?)\s+from\s+your\s+support\s+area\s+to\s+your\s+hand/i)
    const battleToHand = /return\s+(?:up\s+to\s+)?\d+[\s\S]*?from\s+your\s+battle\s+area\s+to\s+your\s+hand/i.test(inner)
    const hpToHand = /return\s+\d+\s+card\s+from\s+the\s+top\s+of\s+your\s+cookie'?s\s+hp(?:\s+cards?)?\s+to\s+your\s+hand/i.test(inner)
    const trashDeck = inner.match(/(?:select|return)\s+(\d+)[\s\S]*?from\s+your\s+trash[\s\S]*?(?:return\s+them\s+to|to)\s+your\s+deck/i)
    const trashDeckBottom = inner.match(/(?:select|return)\s+(\d+)[\s\S]*?from\s+your\s+trash[\s\S]*?bottom\s+of\s+your\s+deck/i)
    const trashToBreak = /place\s+\d+\s+cookie.*from\s+your\s+trash\s+into\s+your\s+break\s+area/i.test(inner)
    const revealHand = /reveal\s+\d+\s+(?:(?:\{[RYGBPK]\}|【[^】]+】)\s+)*(?:cards?|cookies?)(?:\s+from\s+your\s+hand|\s+in\s+your\s+hand)/i.test(inner)
    const deckTrash = /place\s+\d+\s+cards?\s+from\s+the\s+top\s+of\s+your\s+deck\s+into\s+your\s+trash/i.test(inner)
    if (
      discard ||
      discardAll ||
      supportTrash ||
      hpTrash ||
      battleTrash ||
      selfTrash ||
      selfBreak ||
      battleFaint ||
      battleBreak ||
      handBreak ||
      restCookie ||
      restSource ||
      fieldToDeckBottom ||
      selfDeckBottom ||
      breakToTrash ||
      handToDeckBottom ||
      battleToHand ||
      hpToHand ||
      supportHand ||
      trashDeck ||
      trashDeckBottom ||
      trashToBreak ||
      revealHand ||
      deckTrash
    ) {
      const kind = discard
        ? 'discard-hand'
        : discardAll
          ? 'discard-hand'
        : supportTrash
          ? 'support-to-trash'
          : hpTrash
            ? 'hp-to-trash'
            : battleTrash
              ? 'battle-to-trash'
                : selfTrash
                  ? 'self-to-trash'
                : selfBreak
                  ? 'self-to-break'
                  : battleFaint
                    ? 'battle-to-break'
                    : battleBreak
                    ? 'battle-to-break'
                    : handBreak
                      ? 'hand-to-break'
                      : restCookie
                        ? 'rest-cookie'
                        : restSource
                          ? 'rest-source'
                          : fieldToDeckBottom
                            ? 'field-to-deck-bottom'
                            : selfDeckBottom
                              ? 'self-to-deck-bottom'
                            : breakToTrash
                              ? 'break-to-trash'
                              : handToDeckBottom
                                ? 'hand-to-deck-bottom'
                                : battleToHand
                                  ? 'battle-to-hand'
                                  : hpToHand
                                    ? 'hp-to-hand'
                                    : supportHand
                                      ? 'support-to-hand'
                                      : trashDeck
                                        ? 'trash-to-deck'
                                        : trashDeckBottom
                                          ? 'trash-to-deck-bottom'
                                          : trashToBreak
                                            ? 'trash-to-break'
                                            : revealHand
                                              ? 'reveal-hand'
                                              : deckTrash
                                                ? 'deck-to-trash'
                                                : 'move'
      addClause(clauses, source, match[0], 'cost', start, end, 'pattern')
      const amountMatch =
        discard ??
        supportTrash ??
        hpTrash ??
        battleTrash ??
        battleFaint ??
        battleBreak ??
        handBreak ??
        supportHand ??
        trashDeck ??
        trashDeckBottom
      costs.push({
        kind,
        amount: amountMatch ? Number(amountMatch[1]) : 1,
        clauseIds: [clauseId],
      })
      continue
    }
    addClause(clauses, source, match[0], 'unsupported', start, end, 'unknown')
    costs.push({ kind: hasEnergy(energy) ? 'energy' : 'unknown', clauseIds: [clauseId] })
  }
  return { payments, costs }
}

const targetClauses = (
  source: CardTextSource,
  text: string,
  clauses: CardClauseFragment[],
  sourceType?: OfficialCardRecord['type'],
): ContractTarget[] => {
  const targets: ContractTarget[] = []
  const structuredRanges: Array<{ start: number; end: number }> = []
  const re = /select\s+(up\s+to\s+)?(\d+)\s+(?:of\s+)?(your opponent's|your|either player's)\s+([\s\S]*?)\b(?:cookies?|cards?)(?=\s|[.,;]|$)/gi
  for (const match of text.matchAll(re)) {
    const min = match[1] ? 0 : Number(match[2])
    const max = Number(match[2])
    const sideText = match[3].toLowerCase()
    const side = sideText.includes('opponent')
      ? 'opponent'
      : sideText.includes('either')
        ? 'either'
        : 'self'
    const descriptor = match[4] ?? ''
  const fullPhrase = text.slice(
    match.index ?? 0,
    Math.min(text.length, (match.index ?? 0) + match[0].length + 180),
  )
  // Restrict qualifiers to the current target clause.  A following Then/If
  // clause can contain a different HP condition for the already selected
  // Cookie and must not leak into this selector.
  const targetWindow = fullPhrase.split(/\b(?:during|then|if)\b/i, 1)[0]
  const targetQualifierWindow = targetWindow.split(/\b(?:that|this|their)\s+Cookie\b/i, 1)[0]
    const energyToken = descriptor.match(/\{([RYGBPK])\}/i)?.[1]?.toUpperCase()
    const energyColor = energyToken
      ? ENERGY_TOKEN_TO_COLOR[energyToken]
      : undefined
    const levelMatch = targetQualifierWindow.match(/LV\.\s*(\d+)(?:\s+(or\s+(?:lower|higher)))?/i)
    const level = levelMatch ? Number(levelMatch[1]) : undefined
    const levelQualifier = levelMatch?.[2]?.toLowerCase()
    const remainingHpMatch = targetQualifierWindow.match(
      /(?:remaining\s+HP\s+is\s+(\d+)(?:\s+or\s+(less|more))?|(?:has|with)\s+(\d+)\s+or\s+(less|more)\s+HP\s+remaining)/i,
    )
    const remainingHp = remainingHpMatch?.[1] ?? remainingHpMatch?.[3]
    const remainingHpQualifier = (
      remainingHpMatch?.[2] ?? remainingHpMatch?.[4]
    )?.toLowerCase()
    const clauseId = `${source}-${clauses.length + 1}`
    const start = match.index ?? 0
    structuredRanges.push({ start, end: start + match[0].length })
    addClause(clauses, source, match[0], 'target', start, start + match[0].length, 'pattern')
    targets.push({
      selector: {
        side,
        min,
        max,
        ...(energyColor && energyColor !== 'neutral' ? { energyColor } : {}),
        ...(level !== undefined && levelQualifier === 'or lower'
          ? { maxLevel: level }
          : level !== undefined && levelQualifier === 'or higher'
            ? { minLevel: level }
            : level !== undefined
              ? { minLevel: level, maxLevel: level }
              : {}),
        ...(remainingHp !== undefined && remainingHpQualifier === 'less'
          ? { maxRemainingHp: Number(remainingHp) }
          : remainingHp !== undefined && remainingHpQualifier === 'more'
            ? { minRemainingHp: Number(remainingHp) }
            : remainingHp !== undefined
              ? { remainingHp: Number(remainingHp) }
              : {}),
        ...(sourceType === 'cookie' && /\bother\b/i.test(descriptor)
          ? { excludeSource: true }
          : {}),
      },
      clauseIds: [clauseId],
    })
  }
  const zoneSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+(?:\{([RYGBPK])\}\s+)?(?:LV\.\s*(\d+)(?:\s+or\s+(?:lower|higher))?\s+)?(?:other\s+)?(?:cookies?|cards?)(?:\s+other\s+than\s+\[[^\]]+\])?\s+(?:from|in)\s+(your opponent's|opponent's|your|the|either player's)\s+(trash|break\s+area|support\s+area|hand|deck)\b/gi
  for (const match of text.matchAll(zoneSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[2])
    const level = match[4] ? Number(match[4]) : undefined
    const qualifier = match[0].match(/LV\.\s*\d+\s+(or\s+(?:lower|higher))/i)?.[1]?.toLowerCase()
    const color = match[3] ? ENERGY_TOKEN_TO_COLOR[match[3].toUpperCase()] : undefined
    const sideText = match[5]?.toLowerCase() ?? ''
    const zoneText = match[6]?.toLowerCase() ?? ''
    const side = sideText.includes('opponent') ? 'opponent' : 'self'
    const zone = zoneText.includes('trash')
      ? 'trash'
      : zoneText.includes('break')
        ? 'break'
        : zoneText.includes('support')
          ? 'support'
          : zoneText.includes('hand')
            ? 'hand'
            : 'deck'
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side,
        min: match[1] ? 0 : amount,
        max: amount,
        ...(color && color !== 'neutral' ? { energyColor: color } : {}),
        ...(level !== undefined && qualifier === 'or lower'
          ? { maxLevel: level }
          : level !== undefined && qualifier === 'or higher'
            ? { minLevel: level }
            : level !== undefined
              ? { minLevel: level, maxLevel: level }
              : {}),
      },
      clauseIds: [clauseId],
      zone,
    })
    structuredRanges.push({ start, end })
  }
  const battleAreaSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+((?:other\s+)?(?:\{[RYGBPK]\}\s+)?(?:LV\.\s*\d+(?:\s+or\s+(?:lower|higher))?\s+)?(?:cookies?|cards?)(?:\s+that\s+is\s+LV\.\s*\d+(?:\s+or\s+(?:lower|higher))?)?)\s+(?:in|from)\s+(your opponent's|your|either player's)\s+battle\s+area\b/gi
  for (const match of text.matchAll(battleAreaSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const descriptor = match[3] ?? ''
    const sideText = (match[4] ?? '').toLowerCase()
    const side = sideText.includes('opponent')
      ? 'opponent'
      : sideText.includes('either')
        ? 'either'
        : 'self'
    const amount = Number(match[2])
    const colorToken = descriptor.match(/\{([RYGBPK])\}/i)?.[1]?.toUpperCase()
    const color = colorToken ? ENERGY_TOKEN_TO_COLOR[colorToken] : undefined
    const levelMatch = descriptor.match(/LV\.\s*(\d+)(?:\s+(or\s+(?:lower|higher)))?/i)
    const level = levelMatch ? Number(levelMatch[1]) : undefined
    const qualifier = levelMatch?.[2]?.toLowerCase()
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side,
        min: match[1] ? 0 : amount,
        max: amount,
        ...(color && color !== 'neutral' ? { energyColor: color } : {}),
        ...(level !== undefined && qualifier === 'or lower'
          ? { maxLevel: level }
          : level !== undefined && qualifier === 'or higher'
            ? { minLevel: level }
            : level !== undefined
              ? { minLevel: level, maxLevel: level }
              : {}),
        ...(sourceType === 'cookie' && /\bother\b/i.test(descriptor)
          ? { excludeSource: true }
          : {}),
      },
      clauseIds: [clauseId],
      zone: 'battle',
    })
    structuredRanges.push({ start, end })
  }
  // A few cards offer a Cookie *or* a Stage as one alternate target (for
  // example, a LV.1 Cookie from the opponent's battle area or a Stage from
  // either player's Stage area).  Keep the Stage branch as its own typed
  // selector so the runtime `allowStage` binding can prove both domains.
  const stageSelection = /\bor\s+(\d+)\s+stage(?:\s+cards?)?\s+from\s+(either player's|your opponent's|opponent's|your)\s+stage\s+area\b/gi
  for (const match of text.matchAll(stageSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[1])
    const previousText = text.slice(Math.max(0, start - 180), start)
    const sideText = (match[2] ?? '').toLowerCase()
    const side = sideText.includes('either') ? 'either' : sideText.includes('opponent') ? 'opponent' : 'self'
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side,
        min: /select\s+up\s+to\b/i.test(previousText) ? 0 : amount,
        max: amount,
        cardType: 'stage',
      },
      clauseIds: [clauseId],
      zone: 'stage',
    })
    structuredRanges.push({ start, end })
  }
  const supportSelection = /\bselect\s+(?:(up\s+to)\s+)?(\d+|any\s+number)\s+(?:\{([RYGBPK])\}\s+)?(?:(active)\s+)?(?:cards?|cookies?)\s+(?:in|from)\s+(your opponent's|opponent's|your|the|either player's)\s+support\s+area\b/gi
  for (const match of text.matchAll(supportSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const anyNumber = /^any\s+number$/i.test(match[2] ?? '')
    const amount = anyNumber ? Number.MAX_SAFE_INTEGER : Number(match[2])
    const sideText = (match[5] ?? '').toLowerCase()
    const side = sideText.includes('opponent')
      ? 'opponent'
      : sideText.includes('either')
        ? 'either'
        : 'self'
    const color = match[3]
      ? ENERGY_TOKEN_TO_COLOR[match[3].toUpperCase()]
      : undefined
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side,
        min: match[1] || anyNumber ? 0 : amount,
        max: amount,
        ...(color && color !== 'neutral' ? { energyColor: color } : {}),
        ...(match[4] ? { activeOnly: true } : {}),
      },
      clauseIds: [clauseId],
      zone: 'support',
    })
    structuredRanges.push({ start, end })
  }
  // Bracketed support-area movements are card-selection costs (for example
  // BS3-061／BS3-069).  They are not effect targets in the prose, but the
  // runtime exposes the public support selector and the contract must retain
  // that evidence for binding regressions.
  const bracketSupportSelection = /<[^>]*\b(?:place|return|take|put)\s+(\d+)\s+cards?\s+from\s+your\s+support\s+area\b[^>]*>/gi
  for (const match of text.matchAll(bracketSupportSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[1])
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: { side: 'self', min: amount, max: amount },
      clauseIds: [clauseId],
      zone: 'support',
    })
    structuredRanges.push({ start, end })
  }
  const eachPlayerSelection = /\bselect\s+1\s+(?:a\s+)?(?:cookie|card)s?\s+from\s+each\s+player\b/gi
  for (const match of text.matchAll(eachPlayerSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    for (const side of ['self', 'opponent'] as const) {
      targets.push({
        selector: { side, min: 1, max: 1 },
        clauseIds: [clauseId],
        zone: 'battle',
      })
    }
    structuredRanges.push({ start, end })
  }
  const viewedCardSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+(?:\{([RYGBPK])\}\s+)?(?:cookies?|cards?)\s+from\s+(?:the\s+)?viewed\s+cards\b/gi
  for (const match of text.matchAll(viewedCardSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[2])
    const color = match[3]
      ? ENERGY_TOKEN_TO_COLOR[match[3].toUpperCase()]
      : undefined
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: {
        side: 'self',
        min: match[1] ? 0 : amount,
        max: amount,
        ...(color && color !== 'neutral' ? { energyColor: color } : {}),
      },
      clauseIds: [clauseId],
      zone: 'deck',
    })
    structuredRanges.push({ start, end })
  }
  const keepSupportSelection = /\bselect\s+(\d+)\s+cards?\s+to\s+keep\s+in\s+your\s+support\s+area\b/gi
  for (const match of text.matchAll(keepSupportSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[1])
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'pattern')
    targets.push({
      selector: { side: 'self', min: amount, max: amount },
      clauseIds: [clauseId],
      zone: 'support',
    })
    structuredRanges.push({ start, end })
  }
  // Any remaining Select / play-from-zone phrase is still a player choice.
  // Do not silently treat it as an untargeted effect when no safe selector
  // grammar exists; the contract must stop at needs-review instead.
  const unresolvedSelection = /\bselect\b[^.]+(?:\.|$)/gi
  for (const match of text.matchAll(unresolvedSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    if (/\bof\s+(?:the\s+)?following\b/i.test(match[0])) continue
    if (/\b(?:from|in)\s+(?:(?:your|the|opponent's|your opponent's|either player's)\s+)?(?:trash|break\s+area|support\s+area|hand|deck|viewed\s+cards)/i.test(match[0])) continue
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'unknown')
    targets.push({
      selector: {},
      clauseIds: [clauseId],
      unresolved: 'selection phrase has no safe selector mapping',
    })
  }
  const unresolvedZoneSelection = /\b(?:play|place|return|take|put)\s+(?:up\s+to\s+)?\d+\b[^.]*\b(?:from|in)\s+(?:your opponent's|opponent's|your|the)\s+(?:trash|break\s+area|support\s+area|hand|deck)/gi
  for (const match of text.matchAll(unresolvedZoneSelection)) {
    const start = match.index ?? 0
    // Do not treat a bracketed cost/movement as a player target.  Costs are
    // recorded by `bracketClauses`; this pass is only for effect targets.
    const before = text.slice(0, start)
    const openAngle = Math.max(before.lastIndexOf('<'), before.lastIndexOf('《'))
    const closeAngle = Math.max(before.lastIndexOf('>'), before.lastIndexOf('》'))
    if (openAngle > closeAngle) continue
    // "that Cookie's top HP" is a dependent HP movement, not a second
    // player-selected card.  The selected Cookie target already represents
    // the decision; adding a synthetic self/trash selector makes valid cards
    // (BS3-116, P-031) look unresolved.
    if (
      /\b(?:top\s+of\s+)?(?:that|this|their|the selected)\s+Cookie['’]?s\s+(?:top\s+)?HP/i.test(
        match[0],
      ) ||
      /\b(?:that|this|their|the selected)\s+Cookie['’]?s\s+(?:top\s+)?HP/i.test(
        match[0],
      ) ||
      /\b(?:their|that|this|your)\s+(?:attached\s+)?HP(?:\s+cards?)?/i.test(
        match[0],
      )
    ) continue
    // Moving cards from the top of a deck is an untargeted deck operation;
    // only an explicit `select` phrase is a player choice.
    if (
      /\bfrom\s+(?:the\s+)?top\s+of\s+(?:your|their|the|your opponent's|opponent's)\s+deck/i.test(
        match[0],
      )
    ) continue
    const amountMatch = match[0].match(/(?:up\s+to\s+)?(\d+)/i)
    if (!amountMatch) continue
    const amount = Number(amountMatch[1])
    const energy = parseEnergy(match[0])
    const targetEnergyColor = Object.keys(energy).find(
      (color) => color !== 'neutral',
    ) as EffectTargetSelector['energyColor'] | undefined
    const selector: Partial<EffectTargetSelector> = {
      side: /opponent/i.test(match[0]) ? 'opponent' : 'self',
      min: /up\s+to/i.test(match[0]) ? 0 : amount,
      max: amount,
      ...(targetEnergyColor ? { energyColor: targetEnergyColor } : {}),
    }
    const zone = /trash/i.test(match[0])
      ? 'trash'
      : /break/i.test(match[0])
        ? 'break'
        : /support/i.test(match[0])
          ? 'support'
          : /hand/i.test(match[0])
            ? 'hand'
            : 'deck'
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, start + match[0].length, 'unknown')
    targets.push({
      selector,
      clauseIds: [clauseId],
      zone,
    })
  }
  return targets
}

const addActionClauses = (
  source: CardTextSource,
  text: string,
  clauses: CardClauseFragment[],
): void => {
  const stripped = stripMarkupTags(text).replace(/(?:<|《)[^>》]+(?:>|》)/g, '')
  for (const sentence of stripped.split(/(?<=[.!?])\s+|;\s+|\bThen,?\s*/i)) {
    const normalized = normalizeWhitespace(sentence)
    if (!normalized) continue
    const match = ACTION_PATTERNS.find(([pattern]) => pattern.test(normalized))
    if (match) {
      if (match[1] === 'target') continue
      const role = /\bthen\b/i.test(normalized) ? 'then' : match[1]
      addClause(clauses, source, normalized, role, 0, text.length, 'pattern')
    } else {
      // Attack／FLIP names are printed between the payment marker and the
      // executable text.  They are display labels, not omitted rule clauses;
      // keeping them as unsupported text made every no-follow-up attack name
      // look like a parser gap (for example BS6-040 and P-078).
      if (source === 'attack' || source === 'flip') continue
      // `{sk}` is the official display marker for a named skill.  A lone
      // marker plus title (for example BS4-004) has no executable clause.
      if (source === 'skill' && /^\s*\{sk\}/i.test(normalized)) continue
      // A parenthetical ordering reminder is an explicit resolution rule, not
      // an unsupported effect.  Preserve it as an order clause so the
      // contract still records the source evidence without inventing a
      // runtime effect kind.
      if (/cannot switch the order of HP cards/i.test(normalized)) {
        addClause(clauses, source, normalized, 'order', 0, text.length, 'pattern')
        continue
      }
      addClause(clauses, source, normalized, 'unsupported', 0, text.length, 'unknown')
    }
  }
  if (/\bthen\b/i.test(text)) {
    addClause(clauses, source, 'Then', 'then', text.toLowerCase().indexOf('then'), text.length, 'exact')
  }
}

const collectCostEvidence = (
  cost: Record<string, unknown>,
  result: {
    effectKinds: Set<string>
    targetSelectors: Partial<EffectTargetSelector>[]
    energyCosts: EnergyCost[]
    abilityCostKeys: Set<string>
  },
): void => {
  Object.keys(cost).forEach((costKey) => result.abilityCostKeys.add(costKey))
  result.targetSelectors.push(...runtimeSelectorsForCost(cost))
  const directEnergy: EnergyCost = {}
  for (const color of Object.keys(ENERGY_TOKEN_TO_COLOR).map(
    (token) => ENERGY_TOKEN_TO_COLOR[token],
  )) {
    const amount = cost[color]
    if (typeof amount === 'number' && amount > 0) {
      directEnergy[color] = amount
    }
  }
  if (hasEnergy(directEnergy)) result.energyCosts.push(directEnergy)
  if (cost.energy && typeof cost.energy === 'object') {
    result.energyCosts.push(cost.energy as EnergyCost)
  }
}

const collectRuntime = (value: unknown, result: {
  effectKinds: Set<string>
  targetSelectors: Partial<EffectTargetSelector>[]
  energyCosts: EnergyCost[]
  abilityCostKeys: Set<string>
}): void => {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item) => collectRuntime(item, result))
    return
  }
  const record = value as Record<string, unknown>
  if (typeof record.kind === 'string') {
    result.effectKinds.add(record.kind)
    if (record.target && typeof record.target === 'object') {
      result.targetSelectors.push(record.target as Partial<EffectTargetSelector>)
    }
    const movementSelector = runtimeSelectorForEffect(record)
    if (movementSelector) result.targetSelectors.push(movementSelector)
    result.targetSelectors.push(...additionalRuntimeSelectorsForEffect(record))
    // support-to-hp has two selection domains: a support card and a Cookie
    // target.  The latter is already carried by `record.target`; expose the
    // former as selector evidence so a bracketed support-card cost can bind
    // without pretending it is a battlefield Cookie.
    // A bracketed hand-to-deck-bottom cost is modeled by the adapter as a
    // `discard-hand` effect whose destination is the deck bottom (for example
    // P-045).  Expose that shape as the contract-level movement kind so the
    // cost clause can bind to real runtime evidence.
    if (record.kind === 'discard-hand' && record.destination === 'deck-bottom') {
      result.effectKinds.add('hand-to-deck-bottom')
    }
    if (record.kind === 'support-to-hp') {
      result.targetSelectors.push({
        side: 'self',
        min: record.optional === true ? 0 : 1,
        max: 1,
        ...(typeof record.energyColor === 'string'
          ? { energyColor: record.energyColor as EffectTargetSelector['energyColor'] }
          : {}),
      })
    }
  }
  if (record.energyCost && typeof record.energyCost === 'object') {
    result.energyCosts.push(record.energyCost as EnergyCost)
  }
  if (record.attackEnergyCost && typeof record.attackEnergyCost === 'object') {
    result.energyCosts.push(record.attackEnergyCost as EnergyCost)
  }
  if (record.sourceEnergy && typeof record.sourceEnergy === 'object') {
    result.energyCosts.push(record.sourceEnergy as EnergyCost)
  }
  // Stage cards carry the printed placement cost on `StageAbility.placementCost`;
  // it is the runtime evidence for the source's play-cost payment clause.
  if (record.placementCost && typeof record.placementCost === 'object') {
    result.energyCosts.push(record.placementCost as EnergyCost)
  }
  for (const [key, child] of Object.entries(record)) {
    if (
      key === 'kind' ||
      key === 'target' ||
      key === 'energyCost' ||
      key === 'attackEnergyCost' ||
      key === 'sourceEnergy'
    ) continue
    if (key === 'cost' && child && typeof child === 'object') {
      collectCostEvidence(child as Record<string, unknown>, result)
    }
    if (key === 'alternativeCosts' && Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object') {
          collectCostEvidence(item as Record<string, unknown>, result)
        }
      }
    }
    collectRuntime(child, result)
  }
}

const runtimeEvidenceFromCard = (card: GameCard | null): RuntimeCardEvidence => {
  if (!card) return { card, effects: [] }
  return {
    card,
    effects: card.effects ?? [],
    skill: card.skill
      ? {
          trigger: card.skill.trigger,
          oncePerTurn: card.skill.oncePerTurn,
          oncePerGame: card.skill.oncePerGame,
          yourTurn: card.skill.yourTurn,
          restSource: card.skill.restSource,
          cost: card.skill.cost,
          sourceEnergy: card.skill.sourceEnergy,
          effects: card.skill.effects,
        }
      : undefined,
    attackEffects: card.type === 'cookie' ? card.attackEffects : undefined,
    flip: card.flip ? { cost: card.flip.cost, effects: card.flip.effects } : undefined,
    ability: card.item
      ? { cost: card.item.cost, effects: card.item.effects }
      : card.stageAbility
        ? {
            cost: card.stageAbility.cost,
            restSource: card.stageAbility.restSource,
            effects: card.stageAbility.effects,
          }
        : card.trap
          ? { cost: card.trap.cost, effects: card.trap.effects }
          : undefined,
  }
}

const flattenRuntimeEffects = (evidence: RuntimeCardEvidence): CardEffect[] => {
  const result: CardEffect[] = []
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const record = value as Record<string, unknown>
    if (typeof record.kind === 'string') result.push(record as unknown as CardEffect)
    for (const key of ['effects', 'thenEffects', 'modes']) visit(record[key])
  }
  visit(evidence.effects)
  visit(evidence.skill?.effects)
  visit(evidence.attackEffects)
  visit(evidence.flip?.effects)
  visit(evidence.ability?.effects)
  return result
}

const hasRuntimeThenEffects = (evidence: RuntimeCardEvidence): boolean => {
  // `attackEffects` is the runtime slot for the printed post-attack/Then
  // sequence.  Older cards do not carry a nested `thenEffects` property, but
  // the ordered array itself is the executable evidence and is consumed one
  // effect at a time by the battle resolver.
  if (evidence.attackEffects !== undefined && evidence.attackEffects.length > 0) {
    return true
  }
  let found = false
  const visit = (value: unknown): void => {
    if (found || !value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const record = value as Record<string, unknown>
    if ('thenEffects' in record) {
      found = true
      return
    }
    for (const key of ['effects', 'modes']) visit(record[key])
  }
  visit(evidence.effects)
  visit(evidence.skill?.effects)
  visit(evidence.attackEffects)
  visit(evidence.flip?.effects)
  visit(evidence.ability?.effects)
  return found
}

const hasRuntimeConditionalStep = (evidence: RuntimeCardEvidence): boolean =>
  flattenRuntimeEffects(evidence).some((effect) => 'condition' in effect)

const effectKindsForClause = (clause: CardClauseFragment): string[] => {
  const text = clause.text.toLowerCase()
  const kinds: string[] = []
  if (/damage|deal|receives/.test(text)) kinds.push('damage', 'damage-all')
  if (/draw/.test(text)) kinds.push('draw', 'draw-up-to')
  if (/discard/.test(text)) kinds.push('discard-hand', 'opponent-discard-hand')
  if (/rest/.test(text)) kinds.push('rest-cookie', 'rest-support')
  if (/play|place|put|return|move|take/.test(text)) kinds.push('move')
  return kinds
}

const buildContract = (
  record: OfficialCardRecord,
  evidence: RuntimeCardEvidence,
): CardBehaviorContract => {
  const clauses: CardClauseFragment[] = []
  const payments: ContractPayment[] = []
  const costs: ContractCost[] = []
  const targets: ContractTarget[] = []
  const timingMarkers = new Set<string>()
  const segments = sourceSegments(record)
  for (const [source, text] of Object.entries(segments) as [CardTextSource, string][]) {
    const normalizedSourceText = stripMarkupTags(text)
    const parsed = parseOfficialCardText(normalizedSourceText)
    if (!parsed) continue
    parsed.markers
      .filter((marker) => TIMING_MARKERS.has(marker))
      .forEach((marker) => {
        timingMarkers.add(marker)
        addClause(clauses, source, `{${marker}}`, 'timing', 0, text.length, 'exact')
      })
    const bracket = bracketClauses(source, text, clauses)
    payments.push(...bracket.payments)
    costs.push(...bracket.costs)
    targets.push(...targetClauses(source, text, clauses, record.type))
    addActionClauses(source, text, clauses)
    if (parsed.unknownTokens.length > 0) {
      addClause(clauses, source, parsed.unknownTokens.join(' '), 'unsupported', 0, text.length, 'unknown')
    }
  }
  const runtime = { effectKinds: new Set<string>() }
  collectRuntime(evidence.card, {
    effectKinds: runtime.effectKinds,
    targetSelectors: [],
    energyCosts: [],
    abilityCostKeys: new Set<string>(),
  })
  const steps: ContractResolutionStep[] = []
  let order = 0
  for (const clause of clauses.filter((item) => item.role === 'effect' || item.role === 'then')) {
    steps.push({
      order: order++,
      role: clause.role === 'then' ? 'then' : 'effect',
      clauseIds: [clause.id],
      runtimeKinds: effectKindsForClause(clause).filter((kind) => runtime.effectKinds.has(kind)),
    })
  }
  const blockers: string[] = []
  if (evidence.unsupportedReason) blockers.push(`runtime:${evidence.unsupportedReason}`)
  if (clauses.some((clause) => clause.role === 'unsupported')) blockers.push('source contains unclassified clause')
  const runtimeArrays = {
    targetSelectors: [] as Partial<EffectTargetSelector>[],
    energyCosts: [] as EnergyCost[],
    abilityCostKeys: new Set<string>(),
  }
  collectRuntime(evidence.card, { effectKinds: new Set<string>(), ...runtimeArrays })
  if (payments.length > 0 && runtimeArrays.energyCosts.length === 0 && !evidence.skill?.sourceEnergy) {
    blockers.push('payment clause has no runtime energy evidence')
  }
  const thenCount = clauses.filter((clause) => clause.role === 'then').length
  if (
    thenCount > 0 &&
    !hasRuntimeThenEffects(evidence) &&
    !hasRuntimeConditionalStep(evidence) &&
    flattenRuntimeEffects(evidence).length < 2
  ) {
    blockers.push('Then clause has no runtime thenEffects evidence')
  }
  const runtimeTiming: ContractTiming['runtime'] = {
    ...(evidence.skill?.trigger ? { trigger: evidence.skill.trigger } : {}),
    ...(evidence.skill?.oncePerTurn !== undefined ? { oncePerTurn: evidence.skill.oncePerTurn } : {}),
    ...(evidence.skill?.yourTurn !== undefined ? { yourTurn: evidence.skill.yourTurn } : {}),
  }
  if (timingMarkers.has('mob') || timingMarkers.has('ap')) {
    if (evidence.skill === undefined && evidence.ability === undefined) blockers.push('timing marker has no runtime ability')
  }
  if (timingMarkers.has('t1') && evidence.skill?.oncePerTurn !== true) blockers.push('once-per-turn marker missing runtime flag')
  if (timingMarkers.has('mt') && evidence.skill?.yourTurn !== true) blockers.push('your-turn marker missing runtime flag')
  return {
    schemaVersion: 1,
    cardId: record.cardNumber,
    baseCardId: record.baseCardNumber,
    sourceHash: hashSource(record),
    source: { cardNumber: record.cardNumber, type: record.type, segments },
    timing: { markers: [...timingMarkers].sort(), runtime: runtimeTiming },
    clauses,
    payments,
    costs,
    targets,
    steps,
    status: blockers.length > 0 ? (evidence.unsupportedReason ? 'blocked' : 'needs-review') : 'verified',
    blockers,
  }
}

export const analyzeOfficialCardBehavior = (
  record: OfficialCardRecord,
  runtimeCard?: GameCard | null,
): CardBehaviorAudit => {
  // 契約必須稽核「runtime 實際消費的來源」：轉換邊界的正規化（例如
  // BS4-080@2 欄位併寫、BS6 傷害 errata）發生在 adapter 內，若契約仍以
  // 原始記錄建立子句，這些已修正的來源就永遠找不到 runtime evidence。
  const normalized = normalizeOfficialCardRecord(record)
  const conversion = runtimeCard === undefined ? convertOfficialCardToGameCard(normalized) : null
  const card = runtimeCard === undefined && conversion?.status === 'converted' ? conversion.gameCard : runtimeCard ?? null
  const evidence: RuntimeCardEvidence = {
    ...runtimeEvidenceFromCard(card),
    unsupportedReason: conversion?.status === 'unsupported' ? conversion.reason : undefined,
  }
  const contract = buildContract(normalized, evidence)
  const runtime = {
    effectKinds: [] as string[],
    targetSelectors: [] as Partial<EffectTargetSelector>[],
    energyCosts: [] as EnergyCost[],
    abilityCostKeys: [] as string[],
    timing: undefined as ContractTiming['runtime'],
  }
  const sets = {
    effectKinds: new Set<string>(),
    targetSelectors: runtime.targetSelectors,
    energyCosts: runtime.energyCosts,
    abilityCostKeys: new Set<string>(),
  }
  collectRuntime(card, sets)
  runtime.effectKinds = [...sets.effectKinds].sort()
  runtime.abilityCostKeys = [...sets.abilityCostKeys].sort()
  runtime.timing = contract.timing.runtime
  const paymentCovered = contract.payments.every((payment) =>
    runtime.energyCosts.some((energy) => energyMatches(payment.energy, energy)) ||
      (payment.kind === 'source-energy' && Boolean(evidence.skill?.sourceEnergy)),
  )
  const costCovered = contract.costs.every((cost) => {
    if (cost.kind === 'unknown') return false
    if (cost.kind === 'energy') return runtime.energyCosts.length > 0
    const keys = new Set(runtime.abilityCostKeys)
    const kinds = new Set(runtime.effectKinds)
    if (cost.kind === 'discard-hand') {
      return keys.has('discardHand') || keys.has('discardAllHand') || kinds.has('discard-hand')
    }
    if (cost.kind === 'support-to-trash') return keys.has('supportToTrash') || kinds.has('support-to-trash')
    if (cost.kind === 'hp-to-trash') return keys.has('hpToTrash') || kinds.has('hp-to-trash')
    if (cost.kind === 'battle-to-trash') return keys.has('trashBattleCookie') || kinds.has('battle-to-trash')
    if (cost.kind === 'battle-to-break' || cost.kind === 'faint') {
      return keys.has('trashBattleCookie') || kinds.has('battle-to-break')
    }
    if (cost.kind === 'hand-to-break') {
      return keys.has('handToBreakArea') || kinds.has('hand-to-break')
    }
    if (cost.kind === 'battle-to-hand') {
      return keys.has('battleCookieToHand') || kinds.has('battle-to-hand') || kinds.has('return-to-hand')
    }
    if (cost.kind === 'support-to-hand') {
      return keys.has('supportToHand') || kinds.has('support-to-hand')
    }
    if (cost.kind === 'trash-to-break') {
      return (
        // P-082 models「place 1 Cookie … from your trash into your break
        // area」as the trap's alternative cost key.
        keys.has('trashCookieToBreakArea') || kinds.has('trash-to-break')
      )
    }
    if (cost.kind === 'trash-to-deck') {
      return keys.has('trashToDeck') || kinds.has('trash-to-deck')
    }
    if (cost.kind === 'trash-to-deck-bottom') {
      return keys.has('trashToDeckBottom') || kinds.has('trash-to-deck-bottom')
    }
    if (cost.kind === 'self-to-trash') {
      return (
        keys.has('selfToTrash') ||
        // The adapter represents a self-trash payment as the generic
        // battle-cookie trash key when the source is the attacking Cookie.
        keys.has('trashBattleCookie') ||
        kinds.has('self-to-trash') ||
        // Stage cards model「Place this card in the trash.」as the
        // `stage-source-to-trash` effect instead of an AbilityCost key
        // (BS2-081).
        kinds.has('stage-source-to-trash')
      )
    }
    if (cost.kind === 'self-to-break') return keys.has('selfToBreakArea') || kinds.has('self-to-break')
    if (cost.kind === 'rest-source') {
      return evidence.skill?.restSource === true || evidence.ability?.restSource === true
    }
    return [
      'move',
      'trash-to-battle',
      'break-to-battle',
      'break-to-hand',
      'hand-to-battle',
      'hand-to-break',
      'support-to-hand',
      'support-to-support',
      'hand-to-support',
      'trash-to-support',
      'trash-to-hand',
      'battle-to-deck-bottom',
      'field-to-deck-bottom',
      'self-to-deck-bottom',
      'return-to-deck-bottom',
      'stage-source-to-deck',
      'break-to-trash',
      'break-source-to-trash',
      'hand-to-deck-bottom',
      'place-source-to-support',
      'rest-cookie',
      'battle-to-hand',
      'hp-to-hand',
      'return-to-hand',
      'trash-to-break',
      'reveal-hand',
      'deck-to-trash',
    ].some((kind) => kinds.has(kind))
      || [
        'battleToDeckBottom',
        'selfToDeckBottom',
        'handToDeckBottom',
        'breakToTrash',
      ].some((key) => keys.has(key))
  })
  const targetCovered = contract.targets.every((target) =>
    target.unresolved !== undefined
      ? false
      : runtime.targetSelectors.some((selector) => selectorMatches(target.selector, selector)),
  )
  const runtimeEffects = flattenRuntimeEffects(evidence)
  const resolutionOrderCovered =
    !contract.clauses.some((clause) => clause.role === 'then') ||
    hasRuntimeThenEffects(evidence) ||
    hasRuntimeConditionalStep(evidence) ||
    runtimeEffects.length >= 2
  const timingCovered = contract.timing.markers.every((marker) => {
    if (marker === 't1') return evidence.skill?.oncePerTurn === true
    if (marker === 'mt') return evidence.skill?.yourTurn === true
    if (marker === 'mob' || marker === 'ap') return evidence.skill !== undefined || evidence.ability !== undefined
    if (marker === 'bl') return evidence.skill?.trigger === 'block'
    return true
  })
  const errors = [...contract.blockers]
  if (!paymentCovered) errors.push('payment evidence missing')
  if (!costCovered) errors.push('cost evidence missing')
  if (!targetCovered) errors.push('target evidence unresolved')
  if (!resolutionOrderCovered) errors.push('resolution order evidence missing')
  if (!timingCovered) errors.push('timing evidence missing')
  if (errors.length > 0 && contract.status === 'verified') {
    contract.status = 'needs-review'
    contract.blockers = [...new Set(errors)]
  }
  return {
    contract,
    runtime,
    checks: {
      sourceHashStable: contract.sourceHash === hashSource(normalized),
      paymentCovered,
      costCovered,
      targetCovered,
      resolutionOrderCovered,
      timingCovered,
    },
    errors: [...new Set(errors)],
  }
}
