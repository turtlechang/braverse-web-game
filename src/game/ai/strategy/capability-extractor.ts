import type {
  AbilityCost,
  CardEffect,
  CardSkill,
  EffectCondition,
  GameCard,
  StageAbility,
} from '../../types'
import {
  conditionKinds,
  conditionTags,
  makeEvidence,
  noTarget,
  toCapabilityTarget,
  type CapabilityEvidence,
  type CapabilityKind,
  type CapabilitySource,
  type CapabilityTiming,
  type CardCapabilityModel,
  type EffectSource,
  type StrategyTag,
  type StrategyZone,
} from './capability-model'

const setupTags = new Set<StrategyTag>([
  'support',
  'trash',
  'deck-order',
  'active-rest',
  'hand',
  'hp',
  'battle',
  'break',
])

const sourceTiming = (skill: CardSkill | StageAbility): CapabilityTiming => {
  if (skill.endPhase) return 'end-phase'
  if ('faint' in skill && skill.faint) return 'faint'
  if ('afterDamage' in skill && skill.afterDamage) return 'after-damage'
  return 'trigger' in skill ? skill.trigger : 'activate'
}

const getCondition = (effect: CardEffect): EffectCondition | undefined =>
  'condition' in effect ? effect.condition : undefined

const addEvidence = (
  result: CapabilityEvidence[],
  card: GameCard,
  cardIndex: number,
  effectSource: EffectSource,
  effect: CardEffect,
  effectPath: number[],
  kind: CapabilityKind,
  options: {
    sourceZone?: StrategyZone
    destinationZone?: StrategyZone
    tags?: StrategyTag[]
    target?: CapabilityEvidence['target']
    supported?: boolean
  } = {},
) => {
  const conditions = conditionKinds(getCondition(effect))
  const certainty = options.supported === false
    ? 'unsupported'
    : conditions.length > 0
      ? 'conditional'
      : 'confirmed'
  result.push(makeEvidence(card, cardIndex, effectSource, effectPath, {
    kind,
    effectKind: effect.kind,
    sourceZone: options.sourceZone,
    destinationZone: options.destinationZone,
    target: options.target ?? ('target' in effect ? toCapabilityTarget(effect.target) : noTarget),
    conditionKinds: conditions,
    strategyTags: options.tags ?? [],
    certainty,
  }))
}

const addConditionalEvidence = (
  result: CapabilityEvidence[],
  card: GameCard,
  cardIndex: number,
  effectSource: EffectSource,
  effect: CardEffect,
  effectPath: number[],
  effectEvidence: readonly CapabilityEvidence[],
) => {
  const conditions = conditionKinds(getCondition(effect))
  const producedTags = [...new Set(effectEvidence.flatMap((evidence) => evidence.strategyTags))]
  if (producedTags.some((tag) => setupTags.has(tag))) {
    result.push(makeEvidence(card, cardIndex, effectSource, effectPath, {
      kind: 'conditional-setup',
      effectKind: effect.kind,
      target: noTarget,
      conditionKinds: [],
      strategyTags: producedTags.filter((tag) => setupTags.has(tag)),
      certainty: 'confirmed',
    }))
  }
  if (conditions.length > 0) {
    result.push(makeEvidence(card, cardIndex, effectSource, effectPath, {
      kind: 'conditional-payoff',
      effectKind: effect.kind,
      target: noTarget,
      conditionKinds: conditions,
      strategyTags: conditionTags(conditions),
      certainty: 'conditional',
    }))
  }
}

