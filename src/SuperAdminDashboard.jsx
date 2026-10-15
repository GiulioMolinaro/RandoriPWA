import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function SuperAdminDashboard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    setLoading(true)
    // Scarichiamo i profili e i ruoli assegnati
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*')
    const { data: roles, error: rolesError } = await supabase.from('user_roles').select('*')

    if (profilesError || rolesError) {
      alert("Errore nel caricamento degli utenti: " + (profilesError?.message || rolesError?.message))
    } else if (profiles) {
      // Uniamo i dati: a ogni profilo associamo il suo ruolo (se non lo ha, di default è 'user')
      const mergedUsers = profiles.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id)
        return {
          ...profile,
          role: userRole ? userRole.role : 'user'
        }
      })
      
      // Mettiamo il super_admin in cima, poi gli admin, poi gli user
      mergedUsers.sort((a, b) => a.role.localeCompare(b.role))
      setUsers(mergedUsers)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleChangeRole = async (userId, newRole) => {
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: newRole }) // upsert crea o aggiorna il ruolo

    if (error) {
      alert("Errore nell'aggiornamento del ruolo: " + error.message)
    } else {
      fetchUsers() // Ricarica la lista aggiornata
    }
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        <h2>Pannello Super Admin</h2>
        <button onClick={() => supabase.auth.signOut()} className="logout-btn-small">Esci</button>
      </header>

      <div className="card">
        <h3>Gestione Utenti</h3>
        <ul className="coach-list">
          {loading ? <p>Caricamento utenti...</p> : users.map(u => (
            <li key={u.id} className="admin-user-item">
              <div className="admin-user-info">
                <strong>{u.full_name}</strong>
                <span className={`role-badge ${u.role}`}>{u.role === 'user' ? 'Atleta' : u.role === 'admin' ? 'Coach' : 'Super Admin'}</span>
              </div>
              
              {/* Nascondiamo i bottoni per te stesso (il super_admin) */}
              {u.role !== 'super_admin' && (
                <div className="role-actions">
                  <button 
                    className={`role-btn ${u.role === 'user' ? 'active' : ''}`}
                    onClick={() => handleChangeRole(u.id, 'user')}
                  >
                    Atleta
                  </button>
                  <button 
                    className={`role-btn ${u.role === 'admin' ? 'active' : ''}`}
                    onClick={() => handleChangeRole(u.id, 'admin')}
                  >
                    Coach
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}