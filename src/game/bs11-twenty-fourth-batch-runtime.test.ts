import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { createBattleState, cookie, item } from './test-helpers/battle-helpers'
import type { CardSkill, CookieCard, CookieInBattle, GameCard, GameState } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const candidate = (cardNumber: string): CookieCard => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  const result = convertOfficialCardToGameCard(record, `bs11-twenty-fourth-${cardNumber}`)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') {
    throw new Error(`${cardNumber} did not convert to a Cookie`)
  }
  return { ...result.gameCard, instanceId: `${cardNumber}:source` }
}

const entry = (card: CookieCard, hpCards: GameCard[]): CookieInBattle => ({
  card,
  hpCards,
  rested: false,
  battleEntryId: `${card.instanceId}:battle`,
})

const specialPlayCookie = (): CookieCard => {
  const skill: CardSkill = {
    trigger: 'activate',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: { energy: {}, discardHand: 0 },
    specialPlayCost: { energy: { red: 1 }, discardHand: 0 },
    text: 'Special Play: place a black LV.1 Cookie from your battle area into the trash.',
    effects: [],
  }
  return { ...cookie('bs11-097:special-play', 1, 2), skill }
}

const makeState = (source: CookieCard): GameState => {
  const base = createBattleState()
  const legalTarget = cookie('bs11-097:legal-target', 1, 2)
  const skilledTarget: CookieCard = {
    ...cookie('bs11-097:skilled-target', 1, 2),
    skill: {
      trigger: 'passive',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      text: 'A different skill',
      effects: [],
    },
  }
  return {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        hand: [],
        battleArea: [
          entry(legalTarget, [item('bs11-097:legal-hp-1'), item('bs11-097:legal-hp-2')]),
          entry(skilledTarget, [item('bs11-097:skilled-hp-1'), item('bs11-097:skilled-hp-2')]),
        ],
      },
      'player-two': {
        ...base.players['player-two'],
        hand: [item('bs11-097:discard-cost')],
        battleArea: [
          entry(source, [item(`${source.instanceId}:hp-1`), item(`${source.instanceId}:hp-2`)]),
          entry(specialPlayCookie(), [item('bs11-097:special-hp-1'), item('bs11-097:special-hp-2')]),
        ],
        supportArea: [{ card: item('bs11-097:black-energy', 'black'), rested: false }],
        deck: Array.from({ length: 8 }, (_, index) => item(`bs11-097:deck-${index}`)),
        discardPile: [],
      },
    },
  }
}

const activate = (
  state: GameState,
  source: CookieCard,
  paymentIds: string[] = ['bs11-097:black-energy'],
  discardHandIds: string[] = ['bs11-097:discard-cost'],
): GameState => applyGameCommand(state, {
  kind: 'begin-activate-skill',
  playerId: 'player-two',
  sourceInstanceId: source.instanceId,
  trigger: 'activate',
  paymentIds,
  discardHandIds,
})

describe('BS11-097～099 Special Play gate runtime', () => {
  it('Cream Jelly Worm pays K plus a card and faints only a legal LV.1 no-skill target', () => {
    const source = candidate('BS11-097')
    let current = activate(makeState(source), source)
    expect(current.pendingAbilityEffect).toMatchObject({ effectIndex: 0 })

    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: ['bs11-097:legal-target'],
    })
    expect(current.players['player-one'].battleArea.map((entry) => entry.card.instanceId))
      .toEqual(['bs11-097:skilled-target'])
    expect(current.players['player-one'].breakArea.map((card) => card.instanceId))
      .toContain('bs11-097:legal-target')
    expect(current.players['player-two'].hand).toEqual([])
  })

  it('Cream Skelecake Archer deals damage only when the Special Play Cookie exists', () => {
    const source = candidate('BS11-098')
    let current = activate(makeState(source), source, ['bs11-097:black-energy'], [])
    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: ['bs11-097:legal-target'],
    })
    expect(current.players['player-one'].battleArea[0]?.hpCards).toHaveLength(1)
  })

  it('Cream Roll Hog Rider sends itself to trash under the same gate', () => {
    const source = candidate('BS11-099')
    let current = activate(makeState(source), source, [], [])
    current = applyGameCommand(current, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: [source.instanceId],
    })
    expect(current.players['player-two'].battleArea.map((entry) => entry.card.instanceId))
      .toEqual(['bs11-097:special-play'])
    expect(current.players['player-two'].discardPile.map((card) => card.instanceId))
      .toContain(source.instanceId)
  })
})
