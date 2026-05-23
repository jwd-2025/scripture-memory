import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Settings() {
  const { profile, updateProfile, signOut } = useAuth()
  const [version,  setVersion]  = useState(profile?.bible_version ?? 'NKJV')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setSaved(false); setError('')
    try {
      await updateProfile({ bible_version: version, username })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.message || 'Failed to save. Check the console for details.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Settings</h1>

      <form onSubmit={handleSave} className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-slate-600 mb-1 block">Your name</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-600 mb-2 block">Bible version</label>
          <div className="grid grid-cols-2 gap-2">
            {['NKJV','KJV'].map(v => (
              <button
                key={v} type="button"
                onClick={() => setVersion(v)}
                className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  version === v
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Changing your version only affects newly assigned verses. Your existing queue stays as-is.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save changes'}
        </button>
      </form>

      {/* Stats */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-slate-700 text-sm">Your stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Day streak" value={`${profile?.streak_count ?? 0} 🔥`} />
          <StatCard label="Version" value={profile?.bible_version ?? '—'} />
        </div>
      </div>

      <button
        onClick={signOut}
        className="w-full py-2.5 rounded-xl border-2 border-red-100 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center">
      <p className="text-lg font-bold text-slate-700">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}
