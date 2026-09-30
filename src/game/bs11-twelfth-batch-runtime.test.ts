import { describe, expect, it } from 'vitest'
import bs11 from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { getAttackDamageAgainst } from './effects/combat'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import type { CookieInBattle, GameCard, GameState } from './types'

const records = bs11.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): GameCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-twelfth-runtime-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${cardNumber}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${cardNumber}:${suffix}` }
}

const entry = (
  card: GameCard,
  hpCards: GameCard[],
  rested = false,
): CookieInBattle => ({
  card: card as CookieInBattle['card'],
  hpCards,
  rested,
  battleEntryId: `${card.instanceId}:battle`,
})

const makeFlipState = (deck: GameCard[]): {
  state: GameState
  flip: GameCard
  bearer: GameCard
  attacker: GameCard
} => {
  const base = createBattleState()
  const flip = candidate('BS11-040', 'flip')
  const bearer = cookie('bs11-040-bearer', 1, 2)
  const attacker = cookie('bs11-040-attacker', 1, 1)
  return {
    state: {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [entry(bearer, [item('bs11-040-bearer-bottom'), flip])],
          hand: [],
          deck,
          discardPile: [],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [entry(attacker, [item('bs11-040-attacker-hp')])],
          supportArea: [{ card: item('bs11-040-attack-payment', 'red'), rested: false }],
        },
      },
    },
    flip,
    bearer,
    attacker,
  }
}

const beginFlip = (scenario: ReturnType<typeof makeFlipState>): GameState => {
  let state = applyGameCommand(scenario.state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: scenario.attacker.instanceId,
    targetInstanceId: scenario.bearer.instanceId,
    supportPaymentIds: ['bs11-040-attack-payment'],
  })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
  return applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-one' })
}

describe('BS11-040 to BS11-044 runtime boundaries', () => {
  it.each([0, 1])('BS11-040 resolves its real FLIP draw-up-to choice of %i', (drawCount) => {
    const deck = [item('bs11-040-draw-a'), item('bs11-040-draw-b')]
    const scenario = makeFlipState(deck)
    let state = beginFlip(scenario)
    expect(state.pendingBattle?.stage).toBe('flip')
    expect(state.pendingBattle?.revealedHpCard).toEqual(scenario.flip)

    state = applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-one',
      activate: true,
      discardHandIds: [],
    })
    expect(state.pendingDrawUpTo).toMatchObject({ playerId: 'player-one', max: 1 })

    state = applyGameCommand(state, {
      kind: 'resolve-draw-up-to',
      playerId: 'player-one',
      drawCount,
    })
    expect(state.pendingDrawUpTo ?? null).toBeNull()
    expect(state.players['player-one'].hand.map((card) => card.instanceId)).toEqual(
      drawCount === 0 ? [] : ['bs11-040-draw-a'],
    )
    expect(state.players['player-one'].deck.map((card) => card.instanceId)).toEqual(
      drawCount === 0 ? ['bs11-040-draw-a', 'bs11-040-draw-b'] : ['bs11-040-draw-b'],
    )
    expect(state.players['player-one'].discardPile).toContainEqual(scenario.flip)
    expect(state.pendingBattle).toBeNull()
  })

  it('BS11-041 returns one green support before granting HP to all own Cookies', () => {
    const base = createBattleState()
    const source = candidate('BS11-041', 'source')
    const ally = cookie('bs11-041-ally', 1, 2)
    const greenSupport = item('bs11-041-green-support', 'green')
    const redSupport = item('bs11-041-red-support', 'red')
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      skillUsesThisTurn: [],
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            entry(source, [item('bs11-041-source-hp-a'), item('bs11-041-source-hp-b')]),
            entry(ally, [item('bs11-041-ally-hp')]),
          ],
          hand: [],
          deck: [item('bs11-041-gain-source'), item('bs11-041-gain-ally')],
          supportArea: [
            { card: greenSupport, rested: false },
            { card: redSupport, rested: false },
          ],
        },
      },
    }

    expect(canActivateCookieSkill(state, 'player-one', source.instanceId, 'activate')).toBe(true)
    const paid = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
      supportToHandIds: [greenSupport.instanceId],
    })
    expect(paid.players['player-one'].hand).toContainEqual(greenSupport)
    expect(paid.players['player-one'].supportArea.map(({ card }) => card.instanceId)).toEqual([
      redSupport.instanceId,
    ])

    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [source.instanceId, ally.instanceId],
    })
    expect(resolved.players['player-one'].battleArea.map((cookieInBattle) => cookieInBattle.hpCards.length))
      .toEqual([3, 2])
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.skillUsesThisTurn).toContain(`${source.instanceId}:battle`)

    const wrongColor: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: [{ card: redSupport, rested: false }],
        },
      },
    }
    const snapshot = structuredClone(wrongColor)
    expect(canActivateCookieSkill(wrongColor, 'player-one', source.instanceId, 'activate')).toBe(false)
    expect(() => applyGameCommand(wrongColor, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'activate',
      paymentIds: [],
      supportToHandIds: [redSupport.instanceId],
    })).toThrow()
    expect(wrongColor).toEqual(snapshot)
  })

  it('BS11-042 opens its On Play choice and sets one rested support active', () => {
    const base = createBattleState()
    const source = candidate('BS11-042', 'source')
    const restedSupport = item('bs11-042-rested-support', 'green')
    const activeSupport = item('bs11-042-active-support', 'green')
    const state: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [source],
          battleArea: [],
          deck: [
            item('bs11-042-hp-a'),
            item('bs11-042-hp-b'),
            item('bs11-042-hp-c'),
            item('bs11-042-hp-d'),
            item('bs11-042-deck-reserve'),
          ],
          supportArea: [
            { card: restedSupport, rested: true },
            { card: activeSupport, rested: false },
          ],
        },
      },
    }

    const entered = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: source.instanceId,
    })
    expect(entered.pendingOnPlay).toMatchObject({ sourceInstanceId: source.instanceId, origin: 'hand' })
    const opened = applyGameCommand(entered, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })
    const resolved = applyGameCommand(opened, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [restedSupport.instanceId],
    })
    expect(resolved.players['player-one'].supportArea.map(({ card, rested }) => ({
      id: card.instanceId,
      rested,
    }))).toEqual([
      { id: restedSupport.instanceId, rested: false },
      { id: activeSupport.instanceId, rested: false },
    ])
    expect(resolved.pendingOnPlay ?? null).toBeNull()
    expect(resolved.pendingAbilityEffect).toBeUndefined()
  })

  it('BS11-044 grants its attack bonus exactly at seven support cards', () => {
    const makeState = (supportCount: number): { state: GameState; source: GameCard; target: GameCard } => {
      const base = createBattleState()
      const source = candidate('BS11-044', `source-${supportCount}`)
      const target = cookie(`bs11-044-target-${supportCount}`, 1, 3)
      return {
        state: {
          ...base,
          activePlayerId: 'player-one',
          players: {
            ...base.players,
            'player-one': {
              ...base.players['player-one'],
              battleArea: [entry(source, [item(`bs11-044-source-hp-${supportCount}`)])],
              supportArea: Array.from({ length: supportCount }, (_, index) => ({
                card: item(`bs11-044-support-${supportCount}-${index}`, 'green'),
                rested: false,
              })),
            },
            'player-two': {
              ...base.players['player-two'],
              battleArea: [entry(target, [
                item(`bs11-044-target-hp-${supportCount}-a`),
                item(`bs11-044-target-hp-${supportCount}-b`),
                item(`bs11-044-target-hp-${supportCount}-c`),
              ])],
            },
          },
        },
        source,
        target,
      }
    }

    for (const supportCount of [6, 7]) {
      const { state, source, target } = makeState(supportCount)
      expect(getAttackDamageAgainst(state, source.instanceId, target.instanceId)).toBe(
        supportCount >= 7 ? 3 : 2,
      )
    }
  })
})
