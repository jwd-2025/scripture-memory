import { useState } from 'react'
import InviteManager   from '../components/admin/InviteManager'
import VerseManager    from '../components/admin/VerseManager'
import SetManager      from '../components/admin/SetManager'
import SheetImport     from '../components/admin/SheetImport'

const TABS = [
  { id: 'invites', label: '✉️ Invites' },
  { id: 'verses',  label: '📖 Verses'  },
  { id: 'sets',    label: '📚 Sets'    },
  { id: 'import',  label: '📥 Import'  },
]

export default function Admin() {
  const [tab, setTab] = useState('invites')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Admin Panel</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-max px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'invites' && <InviteManager />}
      {tab === 'verses'  && <VerseManager />}
      {tab === 'sets'    && <SetManager />}
      {tab === 'import'  && <SheetImport />}
    </div>
  )
}
