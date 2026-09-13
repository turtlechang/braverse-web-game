import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import {
  convertOfficialCardToExtraDeckCard,
  convertOfficialCardToGameCard,
} from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
} from './demo'
import { applyGameCommand } from './commands'
import {
  canActivateCookieSkill,
  getCookieSkillUnavailableReason,
} from './skills'
import { getEffectiveAttack } from './effects'
import type { ExtraDeckCard, GameCard, GameState } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const record = (cardNumber: string): OfficialCardRecord => {
  const found = records.find((card) => card.cardNumber === cardNumber)
  if (!found) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  return found
}

const candidate = (cardNumber: string): GameCard => {
  const conversion = convertOfficialCardToGameCard(record(cardNumber), 'bs9-051-070-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const extraCandidate = (cardNumber: string) => {
  const conversion = convertOfficialCardToExtraDeckCard(record(cardNumber), 'bs9-051-070-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.extraDeckCard
}

const sourceInBattle = (state: GameState, cardNumber: string) => {
  const source = state.players['player-one'].battleArea.find(
    (entry) => entry.card.id === cardNumber,
  )
  if (!source) throw new Error(`${cardNumber} source is not in battle area`)
  return source
}

const sourceInHand = (state: GameState, cardNumber: string) => {
  const source = state.players['player-one'].hand.find(
    (card) => card.id === cardNumber,
  )
  if (!source) throw new Error(`${cardNumber} source is not in hand`)
  return source
}

const allFixtureCards = (state: GameState): Array<GameCard | ExtraDeckCard> => {
  const cards: Array<GameCard | ExtraDeckCard> = []
  for (const player of Object.values(state.players)) {
    cards.push(
      ...player.deck,
      ...(player.extraDeck ?? []),
      ...player.hand,
      ...player.breakArea,
      ...player.discardPile,
      ...player.supportArea.map((entry) => entry.card),
      ...(player.stage ? [player.stage.card] : []),
      ...player.battleArea.flatMap((entry) => [
        entry.card,
        ...entry.hpCards,
        ...(entry.equippedCards ?? []),
        ...(entry.awakenedUnderlay ?? []),
      ]),
    )
  }
  if (state.pendingBattle?.revealedHpCard) cards.push(state.pendingBattle.revealedHpCard)
  return cards
}

describe('BS9-051～070 candidate-isolated conversion and rules', () => {
  it('keeps every candidate/alternate art converted and every physical fixture official', () => {
    const cardNumbers = records
      .filter((card) => {
        const number = Number(card.baseCardNumber.split('-')[1])
        return number >= 51 && number <= 70
      })
      .map((card) => card.cardNumber)

    expect(cardNumbers).toHaveLength(28)
    for (const cardNumber of cardNumbers) {
      const source = record(cardNumber)
      const conversion = source.type === 'extra'
        ? convertOfficialCardToExtraDeckCard(source, 'fixture')
        : convertOfficialCardToGameCard(source, 'fixture')
      expect(conversion.status, cardNumber).toBe('converted')

      for (const state of [
        createCardCheckDemoState(cardNumber),
        createCardNegativeDemoState(cardNumber),
      ]) {
        const cards = allFixtureCards(state)
        expect(cards.length, `${cardNumber} fixture should contain cards`).toBeGreaterThan(0)
        for (const card of cards) {
          expect(card.id, `${cardNumber} fixture card`).toMatch(
            /^(?:BS\d+-\d{3}|ST\d+-\d{3}|P-\d{3})(?:@\d+)?$/,
          )
        }
      }
    }
  })

  it('preserves the printed cost, timing, condition, and Then boundaries', () => {
    for (const cardNumber of ['BS9-051', 'BS9-051@1']) {
      expect(candidate(cardNumber)).toMatchObject({
        flip: { cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw-up-to', max: 1 }] },
      })
    }
    expect(candidate('BS9-052')).toMatchObject({
      skill: {
        trigger: 'passive',
        effects: [{
          kind: 'modify-attack',
          amount: 1,
          duration: 'persistent',
          target: { sourceOnly: true },
          condition: { kind: 'support-count-at-least', count: 7 },
        }],
      },
    })
    for (const cardNumber of ['BS9-053', 'BS9-053@1']) {
      expect(candidate(cardNumber)).toMatchObject({
        flip: {
          effects: [{
            kind: 'support-to-hand',
            amount: 3,
            optional: true,
            thenEffects: [{
              kind: 'hand-to-support',
              sameAmountAsPreviousEffect: true,
              amount: 0,
              energyColor: 'green',
              rested: true,
            }],
          }],
        },
      })
    }
    expect(candidate('BS9-054')).toMatchObject({
      skill: {
        trigger: 'activate',
        oncePerTurn: true,
        cost: { supportToTrash: 2 },
        effects: [{ kind: 'modify-attack', amount: 1, duration: 'this-turn' }],
      },
    })
    for (const cardNumber of ['BS9-055', 'BS9-055@1']) {
      expect(extraCandidate(cardNumber)).toMatchObject({
        extraDeckPlayMode: 'enter-battle',
        playRequirement: {
          kind: 'all-of',
          conditions: [
            { kind: 'opponent-support-count-at-least', count: 3 },
            { kind: 'support-cards-trashed-this-turn-at-least', count: 2 },
          ],
        },
        skill: {
          trigger: 'activate',
          oncePerTurn: true,
          effects: [{ kind: 'deck-to-support', amount: 1, rested: true }],
        },
        attackEffects: [{
          kind: 'optional-cost-attack',
          cost: { supportToHand: 1 },
          effects: [{ kind: 'damage', amount: 1 }],
        }],
      })
    }
    expect(candidate('BS9-059')).toMatchObject({
      attackEffects: [{
        kind: 'optional-cost-attack',
        cost: { selfToTrash: true, supportToTrash: 2 },
        effects: [{ kind: 'draw-up-to', max: 2 }],
      }],
    })
    for (const cardNumber of ['BS9-060', 'BS9-060@1', 'BS9-060@2']) {
      expect(candidate(cardNumber)).toMatchObject({
        skill: { cost: { supportToTrash: 2 }, effects: [{ kind: 'set-active', supportCount: 2 }] },
        attackEffects: [{ kind: 'damage', amount: 1, condition: { kind: 'opponent-support-count-at-least', count: 6 } }],
      })
    }
    expect(candidate('BS9-061')).toMatchObject({
      skill: {
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'deck-to-support', amount: 1, rested: true, condition: { kind: 'support-cards-trashed-this-turn-at-least', count: 2 } }],
      },
    })
    expect(candidate('BS9-062')).toMatchObject({ attackEffects: [{ kind: 'support-to-trash', amount: 2 }] })
    for (const cardNumber of ['BS9-063', 'BS9-063@1']) {
      expect(candidate(cardNumber)).toMatchObject({
        skill: {
          cost: { selfToTrash: true },
          effects: [
            { kind: 'draw-up-to', max: 2, condition: { kind: 'support-cards-trashed-this-turn-at-least', count: 2 } },
            { kind: 'discard-hand', count: 1, condition: { kind: 'support-cards-trashed-this-turn-at-least', count: 2 } },
          ],
        },
      })
    }
    for (const cardNumber of ['BS9-064', 'BS9-064@1']) {
      expect(candidate(cardNumber)).toMatchObject({ skill: { faint: true, effects: [{ kind: 'support-to-trash', amount: 1, side: 'opponent' }] } })
    }
    for (const cardNumber of ['BS9-065', 'BS9-065@1']) {
      expect(candidate(cardNumber)).toMatchObject({
        skill: { cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'set-active', condition: { kind: 'battle-area-has-keyword', keyword: 'ancient', excludeSource: true } }] },
        attackEffects: [{ kind: 'optional-cost-attack', cost: { supportToTrash: 2 }, effects: [{ kind: 'gain-hp', amount: 1 }] }],
      })
    }
    expect(candidate('BS9-066')).toMatchObject({ item: { cost: { energy: { green: 1 }, supportToTrash: 1 }, effects: [{ kind: 'gain-hp', amount: 1 }] } })
    expect(candidate('BS9-067')).toMatchObject({ item: { cost: { energy: { green: 1 }, supportToTrash: 1 }, effects: [{ kind: 'draw-up-to', max: 2 }] } })
    expect(candidate('BS9-068')).toMatchObject({ trap: { condition: { kind: 'support-count-less-than-opponent', difference: 1 }, effects: [{ kind: 'modify-all-attack', amount: -1 }] } })
    expect(candidate('BS9-069')).toMatchObject({ trap: { effects: [{ kind: 'modify-attack', amount: -2 }, { kind: 'set-active', supportCount: 1, condition: { kind: 'opponent-support-count-at-least', count: 5 } }] } })
    expect(candidate('BS9-070')).toMatchObject({ stageAbility: { placementCost: { green: 1 }, cost: { energy: { green: 1 } }, restSource: true, effects: [{ kind: 'deck-to-support', amount: 1, rested: false }] } })
  })

  it('resolves both FLIP cards, including Cream Ferret same-count Then', () => {
    for (const cardNumber of ['BS9-051', 'BS9-051@1']) {
      let state = createCardCheckDemoState(cardNumber)
      state = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-one', activate: true })
      expect(state.pendingDrawUpTo?.max).toBe(1)
      state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 1 })
      expect(state.pendingBattle).toBeNull()
      expect(state.players['player-one'].discardPile.some((card) => card.id === 'BS9-051')).toBe(true)
    }

    for (const cardNumber of ['BS9-053', 'BS9-053@1']) {
      let state = createCardCheckDemoState(cardNumber)
      const returned = state.players['player-one'].supportArea.slice(0, 2).map((entry) => entry.card.instanceId)
      const greenHand = state.players['player-one'].hand.filter((card) => card.energyColor === 'green').slice(0, 2).map((card) => card.instanceId)
      expect(greenHand).toHaveLength(2)
      state = applyGameCommand(state, {
        kind: 'resolve-flip',
        playerId: 'player-one',
        activate: true,
        effectTargetIds: returned,
        thenTargetIds: greenHand,
      })
      expect(state.pendingBattle).toBeNull()
      expect(state.players['player-one'].supportArea.filter((entry) => greenHand.includes(entry.card.instanceId))).toHaveLength(2)
      expect(state.players['player-one'].supportArea.filter((entry) => greenHand.includes(entry.card.instanceId)).every((entry) => entry.rested)).toBe(true)
    }
  })

  it('enforces skill costs and conditions for 052, 054, 060, 061, 063, and 065', () => {
    const passive = createCardCheckDemoState('BS9-052', { normalAttack: 'payable' })
    const passiveSource = sourceInBattle(passive, 'BS9-052')
    expect(getEffectiveAttack(passive, passiveSource.card.instanceId)).toBe(3)
    const passiveNegative = createCardNegativeDemoState('BS9-052', { normalAttack: 'payable' })
    expect(getEffectiveAttack(passiveNegative, sourceInBattle(passiveNegative, 'BS9-052').card.instanceId)).toBe(2)

    let state = createCardCheckDemoState('BS9-054', { preferSkillSurface: true })
    let source = sourceInBattle(state, 'BS9-054')
    const supports = state.players['player-one'].supportArea.slice(0, 2).map((entry) => entry.card.instanceId)
    state = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [], costSupportToTrashIds: supports })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [source.card.instanceId] })
    expect(state.attackModifiers).toContainEqual(expect.objectContaining({ targetInstanceId: source.card.instanceId, amount: 1 }))
    expect(() => applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [] })).toThrow(/每回合一次/)
    const blocked054 = createCardNegativeDemoState('BS9-054', { preferSkillSurface: true })
    source = sourceInBattle(blocked054, 'BS9-054')
    expect(canActivateCookieSkill(blocked054, 'player-one', source.card.instanceId, 'activate')).toBe(false)
    expect(getCookieSkillUnavailableReason(blocked054, 'player-one', source.card.instanceId, 'activate')).toBeTruthy()

    for (const cardNumber of ['BS9-060', 'BS9-060@1', 'BS9-060@2']) {
      state = createCardCheckDemoState(cardNumber, { preferSkillSurface: true })
      source = sourceInBattle(state, 'BS9-060')
      const cost = state.players['player-one'].supportArea.slice(0, 2).map((entry) => entry.card.instanceId)
      state = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [], costSupportToTrashIds: cost })
      const rested = state.players['player-one'].supportArea.filter((entry) => entry.rested).slice(0, 2).map((entry) => entry.card.instanceId)
      state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: rested })
      expect(state.players['player-one'].supportArea.filter((entry) => rested.includes(entry.card.instanceId)).every((entry) => !entry.rested)).toBe(true)
    }

    state = createCardCheckDemoState('BS9-061', { preferSkillSurface: true })
    source = sourceInBattle(state, 'BS9-061')
    const deckTop = state.players['player-one'].deck[0]!.instanceId
    state = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [] })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(state.players['player-one'].supportArea.at(-1)).toMatchObject({ card: { instanceId: deckTop }, rested: true })
    const blocked061 = createCardNegativeDemoState('BS9-061', { preferSkillSurface: true })
    source = sourceInBattle(blocked061, 'BS9-061')
    expect(canActivateCookieSkill(blocked061, 'player-one', source.card.instanceId, 'activate')).toBe(false)

    state = createCardCheckDemoState('BS9-063', { preferSkillSurface: true })
    source = sourceInBattle(state, 'BS9-063')
    state = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [] })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(state.players['player-one'].battleArea.some((entry) => entry.card.id === 'BS9-063')).toBe(false)
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 2 })
    const discard = state.players['player-one'].hand[0]!.instanceId
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [discard] })
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.players['player-one'].discardPile.some((card) => card.id === 'BS9-063')).toBe(true)

    state = createCardCheckDemoState('BS9-065', { preferSkillSurface: true })
    source = sourceInBattle(state, 'BS9-065')
    const rested065 = state.players['player-one'].supportArea.find((entry) => entry.rested)!.card.instanceId
    state = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.card.instanceId, trigger: 'activate', paymentIds: [] })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [rested065] })
    expect(state.players['player-one'].supportArea.find((entry) => entry.card.instanceId === rested065)?.rested).toBe(false)
    const blocked065 = createCardNegativeDemoState('BS9-065', { preferSkillSurface: true })
    source = sourceInBattle(blocked065, 'BS9-065')
    expect(canActivateCookieSkill(blocked065, 'player-one', source.card.instanceId, 'activate')).toBe(false)
  })

  it('resolves EXTRA, attack Then, item, faint, trap, and stage boundaries', () => {
    let state = createCardCheckDemoState('BS9-055')
    const extra = state.players['player-one'].extraDeck![0]!
    state = applyGameCommand(state, { kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: extra.instanceId })
    const extraSource = sourceInBattle(state, 'BS9-055')
    state = applyGameCommand(state, { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: extraSource.card.instanceId, trigger: 'activate', paymentIds: [] })
    const deckTop = state.players['player-one'].deck[0]!.instanceId
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(state.players['player-one'].supportArea.at(-1)).toMatchObject({ card: { instanceId: deckTop }, rested: true })
    expect(() => applyGameCommand(createCardNegativeDemoState('BS9-055'), { kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: createCardNegativeDemoState('BS9-055').players['player-one'].extraDeck![0]!.instanceId })).toThrow()

    state = createCardCheckDemoState('BS9-055', { normalAttack: 'payable' })
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
    const supportToHand = state.players['player-one'].supportArea[0]!.card.instanceId
    const opponent = state.players['player-two'].battleArea[0]!.card.instanceId
    const hpBefore055 = state.players['player-two'].battleArea[0]!.hpCards.length
    state = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', supportToHandIds: [supportToHand], targetIds: [opponent] })
    expect(state.players['player-two'].battleArea[0]!.hpCards).toHaveLength(hpBefore055 - 1)

    state = createCardCheckDemoState('BS9-059', { normalAttack: 'payable' })
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
    const costSupports059 = state.players['player-one'].supportArea.slice(0, 2).map((entry) => entry.card.instanceId)
    state = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', supportToTrashIds: costSupports059, targetIds: [] })
    expect(state.players['player-one'].battleArea).toHaveLength(0)
    state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 2 })
    expect(state.pendingBattle).toBeNull()

    for (const cardNumber of ['BS9-060', 'BS9-060@1', 'BS9-060@2']) {
      state = createCardCheckDemoState(cardNumber, { normalAttack: 'payable' })
      const target = state.players['player-two'].battleArea[0]!.card.instanceId
      const hpBefore = state.players['player-two'].battleArea[0]!.hpCards.length
      state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [target] })
      expect(state.players['player-two'].battleArea[0]!.hpCards).toHaveLength(hpBefore - 1)
    }

    state = createCardCheckDemoState('BS9-062', { normalAttack: 'payable' })
    const costSupports062 = state.players['player-one'].supportArea.slice(0, 2).map((entry) => entry.card.instanceId)
    state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: costSupports062 })
    expect(state.players['player-one'].supportArea).toHaveLength(4)
    const blocked062 = createCardNegativeDemoState('BS9-062')
    expect(blocked062.pendingBattle).toBeNull()
    expect(blocked062.players['player-one'].supportArea.every((entry) => entry.rested)).toBe(true)

    for (const cardNumber of ['BS9-066', 'BS9-067']) {
      state = createCardCheckDemoState(cardNumber)
      const item = sourceInHand(state, cardNumber)
      const energy = state.players['player-one'].supportArea[0]!.card.instanceId
      const supportCost = state.players['player-one'].supportArea[1]!.card.instanceId
      state = applyGameCommand(state, { kind: 'begin-play-item', playerId: 'player-one', instanceId: item.instanceId, paymentIds: [energy], supportToTrashIds: [supportCost] })
      const target = state.players['player-one'].battleArea[0]!.card.instanceId
      state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: cardNumber === 'BS9-066' ? [target] : [] })
      if (cardNumber === 'BS9-067') state = applyGameCommand(state, { kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 2 })
      expect(state.pendingAbilityEffect).toBeUndefined()
    }

    for (const cardNumber of ['BS9-064', 'BS9-064@1']) {
      state = createCardCheckDemoState(cardNumber)
      const faintSupport = state.players['player-two'].supportArea[0]!.card.instanceId
      state = applyGameCommand(state, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [faintSupport] })
      expect(state.players['player-two'].discardPile.some((card) => card.instanceId === faintSupport)).toBe(true)
    }

    state = createCardCheckDemoState('BS9-068')
    const trap068 = sourceInHand(state, 'BS9-068')
    const payment068 = state.players['player-one'].supportArea[0]!.card.instanceId
    state = applyGameCommand(state, { kind: 'play-trap', playerId: 'player-one', trapInstanceId: trap068.instanceId, paymentIds: [payment068], targetIds: [], effectTargets: [[]] })
    expect(state.attackModifiers.filter((modifier) => modifier.sourceInstanceId === trap068.instanceId)).toHaveLength(2)
    expect(() => applyGameCommand(createCardNegativeDemoState('BS9-068'), { kind: 'play-trap', playerId: 'player-one', trapInstanceId: sourceInHand(createCardNegativeDemoState('BS9-068'), 'BS9-068').instanceId, paymentIds: [createCardNegativeDemoState('BS9-068').players['player-one'].supportArea[0]!.card.instanceId], targetIds: [] })).toThrow()

    state = createCardCheckDemoState('BS9-069')
    const trap069 = sourceInHand(state, 'BS9-069')
    const payment069 = state.players['player-one'].supportArea.filter((entry) => !entry.rested).slice(0, 2).map((entry) => entry.card.instanceId)
    const target069 = state.players['player-two'].battleArea[0]!.card.instanceId
    const rested069 = state.players['player-one'].supportArea.find((entry) => entry.rested)!.card.instanceId
    state = applyGameCommand(state, { kind: 'play-trap', playerId: 'player-one', trapInstanceId: trap069.instanceId, paymentIds: payment069, targetIds: [], effectTargets: [[target069], [rested069]] })
    expect(state.attackModifiers).toContainEqual(expect.objectContaining({ sourceInstanceId: trap069.instanceId, amount: -2 }))
    expect(state.players['player-one'].supportArea.find((entry) => entry.card.instanceId === rested069)?.rested).toBe(false)

    state = createCardCheckDemoState('BS9-070')
    const stage = sourceInHand(state, 'BS9-070')
    const placement = state.players['player-one'].supportArea[0]!.card.instanceId
    state = applyGameCommand(state, { kind: 'play-stage', playerId: 'player-one', instanceId: stage.instanceId, paymentIds: [placement] })
    const activation = state.players['player-one'].supportArea.find((entry) => !entry.rested)!.card.instanceId
    const top070 = state.players['player-one'].deck[0]!.instanceId
    state = applyGameCommand(state, { kind: 'begin-activate-stage', playerId: 'player-one', paymentIds: [activation] })
    state = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    expect(state.players['player-one'].stage?.rested).toBe(true)
    expect(state.players['player-one'].supportArea.at(-1)).toMatchObject({ card: { instanceId: top070 }, rested: false })
  })
})
