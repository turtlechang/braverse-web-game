import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { canSpecialPlayCookie, deployCookie } from './actions'
import { applyGameCommand } from './commands'
import { getTrashBattleCookieCostCandidates } from './skills'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'
import type { AbilityCost, CookieCard, CookieInBattle, GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string, suffix: string): CookieCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-twenty-seventh-${suffix}`)
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

describe('BS11-115 multi-cookie Special Play runtime', () => {
  it('only accepts black LV.2 Cookies that have Special Play', () => {
    const source = candidate('BS11-115', 'source')
    const eligible = candidate('BS11-111', 'eligible')
    const ineligible = {
      ...cookie('bs11-115:ineligible', 2, 4),
      energyColor: 'black' as const,
    }
    const cost = source.skill?.specialPlayCost
    if (!cost) throw new Error('BS11-115 Special Play cost must convert')

    expect(cost.trashBattleCookie?.hasSpecialPlay).toBe(true)
    expect(getTrashBattleCookieCostCandidates(
      cost,
      [entry(eligible, []), entry(ineligible, [])],
    ).map((candidateCookie) => candidateCookie.card.instanceId)).toEqual([
      eligible.instanceId,
    ])
  })

  it('trashes exactly two eligible Cookies before deploying Dark Enchantress', () => {
    const base = createBattleState()
    const source = candidate('BS11-115', 'source')
    const sacrificeA = candidate('BS11-111', 'sacrifice-a')
    const sacrificeB = candidate('BS11-112', 'sacrifice-b')
    const sourceHp = [item('bs11-115:source-hp-1'), item('bs11-115:source-hp-2')]
    const sacrificeAHp = [item('bs11-115:sacrifice-a-hp')]
    const sacrificeBHp = [item('bs11-115:sacrifice-b-hp')]
    const state: GameState = {
      ...base,
      activePlayerId: 'player-two',
      phase: 'main',
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [source],
          battleArea: [
            entry(sacrificeA, sacrificeAHp),
            entry(sacrificeB, sacrificeBHp),
          ],
          deck: [sourceHp[0]!, sourceHp[1]!, item('bs11-115:deck-tail')],
        },
      },
    }

    expect(canSpecialPlayCookie(state, 'player-two', source.instanceId)).toBe(true)

    const next = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-two',
      instanceId: source.instanceId,
      specialPlayCookieInstanceIds: [sacrificeA.instanceId, sacrificeB.instanceId],
    })
    const player = next.players['player-two']

    expect(player.battleArea.map((cookieInBattle) => cookieInBattle.card.instanceId))
      .toEqual([source.instanceId])
    expect(player.discardPile.map((card) => card.instanceId)).toEqual([
      sacrificeA.instanceId,
      sacrificeB.instanceId,
      ...sacrificeAHp.map((card) => card.instanceId),
      ...sacrificeBHp.map((card) => card.instanceId),
    ])
    expect(next.departedCookieCounts['player-two']).toBe(2)
    expect(next.pendingOnPlay).toEqual({
      playerId: 'player-two',
      sourceInstanceId: source.instanceId,
      origin: 'hand',
    })
  })

  it('rejects an incomplete multi-cookie Special Play selection', () => {
    const source = candidate('BS11-115', 'incomplete-source')
    const sacrifice = candidate('BS11-111', 'incomplete-sacrifice')
    const base = createBattleState()
    const state: GameState = {
      ...base,
      activePlayerId: 'player-two',
      phase: 'main',
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          hand: [source],
          battleArea: [entry(sacrifice, [])],
        },
      },
    }

    expect(canSpecialPlayCookie(state, 'player-two', source.instanceId)).toBe(false)
    expect(() => deployCookie(
      state,
      source.instanceId,
      [sacrifice.instanceId],
    )).toThrow()
  })

  it('keeps the multi-card restriction expressible as a shared AbilityCost', () => {
    const cost: AbilityCost = {
      energy: {},
      trashBattleCookie: {
        count: 2,
        level: 2,
        energyColor: 'black',
        hasSpecialPlay: true,
      },
    }
    expect(cost.trashBattleCookie?.count).toBe(2)
  })
})
