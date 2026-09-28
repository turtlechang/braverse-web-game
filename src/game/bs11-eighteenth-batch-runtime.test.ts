import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { createBattleState, item } from './test-helpers/battle-helpers'
import type {
  CardSkill,
  CookieCard,
  CookieInBattle,
  ExtraDeckCard,
  GameCard,
  GameState,
} from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(
    record,
    `bs11-eighteenth-${suffix}`,
  )
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber}: ${result.reason}`)
  }
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const cookieEntry = (
  card: GameCard,
  hpCards: GameCard[],
): CookieInBattle => {
  if (card.type !== 'cookie') throw new Error(`Expected Cookie: ${card.name}`)
  return {
    card: card as CookieCard,
    hpCards,
    rested: false,
    battleEntryId: `${card.instanceId}:battle`,
  }
}

const withSeaFairy = (hand: GameCard[]): {
  state: GameState
  source: GameCard
} => {
  const base = createBattleState()
  const source = candidate('BS11-069', 'source')
  return {
    state: {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand,
          battleArea: [cookieEntry(source, [item('bs11-069:source-hp')])],
          deck: [item('bs11-069:deck-1'), item('bs11-069:deck-2'), item('bs11-069:deck-3')],
        },
      },
    },
    source,
  }
}

describe('BS11-069 Sea Fairy Cookie runtime', () => {
  it('draws up to two and then places exactly one selected hand card on deck top', () => {
    const scenario = withSeaFairy([
      item('bs11-069:hand-1'),
      item('bs11-069:hand-2'),
      item('bs11-069:hand-3'),
      item('bs11-069:hand-4'),
      item('bs11-069:hand-5'),
    ])
    const skill = scenario.source.type === 'cookie' ? scenario.source.skill : undefined
    const effect = skill?.effects[0]
    if (!effect) throw new Error('Sea Fairy skill effect missing')

    let current = executeCardEffect(
      scenario.state,
      {
        sourcePlayerId: 'player-two',
        sourceInstanceId: scenario.source.instanceId,
        sourceCardName: scenario.source.name,
      },
      effect,
      [],
    )
    expect(current.pendingDrawUpTo).toMatchObject({
      playerId: 'player-two',
      max: 2,
      afterEffectContext: {
        sourceInstanceId: scenario.source.instanceId,
      },
    })

    current = applyGameCommand(current, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-two',
      drawCount: 2,
    })
    expect(current.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-two',
      count: 1,
      destination: 'deck-top',
      chainedFromDrawUpTo: true,
    })

    const selected = current.players['player-two'].hand[0]
    current = applyGameCommand(current, {
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-two',
      cardIds: [selected.instanceId],
    })
    expect(current.players['player-two'].deck[0]).toEqual(selected)
    expect(current.players['player-two'].hand).not.toContainEqual(selected)
  })

  it('rejects the skill when the hand-size condition is no longer true', () => {
    const scenario = withSeaFairy([
      item('bs11-069:hand-1'),
      item('bs11-069:hand-2'),
      item('bs11-069:hand-3'),
      item('bs11-069:hand-4'),
      item('bs11-069:hand-5'),
      item('bs11-069:hand-6'),
    ])
    const skill = scenario.source.type === 'cookie' ? scenario.source.skill : undefined
    const effect = skill?.effects[0]
    if (!effect) throw new Error('Sea Fairy skill effect missing')

    expect(() => executeCardEffect(
      scenario.state,
      {
        sourcePlayerId: 'player-two',
        sourceInstanceId: scenario.source.instanceId,
      },
      effect,
      [],
    )).toThrow()
  })
})

const shadowMilkExtra = (
  skill: CardSkill,
): ExtraDeckCard => ({
  id: 'BS9-102',
  instanceId: 'bs11-071:extra-shadow-milk',
  name: 'Shadow Milk Cookie',
  type: 'extra',
  level: 2,
  hp: 4,
  attack: 3,
  attackCost: 3,
  attackEnergyCost: { blue: 3 },
  effectText: skill.text,
  skill,
})

const makeShadowMilkAttackState = (): {
  state: GameState
  discardCost: GameCard
  payment: GameCard
  extra: ExtraDeckCard
} => {
  const base = createBattleState()
  const source = candidate('BS11-071', 'source')
  if (source.type !== 'cookie' || !source.attackEffects) {
    throw new Error('Shadow Milk attack mapping missing')
  }
  const discardCost = item('bs11-071:discard-cost')
  const payment = item('bs11-071:payment', 'red')
  const extraSkill: CardSkill = {
    trigger: 'on-play',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: { energy: {}, discardHand: 0 },
    text: 'On Play: Draw up to 1 card from your deck.',
    effects: [{ kind: 'draw-up-to', max: 1 }],
  }
  const extra = shadowMilkExtra(extraSkill)
  const attacker = cookieEntry(source, [item('bs11-071:source-hp')])
  const defender = base.players['player-one'].battleArea[0]

  return {
    state: {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [defender],
        },
        'player-two': {
          ...base.players['player-two'],
          hand: [discardCost],
          battleArea: [attacker],
          supportArea: [{ card: payment, rested: false }],
          extraDeck: [extra],
          deck: [item('bs11-071:skill-draw')],
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: source.instanceId,
        targetInstanceId: defender.card.instanceId,
        declaredDamage: source.attack,
        remainingDamage: source.attack,
        stage: 'attack-effect',
        trapUsed: true,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: source.attackEffects,
        attackEffectIndex: 0,
      },
    },
    discardCost,
    payment,
    extra,
  }
}

describe('BS11-071 Shadow Milk Cookie runtime', () => {
  it('pays the Then cost, chooses a skill, moves the selected EXTRA card to trash, and resumes its skill', () => {
    const scenario = makeShadowMilkAttackState()
    let current = applyGameCommand(scenario.state, {
      kind: 'resolve-attack-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(current.pendingOptionalCostAttack).toMatchObject({
      cost: { energy: { neutral: 1 }, discardHand: 1 },
    })

    current = applyGameCommand(current, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-two',
      action: 'pay',
      discardCardIds: [scenario.discardCost.instanceId],
      paymentIds: [scenario.payment.instanceId],
    })
    expect(current.pendingAbilityEffect?.effects[0]).toMatchObject({
      kind: 'choose-one',
    })
    expect(current.pendingBattle?.stage).toBe('attack-effect')

    current = applyGameCommand(current, {
      kind: 'resolve-choose-one',
      playerId: 'player-two',
      modeIndex: 0,
    })
    expect(current.pendingAbilityEffect?.effects[0]).toMatchObject({
      kind: 'activate-extra-deck-skill',
      skillTrigger: 'on-play',
      optional: false,
    })

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(current.pendingExtraDeckAttack).toMatchObject({
      resolution: 'skill',
      skillTrigger: 'on-play',
      optional: false,
      candidateIds: [scenario.extra.instanceId],
    })
    expect(current.pendingBattle?.stage).toBe('attack-effect')
    expect(() => applyGameCommand(current, {
      kind: 'resolve-extra-deck-attack',
      playerId: 'player-two',
    })).toThrow()

    current = applyGameCommand(current, {
      kind: 'resolve-extra-deck-attack',
      playerId: 'player-two',
      extraDeckInstanceId: scenario.extra.instanceId,
    })
    expect(current.players['player-two'].extraDeck).toEqual([])
    expect(current.players['player-two'].discardPile).toContainEqual(
      expect.objectContaining({
        instanceId: scenario.extra.instanceId,
        extraDeckOrigin: 'extra',
      }),
    )
    expect(current.pendingAbilityEffect?.effects).toEqual([
      { kind: 'draw-up-to', max: 1 },
    ])

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(current.pendingDrawUpTo).toMatchObject({
      playerId: 'player-two',
      max: 1,
    })
  })
})

describe('BS11-072 Dark Choco Cookie runtime', () => {
  it('uses the source player trash count and deals one effect damage', () => {
    const base = createBattleState()
    const source = candidate('BS11-072', 'source')
    if (source.type !== 'cookie' || !source.skill) {
      throw new Error('Dark Choco skill mapping missing')
    }
    const target = base.players['player-one'].battleArea[0]
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [cookieEntry(source, [item('bs11-072:source-hp')])],
          discardPile: Array.from({ length: 15 }, (_, index) =>
            item(`bs11-072:trash-${index}`),
          ),
        },
      },
    }

    const current = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-two',
        sourceInstanceId: source.instanceId,
        sourceCardName: source.name,
      },
      source.skill.effects[0],
      [target.card.instanceId],
    )
    expect(current.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
  })
})
import { describe, expect, it } from 'vitest'
