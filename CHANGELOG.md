# CHANGELOG — Miski GO

## [2026-06-22] — Fase 2 demanda-primero: captura de oferta on-behalf + auto-asignación confirmada

### Contexto
El proveedor está offline (no usa la app). El operador captura su oferta real (por teléfono/campo) EN SU NOMBRE como `supplier_publications`, y luego asigna los pedidos del ciclo a esa oferta. Como el proveedor no confirma, las asignaciones se crean CONFIRMED directamente. Cierra el hueco de Fase 1 (order_items quedaban `pending`).

### Añadido
- `src/lib/utils/supplier-assignment.ts` → `autoSourceOrderConfirmed(admin, orderId)`: asigna los order_items `pending` a publicaciones disponibles (cheapest-first §4 + guard de margen), CONFIRMED, descuento atómico; resuelve cobertura con `resolveOrderItemCoverage` (TODO-O-NADA). Ítem sin NINGUNA publicación → queda `pending` (no se fuerza a `failed`).
- `src/app/api/operator/publications/route.ts` — POST: captura una publicación EN NOMBRE de un proveedor, atada al ciclo (expires_at = cutoff). Auditado (`supplier_publication_captured`).
- `src/app/api/operator/cycle/[id]/assign/route.ts` — POST: corre `autoSourceOrderConfirmed` sobre todos los pedidos `confirmed` del ciclo. Auditado.
- `src/app/(operator)/operator/sourcing/page.tsx` + `src/components/operator/sourcing-panel.tsx` — UI operador: registrar oferta de proveedor + botón "Asignar pedidos del ciclo".
- `tests/integration/auto-source.test.ts` — 4 pruebas: oferta suficiente→assigned; sin oferta→pending; oferta insuficiente→TODO-O-NADA fail + stock restaurado; guard de margen descarta pub cara.
- Constante audit `SUPPLIER_PUBLICATION_CAPTURED`; link de nav "Captura de oferta".

### Notas
- Sin migración (usa `supplier_publications` y `order_item_assignments` existentes).
- Validado en local: **unit 72/72, integración 43/43**; tsc + lint limpios.

## [2026-06-22] — Fase 1 demanda-primero: catálogo desacoplado de la publicación del proveedor

### Contexto
El catálogo dependía de que el agricultor publicara su stock (brecha digital → catálogo vacío → cero ventas). Demanda-primero: el operador siembra qué se ofrece por ciclo (cantidad esperada + precio de venta) y el catálogo/checkout leen de ahí. `supplier_publications` pasa a ser fuente de SOURCING (Fase 2), no de catálogo. Decisión de negocio del usuario; se mantiene corte/ciclos.

### Añadido
- `supabase/migrations/20260622000037_cycle_offerings.sql` — tabla `cycle_offerings` (dispatch_cycle_id, product_id, expected_quantity, sale_price, status) + RLS (staff; operator acotado a su región vía el ciclo). UNIQUE(cycle, product).
- `supabase/migrations/20260622000038_catalog_from_offerings.sql` — `catalog_availability` ahora lee de `cycle_offerings` del ciclo ABIERTO (DISTINCT ON producto+región, precio = sale_price del operador). DROP+CREATE por cambio de tipos.
- `src/app/api/operator/cycle/route.ts` — POST: abre un ciclo (status open) para región+fecha (cutoff = día previo 12:00 Lima); idempotente; auditado.
- `src/app/api/operator/offerings/route.ts` — GET/POST(upsert)/DELETE(soft) de ofertas; operator acotado a su región; upsert de precio auditado (§8 modificación de precio).
- `src/app/(operator)/operator/offerings/page.tsx` + `src/components/operator/offerings-manager.tsx` — UI operador: abrir ciclo + sembrar cantidad/precio por producto.
- Constantes audit `DISPATCH_CYCLE_CREATED`, `CYCLE_OFFERING_UPSERTED`; link de nav "Ofertas del ciclo".

### Modificado
- `src/app/(customer)/customer/catalog/page.tsx` — lee `catalog_availability` (ahora desde ofertas) filtrando por la región del cliente.
- `src/app/api/customer/orders/route.ts` (checkout) — precio congelado = `offering.sale_price`; stock validado vs `expected_quantity`; usa el ciclo ABIERTO existente (ya no lo crea lazy); **se quitó la asignación inline de proveedores + descuento de publicaciones** (pasa a Fase 2; order_items quedan `pending`).
- `src/app/api/customer/cart/reserve/route.ts` — disponibilidad desde `expected_quantity` de la oferta del ciclo abierto, no desde suma de publicaciones.
- `src/lib/utils/supplier-assignment.ts` — `runSupplierAssignment`: si un ítem no tiene NINGUNA oferta de proveedor (cero publicaciones), queda `pending` en vez de `failed` (correcto en demanda-primero; protege el approve-path hasta Fase 2).
- `tests/integration/rls-roles.test.ts` — el test de catálogo del customer ahora verifica que NO puede leer `supplier_publications` directo (fix Fase 0), en vez de lo contrario.

### Notas
- Validado en local: vista muestra la oferta del ciclo abierto y queda vacía al cerrarlo; tsc + lint limpios; **unit 72/72, integración 39/39**.
- **Migraciones 037 + 038 NO empujadas a producción todavía** — al hacerlo, el catálogo queda vacío hasta que el operador abra un ciclo y siembre ofertas. Coordinar el push con el sembrado.

## [2026-06-22] — Fase 0 endurecimiento de seguridad (escalada de privilegios + fuga de datos de proveedor)

### Corregido
- **🔴 CRÍTICO escalada de privilegios/saldo en `users`:** RLS `users_update` permitía a customer/supplier hacer UPDATE de su propia fila y el GRANT (mig 017) cubre TODAS las columnas, sin guard de columnas. Un usuario podía auto-asignarse `wallet_balance`, `role` (→ superadmin), `reputation_score`, `status`, `region_id` vía PostgREST directo. Viola CLAUDE.md §3/§8. Cerrado con trigger BD.
- **🟠 ALTO fuga de datos de proveedor al cliente:** la policy `supplier_pub_select_customer` (mig 019) daba al customer SELECT de la fila completa de `supplier_publications` (`supplier_id` + `minimum_price`) → identidad del proveedor y margen de la plataforma deducibles vía REST. La "agregación solo en UI" no era seguridad. Reemplazada por vista sin columnas sensibles + drop de la policy.

### Añadido
- `supabase/migrations/20260622000036_security_hardening.sql`:
  - Trigger `users_protect_privileged` (`protect_user_privileged_fields`) — rechaza cambios de `role`/`wallet_balance`/`reputation_score`/`status`/`region_id` salvo `service_role`/`postgres`/`supabase_admin`. El panel admin/operador ya escribe vía `adminClient` (service_role), no se rompe.
  - Vista `catalog_availability` — expone solo producto, stock agregado y precio de venta YA calculado (§4: `ceil(max_min/(1-op%-margen%)·100)/100`); sin `supplier_id` ni `minimum_price`. `security_invoker=false` (salta RLS por diseño). `REVOKE ALL` + `GRANT SELECT` solo a `authenticated` (sin `anon`).
  - Drop de policy `supplier_pub_select_customer`.

### Modificado
- `src/app/(customer)/customer/catalog/page.tsx` — lee de `catalog_availability` en vez de `supplier_publications`; agregación y cálculo de precio ahora en BD.
- `src/app/api/customer/orders/route.ts` — el checkout lee `supplier_publications` (stock/precio mínimo) con `adminClient` (server-only), no con la sesión del customer; `minimum_price` nunca sale al navegador. `adminClient` se crea una vez al inicio.
- `src/types/database.types.ts` — tipada la vista `catalog_availability`.

### Notas
- Validado en local (`db reset` 001→036): trigger bloquea customer (wallet/role) y permite `service_role` + edición de `full_name`; precio 6/0.6=10.00 y fragile 3.5/0.48=7.30; vista sin columnas sensibles; grants least-privilege. tsc + lint limpios.
- **Migraciones `035` + `036` aplicadas a PRODUCCIÓN** vía `db push`.

## [2026-06-15] — Integridad de cobertura: stock huérfano + cobertura parcial TODO-O-NADA + interleaving (3 bugs MED)

