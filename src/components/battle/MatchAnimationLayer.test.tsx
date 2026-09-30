/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { MatchAnimationLayer } from './MatchAnimationLayer'
import type { MatchAnimations } from '../../hooks/useMatchAnimations'
import type { PresentationEvent } from '../../game/presentation'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('moves from the previous hand position after the authoritative card has already entered battle', async () => {
  const rect = vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    if(this.dataset.position==='hand') return new DOMRect(20,600,100,140)
    if(this.dataset.position==='battle') return new DOMRect(300,300,100,140)
    return new DOMRect(0,0,1920,1080)
  })
  const container=document.createElement('div')
  document.body.append(container)
  const root=createRoot(container)
  const card={id:'public',instanceId:'moving-card',name:'Public card',type:'item' as const}
  const animation=(events:PresentationEvent[]):MatchAnimations=>({
    activeEvents:events,duration:280,speed:'standard',setSpeed:()=>undefined,reducedMotion:false,isPlaying:events.length>0,isBusy:()=>events.length>0,
    skip:()=>undefined,resetAnimations:()=>undefined,observeTransition:()=>undefined,enqueue:()=>undefined,attackShakeId:null,damageFlashId:null,faintAnimIds:new Set(),drawAnimIds:new Set(),
  })
  const render=(inBattle:boolean,events:PresentationEvent[])=>root.render(<main className="game-shell">
    <div data-animation-player="player-one">
      <div className="hand-fan">{!inBattle&&<div data-card-instance-id={card.instanceId} data-position="hand"/>}</div>
      <div className="combat-zone">{inBattle&&<div data-card-instance-id={card.instanceId} data-position="battle"/>}</div>
    </div>
    <MatchAnimationLayer animation={animation(events)}/>
  </main>)
  try {
    await act(()=>render(false,[]))
    await act(()=>render(true,[{id:'move',kind:'move',source:{playerId:'player-one',zone:'hand',instanceId:card.instanceId},target:{playerId:'player-one',zone:'battle',instanceId:card.instanceId},card,label:'登場',duration:280}]))
    const ghost=container.querySelector<HTMLElement>('[data-animation-index="0"]')!
    expect(ghost.style.getPropertyValue('--from-x')).toBe('70px')
    expect(ghost.style.getPropertyValue('--from-y')).toBe('670px')
    expect(ghost.style.getPropertyValue('--to-x')).toBe('350px')
    expect(ghost.style.getPropertyValue('--to-y')).toBe('370px')
  } finally {await act(()=>root.unmount());container.remove();rect.mockRestore()}
})
