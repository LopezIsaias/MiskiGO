# CHANGELOG — Miski GO

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