### Corregido
- **MED stock huérfano (#2):** al rechazar un proveedor su asignación (`fail` en `supplier/assignments/[id]`), el stock que su publicación había cedido en checkout NO se restauraba (a diferencia de `operator/orders/[id]/reject`) → stock huérfano nunca liberado. Ahora `fail` restaura el stock de la publicación rechazada vía RPC atómica tras marcar `failed`.
- **MED cobertura parcial / interleaving (#1, #3):** un `order_item` con varias asignaciones colapsaba a `assigned`/`failed` de forma incoherente — el confirm-handler marcaba `assigned` con "alguno confirmado" (ignorando la cantidad), y el fail-handler marcaba el ítem `failed` dejando splits `confirmed` activos y su stock sin restaurar. Decisión de negocio (usuario): **TODO-O-NADA** — sin estado nuevo. El ítem solo pasa a `assigned` cuando la suma de `assigned_quantity` de asignaciones `confirmed` cubre `order_items.quantity`; si hay gap no cubrible, el ítem entero falla restaurando el stock y marcando `failed` TODAS sus asignaciones activas (`pending`+`confirmed`). Esto elimina los estados inconsistentes del interleaving confirm/fail.

### Añadido
- `src/lib/utils/supplier-assignment.ts`:
  - `failOrderItemAllOrNothing(admin, orderItemId, reason)` — restaura stock + marca `failed` todas las asignaciones activas del ítem + ítem a `failed`.
  - `tryAdvanceOrderToAssigned(admin, orderId)` — re-evalúa avance del pedido a `assigned` (todos los ítems resueltos y ≥1 `assigned`). Extrae lógica duplicada en confirm/fail.
  - `resolveOrderItemCoverage(admin, orderItemId, reason)` — resuelve el ítem por cobertura de cantidad (TODO-O-NADA): `pending` si quedan asignaciones por confirmar, `assigned` si lo confirmado cubre `quantity`, `failed` en otro caso. Extraído del confirm-handler para hacerlo testeable.
- `tests/integration/order-item-allornothing.test.ts` — 8 pruebas en vivo: `failOrderItemAllOrNothing` (rollback confirmed+pending, reactivación de publicación `fulfilled` sin doble suma), `tryAdvanceOrderToAssigned` (avance, no-avance con pending, no-avance con todos failed), `resolveOrderItemCoverage` (pending / assigned / failed con rollback de stock).

### Modificado
- `src/app/api/supplier/assignments/[id]/route.ts` — confirm-handler usa cobertura por CANTIDAD (no "alguno confirmado"); fail-handler usa `failOrderItemAllOrNothing` en lugar de marcar solo el ítem; ambos usan `tryAdvanceOrderToAssigned`. Añadido `publication_id` al select/type de la asignación.

### Corregido (bug latente destapado por el test de integración)
- **`order_items.status` no permitía `'failed'`** (CHECK de migración 006: solo `pending/assigned/delivered/rejected`), pero `runSupplierAssignment`, el fail-handler y `failOrderItemAllOrNothing` marcan el ítem como `'failed'`. PostgREST rechazaba el UPDATE por el CHECK y el error se tragaba → el ítem quedaba `'pending'` y el pedido nunca avanzaba a `'assigned'` (atascado en `'confirmed'`). La lógica de avance (`assigned||failed||rejected`) ya esperaba `'failed'`; faltaba en el esquema.
- `supabase/migrations/20260615000035_order_item_failed_status.sql` — añade `'failed'` al CHECK de `order_items.status`.

### Notas
- Lint + `tsc` limpios. Unit 72/72. **Integración 35/35 en vivo** (Supabase local) incluido el test nuevo.
- **Migración 035 aplicada SOLO en LOCAL — falta `npx supabase db push` a producción** (acción manual, toca BD prod).

## [2026-06-13] — Anti-sobreventa: descuento/restauración de stock atómico (RPC con FOR UPDATE) — §7

### Corregido
- **Bug HIGH "oversell":** el descuento de `supplier_publications.available_quantity` era read-modify-write desde la app (SELECT y UPDATE en llamadas separadas, sin lock). Dos checkouts concurrentes leían el mismo stock y ambos descontaban → sobreventa. Viola CLAUDE.md §7 (transacciones). Ahora todo descuento/restauración pasa por funciones Postgres atómicas con `SELECT ... FOR UPDATE`, que serializan a los procesos concurrentes sobre la misma fila.

### Añadido
- `supabase/migrations/20260613000034_stock_decrement_rpc.sql` — funciones `decrement_publication_stock(uuid, numeric)` y `restore_publication_stock(uuid, numeric)` (`security definer`, ejecutables solo por `service_role`). Al agotarse, la publicación pasa a `fulfilled` dejando `available_quantity` intacto (respeta el `CHECK (available_quantity > 0)`); `restore` reactiva sin duplicar.
- `src/lib/utils/stock.ts` — wrappers `decrementPublicationStock()` / `restorePublicationStock()`.
- `tests/integration/stock-rpc.test.ts` — 5 pruebas en vivo, incluida concurrencia real (6 descuentos paralelos de 8 sobre stock 8 → total descontado exactamente 8; 10×1 sobre 4 → 4 ganadores) y round-trip de restauración.

### Modificado
- Descuento ahora atómico en: `customer/orders` (checkout), `lib/utils/supplier-assignment` (gap-fill de `runSupplierAssignment`), `supplier/assignments/[id]` (reasignación) y `operator/orders/[id]/items/[itemId]/assign` (asignación manual). Se usa la cantidad realmente descontada como `assigned_quantity`.
- Restauración ahora atómica en: `operator/orders/[id]/reject`, `operator/orders/[id]/cancel` y `cron/expire-overdue-orders` (reemplaza el read-modify-write con ramas por status).
- `src/types/database.types.ts` — tipadas las dos nuevas funciones RPC.

### Notas
- Migración 034 aplicada en LOCAL. **Falta `db push` a producción** (acción manual pendiente de confirmación — toca BD de prod).
- Pruebas en vivo: unit 72/72, integración 31/31. Lint + `tsc` limpios.

## [2026-06-13] — Reasignación por rechazo: filtro de corte, desempate por reputación y guard de margen (§4)

### Corregido
- `src/app/api/supplier/assignments/[id]/route.ts` — la búsqueda de proveedor de reemplazo cuando uno rechaza ahora cumple CLAUDE.md §4:
  - **Filtro de corte (B):** solo elige publicaciones con `published_at ≤ cutoff` del ciclo del pedido (antes podía tomar publicaciones posteriores al corte).
  - **Desempate por reputación (B):** ante igual `minimum_price` y `published_at`, prioriza mayor `reputation_score` (reusa `comparePublicationsForAssignment`; antes solo ordenaba precio+fecha).
  - **Guard de margen (C):** descarta candidatos cuyo `minimum_price` supere el `unit_price_frozen` del cliente (evita `platform_margin_frozen` negativo). El faltante se deja sin cubrir → ítem a `failed` → panel de asignación manual del operador. Se registra `skipped_over_price` en el `audit_log`.

### Añadido
- `src/lib/utils/supplier-assignment.ts` — helpers puros/testeable: `planReplacements()` (orden §4 + guard de margen, greedy, sin tocar BD), `fetchReplacementCandidates()` (consulta con filtro de corte y exclusión del proveedor que rechazó) y tipos `ReplacementCandidate`/`ReplacementPick`/`ReplacementPlan`.
- `tests/supplier-reassignment.test.ts` — 7 pruebas unitarias de `planReplacements` (orden, FIFO, reputación, guard de margen, greedy, límite inclusivo).
- `tests/integration/supplier-reassignment.test.ts` — 4 pruebas de integración contra Supabase local: exclusión por corte/proveedor, desempate por reputación con datos reales, descarte por sobreprecio, e invariante del FIX de recepción (refund `pending` no altera el saldo).
- `tests/integration/helpers.ts` — helper `createPublication()`.

### Modificado
- `src/app/api/supplier/assignments/[id]/route.ts` — el bloque de reemplazo (consulta + selección greedy) se reemplazó por llamadas a los helpers anteriores; la lógica de negocio queda testeable fuera del handler HTTP.

### Notas
- Pruebas en vivo contra Supabase local: unit 72/72, integración 26/26. Lint + `tsc` limpios.

## [2026-06-12] — Compensación en recepción: crédito propuesto, no auto-aprobado (§3/§4)

### Corregido
- `src/app/api/delivery/reception/route.ts` — el repartidor ya NO aprueba ni aplica créditos de billetera al cliente por productos rechazados. Antes insertaba `wallet_transactions` con `status:'approved'`, `approved_by = <repartidor>` y actualizaba `users.wallet_balance` directamente, violando CLAUDE.md §3 ("`delivery` NUNCA ve precios ni datos de pago") y §4 ("operador PROPONE créditos; superadmin APRUEBA"). Ahora el crédito de compensación se inserta como **propuesta** (`status:'pending'`, sin `approved_by`, sin tocar `wallet_balance`) y queda pendiente de aprobación del superadmin desde el endpoint existente `/api/admin/wallet/[id]` (que recalcula `balance_before/after` y aplica el saldo al aprobar).

### Modificado
- `src/app/api/delivery/reception/route.ts` — la acción de auditoría pasó de `WALLET_BALANCE_UPDATED` a `CREDIT_PROPOSED` (el saldo no cambia en este punto). Se acumulan los créditos propuestos y, al final de la recepción, se notifica una sola vez al superadmin (`notifications`, canal `in_app`) con el total pendiente de aprobación.

### Notas
- Hallazgo surgido de una batería de pruebas de trazado (datos ficticios) sobre el flujo de fallo de proveedor / reasignación. Bugs pendientes documentados en estado del proyecto (oversell por falta de transacción, reasignación sin filtro de corte ni desempate por reputación, margen negativo silencioso, cobertura parcial colapsada a `failed`, stock huérfano al rechazar).
- Lint 0 warnings.

## [2026-06-08] — Buscador de producto en publicación del proveedor

### Modificado
- `src/components/supplier/publication-form.tsx` — el `<select>` nativo de producto se reemplazó por un combobox buscable (`ProductSearchSelect`) que filtra el catálogo maestro por nombre y categoría mientras el proveedor escribe (normaliza acentos y mayúsculas). Cierra al hacer clic fuera, marca la selección actual y muestra "Sin resultados" cuando no hay match. Integrado con react-hook-form vía `Controller` (evita el warning de React Compiler por `watch()` y el riesgo de UI desactualizada). Solo aplica al crear; en edición el producto sigue bloqueado.

### Notas
- El catálogo del cliente (`src/components/customer/catalog-grid.tsx`) ya contaba con buscador + filtro por categoría; no requirió cambios.
- Lint 0 warnings, `tsc` limpio.

## [2026-06-08] — Rechazo de proveedor sin reemplazo: ítem a `failed` + auto-avance del pedido

### Corregido
- `src/app/api/supplier/assignments/[id]/route.ts` — cuando un proveedor rechaza su asignación y la búsqueda de reemplazo NO cubre el faltante (`remaining > 0`), el `order_item` ahora pasa a `failed`. Antes quedaba en `pending`: el operador no veía el panel de reasignación manual (solo aparece si `itemStatus === 'failed'`) y el pedido se congelaba indefinidamente en `confirmed` porque el check `orderReady` exige todos los ítems en `assigned/failed/rejected`.

### Modificado
- `src/app/api/supplier/assignments/[id]/route.ts` — tras marcar el ítem como `failed`, re-evalúa el avance del pedido con la misma regla del path de confirmación: si todos los ítems están resueltos (`assigned/failed/rejected`) y al menos uno está `assigned`, el pedido auto-avanza a `assigned` sin intervención del operador. Reduce la carga de revisión manual.

### Notas
- Escenario cubierto: cliente pide N ítems, proveedor solo cumple algunos. Los no cubiertos quedan `failed` (badge "⚠ Stock" + mensaje WhatsApp "Problema" se activan) y el pedido avanza con lo confirmado.
- Edge case pendiente: si se rechazan TODOS los ítems sin reemplazo, el pedido sigue en `confirmed` (no auto-avanza a `failed`). Mismo comportamiento que el path de confirmación; no se tocó por ser decisión de negocio que afecta ambos paths.
- Lint 0 warnings.

## [2026-06-08] — Foto de reclamo: fecha real de captura (EXIF) verificada en servidor

### Añadido
- `supabase/migrations/20260608000033_claim_photo_capture.sql` — columnas `claims.photo_taken_at` (timestamptz) y `claims.photo_verification` (`valid`/`too_old`/`future`/`unknown`)
- `src/lib/utils/exif-validation.ts` — lógica pura e isomórfica: valida la fecha de captura contra la ventana de entrega `[delivered_at − 30min, now + 10min]`. Constantes de tolerancia editables
- `src/lib/utils/exif-server.ts` — extrae el EXIF (DateTimeOriginal) del archivo ya subido, en el servidor. Fuente de verdad: no se confía en la metadata que envía el cliente

### Modificado
- `src/components/customer/claim-form.tsx` — el input ya NO fuerza la cámara (`capture` removido), permitiendo subir la foto original con su fecha real. Verificación preliminar en cliente; bloquea el envío si la foto es anterior a la entrega o tiene fecha futura; muestra "📷 Foto tomada el …" o aviso si no hay EXIF
- `src/app/api/customer/orders/[id]/claim/route.ts` — reextrae el EXIF en servidor y valida contra `orders.delivered_at`. Rechaza (422) fotos fuera de ventana (`too_old`/`future`); guarda `photo_taken_at`, `photo_verification` y la metadata cruda; notifica a operadores cuando la foto no tiene fecha verificable (`unknown`)
- `src/app/(customer)/customer/orders/[id]/claim/page.tsx` — pasa `delivered_at` al formulario
- `src/components/operator/claims-board.tsx` y `src/app/(operator)/operator/claims/page.tsx` — el operador ve la fecha real de captura de la foto, o el aviso "sin fecha de captura verificable"

### Notas
- Decisiones: fuera de ventana = rechazo duro; sin EXIF = se permite pero se marca y avisa al operador (algunos dispositivos legítimos no graban EXIF). La hora EXIF es local de la cámara (sin zona horaria) → tolerancias generosas.
- Migración `033` aplicada al remoto vía `db push`.
- Lint 0 warnings, `tsc` limpio.

## [2026-06-08] — Pedidos vencidos + estandarización de mensajes al cliente

### Añadido
- `src/app/api/cron/expire-overdue-orders/route.ts` — cron: marca como `failed` los pedidos aún `confirmed` cuyo ciclo ya pasó su `dispatch_date` (nunca asignados ni entregados). Libera stock reservado (mismas reglas que la cancelación del operador), registra en `audit_log` (`order_auto_failed`) y notifica al cliente. Autorizado con `Bearer CRON_SECRET`
- `vercel.json` — Vercel Cron diario `0 6 * * *` (01:00 Lima) para el endpoint anterior
- `ORDER_AUTO_FAILED: 'order_auto_failed'` en `AUDIT_ACTIONS` (`src/lib/constants/index.ts`)
- `CRON_SECRET` en `.env.example`

### Modificado
- `src/app/(customer)/customer/orders/page.tsx` — calcula `isOverdue` (confirmed + `dispatch_date` pasada) uniendo `dispatch_cycles`. Si está vencido: oculta el código de entrega y el botón de cancelación, y muestra aviso neutral ("Tu pedido está en proceso. Nos pondremos en contacto contigo a la brevedad."). Cubre la ventana antes de que corra el cron
- `src/app/api/customer/orders/[id]/cancel-request/route.ts` — rechaza la solicitud de cancelación si la `dispatch_date` del ciclo ya pasó (defensa server-side)
- `src/components/customer/cancel-order-button.tsx` — mensaje de cancelación post-pago reformulado: "...serán revisados y aprobados o denegados por un operador en un plazo máximo de 2 horas."
- `src/components/customer/checkout-form.tsx` — número de pedido de confirmación estandarizado a `Pedido #XXXXXXXX` (8 chars uppercase), consistente con el resto de la app

### Notas
- Lint 0 warnings, `tsc` limpio.
- Pendiente: setear `CRON_SECRET` en env de Vercel. El cron solo corre en prod.

## [2026-06-02] — Historial del repartidor

### Añadido
- `src/app/(delivery)/delivery/history/page.tsx` — vista de historial: lista los pedidos `delivered` de TODOS los ciclos del repartidor (no solo el `in_progress`), más recientes primero. Server component read-only. Resuelve los pedidos vía `delivery_routes` → `delivery_stops` (status `delivered`, `completed_at`) del repartidor. Muestra cliente, dirección, fecha de entrega, fecha de ciclo y productos. SIN precios ni montos (CLAUDE.md §3: el repartidor nunca ve precios)

### Modificado
- `src/components/delivery/delivery-nav.tsx` — nueva pestaña "Historial" (`/delivery/history`)

### Notas
- Lint 0 warnings.

## [2026-06-02] — Ruta del repartidor gobernada por recepción

### Modificado
- `src/app/(delivery)/delivery/route/page.tsx` — un pedido es entregable solo cuando todas sus asignaciones confirmadas (`supplier_id::product_id`) figuran en `reception_records` del ciclo. Separa recibidos (entregables) de pendientes de recepción; el mapa optimiza y marca pines solo de los recibidos (coords `delivery_lat/lng` o dirección como fallback). Helper `isReceptionComplete`
- `src/components/delivery/delivery-route-board.tsx` — `receptionComplete` por parada; acciones de entrega/incidencia solo para pedidos recibidos; aviso "Esperando recepción" en los pendientes

### Notas
- Flujo: marcar recepción en pestaña Recepción → esos pedidos pasan a entregables en Ruta con sus pines en el mapa.
- Optimización de orden de paradas (Directions API legacy) sigue deshabilitada; paradas en orden de creación. Mapa y pines OK.
- Lint 0 warnings, `tsc` limpio, 65 unit tests en verde.

## [2026-06-02] — Perfil repartidor: mapa por coordenadas + recibo de entrega

### Añadido
- `supabase/migrations/20260602000032_order_delivery_coords.sql` — `orders.delivery_lat`/`delivery_lng`
- Checkout: botón "Usar mi ubicación actual" (geolocalización del navegador) que guarda coordenadas exactas en el pedido (`checkout-form.tsx`)
- Ruta del repartidor: recibo de entrega tras confirmar el código (bottom-sheet con pedido, cliente, dirección, hora, ventana de reclamo y productos entregados) — `delivery-route-board.tsx`

### Modificado
- `src/app/(delivery)/delivery/route/page.tsx` — el mapa estático, la URL de Google Maps y la optimización de waypoints usan `lat,lng` cuando existen (pines exactos); fallback a dirección de texto. Helper `toMapPoint`
- `src/lib/validations/customer.ts` + `src/app/api/customer/orders/route.ts` — checkout acepta y persiste `delivery_lat`/`delivery_lng`
- `src/types/database.types.ts` — columnas de coordenadas en `orders`
- `CLAUDE.md` §5

### Notas
- Migración `032` aplicada vía `db push`. Mapa estático requiere "Maps Static API" habilitada en Google Cloud para la key.
- Lint 0 warnings, `tsc` limpio, 65 unit tests en verde.

## [2026-06-02] — Perfil cliente: módulo de historial de reclamos

### Añadido
- `src/app/(customer)/customer/claims/page.tsx` — módulo "Mis reclamos": estado, motivo, resolución (tipo/monto/fecha) y enlace "Ver comprobante de devolución" (`resolution_proof_url`)
- Entrada de navegación "Mis reclamos" en `src/components/customer/sidebar.tsx`

### Modificado
- `src/types/database.types.ts` — agregada `resolution_proof_url` a `claims` (columna ya existía en BD vía migración 027)

## [2026-06-02] — Mejoras perfil cliente: estado de pedido, drag-drop, cancelación y reserva de stock

### Añadido
- `src/components/customer/order-status-bar.tsx` — barra de progreso del pedido (pending_payment → completed); casos especiales para cancelled/failed/in_storage
- `src/components/customer/cancel-order-button.tsx` — el cliente solicita cancelación mientras el pedido esté `confirmed`
- `src/app/api/customer/orders/[id]/cancel-request/route.ts` — registra `cancellation_requested_at`/`cancellation_reason`, audita y notifica a operadores. No cancela por sí solo
- `src/app/api/operator/orders/[id]/cancel/route.ts` — operador/superadmin ejecuta la cancelación: libera stock reservado, pasa a `cancelled`, audita (`order_cancelled_post_payment`), notifica al cliente. Reembolso MANUAL (no mueve dinero)
- `src/app/api/customer/cart/reserve/route.ts` — reserva temporal de stock al agregar al carrito (TTL 30 min)
- `src/lib/utils/stock-reservations.ts` — `getReservedByOthers()` suma reservas activas/no vencidas por producto
- `supabase/migrations/20260602000030_order_cancellation_request.sql` — columnas de cancelación en `orders`
- `supabase/migrations/20260602000031_stock_reservations.sql` — tabla `stock_reservations` + RLS + índices
- Constante `RESERVATION_TTL_MINUTES` y acción de auditoría `ORDER_CANCELLATION_REQUESTED`

### Modificado
- `src/app/(customer)/customer/orders/page.tsx` — barra de estado por pedido; código de confirmación visible desde `confirmed` (antes solo `assigned`/`in_transit`); botón de cancelación
- `src/components/customer/checkout-form.tsx` — comprobante de pago por **arrastrar y soltar** (drag-drop) además del clic; validación de tipo/tamaño; `uploadProof(file)` reutilizable
- `src/app/(customer)/customer/catalog/page.tsx` + `catalog-grid.tsx` — la disponibilidad descuenta reservas de otros clientes; "Agregar" reserva en servidor antes de añadir al carrito
- `src/app/api/customer/orders/route.ts` — checkout valida contra reservas de otros y consume las propias al confirmar
- `src/app/(operator)/operator/orders/page.tsx` + `order-card.tsx` — badge y panel de "Cancelación solicitada" con acción de cancelar y liberar stock
- `src/types/database.types.ts` — tabla `stock_reservations` y columnas de cancelación en `orders`
- `CLAUDE.md` §4 (política de cancelación post-pago), §5 (esquema)

### Notas
- Migraciones `030`/`031` pendientes de aplicar: usar `npx supabase db push` (NO destructivo). `db:reset` borra datos.
- Lint 0 warnings, `tsc --noEmit` limpio, 65 unit tests en verde.

## [2026-06-02] — Precarga de monto de reembolso en claims

### Modificado
- `src/components/operator/claims-board.tsx` — al elegir `wallet_credit` o `external_refund`, el monto se precarga con `order.total_amount` (editable para reembolsos parciales); nueva función `selectResolutionType` y nota de UI bajo el input
- `src/app/(operator)/operator/claims/page.tsx` — la query y el tipo `RawClaim` incluyen `order.total_amount`

### Archivos afectados
- src/components/operator/claims-board.tsx
- src/app/(operator)/operator/claims/page.tsx

## [2026-06-02] — Fix harness de integración + cobertura RLS por rol

### Corregido
- `tests/integration/helpers.ts` `createCycle` — `dispatch_date` única por llamada (base de días aleatoria por proceso + contador); eliminaba la colisión `dispatch_cycles_region_id_dispatch_date_key` que rompía 6 tests
- `tests/integration/triggers.test.ts` y `receipts-rpc.test.ts` — dejaban de usar el superadmin sembrado hardcodeado (`00000000-...-0001`), que la migración 017 elimina (se recrea vía Admin API con id aleatorio); ahora crean un usuario real con `createTestUser` en `beforeAll` y lo limpian en `afterAll`

### Añadido
- `tests/integration/rls-roles.test.ts` — 7 casos de aislamiento RLS por rol (CLAUDE.md § 3): supplier no ve/edita publicaciones de otro supplier, no puede publicar a nombre ajeno (WITH CHECK), customer ve catálogo activo pero no inserta `wallet_transactions` (solo superadmin) y solo ve su propia billetera
- `tests/integration/helpers.ts` `createProduct` — crea categoría + producto (vía service role) para colgar publicaciones; pcts como fracción (0–1)

### Notas
- Suite de integración: 22 casos en verde (antes 15). Unit: 65. Lint: 0 warnings.
- Requiere Docker + `npm run db:start` + `npm run db:reset` + `npm run db:env`. Tras `db reset` no hay superadmin hasta correr `npm run seed:admin`.

## [2026-06-02] — Tests de integración contra Supabase local

### Añadido
- `vitest.integration.config.ts` — config dedicada (carga `.env.test.local`, corre secuencial, timeout 30s)
- `tests/integration/helpers.ts` — clientes service-role/anon, guarda anti-producción (`assertLocal`), creación de usuarios auth + perfil, fixtures (región/ciclo/pedido), `INTEGRATION_ENABLED` para autosaltar sin credenciales
- `tests/integration/triggers.test.ts` — `lock_order_on_payment`, `set_claim_window` (2h), inmutabilidad de `audit_log`/`receipts`, protección de saldo congelado en `wallet_transactions` (valida migración 028)
- `tests/integration/receipts-rpc.test.ts` — `next_receipt_correlative` secuencial/atómico bajo concurrencia, unicidad de `number` y 1:1 `order_id`
- `tests/integration/rls.test.ts` — aislamiento por usuario (un cliente solo ve/edita lo suyo), trigger `handle_new_auth_user`
- `tests/integration/README.md` — instrucciones de ejecución
- `scripts/gen-test-env.mjs` — genera `.env.test.local` desde `supabase status`
- Scripts npm: `test:integration`, `db:start`, `db:stop`, `db:reset`, `db:env`

### Modificado
- `vitest.config.ts` — unit tests limitados a `tests/*.test.ts` (integración separada)

### Notas
- Requiere Docker + `npm run db:start`. Sin `.env.test.local`, las suites se saltan (no rompen `npm test` ni CI). 15 casos de integración listos, pendientes de ejecutar contra una instancia local con Docker.

## [2026-06-02] — Suite de pruebas automatizadas (Vitest) por rol

### Añadido
- `vitest` (dev dependency) + `vitest.config.ts` (alias `@`, entorno node) + scripts `test` / `test:watch`
- `tests/pricing.test.ts` — `calculateSalePrice` (fórmula, proveedor más caro, denominador inválido), fechas de despacho, ventana de reclamo 2h, corte
- `tests/customer-checkout.test.ts` — `checkoutSchema`: boleta exige DNI 8 díg., factura exige RUC 11 díg., carrito vacío, métodos de pago
- `tests/auth-register.test.ts` — `registerSchema`/`registerApiSchema`/`loginSchema`: DNI/RUC, nombre sin números, contraseñas, teléfono
- `tests/supplier.test.ts` — `publicationSchema` + `comparePublicationsForAssignment` (precio ASC → FIFO → reputación DESC)
- `tests/operator-cycle.test.ts` — `nextCycleStatus` (open→closed→in_progress→completed, sin saltos)
- `tests/admin.test.ts` — `systemParamsSchema`, `categorySchema`, `createUserSchema`
- `tests/receipt.test.ts` — `seriesForReceiptType`, `formatReceiptNumber` (numeración SERIE-00000000)
- `tests/utils-format.test.ts` — `formatCurrency`, `toSlug`, `toWANumber`
- **65 tests, 8 archivos, todos en verde**

### Modificado (refactors puros para testabilidad, sin cambio de comportamiento)
- `src/lib/constants/index.ts` — `CYCLE_TRANSITIONS` + `nextCycleStatus()` centralizados
- `src/app/api/operator/cycle/[id]/status/route.ts` — usa `nextCycleStatus` en vez de mapa local
- `src/lib/utils/receipt.ts` — extraídos `seriesForReceiptType()` y `formatReceiptNumber()`
- `src/lib/utils/supplier-assignment.ts` — extraído `comparePublicationsForAssignment()`

## [2026-06-01] — Comprobantes de pago (boleta/factura)

### Añadido
- `supabase/migrations/20260601000029_receipts.sql` — columnas `receipt_type`/`receipt_document`/`receipt_name` en `orders`; tabla `receipts` (comprobante 1:1 por pedido, numeración por serie, inmutable vía triggers); tabla `receipt_counters` + función atómica `next_receipt_correlative(p_series)`; RLS: cliente ve los suyos, staff ve todos
- `src/lib/utils/receipt.ts` — `emitReceiptForOrder(orderId)`: emisión idempotente al completar entrega; serie B001 (boleta) / F001 (factura); número `SERIE-00000123`
- `src/app/(customer)/customer/orders/[id]/receipt/page.tsx` — comprobante imprimible (Server Component) con desglose de ítems y total
- `src/components/customer/print-button.tsx` — botón imprimir/PDF (`window.print()`)

### Modificado
- `src/lib/validations/customer.ts` — `checkoutSchema` exige `receipt_type` (boleta/factura), `receipt_document` (DNI 8 díg. / RUC 11 díg.) y `receipt_name`; validación con `superRefine`
- `src/components/customer/checkout-form.tsx` + `src/app/(customer)/customer/checkout/page.tsx` — selector boleta/factura en checkout con prefill desde perfil (DNI/RUC/nombre)
- `src/app/api/customer/orders/route.ts` — guarda datos de comprobante en el pedido
- `src/app/api/delivery/orders/[id]/deliver/route.ts` — emite el comprobante al confirmar entrega (no bloqueante)
- `src/app/(customer)/customer/orders/page.tsx` — muestra comprobante emitido + link "Ver comprobante"
- `src/types/database.types.ts` — tipos de `receipts`, `receipt_counters`, función RPC y columnas nuevas en `orders`

### Reglas de negocio aplicadas
- Cliente elige boleta (DNI) o factura (RUC + razón social) en checkout
- Comprobante se emite al completar la entrega (`delivered`), no antes
- MVP: recibo interno numerado sin desglose de IGV ni envío a SUNAT (Fase 2)
- Emisión idempotente: un pedido nunca genera dos comprobantes
- Pendiente: aplicar migración con `npx supabase db push`

## [2026-05-19] — Parámetros del sistema editables por superadmin (paso 20)

### Añadido
- `supabase/migrations/20260519000025_system_params.sql` — tabla `system_params` (key/value); filas iniciales para `cutoff_hour` (12) y `claim_window_hours` (2); RLS: SELECT para todos los autenticados, UPDATE solo para superadmin; GRANTs a PostgREST
- `src/app/api/admin/system-params/route.ts` — GET: devuelve parámetros globales + todas las categorías con sus porcentajes; PATCH: valida con Zod, actualiza `system_params` y `product_categories`, escribe en `audit_log` con valores anteriores y nuevos
- `src/components/admin/settings-form.tsx` — Client Component: dos secciones — "Ciclos de despacho" (hora de corte 0-23, ventana de reclamo 1-72 h) y "Parámetros por categoría" (tabla inline con costo operativo %, margen % y merma % por cada categoría); botón deshabilitado si no hay cambios; banner de éxito 3 s post-guardado
- `src/app/(admin)/admin/settings/page.tsx` — Server Component: verifica rol superadmin, carga datos desde BD, renderiza `SettingsForm`; nota explicativa sobre inmutabilidad de precios congelados

### Modificado
- `src/lib/constants/index.ts` — añadido `SYSTEM_PARAMS_UPDATED` a `AUDIT_ACTIONS`
- `src/lib/validations/admin.ts` — añadidos `categoryParamSchema`, `systemParamsSchema` y `SystemParamsInput`
- `src/types/database.types.ts` — añadida tabla `system_params` (Row/Insert/Update/Relationships) y alias `SystemParam`
- `src/components/admin/sidebar.tsx` — añadido link "Configuración" → `/admin/settings`

### Reglas de negocio aplicadas
- Cambiar parámetros de categoría no afecta pedidos existentes (los precios están congelados en `order_items.unit_price_frozen`)
- Toda modificación queda en `audit_log` con `previous_value` y `new_value`
- El botón "Guardar cambios" se deshabilita si el formulario no tiene cambios (React Hook Form `isDirty`)

### Archivos afectados
- `supabase/migrations/20260519000025_system_params.sql` (nuevo)
- `src/app/api/admin/system-params/route.ts` (nuevo)
- `src/components/admin/settings-form.tsx` (nuevo)
- `src/app/(admin)/admin/settings/page.tsx` (nuevo)
- `src/lib/constants/index.ts`
- `src/lib/validations/admin.ts`
- `src/types/database.types.ts`
- `src/components/admin/sidebar.tsx`

---


## [2026-05-19] — Log de auditoría para superadmin (paso 19)

### Añadido
- `src/components/admin/audit-filters.tsx` — Client Component: formulario con 5 filtros (desde / hasta / acción / módulo / nombre de usuario); al enviar actualiza la URL con `router.push` y resetea a `page=1`; botón "Limpiar" vuelve a `/admin/audit` sin params
- `src/components/admin/audit-table.tsx` — Client Component: tabla de solo lectura (sin botones de edición ni eliminación); columnas Fecha y hora (UTC-5), Usuario, Rol, Acción (fuente monospace), Módulo (badge con color por módulo); botón "Ver detalle" abre un modal con metadata (usuario, rol, módulo, entidad, IP, notas) y bloques JSON para `previous_value` (fondo gris) y `new_value` (fondo verde); modal se cierra haciendo clic fuera o en ×
- `src/app/(admin)/admin/audit/page.tsx` — Server Component: lee `searchParams` (Promise en Next.js 16); si hay filtro de usuario resuelve nombres a IDs con ILIKE; ejecuta query con `.count('exact')` y paginación de 50 registros; construye URL de paginación preservando todos los filtros activos; muestra hasta 7 botones de página centrados alrededor de la página actual; pasa datos tipados a `AuditFilters` y `AuditTable`
- `src/app/api/admin/audit/export/route.ts` — GET: acepta los mismos query params que la página; aplica los mismos filtros sin límite de paginación (máx 5000 filas); devuelve CSV con cabeceras `Content-Type: text/csv` y `Content-Disposition: attachment` para descarga directa; columnas: Fecha y hora, Usuario, Rol, Acción, Módulo, Tipo de entidad, ID de entidad, IP, Notas; valores escapados con comillas dobles

### Modificado
- `src/components/admin/sidebar.tsx` — añadido link "Auditoría" → `/admin/audit`

### Reglas de negocio aplicadas
- La vista es estrictamente de solo lectura; no se expone ningún endpoint de modificación sobre `audit_log`
- El filtro de usuario resuelve el nombre a IDs antes de filtrar (permite búsqueda parcial sin unión en la consulta principal)
- El export CSV reutiliza exactamente los mismos filtros que la vista paginada; el usuario descarga el resultado completo filtrado (sin paginación, límite 5000 para seguridad)
- Solo el `superadmin` puede acceder; la verificación ocurre tanto en la página como en la API de export

### Archivos afectados
- `src/components/admin/audit-filters.tsx` (nuevo)
- `src/components/admin/audit-table.tsx` (nuevo)
- `src/app/(admin)/admin/audit/page.tsx` (nuevo)
- `src/app/api/admin/audit/export/route.ts` (nuevo)
- `src/components/admin/sidebar.tsx`

---

## [2026-05-19] — Billetera virtual completa (paso 18)

### Añadido
- `supabase/migrations/20260519000024_storage_wallet_proofs.sql` — bucket `wallet-proofs` (10 MB, imágenes); política de upload por carpeta de usuario y lectura pública
- `src/app/api/customer/wallet/recharge/route.ts` — POST: crea recarga pendiente en `wallet_transactions` (`type='recharge'`, `status='pending'`); valida monto, método (yape/transfer) y URL del comprobante; balance_before/after se calculan con el saldo actual del cliente
- `src/app/api/operator/wallet/[id]/route.ts` — PATCH: operador aprueba o rechaza recargas (`type='recharge'`); al aprobar: actualiza `wallet_balance` en `users`, actualiza `balance_before/after` con valores reales al momento de la aprobación, escribe en `audit_log`; al rechazar: guarda motivo en `notes` y escribe en `audit_log`
- `src/app/api/admin/wallet/[id]/route.ts` — PATCH: superadmin aprueba o rechaza créditos de billetera (`type != 'recharge'`, e.g. refunds de reclamos del paso 17); misma lógica de actualización de balance y audit_log
- `src/components/customer/wallet-recharge-form.tsx` — Client Component: montos preestablecidos (S/20, 50, 100, 200) + campo libre; selector de método (Yape/Transferencia); upload de comprobante al bucket `wallet-proofs`; pantalla de éxito con texto "1 a 3 horas en horario laboral"
- `src/app/(customer)/customer/wallet/page.tsx` — Server Component: saldo disponible resaltado en verde, aviso de recargas pendientes no incluidas, formulario de recarga, historial de movimientos (tipo, monto +/-, estado con color, fecha, pedido de referencia, motivo de rechazo si aplica, estimado de revisión si pendiente)
- `src/components/operator/wallet-board.tsx` — Client Component: tarjeta por recarga con foto del comprobante (clickeable), cliente, método, monto y fecha; botones Aprobar / Rechazar con textarea de motivo para rechazos
- `src/app/(operator)/operator/wallet/page.tsx` — Server Component: lista de recargas pendientes filtradas por `type='recharge'` y `status='pending'`, ordenadas de más antiguo a más reciente
- `src/components/admin/wallet-credits-board.tsx` — Client Component: tarjeta por crédito pendiente con cliente, tipo, monto, notas (referencia al reclamo) y pedido asociado; botones Aprobar / Rechazar
- `src/app/(admin)/admin/wallet/page.tsx` — Server Component: lista de créditos pendientes (`type != 'recharge'`, `status='pending'`); solo accesible para superadmin

### Modificado
- `src/lib/constants/index.ts` — añadidos `WALLET_RECHARGE_APPROVED`, `WALLET_RECHARGE_REJECTED`, `WALLET_CREDIT_APPROVED`, `WALLET_CREDIT_REJECTED` a `AUDIT_ACTIONS`
- `src/components/customer/sidebar.tsx` — añadido link "Mi billetera" → `/customer/wallet`
- `src/components/operator/sidebar.tsx` — añadido link "Recargas" → `/operator/wallet`
- `src/components/admin/sidebar.tsx` — añadido link "Billetera" → `/admin/wallet`

### Reglas de negocio aplicadas
- El saldo que ve el cliente (`wallet_balance`) solo incluye transacciones aprobadas; las pendientes se muestran como aviso separado
- El operador aprueba recargas con comprobante (flujo cliente-iniciado, igual que aprobación de pagos); el superadmin aprueba créditos por reclamos (flujo operador-propuesto, conforme a CLAUDE.md)
- Al aprobar, `balance_before/after` se recalculan con el saldo real en ese momento (no el estimado al crear la recarga)
- Toda aprobación/rechazo genera registro en `audit_log`

### Archivos afectados
- `supabase/migrations/20260519000024_storage_wallet_proofs.sql` (nuevo)
- `src/app/api/customer/wallet/recharge/route.ts` (nuevo)
- `src/app/api/operator/wallet/[id]/route.ts` (nuevo)
- `src/app/api/admin/wallet/[id]/route.ts` (nuevo)
- `src/components/customer/wallet-recharge-form.tsx` (nuevo)
- `src/app/(customer)/customer/wallet/page.tsx` (nuevo)
- `src/components/operator/wallet-board.tsx` (nuevo)
- `src/app/(operator)/operator/wallet/page.tsx` (nuevo)
- `src/components/admin/wallet-credits-board.tsx` (nuevo)
- `src/app/(admin)/admin/wallet/page.tsx` (nuevo)
- `src/lib/constants/index.ts`
- `src/components/customer/sidebar.tsx`
- `src/components/operator/sidebar.tsx`
- `src/components/admin/sidebar.tsx`

---

## [2026-05-19] — Panel operador: gestión de reclamos (paso 17)

### Añadido
- `src/app/api/operator/claims/[id]/resolve/route.ts` — PATCH: resuelve un reclamo pendiente; valida rol operador/superadmin; actualiza `claims` con status/resolution_type/resolution_amount/is_justified/resolved_by/resolved_at; si `resolution_type = wallet_credit` inserta `wallet_transactions` con `status = pending` para aprobación del superadmin en paso 18; escribe en `audit_log`
- `src/app/(operator)/operator/claims/page.tsx` — Server Component: lista todos los reclamos (pendientes primero, luego resueltos); pasa datos tipados al `ClaimsBoard`
- `src/components/operator/claims-board.tsx` — Client Component con una `ClaimCard` por reclamo; muestra foto del reclamo (enlace a tamaño completo), cliente, pedido, producto, motivo; para pendientes: formulario inline de resolución con selector de decisión (aprobar / aprobar parcialmente / rechazar), tipo de resolución (radio), monto, checkbox de justificación; feedback visual post-resolución sin recarga completa

### Modificado
- `src/lib/constants/index.ts` — añadido `CLAIM_RESOLVED` a `AUDIT_ACTIONS`
- `src/components/operator/sidebar.tsx` — añadido link "Reclamos" → `/operator/claims`

### Reglas de negocio aplicadas
- Solo claims con `status = 'pending'` son resolvibles; el API devuelve 404 si ya fue resuelto
- `wallet_credit` crea una `wallet_transactions` con `status = 'pending'`; el balance del cliente **no** se modifica hasta que el superadmin la apruebe (paso 18)
- `is_justified = false` se fuerza si el veredicto es `rejected`
- Toda resolución queda en `audit_log` con los campos antes/después

### Archivos afectados
- `src/lib/constants/index.ts`
- `src/app/api/operator/claims/[id]/resolve/route.ts` (nuevo)
- `src/app/(operator)/operator/claims/page.tsx` (nuevo)
- `src/components/operator/claims-board.tsx` (nuevo)
- `src/components/operator/sidebar.tsx`

---

## [2026-05-19] — Reclamos del cliente con foto dentro de ventana de 2 horas (paso 16)

### Añadido
- `supabase/migrations/20260519000023_storage_claim_photos.sql` — bucket `claim-photos` (10 MB, imágenes); política de upload por carpeta de usuario y lectura pública
- `src/app/api/customer/orders/[id]/claim/route.ts` — POST: valida ventana de reclamo server-side (`claim_window_expires_at > now()`), inserta un registro en `claims` por cada producto reclamado con la misma `photo_url`; devuelve 410 si la ventana ya venció
- `src/app/(customer)/customer/orders/[id]/claim/page.tsx` — Server Component: verifica ownership del pedido, estado `delivered`, y ventana abierta; obtiene productos del pedido y reclamos existentes; pasa al `ClaimForm`; si la ventana ya venció muestra mensaje de "Plazo vencido"
- `src/components/customer/claim-form.tsx` — Client Component: banner con hora límite, upload de foto única al bucket `claim-photos`, lista de productos con checkbox (deshabilitado si ya reclamado), para cada producto seleccionado: cantidad y motivo obligatorios; botón con conteo de productos seleccionados; pantalla de éxito post-envío

### Reglas de negocio aplicadas
- La ventana de reclamo se revalida en el servidor en cada POST (no solo en el cliente)
- Un reclamo con `status in (pending, approved, partially_approved)` bloquea un nuevo reclamo del mismo producto en el mismo pedido
- La foto es obligatoria por la política de la tabla `claims` (`photo_url NOT NULL`)
- La misma foto cubre todos los productos reclamados en un mismo envío

### Archivos afectados
- `supabase/migrations/20260519000023_storage_claim_photos.sql` (nuevo)
- `src/app/api/customer/orders/[id]/claim/route.ts` (nuevo)
- `src/app/(customer)/customer/orders/[id]/claim/page.tsx` (nuevo)
- `src/components/customer/claim-form.tsx` (nuevo)

---

## [2026-05-19] — Notificación post-entrega y ventana de reclamo para el cliente (paso 15)

### Añadido
- `supabase/migrations/20260519000022_add_read_at_to_notifications.sql` — columna `read_at timestamptz` en `notifications` para rastrear cuándo el cliente lee cada notificación in_app
- `src/app/api/customer/notifications/route.ts` — GET: devuelve hasta 20 notificaciones `in_app` del cliente autenticado, ordenadas por fecha, con `unreadCount` (read_at IS NULL)
- `src/app/api/customer/notifications/read/route.ts` — PATCH: marca como leídas (read_at = now) todas las notificaciones in_app sin leer del cliente
- `src/app/(customer)/customer/orders/page.tsx` — lista de pedidos del cliente ordenada por fecha DESC; para cada pedido `delivered` muestra `DeliveryClaimBanner`
- `src/components/customer/delivery-claim-banner.tsx` — banner verde en pedidos entregados con el texto exacto del CLAUDE.md, botón "Reportar problema" (enlaza a `/customer/orders/[id]/claim`) visible solo mientras `claim_window_expires_at` sea futuro; `setTimeout` cierra la ventana automáticamente en el cliente; muestra "Plazo de reclamo vencido" al expirar
- `src/components/customer/notification-bell.tsx` — campanita en el header del panel cliente; badge rojo con conteo de no leídas; panel desplegable con lista; marca todo como leído al abrir; polling cada 30 s con cleanup en unmount

### Modificado
- `src/types/database.types.ts` — añadido campo `read_at: string | null` en Row/Insert/Update de `notifications`
- `src/components/customer/sidebar.tsx` — `<NotificationBell />` integrada en el header del sidebar junto al brand "Miski GO"
- `CLAUDE.md` — añadida funcionalidad futura "Mapa de entregas con chinchetas"; estado actualizado a pasos 1–15 completados

### Reglas de negocio aplicadas
- La notificación `in_app` al cliente se crea en el paso 14 (deliver API) con el texto exacto del CLAUDE.md; el paso 15 sólo añade la UI para mostrarla
- La ventana de reclamo se computa en el servidor (`claim_window_expires_at = delivered_at + 2h`); el cliente recibe el timestamp y gestiona el estado de "abierta/cerrada" localmente con `setTimeout`
- El botón "Reportar problema" enlaza a `/customer/orders/[id]/claim` (implementado en paso 16)
- El polling de notificaciones (30 s) incluye `active` flag para evitar setState después de unmount

### Archivos afectados
- `supabase/migrations/20260519000022_add_read_at_to_notifications.sql` (nuevo)
- `src/types/database.types.ts`
- `src/app/api/customer/notifications/route.ts` (nuevo)
- `src/app/api/customer/notifications/read/route.ts` (nuevo)
- `src/app/(customer)/customer/orders/page.tsx` (nuevo)
- `src/components/customer/delivery-claim-banner.tsx` (nuevo)
- `src/components/customer/notification-bell.tsx` (nuevo)
- `src/components/customer/sidebar.tsx`
- `CLAUDE.md`

---

## [2026-05-14] — Vista repartidor — ruta optimizada y marcar entregado (paso 14)

### Añadido
- `src/components/delivery/delivery-nav.tsx` — barra de tabs (Recepción | Ruta) que se muestra en ambas vistas del repartidor; `usePathname` para el tab activo
- `src/app/api/delivery/route/start/route.ts` — POST: crea `delivery_route` + `delivery_stops` para el ciclo activo; transiciona todos los pedidos `assigned → in_transit`; si ya existe una ruta para ese repartidor+ciclo, la devuelve sin duplicar
- `src/app/api/delivery/orders/[id]/deliver/route.ts` — PATCH: actualiza `orders.status = delivered`, registra `delivered_at` y calcula `claim_window_expires_at = delivered_at + 2 horas`, actualiza `delivery_stops`, inserta notificación `in_app` al cliente con el texto exacto del CLAUDE.md, escribe en `audit_log`
- `src/app/api/delivery/orders/[id]/incident/route.ts` — PATCH: marca `delivery_stops.status = failed` con `failure_reason`; el pedido permanece `in_transit` para que el operador gestione; notifica a operadores/superadmin vía `in_app`; escribe en `audit_log`
- `src/app/(delivery)/delivery/route/page.tsx` — Server Component: detecta ciclo `in_progress`, obtiene pedidos `assigned/in_transit/delivered` del ciclo, llama a **Google Maps Directions API server-side** con `optimizeWaypoints=true` para calcular el orden óptimo de paradas, construye URL de Static Maps con marcadores numerados, pasa todo a `DeliveryRouteBoard`
- `src/components/delivery/delivery-route-board.tsx` — Client Component: imagen del mapa estático con marcadores numerados, botón "Abrir en Google Maps" (deep-link que funciona en móvil), barra de estadísticas, botón "Iniciar ruta" (llama al endpoint start), lista de paradas expandibles con nombre del cliente + dirección + nota + productos a entregar; botones "Marcar entregado" y "Incidencia" por parada; modal bottom-sheet para el motivo de incidencia; actualizaciones optimistas del estado local; exporta tipos `StopData` y `StopItem`

### Modificado
- `src/lib/constants/index.ts` — añadidos `ORDER_DELIVERED` y `DELIVERY_INCIDENT` a `AUDIT_ACTIONS`
- `src/app/(delivery)/delivery/reception/page.tsx` — añadido `<DeliveryNav />` bajo el `<MobileHeader />` en todos los estados de la página (ciclo no encontrado, ciclo activo)

### Reglas de negocio aplicadas
- Optimización de ruta: llamada server-side a Directions API (`cache: 'no-store'`); si falla o la clave no está configurada, los pedidos se muestran en orden de creación sin romper la página
- `claim_window_expires_at = delivered_at + 2 horas` (calculado en el API route, no en el cliente)
- Texto de notificación al cliente: exactamente el definido en CLAUDE.md sección 4, con `[hora_límite]` sustituida por `formatTime(claimWindowExpiresAt)`
- El repartidor **nunca** ve precios ni datos financieros: `unit_price_frozen`, `subtotal_frozen` y datos de asignación de proveedor se excluyen de todas las consultas
- Incidencia: el pedido queda `in_transit` (no `failed`) para que el operador pueda reagendar o cancelar
- Un solo mapa (Static Maps API) cubre todas las paradas ordenadas; la URL de navegación usa el esquema `maps.google.com/maps/dir/` que abre la app nativa en Android e iOS
- TypeScript: 0 errores. ESLint: 0 warnings.

### Archivos afectados
- `src/lib/constants/index.ts`
- `src/components/delivery/delivery-nav.tsx` (nuevo)
- `src/app/api/delivery/route/start/route.ts` (nuevo)
- `src/app/api/delivery/orders/[id]/deliver/route.ts` (nuevo)
- `src/app/api/delivery/orders/[id]/incident/route.ts` (nuevo)
- `src/app/(delivery)/delivery/route/page.tsx` (nuevo)
- `src/components/delivery/delivery-route-board.tsx` (nuevo)
- `src/app/(delivery)/delivery/reception/page.tsx`

---


## [2026-05-13] — Vista repartidor — recepción en punto central (paso 13)

### Añadido
- `supabase/migrations/20260513000021_storage_reception_photos.sql` — bucket `reception-photos` (10 MB, JPEG/PNG/WEBP/HEIC/HEIF); políticas de upload por carpeta de usuario y lectura pública
- `src/app/(delivery)/layout.tsx` — layout mínimo para el panel del repartidor (sin sidebar; mobile-first)
- `src/app/(delivery)/delivery/page.tsx` — redirige a `/delivery/reception`
- `src/components/delivery/mobile-header.tsx` — encabezado sticky mobile con brand, título de página y botón de cerrar sesión
- `src/app/(delivery)/delivery/reception/page.tsx` — Server Component: detecta ciclo activo (`in_progress` o `closed`), consulta todas las asignaciones confirmadas del ciclo, las agrega por proveedor→producto, verifica registros de recepción ya existentes, pasa datos tipados al cliente
- `src/components/delivery/reception-board.tsx` — lista de proveedores con acordeón; dot indicador (verde=listo, ámbar=pendiente); auto-expande el primer pendiente; re-exporta tipos `ReceptionSupplierData`, `ReceptionItemData`
- `src/components/delivery/supplier-reception-form.tsx` — formulario por proveedor: upload de foto (con preview y confirmación "Guardada"), campos de cantidad recibida y rechazada por producto (inputs touch-friendly), motivo de rechazo condicional si rechazado > 0; validación client-side antes de enviar; llama a `router.refresh()` tras éxito
- `src/app/api/delivery/reception/route.ts` — POST: valida rol `delivery`/`superadmin`; verifica ciclo activo y ausencia de duplicados; por cada producto:
  1. Inserta `reception_records` con photo_url obligatoria
  2. Si hay shortfall (`expectedQty − (receivedQty − rejectedQty) > 0`): distribuye el faltante proporcionalmente entre las `order_item_assignments` afectadas, actualiza `assigned_quantity` (o marca `failed` si llega a 0), calcula compensación (`shortfall × unit_price_frozen`), inserta `wallet_transaction` tipo `refund` (status `approved`) e incrementa `wallet_balance` del cliente, marca `order_items.status = 'rejected'` si la cobertura total cae bajo la cantidad pedida
  3. Registra en `audit_log`: `RECEPTION_RECORDED` siempre, `BAD_PRODUCT_REPORTED` si hay rechazo, `WALLET_BALANCE_UPDATED` por cada cliente compensado

### Modificado
- `src/lib/constants/index.ts` — añadido `RECEPTION_RECORDED: 'reception_recorded'` a `AUDIT_ACTIONS`

### Reglas de negocio aplicadas
- `received_qty` = total que llegó físicamente (bueno + malo); `rejected_qty` = rechazado por calidad (subconjunto de received)
- Shortfall = `expected − (received − rejected)` → clientes no recibirán esa cantidad
- Distribución proporcional: `assignment_shortfall = (assignment.assigned_qty / total_assigned) × shortfall`
- El repartidor NUNCA ve precios ni datos financieros — toda la lógica de compensación ocurre en el API route con admin client
- Una foto cubre todos los productos del proveedor (mismo `photo_url` para todos los `reception_records` de ese proveedor en el envío)
- Registro ya existente para el mismo ciclo+proveedor+producto devuelve 409 (evita duplicados)
- TypeScript: 0 errores. ESLint: 0 warnings.

### Para aplicar
```
npx supabase db push
```

### Archivos afectados
- `supabase/migrations/20260513000021_storage_reception_photos.sql` (nuevo)
- `src/app/(delivery)/layout.tsx` (nuevo)
- `src/app/(delivery)/delivery/page.tsx` (nuevo)
- `src/components/delivery/mobile-header.tsx` (nuevo)
- `src/app/(delivery)/delivery/reception/page.tsx` (nuevo)
- `src/components/delivery/reception-board.tsx` (nuevo)
- `src/components/delivery/supplier-reception-form.tsx` (nuevo)
- `src/app/api/delivery/reception/route.ts` (nuevo)
- `src/lib/constants/index.ts`

---

## [2026-05-12] — Panel operador — gestión completa de pedidos (paso 12)

### Añadido
- `src/app/(operator)/operator/orders/page.tsx` — Server Component; obtiene ciclos activos (open/closed/in_progress), consulta todos los pedidos de esos ciclos con join completo (cliente, ciclo de despacho, items → producto, asignaciones → proveedor), transforma a tipos tipados y pasa a `OrdersBoard`
- `src/components/operator/orders-board.tsx` — agrupa pedidos por 6 estados (payment_submitted, confirmed, assigned, in_transit, delivered, failed) con badges de conteo y alerta "con problema" cuando algún pedido tiene items fallidos; re-exporta tipos `Order`, `OrderItem`, `SupplierAssignment`
- `src/components/operator/order-card.tsx` — tarjeta por pedido expandible; tabla de items con proveedor(es) confirmados; `ManualAssignPanel` para items con status `failed` (busca proveedores alternativos y asigna con un clic); sección de 3 mensajes WhatsApp prellenados (confirmación, despacho, problema) con botón copiar y enlace directo a `wa.me`; expandido por defecto para `payment_submitted` o pedidos con items fallidos
- `src/app/api/operator/orders/[id]/items/[itemId]/publications/route.ts` — GET: devuelve publicaciones activas del producto del ítem ordenadas por precio ASC + reputación DESC (tiebreaker en TypeScript)
- `src/app/api/operator/orders/[id]/items/[itemId]/assign/route.ts` — POST: asigna manualmente una publicación a un ítem; calcula `deduct = min(available_qty, remaining_qty)`, decrementa stock (o marca `fulfilled`), crea asignación `confirmed`, avanza `order_items.status → assigned` si el ítem queda cubierto, avanza `orders.status → assigned` si todos los ítems están asignados, registra en `audit_log` con `SUPPLIER_MANUALLY_ASSIGNED`

### Modificado
- `src/lib/utils/index.ts` — añadidas `timeAgo(iso)` (tiempo relativo en español: "hace X min/h/días") y `toWANumber(phone)` (normaliza teléfono peruano a formato `51XXXXXXXXX` para links wa.me)
- `src/lib/constants/index.ts` — añadido `SUPPLIER_MANUALLY_ASSIGNED: 'supplier_manually_assigned'` a `AUDIT_ACTIONS`
- `src/components/operator/sidebar.tsx` — añadido enlace "Gestión de pedidos" → `/operator/orders`

### Estado tras estos cambios
- `/operator/orders` → vista completa con todos los pedidos del ciclo activo agrupados por estado
- Items sin proveedor (status `failed`): alerta destacada + panel para asignación manual con un clic
- Mensajes WhatsApp prellenados con datos reales del pedido; botón copiar número de teléfono
- Mensaje destacado (borde verde) según el estado actual del pedido
- TypeScript: 0 errores. ESLint: 0 warnings.

### Archivos afectados
- `src/app/(operator)/operator/orders/page.tsx` (nuevo)
- `src/components/operator/orders-board.tsx` (nuevo)
- `src/components/operator/order-card.tsx` (nuevo)
- `src/app/api/operator/orders/[id]/items/[itemId]/publications/route.ts` (nuevo)
- `src/app/api/operator/orders/[id]/items/[itemId]/assign/route.ts` (nuevo)
- `src/lib/utils/index.ts`
- `src/lib/constants/index.ts`
- `src/components/operator/sidebar.tsx`

---

## [2026-05-12] — Fix: asignación de proveedores en pedidos de billetera pura

### Corregido
- Pedidos pagados 100% con billetera quedaban con `order_item_assignments` en status `pending` permanentemente porque el flujo de aprobación del operador nunca se ejecutaba para ellos

### Añadido
- `src/lib/utils/supplier-assignment.ts` — función `runSupplierAssignment` extraída del approve route: confirma asignaciones provisionales, rellena gaps greedy, actualiza statuses de items y orden, envía notificación in-app al operador (opcional), registra en audit_log. Parámetro `operatorId` opcional: si se omite, la notificación se suprime (caso checkout)

### Modificado
- `src/app/api/operator/orders/[id]/approve/route.ts` — simplificado; delega toda la lógica de asignación a `runSupplierAssignment`
- `src/app/api/customer/orders/route.ts` — cuando `orderStatus === 'confirmed'` (billetera pura), llama a `runSupplierAssignment` inmediatamente después de crear las asignaciones provisionales, con `userRole: 'customer'` y sin `operatorId`

### Comportamiento resultante
- Billetera pura: checkout → asignaciones provisionales → `runSupplierAssignment` → `assigned` (mismo ciclo, sin aprobación manual)
- Yape/transferencia: checkout → asignaciones provisionales → operador aprueba → `runSupplierAssignment` → `assigned`
- Ambos flujos usan exactamente la misma lógica sin duplicación
- TypeScript: 0 errores. ESLint: 0 warnings.

### Archivos afectados
- `src/lib/utils/supplier-assignment.ts` (nuevo)
- `src/app/api/operator/orders/[id]/approve/route.ts`
- `src/app/api/customer/orders/route.ts`

---

## [2026-05-12] — Asignación automática de proveedores (paso 11)

### Añadido
- `AUDIT_ACTIONS.SUPPLIER_ASSIGNED` y `AUDIT_ACTIONS.ASSIGNMENT_FAILED` en `src/lib/constants/index.ts`

### Modificado
- `src/app/api/operator/orders/[id]/approve/route.ts` — añadida lógica completa de asignación de proveedores que se ejecuta inmediatamente después de aprobar el pago:
  1. Lee todos los `order_items` del pedido con sus asignaciones provisionales (status `pending`, creadas en el checkout)
  2. Para cada item, comprueba si las asignaciones provisionales cubren la cantidad total
  3. Si hay gap (stock cambió entre checkout y aprobación), busca publicaciones activas del mismo producto en el mismo ciclo de despacho, ordenadas por `minimum_price ASC`, `published_at ASC` (FIFO), `reputation_score DESC` en empate; asignación greedy hasta cubrir el remanente
  4. Si el item queda completamente cubierto: confirma asignaciones provisionales (status `pending` → `confirmed`, agrega `confirmed_at`), inserta asignaciones suplementarias si las hubo, actualiza `order_items.status` → `assigned`
  5. Si el item no puede cubrirse: `order_items.status` → `failed`, asignaciones → `failed`
  6. Si todos los items se asignaron: `orders.status` → `assigned`
  7. Si algún item falló: crea notificación `in_app` al operador e inserta `audit_log` con `ASSIGNMENT_FAILED`
  8. Siempre inserta registro en `audit_log` (`SUPPLIER_ASSIGNED` o `ASSIGNMENT_FAILED`)

### Reglas de negocio aplicadas
- Las asignaciones provisionales del checkout sirven como reserva de stock; en el approval se confirman formalmente
- El relleno greedy respeta el orden: precio mínimo proveedor ASC → fecha de publicación ASC (FIFO) → reputation_score DESC en empate triple
- `fulfilled` se usa cuando `available_quantity` quedaría en 0 (no se viola la constraint `> 0`)
- La lógica de rechazo (`reject/route.ts`) permanece intacta: usa las asignaciones `pending` que existen hasta que el pago sea aprobado
- Para pedidos pagados completamente con billetera, el approve route devuelve 400 (correctamente no son `payment_submitted`)

### Estado tras estos cambios
- Aprobar pago → `confirmed` (lock) → asignación automática → `assigned` (si todo OK)
- Si falta stock: pedido queda `confirmed` con items `failed` y notificación al operador
- TypeScript: 0 errores. ESLint: 0 warnings.

### Archivos afectados
- `src/lib/constants/index.ts`
- `src/app/api/operator/orders/[id]/approve/route.ts`

---

## [2026-05-12] — Panel operador — aprobación de pagos (paso 10)

### Añadido
- `src/app/(operator)/layout.tsx` — layout con sidebar y área principal
- `src/components/operator/sidebar.tsx` — sidebar con navegación a `/operator/payments` y botón de cerrar sesión
- `src/app/(operator)/operator/page.tsx` — redirige a `/operator/payments`
- `src/app/(operator)/operator/payments/page.tsx` — Server Component; lista pedidos `payment_submitted` y pedidos confirmados del ciclo activo usando `adminClient`
- `src/components/operator/payments-table.tsx` — tabla de pendientes con badge rojo, tabla de confirmados con badges de estado; enlace "Revisar" hacia el detalle
- `src/app/(operator)/operator/payments/[id]/page.tsx` — Server Component de detalle: info del cliente, tabla de items con precios congelados, imagen del comprobante (con fallback PDF), resumen de pago (total / billetera aplicada / monto comprobante), dirección y fecha de entrega
- `src/components/operator/payment-actions.tsx` — máquina de estados (idle → approving/rejecting → approved/rejected/error); formulario de rechazo con motivo obligatorio; botón de aprobación; banners de resultado; sección WhatsApp con mensajes prellenados, botón copiar y enlace `wa.me`
- `src/app/api/operator/orders/[id]/approve/route.ts` — POST: valida rol, verifica `payment_submitted`, actualiza orders + payment_verifications, inserta audit_log; el trigger `lock_order_on_payment` activa `is_locked` automáticamente
- `src/app/api/operator/orders/[id]/reject/route.ts` — POST: valida rol + motivo (Zod), revierte stock en `supplier_publications` via `order_item_assignments`, reembolsa billetera si hubo pago mixto (INSERT wallet_transaction type=refund), cancela orden, actualiza payment_verifications, inserta audit_log

### Modificado
- `src/app/api/customer/orders/route.ts` — usa `adminClient` para INSERT de `order_items` (retorna IDs); crea `order_item_assignments` durante el checkout (necesarios para reversión de stock al rechazar); stock decrementa en `supplier_publications` con lógica greedy precio-ascendente; publicación pasa a `fulfilled` cuando `available_quantity` llegaría a 0 (sin violar el constraint `> 0`)

### Reglas de negocio aplicadas
- `totalAmount` eliminado de props de `PaymentActions` (no usado); comprobante muestra `proofAmount` (monto del comprobante, no el total)
- Stock: `fulfilled` → restaurar a `active` (qty no se toca); `active` → sumar `assigned_quantity` de vuelta
- Billetera: reembolso es INSERT nuevo `type=refund`, nunca UPDATE a la transacción original
- `is_locked` lo activa el trigger DB `lock_order_on_payment` cuando se setea `payment_approved_at`; la API solo escribe el timestamp

### Estado tras estos cambios
- `/operator/payments` → lista de pendientes y confirmados del ciclo actual
- `/operator/payments/{id}` → detalle completo con comprobante + acciones
- Aprobar: `confirmed` + lock automático + audit_log
- Rechazar: `cancelled` + stock revertido + billetera reembolsada + audit_log
- TypeScript: 0 errores. ESLint: 0 warnings.

### Archivos afectados
- `src/app/(operator)/layout.tsx`
- `src/components/operator/sidebar.tsx`
- `src/app/(operator)/operator/page.tsx`
- `src/app/(operator)/operator/payments/page.tsx`
- `src/app/(operator)\operator\payments\[id]\page.tsx`
- `src/components/operator/payments-table.tsx`
- `src/components/operator/payment-actions.tsx`
- `src/app/api/operator/orders/[id]/approve/route.ts`
- `src/app/api/operator/orders/[id]/reject/route.ts`
- `src/app/api/customer/orders/route.ts`

---

## [2026-05-12] — Vista cliente — carrito y checkout (paso 9)

### Añadido
- `supabase/migrations/20260512000020_storage_payment_proofs.sql` — bucket público `payment-proofs` (5 MB, JPEG/PNG/WEBP/PDF); política de upload restringida a carpeta del usuario (`{user_id}/...`); lectura pública por URL
- `src/lib/validations/customer.ts` — `checkoutSchema` con Zod: items (productId + quantity int ≥ 1), delivery_address, payment_method (yape/transfer/wallet), use_wallet, proof_url opcional
- `src/app/api/customer/orders/route.ts` — POST: autentica customer, re-valida stock en BD, recalcula precios con `calculateSalePrice` (inmutabilidad financiera), upsert de `dispatch_cycles` por región + dispatch_date, lógica de pago completa (billetera total/parcial/comprobante), crea `orders` + `order_items` con precios congelados, debita billetera vía admin client (bypass RLS), registra `wallet_transactions` + `audit_log`, crea `payment_verifications` si hay comprobante
- `src/components/customer/cart-page.tsx` — tabla de items con cantidad editable, precios y subtotales, botón "Quitar", total estimado, enlace a checkout; estado vacío con enlace al catálogo
- `src/components/customer/checkout-form.tsx` — resumen de pedido, dirección de entrega, selector de método de pago (Yape/Transferencia/Billetera), toggle de billetera para pago mixto, upload de comprobante a Supabase Storage, nota al vendedor, estado de éxito post-pedido con mensaje diferenciado (confirmado vs. en validación), manejo de errores inline
- `src/app/(customer)/customer/cart/page.tsx` — wrapper del carrito
- `src/app/(customer)/customer/checkout/page.tsx` — Server Component que carga wallet_balance y pasa al CheckoutForm

### Reglas de negocio aplicadas
- Precios recalculados en servidor al hacer checkout (no se confía en el precio del cliente)
- `unit_price_frozen` y `subtotal_frozen` se congelan en `order_items` al crear el pedido
- Billetera cubre 100%: status='confirmed', sin intervención del operador
- Pago mixto: wallet debita automáticamente, comprobante solo por la diferencia
- `dispatch_cycle` se crea automáticamente si no existe para esa región + fecha de despacho
- `wallet_transactions` INSERT vía admin client (RLS solo permite superadmin; service_role bypassa)
- `wallet_balance` UPDATE vía admin client con registro en `audit_log`

### Para aplicar
```
npx supabase db push
```

### Estado tras estos cambios
- `/customer/cart` → tabla editable de items con totales y enlace al checkout
- `/customer/checkout` → formulario completo de pago con todos los métodos
- Billetera: descuento automático, confirmación inmediata si cubre el total
- Comprobante: upload a Storage, validación pendiente por operador (paso 10)
- TypeScript: 0 errores. ESLint: 0 warnings.

### Archivos afectados
- `supabase/migrations/20260512000020_storage_payment_proofs.sql`
- `src/lib/validations/customer.ts`
- `src/app/api/customer/orders/route.ts`
- `src/components/customer/cart-page.tsx`
- `src/components/customer/checkout-form.tsx`
- `src/app/(customer)/customer/cart/page.tsx`
- `src/app/(customer)/customer/checkout/page.tsx`

---

## [2026-05-12] — Vista cliente — catálogo (paso 8)

### Añadido
- `src/stores/cart.ts` — Zustand store (`useCartStore`) con persistencia en localStorage; expone `addItem` (suma cantidad al existente o añade nuevo, clampea a `maxQuantity`), `updateQuantity`, `removeItem`, `clearCart`; cada `CartItem` guarda `productId`, `name`, `unit`, `imageUrl`, `quantity`, `maxQuantity`, `nearestCutoff`, `deliveryLabel`, `estimatedPrice`
- `src/components/customer/sidebar.tsx` — sidebar del panel cliente con nav a Catálogo, Mis pedidos y Carrito (con badge de conteo desde el store)
- `src/components/customer/catalog-grid.tsx` — `CatalogGrid` (Client Component) que agrupa los productos por categoría; `ProductCard` interno con input de cantidad (step=0.1 para kg/liter/bunch, step=1 para unit), botón "Agregar" que escribe al store y muestra estado "Agregado al carrito" por 2 s; exporta también el tipo `CatalogProduct`
- `src/app/(customer)/layout.tsx` — layout del panel cliente con `CustomerSidebar`
- `src/app/(customer)/customer/page.tsx` — redirige a `/customer/catalog`
- `src/app/(customer)/customer/catalog/page.tsx` — Server Component que carga publicaciones activas con vencimiento futuro (`status='active'`, `expires_at > now()`), agrega por `product_id` (suma `available_quantity`, toma máximo `minimum_price`, toma `expires_at` más próximo), filtra productos inactivos o eliminados, calcula precio estimado con `calculateSalePrice`, genera etiqueta de entrega ("Entrega el martes, 19 de mayo") sumando 24h al corte, y pasa los datos a `CatalogGrid`; banner superior muestra el próximo cierre de pedidos

### Reglas de negocio aplicadas
- Solo aparecen productos con al menos una publicación `active` y `expires_at` en el futuro
- Cantidad visible = suma de `available_quantity` de todas las publicaciones activas del producto
- Precio estimado = `calculateSalePrice(maxMinPrice, opCostPct, marginPct)` usando el proveedor más caro
- Stock mostrado como disponibilidad general (ej. "Disponible: 45 kg") sin revelar proveedores ni precios individuales
- Fecha de entrega = `expires_at + 24h` convertida a zona horaria Lima
- `maxQuantity` en el carrito previene agregar más de lo disponible en el momento de la carga

### Estado tras estos cambios
- Login cliente → `/customer` → redirige a `/customer/catalog`
- `/customer/catalog` → grilla de productos agrupados por categoría con disponibilidad, precio estimado y fecha de entrega
- Agregar al carrito → valida stock, acumula en store, badge en sidebar se actualiza
- TypeScript: 0 errores. ESLint: 0 warnings.

### Archivos afectados
- `src/stores/cart.ts`
- `src/components/customer/sidebar.tsx`
- `src/components/customer/catalog-grid.tsx`
- `src/app/(customer)/layout.tsx`
- `src/app/(customer)/customer/page.tsx`
- `src/app/(customer)/customer/catalog/page.tsx`

---

## [2026-05-12] — Vista proveedor — publicaciones (paso 7)

### Añadido
- `src/lib/validations/supplier.ts` — `publicationSchema` con Zod: product_id, region_id, available_quantity, minimum_price, expires_at
- `src/lib/utils/dispatch.ts` — función `getNextCutoffs(n)`: calcula los próximos N cortes de ciclo (lunes y jueves 12:00 PM Lima = 17:00 UTC); devuelve etiqueta legible + ISO string
- `src/app/api/supplier/publications/route.ts` — GET (lista publicaciones propias con join a producto y región) + POST (crea publicación; valida que producto y región estén activos)
- `src/app/api/supplier/publications/[id]/route.ts` — PUT (edita cantidad y precio, solo si status=active y es del proveedor) + DELETE (cancela → status=expired, solo si active y propietario)
- `src/components/supplier/sidebar.tsx` — sidebar del panel proveedor con navegación a Dashboard y Mis publicaciones
- `src/components/supplier/publication-form.tsx` — formulario de creación y edición de publicaciones; en edición los campos producto/región/ciclo son readonly; usa `valueAsNumber: true` para cantidad y precio
- `src/components/supplier/cancel-publication-button.tsx` — botón client component que llama DELETE con confirmación y refresca con `useTransition`
- `src/app/(supplier)/layout.tsx` — layout del panel proveedor con SupplierSidebar
- `src/app/(supplier)/supplier/page.tsx` — dashboard del proveedor: contadores de publicaciones por estado + accesos rápidos
- `src/app/(supplier)/supplier/publications/page.tsx` — tabla de publicaciones propias con estado, cantidad, precio mínimo y fecha de vencimiento; acciones Editar y Cancelar (solo si active)
- `src/app/(supplier)/supplier/publications/new/page.tsx` — carga productos activos, regiones activas y próximos 4 cortes; renderiza PublicationForm
- `src/app/(supplier)/supplier/publications/[id]/edit/page.tsx` — carga la publicación verificando ownership; redirige a lista si no está active; renderiza PublicationForm en modo edición

### Estado tras estos cambios
- Login proveedor → `/supplier` muestra dashboard con contadores reales
- `/supplier/publications` → lista todas las publicaciones propias con estados y acciones
- `/supplier/publications/new` → formulario de publicación con selector de producto, región y ciclo de despacho calculado dinámicamente
- `/supplier/publications/[id]/edit` → editar cantidad y precio (solo publicaciones activas)
- Cancelar publicación → marca como `expired` vía DELETE API
- TypeScript: 0 errores. ESLint: 0 warnings.

### Archivos afectados
- `src/lib/validations/supplier.ts`
- `src/lib/utils/dispatch.ts`
- `src/app/api/supplier/publications/route.ts`
- `src/app/api/supplier/publications/[id]/route.ts`
- `src/components/supplier/sidebar.tsx`
- `src/components/supplier/publication-form.tsx`
- `src/components/supplier/cancel-publication-button.tsx`
- `src/app/(supplier)/layout.tsx`
- `src/app/(supplier)/supplier/page.tsx`
- `src/app/(supplier)/supplier/publications/page.tsx`
- `src/app/(supplier)/supplier/publications/new/page.tsx`
- `src/app/(supplier)/supplier/publications/[id]/edit/page.tsx`

---

## [2026-05-12] — Panel superadmin — gestión de usuarios (paso 6)

### Añadido
- `supabase/migrations/20260512000018_must_change_password.sql` — añade columna `must_change_password boolean NOT NULL DEFAULT false` a `public.users`; aplicada con `npx supabase db push`
- `src/app/api/admin/users/route.ts` — GET (lista operadores/repartidores) + POST (crear usuario); detecta conflicto de DNI con cliente y devuelve 409 con `conflict: 'dni_customer'` para que el front ofrezca conversión de rol
- `src/app/api/admin/users/[id]/route.ts` — PUT (editar nombre/teléfono) + PATCH con acción discriminada: `toggle_status` (active↔suspended), `reset_password` (resetea contraseña + activa `must_change_password`), `convert_role` (customer → operator/delivery)
- `src/app/api/auth/change-password/route.ts` — POST: cambia contraseña del usuario autenticado y limpia `must_change_password = false`
- `src/components/admin/user-form.tsx` — formulario de creación (todos los campos + manejo de conflicto DNI con banner y botón "Convertir cuenta") y edición (nombre/teléfono + toggle de estado activo/suspendido)
- `src/components/admin/reset-password-form.tsx` — sección de reset de contraseña con confirmación; llama a PATCH reset_password; activa flag `must_change_password`
- `src/components/auth/change-password-form.tsx` — formulario de cambio obligatorio de contraseña (nueva + confirmación); llama a `/api/auth/change-password`; al éxito redirige a `/` para que el middleware resuelva el dashboard correcto
- `src/app/(admin)/admin/users/page.tsx` — lista de operadores/repartidores con badges de rol, estado y `must_change_password`
- `src/app/(admin)/admin/users/new/page.tsx` — página de creación de usuario
- `src/app/(admin)/admin/users/[id]/edit/page.tsx` — página de edición con UserForm + ResetPasswordForm
- `src/app/change-password/page.tsx` — página de cambio obligatorio de contraseña; accesible a cualquier rol autenticado con `must_change_password = true`

### Modificado
- `src/types/database.types.ts` — añadido `must_change_password: boolean` a Row, Insert y Update del tipo `users`
- `src/lib/validations/admin.ts` — añadidos `createUserSchema`, `updateUserSchema`, `resetPasswordSchema` y sus tipos exportados
- `src/lib/constants/index.ts` — añadidas constantes `USER_CREATED` y `PASSWORD_RESET` a `AUDIT_ACTIONS`
- `src/middleware.ts` — añadida lógica de `must_change_password`: si el flag está activo, cualquier ruta protegida redirige a `/change-password`; la ruta `/change-password` redirige al dashboard si el flag ya está limpio
- `src/components/admin/sidebar.tsx` — añadido enlace "Usuarios" al array NAV

### Corregido
- `src/components/admin/user-form.tsx` — reemplazado `watch('role')` por `useWatch({ control, name: 'role' })` para compatibilidad con React Compiler (mismo patrón aplicado en `register-form.tsx`)

### Estado tras estos cambios
- `/admin/users` → CRUD completo de operadores y repartidores
- Creación de usuario: genera contraseña temporal vía Admin API, activa `must_change_password`, registra en audit_log
- Conflicto de DNI (cliente existente): formulario detecta el 409, muestra banner y ofrece convertir la cuenta al nuevo rol
- Reset de contraseña desde el panel superadmin: activa `must_change_password`, registra en audit_log
- Primer login (y post-reset): middleware detecta `must_change_password = true` y fuerza `/change-password` antes de cualquier otra ruta
- TypeScript: 0 errores. ESLint: 0 warnings.

### Archivos afectados
- `supabase/migrations/20260512000018_must_change_password.sql`
- `src/types/database.types.ts`
- `src/lib/validations/admin.ts`
- `src/lib/constants/index.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/app/api/auth/change-password/route.ts`
- `src/components/admin/user-form.tsx`
- `src/components/admin/reset-password-form.tsx`
- `src/components/auth/change-password-form.tsx`
- `src/app/(admin)/admin/users/page.tsx`
- `src/app/(admin)/admin/users/new/page.tsx`
- `src/app/(admin)/admin/users/[id]/edit/page.tsx`
- `src/app/change-password/page.tsx`
- `src/middleware.ts`
- `src/components/admin/sidebar.tsx`

---

## [2026-05-11] — Panel superadmin — gestión de catálogo (paso 5)

### Añadido
- `src/lib/validations/admin.ts` — schemas Zod para categoría y producto; campos numéricos usan `z.number()` (no coerce) con `valueAsNumber: true` en el formulario para compatibilidad con `@hookform/resolvers` v5 + Zod v4
- `src/components/admin/sidebar.tsx` — sidebar de navegación (Client Component) con `usePathname` para link activo y botón de cierre de sesión
- `src/components/admin/toggle-button.tsx` — botón de estado activo/inactivo; llama a `PATCH /api/admin/{endpoint}/{id}` y refresca la ruta via `useTransition`
- `src/components/admin/category-form.tsx` — formulario React Hook Form + Zod para crear y editar categorías; convierte porcentajes (form 0-100 ↔ DB 0.0-1.0)
- `src/components/admin/product-form.tsx` — formulario para crear y editar productos; selector de categorías activas y unidades de medida
- `src/app/(admin)/layout.tsx` — layout del panel admin con sidebar fijo y área de contenido principal
- `src/app/(admin)/admin/page.tsx` — dashboard con contadores de categorías y productos activos
- `src/app/(admin)/admin/categories/page.tsx` — lista de categorías con porcentajes calculados desde decimal
- `src/app/(admin)/admin/categories/new/page.tsx` — página de creación de categoría
- `src/app/(admin)/admin/categories/[id]/edit/page.tsx` — página de edición de categoría (carga datos del servidor)
- `src/app/(admin)/admin/products/page.tsx` — lista de productos con join a categorías (`product_categories!category_id`)
- `src/app/(admin)/admin/products/new/page.tsx` — página de creación de producto
- `src/app/(admin)/admin/products/[id]/edit/page.tsx` — página de edición de producto
- `src/app/api/admin/categories/route.ts` — GET (lista) + POST (crear); genera slug automático con `toSlug()`
- `src/app/api/admin/categories/[id]/route.ts` — PUT (actualizar) + PATCH (toggle activo)
- `src/app/api/admin/products/route.ts` — GET + POST; registra `created_by` con el UUID del superadmin autenticado
- `src/app/api/admin/products/[id]/route.ts` — PUT + PATCH (toggle) + DELETE (soft delete vía `deleted_at`)

### Modificado
- `src/lib/utils/index.ts` — añadida función `toSlug(str)` que normaliza NFD y elimina diacríticos con `\p{M}/gu`
- `src/lib/validations/admin.ts` — Zod v4: usa `message` en vez de `errorMap` en `z.enum()`; sin `invalid_type_error`

### Corregido
- Porcentajes en DB: la migración 003 almacena `operational_cost_pct`, `suggested_margin_pct`, `estimated_waste_pct` como decimales (0.0–1.0), no como enteros. El form muestra 0–100 y el API route divide entre 100 al insertar/actualizar
- TypeScript: tipos resueltos con `z.number()` + `valueAsNumber: true`; elimina conflicto entre input type `unknown` (coerce) y el resolver de hookform v5

### Estado tras estos cambios
- Login superadmin → `/admin` muestra el dashboard con contadores reales
- `/admin/categories` → CRUD completo (crear, editar, toggle activo)
- `/admin/products` → CRUD completo (crear, editar, toggle activo, soft delete)
- TypeScript: 0 errores. ESLint: 0 warnings.

### Archivos afectados
- `src/lib/utils/index.ts`
- `src/lib/validations/admin.ts`
- `src/components/admin/sidebar.tsx`
- `src/components/admin/toggle-button.tsx`
- `src/components/admin/category-form.tsx`
- `src/components/admin/product-form.tsx`
- `src/app/(admin)/layout.tsx`
- `src/app/(admin)/admin/page.tsx`
- `src/app/(admin)/admin/categories/page.tsx`
- `src/app/(admin)/admin/categories/new/page.tsx`
- `src/app/(admin)/admin/categories/[id]/edit/page.tsx`
- `src/app/(admin)/admin/products/page.tsx`
- `src/app/(admin)/admin/products/new/page.tsx`
- `src/app/(admin)/admin/products/[id]/edit/page.tsx`
- `src/app/api/admin/categories/route.ts`
- `src/app/api/admin/categories/[id]/route.ts`
- `src/app/api/admin/products/route.ts`
- `src/app/api/admin/products/[id]/route.ts`

---


## [2026-05-11] — Fix crítico: GRANTs de PostgREST, superadmin y trigger

### Problema raíz
"Automatically expose new tables" estaba desactivado → ninguna tabla tenía GRANT a `anon`, `authenticated` ni `service_role` → todas las queries de la app retornaban "permission denied". El superadmin insertado manualmente en `auth.users` vía SQL tampoco era gestionable por el Auth Admin API.

### Añadido
- `supabase/migrations/20260511000017_grants_and_policies.sql` — GRANTs completos para todos los roles PostgREST; ajuste de política `regions_select` para permitir lectura a `anon` (necesario para el formulario de registro sin sesión); eliminación del auth user del superadmin insertado manualmente
- `supabase/migrations/20260511000016_auth_trigger.sql` — añadido `DROP TRIGGER IF EXISTS` para hacer la migración idempotente (re-ejecutable en Dashboard)
- `scripts/create-superadmin.mjs` — crea o repara el superadmin vía Auth Admin API; garantiza que el hash de contraseña sea generado por Supabase Auth (no pgcrypto manual)
- Script `seed:admin` en `package.json` → `node --env-file=.env.local scripts/create-superadmin.mjs`

### Modificado
- `src/components/auth/login-form.tsx` — fallback de rol desde `user_metadata` si la query a `public.users` falla; redirect fallback a `/login`

### Estado tras estos cambios
- `anon` puede SELECT en `regions` (registro funciona sin sesión)
- `authenticated` puede hacer CRUD completo en todas las tablas (RLS restringe por fila)
- `service_role` tiene acceso completo (cliente admin del servidor funciona)
- Superadmin: `admin@miskigo.com` / `MiskiAdmin2026!`, UUID `99ec87c5-08e8-4111-81c5-86420acdbe2c`, creado vía Admin API, trigger creó perfil en `public.users`

### Archivos afectados
- `supabase/migrations/20260511000016_auth_trigger.sql`
- `supabase/migrations/20260511000017_grants_and_policies.sql`
- `scripts/create-superadmin.mjs`
- `package.json`
- `src/components/auth/login-form.tsx`

---

## [2026-05-11] — Trigger Supabase Auth y correcciones de registro/login

### Añadido
- `supabase/migrations/20260511000016_auth_trigger.sql` — función `handle_new_auth_user()` (SECURITY DEFINER) + trigger `on_auth_user_created` en `auth.users`; cuando Supabase Auth crea un usuario, el trigger lee `raw_user_meta_data` y crea automáticamente la fila en `public.users` (atómico, sin rollback manual)

### Modificado
- `src/app/api/auth/register/route.ts` — simplificado: ya no inserta manualmente en `public.users` ni necesita rollback; pasa los datos de perfil en `user_metadata` de `admin.auth.admin.createUser` para que el trigger los procese
- `src/components/auth/login-form.tsx` — `single()` → `maybeSingle()` (evita error si el perfil no existe); fallback de redirect a `/login` en lugar de `/`

### Verificado
- Dependencias Supabase: `@supabase/supabase-js@2.105.4` y `@supabase/ssr@0.10.3` son las versiones latest; el formato nuevo de keys (`sb_publishable_*`, `sb_secret_*`) es compatible
- TypeScript: 0 errores. ESLint: 0 warnings.

---

## [2026-05-11] — Semilla de datos y middleware de rutas (pasos 3.5 y 4)

### Añadido
- `supabase/migrations/20260511000015_seed_data.sql` — inserta región San Martín (Tarapoto) y primer superadmin (`admin@miskigo.com`, contraseña temporal `MiskiAdmin2026!` — cambiar en Dashboard)

### Modificado
- `src/lib/supabase/middleware.ts` — `updateSession` ahora devuelve también `supabase` client para reutilizar en el middleware principal sin crear un segundo cliente
- `src/middleware.ts` — protección completa por rol: redirige usuarios no autenticados a `/login`; redirige usuarios autenticados en `/login` o `/register` a su dashboard; redirige a usuarios en rutas de otro rol a su propio dashboard; rutas `/api/**` quedan fuera de la protección (cada route la maneja internamente)
- `src/app/page.tsx` — reemplazado placeholder de Next.js por Server Component que redirige según sesión y rol (respaldo del middleware)

### Archivos afectados
- `supabase/migrations/20260511000015_seed_data.sql`
- `src/lib/supabase/middleware.ts`
- `src/middleware.ts`
- `src/app/page.tsx`

---

## [2026-05-11] — Autenticación con Supabase Auth (paso 3)

### Añadido
- `src/lib/validations/auth.ts` — schemas Zod para login y registro (con refine cross-field para confirmación de contraseña)
- `src/app/(auth)/layout.tsx` — layout centrado con branding Miski GO para rutas de autenticación
- `src/app/(auth)/login/page.tsx` — página de login (Server Component)
- `src/app/(auth)/register/page.tsx` — página de registro (Server Component; carga regiones activas del servidor)
- `src/components/auth/login-form.tsx` — formulario de login con React Hook Form + Zod; redirige al dashboard del rol tras autenticación
- `src/components/auth/register-form.tsx` — formulario de registro con selector visual de rol (cliente/proveedor); campos condicionales (RUC solo para proveedor); manejo de conflicto de DNI
- `src/app/api/auth/register/route.ts` — API route POST: valida con Zod, verifica duplicidad de DNI, crea usuario en auth.users con `email_confirm: true`, inserta perfil en public.users; hace rollback del auth user si falla el insert
- `src/app/api/auth/check-dni/route.ts` — API route GET: retorna si el DNI existe y qué rol tiene (usado en paso 6 para conversión de rol desde panel superadmin)

### Modificado
- `src/types/database.types.ts` — reemplazado por tipos generados con `supabase gen types typescript` (incluye `__InternalSupabase`, `PostgrestVersion`, y `Relationships` por tabla requeridos por `@supabase/supabase-js` v2.105); tipos de enum y aliases de Row/Insert añadidos al final

### Corregido
- Error de tipos `never` en queries Supabase: causado porque el archivo de tipos manual carecía de `Relationships` y `__InternalSupabase` que requiere la versión 2.105 del cliente
- Error de tipos con `z.preprocess` en `@hookform/resolvers` v5: el input type queda `unknown`; solucionado usando `.optional().refine()` en su lugar
- Warning de React Compiler en `register-form.tsx`: reemplazado `watch('role')` por `useWatch({ control, name: 'role' })`

### Archivos afectados
- `src/lib/validations/auth.ts`
- `src/types/database.types.ts`
- `src/app/(auth)/layout.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/components/auth/login-form.tsx`
- `src/components/auth/register-form.tsx`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/check-dni/route.ts`

---

## [2026-05-10] — Migraciones SQL con RLS completo (paso 2)

### Añadido
- 14 migraciones SQL en `supabase/migrations/` con todas las tablas del esquema
- Funciones helper de RLS con SECURITY DEFINER: `get_user_role()`, `get_user_region_id()`
- Trigger compartido `update_updated_at()` para todas las tablas con ese campo
- Trigger `raise_immutable_error()` que bloquea UPDATE/DELETE incluso al service role
- Triggers de negocio en `orders`: `lock_order_on_payment()` y `set_claim_window()`
- RLS activado en las 19 tablas con políticas por rol (SELECT/INSERT/UPDATE)
- `audit_log` y `wallet_transactions`: inmutabilidad a nivel de BD (triggers + ausencia de política UPDATE/DELETE)
- Migración 009 recrea las políticas SELECT de `orders` y `order_items` para filtrar delivery por ruta asignada
- Índices en todas las claves foráneas y columnas de búsqueda frecuente
- Índice compuesto para el algoritmo de asignación de proveedores (min_price ASC, published_at ASC)

### Archivos afectados
- `supabase/migrations/20260510000001_regions_users.sql`
- `supabase/migrations/20260510000002_audit_log.sql`
- `supabase/migrations/20260510000003_product_categories_products.sql`
- `supabase/migrations/20260510000004_supplier_publications.sql`
- `supabase/migrations/20260510000005_dispatch_cycles.sql`
- `supabase/migrations/20260510000006_orders_order_items.sql`
- `supabase/migrations/20260510000007_order_item_assignments.sql`
- `supabase/migrations/20260510000008_wallet_transactions_payment_verifications.sql`
- `supabase/migrations/20260510000009_delivery_routes_stops.sql`
- `supabase/migrations/20260510000010_reception_records.sql`
- `supabase/migrations/20260510000011_claims.sql`
- `supabase/migrations/20260510000012_reputation_events.sql`
- `supabase/migrations/20260510000013_notifications.sql`
- `supabase/migrations/20260510000014_product_suggestions.sql`

---

## [2026-05-10] — Estructura de carpetas y cliente Supabase

### Añadido
- Estructura completa de carpetas según CLAUDE.md sección 6
- `.env.example` con todas las variables de entorno requeridas
- `src/types/database.types.ts` — tipos TypeScript completos para todas las tablas del esquema
- `src/types/index.ts` — re-exportación centralizada de tipos
- `src/lib/constants/index.ts` — constantes de negocio (roles, estados, acciones de auditoría)
- `src/lib/utils/index.ts` — funciones utilitarias puras (formateo, cálculo de precios, fechas)
- `src/lib/supabase/client.ts` — cliente Supabase para componentes del navegador
- `src/lib/supabase/server.ts` — cliente Supabase para Server Components y API routes
- `src/lib/supabase/admin.ts` — cliente Supabase con service role key (solo servidor)
- `src/lib/supabase/middleware.ts` — helper para actualizar sesión en middleware
- `src/middleware.ts` — middleware de Next.js (refresco de sesión; protección por rol en paso 4)

### Modificado
- `src/app/layout.tsx` — metadata actualizada a Miski GO

### Archivos afectados
- `.env.example`
- `CHANGELOG.md`
- `src/types/database.types.ts`
- `src/types/index.ts`
- `src/lib/constants/index.ts`
- `src/lib/utils/index.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/middleware.ts`
- `src/middleware.ts`
- `src/app/layout.tsx`
