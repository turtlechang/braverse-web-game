import { createHash } from 'node:crypto'
import type {
  CardEffect,
  EnergyCost,
  EffectTargetSelector,
  GameCard,
} from '../../game'
import { convertOfficialCardToGameCard } from '../official-card-adapter'
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
  [/\b(?:draw|reveal|inspect|look at|view|rearrange)\b/i, 'effect'],
  [/\b(?:deal|receives?|gains?|damage|attack|faint|equip|redirect|mou)\b|\{da\}/i, 'effect'],
  [
    /\b(?:play|place|return|move|put|take|trash|discard|rest|set|make)\b/i,
    'effect',
  ],
  [
    /\b(?:if|when|while|as long as|whenever|cannot\s+(?:activate|be selected|be trashed)|only be used|sum reaches)\b/i,
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
    'keyword',
    'cardName',
    'costSelected',
  ] as const) {
    if (expected[key] !== undefined && actual[key] !== expected[key]) return false
  }
  return true
}

const runtimeSelectorForEffect = (
  record: Record<string, unknown>,
): Partial<EffectTargetSelector> | null => {
  if (typeof record.kind !== 'string') return null
  const amount = typeof record.amount === 'number' ? record.amount : undefined
  const optional = record.optional === true
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
    'flip-to-support',
  ])
  if (!movementKinds.has(record.kind)) return null
  return {
    side: 'self',
    ...(amount !== undefined ? { min: optional ? 0 : amount, max: amount } : {}),
    ...(typeof record.energyColor === 'string'
      ? { energyColor: record.energyColor as EffectTargetSelector['energyColor'] }
      : {}),
    ...(typeof record.maxLevel === 'number' ? { maxLevel: record.maxLevel } : {}),
    ...(typeof record.exactLevel === 'number'
      ? { minLevel: record.exactLevel, maxLevel: record.exactLevel }
      : {}),
    ...(typeof record.minLevel === 'number' ? { minLevel: record.minLevel } : {}),
  }
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
    if (/^\{[RYGBPKN]\}(?:\s*\{[RYGBPKN]\})*$/i.test(inner)) {
      addClause(clauses, source, match[0], 'payment', start, end, 'exact')
      payments.push({ kind: 'energy', energy, clauseIds: [clauseId] })
      continue
    }
    if (/can be used as\s+\{[RYGBPKN]\}/i.test(inner)) {
      addClause(clauses, source, match[0], 'payment', start, end, 'pattern')
      payments.push({ kind: 'source-energy', energy, clauseIds: [clauseId] })
      continue
    }
    const discard = inner.match(/discard\s+(\d+)\s+(?:\{[RYGBPK]\}\s+)?(?:cards?|cookies?|traps?|items?)/i)
    const discardAll = /discard\s+(?:your|the)\s+entire\s+hand/i.test(inner)
    const supportTrash = inner.match(/place\s+(\d+)\s+cards?\s+from\s+your\s+support/i)
    const hpTrash = inner.match(/place\s+(\d+)\s+cards?\s+from\s+the\s+top\s+of\s+(?:(?:this|your|your\s+other|an?|the|LV\.\d+\s+or\s+higher)\s+)?(?:\{[RYGBPK]\}\s+)?cookie'?s\s+hp(?:\s+cards?)?/i)
    const battleTrash = inner.match(/place\s+(\d+)\s+.*cookie.*battle\s+area.*trash/i)
    const selfTrash = /place\s+this\s+cookie\s+in\s+(?:the|your)\s+trash/i.test(inner)
    const selfBreak = /(?:make\s+this\s+cookie\s+faint|place\s+this\s+cookie\s+in\s+(?:the|your)\s+break\s+area)/i.test(inner)
    const battleFaint = inner.match(/make\s+(\d+)\s+.*cookies?\s+faint/i)
    const battleBreak = inner.match(/place\s+(\d+)\s+.*cookie.*battle\s+area.*break\s+area/i)
    const handBreak = inner.match(/place\s+(\d+)\s+.*cookie.*hand.*break\s+area/i)
    const restSource = /(?:rest\s+this\s+card|card\s+rests?)/i.test(inner)
    const fieldToDeckBottom = /place\s+(?:this\s+cookie|\d+\s+.*cookie)\s+(?:on|at)\s+the\s+bottom\s+of\s+(?:the|your|the\s+owner's)\s+deck/i.test(inner)
    const breakToTrash = /place\s+this\s+cookie\s+from\s+(?:the\s+)?break\s+area\s+into\s+the\s+trash/i.test(inner)
    const handToDeckBottom = /place\s+(?:\d+\s+)?cards?\s+from\s+your\s+hand\s+(?:on|at)\s+the\s+bottom\s+of\s+your\s+deck/i.test(inner)
    const supportHand = inner.match(/return\s+(\d+)\s+(?:cards?|cookies?)\s+from\s+your\s+support\s+area\s+to\s+your\s+hand/i)
    const trashDeck = inner.match(/select\s+(\d+)\s+.*cards?\s+from\s+your\s+trash.*return\s+them\s+to\s+your\s+deck/i)
    const trashDeckBottom = inner.match(/select\s+(\d+)\s+.*cards?\s+from\s+your\s+trash.*bottom\s+of\s+your\s+deck/i)
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
      restSource ||
      fieldToDeckBottom ||
      breakToTrash ||
      handToDeckBottom ||
      supportHand ||
      trashDeck ||
      trashDeckBottom
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
                  : restSource
                        ? 'rest-source'
                        : fieldToDeckBottom || breakToTrash || handToDeckBottom
                          ? 'move'
                          : supportHand
                          ? 'support-to-hand'
                          : trashDeck
                            ? 'trash-to-deck'
                            : trashDeckBottom
                              ? 'trash-to-deck-bottom'
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
    const energyToken = descriptor.match(/\{([RYGBPK])\}/i)?.[1]?.toUpperCase()
    const energyColor = energyToken
      ? ENERGY_TOKEN_TO_COLOR[energyToken]
      : undefined
    const levelMatch = descriptor.match(/LV\.\s*(\d+)(?:\s+(or\s+(?:lower|higher)))?/i)
    const level = levelMatch ? Number(levelMatch[1]) : undefined
    const levelQualifier = levelMatch?.[2]?.toLowerCase()
    const remainingHp = descriptor.match(/remaining\s+HP\s+is\s+(\d+)/i)?.[1]
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
        ...(remainingHp !== undefined ? { remainingHp: Number(remainingHp) } : {}),
      },
      clauseIds: [clauseId],
    })
  }
  const zoneSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+(?:\{([RYGBPK])\}\s+)?(?:LV\.\s*(\d+)(?:\s+or\s+(?:lower|higher))?\s+)?(?:cookies?|cards?)\s+from\s+(your|the)\s+(trash|break\s+area|support\s+area|hand|deck)\b/gi
  for (const match of text.matchAll(zoneSelection)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (structuredRanges.some((range) => start < range.end && end > range.start)) continue
    const amount = Number(match[2])
    const level = match[4] ? Number(match[4]) : undefined
    const qualifier = match[0].match(/LV\.\s*\d+\s+(or\s+(?:lower|higher))/i)?.[1]?.toLowerCase()
    const color = match[3] ? ENERGY_TOKEN_TO_COLOR[match[3].toUpperCase()] : undefined
    const zoneText = match[5]?.toLowerCase() ?? ''
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
        side: 'self',
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
  const battleAreaSelection = /\bselect\s+(up\s+to\s+)?(\d+)\s+((?:\{[RYGBPK]\}\s+)?(?:LV\.\s*\d+(?:\s+or\s+(?:lower|higher))?\s+)?(?:cookies?|cards?)(?:\s+that\s+is\s+LV\.\s*\d+(?:\s+or\s+(?:lower|higher))?)?)\s+(?:in|from)\s+(your opponent's|your|either player's)\s+battle\s+area\b/gi
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
      },
      clauseIds: [clauseId],
      zone: 'battle',
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
    if (/\bfrom\s+(?:your|the)\s+(?:trash|break\s+area|support\s+area|hand|deck)/i.test(match[0])) continue
    const clauseId = `${source}-${clauses.length + 1}`
    addClause(clauses, source, match[0], 'target', start, end, 'unknown')
    targets.push({
      selector: {},
      clauseIds: [clauseId],
      unresolved: 'selection phrase has no safe selector mapping',
    })
  }
  const unresolvedZoneSelection = /\b(?:play|place|return|take|put)\s+(?:up\s+to\s+)?\d+\b[^.]*\bfrom\s+(?:your|the)\s+(?:trash|break\s+area|support\s+area|hand|deck)/gi
  for (const match of text.matchAll(unresolvedZoneSelection)) {
    const start = match.index ?? 0
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
      // Cookie attack names are printed between the payment and `{da}` marker.
      // They are display labels, not an omitted rule clause; the damage marker
      // above already supplies the executable attack evidence.
      if (source === 'attack' && /\{da\}|\bdeals?\s+\d+\s+damage\b/i.test(text)) continue
      addClause(clauses, source, normalized, 'unsupported', 0, text.length, 'unknown')
    }
  }
  if (/\bthen\b/i.test(text)) {
    addClause(clauses, source, 'Then', 'then', text.toLowerCase().indexOf('then'), text.length, 'exact')
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
  for (const [key, child] of Object.entries(record)) {
    if (
      key === 'kind' ||
      key === 'target' ||
      key === 'energyCost' ||
      key === 'attackEnergyCost' ||
      key === 'sourceEnergy'
    ) continue
    if (key === 'cost' && child && typeof child === 'object') {
      const cost = child as Record<string, unknown>
      Object.keys(cost).forEach((costKey) => result.abilityCostKeys.add(costKey))
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
    targets.push(...targetClauses(source, text, clauses))
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
  const conversion = runtimeCard === undefined ? convertOfficialCardToGameCard(record) : null
  const card = runtimeCard === undefined && conversion?.status === 'converted' ? conversion.gameCard : runtimeCard ?? null
  const evidence: RuntimeCardEvidence = {
    ...runtimeEvidenceFromCard(card),
    unsupportedReason: conversion?.status === 'unsupported' ? conversion.reason : undefined,
  }
  const contract = buildContract(record, evidence)
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
    if (cost.kind === 'support-to-hand') {
      return keys.has('supportToHand') || kinds.has('support-to-hand')
    }
    if (cost.kind === 'trash-to-deck') {
      return keys.has('trashToDeck') || kinds.has('trash-to-deck')
    }
    if (cost.kind === 'trash-to-deck-bottom') {
      return keys.has('trashToDeckBottom') || kinds.has('trash-to-deck-bottom')
    }
    if (cost.kind === 'self-to-trash') return keys.has('selfToTrash') || kinds.has('self-to-trash')
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
      'stage-source-to-deck',
      'break-to-trash',
      'hand-to-deck-bottom',
      'place-source-to-support',
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
      sourceHashStable: contract.sourceHash === hashSource(record),
      paymentCovered,
      costCovered,
      targetCovered,
      resolutionOrderCovered,
      timingCovered,
    },
    errors: [...new Set(errors)],
  }
}
