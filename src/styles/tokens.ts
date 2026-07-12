/**
 * Braverse Design Tokens — TypeScript
 *
 * 對 CSS custom properties 的型別化鏡像，方便 hooks、邏輯層讀取 token。
 * 真實唯一來源仍是 `src/styles/tokens.css`；此檔案僅供程式讀取。
 *
 * 修改時請同步兩處。
 */

export const colors = {
  bg: {
    base: 'var(--color-bg-base)',
    elevated: 'var(--color-bg-elevated)',
    panel: 'var(--color-bg-panel)',
    panelSoft: 'var(--color-bg-panel-soft)',
    overlay: 'var(--color-bg-overlay)',
  },
  surface: {
    card: 'var(--color-surface-card)',
    elevated: 'var(--color-surface-elevated)',
  },
  border: {
    subtle: 'var(--color-border-subtle)',
    default: 'var(--color-border-default)',
    strong: 'var(--color-border-strong)',
  },
  primary: {
    base: 'var(--color-primary)',
    strong: 'var(--color-primary-strong)',
    soft: 'var(--color-primary-soft)',
    on: 'var(--color-on-primary)',
  },
  secondary: {
    base: 'var(--color-secondary)',
    strong: 'var(--color-secondary-strong)',
    on: 'var(--color-on-secondary)',
  },
  accent: {
    base: 'var(--color-accent)',
    strong: 'var(--color-accent-strong)',
    soft: 'var(--color-accent-soft)',
    on: 'var(--color-on-accent)',
  },
  danger: {
    base: 'var(--color-danger)',
    strong: 'var(--color-danger-strong)',
    soft: 'var(--color-danger-soft)',
    on: 'var(--color-on-danger)',
  },
  success: {
    base: 'var(--color-success)',
    soft: 'var(--color-success-soft)',
    on: 'var(--color-on-success)',
  },
  text: {
    primary: 'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    muted: 'var(--color-text-muted)',
    subtle: 'var(--color-text-subtle)',
    disabled: 'var(--color-text-disabled)',
    inverse: 'var(--color-text-inverse)',
  },
  battle: {
    rest: 'var(--color-battle-rest)',
    active: 'var(--color-battle-active)',
    target: 'var(--color-battle-target)',
    blocker: 'var(--color-battle-blocker)',
    faint: 'var(--color-battle-faint)',
  },
} as const

export const spacing = {
  s1: 'var(--space-1)',
  s2: 'var(--space-2)',
  s3: 'var(--space-3)',
  s4: 'var(--space-4)',
  s5: 'var(--space-5)',
  s6: 'var(--space-6)',
  s7: 'var(--space-7)',
  s8: 'var(--space-8)',
  s9: 'var(--space-9)',
  s10: 'var(--space-10)',
} as const

export const radius = {
  xs: 'var(--radius-xs)',
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  pill: 'var(--radius-pill)',
} as const

export const shadow = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  glowPrimary: 'var(--shadow-glow-primary)',
  glowAccent: 'var(--shadow-glow-accent)',
  glowDanger: 'var(--shadow-glow-danger)',
} as const

export const zIndex = {
  base: 0,
  elevated: 10,
  sticky: 50,
  overlay: 100,
  modalBackdrop: 199,
  modal: 200,
  toast: 300,
  tooltip: 400,
} as const

export const motion = {
  easing: {
    standard: 'var(--easing-standard)',
    emphasized: 'var(--easing-emphasized)',
    exit: 'var(--easing-exit)',
  },
  duration: {
    instant: 80,
    fast: 160,
    base: 240,
    slow: 380,
    glacial: 600,
  },
} as const

export const touch = {
  minTarget: 44,
  controlSm: 32,
  controlMd: 40,
  controlLg: 48,
} as const

export const layout = {
  maxWidth: 1280,
  gutter: 24,
  asideWidth: 240,
  asideCompact: 200,
  railWidth: 220,
} as const

export type DesignTheme =
  | 'tactical'
  | 'tactical-clean'
  | 'tactical-mono'
  | 'low-glare'
  | 'broadcast'

export const designThemes: { id: DesignTheme; label: string; description: string }[] = [
  {
    id: 'tactical',
    label: '戰術深空（原版）',
    description: '深藍底 + 漸層標題 + 棋盤格 + 全息 glow，原始電競科幻戰術桌。',
  },
  {
    id: 'tactical-clean',
    label: '戰術深空 Clean',
    description: '同樣色系但收掉漸層、glow、棋盤格、寬距標籤；平面化資訊優先。',
  },
  {
    id: 'tactical-mono',
    label: '戰術深空 Mono',
    description: '純灰階、無主色強調；用來比對完全沒有青色點綴的極簡樣貌。',
  },
  {
    id: 'low-glare',
    label: '低眩光（夜間）',
    description: '更深背景與更高對比文字，適合長時間使用或 OLED。',
  },
  {
    id: 'broadcast',
    label: '賽事廣播',
    description: '字體放大、強調對比、強化發光效果，適合錄製或直播。',
  },
]