const extractEffect = (
  result: CapabilityEvidence[],
  card: GameCard,
  cardIndex: number,
  effectSource: EffectSource,
  effect: CardEffect,
  effectPath: number[],
) => {
  const start = result.length
  switch (effect.kind) {
    case 'damage':
    case 'split-damage':
    case 'damage-all':
    case 'damage-by-break-count':
    case 'damage-by-break-level-difference':
    case 'make-faint':
    case 'rest-support-and-damage':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'damage', {
        tags: ['opponent-board'],
      })
      break
    case 'draw':
    case 'draw-up-to':
    case 'draw-up-to-then-discard':
    case 'draw-up-to-opponent-fainted-this-turn':
    case 'draw-up-to-battle-cookie-count':
    case 'draw-up-to-break-cookie-count':
    case 'draw-until-hand-equals-opponent':
    case 'hand-to-deck-and-draw':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'draw', {
        tags: ['hand'],
      })
      break
    case 'discard-hand':
    case 'discard-hand-all':
    case 'opponent-discard-hand':
    case 'opponent-random-discard':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'discard', {
        destinationZone: 'trash',
        tags: effect.kind.startsWith('opponent') ? ['opponent-hand'] : ['trash'],
      })
      break
    case 'gain-hp':
    case 'hand-to-hp':
    case 'support-to-hp':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'gain-hp', {
        destinationZone: 'hp',
        tags: ['hp'],
      })
      break
    case 'modify-attack':
    case 'modify-all-attack':
    case 'modify-attack-by-break-count':
    case 'modify-attack-cost':
    case 'multiply-attack-damage':
    case 'modify-damage-received':
    case 'disable-attack':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'attack-modification', {
        tags: ['battle'],
      })
      break
    case 'hand-to-battle':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'deploy', {
        sourceZone: 'hand',
        destinationZone: 'battle',
        tags: ['battle'],
      })
      break
    case 'support-to-battle':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'deploy', {
        sourceZone: 'support',
        destinationZone: 'battle',
        tags: ['battle', 'support'],
      })
      break
    case 'trash-to-battle':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'deploy', {
        sourceZone: 'trash',
        destinationZone: 'battle',
        tags: ['battle', 'trash'],
      })
      break
    case 'break-to-battle':
    case 'break-source-to-battle':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'deploy', {
        sourceZone: 'break',
        destinationZone: 'battle',
        tags: ['battle', 'break'],
      })
      break
    case 'deck-to-support':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'deploy', {
        sourceZone: 'deck',
        destinationZone: 'support',
        tags: ['support'],
      })
      break
    case 'inspect-deck':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'inspect-deck', {
        sourceZone: 'deck',
        destinationZone: effect.restDestination === 'bottom'
          ? 'deck-bottom'
          : effect.restDestination === 'top'
            ? 'deck-top'
            : 'trash',
        tags: ['deck-order'],
      })
      if (effect.pickDestination === 'battle') {
        addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'deploy', {
          sourceZone: 'deck',
          destinationZone: 'battle',
          tags: ['battle', 'deck-order'],
        })
      }
      break
    case 'reveal-top-deck':
    case 'reveal-bottom-deck':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'inspect-deck', {
        sourceZone: 'deck',
        destinationZone: effect.kind === 'reveal-top-deck' ? 'deck-top' : 'deck-bottom',
        tags: ['deck-order'],
      })
      if (effect.kind === 'reveal-top-deck') {
        effect.effects.forEach((child, childIndex) =>
          extractEffect(result, card, cardIndex, effectSource, child, [...effectPath, childIndex]),
        )
      }
      break
    case 'rest-cookie':
    case 'rest-support':
    case 'opponent-rests-support':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'rest', {
        tags: ['active-rest'],
      })
      break
    case 'set-active':
    case 'set-cookie-active':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'set-active', {
        tags: ['active-rest'],
      })
      break
    case 'redirect-attack':
    case 'prevent-knockout':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'block', {
        tags: ['battle'],
      })
      break
    case 'disable-flip':
    case 'disable-block':
    case 'disable-traps':
    case 'prevent-opponent-battle-movement':
    case 'prevent-effect-damage':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'control', {
        tags: ['opponent-board'],
      })
      break
    case 'place-source-to-support':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'battle',
        destinationZone: 'support',
        tags: ['support'],
      })
      break
    case 'support-to-trash':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'support',
        destinationZone: 'trash',
        tags: ['support', 'trash'],
      })
      break
    case 'battle-to-support':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'battle',
        destinationZone: 'support',
        tags: ['battle', 'support'],
      })
      break
    case 'support-to-hand':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'support',
        destinationZone: 'hand',
        tags: ['support', 'hand'],
      })
      break
    case 'hand-to-support':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'hand',
        destinationZone: 'support',
        tags: ['hand', 'support'],
      })
      break
    case 'deck-to-trash':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'deck',
        destinationZone: 'trash',
        tags: ['trash'],
      })
      break
    case 'break-to-trash':
    case 'break-source-to-trash':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'break',
        destinationZone: 'trash',
        tags: ['break', 'trash'],
      })
      break
    case 'trash-to-break':
    case 'opponent-trash-to-break':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'trash',
        destinationZone: 'break',
        tags: ['trash', 'break'],
      })
      break
    case 'opponent-battle-to-trash':
    case 'field-to-trash':
    case 'field-to-trash-all':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'battle',
        destinationZone: 'trash',
        tags: ['opponent-board', 'trash'],
      })
      break
    case 'return-to-hand':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'battle',
        destinationZone: 'hand',
        tags: ['battle', 'hand'],
      })
      break
    case 'return-to-deck-bottom':
    case 'field-to-deck-bottom':
    case 'field-to-deck-bottom-all':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'battle',
        destinationZone: 'deck-bottom',
        tags: ['deck-order'],
      })
      break
    case 'battle-to-deck-top':
    case 'stage-source-to-deck':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'battle',
        destinationZone: effect.kind === 'stage-source-to-deck' && effect.destination === 'bottom'
          ? 'deck-bottom'
          : 'deck-top',
        tags: ['deck-order'],
      })
      break
    case 'trash-to-support':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'trash',
        destinationZone: 'support',
        tags: ['trash', 'support'],
      })
      break
    case 'trash-to-hand':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'trash',
        destinationZone: 'hand',
        tags: ['trash', 'hand'],
      })
      break
    case 'trash-to-deck':
    case 'trash-to-deck-all':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'trash',
        destinationZone: effect.kind === 'trash-to-deck' && effect.destination === 'bottom'
          ? 'deck-bottom'
          : 'deck',
        tags: ['trash', 'deck-order'],
      })
      if (effect.kind === 'trash-to-deck-all') {
        effect.thenEffects?.forEach((child, childIndex) =>
          extractEffect(result, card, cardIndex, effectSource, child, [...effectPath, childIndex]),
        )
      }
      break
    case 'hp-to-support':
    case 'flip-to-support':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'hp',
        destinationZone: 'support',
        tags: ['hp', 'support'],
      })
      break
    case 'hp-to-hand':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'hp',
        destinationZone: 'hand',
        tags: ['hp', 'hand'],
      })
      break
    case 'hp-to-trash':
    case 'hp-to-trash-all':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'hp',
        destinationZone: 'trash',
        tags: ['hp', 'trash'],
      })
      break
    case 'break-to-hand':
    case 'break-to-hand-by-level-sum':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'break',
        destinationZone: 'hand',
        tags: ['break', 'hand'],
      })
      break
    case 'hand-to-break':
    case 'hand-to-break-by-level-sum':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'hand',
        destinationZone: 'break',
        tags: ['hand', 'break'],
      })
      break
    case 'battle-to-break':
    case 'flip-to-break':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'battle',
        destinationZone: 'break',
        tags: ['battle', 'break'],
      })
      break
    case 'stage-source-to-trash':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'battle',
        destinationZone: 'trash',
        tags: ['trash'],
      })
      break
    case 'transfer-hp':
    case 'cycle-hp':
    case 'equip-source':
    case 'view-hp':
    case 'reorder-hp':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'control', {
        tags: ['hp'],
      })
      break
    case 'choose-one':
      effect.modes.forEach((mode, modeIndex) =>
        mode.effects.forEach((child, childIndex) =>
          extractEffect(result, card, cardIndex, effectSource, child, [...effectPath, modeIndex, childIndex]),
        ),
      )
      break
    case 'optional-cost-attack':
      effect.effects.forEach((child, childIndex) =>
        extractEffect(result, card, cardIndex, {
          ...effectSource,
          cost: effect.cost as AbilityCost,
        }, child, [...effectPath, childIndex]),
      )
      break
    case 'deferred-end-of-turn':
      effect.effects.forEach((child, childIndex) =>
        extractEffect(result, card, cardIndex, {
          ...effectSource,
          timing: 'end-phase',
        }, child, [...effectPath, childIndex]),
      )
      break
    case 'opponent-break-to-trash-then-battle-to-break':
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'move', {
        sourceZone: 'break',
        destinationZone: 'trash',
        tags: ['opponent-board', 'break', 'trash'],
      })
      break
    default:
      addEvidence(result, card, cardIndex, effectSource, effect, effectPath, 'unsupported', {
        supported: false,
      })
  }
  addConditionalEvidence(result, card, cardIndex, effectSource, effect, effectPath, result.slice(start))
}

