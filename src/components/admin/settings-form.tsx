'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { systemParamsSchema, type SystemParamsInput } from '@/lib/validations/admin'

interface CategoryRow {
  id: string
  name: string
  is_active: boolean
  operational_cost_pct: number
  suggested_margin_pct: number
  estimated_waste_pct: number
}

interface SystemParam {
  key: string
  value: string
}

interface SettingsFormProps {
  params: SystemParam[]
  categories: CategoryRow[]
}

const inputCls =
  'w-full border border-miski-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-miski-green/40 focus:border-miski-green transition-colors placeholder:text-miski-muted/60 text-miski-tinta'

const labelCls = 'block text-xs font-semibold text-miski-forest/70 uppercase tracking-wider mb-1.5'

function pct(decimal: number) {
  return Number((decimal * 100).toFixed(2))
}

export function SettingsForm({ params, categories }: SettingsFormProps) {
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const paramMap: Record<string, string> = {}
  for (const p of params) paramMap[p.key] = p.value

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SystemParamsInput>({
    resolver: zodResolver(systemParamsSchema),
    defaultValues: {
      cutoff_hour:        parseInt(paramMap['cutoff_hour'] ?? '12', 10),
      claim_window_hours: parseInt(paramMap['claim_window_hours'] ?? '2', 10),
      yape_number:        paramMap['yape_number'] ?? '',
      yape_name:          paramMap['yape_name'] ?? '',
      transfer_bank:      paramMap['transfer_bank'] ?? '',
      transfer_account:   paramMap['transfer_account'] ?? '',
      transfer_cci:       paramMap['transfer_cci'] ?? '',
      categories: categories.map(c => ({
        id:                   c.id,
        operational_cost_pct: pct(c.operational_cost_pct),
        suggested_margin_pct: pct(c.suggested_margin_pct),
        estimated_waste_pct:  pct(c.estimated_waste_pct),
      })),
    },
  })

  const { fields } = useFieldArray({ control, name: 'categories' })

  async function onSubmit(data: SystemParamsInput) {
    setServerError(null)
    setSaved(false)
    const res = await fetch('/api/admin/system-params', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      setServerError(typeof err.error === 'string' ? err.error : 'Error al guardar')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-3xl">
      {serverError && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{serverError}</div>
      )}
      {saved && (
        <div className="bg-miski-lime/20 text-miski-forest text-sm px-4 py-3 rounded-lg">
          Parámetros guardados correctamente.
        </div>
      )}

      {/* Global params */}
      <section className="bg-white border border-miski-border rounded-xl p-6 space-y-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-miski-forest">Ciclos de despacho</h2>
          <p className="text-sm text-miski-muted mt-0.5">
            Afecta la hora de cierre de pedidos y el cálculo de fechas de entrega.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>
              Hora de corte (0–23, hora Lima)
            </label>
            <input
              type="number"
              min={0}
              max={23}
              step={1}
              {...register('cutoff_hour', { valueAsNumber: true })}
              className={inputCls}
              placeholder="12"
            />
            {errors.cutoff_hour && (
              <p className="text-red-500 text-xs mt-1">{errors.cutoff_hour.message}</p>
            )}
            <p className="text-xs text-miski-muted/70 mt-1">
              Valor actual: {paramMap['cutoff_hour']}:00 — los pedidos del ciclo cierran a esta hora el día anterior al despacho.
            </p>
          </div>

          <div>
            <label className={labelCls}>
              Ventana de reclamo (horas)
            </label>
            <input
              type="number"
              min={1}
              max={72}
              step={1}
              {...register('claim_window_hours', { valueAsNumber: true })}
              className={inputCls}
              placeholder="2"
            />
            {errors.claim_window_hours && (
              <p className="text-red-500 text-xs mt-1">{errors.claim_window_hours.message}</p>
            )}
            <p className="text-xs text-miski-muted/70 mt-1">
              Tiempo que tiene el cliente para reportar un problema tras recibir su pedido.
            </p>
          </div>
        </div>
      </section>

      {/* Payment accounts */}
      <section className="bg-white border border-miski-border rounded-xl p-6 space-y-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-miski-forest">Cuentas de pago</h2>
          <p className="text-sm text-miski-muted mt-0.5">
            Se muestran al cliente en el checkout y en la recarga de billetera.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Número de Yape</label>
              <input type="text" inputMode="numeric" maxLength={9} {...register('yape_number')} className={inputCls} placeholder="993623373" />
              {errors.yape_number && <p className="text-red-500 text-xs mt-1">{errors.yape_number.message}</p>}
            </div>
            <div>
              <label className={labelCls}>Titular del Yape</label>
              <input type="text" {...register('yape_name')} className={inputCls} placeholder="Isaías" />
              {errors.yape_name && <p className="text-red-500 text-xs mt-1">{errors.yape_name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className={labelCls}>Banco (transferencia)</label>
              <input type="text" {...register('transfer_bank')} className={inputCls} placeholder="BCP" />
              {errors.transfer_bank && <p className="text-red-500 text-xs mt-1">{errors.transfer_bank.message}</p>}
            </div>
            <div>
              <label className={labelCls}>Número de cuenta</label>
              <input type="text" inputMode="numeric" {...register('transfer_account')} className={inputCls} placeholder="55077484986095" />
              {errors.transfer_account && <p className="text-red-500 text-xs mt-1">{errors.transfer_account.message}</p>}
            </div>
            <div>
              <label className={labelCls}>CCI</label>
              <input type="text" inputMode="numeric" maxLength={20} {...register('transfer_cci')} className={inputCls} placeholder="00255017748498609521" />
              {errors.transfer_cci && <p className="text-red-500 text-xs mt-1">{errors.transfer_cci.message}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Category params */}
      <section className="bg-white border border-miski-border rounded-xl p-6 space-y-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-miski-forest">Parámetros por categoría</h2>
          <p className="text-sm text-miski-muted mt-0.5">
            Se usan para calcular el precio de venta sugerido. Los porcentajes van de 0 a 99.
          </p>
        </div>

        <div className="space-y-4">
          {/* Header */}
          <div className="grid grid-cols-[1fr_130px_130px_130px] gap-3 px-1">
            <span className="text-xs font-semibold text-miski-forest/60 uppercase tracking-wider">Categoría</span>
            <span className="text-xs font-semibold text-miski-forest/60 uppercase tracking-wider text-center">Costo operativo %</span>
            <span className="text-xs font-semibold text-miski-forest/60 uppercase tracking-wider text-center">Margen %</span>
            <span className="text-xs font-semibold text-miski-forest/60 uppercase tracking-wider text-center">Merma %</span>
          </div>

          {fields.map((field, index) => {
            const cat = categories[index]
            return (
              <div
                key={field.id}
                className={`grid grid-cols-[1fr_130px_130px_130px] gap-3 items-start px-1 py-2 rounded-lg ${
                  !cat?.is_active ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pt-1">
                  <span className="text-sm font-medium text-miski-forest truncate">{cat?.name}</span>
                  {!cat?.is_active && (
                    <span className="text-xs bg-miski-green-soft text-miski-forest/60 px-1.5 py-0.5 rounded shrink-0">
                      inactiva
                    </span>
                  )}
                </div>
                <div>
                  <input
                    type="number"
                    step={1}
                    min={0}
                    max={99}
                    {...register(`categories.${index}.operational_cost_pct`, { valueAsNumber: true })}
                    className={inputCls}
                  />
                  {errors.categories?.[index]?.operational_cost_pct && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.categories[index].operational_cost_pct?.message}
                    </p>
                  )}
                </div>
                <div>
                  <input
                    type="number"
                    step={1}
                    min={0}
                    max={99}
                    {...register(`categories.${index}.suggested_margin_pct`, { valueAsNumber: true })}
                    className={inputCls}
                  />
                  {errors.categories?.[index]?.suggested_margin_pct && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.categories[index].suggested_margin_pct?.message}
                    </p>
                  )}
                </div>
                <div>
                  <input
                    type="number"
                    step={1}
                    min={0}
                    max={99}
                    {...register(`categories.${index}.estimated_waste_pct`, { valueAsNumber: true })}
                    className={inputCls}
                  />
                  {errors.categories?.[index]?.estimated_waste_pct && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.categories[index].estimated_waste_pct?.message}
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          {fields.length === 0 && (
            <p className="text-sm text-miski-muted py-4 text-center">
              No hay categorías creadas.
            </p>
          )}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="bg-miski-forest text-white hover:bg-miski-green rounded-lg px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {!isDirty && !saved && (
          <span className="text-xs text-miski-muted">Sin cambios pendientes</span>
        )}
      </div>
    </form>
  )
}
