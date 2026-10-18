import { describe, expect, it } from 'vitest'
import {
  getActingPlayerId,
  getAttackDamageAgainst,
  createCustomDeckMatch,
  isEffectConditionMet,
  simulateAiMatchDetailed,
  selectEnergyPayment,
  takeAiStep,
  type AiStrategyMemory,
  type SwissRosterDeck,
} from '..'
import { BS12_DECK_PRESETS } from '../bs12-deck-recipes'
import { COMMUNITY_DECK_PRESETS, type CommunityDeckChoice } from '../community-deck-recipes'

const communityColors = {
  'cookierift-801': 'green',
  'cookierift-1164': 'blue',
  'cookierift-927': 'green',
  'cookierift-1239': 'yellow',
  'cookierift-1035': 'yellow',
  'cookierift-973': 'green',
  'cookierift-1151': 'purple',
  'cookierift-568': 'purple',
  'cookierift-793': 'red',
} as const

const communityDeck = (choice: keyof typeof communityColors): SwissRosterDeck => {
  const recipe = COMMUNITY_DECK_PRESETS[choice as CommunityDeckChoice]
  return {
    id: choice,
    name: recipe.name,
    entries: recipe.entries,
    extraDeckEntries: recipe.extraDeckEntries,
    color: communityColors[choice],
    format: 'standard',
    createdAt: '2026-10-16',
    updatedAt: '2026-10-16',
  }
}

const greenArenaDeck: SwissRosterDeck = {
  ...BS12_DECK_PRESETS['bs12-green-arena'],
  id: 's3-defense-green',
  color: 'green',
  format: 'standard',
  createdAt: '2026-10-09',
  updatedAt: '2026-10-09',
}

const blueArenaDeck: SwissRosterDeck = {
  ...BS12_DECK_PRESETS['bs12-blue-arena'],
  id: 's3-defense-blue',
  color: 'blue',
  format: 'standard',
  createdAt: '2026-10-09',
  updatedAt: '2026-10-09',
}

const blackArenaDeck: SwissRosterDeck = {
  ...BS12_DECK_PRESETS['bs12-black-arena'],
  id: 's3-defense-black',
  color: 'black',
  format: 'standard',
  createdAt: '2026-10-09',
  updatedAt: '2026-10-09',
}

