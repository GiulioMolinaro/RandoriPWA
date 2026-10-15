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

export default function Dashboard({ session }) {
  const userId = session.user.id
  const [currentView, setCurrentView] = useState('randori')
  const [menuOpen, setMenuOpen] = useState(false)

  // --- Stati Randori ---
  const [currentCount, setCurrentCount] = useState(0)
  const [sessionNote, setSessionNote] = useState('')
  const [activeFilter, setActiveFilter] = useState('1m')
  const [history, setHistory] = useState([])
  const [loadingRandori, setLoadingRandori] = useState(true)
  const [editingRandoriId, setEditingRandoriId] = useState(null)
  const [editCount, setEditCount] = useState(0)
  const [editNote, setEditNote] = useState('')

  // --- Stati Massimali ---
  const [squat, setSquat] = useState('')
  const [bench, setBench] = useState('')
  const [row, setRow] = useState('')
  const [deadlift, setDeadlift] = useState('')
  const [liftsHistory, setLiftsHistory] = useState([])
  const [loadingLifts, setLoadingLifts] = useState(true)
  const [editingLiftId, setEditingLiftId] = useState(null)
  const [editLift, setEditLift] = useState({ squat: '', bench_press: '', row_pull: '', deadlift: '' })

  useEffect(() => {
    if (currentView === 'randori') {
      fetchRandoriHistory()
    } else {
      fetchLiftsHistory()
    }
  }, [activeFilter, currentView])

  // --- LOGICA RANDORI ---
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

  // Un'unica query: lo storico completo del periodo, da cui deriviamo anche il totale
  const fetchRandoriHistory = async () => {
    setLoadingRandori(true)
    const startDate = format(getStartDate(activeFilter), 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('randori_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('session_date', startDate)
      .order('session_date', { ascending: false })

    if (error) {
      alert("Errore nel caricamento dello storico: " + error.message)
    } else {
      setHistory(data)
    }
    setLoadingRandori(false)
  }

  const periodTotal = history.reduce((sum, s) => sum + s.randori_count, 0)
  const randoriChartData = [...history].reverse().map(item => ({
    label: shortDate(item.session_date),
    value: item.randori_count
  }))

  const handleSaveRandori = async () => {
    if (currentCount <= 0) return alert("Inserisci almeno 1 randori!")
    const { error } = await supabase.from('randori_sessions').insert([{
      randori_count: currentCount,
      session_date: format(new Date(), 'yyyy-MM-dd'),
      user_id: userId,
      note: sessionNote
    }])
    if (error) {
      alert("Errore nel salvataggio: " + error.message)
    } else {
      setCurrentCount(0); setSessionNote(''); fetchRandoriHistory()
    }
  }

  const handleDeleteRandori = async (id) => {
    if (!window.confirm("Vuoi eliminare questo allenamento?")) return;
    const { error } = await supabase.from('randori_sessions').delete().eq('id', id);
    if (error) {
      alert("Errore nell'eliminazione: " + error.message)
    } else {
      fetchRandoriHistory();
    }
  }

  const startEditRandori = (item) => {
    setEditingRandoriId(item.id)
    setEditCount(item.randori_count)
    setEditNote(item.note || '')
  }

  const cancelEditRandori = () => setEditingRandoriId(null)

  const saveEditRandori = async (id) => {
    if (editCount <= 0) return alert("Inserisci almeno 1 randori!")
    const { error } = await supabase
      .from('randori_sessions')
      .update({ randori_count: editCount, note: editNote })
      .eq('id', id)

    if (error) {
      alert("Errore nel salvataggio: " + error.message)
    } else {
      setEditingRandoriId(null)
      fetchRandoriHistory()
    }
  }

  // --- LOGICA MASSIMALI ---
  const fetchLiftsHistory = async () => {
    setLoadingLifts(true)
    const { data, error } = await supabase
      .from('max_lifts')
      .select('*')
      .eq('user_id', userId)
      .order('lift_date', { ascending: false })
      .order('created_at', { ascending: false }) // Questa riga assicura l'ordine cronologico esatto!

    if (error) {
      alert("Errore nel caricamento dei massimali: " + error.message)
    } else {
      setLiftsHistory(data)
    }
    setLoadingLifts(false)
  }

  const handleSaveLifts = async () => {
    if (!squat && !bench && !row && !deadlift) return alert("Inserisci almeno un massimale!")

    const { error } = await supabase.from('max_lifts').insert([{
      user_id: userId,
      lift_date: format(new Date(), 'yyyy-MM-dd'),
      squat: squat ? parseFloat(squat) : null,
      bench_press: bench ? parseFloat(bench) : null,
      row_pull: row ? parseFloat(row) : null,
      deadlift: deadlift ? parseFloat(deadlift) : null
    }])

    if (error) {
      alert("Errore salvataggio: " + error.message)
    } else {
      setSquat(''); setBench(''); setRow(''); setDeadlift('');
      fetchLiftsHistory()
    }
  }

  const handleDeleteLift = async (id) => {
    if (!window.confirm("Vuoi eliminare questo record dei massimali?")) return;
    const { error } = await supabase.from('max_lifts').delete().eq('id', id);
    if (error) {
      alert("Errore nell'eliminazione: " + error.message)
    } else {
      fetchLiftsHistory();
    }
  }

  const startEditLift = (lift) => {
    setEditingLiftId(lift.id)
    setEditLift({
      squat: lift.squat ?? '',
      bench_press: lift.bench_press ?? '',
      row_pull: lift.row_pull ?? '',
      deadlift: lift.deadlift ?? ''
    })
  }

  const cancelEditLift = () => setEditingLiftId(null)

  const saveEditLift = async (id) => {
    const { error } = await supabase
      .from('max_lifts')
      .update({
        squat: editLift.squat !== '' ? parseFloat(editLift.squat) : null,
        bench_press: editLift.bench_press !== '' ? parseFloat(editLift.bench_press) : null,
        row_pull: editLift.row_pull !== '' ? parseFloat(editLift.row_pull) : null,
        deadlift: editLift.deadlift !== '' ? parseFloat(editLift.deadlift) : null
      })
      .eq('id', id)

    if (error) {
      alert("Errore nel salvataggio: " + error.message)
    } else {
      setEditingLiftId(null)
      fetchLiftsHistory()
    }
  }

  // CALCOLO DEGLI ULTIMI MASSIMALI INSERITI
  // Cerca il primo valore non nullo per ogni esercizio partendo dal più recente
  const currentMaxes = {
    squat: liftsHistory.find(l => l.squat !== null)?.squat || '-',
    bench: liftsHistory.find(l => l.bench_press !== null)?.bench_press || '-',
    row: liftsHistory.find(l => l.row_pull !== null)?.row_pull || '-',
    deadlift: liftsHistory.find(l => l.deadlift !== null)?.deadlift || '-'
  }

  // Serie per il grafico massimali: stesso indice cronologico per tutte, punti nulli esclusi
  const liftsAsc = [...liftsHistory].reverse()
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

  // --- INTERFACCIA ---
  return (
    <div className="dashboard">

      {/* Sidebar Overlay */}
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)}></div>}

      {/* Sidebar Menu */}
      <div className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <button className="sidebar-close" onClick={() => setMenuOpen(false)}>X</button>
        <h3 style={{color: '#8e8e93', marginTop: '20px'}}>Navigazione</h3>
        <button
          className={`sidebar-btn ${currentView === 'randori' ? 'active' : ''}`}
          onClick={() => { setCurrentView('randori'); setMenuOpen(false); }}
        >
          🥋 I Miei Randori
        </button>
        <button
          className={`sidebar-btn ${currentView === 'lifts' ? 'active' : ''}`}
          onClick={() => { setCurrentView('lifts'); setMenuOpen(false); }}
        >
          🏋️ Massimali Pesi
        </button>
      </div>

      {/* Header */}
      <header className="dash-header">
        <div className="header-actions">
          <button className="hamburger-btn" onClick={() => setMenuOpen(true)}>☰</button>
          <h2>{currentView === 'randori' ? 'Randori' : 'Massimali'}</h2>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="logout-btn-small">Esci</button>
      </header>

      {/* =========================================================================
                                SCHERMATA 1: RANDORI
         ========================================================================= */}
      {currentView === 'randori' && (
        <>
          <div className="card">
            <h3>Nuovo Allenamento (Oggi)</h3>
            <div className="counter-box">
              <button className="round-btn" onClick={() => setCurrentCount(Math.max(0, currentCount - 1))}>-</button>
              <span className="counter-value">{currentCount}</span>
              <button className="round-btn" onClick={() => setCurrentCount(currentCount + 1)}>+</button>
            </div>
            <textarea className="note-input" placeholder="Come è andata l'allenamento?" value={sessionNote} onChange={(e) => setSessionNote(e.target.value)} rows="3"></textarea>
            <button onClick={handleSaveRandori} className="save-btn">Salva Sessione</button>
          </div>

          <div className="card">
            <h3>Statistiche</h3>
            <div className="filters">
              {FILTERS.map(f => (
                <button key={f.id} className={`filter-btn ${activeFilter === f.id ? 'active' : ''}`} onClick={() => setActiveFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="stats-total">{periodTotal}</div>
            <p className="stats-label">Randori nel periodo</p>

            {!loadingRandori && <BarChart data={randoriChartData} color="#007aff" />}
          </div>

          <div className="card">
            <h3>Storico Recente</h3>
            {loadingRandori ? <p className="empty-history">Caricamento...</p> : (
              <ul className="history-list">
                {history.length === 0 ? <p className="empty-history">Nessun allenamento registrato.</p> : (
                  history.map(item => (
                    <li key={item.id} className="history-item-ext">
                      {editingRandoriId === item.id ? (
                        <div className="edit-panel">
                          <div className="edit-count-row">
                            <input
                              type="number"
                              value={editCount}
                              onChange={(e) => setEditCount(Number(e.target.value))}
                            />
                            <span>randori</span>
                          </div>
                          <textarea
                            className="note-input"
                            rows="2"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="Nota (facoltativa)"
                          ></textarea>
                          <div className="edit-actions">
                            <button className="save-btn" onClick={() => saveEditRandori(item.id)}>Salva</button>
                            <button className="delete-btn" onClick={cancelEditRandori}>Annulla</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="history-info">
                            <div className="history-header">
                              <span>{item.session_date}</span>
                              <strong>{item.randori_count} randori</strong>
                            </div>
                            {item.note && <p className="history-note">"{item.note}"</p>}
                          </div>
                          <div className="history-actions">
                            <button onClick={() => startEditRandori(item)} className="edit-btn">Modifica</button>
                            <button onClick={() => handleDeleteRandori(item.id)} className="delete-btn">Elimina</button>
                          </div>
                        </>
                      )}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </>
      )}

      {/* =========================================================================
                             SCHERMATA 2: MASSIMALI PESI
         ========================================================================= */}
      {currentView === 'lifts' && (
        <>
          {/* SEZIONE 1: Inserimento */}
          <div className="card">
            <h3>Registra Test (In KG)</h3>
            <p style={{fontSize: '13px', color: '#8e8e93', textAlign: 'center', marginBottom: '15px'}}>Lascia vuoto se non hai testato l'esercizio</p>
            <div className="lifts-grid">
              <div className="lift-input-group">
                <label>Squat</label>
                <input type="number" className="lift-input" placeholder="es. 120" value={squat} onChange={e => setSquat(e.target.value)}/>
              </div>
              <div className="lift-input-group">
                <label>Panca</label>
                <input type="number" className="lift-input" placeholder="es. 90" value={bench} onChange={e => setBench(e.target.value)}/>
              </div>
              <div className="lift-input-group">
                <label>Rematore</label>
                <input type="number" className="lift-input" placeholder="es. 85" value={row} onChange={e => setRow(e.target.value)}/>
              </div>
              <div className="lift-input-group">
                <label>Stacchi</label>
                <input type="number" className="lift-input" placeholder="es. 150" value={deadlift} onChange={e => setDeadlift(e.target.value)}/>
              </div>
            </div>

            <button onClick={handleSaveLifts} className="save-btn" style={{backgroundColor: '#007aff', marginTop: '5px'}}>
              Salva Massimali
            </button>
          </div>

          {/* SEZIONE 2: I Tuoi Massimali Attuali (Ultimo inserimento) */}
          <div className="card">
            <h3>I Tuoi Massimali Attuali</h3>
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

          {/* SEZIONE 3: Grafico Andamento */}
          <div className="card">
            <h3>Andamento Massimali</h3>
            {loadingLifts ? <p className="empty-history">Caricamento...</p> : <LineChart series={liftsChartSeries} />}
          </div>

          {/* SEZIONE 4: Storico Inserimenti */}
          <div className="card">
            <h3>Storico Test</h3>
            {loadingLifts ? <p className="empty-history">Caricamento...</p> : (
              <ul className="history-list">
                {liftsHistory.length === 0 ? <p className="empty-history">Nessun record inserito.</p> : (
                  liftsHistory.map(lift => (
                    <li key={lift.id} style={{display: 'flex', flexDirection: 'column', borderBottom: '1.5px solid #f2f2f7', padding: '15px 0'}}>
                      {editingLiftId === lift.id ? (
                        <div className="edit-panel">
                          <div className="lifts-grid" style={{marginBottom: 0}}>
                            <div className="lift-input-group">
                              <label>Squat</label>
                              <input type="number" className="lift-input" value={editLift.squat} onChange={e => setEditLift({...editLift, squat: e.target.value})}/>
                            </div>
                            <div className="lift-input-group">
                              <label>Panca</label>
                              <input type="number" className="lift-input" value={editLift.bench_press} onChange={e => setEditLift({...editLift, bench_press: e.target.value})}/>
                            </div>
                            <div className="lift-input-group">
                              <label>Rematore</label>
                              <input type="number" className="lift-input" value={editLift.row_pull} onChange={e => setEditLift({...editLift, row_pull: e.target.value})}/>
                            </div>
                            <div className="lift-input-group">
                              <label>Stacchi</label>
                              <input type="number" className="lift-input" value={editLift.deadlift} onChange={e => setEditLift({...editLift, deadlift: e.target.value})}/>
                            </div>
                          </div>
                          <div className="edit-actions">
                            <button className="save-btn" onClick={() => saveEditLift(lift.id)}>Salva</button>
                            <button className="delete-btn" onClick={cancelEditLift}>Annulla</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center'}}>
                            <span style={{fontWeight: '600'}}>{lift.lift_date}</span>
                            <div style={{display: 'flex', gap: '8px'}}>
                              <button onClick={() => startEditLift(lift)} className="edit-btn">Modifica</button>
                              <button onClick={() => handleDeleteLift(lift.id)} className="delete-btn" style={{marginLeft: 0}}>Elimina</button>
                            </div>
                          </div>
                          <div className="lifts-grid" style={{marginBottom: 0, gap: '8px'}}>
                            <div className="lift-history-row"><span className="lift-val">Squat</span> <strong className="lift-val">{lift.squat || '-'} kg</strong></div>
                            <div className="lift-history-row"><span className="lift-val">Panca</span> <strong className="lift-val">{lift.bench_press || '-'} kg</strong></div>
                            <div className="lift-history-row"><span className="lift-val">Row</span> <strong className="lift-val">{lift.row_pull || '-'} kg</strong></div>
                            <div className="lift-history-row"><span className="lift-val">Stacco</span> <strong className="lift-val">{lift.deadlift || '-'} kg</strong></div>
                          </div>
                        </>
                      )}
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
