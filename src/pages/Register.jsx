import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Register() {
  const navigate       = useNavigate()
  const [params]       = useSearchParams()
  const token          = params.get('token')

  const [invite, setInvite]     = useState(null)
  const [tokenError, setTokenError] = useState('')
  const [checking, setChecking] = useState(true)

  const [username, setUsername]         = useState('')
  const [password, setPassword]         = useState('')
  const [bibleVersion, setBibleVersion] = useState('NKJV')
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)

  useEffect(() => {
    if (!token) {
      setTokenError('No invite token found. Ask an admin for an invite link.')
      setChecking(false)
      return
    }
    supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setTokenError('Invite not found.')
        } else if (data.used) {
          setTokenError('This invite has already been used.')
        } else if (new Date(data.expires_at) < new Date()) {
          setTokenError('This invite has expired. Ask an admin for a new one.')
        } else {
          setInvite(data)
        }
        setChecking(false)
      })
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // 1. Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: { username, bible_version: bibleVersion },
        },
      })
      if (signUpError) throw signUpError

      // 2. Mark invite as used
      await supabase
        .from('invites')
        .update({ used: true, used_by: authData.user.id })
        .eq('id', invite.id)

      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 text-sm">Checking invite…</p>
      </div>
    )
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <p className="text-slate-700 font-semibold">Invite Required</p>
          <p className="text-slate-500 text-sm">{tokenError}</p>
          <Link to="/login" className="text-brand-600 text-sm font-medium hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-700 to-brand-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">✝️</div>
          <h1 className="text-white text-2xl font-serif font-bold tracking-wide">Create Account</h1>
          <p className="text-brand-200 text-sm mt-1">{invite.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Your name</label>
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="First name or nickname"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="8+ characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Bible version</label>
            <div className="grid grid-cols-2 gap-2">
              {['NKJV','KJV'].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBibleVersion(v)}
                  className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                    bibleVersion === v
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">You can change this later in settings.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