describe('AI community-deck benchmark failure seeds', () => {
  it('keeps BS10-119 when its Refresh condition is false and its equip Then cannot be paid', () => {
    const seed = 206043600
    let state = createCustomDeckMatch(
      seed,
      blackArenaDeck,
      communityDeck('cookierift-1151'),
      'player-one',
    )
    const memories: Partial<Record<'player-one' | 'player-two', AiStrategyMemory>> = {}

    for (let index = 0; index <= 163; index += 1) {
      const actor = getActingPlayerId(state)
      if (index === 163) {
        expect(actor).toBe('player-two')
        expect(state.turnNumber).toBe(12)
        expect(state.phase).toBe('main')
        const player = state.players[actor]
        const item = player.hand.find(card => card.id === 'BS10-119')
        expect(item?.item).toBeDefined()
        if (!item?.item) throw new Error('Expected printed BS10-119 in the real #1151 hand')
        const gatedDamage = item.item.effects.find(effect =>
          effect.kind === 'damage' && effect.condition?.kind === 'refreshed-during-game',
        )
        expect(gatedDamage?.kind).toBe('damage')
        if (gatedDamage?.kind !== 'damage') throw new Error('Expected Refresh-gated printed damage')
        expect(isEffectConditionMet(state, {
          sourcePlayerId: actor,
          sourceInstanceId: item.instanceId,
        }, gatedDamage)).toBe(false)

        const optionalEquip = item.item.effects.find(effect => effect.kind === 'optional-cost-attack')
        expect(optionalEquip?.kind).toBe('optional-cost-attack')
        if (optionalEquip?.kind !== 'optional-cost-attack') {
          throw new Error('Expected printed optional equip Then')
        }
        const readySupports = player.supportArea.filter(support => !support.rested)
        expect(readySupports).toHaveLength(1)
        const itemPaymentIds = selectEnergyPayment(item.item.cost.energy ?? item.item.cost, player.supportArea)
        expect(itemPaymentIds).not.toBeNull()
        if (!itemPaymentIds) throw new Error('Expected the printed item cost to be payable')
        const supportsAfterItemPayment = player.supportArea.filter(support =>
          !itemPaymentIds.includes(support.card.instanceId),
        )
        expect(selectEnergyPayment(optionalEquip.cost.energy ?? optionalEquip.cost, supportsAfterItemPayment))
          .toBeNull()
        expect(player.battleArea.some(cookie => cookie.card.id === 'BS10-122')).toBe(false)

        const next = takeAiStep(state, actor, {
          level: 5,
          seed,
          searchNow: () => 0,
          memory: memories[actor],
        })
        const itemCommand = next.state.commandLog
          ?.slice(state.commandLog?.length ?? 0)
          .find(entry => entry.commandKind === 'play-item')?.payload
        expect(itemCommand?.kind).not.toBe('play-item')
        expect(next.state.players[actor].hand.some(card => card.instanceId === item.instanceId)).toBe(true)
        return
      }

      const next = takeAiStep(state, actor, {
        level: 5,
        seed,
        searchNow: () => 0,
        memory: memories[actor],
      })
      if (next.action === 'error' || next.state === state) {
        throw new Error(next.error ?? `No progress before Light of Silence decision: ${next.description}`)
      }
      if (next.reason?.strategyMemory) memories[actor] = next.reason.strategyMemory
      state = next.state
    }

    throw new Error('The original #1151 seed did not reach the Light of Silence decision')
  }, 30000)

  it('uses ST3-019 on the original terminal-loss seed instead of conceding the last Cookie', () => {
    const seed = 204512100
    let state = createCustomDeckMatch(
      seed,
      greenArenaDeck,
      communityDeck('cookierift-1151'),
      'player-one',
    )
    const memories: Partial<Record<'player-one' | 'player-two', AiStrategyMemory>> = {}

    for (let index = 0; index < 40; index += 1) {
      const actor = getActingPlayerId(state)
      if (state.pendingBattle?.stage === 'trap' && actor === 'player-one') {
        const defender = state.players['player-one']
        const trap = defender.hand.find(card => card.id === 'ST3-019')
        expect(trap).toBeDefined()
        expect(defender.battleArea).toHaveLength(1)
        expect(defender.battleArea[0].hpCards).toHaveLength(1)

        const next = takeAiStep(state, actor, {
          level: 5,
          seed,
          searchNow: () => 0,
          memory: memories[actor],
        })
        const command = next.state.commandLog
          ?.slice(state.commandLog?.length ?? 0)
          .find(entry => entry.commandKind === 'play-trap')?.payload
        expect(command?.kind).toBe('play-trap')
        if (command?.kind !== 'play-trap') throw new Error('Expected the saving trap command')
        expect(command.trapInstanceId).toBe(trap!.instanceId)
        expect(command.targetIds).toEqual([state.pendingBattle.attackerInstanceId])
        expect(getAttackDamageAgainst(
          next.state,
          state.pendingBattle.attackerInstanceId,
          state.pendingBattle.targetInstanceId,
        )).toBe(0)
        expect(next.state.players['player-one'].battleArea).toHaveLength(1)
        return
      }

      const next = takeAiStep(state, actor, {
        level: 5,
        seed,
        searchNow: () => 0,
        memory: memories[actor],
      })
      if (next.action === 'error' || next.state === state) {
        throw new Error(next.error ?? `No progress before the terminal trap: ${next.description}`)
      }
      if (next.reason?.strategyMemory) memories[actor] = next.reason.strategyMemory
      state = next.state
    }

    throw new Error('The original seed did not reach its terminal trap decision')
  }, 30000)

  it('uses Cookie Windmill only when its attack reduction prevents the current knockout', () => {
    const seed = 204512101
    let state = createCustomDeckMatch(
      seed,
      greenArenaDeck,
      communityDeck('cookierift-1151'),
      'player-one',
    )
    const memories: Partial<Record<'player-one' | 'player-two', AiStrategyMemory>> = {}
    let skippedIneffectiveWindmill = false

    for (let index = 0; index < 500 && state.status !== 'finished'; index += 1) {
      const actor = getActingPlayerId(state)
      const battle = state.pendingBattle
      const windmill = state.players['player-one'].hand.find(card => card.id === 'BS7-064')
      const defender = battle?.stage === 'trap' && battle.defenderPlayerId === 'player-one'
        ? state.players['player-one'].battleArea.find(
            cookie => cookie.card.instanceId === battle.targetInstanceId,
          )
        : undefined

      if (actor === 'player-one' && battle?.stage === 'trap' && windmill && defender) {
        const windmillModifier = windmill.trap?.effects.find(
          effect => effect.kind === 'modify-attack' && effect.target.side === 'opponent',
        )
        expect(windmillModifier?.kind).toBe('modify-attack')
        if (windmillModifier?.kind !== 'modify-attack') {
          throw new Error('Cookie Windmill must have its printed attack modifier')
        }

        const currentDamage = getAttackDamageAgainst(
          state,
          battle.attackerInstanceId,
          battle.targetInstanceId,
        )

        if (
          defender.card.id === 'BS7-062' &&
          battle.attackerInstanceId === 'player-two-BS11-076-1' &&
          battle.targetInstanceId === 'player-one-BS7-062-1'
        ) {
          expect(currentDamage).toBe(2)
          expect(defender.hpCards).toHaveLength(1)
          expect(currentDamage + windmillModifier.amount).toBeGreaterThanOrEqual(
            defender.hpCards.length,
          )
          expect(state.players['player-one'].supportArea.filter(support => !support.rested))
            .toHaveLength(2)

          const next = takeAiStep(state, actor, {
            level: 5,
            seed,
            searchNow: () => 0,
            memory: memories[actor],
          })
          const command = next.state.commandLog
            ?.slice(state.commandLog?.length ?? 0)
            .find(entry => entry.commandKind === 'play-trap' || entry.commandKind === 'skip-trap')
          expect(command?.commandKind).toBe('skip-trap')
          expect(next.state.players['player-one'].hand).toContainEqual(windmill)
          if (next.reason?.strategyMemory) memories[actor] = next.reason.strategyMemory
          state = next.state
          skippedIneffectiveWindmill = true
          continue
        }

        const attacker = state.players['player-two'].battleArea.find(
          cookie => cookie.card.instanceId === battle.attackerInstanceId,
        )
        if (defender.card.id === 'P-113' && attacker?.card.id === 'ST10-002') {
          expect(skippedIneffectiveWindmill).toBe(true)
          expect(currentDamage).toBe(3)
          expect(defender.hpCards).toHaveLength(3)
          expect(currentDamage + windmillModifier.amount).toBe(2)
          expect(state.players['player-one'].supportArea.filter(support => !support.rested))
            .toHaveLength(2)

          const next = takeAiStep(state, actor, {
            level: 5,
            seed,
            searchNow: () => 0,
            memory: memories[actor],
          })
          const command = next.state.commandLog
            ?.slice(state.commandLog?.length ?? 0)
            .find(entry => entry.commandKind === 'play-trap' || entry.commandKind === 'skip-trap')
            ?.payload
          expect(command?.kind).toBe('play-trap')
          if (command?.kind !== 'play-trap') {
            throw new Error('Expected Cookie Windmill to save the 3 HP Cookie')
          }
          expect(command.trapInstanceId).toBe(windmill.instanceId)
          expect(command.effectTargets).toEqual(
            expect.arrayContaining([[battle.attackerInstanceId]]),
          )
          expect(getAttackDamageAgainst(
            next.state,
            battle.attackerInstanceId,
            battle.targetInstanceId,
          )).toBe(2)
          return
        }
      }

      const next = takeAiStep(state, actor, {
        level: 5,
        seed,
        searchNow: () => 0,
        memory: memories[actor],
      })
      if (next.action === 'error' || next.state === state) {
        throw new Error(next.error ?? `No progress before Cookie Windmill: ${next.description}`)
      }
      if (next.reason?.strategyMemory) memories[actor] = next.reason.strategyMemory
      state = next.state
    }

    throw new Error('The original seed did not reach both Cookie Windmill decisions')
  }, 30000)

  it('pays BS6-085 when its discard condition lets the trap save BS7-067', () => {
    const seed = 204500000
    let state = createCustomDeckMatch(seed, blueArenaDeck, blueArenaDeck, 'player-one')
    const memories: Partial<Record<'player-one' | 'player-two', AiStrategyMemory>> = {}

    for (let index = 0; index < 140; index += 1) {
      const actor = getActingPlayerId(state)
      const battle = state.pendingBattle
      const defender = battle?.stage === 'trap' && battle.defenderPlayerId === actor
        ? state.players[actor].battleArea.find(
            cookie => cookie.card.instanceId === battle.targetInstanceId,
          )
        : undefined
      const attacker = battle?.stage === 'trap'
        ? state.players[battle.attackerPlayerId].battleArea.find(
            cookie => cookie.card.instanceId === battle.attackerInstanceId,
          )
        : undefined

      if (
        index === 90 &&
        actor === 'player-two' &&
        defender?.card.id === 'BS7-067' &&
        attacker?.card.id === 'BS7-072' &&
        battle?.attackerInstanceId === 'player-one-BS7-072-4' &&
        battle.targetInstanceId === 'player-two-BS7-067-2'
      ) {
        const trap = state.players[actor].hand.find(card => card.id === 'BS6-085')
        expect(trap).toBeDefined()
        expect(state.players[actor].hand).toHaveLength(4)
        expect(defender.hpCards).toHaveLength(2)
        expect(getAttackDamageAgainst(state, battle!.attackerInstanceId, battle!.targetInstanceId))
          .toBe(2)
        expect(state.players[actor].supportArea.filter(support => !support.rested))
          .toHaveLength(2)

        const next = takeAiStep(state, actor, {
          level: 5,
          seed,
          searchNow: () => 0,
          memory: memories[actor],
        })
        const command = next.state.commandLog
          ?.slice(state.commandLog?.length ?? 0)
          .find(entry => entry.commandKind === 'play-trap')?.payload
        expect(command?.kind).toBe('play-trap')
        if (command?.kind !== 'play-trap') {
          throw new Error('Expected BS6-085 to be played to prevent the knockout')
        }
        expect(command.trapInstanceId).toBe(trap!.instanceId)
        expect(command.discardHandIds).toHaveLength(2)
        expect(command.effectTargets).toEqual(
          expect.arrayContaining([[battle!.attackerInstanceId]]),
        )
        expect(getAttackDamageAgainst(
          next.state,
          battle!.attackerInstanceId,
          battle!.targetInstanceId,
        )).toBe(0)
        return
      }

      const next = takeAiStep(state, actor, {
        level: 5,
        seed,
        searchNow: () => 0,
        memory: memories[actor],
      })
      if (next.action === 'error' || next.state === state) {
        throw new Error(next.error ?? `No progress before BS6-085 decision: ${next.description}`)
      }
      if (next.reason?.strategyMemory) memories[actor] = next.reason.strategyMemory
      state = next.state
    }

    throw new Error('The original seed did not reach the BS6-085 rescue decision')
  }, 30000)

  it('continues the defender FLIP while the attacker owns a queued FLIP continuation', () => {
    const seed = 204061601
    const result = simulateAiMatchDetailed(
      createCustomDeckMatch(
        seed,
        communityDeck('cookierift-1035'),
        communityDeck('cookierift-973'),
        'player-one',
      ),
      500,
      { levels: { 'player-one': 3, 'player-two': 3 }, seed, searchNow: () => 0 },
    )

    expect(result.error, result.logs.join('\n')).toBeNull()
    expect(result.stuck).toBe(false)
    expect(result.state.status).toBe('finished')
  }, 30000)

  it.each([
    [203712000, greenArenaDeck, communityDeck('cookierift-1239'), 'player-two'],
    [204182000, communityDeck('cookierift-927'), communityDeck('cookierift-1239'), 'player-one'],
    [204182000, communityDeck('cookierift-927'), communityDeck('cookierift-1239'), 'player-two'],
    [203791901, communityDeck('cookierift-801'), communityDeck('cookierift-1164'), 'player-one'],
    [203891900, communityDeck('cookierift-1164'), communityDeck('cookierift-1164'), 'player-two'],
    [203892001, communityDeck('cookierift-801'), communityDeck('cookierift-1239'), 'player-two'],
    [203921501, communityDeck('cookierift-568'), communityDeck('cookierift-793'), 'player-one'],
    [203991901, communityDeck('cookierift-1164'), communityDeck('cookierift-1164'), 'player-two'],
  ] as const)('%i completes without invalid actions', (seed, left, right, firstPlayerId) => {
    const result = simulateAiMatchDetailed(
      createCustomDeckMatch(seed, left, right, firstPlayerId),
      500,
      { levels: { 'player-one': 5, 'player-two': 5 }, seed, searchNow: () => 0 },
    )

    expect(result.error, result.logs.join('\n')).toBeNull()
    expect(result.behavior.invalidActionCount).toBe(0)
    expect(result.stuck).toBe(false)
    expect(result.state.status).toBe('finished')
  }, 30000)
})
