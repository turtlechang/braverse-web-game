import { describe, expect, it } from 'vitest'
import { createAiTrapTargetPreview } from '../../ai-trap-target-demo'
import { takeAiStep } from '../../ai'
import { applyGameCommand } from '../../commands'
import { getActingPlayerId } from '../../controller'
import { getAllCardPoolEntries, getCardPoolEntry } from '../../card-pool'
import { getAttackDamageAgainst, getEffectiveAttack } from '../../effects'
import { getReplacementCandidates } from '../../replacement'
import { createCard } from '../../starter-deck'
import type { CookieCard, PlayerId } from '../../types'

const owner = 'player-two' as const
const printed = (id: string, player: PlayerId = owner, copy = 1) => {
  const raw = getCardPoolEntry(id)
  if (!raw) throw new Error(`Missing original printing ${id}`)
  return createCard(raw, player, copy)
}
const chosenTrap = (state: ReturnType<typeof createAiTrapTargetPreview>, next: ReturnType<typeof takeAiStep>) => {
  const command = next.state.commandLog?.slice(state.commandLog?.length ?? 0)
    .find(entry => entry.commandKind === 'play-trap')?.payload
  if (command?.kind !== 'play-trap') throw new Error('Expected actual trap command')
  return command
}

const createLastCookieLethalTrapState = () => {
  const state = createAiTrapTargetPreview()
  const defender = state.players[owner]
  const originalTarget = defender.battleArea[0]
  const [activeSupport, returnedSupport] = defender.supportArea
  if (!originalTarget || !activeSupport || !returnedSupport) {
    throw new Error('Expected the printed trap preview battlefield')
  }

  const targetIndex = defender.deck.findIndex(card =>
    card.type === 'cookie' && card.level === 1 && !card.extraDeckOrigin,
  )
  if (targetIndex < 0) throw new Error('Expected a printed LV.1 replacement candidate')
  const targetCookie = defender.deck.splice(targetIndex, 1)[0] as CookieCard
  const hpIndex = defender.deck.findIndex(card => card.type !== 'cookie')
  if (hpIndex < 0) throw new Error('Expected a printed HP card')
  const hpCard = defender.deck.splice(hpIndex, 1)[0]

  defender.deck.push(originalTarget.card, ...originalTarget.hpCards, returnedSupport.card)
  defender.battleArea = [{
    card: targetCookie,
    hpCards: [hpCard],
    rested: false,
    battleEntryId: `${targetCookie.instanceId}:last-cookie-test`,
  }]
  defender.supportArea = [activeSupport]
  state.pendingBattle!.targetInstanceId = targetCookie.instanceId
  return state
}

