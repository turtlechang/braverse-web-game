/// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { createBs12BlueberryDemoState, createBs12CrimsonDemoState } from '../../game/demo'
import { CardDetailModal } from './GameModals'

it.each(['BS12-095', 'BS12-096'] as const)('%s details separately show printed Special Play skill, ordinary attack and independent FLIP', number => {
  const state = number === 'BS12-095' ? createBs12BlueberryDemoState('special') : createBs12CrimsonDemoState('special')
  const card = state.players['player-one'].hand[0], snapshot = structuredClone(card)
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(<CardDetailModal card={card} onClose={() => {}} />)
  const sections = [...container.querySelectorAll('.card-detail-rules > .card-rule-section')]
  expect(sections.map(section => section.querySelector('strong')?.textContent)).toEqual(['技能', '攻擊', 'FLIP'])
  expect(sections[0].textContent).toContain('【Special Play】 Place 1')
  expect(sections[0].textContent).toContain('LV.1 Cookie from your battle area into your trash.')
  expect(sections[0].textContent).not.toContain(number === 'BS12-095' ? 'Discard 1 card' : '5 cards or less')
  expect(sections[2].textContent).toContain(number === 'BS12-095' ? 'Discard 1 card' : '5 cards or less')
  expect(sections[2].textContent).toContain(number === 'BS12-095' ? 'gains +1 HP' : 'draw up to 2 cards')
  expect(sections[2].textContent).not.toContain('Special Play')
  expect(sections[1].querySelector('.attack-power-value')?.textContent).toBe('2')
  expect(container.querySelector('.detail-card img')?.getAttribute('src')).toBe(card.imageUrl)
  expect(card).toEqual(snapshot)
})
