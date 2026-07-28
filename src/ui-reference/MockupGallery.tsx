/**
 * UI reference mockup 入口。dev/preview 網址加 ?mockup=<id> 檢視：
 *   /?mockup=battlefield ・ /?mockup=main-menu ・ /?mockup=deck-editor ・ /?mockup=themes
 * 未知 id 顯示索引頁。正式對局 UI 不受影響（無參數時 main.tsx 照常渲染 App）。
 *   /?mockup=themes 額外支援 ?theme=tactical|low-glare|broadcast 預設展示主題
 */
import type { ComponentType } from 'react'
import { useEffect } from 'react'
import { BattlefieldMockup } from './BattlefieldMockup'
import { DeckEditorMockup } from './DeckEditorMockup'
import { MainMenuMasterDuelMockup } from './MainMenuMasterDuelMockup'
import { MainMenuMockup } from './MainMenuMockup'
import { MainMenuRedesignMockup } from './MainMenuRedesignMockup'
import { MyDecksMockup } from './MyDecksMockup'
import { ThemeVariantsMockup } from './ThemeVariantsMockup'
import { designThemes } from '../styles/tokens'
import { readThemeFromQuery } from '../styles/themeQuery'

const MOCKUPS: { id: string; title: string; component: ComponentType }[] = [
  { id: 'battlefield', title: '戰場（wireframe 01）', component: BattlefieldMockup },
  { id: 'main-menu', title: '主選單（wireframe 02，現行版面）', component: MainMenuMockup },
  { id: 'main-menu-redesign', title: '主選單重新設計提案 A：雙欄保留牌組庫（P2-5）', component: MainMenuRedesignMockup },
  { id: 'main-menu-md', title: '主選單重新設計提案 B：Master Duel 風格', component: MainMenuMasterDuelMockup },
  { id: 'my-decks', title: '我的牌組（提案 B 配套：獨立牌組管理畫面）', component: MyDecksMockup },
  { id: 'deck-editor', title: '牌組編輯器（wireframe 03）', component: DeckEditorMockup },
  { id: 'themes', title: '主題變體展示（Phase 1）', component: ThemeVariantsMockup },
]

const INDEX_STYLE = `
.mock-index { position: fixed; inset: 0; display: grid; place-items: center;
  background: var(--color-bg-base); color: var(--color-text-primary);
  font-family: var(--font-family-base); padding: 32px; }
.mock-index-panel { width: min(720px, 100%); display: grid; gap: 16px; }
.mock-index h1 { margin: 0 0 8px; font-size: var(--font-size-2xl); }
.mock-index p { margin: 0 0 16px; color: var(--color-text-muted); }
.mock-index ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.mock-index li a { display: block; padding: 12px 16px; border-radius: var(--radius-md);
  background: var(--color-bg-panel); color: var(--color-primary);
  border: 1px solid var(--color-border-default); text-decoration: none; }
.mock-index li a:hover { border-color: var(--color-primary); }
.mock-index-footer { margin-top: 16px; font-size: var(--font-size-sm); color: var(--color-text-muted); }
`

export function MockupGallery({
  mockupId,
}: {
  mockupId: string
}) {
  const queryTheme = readThemeFromQuery()
  useEffect(() => {
    if (queryTheme) {
      document.documentElement.dataset.theme = queryTheme
    }
  }, [queryTheme])
  const entry = MOCKUPS.find((mockup) => mockup.id === mockupId)
  if (entry) {
    const Mockup = entry.component
    return <Mockup />
  }

  return (
    <>
      <style>{INDEX_STYLE}</style>
      <div className="mock-index tactical-surface">
        <div className="mock-index-panel">
          <h1>UI Reference Mockups</h1>
          <p>dev / preview 環境用，網址加 <code>?mockup=&lt;id&gt;</code> 檢視單一 mockup。</p>
          <ul>
            {MOCKUPS.map((mockup) => (
              <li key={mockup.id}>
                <a href={`/?mockup=${mockup.id}`}>{mockup.title}</a>
              </li>
            ))}
            <li>
              <a href="/">← 回到遊戲</a>
            </li>
          </ul>
          <div className="mock-index-footer">
            <p>Phase 1 主題變體：</p>
            <ul>
              {designThemes.map((theme) => (
                <li key={theme.id}>
                  <a
                    href={`/?mockup=themes&theme=${theme.id}`}
                  >
                    {theme.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}

export default MockupGallery
