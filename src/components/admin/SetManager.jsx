import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function SetManager() {
  const { profile } = useAuth()
  const [sets,    setSets]    = useState([])
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)

  // New set form
  const [setName, setSetName] = useState('')
  const [setDesc, setSetDesc] = useState('')
  const [saving,  setSaving]  = useState(false)

  // Active set for editing
  const [activeSet,  setActiveSet]  = useState(null)
  const [setVerses,  setSetVerses]  = useState([])

  // Verse picker
  const [allVerses,     setAllVerses]     = useState([])
  const [verseSearch,   setVerseSearch]   = useState('')
  const [pickVersion,   setPickVersion]   = useState('KJV')

  // Assign set to user
  const [assignUser, setAssignUser] = useState('')

  useEffect(() => {
    fetchSets()
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchAllVerses()
  }, [pickVersion])

  async function fetchSets() {
    const { data } = await supabase
      .from('verse_sets')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setSets(data)
    setLoading(false)
  }

  async function fetchUsers() {
    const { data } = await supabase.from('profiles').select('id, username, bible_version')
    if (data) setUsers(data)
  }

  async function fetchAllVerses() {
    const { data } = await supabase
      .from('verses')
      .select('id, chapter, verse, version, text, books(name)')
      .eq('version', pickVersion)
      .order('book_id').order('chapter').order('verse')
    if (data) setAllVerses(data)
  }

  async function fetchSetVerses(setId) {
    const { data } = await supabase
      .from('verse_set_items')
      .select('*, verses(id, chapter, verse, version, text, books(name))')
      .eq('set_id', setId)
      .order('sort_order')
    if (data) setSetVerses(data)
  }

  async function createSet(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase.from('verse_sets').insert({
      name: setName,
      description: setDesc,
      created_by: profile.id,
    }).select().single()
    if (!error && data) {
      setSetName(''); setSetDesc('')
      fetchSets()
      openSet(data)
    }
    setSaving(false)
  }

  async function openSet(s) {
    setActiveSet(s)
    setVerseSearch('')
    fetchSetVerses(s.id)
  }

  async function addVerseToSet(verseId) {
    await supabase.from('verse_set_items').upsert({
      set_id:     activeSet.id,
      verse_id:   verseId,
      sort_order: setVerses.length,
    })
    fetchSetVerses(activeSet.id)
  }

  async function removeVerseFromSet(itemId) {
    await supabase.from('verse_set_items').delete().eq('id', itemId)
    fetchSetVerses(activeSet.id)
  }

  async function assignSetToUser(e) {
    e.preventDefault()
    if (!assignUser) return

    const userProfile = users.find(u => u.id === assignUser)
    const version     = userProfile?.bible_version ?? 'KJV'

    const { data: items } = await supabase
      .from('verse_set_items')
      .select('verses!inner(id, version)')
      .eq('set_id', activeSet.id)
      .eq('verses.version', version)

    if (!items || items.length === 0) {
      alert(`No ${version} verses found in this set. Add ${version} verses first.`)
      return
    }

    const inserts = items.map(i => ({
      user_id:  assignUser,
      verse_id: i.verses.id,
    }))

    const { error } = await supabase
      .from('user_verses')
      .upsert(inserts, { onConflict: 'user_id,verse_id', ignoreDuplicates: true })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert(`Assigned ${inserts.length} verse${inserts.length !== 1 ? 's' : ''} to ${userProfile?.username}!`)
    }
  }

  async function deleteSet(id) {
    if (!confirm('Delete this set? Assigned user verses will not be removed.')) return
    await supabase.from('verse_sets').delete().eq('id', id)
    fetchSets()
    if (activeSet?.id === id) setActiveSet(null)
  }

  async function addAllToSet() {
    if (filteredVerses.length === 0) return
    const inserts = filteredVerses.map((v, i) => ({
      set_id:     activeSet.id,
      verse_id:   v.id,
      sort_order: setVerses.length + i,
    }))
    await supabase.from('verse_set_items').upsert(inserts, { onConflict: 'set_id,verse_id', ignoreDuplicates: true })
    fetchSetVerses(activeSet.id)
  }

  // Filter available verses by search and exclude already-added ones
  const addedVerseIds = new Set(setVerses.map(sv => sv.verses?.id))
  const filteredVerses = allVerses.filter(v => {
    if (addedVerseIds.has(v.id)) return false
    if (!verseSearch) return true
    const ref  = `${v.books?.name} ${v.chapter}:${v.verse}`.toLowerCase()
    const text = v.text.toLowerCase()
    const q    = verseSearch.toLowerCase()
    return ref.includes(q) || text.includes(q)
  })

  return (
    <div className="space-y-6">
      {/* Create set */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm">Create a verse set</h3>
        <form onSubmit={createSet} className="space-y-2">
          <input
            required value={setName} onChange={e => setSetName(e.target.value)}
            placeholder="Set name (e.g. Romans Road)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            value={setDesc} onChange={e => setSetDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit" disabled={saving}
            className="w-full bg-brand-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Creating…' : 'Create set'}
          </button>
        </form>
      </div>

      {/* Set list */}
      {loading ? (
        <p className="text-sm text-slate-400 text-center py-4">Loading…</p>
      ) : sets.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-4">No sets yet.</p>
      ) : (
        <div className="space-y-2">
          {sets.map(s => (
            <div key={s.id}
              className={`bg-white border rounded-2xl p-4 transition-all ${activeSet?.id === s.id ? 'border-brand-300 shadow-md' : 'border-slate-100'}`}
            >
              {/* Set header */}
              <div className="flex items-start justify-between">
                <button className="flex-1 text-left" onClick={() => activeSet?.id === s.id ? setActiveSet(null) : openSet(s)}>
                  <p className="font-semibold text-slate-700 text-sm">{s.name}</p>
                  {s.description && <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>}
                </button>
                <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                  <span className="text-xs text-slate-400">{activeSet?.id === s.id ? '▾' : '▸'}</span>
                  <button onClick={() => deleteSet(s.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                </div>
              </div>

              {/* Expanded set editor */}
              {activeSet?.id === s.id && (
                <div className="mt-4 space-y-5">

                  {/* Verses already in set */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">
                      In this set ({setVerses.length})
                    </p>
                    {setVerses.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">None yet — add from the list below.</p>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {setVerses.map(item => (
                          <div key={item.id} className="flex items-center gap-2 bg-brand-50 rounded-lg px-3 py-1.5">
                            <span className="text-xs text-brand-700 font-medium flex-1">
                              {item.verses?.books?.name} {item.verses?.chapter}:{item.verses?.verse} ({item.verses?.version})
                            </span>
                            <button onClick={() => removeVerseFromSet(item.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Verse picker */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-slate-500">Add verses</p>
                      <select
                        value={pickVersion}
                        onChange={e => { setPickVersion(e.target.value); setVerseSearch('') }}
                        className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none ml-auto"
                      >
                        <option>KJV</option>
                        <option>NKJV</option>
                      </select>
                    </div>

                    <div className="flex gap-2 mb-2">
                      <input
                        value={verseSearch}
                        onChange={e => setVerseSearch(e.target.value)}
                        placeholder="Search by reference or text…"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <button
                        type="button"
                        onClick={addAllToSet}
                        disabled={filteredVerses.length === 0}
                        className="flex-shrink-0 bg-brand-600 text-white rounded-lg px-3 py-2 text-xs font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                      >
                        + Add all ({filteredVerses.length})
                      </button>
                    </div>

                    <div className="space-y-1 max-h-64 overflow-y-auto border border-slate-100 rounded-xl p-2">
                      {filteredVerses.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-3">
                          {allVerses.length === 0 ? `No ${pickVersion} verses imported yet.` : 'No matches.'}
                        </p>
                      ) : (
                        filteredVerses.map(v => (
                          <button
                            key={v.id}
                            onClick={() => addVerseToSet(v.id)}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-brand-50 transition-colors group"
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-semibold text-brand-600 flex-shrink-0 mt-0.5">
                                {v.books?.name} {v.chapter}:{v.verse}
                              </span>
                              <span className="text-xs text-slate-500 font-serif line-clamp-2 flex-1">
                                {v.text}
                              </span>
                              <span className="text-xs text-brand-400 opacity-0 group-hover:opacity-100 flex-shrink-0">+ Add</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Assign to user */}
                  <form onSubmit={assignSetToUser} className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500">Assign set to user</p>
                    <div className="flex gap-2">
                      <select value={assignUser} onChange={e => setAssignUser(e.target.value)}
                        required
                        className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                        <option value="">Select user…</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.bible_version})</option>)}
                      </select>
                      <button type="submit"
                        className="bg-brand-600 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-brand-700 transition-colors">
                        Assign
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">Only assigns verses matching the user's preferred version.</p>
                  </form>

                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
