// Grafico a barre leggero, senza dipendenze esterne: una colonna scrollabile per punto dato.
export default function BarChart({ data, color = '#007aff', height = 120 }) {
  if (!data || data.length === 0) {
    return <p className="chart-empty">Nessun dato da mostrare.</p>
  }

  const max = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="chart-scroll">
      <div className="bar-chart" style={{ height: height + 40 }}>
        {data.map((d, i) => (
          <div className="bar-chart-col" key={i}>
            <span className="bar-chart-value">{d.value}</span>
            <div
              className="bar-chart-bar"
              style={{ height: `${Math.max((d.value / max) * height, 2)}px`, backgroundColor: color }}
            />
            <span className="bar-chart-label">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
