import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function VerseManager() {
  const [books,   setBooks]   = useState([])
  const [verses,  setVerses]  = useState([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [bookId,   setBookId]   = useState('')
  const [chapter,  setChapter]  = useState('')
  const [verse,    setVerse]    = useState('')
  const [version,  setVersion]  = useState('KJV')
  const [text,     setText]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  // Filter state
  const [filterVersion, setFilterVersion] = useState('KJV')
  const [filterBook,    setFilterBook]    = useState('')
  const [editingId,     setEditingId]     = useState(null)

  useEffect(() => {
    fetchBooks()
  }, [])

  useEffect(() => {
    if (books.length > 0) fetchVerses()
  }, [filterVersion, filterBook, books])

  async function fetchBooks() {
    const { data } = await supabase.from('books').select('*').order('sort_order')
    if (data) {
      setBooks(data)
      setBookId(data[0]?.id ?? '')
      setFilterBook(data[0]?.id ?? '')
    }
  }

  async function fetchVerses() {
    setLoading(true)
    let query = supabase
      .from('verses')
      .select('*, books(name)')
      .eq('version', filterVersion)
      .order('book_id').order('chapter').order('verse')

    if (filterBook) query = query.eq('book_id', filterBook)
    query = query.limit(100)

    const { data } = await query
    if (data) setVerses(data)
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (editingId) {
        const { error } = await supabase
          .from('verses')
          .update({ text, chapter: parseInt(chapter), verse: parseInt(verse) })
          .eq('id', editingId)
        if (error) throw error
        setEditingId(null)
      } else {
        const { error } = await supabase.from('verses').insert({
          book_id: parseInt(bookId),
          chapter: parseInt(chapter),
          verse:   parseInt(verse),
          version,
          text,
        })
        if (error) throw error
      }
      resetForm()
      fetchVerses()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setChapter(''); setVerse(''); setText(''); setEditingId(null)
  }

  function startEdit(v) {
    setEditingId(v.id)
    setBookId(v.book_id)
    setChapter(v.chapter)
    setVerse(v.verse)
    setVersion(v.version)
    setText(v.text)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteVerse(id) {
    if (!confirm('Delete this verse? This cannot be undone.')) return
    await supabase.from('verses').delete().eq('id', id)
    fetchVerses()
  }

  return (
    <div className="space-y-6">
      {/* Add/Edit form */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold text-slate-700 text-sm">
          {editingId ? 'Edit verse' : 'Add verse'}
        </h3>
        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Version</label>
              <select
                value={version}
                onChange={e => setVersion(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option>KJV</option>
                <option>NKJV</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Book</label>
              <select
                value={bookId}
                onChange={e => setBookId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Chapter</label>
              <input type="number" min="1" required value={chapter} onChange={e => setChapter(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Verse</label>
              <input type="number" min="1" required value={verse} onChange={e => setVerse(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Verse text</label>
            <textarea
              required
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-serif focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="For God so loved the world…"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add verse'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm}
                className="px-4 border border-slate-200 rounded-lg text-sm text-slate-500 hover:bg-slate-50">
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Filter + list */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <select
            value={filterVersion}
            onChange={e => setFilterVersion(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
          >
            <option>KJV</option>
            <option>NKJV</option>
          </select>
          <select
            value={filterBook}
            onChange={e => setFilterBook(e.target.value)}
            className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
          >
            {books.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-4">Loading…</p>
        ) : verses.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-4">No verses yet for this selection.</p>
        ) : (
          <div className="space-y-2">
            {verses.map(v => (
              <div key={v.id} className="bg-white border border-slate-100 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-brand-700 mb-1">
                      {v.books?.name} {v.chapter}:{v.verse} · {v.version}
                    </p>
                    <p className="text-sm text-slate-600 font-serif leading-snug">{v.text}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 pt-0.5">
                    <button onClick={() => startEdit(v)} className="text-xs text-brand-500 hover:underline">Edit</button>
                    <button onClick={() => deleteVerse(v.id)} className="text-xs text-red-400 hover:text-red-600">Del</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
