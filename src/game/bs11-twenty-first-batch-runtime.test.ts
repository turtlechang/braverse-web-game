import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { resolveAttackEffect } from './battle'
import { applyGameCommand } from './commands'
import { deployCookie } from './actions'
import { executeCardEffect, isEffectConditionMet } from './effects'
import { getEffectiveAttack } from './effects/combat'
import { canActivateCookieSkill } from './skills'
import { createBattleState, item } from './test-helpers/battle-helpers'
import type {
  CookieCard,
  CookieInBattle,
  GameCard,
  GameState,
} from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(
    record,
    `bs11-twenty-first-${suffix}`,
  )
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber}: ${result.reason}`)
  }
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const cookieEntry = (card: GameCard, hpCards: GameCard[]): CookieInBattle => {
  if (card.type !== 'cookie') throw new Error(`Expected Cookie: ${card.name}`)
  return {
    card: card as CookieCard,
    hpCards,
    rested: false,
    battleEntryId: `${card.instanceId}:battle`,
  }
}

const fillerDeck = (prefix: string, count = 20): GameCard[] =>
  Array.from({ length: count }, (_, index) => item(`${prefix}:${index}`, 'purple'))

const identityShuffle = (cards: GameCard[]): GameCard[] => cards

describe('BS11-084 to BS11-088 runtime', () => {
  it('keeps BS11-084 trap activation available before Refresh while gating only its draw', () => {
    const base = createBattleState()
    const trap = candidate('BS11-084', 'trap')
    if (trap.type !== 'trap' || !trap.trap) throw new Error('BS11-084 must convert to a Trap')

    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: trap.instanceId,
      sourceCardName: trap.name,
    }
    const [attackReduction, refreshDraw] = trap.trap.effects

    const reduced = executeCardEffect(base, context, attackReduction, ['attacker'])
    expect(getEffectiveAttack(reduced, 'attacker')).toBe(2)
    expect(() => executeCardEffect(base, context, refreshDraw, [])).toThrow()

    const afterRefresh = executeCardEffect(
      { ...base, refreshedDuringGame: { 'player-one': true } },
      context,
      refreshDraw,
      [],
    )
    expect(afterRefresh.pendingDrawUpTo).toMatchObject({
      playerId: 'player-one',
      max: 1,
    })
  })

  it('BS11-085 pays by trashing itself and only trashes a purple Cookie up to LV.2', () => {
    const base = createBattleState()
    const source = candidate('BS11-085', 'source')
    const lowTarget = candidate('BS11-086', 'low-target')
    const highTarget = candidate('BS11-087', 'high-target')
    if (source.type !== 'cookie' || lowTarget.type !== 'cookie' || highTarget.type !== 'cookie') {
      throw new Error('BS11-085 runtime fixtures must all be Cookies')
    }

    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            cookieEntry(source, [item('bs11-085:source-hp-1'), item('bs11-085:source-hp-2')]),
            cookieEntry(lowTarget, [item('bs11-085:low-hp-1'), item('bs11-085:low-hp-2')]),
            cookieEntry(highTarget, fillerDeck('bs11-085:high-hp', 4)),
          ],
          supportArea: [{ card: item('bs11-085:payment', 'purple'), rested: false }],
          deck: fillerDeck('bs11-085:deck'),
        },
      },
    }

    const resolved = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: ['bs11-085:payment'],
      targetIds: [lowTarget.instanceId],
    })
    const player = resolved.players['player-two']
    expect(player.battleArea.map((cookie) => cookie.card.instanceId)).toEqual([
      highTarget.instanceId,
    ])
    expect(player.discardPile.map((card) => card.instanceId)).toEqual([
      source.instanceId,
      'bs11-085:source-hp-1',
      'bs11-085:source-hp-2',
      lowTarget.instanceId,
      'bs11-085:low-hp-1',
      'bs11-085:low-hp-2',
    ])
    expect(player.supportArea[0].rested).toBe(true)
    expect(resolved.pendingAbilityEffect).toBeUndefined()
  })

  it('BS11-086 attacks can play BS11-087 from trash, and its +2 HP is trash-origin only', () => {
    const base = createBattleState()
    const attacker = candidate('BS11-086', 'attacker')
    const darkCacao = candidate('BS11-087', 'dark-cacao')
    if (attacker.type !== 'cookie' || !attacker.attackEffects || darkCacao.type !== 'cookie') {
      throw new Error('BS11-086/087 runtime fixtures are invalid')
    }
    const defender = cookieEntry(
      base.players['player-one'].battleArea[0].card,
      [item('bs11-086:defender-hp-1'), item('bs11-086:defender-hp-2')],
    )
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [defender],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [cookieEntry(attacker, [item('bs11-086:attacker-hp')])],
          discardPile: [darkCacao],
          deck: fillerDeck('bs11-086:deck'),
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: attacker.instanceId,
        targetInstanceId: defender.card.instanceId,
        declaredDamage: attacker.attack,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: attacker.attackEffects,
        attackEffectIndex: 0,
      },
    }

    const playedFromTrash = resolveAttackEffect(
      state,
      'player-two',
      [darkCacao.instanceId],
    )
    expect(playedFromTrash.pendingOnPlay).toEqual({
      playerId: 'player-two',
      sourceInstanceId: darkCacao.instanceId,
      origin: 'trash',
    })

    const resolvedTrashOnPlay = applyGameCommand(playedFromTrash, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: darkCacao.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      targetIds: [],
    })
    const entered = resolvedTrashOnPlay.players['player-two'].battleArea.find(
      (cookie) => cookie.card.instanceId === darkCacao.instanceId,
    )
    expect(entered?.hpCards).toHaveLength(darkCacao.hp + 2)
    expect(resolvedTrashOnPlay.pendingOnPlay).toBeNull()
    expect(resolvedTrashOnPlay.pendingAbilityEffect).toBeUndefined()

    const handState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [darkCacao],
          deck: fillerDeck('bs11-087:hand-deck'),
        },
      },
    }
    const playedFromHand = deployCookie(handState, darkCacao.instanceId)
    expect(canActivateCookieSkill(
      playedFromHand,
      'player-two',
      darkCacao.instanceId,
      'on-play',
    )).toBe(false)
    expect(() => applyGameCommand(playedFromHand, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: darkCacao.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      targetIds: [],
    })).toThrow()
    const skipped = applyGameCommand(playedFromHand, {
      kind: 'skip-on-play',
      playerId: 'player-two',
      sourceInstanceId: darkCacao.instanceId,
    })
    expect(skipped.pendingOnPlay).toBeNull()
    expect(skipped.players['player-two'].battleArea.find(
      (cookie) => cookie.card.instanceId === darkCacao.instanceId,
    )?.hpCards).toHaveLength(darkCacao.hp)
  })

  it('BS11-087 attack Then uses either another Ancient Cookie or the 15-card trash threshold', () => {
    const base = createBattleState()
    const source = candidate('BS11-087', 'condition-source')
    const otherAncient = candidate('BS11-087', 'condition-other')
    if (source.type !== 'cookie' || !source.attackEffects || otherAncient.type !== 'cookie') {
      throw new Error('BS11-087 runtime fixture is invalid')
    }
    const context = {
      sourcePlayerId: 'player-two' as const,
      sourceInstanceId: source.instanceId,
      sourceCardName: source.name,
    }
    const effect = source.attackEffects[0]
    const hand = [item('bs11-087:opponent-hand-a'), item('bs11-087:opponent-hand-b')]
    const makeState = (trashCount: number, includeOtherAncient: boolean): GameState => ({
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand,
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            cookieEntry(source, fillerDeck('bs11-087:source-hp', source.hp)),
            ...(includeOtherAncient
              ? [cookieEntry(otherAncient, fillerDeck('bs11-087:other-hp', otherAncient.hp))]
              : []),
          ],
          discardPile: fillerDeck('bs11-087:trash', trashCount),
        },
      },
    })

    const byAncient = executeCardEffect(
      makeState(14, true),
      context,
      effect,
      [],
      identityShuffle,
    )
    expect(byAncient.players['player-one'].hand).toHaveLength(1)

    const byTrashThreshold = executeCardEffect(
      makeState(15, false),
      context,
      effect,
      [],
      identityShuffle,
    )
    expect(byTrashThreshold.players['player-one'].hand).toHaveLength(1)

    const belowThreshold = makeState(14, false)
    expect(isEffectConditionMet(belowThreshold, context, effect)).toBe(false)
    expect(() => executeCardEffect(
      belowThreshold,
      context,
      effect,
      [],
      identityShuffle,
    )).toThrow()
  })

  it('BS11-088 pays one purple LV.1 Cookie and recovers only a purple Cookie LV.2 or higher', () => {
    const base = createBattleState()
    const moonlight = candidate('BS11-088', 'moonlight')
    const paymentCookie = candidate('BS11-086', 'payment-cookie')
    const recovered = candidate('BS11-087', 'recoverable')
    const tooLow = candidate('BS11-085', 'too-low')
    if (
      moonlight.type !== 'cookie' ||
      paymentCookie.type !== 'cookie' ||
      recovered.type !== 'cookie' ||
      tooLow.type !== 'cookie'
    ) {
      throw new Error('BS11-088 runtime fixtures must all be Cookies')
    }

    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [moonlight],
          battleArea: [cookieEntry(paymentCookie, [item('bs11-088:payment-hp-1'), item('bs11-088:payment-hp-2')])],
          discardPile: [recovered, tooLow],
          deck: fillerDeck('bs11-088:deck'),
        },
      },
    }
    const onPlay = deployCookie(state, moonlight.instanceId)
    expect(onPlay.pendingOnPlay).toMatchObject({
      sourceInstanceId: moonlight.instanceId,
      origin: 'hand',
    })

    expect(() => applyGameCommand(onPlay, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: moonlight.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      trashBattleCookieIds: [paymentCookie.instanceId],
      targetIds: [tooLow.instanceId],
    })).toThrow()

    const resolved = applyGameCommand(onPlay, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: moonlight.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      trashBattleCookieIds: [paymentCookie.instanceId],
      targetIds: [recovered.instanceId],
    })
    const player = resolved.players['player-two']
    expect(player.battleArea.map((cookie) => cookie.card.instanceId)).toEqual([
      moonlight.instanceId,
    ])
    expect(player.hand.map((card) => card.instanceId)).toContain(recovered.instanceId)
    expect(player.discardPile.map((card) => card.instanceId)).toContain(tooLow.instanceId)
    expect(player.discardPile.map((card) => card.instanceId)).toContain(paymentCookie.instanceId)
    expect(resolved.pendingOnPlay).toBeNull()
    expect(resolved.pendingAbilityEffect).toBeUndefined()
  })
})
