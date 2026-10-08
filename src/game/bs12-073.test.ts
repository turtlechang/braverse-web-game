import { describe, expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from '../cards/types'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { createBs12CreamPuffDemoState, createBs12DjMiyaDemoState as createDjMiya, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { getFixedModifierTargetIds } from './effects/targeting'
import type { GameState } from './types'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'

const actor = 'player-one' as const
const sourceId = 'bs12-073-source'
const open = (state: GameState) => applyGameCommand(state, { kind: 'begin-activate-skill', playerId: actor, sourceInstanceId: sourceId, trigger: 'on-play', paymentIds: [], targetIds: [] })
const finishReveal = (state: GameState) => applyGameCommand(state, { kind: 'resolve-reveal-top-deck', playerId: actor })
const next = (state: GameState) => state.pendingAbilityEffect
  ? applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: actor, targetIds: [] }) : state
const ordinary = (state: GameState) => {
  let after = applyGameCommand(state, { kind: 'declare-attack', playerId: actor, attackerInstanceId: sourceId, targetInstanceId: 'bs12-064-opponent', supportPaymentIds: state.players[actor].supportArea.map(s => s.card.instanceId) })
  after = applyGameCommand(after, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; after.pendingBattle?.stage === 'damage' && i < 6; i++) after = applyGameCommand(after, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return applyGameCommand(after, { kind: 'resolve-attack-effect', playerId: actor, targetIds: [] })
}

describe.each(['BS12-073', 'BS12-073@1'] as const)('%s public On Play commands', number => {
  it('returns the matching bottom and lets only the opponent discard their own chosen hand card', () => {
    const converted = convertOfficialCardToGameCard(candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord)
    if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing DJ Miya')
    const base = createBs12CreamPuffDemoState('deploy')
    const source = { ...converted.gameCard, instanceId: 'bs12-073-source' }
    const opponentHand = base.players['player-two'].deck.slice(0, 6)
    const before = { ...base, players: { ...base.players,
      'player-one': { ...base.players['player-one'], hand: [source] },
      'player-two': { ...base.players['player-two'], hand: opponentHand, deck: base.players['player-two'].deck.slice(6) },
    } }
    const entered = applyGameCommand(before, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
    const shown = applyGameCommand(entered, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.instanceId, trigger: 'on-play', paymentIds: [], targetIds: [] })
    expect(shown.pendingRevealTopDeck).toMatchObject({ deckPosition: 'bottom', matched: true, revealedCard: before.players['player-one'].deck.at(-1) })
    const returned = applyGameCommand(shown, { kind: 'resolve-reveal-top-deck', playerId: 'player-one' })
    const offered = applyGameCommand(returned, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(offered.players['player-one'].hand).toEqual(before.players['player-one'].deck.slice(-1))
    expect(offered.players['player-two'].hand).toEqual(opponentHand)
    expect(offered.pendingOpponentHandDiscard).toMatchObject({ playerId: 'player-two', count: 1, sourceInstanceId: source.instanceId })
    expect(() => applyGameCommand(offered, { kind: 'resolve-opponent-hand-discard', playerId: 'player-one', cardIds: [opponentHand[2].instanceId] })).toThrow()
    const after = applyGameCommand(offered, { kind: 'resolve-opponent-hand-discard', playerId: 'player-two', cardIds: [opponentHand[2].instanceId] })
    expect(after.players['player-two'].hand).toEqual(opponentHand.filter((_, i) => i !== 2))
    expect(after.players['player-two'].discardPile).toEqual([opponentHand[2]])
    expect(after.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(before.players['player-one'].hand).toEqual([source])
  })
})

describe.each(['BS12-073', 'BS12-073@1'] as const)('%s independent conditions and printed source movement', number => {
  const createBs12DjMiyaDemoState = (scenario: Parameters<typeof createDjMiya>[0] = 'positive') => createDjMiya(scenario, number)
  it('only exposes the candidate route on localhost', () => {
    expect(parseTestStateConfig(`?test-state=bs12-073:${number}:positive`, 'localhost')).toEqual({ kind: 'bs12-073', cardNumber: number, scenario: 'positive' })
    expect(parseTestStateConfig(`?test-state=bs12-073:${number}:positive`, 'example.com')).toBeNull()
  })
  it.each(['positive', 'green-arena', 'red-arena', 'yellow-arena'] as const)('returns the same matching bottom, irrespective of its color: %s', scenario => {
    const before = createBs12DjMiyaDemoState(scenario)
    const snapshot = structuredClone(before)
    const bottom = before.players[actor].deck.at(-1)!
    const shown = open(before)
    expect(shown.pendingRevealTopDeck).toMatchObject({ deckPosition: 'bottom', matched: true, revealedCard: bottom })
    expect(shown.players[actor].hand).toEqual(before.players[actor].hand)
    const after = next(finishReveal(shown))
    expect(after.players[actor].hand).toEqual([...before.players[actor].hand, bottom])
    expect(after.players[actor].deck).toEqual(before.players[actor].deck.slice(0, -1))
    expect(after.players[actor].battleArea[0].hpCards).toHaveLength(2)
    expect(after.pendingOpponentHandDiscard).toMatchObject({ playerId: 'player-two', count: 1 })
    expect(before).toEqual(snapshot)
  })
  it.each(['same-name', 'same-name-alt', 'non-arena', 'level-one', 'level-three', 'arena-item', 'top-only'] as const)('keeps a nonmatching bottom but still requires the opponent discard: %s', scenario => {
    const before = createBs12DjMiyaDemoState(scenario)
    const shown = open(before)
    expect(shown.pendingRevealTopDeck?.matched).toBe(false)
    const after = next(finishReveal(shown))
    expect(after.players[actor].deck).toEqual(before.players[actor].deck)
    expect(after.players[actor].hand).toEqual(before.players[actor].hand)
    expect(after.pendingOpponentHandDiscard).toMatchObject({ playerId: 'player-two', count: 1 })
  })
  it.each([['five', false], ['positive', true], ['seven', true]] as const)('checks the opponent current hand threshold independently: %s', (scenario, required) => {
    const after = next(finishReveal(open(createBs12DjMiyaDemoState(scenario))))
    expect(Boolean(after.pendingOpponentHandDiscard)).toBe(required)
  })
  it('requires an actual bottom before declaration', () => {
    const before = createBs12DjMiyaDemoState('empty-deck')
    expect(canActivateCookieSkill(before, actor, sourceId, 'on-play')).toBe(false)
    expect(() => open(before)).toThrow()
  })
  it.each(['onplay-opponent-turn', 'onplay-source-rested'] as const)('does not add unprinted Your Turn or REST restrictions: %s', scenario => {
    const before = createBs12DjMiyaDemoState(scenario)
    expect(canActivateCookieSkill(before, actor, sourceId, 'on-play')).toBe(true)
    const shown = open(before)
    expect(shown.pendingRevealTopDeck?.matched).toBe(true)
    const after = next(finishReveal(shown))
    expect(after.players[actor].battleArea).toEqual(before.players[actor].battleArea)
    expect(after.pendingOpponentHandDiscard?.playerId).toBe('player-two')
  })
  it.each(['receiver', 'receiver-mismatch'] as const)('only the receiving player can select exactly one of their own private hand: %s', scenario => {
    const before = createBs12DjMiyaDemoState(scenario)
    const own = before.players[actor].hand
    expect(before.pendingOpponentHandDiscard).toMatchObject({ playerId: actor, count: 1 })
    for (const command of [
      { kind: 'resolve-opponent-hand-discard' as const, playerId: 'player-two' as const, cardIds: [own[0].instanceId] },
      { kind: 'resolve-opponent-hand-discard' as const, playerId: actor, cardIds: [] },
      { kind: 'resolve-opponent-hand-discard' as const, playerId: actor, cardIds: own.slice(0, 2).map(c => c.instanceId) },
      { kind: 'resolve-opponent-hand-discard' as const, playerId: actor, cardIds: ['foreign-card'] },
    ]) expect(() => applyGameCommand(before, command)).toThrow()
    const command = { kind: 'resolve-opponent-hand-discard' as const, playerId: actor, cardIds: [own[2].instanceId] }
    const after = applyGameCommand(before, command)
    expect(after.players[actor].hand).toEqual(own.filter((_, i) => i !== 2))
    expect(after.players[actor].discardPile).toEqual([own[2]])
    expect(applyGameCommand(JSON.parse(JSON.stringify(before)), command)).toEqual(after)
  })
  it.each(['attack', 'attack-item-cost', 'attack-equipped', 'attack-ally'] as const)('ordinary BB2 precedes one discard and fixed-source bottom movement: %s', scenario => {
    const before = createBs12DjMiyaDemoState(scenario)
    const source = before.players[actor].battleArea[0]
    const paidAttack = ordinary(before)
    expect(paidAttack.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual([4, 4])
    expect(paidAttack.players[actor].hand).toEqual(before.players[actor].hand)
    expect(paidAttack.players[actor].deck).toEqual(before.players[actor].deck)
    expect(paidAttack.pendingOptionalCostAttack).toBeTruthy()
    const move = paidAttack.pendingOptionalCostAttack!.effects[0]
    const targets = getFixedModifierTargetIds(paidAttack, { sourcePlayerId: actor, sourceInstanceId: sourceId }, move)
    expect(targets).toEqual([sourceId])
    const after = applyGameCommand(paidAttack, { kind: 'resolve-optional-cost-attack', playerId: actor, action: 'pay', paymentIds: [], discardCardIds: ['bs12-073-cost'], targetIds: targets! })
    expect(after.players[actor].deck).toEqual([...before.players[actor].deck, source.card])
    expect(after.players[actor].discardPile).toEqual([...before.players[actor].discardPile, before.players[actor].hand[0], ...source.hpCards, ...(source.equippedCards ?? [])])
    expect(after.players[actor].breakArea).toEqual(before.players[actor].breakArea)
    expect(after.players[actor].battleArea.map(c => c.card.instanceId)).toEqual(before.players[actor].battleArea.slice(1).map(c => c.card.instanceId))
    expect(after.pendingFaintEffects ?? []).toEqual([])
  })
  it('skips Then without discarding or moving the source', () => {
    const before = createBs12DjMiyaDemoState('attack')
    const attacked = ordinary(before)
    const after = applyGameCommand(attacked, { kind: 'resolve-optional-cost-attack', playerId: actor, action: 'skip' })
    expect(after.players[actor].hand).toEqual(before.players[actor].hand)
    expect(after.players[actor].deck).toEqual(before.players[actor].deck)
    expect(after.players[actor].discardPile).toEqual(before.players[actor].discardPile)
    expect(after.players[actor].battleArea[0].rested).toBe(true)
  })
  it('uses the printed source automatically after cost confirmation', () => {
    const before = createBs12DjMiyaDemoState('attack-ally')
    const offered = ordinary(before)
    expect(getOptionalCostAttackPrompt(offered, actor)?.needsTarget).toBe(false)
    expect(() => applyGameCommand(offered, { kind: 'resolve-optional-cost-attack', playerId: actor, action: 'pay', discardCardIds: ['bs12-073-cost'], targetIds: ['bs12-073-ally'] })).toThrow()
    const after = applyGameCommand(offered, { kind: 'resolve-optional-cost-attack', playerId: actor, action: 'pay', discardCardIds: ['bs12-073-cost'], targetIds: [] })
    expect(after.players[actor].deck.at(-1)?.instanceId).toBe(sourceId)
    expect(after.players[actor].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-073-ally'])
    const publicSteps = after.commandLog?.at(-1)?.steps?.map(step => step.text).join(' ')
    expect(publicSteps).toContain('將「DJ Miya」放到持有者牌庫底')
    expect(publicSteps).toContain('原 HP 2 張')
    expect(publicSteps).not.toContain('執行 field-to-deck-bottom')
  })
  it('handles empty-field defeat only after the source moves and replacement ends', () => {
    const offered = ordinary(createBs12DjMiyaDemoState('attack'))
    const moved = applyGameCommand(offered, { kind: 'resolve-optional-cost-attack', playerId: actor, action: 'pay', discardCardIds: ['bs12-073-cost'], targetIds: [] })
    expect(moved.players[actor].deck.at(-1)?.instanceId).toBe(sourceId)
    expect(moved.status).toBe('playing')
    expect(moved.pendingReplacement?.tasks[0].playerId).toBe(actor)
    const finished = applyGameCommand(moved, { kind: 'skip-replacement', playerId: actor })
    expect(finished.status).toBe('finished')
    expect(finished.result?.winnerId).toBe('player-two')
  })
  it('R008 offers Then and discards the prepared underlay when the source returns to bottom', () => {
    const before = createBs12DjMiyaDemoState('attack-awakened')
    const after = ordinary(before)
    expect(after.pendingOptionalCostAttack).toBeTruthy()
    expect(after.players[actor].hand).toEqual(before.players[actor].hand)
    expect(after.players[actor].deck).toEqual(before.players[actor].deck)
    const source = before.players[actor].battleArea[0]
    const moved = applyGameCommand(after, { kind: 'resolve-optional-cost-attack', playerId: actor, action: 'pay', discardCardIds: ['bs12-073-cost'], paymentIds: [] })
    expect(moved.players[actor].deck.at(-1)).toEqual(source.card)
    expect(moved.players[actor].discardPile).toEqual([...before.players[actor].discardPile, before.players[actor].hand[0], ...source.hpCards, ...(source.equippedCards ?? []), ...(source.awakenedUnderlay ?? [])])
  })
  it('returns the final matching bottom before Refresh interrupts the independent discard', () => {
    const before = createBs12DjMiyaDemoState('short-deck')
    const shown = open(before)
    const returned = finishReveal(shown)
    expect(returned.players[actor].hand.at(-1)).toEqual(before.players[actor].deck[0])
    expect(returned.pendingRefresh?.playerId).toBe(actor)
    expect(returned.pendingOpponentHandDiscard ?? null).toBeNull()
    expect(returned.players['player-two'].hand).toEqual(before.players['player-two'].hand)
  })
  it('Refresh defeat stops the independent discard after returning the final bottom', () => {
    const before = createBs12DjMiyaDemoState('refresh-defeat')
    const returned = finishReveal(open(before))
    const after = applyGameCommand(returned, { kind: 'refresh-deck', playerId: actor, cookieInstanceId: 'bs12-073-refresh-cookie', shuffleSeed: 73 })
    expect(after.status).toBe('finished')
    expect(after.result?.winnerId).toBe('player-two')
    expect(after.players[actor].hand.at(-1)).toEqual(before.players[actor].deck[0])
    expect(after.players['player-two'].hand).toEqual(before.players['player-two'].hand)
    expect(after.pendingOpponentHandDiscard ?? null).toBeNull()
  })
  it.each(['attack-one-energy', 'attack-wrong-energy', 'attack-rested-energy', 'attack-source-rested', 'attack-opponent-turn', 'attack-outside-main'] as const)('rejects illegal BB attack before mutation: %s', scenario => {
    const before = createBs12DjMiyaDemoState(scenario)
    const snapshot = structuredClone(before)
    expect(() => ordinary(before)).toThrow()
    expect(before).toEqual(snapshot)
  })
  it('R008 keeps a source with an underlay eligible in the isolated movement fixture', () => {
    const before = createBs12DjMiyaDemoState('attack-awakened')
    const move = before.players[actor].battleArea[0].card.attackEffects![0]
    if (move.kind !== 'optional-cost-attack') throw new Error('Missing Then')
    expect(getFixedModifierTargetIds(before, { sourcePlayerId: actor, sourceInstanceId: sourceId }, move.effects[0])).toEqual([sourceId])
  })
})