const addMarker = (
  capabilities: CapabilityEvidence[],
  card: GameCard,
  cardIndex: number,
  source: CapabilitySource,
  timing: CapabilityTiming,
  kind: 'block' | 'trap' | 'flip',
  cost: AbilityCost | null,
) => {
  capabilities.push(makeEvidence(card, cardIndex, { source, timing, cost }, [], {
    kind,
    effectKind: null,
    target: noTarget,
    conditionKinds: [],
    strategyTags: kind === 'block' ? ['battle'] : [],
    certainty: 'confirmed',
  }))
}

const extractEffects = (
  capabilities: CapabilityEvidence[],
  card: GameCard,
  cardIndex: number,
  source: EffectSource,
  effects: readonly CardEffect[],
) => effects.forEach((effect, effectIndex) =>
  extractEffect(capabilities, card, cardIndex, source, effect, [effectIndex]),
)

export const extractCardCapabilities = (
  card: GameCard,
  cardIndex = 0,
): CardCapabilityModel => {
  const capabilities: CapabilityEvidence[] = []
  // Runtime `card.effects` is a display／fallback representation. Cards with a
  // typed skill, item, trap, FLIP, or stage ability expose the same effects in
  // both places; prefer the typed source so timing and cost remain exact and
  // the deck profile does not double-count one ability.
  const hasTypedAbility = Boolean(
    card.skill || card.flip || card.trap || card.item || card.stageAbility,
  )
  if (card.effects && !hasTypedAbility) {
    extractEffects(capabilities, card, cardIndex, {
      source: 'card-effect',
      timing: 'other',
      cost: null,
    }, card.effects)
  }
  if (card.type === 'cookie' && card.attackEffects) {
    extractEffects(capabilities, card, cardIndex, {
      source: 'attack',
      timing: 'attack',
      cost: null,
    }, card.attackEffects)
  }
  if (card.skill) {
    const timing = sourceTiming(card.skill)
    if (card.skill.trigger === 'block') {
      addMarker(capabilities, card, cardIndex, 'skill', timing, 'block', card.skill.cost)
    }
    extractEffects(capabilities, card, cardIndex, {
      source: 'skill',
      timing,
      cost: card.skill.cost,
    }, card.skill.effects)
  }
  if (card.flip) {
    addMarker(capabilities, card, cardIndex, 'flip', 'flip', 'flip', card.flip.cost)
    extractEffects(capabilities, card, cardIndex, {
      source: 'flip',
      timing: 'flip',
      cost: card.flip.cost,
    }, card.flip.effects)
  }
  if (card.trap) {
    addMarker(capabilities, card, cardIndex, 'trap', 'opponent-attack', 'trap', card.trap.cost)
    extractEffects(capabilities, card, cardIndex, {
      source: 'trap',
      timing: 'opponent-attack',
      cost: card.trap.cost,
    }, card.trap.effects)
  }
  if (card.item) {
    extractEffects(capabilities, card, cardIndex, {
      source: 'item',
      timing: 'activate',
      cost: card.item.cost,
    }, card.item.effects)
  }
  if (card.stageAbility) {
    extractEffects(capabilities, card, cardIndex, {
      source: 'stage',
      timing: sourceTiming(card.stageAbility),
      cost: card.stageAbility.cost,
    }, card.stageAbility.effects)
  }
  const unsupportedEffectKinds = capabilities
    .filter((capability) => capability.kind === 'unsupported')
    .map((capability) => capability.effectKind ?? 'unknown')
  return { cardId: card.id, cardIndex, capabilities, unsupportedEffectKinds }
}

export const extractDeckCapabilities = (
  cards: readonly GameCard[],
): CardCapabilityModel[] => cards.map((card, cardIndex) => extractCardCapabilities(card, cardIndex))
