import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { convertOfficialAttackEffects } from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { deployCookie } from './actions'
import { applyGameCommand } from './commands'
import { resolveAttackEffect } from './battle'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'
import type { CookieCard, CookieInBattle, GameCard, GameState, PendingBattle } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): CookieCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-twenty-sixth-${suffix}`)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') {
    throw new Error(`${cardNumber} did not convert to a Cookie`)
  }
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const entry = (card: CookieCard, hpCards: GameCard[]): CookieInBattle => ({
  card,
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

describe('BS11-114 Pomegranate Cookie runtime', () => {
  it('pays one black hand card before opening the conditional draw', () => {
    const source = candidate('BS11-114', 'on-play')
    const discardCost = item('bs11-114:black-discard', 'black')
    const base = createBattleState()
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [source, discardCost, item('bs11-114:hand-1')],
          deck: Array.from({ length: 5 }, (_, index) => item(`bs11-114:deck-${index}`)),
        },
      },
    }

    let current = deployCookie(state, source.instanceId)
    current = applyGameCommand(current, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      discardHandIds: [discardCost.instanceId],
    })
    expect(current.pendingAbilityEffect).toMatchObject({ effectIndex: 0 })
    expect(current.players['player-two'].discardPile).toContainEqual(discardCost)

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [],
    })
    expect(current.pendingDrawUpTo).toMatchObject({ max: 2 })
  })

  it('opens the attack Then discard cost before selecting a named Cookie from trash', () => {
    const source = candidate('BS11-114', 'attack')
    const discardCost = item('bs11-114:attack-discard')
    const recoverable: CookieCard = {
      ...cookie('bs11-114:dark-enchantress'),
      name: 'Dark Enchantress Cookie',
      level: 3,
      hp: 6,
      energyColor: 'black',
    }
    const target = cookie('bs11-114:target', 1, 3)
    const attackEffects = convertOfficialAttackEffects(
      records.find((card) => card.cardNumber === 'BS11-114')!,
    )
    if (!attackEffects) throw new Error('BS11-114 attack effects must convert')

    const base = createBattleState()
    const battle: PendingBattle = {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: source.instanceId,
      targetInstanceId: target.instanceId,
      declaredDamage: 0,
      remainingDamage: 0,
      stage: 'attack-effect',
      trapUsed: true,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects,
      attackEffectIndex: 0,
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [entry(target, [item('bs11-114:target-hp-1'), item('bs11-114:target-hp-2'), item('bs11-114:target-hp-3')])],
        },
        'player-two': {
          ...base.players['player-two'],
          hand: [discardCost],
          battleArea: [entry(source, [item('bs11-114:source-hp-1'), item('bs11-114:source-hp-2')])],
          discardPile: [recoverable],
        },
      },
      pendingBattle: battle,
    }

    const opened = resolveAttackEffect(state, 'player-two', [])
    expect(opened.pendingOptionalCostAttack).toMatchObject({
      cost: { energy: {}, discardHand: 1 },
      effects: [{ kind: 'trash-to-hand', cardName: 'Dark Enchantress Cookie' }],
    })

    const paid = applyGameCommand(opened, {
      kind: 'resolve-optional-cost-attack',
      playerId: 'player-two',
      action: 'pay',
      paymentIds: [],
      discardCardIds: [discardCost.instanceId],
      targetIds: [recoverable.instanceId],
    })
    expect(paid.players['player-two'].hand).toContainEqual(recoverable)
    expect(paid.players['player-two'].discardPile).not.toContainEqual(recoverable)
  })
})
