import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top nav (desktop only) */}
      <header className="hidden sm:flex items-center justify-between px-6 py-3 bg-white border-b border-slate-100 shadow-sm">
        <NavLink to="/" className="font-serif font-bold text-brand-700 text-lg">
          ✝️ Hide It In Your Heart
        </NavLink>
        <nav className="flex items-center gap-4 text-sm">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'text-brand-700 font-semibold' : 'text-slate-500 hover:text-slate-700'}>
            Home
          </NavLink>
          {profile?.is_admin && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'text-brand-700 font-semibold' : 'text-slate-500 hover:text-slate-700'}>
              Admin
            </NavLink>
          )}
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'text-brand-700 font-semibold' : 'text-slate-500 hover:text-slate-700'}>
            Settings
          </NavLink>
          <button onClick={handleSignOut} className="text-slate-400 hover:text-red-500 transition-colors">
            Sign out
          </button>
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20 sm:pb-0">
        {children}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center safe-bottom">
        <NavLink to="/" end className={({ isActive }) =>
          `flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-colors ${isActive ? 'text-brand-600' : 'text-slate-400'}`
        }>
          <span className="text-xl mb-0.5">🏠</span>
          Home
        </NavLink>

        {profile?.is_admin && (
          <NavLink to="/admin" className={({ isActive }) =>
            `flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-colors ${isActive ? 'text-brand-600' : 'text-slate-400'}`
          }>
            <span className="text-xl mb-0.5">⚙️</span>
            Admin
          </NavLink>
        )}

        <NavLink to="/settings" className={({ isActive }) =>
          `flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-colors ${isActive ? 'text-brand-600' : 'text-slate-400'}`
        }>
          <span className="text-xl mb-0.5">👤</span>
          Profile
        </NavLink>
      </nav>
    </div>
  )
}
