'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  id: string
}

export function CancelPublicationButton({ id }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleCancel() {
    if (!confirm('¿Cancelar esta publicación? No se podrá deshacer.')) return
    setError(null)

    const res = await fetch(`/api/supplier/publications/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json()
      setError(typeof data.error === 'string' ? data.error : 'Error al cancelar')
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <>
      <button
        onClick={handleCancel}
        disabled={isPending}
        className="text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
      >
        {isPending ? '...' : 'Cancelar'}
      </button>
      {error && <span className="text-red-500 text-xs ml-2">{error}</span>}
    </>
  )
}
