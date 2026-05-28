'use client'

import { useState } from 'react'
import { FileDown, ChevronDown } from 'lucide-react'
import type { Licitacion, Analisis } from '@/types'

interface Props {
  licitacion: Licitacion
  analisis: Analisis
}

const CAMPOS_LABELS: Record<string, string> = {
  tiempos_entrega: 'Tiempos de entrega',
  garantia: 'Garantía',
  alcance_servicio: 'Alcance del servicio',
  especificaciones_tecnicas: 'Especificaciones técnicas',
  logistica: 'Logística y flete',
  condicion_pago: 'Condición de pago',
}

export default function ExportarReporte({ licitacion, analisis }: Props) {
  const [open, setOpen] = useState(false)

  function exportarExcel() {
    import('xlsx').then(XLSX => {
      const filas = Object.entries(CAMPOS_LABELS).map(([key, label]) => ({
        Campo: label,
        Información: (analisis as any)[key] ?? '',
      }))

      const extra = analisis.campos_adicionales ?? {}
      Object.entries(extra).forEach(([key, value]) => {
        filas.push({ Campo: key, Información: value as string })
      })

      const ws = XLSX.utils.json_to_sheet(filas)
      ws['!cols'] = [{ wch: 30 }, { wch: 80 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Análisis')
      XLSX.writeFile(wb, `${licitacion.nombre} - Análisis.xlsx`)
    })
    setOpen(false)
  }

  function exportarPDF() {
    import('jspdf').then(({ jsPDF }) => {
      import('jspdf-autotable').then(() => {
        const doc = new jsPDF()

        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text('Indufrial — Análisis de Licitación', 14, 20)

        doc.setFontSize(11)
        doc.setFont('helvetica', 'normal')
        doc.text(`Licitación: ${licitacion.nombre}`, 14, 30)
        doc.text(`Entidad: ${licitacion.entidad}`, 14, 37)
        doc.text(`Fecha: ${new Date(licitacion.created_at).toLocaleDateString('es-AR')}`, 14, 44)

        const filas = Object.entries(CAMPOS_LABELS).map(([key, label]) => [
          label,
          (analisis as any)[key] ?? '—',
        ])

        const extra = analisis.campos_adicionales ?? {}
        Object.entries(extra).forEach(([key, value]) => {
          filas.push([key, value as string])
        })

        ;(doc as any).autoTable({
          head: [['Campo', 'Información']],
          body: filas,
          startY: 52,
          styles: { fontSize: 9, cellPadding: 4 },
          columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 130 } },
          headStyles: { fillColor: [37, 99, 235] },
        })

        doc.save(`${licitacion.nombre} - Análisis.pdf`)
      })
    })
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 border border-gray-200 text-gray-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <FileDown size={15} />
        Exportar
        <ChevronDown size={13} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 bg-white rounded-xl border border-gray-100 shadow-lg z-20 py-1 w-36">
            <button
              onClick={exportarPDF}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Exportar PDF
            </button>
            <button
              onClick={exportarExcel}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Exportar Excel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
