/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import candidate from '../../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from '../../cards/types'
import { convertOfficialCardToGameCard } from '../../cards/official-card-adapter'
import { CardPreviewPanel } from './InteractionOverlays'

it.each(['BS12-095', 'BS12-096', 'BS12-098'])('actual %s quick preview shows the independent Special Play cost', async number => {
  const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing actual Cake Hound')
  const card = result.gameCard
  expect(card.effectText).toBe(card.flip?.text)
  const host = document.createElement('div'), root = createRoot(host)
  document.body.append(host)
  try {
    await act(() => root.render(<CardPreviewPanel card={card} />))
    const text = host.querySelector('.card-preview-effect')?.textContent
    expect(text).toMatch(/Special Play.*Place 1.*LV\.1 Cookie from your battle area into your trash/)
    expect(text).not.toMatch(/gains \+1 HP|draw up to 2 cards|Discard 1 card/)
  } finally { await act(() => root.unmount()); host.remove() }
})

it('a real FLIP-only Cookie retains its printed FLIP in the quick preview', async () => {
  const record = candidate.cards.find(card => card.cardNumber === 'BS12-002') as OfficialCardRecord
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing actual FLIP Cookie')
  expect(result.gameCard.skill).toBeUndefined()
  const host = document.createElement('div'), root = createRoot(host)
  document.body.append(host)
  try {
    await act(() => root.render(<CardPreviewPanel card={result.gameCard} />))
    expect(host.querySelector('.card-preview-effect')?.textContent).toMatch(/Discard 1 card\./)
    expect(host.querySelector('.card-preview-effect')?.textContent).toMatch(/gains \+1 HP/)
  } finally { await act(() => root.unmount()); host.remove() }
})
