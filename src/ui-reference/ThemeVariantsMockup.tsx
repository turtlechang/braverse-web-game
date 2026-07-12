/**
 * 主題變體展示 — 同畫面多主題並列
 *
 * dev 網址：/?mockup=themes
 *
 * 5 個主題：`tactical`（原版）、`tactical-clean`（優化版）、
 * `tactical-mono`（極簡灰階）、`low-glare`、`broadcast`。
 * 中央 selector 切換 active 變體；每張卡片獨立 iframe 渲染
 * 同一份主選單，避免 token 切換互相干擾。
 *
 * Phase 1.1 紀錄：你反映 tactical 太花俏。Clean 變體收掉：
 * - 標題漸層 → 純色
 * - 全息 box-shadow glow → 1px outline
 * - 棋盤格背景 → 接近 0
 * - 大寫寬 letter-spacing 標籤 → 一般
 * - 按鈕漸層背景 → 平面色塊
 */
import { useEffect, useState } from 'react'
import { designThemes, type DesignTheme } from '../styles/tokens'

const TOKENS_CSS = `
:root {
  --color-bg-base: #020817;
  --color-bg-elevated: #07162f;
  --color-bg-panel: #0b1d3e;
  --color-bg-panel-soft: #132038;
  --color-surface-elevated: #123f90;
  --color-border-subtle: rgba(126, 231, 240, 0.18);
  --color-border-default: rgba(126, 231, 240, 0.32);
  --color-border-strong: rgba(126, 231, 240, 0.55);
  --color-primary: #7ee7f0;
  --color-primary-strong: #67e7ff;
  --color-primary-soft: rgba(126, 231, 240, 0.18);
  --color-on-primary: #020817;
  --color-secondary: #149bd2;
  --color-accent: #f3b937;
  --color-accent-soft: rgba(243, 185, 55, 0.18);
  --color-on-accent: #2a1a05;
  --color-danger: #ff6b6b;
  --color-danger-soft: rgba(255, 107, 107, 0.18);
  --color-success: #6ce68c;
  --color-success-soft: rgba(108, 230, 140, 0.18);
  --color-text-primary: #f7fbff;
  --color-text-secondary: #d9efff;
  --color-text-muted: rgba(223, 239, 255, 0.78);
  --color-text-subtle: rgba(223, 239, 255, 0.55);
  --font-family-base: Inter, "Noto Sans TC", ui-sans-serif, system-ui, sans-serif;
  --radius-md: 10px;
  --radius-sm: 6px;
  --radius-pill: 999px;
  --shadow-md: 0 4px 12px rgba(2, 8, 23, 0.45);
  --shadow-glow-primary: 0 0 0 1px #7ee7f0, 0 6px 24px rgba(126, 231, 240, 0.35);
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --font-size-xs: 0.72rem;
  --font-size-sm: 0.84rem;
  --font-size-base: 0.94rem;
  --font-size-md: 1.05rem;
  --font-size-lg: 1.2rem;
  --font-size-xl: 1.5rem;
  --font-weight-bold: 700;
  --font-weight-black: 800;
  --letter-spacing-wide: 0.05em;
  --letter-spacing-widest: 0.12em;
  --surface-grid-color: rgba(126, 231, 240, 0.06);
  --surface-grid-size: 32px;
}

[data-theme="tactical-clean"] {
  --color-primary: #6fdde6;
  --color-primary-strong: #95ecf0;
  --color-primary-soft: rgba(111, 221, 230, 0.10);
  --color-accent: #e9b13a;
  --color-accent-soft: rgba(233, 177, 58, 0.12);
  --color-border-subtle: rgba(223, 239, 255, 0.06);
  --color-border-default: rgba(223, 239, 255, 0.16);
  --color-border-strong: rgba(223, 239, 255, 0.28);
  --surface-grid-color: rgba(111, 221, 230, 0.02);
  --shadow-md: 0 1px 0 rgba(0, 0, 0, 0.4);
  --shadow-glow-primary: 0 0 0 1px #6fdde6;
  --letter-spacing-wide: 0.01em;
  --letter-spacing-widest: 0.04em;
}

[data-theme="tactical-mono"] {
  --color-primary: #d9e2ee;
  --color-primary-strong: #f0f4fa;
  --color-primary-soft: rgba(217, 226, 238, 0.08);
  --color-secondary: #aab4c2;
  --color-accent: #b0b8c4;
  --color-accent-soft: rgba(176, 184, 196, 0.10);
  --color-border-subtle: rgba(217, 226, 238, 0.05);
  --color-border-default: rgba(217, 226, 238, 0.14);
  --color-border-strong: rgba(217, 226, 238, 0.26);
  --surface-grid-color: rgba(217, 226, 238, 0.015);
  --shadow-md: none;
  --shadow-glow-primary: 0 0 0 1px #aab4c2;
  --letter-spacing-wide: 0;
  --letter-spacing-widest: 0;
}

[data-theme="low-glare"] {
  --color-bg-base: #010410;
  --color-bg-elevated: #040c29;
  --color-bg-panel: #06183e;
  --color-primary: #65e8ff;
  --color-text-muted: rgba(223, 248, 255, 0.85);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.6), 0 1px 2px rgba(0, 0, 0, 0.5);
}

[data-theme="broadcast"] {
  --color-bg-elevated: #071b46;
  --color-bg-panel: #0b2a61;
  --font-size-base: 1.02rem;
  --font-size-md: 1.12rem;
  --font-size-lg: 1.32rem;
  --font-size-xl: 1.65rem;
  --color-primary: #71e9ff;
  --color-accent: #ffd159;
  --shadow-glow-primary: 0 0 0 1px #71e9ff, 0 8px 28px rgba(113, 233, 255, 0.45);
}

* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; width: 100%; height: 100%;
  background: var(--color-bg-base); color: var(--color-text-primary);
  font-family: var(--font-family-base); font-size: var(--font-size-base);
  overflow: hidden;
}

.mm-shell { width: 100%; height: 100%; display: grid; place-items: center;
  background: var(--color-bg-elevated); padding: 16px; position: relative; }
.mm-shell::before { content: ''; position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--surface-grid-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--surface-grid-color) 1px, transparent 1px);
  background-size: var(--surface-grid-size) var(--surface-grid-size);
  pointer-events: none; }
.mm-panel { width: 100%; max-width: 380px; display: grid; gap: 12px; position: relative; }

.mm-kicker { color: var(--color-primary); font-size: var(--font-size-xs);
  font-weight: var(--font-weight-black); letter-spacing: var(--letter-spacing-widest); text-transform: uppercase; }
.mm-title { margin: 0; font-size: var(--font-size-xl); font-weight: var(--font-weight-black);
  color: var(--color-text-primary); }
.mm-desc { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); line-height: 1.5; }

.mm-actions { display: grid; gap: 6px; }
.mm-actions button { padding: 8px 12px; border-radius: var(--radius-md); text-align: left;
  font-size: var(--font-size-sm); font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border-default); cursor: pointer; }
.mm-actions button.primary { background: var(--color-primary-soft);
  border-color: var(--color-primary); color: var(--color-primary); }

.mm-decks { border-radius: var(--radius-md); padding: 10px 12px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border-subtle);
  display: flex; flex-direction: column; gap: 6px; }
.mm-decks-head { display: flex; justify-content: space-between; align-items: center;
  color: var(--color-primary); font-size: var(--font-size-xs); font-weight: var(--font-weight-black);
  letter-spacing: var(--letter-spacing-widest); }
.mm-deckcard { position: relative; border-radius: var(--radius-sm); padding: 6px 10px 6px 14px;
  background: var(--color-bg-panel-soft);
  border: 1px solid var(--color-border-subtle);
  display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.mm-deckcard .bar { position: absolute; left: 0; top: 6px; bottom: 6px; width: 4px; border-radius: var(--radius-pill); }
.mm-deckcard strong { font-size: var(--font-size-sm); }

.tag { border-radius: var(--radius-pill); padding: 2px 8px; font-size: var(--font-size-xs);
  font-weight: var(--font-weight-black); letter-spacing: var(--letter-spacing-wide); }
.tag.ok { color: var(--color-success); background: var(--color-success-soft); }
.tag.warn { color: var(--color-accent); background: var(--color-accent-soft); }
`

