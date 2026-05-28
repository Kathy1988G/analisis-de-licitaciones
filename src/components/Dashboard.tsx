'use client'

import { useState } from 'react'
import { Plus, FileText, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Licitacion } from '@/types'
import NuevaLicitacionModal from './NuevaLicitacionModal'
import LicitacionCard from './LicitacionCard'

interface Props {
  licitaciones: Licitacion[]
}

export default function Dashboard({ licitaciones: inicial }: Props) {
  const [licitaciones, setLicitaciones] = useState<Licitacion[]>(inicial)
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleCreada(nueva: Licitacion) {
    setLicitaciones(prev => [nueva, ...prev])
    setShowModal(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Indufrial</h1>
          <p className="text-xs text-gray-400">Gestión de Licitaciones</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <LogOut size={16} />
          Salir
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Licitaciones
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({licitaciones.length})
            </span>
          </h2>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Nueva licitación
          </button>
        </div>

        {licitaciones.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay licitaciones aún. Creá la primera.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {licitaciones.map(l => (
              <LicitacionCard key={l.id} licitacion={l} />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <NuevaLicitacionModal
          onClose={() => setShowModal(false)}
          onCreada={handleCreada}
        />
      )}
    </div>
  )
}
