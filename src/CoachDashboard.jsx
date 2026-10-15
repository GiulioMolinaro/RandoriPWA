import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { subDays, subMonths, format, startOfDay } from 'date-fns'
import BarChart from './components/BarChart'
import LineChart from './components/LineChart'

const FILTERS = [
  { id: '1w', label: '1 Sett' },
  { id: '1m', label: '1 Mese' },
  { id: '3m', label: '3 Mesi' },
  { id: '6m', label: '6 Mesi' },
  { id: '12m', label: '1 Anno' }
]

// Converte 'yyyy-MM-dd' in 'dd/MM' senza passare per Date (evita bug di fuso orario)
const shortDate = (isoDate) => {
  const [, m, d] = isoDate.split('-')
  return `${d}/${m}`
}

export default function CoachDashboard() {
  const [athletes, setAthletes] = useState([])
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  
  // Dati Atleta
  const [athleteSessions, setAthleteSessions] = useState([])
  const [athleteLifts, setAthleteLifts] = useState([])
  
  // Stati per Filtri e UI
  const [historyTab, setHistoryTab] = useState('randori')
  const [activeFilter, setActiveFilter] = useState('1m')
  const [periodTotal, setPeriodTotal] = useState(0)
  const [loadingAthletes, setLoadingAthletes] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    fetchAthletes()
  }, [])

  // 1. Quando cambia l'atleta selezionato O il filtro temporale, ricarica i randori
  useEffect(() => {
    if (selectedAthlete) {
      fetchAthleteRandori(selectedAthlete.id)
    }
  }, [selectedAthlete, activeFilter])

  const fetchAthletes = async () => {
    setLoadingAthletes(true)
    const { data, error } = await supabase.from('profiles').select('*').order('full_name')
    if (error) {
      alert("Errore nel caricamento degli atleti: " + error.message)
    } else {
      setAthletes(data)
    }
    setLoadingAthletes(false)
  }

  // 2. Funzione per calcolare la data di partenza
  const getStartDate = (filterId) => {
    const today = startOfDay(new Date())
    switch (filterId) {
      case '1w': return subDays(today, 7)
      case '1m': return subMonths(today, 1)
      case '3m': return subMonths(today, 3)
      case '6m': return subMonths(today, 6)
      case '12m': return subMonths(today, 12)
      default: return subMonths(today, 1)
    }
  }

  // 3. Recupera i Randori con il filtro applicato e calcola il totale
  const fetchAthleteRandori = async (athleteId) => {
    const startDate = format(getStartDate(activeFilter), 'yyyy-MM-dd')

    const { data: sessions, error } = await supabase
      .from('randori_sessions')
      .select('*')
      .eq('user_id', athleteId)
      .gte('session_date', startDate)
      .order('session_date', { ascending: false })

    if (error) {
      alert("Errore nel caricamento dei randori: " + error.message)
      return
    }
    setAthleteSessions(sessions)
    // Calcolo automatico della somma dei randori per questo periodo
    setPeriodTotal(sessions.reduce((sum, s) => sum + s.randori_count, 0))
  }

  // 4. Seleziona l'atleta e carica i suoi massimali
  const handleSelectAthlete = async (athlete) => {
    setSelectedAthlete(athlete)
    setHistoryTab('randori')
    setActiveFilter('1m') // Resetta il filtro a 1 mese di default quando cambi atleta
    setLoadingDetail(true)

    const { data: lifts, error } = await supabase
      .from('max_lifts')
      .select('*')
      .eq('user_id', athlete.id)
      .order('lift_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      alert("Errore nel caricamento dei massimali: " + error.message)
    } else {
      setAthleteLifts(lifts)
    }
    setLoadingDetail(false)
  }

  const currentMaxes = {
    squat: athleteLifts.find(l => l.squat !== null)?.squat || '-',
    bench: athleteLifts.find(l => l.bench_press !== null)?.bench_press || '-',
    row: athleteLifts.find(l => l.row_pull !== null)?.row_pull || '-',
    deadlift: athleteLifts.find(l => l.deadlift !== null)?.deadlift || '-'
  }

  const randoriChartData = [...athleteSessions].reverse().map(s => ({
    label: shortDate(s.session_date),
    value: s.randori_count
  }))

  // Serie per il grafico massimali: stesso indice cronologico per tutte, punti nulli esclusi
  const liftsAsc = [...athleteLifts].reverse()
  const buildLiftSeries = (key, color, name) => ({
    name, color,
    points: liftsAsc
      .map((l, i) => ({ x: i, y: l[key] }))
      .filter(p => p.y !== null && p.y !== undefined)
  })
  const liftsChartSeries = [
    buildLiftSeries('squat', '#007aff', 'Squat'),
    buildLiftSeries('bench_press', '#34c759', 'Panca'),
    buildLiftSeries('row_pull', '#ff9500', 'Rematore'),
    buildLiftSeries('deadlift', '#ff3b30', 'Stacchi')
  ]

  return (
    <div className="dashboard">
      <header className="dash-header">
        <h2>{selectedAthlete ? selectedAthlete.full_name : 'Pannello Coach'}</h2>
        <div style={{display: 'flex', gap: '10px'}}>
          {selectedAthlete && (
            <button onClick={() => setSelectedAthlete(null)} className="filter-btn active">
              ← Indietro
            </button>
          )}
          <button onClick={() => supabase.auth.signOut()} className="logout-btn-small">Esci</button>
        </div>
      </header>

      {!selectedAthlete ? (
        <div className="card">
          <h3>La Tua Squadra</h3>
          {loadingAthletes ? <p className="empty-history">Caricamento...</p> : (
            <ul className="coach-list">
              {athletes.map(athlete => (
                <li key={athlete.id} className="coach-item" style={{cursor: 'pointer'}} onClick={() => handleSelectAthlete(athlete)}>
                  <div className="coach-info">
                    <span className="coach-name">{athlete.full_name || 'Atleta'}</span>
                  </div>
                  <span style={{fontSize: '13px', color: '#007aff', fontWeight: '600'}}>Vedi Profilo ➔</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : loadingDetail ? (
        <div className="card">
          <p className="empty-history">Caricamento...</p>
        </div>
      ) : (
        <>
          <div className="card">
            <h3>Forza Attuale (Massimali)</h3>
            <div className="lifts-grid">
              <div className="lift-input-group" style={{alignItems: 'center', background: '#f9f9fb', padding: '15px', borderRadius: '12px', border: '1px solid #e5e5ea'}}>
                <label>Squat</label>
                <span style={{fontSize: '24px', fontWeight: 'bold', color: '#007aff'}}>{currentMaxes.squat} <small style={{fontSize: '14px', color: '#1c1c1e'}}>kg</small></span>
              </div>
              <div className="lift-input-group" style={{alignItems: 'center', background: '#f9f9fb', padding: '15px', borderRadius: '12px', border: '1px solid #e5e5ea'}}>
                <label>Panca</label>
                <span style={{fontSize: '24px', fontWeight: 'bold', color: '#007aff'}}>{currentMaxes.bench} <small style={{fontSize: '14px', color: '#1c1c1e'}}>kg</small></span>
              </div>
              <div className="lift-input-group" style={{alignItems: 'center', background: '#f9f9fb', padding: '15px', borderRadius: '12px', border: '1px solid #e5e5ea'}}>
                <label>Rematore</label>
                <span style={{fontSize: '24px', fontWeight: 'bold', color: '#007aff'}}>{currentMaxes.row} <small style={{fontSize: '14px', color: '#1c1c1e'}}>kg</small></span>
              </div>
              <div className="lift-input-group" style={{alignItems: 'center', background: '#f9f9fb', padding: '15px', borderRadius: '12px', border: '1px solid #e5e5ea'}}>
                <label>Stacchi</label>
                <span style={{fontSize: '24px', fontWeight: 'bold', color: '#007aff'}}>{currentMaxes.deadlift} <small style={{fontSize: '14px', color: '#1c1c1e'}}>kg</small></span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Andamento Massimali</h3>
            <LineChart series={liftsChartSeries} />
          </div>

          <div className="auth-toggle" style={{marginTop: '10px', marginBottom: '10px'}}>
            <button className={historyTab === 'randori' ? 'active' : ''} onClick={() => setHistoryTab('randori')}>
              🥋 Randori
            </button>
            <button className={historyTab === 'lifts' ? 'active' : ''} onClick={() => setHistoryTab('lifts')}>
              🏋️ Pesi
            </button>
          </div>

          <div className="card">
            <h3>{historyTab === 'randori' ? 'Storico Randori e Note' : 'Storico Test Pesi'}</h3>
            
            {historyTab === 'randori' && (
              <>
                {/* --- NUOVA SEZIONE FILTRI E CONTATORE --- */}
                <div style={{marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9fb', borderRadius: '12px', border: '1px solid #e5e5ea'}}>
                  <div className="filters" style={{marginBottom: '15px'}}>
                    {FILTERS.map(f => (
                      <button 
                        key={f.id} 
                        className={`filter-btn ${activeFilter === f.id ? 'active' : ''}`}
                        onClick={() => setActiveFilter(f.id)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div style={{textAlign: 'center'}}>
                    <span className="stats-total" style={{fontSize: '32px'}}>{periodTotal}</span>
                    <p className="stats-label" style={{marginTop: '5px'}}>Randori nel periodo selezionato</p>
                  </div>
                  <BarChart data={randoriChartData} color="#007aff" />
                </div>

                {/* --- LISTA STORICO RANDORI --- */}
                <ul className="history-list">
                  {athleteSessions.length === 0 ? <p className="empty-history">Nessun allenamento registrato.</p> : (
                    athleteSessions.map(session => (
                      <li key={session.id} className="history-item-ext" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
                        <div className="history-header" style={{width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                          <span style={{fontWeight: '500'}}>{session.session_date}</span>
                          <strong style={{color: '#007aff'}}>{session.randori_count} randori</strong>
                        </div>
                        {session.note ? (
                          <div style={{backgroundColor: '#f9f9fb', padding: '12px', borderRadius: '12px', width: '100%', border: '1px solid #e5e5ea'}}>
                            <p className="history-note" style={{margin: 0, color: '#1c1c1e', fontStyle: 'normal'}}>{session.note}</p>
                          </div>
                        ) : (
                          <p className="history-note" style={{color: '#c7c7cc', fontStyle: 'italic', margin: '4px 0 0 0'}}>Nessuna nota.</p>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}

            {historyTab === 'lifts' && (
              <ul className="history-list">
                {athleteLifts.length === 0 ? <p className="empty-history">Nessun record inserito.</p> : (
                  athleteLifts.map(lift => (
                    <li key={lift.id} style={{display: 'flex', flexDirection: 'column', borderBottom: '1.5px solid #f2f2f7', padding: '15px 0'}}>
                      <div style={{marginBottom: '10px'}}><span style={{fontWeight: '600'}}>{lift.lift_date}</span></div>
                      <div className="lifts-grid" style={{marginBottom: 0, gap: '8px'}}>
                        <div className="lift-history-row"><span className="lift-val">Squat</span> <strong className="lift-val">{lift.squat || '-'} kg</strong></div>
                        <div className="lift-history-row"><span className="lift-val">Panca</span> <strong className="lift-val">{lift.bench_press || '-'} kg</strong></div>
                        <div className="lift-history-row"><span className="lift-val">Row</span> <strong className="lift-val">{lift.row_pull || '-'} kg</strong></div>
                        <div className="lift-history-row"><span className="lift-val">Stacco</span> <strong className="lift-val">{lift.deadlift || '-'} kg</strong></div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}