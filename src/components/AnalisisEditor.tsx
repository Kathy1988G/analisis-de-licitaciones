'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Save, Plus, Trash2, ChevronDown, ChevronUp, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Analisis, Documento } from '@/types'

interface Props {
  licitacionId: string
  documentos: Documento[]
  analisis: Analisis | null
  onAnalisisChange: (a: Analisis) => void
}

const CAMPOS_FIJOS = [
  { key: 'tiempos_entrega', label: 'Tiempos de entrega' },
  { key: 'garantia', label: 'Garantía' },
  { key: 'alcance_servicio', label: 'Alcance del servicio' },
  { key: 'especificaciones_tecnicas', label: 'Especificaciones técnicas' },
  { key: 'logistica', label: 'Logística y flete' },
  { key: 'condicion_pago', label: 'Condición de pago' },
] as const

type CampoFijo = typeof CAMPOS_FIJOS[number]['key']

export default function AnalisisEditor({ licitacionId, documentos, analisis, onAnalisisChange }: Props) {
  const [campos, setCampos] = useState<Record<CampoFijo, string>>({
    tiempos_entrega: analisis?.tiempos_entrega ?? '',
    garantia: analisis?.garantia ?? '',
    alcance_servicio: analisis?.alcance_servicio ?? '',
    especificaciones_tecnicas: analisis?.especificaciones_tecnicas ?? '',
    logistica: analisis?.logistica ?? '',
    condicion_pago: analisis?.condicion_pago ?? '',
  })
  const [camposExtra, setCamposExtra] = useState<Record<string, string>>(
    analisis?.campos_adicionales ?? {}
  )
  const [instrucciones, setInstrucciones] = useState('')
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [advertencias, setAdvertencias] = useState<string[]>([])
  const [nuevoNombre, setNuevoNombre] = useState('')
  const supabase = createClient()
  const progresoTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  function detenerProgreso() {
    if (progresoTimer.current) {
      clearInterval(progresoTimer.current)
      progresoTimer.current = null
    }
  }

  // Limpia el intervalo si el componente se desmonta mientras analiza.
  useEffect(() => detenerProgreso, [])

  async function analizarConIA() {
    if (documentos.length === 0) {
      setError('Primero subí al menos un documento.')
      return
    }
    setAnalizando(true)
    setError('')
    setAdvertencias([])

    // Progreso simulado: el servidor no emite avances, así que avanzamos hacia
    // ~92% (rápido al inicio, lento al final) y saltamos a 100% al terminar.
    setProgreso(6)
    detenerProgreso()
    progresoTimer.current = setInterval(() => {
      setProgreso(p => {
        if (p >= 92) return p
        const inc = p < 40 ? 3.5 : p < 70 ? 1.6 : 0.6
        return Math.min(92, p + inc)
      })
    }, 350)

    try {
      const res = await fetch('/api/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licitacionId,
          documentoIds: documentos.map(d => d.id),
          instrucciones: instrucciones.trim(),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Error en el análisis')
      }

      const data = await res.json()

      setCampos({
        tiempos_entrega: data.tiempos_entrega ?? '',
        garantia: data.garantia ?? '',
        alcance_servicio: data.alcance_servicio ?? '',
        especificaciones_tecnicas: data.especificaciones_tecnicas ?? '',
        logistica: data.logistica ?? '',
        condicion_pago: data.condicion_pago ?? '',
      })
      if (data.campos_adicionales) setCamposExtra(data.campos_adicionales)
      if (data._advertencias?.length) setAdvertencias(data._advertencias)

      // Completar la barra y mostrar el 100% un instante antes de ocultarla.
      detenerProgreso()
      setProgreso(100)
      await new Promise(r => setTimeout(r, 700))
    } catch (e: any) {
      detenerProgreso()
      setError(e?.message ?? 'Error al analizar los documentos.')
    } finally {
      setAnalizando(false)
      setProgreso(0)
    }
  }

  async function guardar() {
    setGuardando(true)
    setError('')

    const payload = {
      licitacion_id: licitacionId,
      ...campos,
      campos_adicionales: camposExtra,
    }

    let data: Analisis | null = null

    if (analisis) {
      const { data: updated } = await supabase
        .from('analisis')
        .update(payload)
        .eq('id', analisis.id)
        .select()
        .single()
      data = updated as Analisis
    } else {
      const { data: created } = await supabase
        .from('analisis')
        .insert(payload)
        .select()
        .single()
      data = created as Analisis
    }

    if (data) onAnalisisChange(data)
    setGuardando(false)
  }

  function agregarCampo() {
    if (!nuevoNombre.trim()) return
    setCamposExtra(prev => ({ ...prev, [nuevoNombre.trim()]: '' }))
    setNuevoNombre('')
  }

  function eliminarCampoExtra(key: string) {
    setCamposExtra(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <button
          onClick={() => setMostrarInstrucciones(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span className="font-medium">
            Instrucciones para el análisis
            {instrucciones.trim() && (
              <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-500" />
            )}
          </span>
          {mostrarInstrucciones ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {mostrarInstrucciones && (
          <div className="px-4 pb-4 border-t border-gray-50">
            <p className="text-xs text-gray-400 mt-3 mb-2">
              Especificá qué información adicional querés que la IA busque en los documentos.
            </p>
            <textarea
              value={instrucciones}
              onChange={e => setInstrucciones(e.target.value)}
              rows={4}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder-gray-300"
              placeholder={"Ej: ¿Hay penalidades por incumplimiento? ¿Se exige seguro de responsabilidad civil? ¿Cuál es el plazo de presentación de ofertas? ¿Requiere certificaciones ISO?"}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={analizarConIA}
          disabled={analizando || documentos.length === 0}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
        >
          {analizando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {analizando ? 'Analizando...' : analisis ? 'Re-analizar con IA' : 'Analizar con IA'}
        </button>
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <Save size={15} />
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {advertencias.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Advertencias</p>
          {advertencias.map((a, i) => (
            <p key={i} className="text-sm text-amber-700">{a}</p>
          ))}
        </div>
      )}

      {analizando && (
        <div className="bg-white border border-blue-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            {progreso >= 100
              ? <CheckCircle2 size={16} className="text-green-500" />
              : <Loader2 size={16} className="text-blue-600 animate-spin" />}
            <span className="text-sm font-medium text-gray-700">
              {progreso >= 100
                ? '¡Análisis completo!'
                : progreso < 35
                ? 'Leyendo los documentos...'
                : progreso < 75
                ? 'Claude está analizando el contenido...'
                : 'Extrayendo la información clave...'}
            </span>
            <span className="ml-auto text-sm font-semibold text-blue-600 tabular-nums">
              {Math.round(progreso)}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-blue-50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                progreso >= 100
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500'
              }`}
              style={{ width: `${progreso}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS_FIJOS.map(({ key, label }) => (
          <div key={key} className="bg-white rounded-xl border border-gray-100 p-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {label}
            </label>
            <textarea
              value={campos[key]}
              onChange={e => setCampos(prev => ({ ...prev, [key]: e.target.value }))}
              rows={4}
              className="w-full text-sm text-gray-700 resize-none focus:outline-none placeholder-gray-300"
              placeholder={`Sin información sobre ${label.toLowerCase()}`}
            />
          </div>
        ))}

        {Object.entries(camposExtra).map(([key, value]) => (
          <div key={key} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {key}
              </label>
              <button
                onClick={() => eliminarCampoExtra(key)}
                className="text-gray-300 hover:text-red-400 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <textarea
              value={value}
              onChange={e => setCamposExtra(prev => ({ ...prev, [key]: e.target.value }))}
              rows={4}
              className="w-full text-sm text-gray-700 resize-none focus:outline-none placeholder-gray-300"
              placeholder={`Sin información`}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={nuevoNombre}
          onChange={e => setNuevoNombre(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregarCampo()}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Nombre del nuevo campo"
        />
        <button
          onClick={agregarCampo}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus size={14} />
          Agregar campo
        </button>
      </div>
    </div>
  )
}
