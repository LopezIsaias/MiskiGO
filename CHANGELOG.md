# CHANGELOG — Miski GO

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
