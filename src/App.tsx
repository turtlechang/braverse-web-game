import './App.css'

const zones = [
  { label: '對手休息區', value: 'LV 0 / 10' },
  { label: '對手牌庫', value: '60' },
  { label: '戰鬥區', value: '等待餅乾登場' },
  { label: '我方支援區', value: '0 張' },
]

function App() {
  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cookie Battle Prototype</p>
          <h1>Braverse</h1>
        </div>
        <div className="turn-status" aria-label="目前回合">
          <span>第 1 回合</span>
          <strong>活躍階段</strong>
        </div>
      </header>

      <section className="battlefield" aria-label="對戰區">
        {zones.map((zone) => (
          <article className="zone" key={zone.label}>
            <span>{zone.label}</span>
            <strong>{zone.value}</strong>
          </article>
        ))}
      </section>

      <footer className="actionbar">
        <div>
          <span className="phase-label">下一步</span>
          <strong>抽牌階段</strong>
        </div>
        <button type="button">結束階段</button>
      </footer>
    </main>
  )
}

export default App

