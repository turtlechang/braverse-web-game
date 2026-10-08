import { readdirSync, readFileSync } from 'node:fs'
import { expect } from 'vitest'
import candidateDocument from '../../data/candidates/official-festival-arena-bs12.en.json'
import { convertOfficialCardToExtraDeckCard, convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import type { GameState } from './types'
import { materializeExtraDeckCookie } from './extra-deck'

const directory = new URL('../../data/cards/', import.meta.url)
const records: OfficialCardRecord[] = [...candidateDocument.cards, ...readdirSync(directory)
  .filter(file => file.endsWith('.json'))
  .flatMap(file => (JSON.parse(readFileSync(new URL(file, directory), 'utf8')) as { cards: OfficialCardRecord[] }).cards ?? [])] as OfficialCardRecord[]

export const printedFixtureCard = (number: string, instanceId: string) => {
  const record = records.find(record => record.cardNumber === number)
  if (!record) throw new Error(`Missing physical card ${number}`)
  const converted = convertOfficialCardToGameCard(record)
  if (converted.status !== 'converted') throw new Error(`Unconverted physical card ${number}`)
  return { ...converted.gameCard, instanceId }
}

export const assertBs12PhysicalFixture = (state: GameState) => {
  for (const player of Object.values(state.players)) {
    const owned = [...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
      ...player.supportArea.map(entry => entry.card),
      ...player.battleArea.flatMap(entry => [entry.card, ...entry.hpCards, ...(entry.equippedCards ?? []), ...(entry.awakenedUnderlay ?? [])]),
      ...(player.stage ? [player.stage.card] : [])]
    if (state.pendingBattle?.revealedHpCard && (state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId) === player.id) owned.push(state.pendingBattle.revealedHpCard)
    for (const card of owned) {
      const record = records.find(record => record.imageUrl === card.imageUrl && record.baseCardNumber === card.id)
      expect(record, `No physical record for ${card.instanceId} / ${card.id}`).toBeDefined()
      if (record?.type === 'extra') {
        const converted = convertOfficialCardToExtraDeckCard(record)
        expect(converted.status).toBe('converted')
        if (converted.status === 'converted') expect(card).toEqual(materializeExtraDeckCookie({ ...converted.extraDeckCard, instanceId: card.instanceId }))
      } else {
        const converted = convertOfficialCardToGameCard(record!, card.instanceId)
        expect(converted.status).toBe('converted')
        if (converted.status === 'converted') expect(card).toEqual({ ...converted.gameCard, instanceId: card.instanceId })
      }
    }
    for (const host of player.battleArea) for (const equipment of host.equippedCards ?? []) {
      if (equipment.id === 'BS12-007') expect(host.card.name, `Producer Mic cannot equip ${host.card.name}`).toBe('Shining Glitter Cookie')
    }
    const extras = player.extraDeck ?? []
    for (const card of extras) {
      const record = records.find(record => record.imageUrl === card.imageUrl && record.baseCardNumber === card.id)
      expect(record, `No physical EXTRA record for ${card.instanceId}`).toBeDefined()
      const converted = convertOfficialCardToExtraDeckCard(record!)
      expect(converted.status).toBe('converted')
      if (converted.status === 'converted') expect(card).toEqual({ ...converted.extraDeckCard, instanceId: card.instanceId })
    }
    const all = [...owned, ...extras]
    expect(new Set(all.map(card => card.instanceId)).size).toBe(all.length)
    for (const id of new Set(all.map(card => card.id))) expect(all.filter(card => card.id === id).length, `${player.id} ${id} copies`).toBeLessThanOrEqual(4)
  }
}