const replaceTrapAndEnergy = (
  state: ReturnType<typeof createAiTrapTargetPreview>,
  trapId: string,
  energyColor: 'red' | 'yellow' | 'purple' | 'black',
  energyCount: number,
) => {
  const defender = state.players[owner]
  const currentTrap = defender.hand[0]
  const trapIndex = defender.deck.findIndex(card => card.id === trapId)
  if (!currentTrap) throw new Error(`Missing current trap before replacing with ${trapId}`)
  const trapCard = trapIndex >= 0
    ? defender.deck.splice(trapIndex, 1)[0]!
    : (() => {
        const usedIds = new Set([
          ...defender.hand,
          ...defender.deck,
          ...defender.supportArea.map(support => support.card),
          ...defender.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
          ...defender.breakArea,
          ...defender.discardPile,
        ].map(card => card.instanceId))
        for (let copy = 1; copy <= 4; copy += 1) {
          const candidate = printed(trapId, owner, copy)
          if (!usedIds.has(candidate.instanceId)) return candidate
        }
        throw new Error(`No legal printed copy available for ${trapId}`)
      })()
  if (trapIndex >= 0) defender.deck.push(currentTrap)
  defender.hand = [trapCard!]

  const energyIndices: number[] = []
  for (let index = 0; index < defender.deck.length && energyIndices.length < energyCount; index += 1) {
    const card = defender.deck[index]
    if (card?.type !== 'cookie' && card?.energyColor === energyColor) energyIndices.push(index)
  }
  const energyCards = energyIndices.map(index => defender.deck[index]!)
  const energyIds = new Set(energyCards.map(card => card.instanceId))
  defender.deck = defender.deck.filter(card => !energyIds.has(card.instanceId))
  const newEnergyCards: ReturnType<typeof printed>[] = []
  const usedInstanceIds = new Set([
    ...energyCards,
    ...defender.hand,
    ...defender.deck,
    ...defender.supportArea.map(support => support.card),
    ...defender.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
    ...defender.breakArea,
    ...defender.discardPile,
  ].map(card => card.instanceId))
  for (const raw of getAllCardPoolEntries()) {
    if (energyCards.length + newEnergyCards.length >= energyCount) break
    if (raw.type === 'cookie' || raw.energyType?.toLowerCase() !== energyColor) continue
    for (let copy = 1; copy <= 4; copy += 1) {
      const candidate = createCard(raw, owner, copy)
      if (usedInstanceIds.has(candidate.instanceId)) continue
      newEnergyCards.push(candidate)
      usedInstanceIds.add(candidate.instanceId)
      break
    }
  }
  if (energyCards.length + newEnergyCards.length !== energyCount) {
    throw new Error(`Missing ${energyCount} printed ${energyColor} energy sources`)
  }
  const priorSupports = defender.supportArea.map(support => support.card)
  // New printed energy cards replace the same number of deck cards so the
  // fixture remains a 60-card physical deck.
  if (newEnergyCards.length > 0) defender.deck.splice(-newEnergyCards.length)
  defender.deck.push(...priorSupports)
  defender.supportArea = [...energyCards, ...newEnergyCards]
    .map(card => ({ card, rested: false }))
  return trapCard!
}

const addPrintedArenaCardsToTrash = (
  state: ReturnType<typeof createAiTrapTargetPreview>,
  count: number,
) => {
  const usedInstanceIds = new Set(Object.values(state.players).flatMap(player => [
    ...player.deck,
    ...player.hand,
    ...player.supportArea.map(support => support.card),
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
    ...player.breakArea,
    ...player.discardPile,
    ...(player.extraDeck ?? []),
  ]).map(card => card.instanceId))
  const selected: ReturnType<typeof createCard>[] = []
  for (const original of getAllCardPoolEntries()) {
    if (!original.keywords?.some(keyword => keyword.toLowerCase() === 'arena')) continue
    for (let copy = 1; copy <= 4; copy += 1) {
      const card = createCard(original, owner, copy)
      if (usedInstanceIds.has(card.instanceId)) continue
      selected.push(card)
      usedInstanceIds.add(card.instanceId)
      break
    }
    if (selected.length === count) break
  }
  if (selected.length !== count) throw new Error(`Expected ${count} unique printed Arena cards`)
  state.players[owner].discardPile.push(...selected)
}

const createTerminalTrapScenario = (
  trapId: string,
  energyColor: 'red' | 'yellow' | 'purple' | 'black',
  energyCount: number,
) => {
  const state = createLastCookieLethalTrapState()
  const trap = replaceTrapAndEnergy(state, trapId, energyColor, energyCount)
  return { state, trap }
}

