import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function SetManager() {
  const { profile } = useAuth()
  const [sets,    setSets]    = useState([])
  const [users,   setUsers]   = useState([])
  const [books,   setBooks]   = useState([])
  const [loading, setLoading] = useState(true)

  // New set form
  const [setName, setSetName] = useState('')
  const [setDesc, setSetDesc] = useState('')
  const [saving,  setSaving]  = useState(false)

  // Active set for editing
  const [activeSet, setActiveSet] = useState(null)
  const [setVerses, setSetVerses] = useState([])

  // Add verse to set
  const [addBook,    setAddBook]    = useState('')
  const [addChapter, setAddChapter] = useState('')
  const [addVerse,   setAddVerse]   = useState('')
  const [addVersion, setAddVersion] = useState('KJV')

  // Assign set to user
  const [assignUser, setAssignUser] = useState('')

  useEffect(() => {
    fetchSets()
    fetchUsers()
    fetchBooks()
  }, [])

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

  async function fetchBooks() {
    const { data } = await supabase.from('books').select('*').order('sort_order')
    if (data) {
      setBooks(data)
      setAddBook(data[0]?.id ?? '')
    }
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
    fetchSetVerses(s.id)
  }

  async function addVerseToSet(e) {
    e.preventDefault()
    // Look up the verse
    const { data: verseData } = await supabase
      .from('verses')
      .select('id')
      .eq('book_id', parseInt(addBook))
      .eq('chapter', parseInt(addChapter))
      .eq('verse',   parseInt(addVerse))
      .eq('version', addVersion)
      .single()

    if (!verseData) {
      alert('Verse not found. Make sure it has been added in the Verses tab.')
      return
    }

    await supabase.from('verse_set_items').upsert({
      set_id:     activeSet.id,
      verse_id:   verseData.id,
      sort_order: setVerses.length,
    })
    fetchSetVerses(activeSet.id)
    setAddChapter(''); setAddVerse('')
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

    // Get all verses in this set for the user's version
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
      ) : (
        <div className="space-y-2">
          {sets.map(s => (
            <div key={s.id} className={`bg-white border rounded-2xl p-4 cursor-pointer transition-all ${activeSet?.id === s.id ? 'border-brand-300 shadow-md' : 'border-slate-100 hover:border-slate-200'}`}
              onClick={() => openSet(s)}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-700 text-sm">{s.name}</p>
                  {s.description && <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>}
                </div>
                <button onClick={e => { e.stopPropagation(); deleteSet(s.id) }}
                  className="text-xs text-red-400 hover:text-red-600 ml-2 flex-shrink-0">
                  Delete
                </button>
              </div>

              {activeSet?.id === s.id && (
                <div className="mt-4 space-y-4" onClick={e => e.stopPropagation()}>
                  {/* Verse list */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-2">Verses in this set ({setVerses.length})</p>
                    {setVerses.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No verses yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {setVerses.map(item => (
                          <div key={item.id} className="flex items-center gap-2 text-xs">
                            <span className="text-brand-600 font-medium">
                              {item.verses.books.name} {item.verses.chapter}:{item.verses.verse} ({item.verses.version})
                            </span>
                            <button onClick={() => removeVerseFromSet(item.id)} className="text-red-400 hover:text-red-600 ml-auto">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add verse to set */}
                  <form onSubmit={addVerseToSet} className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500">Add verse</p>
                    <div className="grid grid-cols-4 gap-1">
                      <select value={addVersion} onChange={e => setAddVersion(e.target.value)}
                        className="border border-slate-200 rounded px-1 py-1.5 text-xs col-span-1 focus:outline-none">
                        <option>KJV</option><option>NKJV</option>
                      </select>
                      <select value={addBook} onChange={e => setAddBook(e.target.value)}
                        className="border border-slate-200 rounded px-1 py-1.5 text-xs col-span-1 focus:outline-none">
                        {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                      <input type="number" min="1" required placeholder="Ch" value={addChapter} onChange={e => setAddChapter(e.target.value)}
                        className="border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none" />
                      <input type="number" min="1" required placeholder="Vs" value={addVerse} onChange={e => setAddVerse(e.target.value)}
                        className="border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none" />
                    </div>
                    <button type="submit"
                      className="w-full border border-brand-300 text-brand-600 rounded-lg py-1.5 text-xs font-semibold hover:bg-brand-50 transition-colors">
                      + Add to set
                    </button>
                  </form>

                  {/* Assign to user */}
                  <form onSubmit={assignSetToUser} className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500">Assign to user</p>
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
