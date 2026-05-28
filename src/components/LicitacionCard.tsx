import Link from 'next/link'
import { FileText, ChevronRight } from 'lucide-react'
import type { Licitacion } from '@/types'

interface Props {
  licitacion: Licitacion
}

export default function LicitacionCard({ licitacion }: Props) {
  const fecha = new Date(licitacion.created_at).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <Link
      href={`/licitaciones/${licitacion.id}`}
      className="bg-white rounded-xl border border-gray-100 p-5 hover:border-blue-200 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-blue-500 shrink-0" />
            <span className="text-xs text-gray-400">{fecha}</span>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm truncate">{licitacion.nombre}</h3>
          <p className="text-xs text-gray-500 mt-1 truncate">{licitacion.entidad}</p>
        </div>
        <ChevronRight
          size={16}
          className="text-gray-300 group-hover:text-blue-400 transition-colors shrink-0 mt-1"
        />
      </div>
    </Link>
  )
}