const replaceBattleCookieWithPrinted = (
  state: ReturnType<typeof createAiTrapTargetPreview>,
  playerId: PlayerId,
  battleIndex: number,
  cardId: string,
  hpCount: number,
) => {
  const player = state.players[playerId]
  const battleCookie = player.battleArea[battleIndex]
  if (!battleCookie) throw new Error(`Missing battle Cookie at index ${battleIndex}`)

  const deckIndex = player.deck.findIndex(card => card.id === cardId)
  let replacement: CookieCard
  if (deckIndex >= 0) {
    const card = player.deck.splice(deckIndex, 1)[0]!
    if (card.type !== 'cookie') throw new Error(`Expected printed Cookie ${cardId}`)
    replacement = card
  } else {
    const usedCards = [
      ...player.deck,
      ...player.hand,
      ...player.supportArea.map(support => support.card),
      ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
      ...player.breakArea,
      ...player.discardPile,
      ...(player.extraDeck ?? []),
    ]
    const usedInstanceIds = new Set(usedCards.map(card => card.instanceId))
    const copies = usedCards.filter(card => card.id === cardId).length
    if (copies >= 4) throw new Error(`No printed copy available for ${cardId}`)
    let created: CookieCard | undefined
    for (let copy = 1; copy <= 4; copy += 1) {
      const candidate = printed(cardId, playerId, copy)
      if (candidate.type === 'cookie' && !usedInstanceIds.has(candidate.instanceId)) {
        created = candidate
        break
      }
    }
    if (!created) throw new Error(`No unique printed instance available for ${cardId}`)
    replacement = created
    // Exchange one existing deck card for this physical printing. The former
    // battle Cookie takes its place in the deck, keeping the fixture at 60.
    if (!player.deck.pop()) throw new Error('Expected a deck card to exchange')
  }

  player.deck.push(battleCookie.card)
  player.battleArea[battleIndex] = { ...battleCookie, card: replacement }
  const updated = player.battleArea[battleIndex]!
  while (updated.hpCards.length < hpCount) {
    const hpCard = player.deck.shift()
    if (!hpCard) throw new Error(`Cannot provide ${hpCount} HP cards for ${cardId}`)
    updated.hpCards.push(hpCard)
  }
  while (updated.hpCards.length > hpCount) {
    player.deck.push(updated.hpCards.pop()!)
  }
  return updated
}

const createForbiddenGrimoireWindArcherScenario = () => {
  const state = createAiTrapTargetPreview('no-energy')
  const attackerPlayer = state.players['player-one']
  const attacker = attackerPlayer.battleArea[0]
  if (!attacker) throw new Error('Expected the printed attack source')

  // Reopen the real attack declaration so the target identity and cost Cookies
  // are already on the field when the opponent opens the trap window.
  state.pendingBattle = null
  attackerPlayer.battleArea[0] = { ...attacker, rested: false }
  attackerPlayer.supportArea = attackerPlayer.supportArea.map(support => ({
    ...support,
    rested: false,
  }))

  const windArcher = replaceBattleCookieWithPrinted(state, owner, 0, 'BS2-058', 2)
  const blueberryPie = replaceBattleCookieWithPrinted(state, owner, 1, 'ST10-006', 2)
  const reopened = applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-one',
    attackerInstanceId: attacker.card.instanceId,
    targetInstanceId: windArcher.card.instanceId,
    supportPaymentIds: attackerPlayer.supportArea
      .slice(0, 2)
      .map(support => support.card.instanceId),
  })
  const trap = replaceTrapAndEnergy(reopened, 'ST5-020', 'purple', 1)
  return { state: reopened, trap, windArcher, blueberryPie }
}

