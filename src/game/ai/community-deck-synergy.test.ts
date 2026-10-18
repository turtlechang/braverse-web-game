import { describe, expect, it } from 'vitest'
import { COMMUNITY_DECK_PRESETS } from '../community-deck-recipes'
import { takeAiStep } from '../ai'
import { createCustomDeckMatch } from '../tournament'

const cookierift506LicoriceFixture = () => {
  const recipe = COMMUNITY_DECK_PRESETS['cookierift-506']
  const deck = {
    ...recipe,
    id: 'cookierift-506',
    format: 'standard' as const,
    color: 'black' as const,
    createdAt: '2026-10-10',
    updatedAt: '2026-10-10',
  }
  const state = createCustomDeckMatch(506, deck, deck, 'player-one')
  const player = state.players['player-one']

  // The accepted recipe supplies real copies and HP cards. Move one Venom Dough
  // into hand, then add a full-health Mold Dough so both battle slots are full.
  const venomIndex = player.deck.findIndex((card) => card.id === 'BS11-113')
  expect(venomIndex).toBeGreaterThanOrEqual(0)
  const venom = player.deck.splice(venomIndex, 1)[0]!
  const exchangeIndex = player.hand.findIndex((card) => card.id !== 'BS11-092')
  expect(exchangeIndex).toBeGreaterThanOrEqual(0)
  const exchanged = player.hand.splice(exchangeIndex, 1)[0]!
  player.deck.push(exchanged)
  player.hand.push(venom)

  const moldIndex = player.deck.findIndex((card) => card.id === 'BS11-111')
  expect(moldIndex).toBeGreaterThanOrEqual(0)
  const mold = player.deck.splice(moldIndex, 1)[0]!
  expect(mold.type).toBe('cookie')
  if (mold.type !== 'cookie') throw new Error('Expected a real Mold Dough Cookie.')
  const moldHp = player.deck.splice(0, mold.hp)
  expect(moldHp).toHaveLength(mold.hp)
  player.battleArea.push({
    card: mold,
    hpCards: moldHp,
    rested: false,
    battleEntryId: `${mold.instanceId}:battle:${state.nextBattleEntrySequence}`,
    enteredFrom: 'hand',
    enteredTurn: 2,
  })
  state.nextBattleEntrySequence += 1
  state.phase = 'main'
  state.activePlayerId = 'player-one'
  // Player one is the first player, so its next active turn has odd parity.
  state.turnNumber = 3

  return { state, licorice: player.battleArea.find((cookie) => cookie.card.id === 'BS11-092')!, venom }
}

describe('Cookierift #506 Licorice and Special Play synergy', () => {
  it.each([3, 4, 5] as const)(
    'Lv.%s lowers Licorice, spends it for Venom Dough, then resolves its draw',
    (level) => {
      const { state: initialState, licorice, venom } = cookierift506LicoriceFixture()
      const before = structuredClone(initialState)
      expect(initialState.players['player-one'].battleArea).toHaveLength(2)
      expect(initialState.players['player-one'].battleArea.every((cookie) => cookie.card.level === 2))
        .toBe(true)
      expect(initialState.players['player-one'].hand.map((card) => card.id)).toContain('BS11-113')

      let state = initialState
      let memory: NonNullable<Parameters<typeof takeAiStep>[2]>['memory']
      const decide = () => {
        const decision = takeAiStep(state, 'player-one', {
          level,
          seed: 20261015,
          searchNow: () => 0,
          memory,
        })
        state = decision.state
        memory = decision.reason?.strategyMemory ?? memory
        return decision
      }

      const activateLicorice = decide()
      expect(activateLicorice.action).toBe('activate-skill')
      if (level === 3) {
        expect(activateLicorice.reason?.actionScore?.contributions).toContainEqual(
          expect.objectContaining({ id: 'legal-action-followup', amount: expect.any(Number) }),
        )
      }
      expect(activateLicorice.state.commandLog?.at(-1)?.payload).toMatchObject({
        kind: 'activate-skill',
        sourceInstanceId: licorice.card.instanceId,
        trigger: 'activate',
      })
      expect(state.players['player-one'].battleArea.find(
        (cookie) => cookie.card.instanceId === licorice.card.instanceId,
      )?.levelOverride).toBe(1)
      expect(initialState).toEqual(before)

      const specialPlay = decide()
      expect(specialPlay.action).toBe('deploy-cookie')
      expect(specialPlay.state.commandLog?.at(-1)?.payload).toMatchObject({
        kind: 'deploy-cookie',
        instanceId: venom.instanceId,
        specialPlayCookieInstanceIds: [licorice.card.instanceId],
      })
      expect(state.cookiesPlayedViaSpecialPlayThisTurn?.['player-one']).toBe(true)
      expect(state.players['player-one'].battleArea.map((cookie) => cookie.card.id))
        .toEqual(['BS11-111', 'BS11-113'])

      const resolveOnPlay = decide()
      expect(resolveOnPlay.action).toBe('activate-skill')
      expect(resolveOnPlay.state.commandLog?.at(-1)?.payload).toMatchObject({
        kind: 'activate-skill',
        sourceInstanceId: venom.instanceId,
        trigger: 'on-play',
      })

      const draw = decide()
      expect(draw.state.commandLog?.at(-1)?.payload).toMatchObject({
        kind: 'resolve-draw-up-to',
        drawCount: 2,
      })
      expect(state.players['player-one'].hand).toHaveLength(6)
      expect(state.players['player-one'].deck).toHaveLength(39)
    },
  )
})
