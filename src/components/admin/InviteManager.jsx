import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function InviteManager() {
  const { profile } = useAuth()
  const [invites, setInvites] = useState([])
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(null)

  useEffect(() => { fetchInvites() }, [])

  async function fetchInvites() {
    const { data } = await supabase
      .from('invites')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setInvites(data)
  }

  async function createInvite(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('invites').insert({
      email,
      created_by: profile.id,
    })
    if (!error) {
      setEmail('')
      fetchInvites()
    }
    setLoading(false)
  }

  function inviteLink(token) {
    return `${window.location.origin}/register?token=${token}`
  }

  async function copyLink(token, id) {
    await navigator.clipboard.writeText(inviteLink(token))
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  async function revokeInvite(id) {
    await supabase.from('invites').delete().eq('id', id)
    fetchInvites()
  }

  const pending = invites.filter(i => !i.used && new Date(i.expires_at) > new Date())
  const used    = invites.filter(i => i.used)
  const expired = invites.filter(i => !i.used && new Date(i.expires_at) <= new Date())

  return (
    <div className="space-y-6">
      {/* Create invite */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm">Send an invite</h3>
        <form onSubmit={createInvite} className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-brand-600 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {loading ? '…' : 'Invite'}
          </button>
        </form>
        <p className="text-xs text-slate-400">Invites expire after 7 days. Copy the link below and send it to the person.</p>
      </div>

      {/* Pending invites */}
      {pending.length > 0 && (
        <InviteGroup title="Pending" invites={pending} onCopy={copyLink} onRevoke={revokeInvite} copied={copied} />
      )}
      {used.length > 0 && (
        <InviteGroup title="Used" invites={used} used />
      )}
      {expired.length > 0 && (
        <InviteGroup title="Expired" invites={expired} onRevoke={revokeInvite} />
      )}
    </div>
  )
}

function InviteGroup({ title, invites, onCopy, onRevoke, copied, used }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-2">
        {invites.map(inv => (
          <div key={inv.id} className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{inv.email}</p>
              <p className="text-xs text-slate-400">
                {used
                  ? `Used`
                  : `Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
              </p>
            </div>
            {!used && onCopy && (
              <button
                onClick={() => onCopy(inv.token, inv.id)}
                className="text-xs text-brand-600 font-medium hover:underline flex-shrink-0"
              >
                {copied === inv.id ? '✓ Copied!' : 'Copy link'}
              </button>
            )}
            {!used && onRevoke && (
              <button
                onClick={() => onRevoke(inv.id)}
                className="text-xs text-red-400 hover:text-red-600 flex-shrink-0"
              >
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
