'use client'

import { useState } from 'react'
import { ArrowLeft, Upload, Sparkles, Save, FileDown } from 'lucide-react'
import Link from 'next/link'
import type { Licitacion, Documento, Analisis } from '@/types'
import SubirDocumentos from './SubirDocumentos'
import AnalisisEditor from './AnalisisEditor'
import ExportarReporte from './ExportarReporte'

interface Props {
  licitacion: Licitacion
  documentos: Documento[]
  analisis: Analisis | null
}

export default function LicitacionDetalle({ licitacion, documentos: docsIniciales, analisis: analisisInicial }: Props) {
  const [documentos, setDocumentos] = useState<Documento[]>(docsIniciales)
  const [analisis, setAnalisis] = useState<Analisis | null>(analisisInicial)
  const [tab, setTab] = useState<'documentos' | 'analisis'>('documentos')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900 truncate">{licitacion.nombre}</h1>
            <p className="text-xs text-gray-400">{licitacion.entidad}</p>
          </div>
          {analisis && (
            <ExportarReporte licitacion={licitacion} analisis={analisis} />
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('documentos')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'documentos'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Documentos ({documentos.length})
          </button>
          <button
            onClick={() => setTab('analisis')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'analisis'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Análisis IA
          </button>
        </div>

        {tab === 'documentos' && (
          <SubirDocumentos
            licitacionId={licitacion.id}
            documentos={documentos}
            onDocumentosChange={setDocumentos}
            onIniciarAnalisis={() => setTab('analisis')}
            analisisExiste={!!analisis}
          />
        )}

        {tab === 'analisis' && (
          <AnalisisEditor
            licitacionId={licitacion.id}
            documentos={documentos}
            analisis={analisis}
            onAnalisisChange={setAnalisis}
          />
        )}
      </div>
    </div>
  )
}
