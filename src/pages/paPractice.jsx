import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import TypingPractice from '../components/practice/TypingPractice'

export default function Practice() {
  const { profile }  = useAuth()
  const navigate     = useNavigate()
  const [queue,   setQueue]   = useState([])
  const [index,   setIndex]   = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadQueue()
  }, [profile?.id])

  async function loadQueue() {
    const ids = JSON.parse(sessionStorage.getItem('practiceQueue') || '[]')

    if (ids.length === 0) {
      navigate('/', { replace: true })
      return
    }

    const { data } = await supabase
      .from('user_verses')
      .select(`
        *,
        verses (
          id, chapter, verse, version, text,
          books ( name )
        )
      `)
      .in('id', ids)
      .eq('user_id', profile.id)

    if (data) {
      // Preserve the original ordering from the queue
      const ordered = ids.map(id => data.find(d => d.id === id)).filter(Boolean)
      setQueue(ordered)
    }
    setLoading(false)
  }

  function handleComplete() {
    if (index + 1 < queue.length) {
      setIndex(i => i + 1)
    } else {
      sessionStorage.removeItem('practiceQueue')
      navigate('/', { replace: true })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (queue.length === 0) return null

  const current = queue[index]

  return (
    <div className="flex flex-col max-w-lg mx-auto" style={{ height: '100dvh' }}>
      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-brand-500 transition-all duration-300"
          style={{ width: `${((index) / queue.length) * 100}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-slate-600 text-sm"
        >
          ✕ Exit
        </button>
        <span className="text-xs text-slate-400">{index + 1} / {queue.length}</span>
        <div className="w-12" /> {/* spacer */}
      </div>

      {/* Practice area */}
      <div className="flex-1 overflow-hidden">
        <TypingPractice
          key={current.id}
          userVerse={current}
          onComplete={handleComplete}
        />
      </div>
    </div>
  )
}
