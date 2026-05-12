# CHANGELOG — Miski GO

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