function buildFrameDocument(theme: DesignTheme): string {
  const body = `
    <div class="mm-shell">
      <section class="mm-panel">
        <div class="mm-kicker">COOKIE RUN BRAVERSE</div>
        <h1 class="mm-title">薑餅人對戰卡牌</h1>
        <p class="mm-desc">${theme} 變體預覽</p>
        <div class="mm-actions">
          <button class="primary">▶ 對戰入口</button>
          <button>📶 線上對戰</button>
          <button>✏ 牌組編輯器</button>
        </div>
        <div class="mm-decks">
          <div class="mm-decks-head"><span>已儲存牌組</span><span class="tag ok">3 副</span></div>
          <div class="mm-deckcard">
            <span class="bar" style="background:#9a6fd0"></span>
            <strong>紫色控制</strong>
            <span class="tag ok">合法</span>
          </div>
          <div class="mm-deckcard">
            <span class="bar" style="background:#c94f5f"></span>
            <strong>紅色快攻</strong>
            <span class="tag ok">合法</span>
          </div>
        </div>
      </section>
    </div>
  `
  return `<!DOCTYPE html>
<html data-theme="${theme}">
<head>
  <meta charset="utf-8" />
  <style>${TOKENS_CSS}</style>
</head>
<body>${body}</body>
</html>`
}

const FRAMES: DesignTheme[] = [
  'tactical',
  'tactical-clean',
  'tactical-mono',
  'low-glare',
  'broadcast',
]

const PREVIEW_W = 360
const PREVIEW_H = 320

