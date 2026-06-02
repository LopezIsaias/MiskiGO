'use client'

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden bg-miski-forest text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-miski-green transition-all active:scale-[0.98]"
    >
      Imprimir / Guardar PDF
    </button>
  )
}
