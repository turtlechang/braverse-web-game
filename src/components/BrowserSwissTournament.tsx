import { useState } from 'react'
import {
  runSwissTournament,
  type SwissRosterDeck,
  type SwissTournamentProgress,
  type SwissTournamentReport,
} from '../game'

const ROSTER_STORAGE_KEY = 'braverse-swiss-roster-v1'

const readRoster = (): SwissRosterDeck[] => {
  const raw = window.localStorage.getItem(ROSTER_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SwissRosterDeck[]) : []
  } catch {
    return []
  }
}

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`

export function BrowserSwissTournament() {
  const [roster] = useState<SwissRosterDeck[]>(readRoster)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<SwissTournamentProgress | null>(null)
  const [report, setReport] = useState<SwissTournamentReport | null>(null)

  const startTournament = async () => {
    if (running || report) return
    if (roster.length !== 512) {
      setError(`Browser Swiss roster 需要 512 副，目前是 ${roster.length} 副。`)
      return
    }
    setError(null)
    setRunning(true)
    try {
      const nextReport = await runSwissTournament(roster, {
        rounds: 9,
        seed: 20260813,
        maxActions: 2500,
        aiLevel: 4,
        progressEvery: 16,
        onProgress: (nextProgress) => {
          setProgress(nextProgress)
        },
      })
      window.localStorage.setItem(
        'braverse-browser-swiss-report-v1',
        JSON.stringify(nextReport),
      )
      setReport(nextReport)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setRunning(false)
    }
  }

  return (
    <main
      data-testid="browser-swiss-tournament"
      style={{
        minHeight: '100vh',
        padding: '32px',
        background: '#07152f',
        color: '#f4f8ff',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <section style={{ maxWidth: 1120, margin: '0 auto' }}>
        <p style={{ color: '#8fd3ff', letterSpacing: '.08em' }}>
          BRAVERSE / BROWSER TOURNAMENT LAB
        </p>
        <h1>BS1～BS6｜512 副牌組｜9 輪瑞士制</h1>
        <p>
          本頁在 Chromium 內執行正式規則引擎、開局調度、AI Lv.4 與全部配對；不是 Node
          端預先計算的替代結果。
        </p>
        <p>牌組數：{roster.length}／512</p>
        <button
          data-testid="start-browser-swiss"
          type="button"
          onClick={() => void startTournament()}
          disabled={running || Boolean(report)}
          style={{
            padding: '12px 20px',
            borderRadius: 8,
            border: '1px solid #70d7ff',
            background: running ? '#314b69' : '#0b6fa4',
            color: 'white',
            fontWeight: 700,
            cursor: running || report ? 'default' : 'pointer',
          }}
        >
          {running ? '瑞士輪進行中…' : report ? '賽事已完成' : '開始瀏覽器瑞士輪'}
        </button>
        {error && (
          <p data-testid="browser-swiss-error" style={{ color: '#ff9f9f' }}>
            {error}
          </p>
        )}
        {progress && (
          <p data-testid="browser-swiss-progress" aria-live="polite">
            第 {progress.round}／{progress.rounds} 輪；已完成配對 {progress.completedMatches}／
            {progress.totalMatches}
            {progress.currentMatch ? `；目前 ${progress.currentMatch}` : ''}
          </p>
        )}
        {report && (
          <>
            <section
              data-testid="browser-swiss-summary"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                margin: '24px 0',
              }}
            >
              <article><strong>狀態</strong><div>{report.status}</div></article>
              <article><strong>完成對局</strong><div>{report.metrics.completedMatches}/2304</div></article>
              <article><strong>卡住對局</strong><div>{report.metrics.stuckMatches}</div></article>
              <article><strong>平均勝率樣本</strong><div>{formatPercent(1 - report.metrics.stuckMatches / 2304)}</div></article>
            </section>
            <section>
              <h2>各色上位卡表</h2>
              {report.colors.map((color) => (
                <details key={color.color} open>
                  <summary>
                    {color.color.toUpperCase()}｜平均積分 {color.averagePoints.toFixed(2)}｜
                    平均勝率 {formatPercent(color.averageWinRate)}
                  </summary>
                  <ol>
                    {color.topCards.map((card) => (
                      <li key={card.cardNumber}>
                        {card.cardNumber} {card.name}｜{card.appearances}/8 副｜{card.averageCopies.toFixed(1)} 張
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </section>
            <pre
              data-testid="browser-swiss-report"
              style={{
                maxHeight: 520,
                overflow: 'auto',
                padding: 16,
                background: '#020a18',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(report)}
            </pre>
          </>
        )}
      </section>
    </main>
  )
}