const SHELL_CSS = `
.tv-shell { position: fixed; inset: 0; display: grid; grid-template-rows: auto 1fr auto;
  padding: 24px; overflow: auto; color: var(--color-text-primary);
  font-family: var(--font-family-base); }
.tv-header { display: grid; gap: 8px; margin-bottom: 16px; max-width: 1280px; }
.tv-header h1 { margin: 0; font-size: var(--font-size-2xl); }
.tv-header p { margin: 0; color: var(--color-text-muted); }
.tv-switcher { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.tv-switcher button { text-align: left; padding: 10px 12px; border-radius: var(--radius-md);
  background: var(--color-bg-panel); color: var(--color-text-primary);
  border: 1px solid var(--color-border-default); cursor: pointer; }
.tv-switcher button[data-active="true"] { border-color: var(--color-primary); }
.tv-switcher button strong { display: block; font-size: var(--font-size-sm); }
.tv-switcher button small { display: block; color: var(--color-text-muted); font-size: var(--font-size-xs); }
.tv-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; align-items: start; max-width: 1600px; }
@media (max-width: 1280px) { .tv-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 720px) { .tv-grid { grid-template-columns: 1fr; } }
.tv-card { background: var(--color-bg-panel); border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md); padding: 12px; display: grid; gap: 8px; }
.tv-card[data-active="true"] { border-color: var(--color-primary); }
.tv-card header { display: flex; justify-content: space-between; align-items: center; }
.tv-card header h2 { margin: 0; font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); }
.tv-card iframe { border: 1px solid var(--color-border-subtle); border-radius: var(--radius-sm);
  width: 100%; max-width: 100%; background: var(--color-bg-base); display: block; }
.tv-card footer { display: flex; justify-content: space-between; align-items: center;
  font-size: var(--font-size-xs); color: var(--color-text-muted); }
.tv-footer { margin-top: 16px; font-size: var(--font-size-sm); color: var(--color-text-muted); max-width: 1280px; }
.tv-footer a { color: var(--color-primary); }
.tv-note { background: var(--color-bg-panel); border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md); padding: 12px; margin: 8px 0 16px;
  max-width: 1280px; font-size: var(--font-size-sm); color: var(--color-text-secondary); }
.tv-note strong { color: var(--color-primary); }
`

const TACTICAL_NOTE = `
原本的「戰術深空（原版）」含：標題漸層（粉→黃）、按鈕漸層背景、
全息 box-shadow glow、棋盤格背景、大寫寬 letter-spacing 標籤。
你 2026-07-12 反映太花俏，故同步新增 clean / mono 兩支對照組。
`

export function ThemeVariantsMockup() {
  const [active, setActive] = useState<DesignTheme>('tactical-clean')

  useEffect(() => {
    document.documentElement.dataset.theme = active
    return () => {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [active])

  return (
    <>
      <style>{SHELL_CSS}</style>
      <div className="tv-shell">
        <header className="tv-header">
          <h1>主題變體展示</h1>
          <p>5 個同方向視覺變體 — 點擊切換預覽。預設為 tactical-clean（花俏程度最低）。</p>
        </header>

        <div className="tv-note">
          <strong>設計決策紀錄：</strong>
          <br />
          {TACTICAL_NOTE}
        </div>

        <div className="tv-switcher" role="tablist" aria-label="主題切換">
          {designThemes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              role="tab"
              aria-selected={active === theme.id}
              data-active={active === theme.id}
              onClick={() => setActive(theme.id)}
            >
              <strong>{theme.label}</strong>
              <small>{theme.description}</small>
            </button>
          ))}
        </div>

        <div className="tv-grid">
          {FRAMES.map((theme) => {
            const isActive = active === theme
            const meta = designThemes.find((t) => t.id === theme)!
            return (
              <article key={theme} className="tv-card" data-active={isActive}>
                <header>
                  <h2>{meta.label}</h2>
                  <span
                    className={`badge ${
                      theme === 'tactical'
                        ? 'badge-info'
                        : theme === 'tactical-clean'
                          ? 'badge-success'
                          : theme === 'tactical-mono'
                            ? 'badge-warning'
                            : theme === 'low-glare'
                              ? 'badge-success'
                              : 'badge-warning'
                    }`}
                  >
                    {theme}
                  </span>
                </header>
                <iframe
                  title={theme}
                  srcDoc={buildFrameDocument(theme)}
                  width={PREVIEW_W}
                  height={PREVIEW_H}
                />
                <footer>
                  <span>固定 {PREVIEW_W}×{PREVIEW_H}</span>
                  {isActive && <span className="badge badge-info">active</span>}
                </footer>
              </article>
            )
          })}
        </div>

        <footer className="tv-footer">
          Phase 1 設計驗收 — 確認 5 主題在固定解析度下皆可讀、無洩漏。
          選定預設後請回 <a href="/?mockup=index">UI 索引</a>。
        </footer>
      </div>
    </>
  )
}

export default ThemeVariantsMockup
