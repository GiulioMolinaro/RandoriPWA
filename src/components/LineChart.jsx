// Grafico a linee multi-serie leggero (SVG puro, senza dipendenze esterne).
export default function LineChart({ series, height = 160, width = 320 }) {
  const totalPoints = series.reduce((sum, s) => sum + s.points.length, 0)

  if (totalPoints < 2) {
    return <p className="chart-empty">Servono almeno 2 rilevazioni per il grafico.</p>
  }

  const allX = series.flatMap(s => s.points.map(p => p.x))
  const allY = series.flatMap(s => s.points.map(p => p.y))
  const minX = Math.min(...allX)
  const maxX = Math.max(...allX)
  const maxY = Math.max(...allY, 1) * 1.1
  const padding = 12

  const scaleX = (x) => padding + ((x - minX) / (maxX - minX || 1)) * (width - padding * 2)
  const scaleY = (y) => height - padding - (y / maxY) * (height - padding * 2)

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart-svg" preserveAspectRatio="none">
        {series.map(s => {
          if (s.points.length === 0) return null
          const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ')
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {s.points.map((p, i) => (
                <circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r="3" fill={s.color} />
              ))}
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        {series.filter(s => s.points.length > 0).map(s => (
          <span key={s.name} className="chart-legend-item">
            <span className="chart-legend-dot" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
