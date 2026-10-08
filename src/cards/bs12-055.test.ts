import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

// Both complete printed images independently inspected: Cozy Ensemble, G / 1.
it.each(['BS12-055', 'BS12-055@1'])('%s requires this battle entry from support this turn and pays both costs even for zero', number => {
  const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', name: 'Herb Cookie', energyColor: 'green', keywords: ['arena'], level: 2, hp: 2, attack: 1,
    attackEnergyCost: { green: 1 }, imageUrl: record.imageUrl,
    skill: { trigger: 'activate', oncePerTurn: false, yourTurn: false, restSource: false,
      activationOriginThisTurn: 'support', cost: { energy: {}, discardHand: 1, selfToTrash: true },
      effects: [{ kind: 'choose-one', modes: [
        { label: '將牌庫頂 1 張卡以疲勞狀態放入支援區', effects: [{ kind: 'deck-to-support', amount: 1, rested: true }] },
        { label: '不放置卡牌', effects: [{ kind: 'deck-to-support', amount: 0, rested: true }] },
      ] }],
    },
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie' || !converted.gameCard.skill) throw new Error('Missing Herb skill')
  const card = converted.gameCard
  expect(card.attackEffects ?? []).toHaveLength(0)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  for (const patch of [{ activationOriginThisTurn: undefined }, { trigger: 'on-play' as const }, { oncePerTurn: true }, { yourTurn: true }, { restSource: true }, { fromSupportArea: true }, { cost: { energy: {}, discardHand: 1 } }, { cost: { energy: {}, selfToTrash: true } }, { effects: [{ kind: 'deck-to-support' as const, amount: 1, rested: true }] }]) {
    expect(analyzeOfficialCardBehavior(record, { ...card, skill: { ...card.skill!, ...patch } }).contract.status).not.toBe('verified')
  }
})
