/**
 * UI reference mockup 入口。dev/preview 網址加 ?mockup=<id> 檢視：
 *   /?mockup=battlefield ・ /?mockup=main-menu ・ /?mockup=deck-editor
 * 未知 id 顯示索引頁。正式對局 UI 不受影響（無參數時 main.tsx 照常渲染 App）。
 */
import type { ComponentType } from 'react'
import { BattlefieldMockup } from './BattlefieldMockup'
import { DeckEditorMockup } from './DeckEditorMockup'
import { MainMenuMockup } from './MainMenuMockup'

const MOCKUPS: { id: string; title: string; component: ComponentType }[] = [
  { id: 'battlefield', title: '戰場（wireframe 01）', component: BattlefieldMockup },
  { id: 'main-menu', title: '主選單（wireframe 02）', component: MainMenuMockup },
  { id: 'deck-editor', title: '牌組編輯器（wireframe 03）', component: DeckEditorMockup },
]

export function MockupGallery({ mockupId }: { mockupId: string }) {
  const entry = MOCKUPS.find((mockup) => mockup.id === mockupId)
  if (entry) {
    const Mockup = entry.component
    return <Mockup />
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: '#07162f',
        color: '#eef9ff',
        fontFamily: "system-ui, 'Noto Sans TC', sans-serif",
      }}
    >
      <div>
        <h1 style={{ fontSize: '1.2rem' }}>UI Reference Mockups</h1>
        <ul style={{ lineHeight: 2 }}>
          {MOCKUPS.map((mockup) => (
            <li key={mockup.id}>
              <a style={{ color: '#7ee7f0' }} href={`/?mockup=${mockup.id}`}>
                {mockup.title}
              </a>
            </li>
          ))}
          <li>
            <a style={{ color: '#9fc3e8' }} href="/">
              ← 回到遊戲
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default MockupGallery
