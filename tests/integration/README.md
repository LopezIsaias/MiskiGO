# Tests de integración (Supabase real)

Estos tests corren contra una base **Supabase local** (Docker) y validan lo que los
unit tests no pueden: triggers, RLS, RPC de numeración y constraints. Sirven como
verificación previa antes de pasar a producción.

> Nunca apuntan a producción. El helper bloquea cualquier URL no-local salvo que
> exportes `ALLOW_NONLOCAL_TESTS=1` a propósito.

## Requisitos

- Docker Desktop corriendo
- Supabase CLI (ya incluido como dependencia dev)

## Pasos

```bash
# 1. Levantar Supabase local (aplica todas las migraciones + seed)
npm run db:start

# 2. Generar credenciales locales en .env.test.local
npm run db:env

# 3. Correr los tests de integración
npm run test:integration

# (opcional) limpiar datos de prueba acumulados
npm run db:reset

# 4. Apagar al terminar
npm run db:stop
```

## Qué se valida

| Archivo | Cubre |
|---------|-------|
| `triggers.test.ts` | `lock_order_on_payment` (bloqueo al aprobar pago), `set_claim_window` (ventana 2h), inmutabilidad de `audit_log` y `receipts`, protección de saldo congelado en `wallet_transactions` (migración 028) |
| `receipts-rpc.test.ts` | `next_receipt_correlative` secuencial, contadores por serie, atomicidad bajo concurrencia, unicidad de `number` y relación 1:1 `order_id` |
| `rls.test.ts` | aislamiento por usuario: un cliente solo ve/edita sus pedidos y comprobantes; trigger `handle_new_auth_user` crea el perfil |

## Notas

- Los tests se **autosaltan** si no existe `.env.test.local` (sin credenciales →
  `INTEGRATION_ENABLED = false`). Así `npm test` y CI no se rompen.
- `audit_log`, `wallet_transactions` y `receipts` son inmutables: las filas de
  prueba no se borran. Usa `npm run db:reset` para limpiar la BD local.
- Config dedicada: `vitest.integration.config.ts` (corre secuencial para evitar
  carreras sobre la BD compartida).
