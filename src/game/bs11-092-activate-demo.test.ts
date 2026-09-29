import { describe, expect, it } from 'vitest'
import { canSpecialPlayCookie } from './actions'
import { applyGameCommand } from './commands'
import {
  createBs11092ActivateDemoState,
  parseTestStateConfig,
} from './demo'

describe('BS11-092 Activate Browser fixtures', () => {
  it.each([true, false])('keeps printed LV while representing once-per-turn used=%s', (alreadyUsed) => {
    expect(parseTestStateConfig(`?test-state=bs11-092-activate:${alreadyUsed ? 'negative' : 'positive'}`, 'localhost'))
      .toEqual({ kind: 'bs11-092-activate', alreadyUsed })
    const state = createBs11092ActivateDemoState(alreadyUsed)
    const source = state.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS11-092')
    if (!source) throw new Error('Licorice fixture source missing')
    if (!source.battleEntryId) throw new Error('Licorice fixture battle identity missing')
    expect(source?.card.level).toBe(2)
    expect(source?.levelOverride).toBe(alreadyUsed ? 1 : undefined)
    expect(state.skillUsesThisTurn?.includes(source.battleEntryId)).toBe(alreadyUsed)
  })

  it('offers black LV.2 BS11-111 after Licorice becomes LV.1, then pays and opens On Play', () => {
    const beforeActivate = createBs11092ActivateDemoState(false)
    const state = createBs11092ActivateDemoState(true)
    const player = state.players['player-one']
    const licorice = player.battleArea.find((entry) => entry.card.id === 'BS11-092')
    const candidate = player.hand.find((card) => card.instanceId === 'bs11-092-special-play-hand')

    if (!licorice) throw new Error('Licorice fixture source missing')
    if (!candidate || candidate.type !== 'cookie') throw new Error('BS11-111 Special Play hand candidate missing')

    expect(candidate).toMatchObject({
      id: 'BS11-111',
      level: 2,
      energyColor: 'black',
      skill: { specialPlayCost: { trashBattleCookie: { count: 1, level: 1, energyColor: 'black' } } },
    })
    expect(beforeActivate.players['player-one'].battleArea.map((entry) => entry.card.energyColor))
      .toEqual(['black', 'red'])
    expect(canSpecialPlayCookie(beforeActivate, 'player-one', candidate.instanceId)).toBe(false)
    expect(licorice.levelOverride).toBe(1)
    expect(canSpecialPlayCookie(state, 'player-one', candidate.instanceId)).toBe(true)

    const deployed = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: candidate.instanceId,
      specialPlayCookieInstanceIds: [licorice.card.instanceId],
    })

    expect(deployed.players['player-one'].battleArea.map((entry) => entry.card.id))
      .toContain('BS11-111')
    expect(deployed.players['player-one'].discardPile.map((card) => card.instanceId))
      .toContain(licorice.card.instanceId)
    expect(deployed.pendingOnPlay).toMatchObject({
      playerId: 'player-one',
      sourceInstanceId: candidate.instanceId,
      origin: 'hand',
    })
  })
})
