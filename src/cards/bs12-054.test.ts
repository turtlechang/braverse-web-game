import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-054', 'BS12-054@1'])('%s pays one any support then recovers zero or one any own trash Cookie as rested', number => {
  const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', name: 'Mint Choco Cookie', energyColor: 'green', keywords: ['arena'], level: 2, hp: 4, attack: 3,
    attackEnergyCost: { green: 2, neutral: 1 }, imageUrl: record.imageUrl,
    skill: { trigger: 'activate', oncePerTurn: true, yourTurn: false, restSource: false,
      cost: { energy: {}, supportToTrash: 1 }, effects: [{ kind: 'trash-to-support', amount: 1, cookieOnly: true, rested: true, optional: true }] },
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie' || !converted.gameCard.skill) throw new Error('Missing Mint Choco')
  const card = converted.gameCard
  expect(card.skill!.effects).toHaveLength(1)
  expect(card.attackEffects ?? []).toHaveLength(0)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  for (const patch of [{ trigger: 'on-play' as const }, { oncePerTurn: false }, { yourTurn: true }, { restSource: true }, { cost: { energy: {}, supportToTrash: 0 } }, { cost: { energy: {}, supportToTrash: 1, supportToTrashKeyword: 'arena' as const } }]) {
    expect(analyzeOfficialCardBehavior(record, { ...card, skill: { ...card.skill!, ...patch } }).contract.status).not.toBe('verified')
  }
  for (const patch of [{ cookieOnly: false }, { rested: false }, { optional: false }, { amount: 2 }, { keyword: 'arena' as const }, { energyColor: 'green' as const }, { maxLevel: 1 }]) {
    expect(analyzeOfficialCardBehavior(record, { ...card, skill: { ...card.skill!, effects: [{ ...card.skill!.effects[0], ...patch }] } }).contract.status).not.toBe('verified')
  }
})
