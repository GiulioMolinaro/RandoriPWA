import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Dashboard from './Dashboard'
import CoachDashboard from './CoachDashboard'
import SuperAdminDashboard from './SuperAdminDashboard'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  
  // Stati per Login/Registrazione
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
useEffect(() => {
    const checkRole = async (userSession) => {
      if (!userSession || !userSession.user) {
        setRole(null)
        return
      }

      // Legge direttamente il ruolo dal database per qualsiasi utente
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userSession.user.id)
        .limit(1)
      
      if (data && data.length > 0) {
        setRole(data[0].role)
      } else {
        // Se non ha un ruolo assegnato, di default è un atleta ('user')
        setRole('user')
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      checkRole(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      checkRole(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    if (isLogin) {
      // LOGICA ACCESSO
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert("Errore: " + error.message)
    } else {
      // LOGICA REGISTRAZIONE
      if (!name) {
        alert("Inserisci il tuo nome!")
        setLoading(false)
        return
      }
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        alert("Errore: " + error.message)
      } else if (data.user) {
        // Salviamo il nome nel profilo appena l'account è creato
        await supabase.from('profiles').insert([{ id: data.user.id, full_name: name }])
        alert("Registrazione completata! Ora puoi accedere.")
        setIsLogin(true) // Riporta l'utente alla schermata di login
      }
    }
    setLoading(false)
  }

  // Schermata di Login / Registrazione
  if (!session) {
    return (
      <div className="login-container">
        <h1>Judo Tracker</h1>
        
        <div className="auth-toggle">
          <button className={isLogin ? 'active' : ''} onClick={() => setIsLogin(true)}>Accedi</button>
          <button className={!isLogin ? 'active' : ''} onClick={() => setIsLogin(false)}>Registrati</button>
        </div>

        <form onSubmit={handleAuth} className="login-form">
          {!isLogin && (
            <input type="text" placeholder="Nome e Cognome" value={name} onChange={(e) => setName(e.target.value)} required />
          )}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password (min 6 car.)" value={password} onChange={(e) => setPassword(e.target.value)} required />
          
          <button type="submit" disabled={loading}>
            {loading ? 'Attendere...' : isLogin ? 'Accedi' : 'Registrati'}
          </button>
        </form>
      </div>
    )
  }

  // Smistamento Interfacce
  if (!role) return <div className="loading-screen">Caricamento interfaccia...</div>
  if (role === 'super_admin') return <SuperAdminDashboard />
  if (role === 'admin') return <CoachDashboard />

  return <Dashboard session={session} />
}

export default App