describe('Public trap targeting protects the current defender', () => {
  it('spends a playable trap to prevent a terminal defeat against the last Cookie', () => {
    const state = createLastCookieLethalTrapState()
    const before = structuredClone(state)
    const defender = state.players[owner]
    const trap = defender.hand.find(card => card.id === 'ST3-019')
    const support = defender.supportArea[0]
    const attackerId = state.pendingBattle!.attackerInstanceId
    if (!trap || trap.type !== 'trap' || !support) throw new Error('Expected ST3-019 and green energy')

    expect(defender.battleArea).toHaveLength(1)
    expect(defender.battleArea[0].card.level).toBe(1)
    expect(defender.battleArea[0].hpCards).toHaveLength(1)
    expect(getReplacementCandidates(state, owner)).toEqual([])
    expect(getEffectiveAttack(state, attackerId)).toBeGreaterThanOrEqual(1)

    // The printed ST3-019 route is legal and reduces the attack to zero.
    const protectedState = applyGameCommand(state, {
      kind: 'play-trap',
      playerId: owner,
      trapInstanceId: trap.instanceId,
      costOptionIndex: 0,
      paymentIds: [support.card.instanceId],
      targetIds: [attackerId],
      supportTrashIds: [support.card.instanceId],
    })
    expect(getEffectiveAttack(protectedState, attackerId)).toBe(0)
    const protectedDamage = applyGameCommand(protectedState, {
      kind: 'resolve-next-damage',
      playerId: owner,
    })
    expect(protectedDamage.status).toBe('playing')
    expect(protectedDamage.players[owner].battleArea).toHaveLength(1)
    expect(protectedDamage.players[owner].battleArea[0].hpCards).toHaveLength(1)

    // Skipping the same trap loses immediately after normal battle settlement.
    const skipped = applyGameCommand(state, { kind: 'skip-trap', playerId: owner })
    let defeat = skipped
    for (let index = 0; index < 20 && defeat.status === 'playing'; index += 1) {
      const playerId = getActingPlayerId(defeat)
      const next = takeAiStep(defeat, playerId, {
        level: 5,
        seed: 204512100 + index,
        searchNow: () => 0,
      })
      if (next.action === 'error' || next.state === defeat) {
        throw new Error(next.error ?? `No progress while settling the skipped trap: ${next.description}`)
      }
      defeat = next.state
    }
    expect(defeat.status).toBe('finished')
    expect(defeat.result?.winnerId).toBe('player-one')

    const next = takeAiStep(state, owner, { level: 5, seed: 204512100, searchNow: () => 0 })
    expect(chosenTrap(state, next).trapInstanceId).toBe(trap.instanceId)
    expect(state).toEqual(before)
  })

  it('uses ST6-017’s eligible Then modifier when the root modifier alone is insufficient', () => {
    const { state, trap } = createTerminalTrapScenario('ST6-017', 'red', 2)
    const attackerId = state.pendingBattle!.attackerInstanceId
    const defenderId = state.pendingBattle!.targetInstanceId
    state.attackModifiers = [...state.attackModifiers, {
      sourceInstanceId: 'public-attack-boost',
      targetInstanceId: attackerId,
      amount: 1,
      expiresAfterTurn: state.turnNumber,
    }]
    expect(getAttackDamageAgainst(state, attackerId, defenderId)).toBe(3)

    const next = takeAiStep(state, owner, { level: 5, seed: 204512100, searchNow: () => 0 })
    const command = chosenTrap(state, next)
    expect(command.trapInstanceId).toBe(trap.instanceId)
    expect(command.targetIds).toEqual([attackerId])
    expect(command.effectTargets).toEqual([[attackerId]])
    expect(getAttackDamageAgainst(next.state, attackerId, defenderId)).toBe(0)

    const settled = applyGameCommand(next.state, { kind: 'resolve-next-damage', playerId: owner })
    expect(settled.status).toBe('playing')
    expect(settled.players[owner].battleArea).toHaveLength(1)
  })

  it('uses ST10-018’s rescue reduction when its optional recovery has no legal target', () => {
    const { state, trap } = createTerminalTrapScenario('ST10-018', 'purple', 3)
    const attackerId = state.pendingBattle!.attackerInstanceId
    const defenderId = state.pendingBattle!.targetInstanceId
    const defender = state.players[owner]
    expect(defender.discardPile.some(card =>
      card.type === 'cookie' && card.energyColor === 'purple' && card.level === 3,
    )).toBe(false)
    expect(getAttackDamageAgainst(state, attackerId, defenderId)).toBeGreaterThanOrEqual(1)

    const before = structuredClone(state)
    const next = takeAiStep(state, owner, { level: 5, seed: 204512107, searchNow: () => 0 })
    const command = chosenTrap(state, next)

    expect(command.trapInstanceId).toBe(trap.instanceId)
    expect(command.targetIds).toEqual([attackerId])
    expect(command.effectTargets).toEqual([[attackerId], []])
    expect(getAttackDamageAgainst(next.state, attackerId, defenderId)).toBeLessThan(
      next.state.players[owner].battleArea[0]!.hpCards.length,
    )

    const settled = applyGameCommand(next.state, { kind: 'resolve-next-damage', playerId: owner })
    expect(settled.status).toBe('playing')
    expect(settled.players[owner].battleArea).toHaveLength(1)
    expect(state).toEqual(before)
  })

  it('coordinates BS4-042’s opponent and self targets for the same attack', () => {
    const { state, trap } = createTerminalTrapScenario('BS4-042', 'yellow', 2)
    const attackerId = state.pendingBattle!.attackerInstanceId
    const defenderId = state.pendingBattle!.targetInstanceId
    expect(getAttackDamageAgainst(state, attackerId, defenderId)).toBe(2)

    const next = takeAiStep(state, owner, { level: 5, seed: 204512101, searchNow: () => 0 })
    const command = chosenTrap(state, next)
    expect(command.trapInstanceId).toBe(trap.instanceId)
    expect(command.targetIds).toEqual([attackerId])
    expect(command.effectTargets).toEqual([[attackerId], [defenderId]])
    expect(getAttackDamageAgainst(next.state, attackerId, defenderId)).toBe(1)
    expect(next.state.players[owner].battleArea[0].hpCards).toHaveLength(2)

    const settled = applyGameCommand(next.state, { kind: 'resolve-next-damage', playerId: owner })
    expect(settled.status).toBe('playing')
    expect(settled.players[owner].battleArea).toHaveLength(1)
    expect(settled.players[owner].battleArea[0].hpCards).toHaveLength(1)
  })

  it('pays ST5-020 with a printed ST10-006 to protect a damaged Wind Archer', () => {
    const { state, trap, windArcher, blueberryPie } =
      createForbiddenGrimoireWindArcherScenario()
    const attackerId = state.pendingBattle!.attackerInstanceId
    const targetId = state.pendingBattle!.targetInstanceId
    expect(trap.id).toBe('ST5-020')
    expect(getAttackDamageAgainst(state, attackerId, targetId)).toBe(2)
    expect(windArcher.card.id).toBe('BS2-058')
    expect(windArcher.hpCards).toHaveLength(2)
    expect(blueberryPie.card.id).toBe('ST10-006')
    expect(blueberryPie.hpCards).toHaveLength(2)

    for (const player of Object.values(state.players)) {
      const cards = [
        ...player.deck,
        ...player.hand,
        ...player.supportArea.map(support => support.card),
        ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
        ...player.breakArea,
        ...player.discardPile,
      ]
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      const counts = new Map<string, number>()
      for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
    }

    const paymentSupport = state.players[owner].supportArea.find(support => !support.rested)
    if (!paymentSupport) throw new Error('Expected ready purple trap energy')
    const manuallyPaid = applyGameCommand(state, {
      kind: 'play-trap',
      playerId: owner,
      trapInstanceId: trap.instanceId,
      costOptionIndex: 0,
      paymentIds: [paymentSupport.card.instanceId],
      targetIds: [attackerId],
      trashBattleCookieIds: [blueberryPie.card.instanceId],
    })
    expect(manuallyPaid.players[owner].discardPile.some(
      card => card.instanceId === blueberryPie.card.instanceId,
    )).toBe(true)
    expect(getAttackDamageAgainst(manuallyPaid, attackerId, targetId)).toBe(0)
    const manuallySettled = applyGameCommand(manuallyPaid, {
      kind: 'resolve-next-damage',
      playerId: owner,
    })
    expect(manuallySettled.players[owner].battleArea.find(
      cookie => cookie.card.instanceId === windArcher.card.instanceId,
    )?.hpCards).toHaveLength(2)

    const next = takeAiStep(state, owner, {
      level: 5,
      seed: 206002100,
      searchNow: () => 0,
    })
    expect(next.action).toBe('play-trap')
    const command = chosenTrap(state, next)
    expect(command.trapInstanceId).toBe(trap.instanceId)
    expect(command.trashBattleCookieIds).toEqual([blueberryPie.card.instanceId])
    expect(next.state.players[owner].discardPile.some(
      card => card.instanceId === blueberryPie.card.instanceId,
    )).toBe(true)
    expect(next.state.players[owner].battleArea.some(
      cookie => cookie.card.instanceId === windArcher.card.instanceId,
    )).toBe(true)
    expect(getAttackDamageAgainst(next.state, attackerId, targetId)).toBe(0)

    const settled = applyGameCommand(next.state, {
      kind: 'resolve-next-damage',
      playerId: owner,
    })
    const survivingWindArcher = settled.players[owner].battleArea.find(
      cookie => cookie.card.instanceId === windArcher.card.instanceId,
    )
    expect(survivingWindArcher?.hpCards).toHaveLength(2)
  })

  it('counts the printed Arena Trap after it enters trash before BS12-087 Then', () => {
    const { state, trap } = createTerminalTrapScenario('BS12-087', 'purple', 2)
    const attackerId = state.pendingBattle!.attackerInstanceId
    const defenderId = state.pendingBattle!.targetInstanceId
    addPrintedArenaCardsToTrash(state, 9)
    const initialDamage = getAttackDamageAgainst(state, attackerId, defenderId)
    if (initialDamage > 3) throw new Error(`Expected a baseline attack of at most 3, received ${initialDamage}`)
    if (initialDamage < 3) state.attackModifiers.push({
      sourceInstanceId: 'public-attack-boost',
      targetInstanceId: attackerId,
      amount: 3 - initialDamage,
      expiresAfterTurn: state.turnNumber,
    })
    expect(getAttackDamageAgainst(state, attackerId, defenderId)).toBe(3)
    expect(state.players[owner].discardPile.filter(card =>
      card.keywords?.some(keyword => keyword.toLowerCase() === 'arena'),
    )).toHaveLength(9)

    const next = takeAiStep(state, owner, { level: 5, seed: 204512104, searchNow: () => 0 })
    expect(next.action).toBe('play-trap')
    const command = chosenTrap(state, next)
    expect(command.trapInstanceId).toBe(trap.instanceId)
    expect(command.targetIds).toEqual([attackerId])
    expect(command.effectTargets).toEqual([[attackerId]])
    expect(getAttackDamageAgainst(next.state, attackerId, defenderId)).toBe(0)
    expect(next.state.players[owner].discardPile.filter(card =>
      card.keywords?.some(keyword => keyword.toLowerCase() === 'arena'),
    )).toHaveLength(10)
    const settled = applyGameCommand(next.state, { kind: 'resolve-next-damage', playerId: owner })
    expect(settled.status).toBe('playing')
    expect(settled.players[owner].battleArea[0]?.hpCards).toHaveLength(1)
  })

  it('does not error when BS10-116 Then removes the Beast attacker', () => {
    const { state, trap } = createTerminalTrapScenario('BS10-116', 'purple', 2)
    const attackerPlayer = state.players['player-one']
    const originalAttacker = attackerPlayer.battleArea.find(cookie =>
      cookie.card.instanceId === state.pendingBattle!.attackerInstanceId,
    )
    const beast = printed('BS8-059', 'player-one', 4)
    if (!originalAttacker || beast.type !== 'cookie' ||
      !beast.keywords?.some(keyword => keyword.toLowerCase() === 'beast')) {
      throw new Error('Expected a printed Beast Cookie attacker')
    }
    if (attackerPlayer.deck.length === 0) throw new Error('Expected a deck card to replace in the fixture')
    // Exchange one deck card for the Beast so this synthetic battle keeps its
    // original 60-card scenario size while using the printed Beast identity.
    attackerPlayer.deck[0] = originalAttacker.card
    attackerPlayer.battleArea = attackerPlayer.battleArea.map(cookie =>
      cookie.card.instanceId === originalAttacker.card.instanceId
        ? { ...cookie, card: beast }
        : cookie,
    )
    state.pendingBattle!.attackerInstanceId = beast.instanceId
    const attackerId = beast.instanceId
    const defenderId = state.pendingBattle!.targetInstanceId
    const initialDamage = getAttackDamageAgainst(state, attackerId, defenderId)
    if (initialDamage > 3) throw new Error(`Expected a baseline attack of at most 3, received ${initialDamage}`)
    if (initialDamage < 3) state.attackModifiers.push({
      sourceInstanceId: 'public-attack-boost',
      targetInstanceId: attackerId,
      amount: 3 - initialDamage,
      expiresAfterTurn: state.turnNumber,
    })
    expect(getAttackDamageAgainst(state, attackerId, defenderId)).toBe(3)

    const next = takeAiStep(state, owner, { level: 5, seed: 204512105, searchNow: () => 0 })
    expect(next.action).toBe('play-trap')
    const command = chosenTrap(state, next)
    expect(command.trapInstanceId).toBe(trap.instanceId)
    expect(command.targetIds).toEqual([attackerId])
    expect(next.state.players['player-one'].battleArea.some(cookie =>
      cookie.card.instanceId === attackerId,
    )).toBe(false)
    expect(next.state.players[owner].battleArea).toHaveLength(1)
    expect(next.state.players[owner].battleArea[0]?.hpCards).toHaveLength(1)
  })

  it('does not score BS1-051 as a rescue when HP gain is prohibited', () => {
    const { state } = createTerminalTrapScenario('BS1-051', 'yellow', 1)
    state.preventHpGainThisTurn = { ...state.preventHpGainThisTurn, [owner]: true }
    const before = structuredClone(state)
    const next = takeAiStep(state, owner, { level: 5, seed: 204512102, searchNow: () => 0 })
    const commands = next.state.commandLog?.slice(state.commandLog?.length ?? 0) ?? []

    expect(commands.some(entry => entry.commandKind === 'skip-trap')).toBe(true)
    expect(commands.some(entry => entry.commandKind === 'play-trap')).toBe(false)
    expect(state).toEqual(before)
  })

  it('skips BS12-105 when the actual battle area has no black Arena Cookie', () => {
    const state = createAiTrapTargetPreview()
    const target = replaceBattleCookieWithPrinted(state, owner, 0, 'BS11-113', 4)
    state.pendingBattle!.targetInstanceId = target.card.instanceId
    const trap = replaceTrapAndEnergy(state, 'BS12-105', 'black', 1)
    const before = structuredClone(state)
    const battleCookies = state.players[owner].battleArea

    expect(battleCookies).toHaveLength(1)
    expect(battleCookies.some(cookie => cookie.card.id === 'BS11-113')).toBe(true)
    expect(battleCookies.some(cookie => cookie.card.keywords?.some(
      keyword => keyword.toLowerCase() === 'arena',
    ))).toBe(false)

    const next = takeAiStep(state, owner, { level: 5, seed: 204512106, searchNow: () => 0 })
    const commands = next.state.commandLog?.slice(state.commandLog?.length ?? 0) ?? []

    expect(commands.some(entry => entry.commandKind === 'skip-trap')).toBe(true)
    expect(commands.some(entry => entry.commandKind === 'play-trap')).toBe(false)
    expect(next.state.players[owner].hand.some(card => card.instanceId === trap.instanceId)).toBe(true)
    expect(next.state.players[owner].supportArea.every(support => !support.rested)).toBe(true)
    expect(state).toEqual(before)
  })

  it('does not score a trap as lethal when public damage prevention makes the attack harmless', () => {
    const { state } = createTerminalTrapScenario('BS1-051', 'yellow', 1)
    const defenderId = state.pendingBattle!.targetInstanceId
    state.damageReceivedModifiers = [...state.damageReceivedModifiers, {
      sourceInstanceId: 'public-damage-shield',
      targetInstanceId: defenderId,
      amount: -2,
      damageType: 'attack',
      expiresAfterTurn: state.turnNumber,
    }]
    expect(getAttackDamageAgainst(state, state.pendingBattle!.attackerInstanceId, defenderId)).toBe(0)

    const next = takeAiStep(state, owner, { level: 5, seed: 204512103, searchNow: () => 0 })
    const commands = next.state.commandLog?.slice(state.commandLog?.length ?? 0) ?? []
    expect(commands.some(entry => entry.commandKind === 'skip-trap')).toBe(true)
    expect(commands.some(entry => entry.commandKind === 'play-trap')).toBe(false)
  })

  it.each([3, 4, 5] as const)('Lv.%s targets the attacker instead of a valuable rested Cookie', level => {
    const state = createAiTrapTargetPreview(), before = structuredClone(state)
    for (const player of Object.values(state.players)) {
      const cards = [...player.deck, ...player.hand, ...player.supportArea.map(s => s.card),
        ...player.battleArea.flatMap(s => [s.card, ...s.hpCards])]
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(c => c.instanceId)).size).toBe(60)
      expect(player.battleArea.length).toBeLessThanOrEqual(2)
      const counts = new Map<string, number>()
      for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      expect([...counts.values()].every(n => n <= 4)).toBe(true)
    }
    expect(state.pendingBattle?.stage).toBe('trap')
    expect(state.players['player-one'].supportArea.every(s => s.rested)).toBe(true)
    const next = takeAiStep(state, owner, { level, seed: 2026121993, searchNow: () => 0 })
    const command = chosenTrap(state, next)
    expect(command.targetIds).toEqual([state.pendingBattle!.attackerInstanceId])
    expect(command.paymentIds).toHaveLength(1)
    expect(command.supportTrashIds).toHaveLength(1)
    const settled = applyGameCommand(next.state, { kind: 'resolve-next-damage', playerId: owner })
    expect(settled.players[owner].battleArea[0].hpCards).toHaveLength(2)
    expect(settled.players[owner].supportArea).toHaveLength(1)
    expect(state).toEqual(before)
  })

  // Original public card effects with synthetic policy variants. These are
  // not additional individual physical-card or complete-deck acceptance cases.
  it.each([
    ['ST8-018', 'ST3-016'], ['BS12-065', 'ST4-020'],
    ['BS12-087', 'ST5-020'], ['ST10-019', 'ST5-020'], ['BS12-105', 'BS11-110'],
  ])('uses the actual mitigation of %s instead of card retention', (trapId, supportId) => {
    const state = createAiTrapTargetPreview()
    state.players[owner].hand = [printed(trapId)]
    state.players[owner].supportArea = [1, 2].map(copy => ({ card: printed(supportId, owner, copy), rested: false }))
    if (trapId === 'BS12-105') {
      const card = printed('BS12-112')
      if (card.type !== 'cookie') throw new Error('Expected Cookie')
      state.players[owner].battleArea[0].card = card
      state.pendingBattle!.targetInstanceId = card.instanceId
    }
    const before = structuredClone(state)
    const next = takeAiStep(state, owner, { level: 5, seed: 2026121993, searchNow: () => 0 })
    expect(chosenTrap(state, next).targetIds).toEqual([state.pendingBattle!.attackerInstanceId])
    expect(state).toEqual(before)
  })

  it.each(['nonlethal', 'immune'] as const)('preserves normal selection without a saving current-attack reduction (%s)', variant => {
    const state = createAiTrapTargetPreview()
    if (variant === 'nonlethal') state.players[owner].battleArea[0].hpCards.push(printed('ST1-020'))
    else state.damageReceivedModifiers.push({ sourceInstanceId: 'public-protection',
      targetInstanceId: state.pendingBattle!.targetInstanceId, amount: -2,
      damageType: 'attack', expiresAfterTurn: state.turnNumber })
    const next = takeAiStep(state, owner, { level: 5, seed: 2026121993, searchNow: () => 0 })
    expect(chosenTrap(state, next).targetIds).toEqual([state.players['player-one'].battleArea[1].card.instanceId])
  })

  it('does not use hidden deck or HP faces to choose the saving target', () => {
    const state = createAiTrapTargetPreview()
    for (const player of Object.values(state.players)) {
      player.deck = player.deck.map(card => ({ ...printed('BS12-060', player.id), instanceId: card.instanceId }))
      for (const source of player.battleArea) source.hpCards = source.hpCards.map(card =>
        ({ ...printed('BS12-060', player.id), instanceId: card.instanceId }))
    }
    const next = takeAiStep(state, owner, { level: 5, seed: 2026121993, searchNow: () => 0 })
    expect(chosenTrap(state, next).targetIds).toEqual([state.pendingBattle!.attackerInstanceId])
  })
})
