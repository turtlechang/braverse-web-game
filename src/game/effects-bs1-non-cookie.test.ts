import { describe, expect, it } from 'vitest'
import {
  activateStage,
  createDemoGame,
  executeCardEffect,
  playItem,
  playTrap,
  type CardEffect,
  type CookieCard,
  type GameCard,
  type GameState,
} from '.'
import { GameRuleError } from './errors'

const makeItem = (id: string, effects: CardEffect[]): GameCard => ({
  id,
  instanceId: id,
  name: id,
  type: 'item',
  item: {
    cost: { energy: {}, discardHand: 0 },
    text: id,
    effects,
  },
})

const asMainPhase = (state: GameState): GameState => ({
  ...state,
  phase: 'main',
  activePlayerId: 'player-one',
})

describe('BS1 non-cookie effect execution', () => {
  it('pays support-to-hand item costs and marks support area as decreased', () => {
    const base = asMainPhase(createDemoGame())
    const supportCard = base.players['player-one'].deck[0]
    const item = makeItem('bs1-074', [{ kind: 'draw', amount: 1 }])
    item.item!.cost = { energy: {}, discardHand: 0, supportToHand: 1 }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [item],
          supportArea: [{ card: supportCard, rested: false }],
        },
      },
    }

    const paid = playItem(
      state,
      'player-one',
      item.instanceId,
      [],
      [],
      [supportCard.instanceId],
    )

    expect(paid.players['player-one'].supportArea).toHaveLength(0)
    expect(paid.players['player-one'].hand).toContainEqual(supportCard)
    expect(paid.supportAreaDecreasedThisTurn?.['player-one']).toBe(true)
  })

  it('places the source item into support as rested', () => {
    const base = asMainPhase(createDemoGame())
    const item = makeItem('bs1-075', [
      { kind: 'place-source-to-support', rested: true },
    ])
    const paid = playItem(
      {
        ...base,
        players: {
          ...base.players,
          'player-one': {
            ...base.players['player-one'],
            hand: [item],
          },
        },
      },
      'player-one',
      item.instanceId,
      [],
    )

    const resolved = executeCardEffect(
      paid,
      { sourcePlayerId: 'player-one', sourceInstanceId: item.instanceId },
      item.item!.effects[0],
      [],
    )

    expect(resolved.players['player-one'].discardPile).not.toContainEqual(item)
    expect(resolved.players['player-one'].supportArea).toContainEqual({
      card: item,
      rested: true,
    })
  })

  it('requires support area decrease before BS1-078 stage activation resolves', () => {
    const base = asMainPhase(createDemoGame())
    const supportCard = base.players['player-one'].deck[0]
    const stage: GameCard = {
      id: 'BS1-078',
      instanceId: 'bs1-078',
      name: 'Awakening Ancient Forest',
      type: 'stage',
      stageAbility: {
        placementCost: {},
        cost: { energy: {}, discardHand: 0 },
        text: 'BS1-078',
        restSource: true,
        effects: [
          {
            kind: 'set-active',
            supportCount: 1,
            condition: { kind: 'support-area-decreased-this-turn' },
          },
        ],
      },
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          stage: { card: stage, rested: false },
          supportArea: [{ card: supportCard, rested: true }],
        },
      },
    }

    expect(() => activateStage(state, 'player-one', [])).toThrow(GameRuleError)

    const activated = activateStage(
      {
        ...state,
        supportAreaDecreasedThisTurn: { 'player-one': true },
      },
      'player-one',
      [],
    )
    const resolved = executeCardEffect(
      activated,
      { sourcePlayerId: 'player-one', sourceInstanceId: stage.instanceId },
      stage.stageAbility!.effects[0],
      [],
    )

    expect(resolved.players['player-one'].supportArea[0].rested).toBe(false)
  })

  it('redirects an attack trap to another friendly cookie', () => {
    const base = createDemoGame()
    const defenderCookie = base.players['player-two'].battleArea[0]
    const redirectTarget: CookieCard = {
      ...defenderCookie.card,
      instanceId: 'redirect-target',
    }
    const trap: GameCard = {
      id: 'BS1-050',
      instanceId: 'bs1-050',
      name: 'Broken Signpost',
      type: 'trap',
      trap: {
        text: 'Redirect',
        cost: { energy: {}, discardHand: 0 },
        effects: [
          {
            kind: 'redirect-attack',
            target: { side: 'self', min: 1, max: 1 },
          },
        ],
      },
    }
    const state: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId:
          base.players['player-one'].battleArea[0].card.instanceId,
        targetInstanceId: defenderCookie.card.instanceId,
        declaredDamage: 1,
        remainingDamage: 1,
        stage: 'trap',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [trap],
          battleArea: [
            defenderCookie,
            {
              card: redirectTarget,
              hpCards: base.players['player-two'].deck.slice(0, 2),
              rested: false,
              battleEntryId: 'redirect-target:battle',
            },
          ],
        },
      },
    }

    const redirected = playTrap(state, 'player-two', {
      trapInstanceId: trap.instanceId,
      paymentIds: [],
      targetIds: [redirectTarget.instanceId],
    })

    expect(redirected.pendingBattle?.targetInstanceId).toBe(
      redirectTarget.instanceId,
    )
    expect(redirected.pendingBattle?.stage).toBe('damage')
  })
})
