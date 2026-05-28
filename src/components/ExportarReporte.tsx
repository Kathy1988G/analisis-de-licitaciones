'use client'

import { useState } from 'react'
import { FileDown, ChevronDown, FileText, FileType, Sheet } from 'lucide-react'
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

  // Construye la lista [campo, información] con los campos fijos + adicionales.
  function obtenerFilas(): [string, string][] {
    const filas: [string, string][] = Object.entries(CAMPOS_LABELS).map(([key, label]) => [
      label,
      ((analisis as unknown as Record<string, unknown>)[key] as string) || '—',
    ])
    const extra = analisis.campos_adicionales ?? {}
    Object.entries(extra).forEach(([key, value]) => {
      filas.push([key, (value as string) || '—'])
    })
    return filas
  }

  function fechaLegible() {
    return new Date(licitacion.created_at).toLocaleDateString('es-AR')
  }

  // Descarga un Blob como archivo, de forma compatible con todos los navegadores.
  function descargarBlob(blob: Blob, nombre: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function exportarExcel() {
    setOpen(false)
    const XLSX = await import('xlsx')
    const filas = obtenerFilas().map(([campo, info]) => ({ Campo: campo, Información: info }))
    const ws = XLSX.utils.json_to_sheet(filas)
    ws['!cols'] = [{ wch: 30 }, { wch: 80 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Análisis')
    XLSX.writeFile(wb, `${licitacion.nombre} - Análisis.xlsx`)
  }

  async function exportarPDF() {
    setOpen(false)
    const { jsPDF } = await import('jspdf')
    await import('jspdf-autotable')
    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Indufrial — Análisis de Licitación', 14, 20)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Licitación: ${licitacion.nombre}`, 14, 30)
    doc.text(`Entidad: ${licitacion.entidad}`, 14, 37)
    doc.text(`Fecha: ${fechaLegible()}`, 14, 44)

    ;(doc as unknown as { autoTable: (o: unknown) => void }).autoTable({
      head: [['Campo', 'Información']],
      body: obtenerFilas(),
      startY: 52,
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 130 } },
      headStyles: { fillColor: [37, 99, 235] },
    })

    doc.save(`${licitacion.nombre} - Análisis.pdf`)
  }

  async function exportarWord() {
    setOpen(false)
    const {
      Document, Packer, Paragraph, TextRun, HeadingLevel,
      Table, TableRow, TableCell, WidthType, AlignmentType,
    } = await import('docx')

    // Convierte un texto (posiblemente con saltos de línea) en párrafos.
    const aParrafos = (texto: string, bold = false) =>
      texto.split('\n').map(linea =>
        new Paragraph({ children: [new TextRun({ text: linea, bold })] })
      )

    const filas = obtenerFilas()

    const tabla = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              shading: { fill: '2563EB' },
              children: [new Paragraph({ children: [new TextRun({ text: 'Campo', bold: true, color: 'FFFFFF' })] })],
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              shading: { fill: '2563EB' },
              children: [new Paragraph({ children: [new TextRun({ text: 'Información', bold: true, color: 'FFFFFF' })] })],
            }),
          ],
        }),
        ...filas.map(([campo, info]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                children: aParrafos(campo, true),
              }),
              new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                children: aParrafos(info),
              }),
            ],
          })
        ),
      ],
    })

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: 'Indufrial — Análisis de Licitación' })],
          }),
          new Paragraph({ children: [new TextRun({ text: `Licitación: ${licitacion.nombre}`, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: `Entidad: ${licitacion.entidad}` })] }),
          new Paragraph({ children: [new TextRun({ text: `Fecha: ${fechaLegible()}` })] }),
          new Paragraph({ children: [] }),
          tabla,
        ],
      }],
    })

    const blob = await Packer.toBlob(doc)
    descargarBlob(blob, `${licitacion.nombre} - Análisis.docx`)
  }

  const opciones = [
    { label: 'Exportar PDF', icon: FileText, onClick: exportarPDF },
    { label: 'Exportar Word', icon: FileType, onClick: exportarWord },
    { label: 'Exportar Excel', icon: Sheet, onClick: exportarExcel },
  ]

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
          <div className="absolute right-0 top-10 bg-white rounded-xl border border-gray-100 shadow-lg z-20 py-1 w-44">
            {opciones.map(({ label, icon: Icon, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Icon size={15} className="text-gray-400" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
