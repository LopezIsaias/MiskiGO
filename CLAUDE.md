# CLAUDE.md — Miski GO

> Este archivo es el contexto completo del proyecto. Léelo íntegramente antes de cada sesión.
> Nunca tomes decisiones de arquitectura, base de datos o lógica de negocio que contradigan lo definido aquí.
> Al final de cada sesión, actualiza CHANGELOG.md con los cambios realizados.

---

## 1. Identidad del producto

**Nombre:** Miski GO
**Slogan:** "Del campo a tu mesa, sin escalas."
**Tipo:** Marketplace agrícola B2C con logística propia
**Región inicial:** Provincia de San Martín, Región San Martín, Perú
**Moneda:** Soles peruanos (S/)
**Zona horaria:** America/Lima (UTC-5)

**Problema que resuelve:** Los agricultores de San Martín reciben entre el 30-40% del precio final que paga el consumidor. Miski GO actúa como único intermediario eficiente, conectando productores y mayoristas directamente con consumidores finales y restaurantes.

**Logo:** Pendiente. Usar placeholder de texto "Miski GO" hasta recibir `/public/logo.svg` y `/public/logo.png`.

---

## 2. Stack tecnológico

| Capa | Tecnología | Razón |
|------|-----------|-------|
| Framework | Next.js 14 (App Router) | SSR/SSG híbrido, file-based routing, API routes |
| Lenguaje | TypeScript (strict mode) | Tipado estricto obligatorio. NUNCA usar `any` |
| Base de datos | Supabase (PostgreSQL) | Auth incluido, RLS, realtime, tier gratuito |
| Estilos | Tailwind CSS v3 | Utility-first, mobile-first obligatorio |
| Estado global | Zustand | Ligero, sin boilerplate |
| Formularios | React Hook Form + Zod | Validación tipada en cliente y servidor |
| Mapas | Google Maps API | Ruta optimizada para repartidor |
| Notificaciones | WhatsApp Business App (manual MVP) | Sin costo. Migrar a API en Fase 2 |
| Hosting | Vercel | CD automático desde main, previews por PR |
| CI/CD | GitHub Actions | Corre tests antes de cada deploy |
| Documentación API | OpenAPI / Swagger | Mantener actualizado con cada endpoint nuevo |

**Decisiones fijas que no se cambian sin aprobación explícita:**
- App Router de Next.js, no Pages Router
- Server Components por defecto, Client Components solo cuando sea necesario (interactividad, hooks)
- Tailwind únicamente para estilos, sin CSS modules ni styled-components
- Zod para toda validación, tanto en formularios como en API routes

---

## 3. Perfiles de usuario y permisos (RBAC)

```typescript
type UserRole =
  | 'superadmin'       // Acceso total. Solo puede crearlo otro superadmin
  | 'region_operator'  // Gestión de su región asignada. Rol de escala (Fase 3)
  | 'operator'         // Gestión operativa diaria. Lo crea el superadmin
  | 'delivery'         // Vista de ruta y entregas. Lo crea el superadmin
  | 'supplier'         // Agricultores y mayoristas. Se registran solos
  | 'customer'         // Consumidores y restaurantes. Se registran solos
```

**Reglas críticas de permisos:**
- `operator` NUNCA puede modificar saldos de billetera directamente
- `operator` puede PROPONER créditos; el `superadmin` los APRUEBA
- `delivery` NUNCA ve precios ni datos de pago
- `delivery` NUNCA ve pedidos fuera de su ruta asignada
- `supplier` NUNCA ve información de otros proveedores
- `supplier` NUNCA ve el precio final cobrado al cliente
- Toda acción de `operator` queda en audit_log

**Registro:**
- `supplier` y `customer`: registro abierto, se registran solos
- `operator` y `delivery`: los crea el `superadmin` desde el panel
- Conflicto de DNI: si el DNI ya existe como `customer`, el sistema ofrece convertir la cuenta al nuevo rol en lugar de mostrar error de duplicidad. Acción queda en audit_log.

---

## 4. Modelo de negocio — reglas críticas

### Precios
```
Precio venta = Precio mínimo proveedor más caro ÷ (1 - costo_operativo% - margen%)
```

- El `superadmin` define el precio final. El proveedor solo declara precio mínimo.
- El precio se calcula con el proveedor MÁS CARO de los asignados.
- **INMUTABILIDAD FINANCIERA:** al confirmar un pedido, precio_unitario se congela en `order_items.unit_price_frozen`. NUNCA se recalcula desde la tabla de productos.
- El `superadmin` puede sobreescribir el precio sugerido. Queda en audit_log.

### Categorías de producto y parámetros por defecto
| Categoría | Costo operativo | Margen | Merma estimada |
|-----------|----------------|--------|----------------|
| fragile | 30-35% | 20-25% | 12-18% |
| standard | 20-25% | 18-22% | 6-10% |
| robust | 15-18% | 15-20% | 3-6% |

### Ciclos de despacho
- **Martes:** corte lunes 12:00 PM → notificación proveedores lunes 12:00 PM → entrega martes
- **Viernes:** corte jueves 12:00 PM → notificación proveedores jueves 12:00 PM → entrega viernes
- Pedidos después del corte van automáticamente al siguiente ciclo
- El checkout muestra dinámicamente la fecha de entrega estimada

### Estados de un pedido
```
pending_payment → payment_submitted → confirmed → assigned →
in_transit → delivered → [claim_window_open] → completed
                                              → cancelled (solo superadmin post-pago)
                       → failed
```

### Política de edición y cancelación
1. **Antes de aprobación de pago:** cliente puede editar o cancelar libremente
2. **Después de aprobación de pago:** pedido BLOQUEADO e inmutable (`is_locked = true`)
3. **Después del corte:** todos los pedidos son inmutables sin excepción
4. **Pedidos múltiples en el mismo ciclo:** permitidos. Se agrupan con `grouped_delivery_id` y se entregan juntos como una sola parada

### Ventana de reclamo post-entrega
- Se abre cuando el repartidor marca el pedido como entregado
- Dura exactamente 2 horas desde `delivered_at`
- `claim_window_expires_at = delivered_at + interval '2 hours'`
- Al vencer, el botón de reclamo se deshabilita en la UI
- Solo el `superadmin` puede reabrir manualmente. Queda en audit_log.
- **SIN recordatorio a los 30 minutos.** Decisión deliberada.

### Notificación de entrega al cliente
Texto exacto a mostrar (no modificar sin aprobación):
> "🌱 ¡Tu pedido ha llegado! Esperamos que estés disfrutando productos frescos directo del campo.
> Si notas algún inconveniente, tienes hasta las [hora_límite] para reportarlo desde la app.
> Después de ese plazo no podremos procesar cambios en este pedido.
> ¡Gracias por confiar en Miski GO! 🙌"

### Asignación de proveedores
1. Ordenar por `minimum_price` ASC
2. En empate: ordenar por `published_at` ASC (FIFO)
3. En empate de precio Y fecha: priorizar mayor `reputation_score`
4. El operador puede sobreescribir. Queda en audit_log.

### Pagos (MVP)
- Métodos: Yape, transferencia bancaria, billetera virtual
- Validación: MANUAL. El operador aprueba el comprobante
- NO hay integración automática de pagos en MVP
- El operador ve el mensaje de WhatsApp prellenado para notificar al cliente
- Billetera: el operador PROPONE créditos, el superadmin APRUEBA

### Pagos a proveedores
- Ciclo martes: pago el miércoles por la noche
- Ciclo viernes: pago el sábado por la noche
- Vía Yape o transferencia, manual en MVP
- Se descuentan los productos rechazados por mal estado

---

## 5. Esquema de base de datos

> NUNCA modificar tipos de columnas existentes sin crear una migración.
> NUNCA eliminar columnas, solo usar soft delete con `deleted_at`.
> TODAS las tablas con datos de negocio tienen `created_at` y `updated_at`.

### Tabla: regions
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
name            text NOT NULL
city            text NOT NULL
department      text NOT NULL
country         text NOT NULL DEFAULT 'PE'
is_active       boolean DEFAULT true
created_at      timestamptz DEFAULT now()
```

### Tabla: users (extiende auth.users de Supabase)
```sql
id              uuid PRIMARY KEY REFERENCES auth.users(id)
email           text UNIQUE NOT NULL
phone           text
full_name       text NOT NULL
dni             text UNIQUE  -- liberable en caso de conflicto de rol
ruc             text UNIQUE
role            text NOT NULL CHECK (role IN ('superadmin','region_operator','operator','delivery','supplier','customer'))
region_id       uuid REFERENCES regions(id)
reputation_score integer DEFAULT 100
status          text DEFAULT 'active' CHECK (status IN ('active','suspended','deleted'))
wallet_balance  numeric(10,2) DEFAULT 0 CHECK (wallet_balance >= 0)
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
deleted_at      timestamptz  -- soft delete
```

### Tabla: audit_log (APPEND-ONLY — sin UPDATE ni DELETE a nivel de BD)
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
timestamp       timestamptz DEFAULT now() NOT NULL
user_id         uuid REFERENCES users(id)
role_at_time    text NOT NULL
action          text NOT NULL  -- enum estandarizado en código
module          text NOT NULL
region_id       uuid REFERENCES regions(id)
entity_type     text
entity_id       uuid
previous_value  jsonb
new_value       jsonb
ip_address      inet
notes           text
```
**RLS Policy:** INSERT para roles autorizados. SELECT para superadmin y region_operator. UPDATE y DELETE: NEVER.

### Tabla: product_categories
```sql
id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
name                  text NOT NULL
slug                  text UNIQUE NOT NULL
operational_cost_pct  numeric(5,2) NOT NULL
suggested_margin_pct  numeric(5,2) NOT NULL
estimated_waste_pct   numeric(5,2) NOT NULL
is_active             boolean DEFAULT true
created_at            timestamptz DEFAULT now()
```

### Tabla: products (catálogo maestro — solo superadmin crea en MVP)
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
category_id     uuid REFERENCES product_categories(id) NOT NULL
name            text NOT NULL
slug            text UNIQUE NOT NULL
description     text
unit            text NOT NULL CHECK (unit IN ('kg','unit','liter','bunch'))
image_url       text
is_active       boolean DEFAULT true
created_by      uuid REFERENCES users(id)
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
deleted_at      timestamptz
```

### Tabla: supplier_publications
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
supplier_id         uuid REFERENCES users(id) NOT NULL
product_id          uuid REFERENCES products(id) NOT NULL
region_id           uuid REFERENCES regions(id) NOT NULL
available_quantity  numeric(10,3) NOT NULL CHECK (available_quantity > 0)
minimum_price       numeric(10,2) NOT NULL CHECK (minimum_price > 0)
published_at        timestamptz DEFAULT now()
expires_at          timestamptz NOT NULL  -- próximo corte de pedidos
status              text DEFAULT 'active' CHECK (status IN ('active','reserved','fulfilled','expired'))
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

### Tabla: dispatch_cycles
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
region_id       uuid REFERENCES regions(id) NOT NULL
dispatch_date   date NOT NULL
cutoff_at       timestamptz NOT NULL  -- día anterior 12:00 PM
status          text DEFAULT 'open' CHECK (status IN ('open','closed','in_progress','completed'))
created_at      timestamptz DEFAULT now()
UNIQUE(region_id, dispatch_date)
```

### Tabla: orders
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
customer_id             uuid REFERENCES users(id) NOT NULL
dispatch_cycle_id       uuid REFERENCES dispatch_cycles(id) NOT NULL
region_id               uuid REFERENCES regions(id) NOT NULL
grouped_delivery_id     uuid  -- agrupa pedidos del mismo cliente en el mismo ciclo
status                  text DEFAULT 'pending_payment' CHECK (status IN (
                          'pending_payment','payment_submitted','confirmed',
                          'assigned','in_transit','delivered','completed',
                          'cancelled','failed'))
subtotal                numeric(10,2) NOT NULL DEFAULT 0
delivery_fee            numeric(10,2) NOT NULL DEFAULT 0
total_amount            numeric(10,2) NOT NULL DEFAULT 0
payment_method          text CHECK (payment_method IN ('yape','transfer','wallet'))
payment_proof_url       text
payment_approved_at     timestamptz
payment_approved_by     uuid REFERENCES users(id)
is_locked               boolean DEFAULT false  -- true desde aprobación de pago
locked_at               timestamptz
delivery_address        text NOT NULL
delivery_notes          text
customer_note           text
delivered_at            timestamptz
claim_window_expires_at timestamptz  -- delivered_at + 2 horas
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
```

### Tabla: order_items
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
order_id            uuid REFERENCES orders(id) NOT NULL
product_id          uuid REFERENCES products(id) NOT NULL
quantity            numeric(10,3) NOT NULL
unit_price_frozen   numeric(10,2) NOT NULL  -- CONGELADO al confirmar
subtotal_frozen     numeric(10,2) NOT NULL  -- CONGELADO al confirmar
status              text DEFAULT 'pending' CHECK (status IN ('pending','assigned','delivered','rejected'))
created_at          timestamptz DEFAULT now()
```

### Tabla: order_item_assignments
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
order_item_id           uuid REFERENCES order_items(id) NOT NULL
publication_id          uuid REFERENCES supplier_publications(id) NOT NULL
supplier_id             uuid REFERENCES users(id) NOT NULL
assigned_quantity       numeric(10,3) NOT NULL
supplier_price_frozen   numeric(10,2) NOT NULL  -- CONGELADO al asignar
platform_margin_frozen  numeric(10,2) NOT NULL  -- CONGELADO al asignar
status                  text DEFAULT 'pending' CHECK (status IN ('pending','confirmed','shipped','failed'))
confirmed_at            timestamptz
failure_reason          text
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
```

### Tabla: wallet_transactions
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id             uuid REFERENCES users(id) NOT NULL
type                text NOT NULL CHECK (type IN ('recharge','payment','refund','bonus','adjustment'))
amount              numeric(10,2) NOT NULL
balance_before      numeric(10,2) NOT NULL  -- CONGELADO
balance_after       numeric(10,2) NOT NULL  -- CONGELADO
reference_order_id  uuid REFERENCES orders(id)
proof_url           text
status              text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
approved_by         uuid REFERENCES users(id)
approved_at         timestamptz
notes               text
created_at          timestamptz DEFAULT now()
```

### Tabla: payment_verifications
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
order_id            uuid REFERENCES orders(id) NOT NULL
method              text NOT NULL CHECK (method IN ('yape','transfer'))
amount              numeric(10,2) NOT NULL
proof_url           text NOT NULL
status              text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))
submitted_at        timestamptz DEFAULT now()
reviewed_by         uuid REFERENCES users(id)
reviewed_at         timestamptz
rejection_reason    text
```

### Tabla: delivery_routes
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
delivery_person_id  uuid REFERENCES users(id) NOT NULL
dispatch_cycle_id   uuid REFERENCES dispatch_cycles(id) NOT NULL
region_id           uuid REFERENCES regions(id) NOT NULL
status              text DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed'))
optimized_route_url text
started_at          timestamptz
completed_at        timestamptz
created_at          timestamptz DEFAULT now()
```

### Tabla: delivery_stops
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
route_id        uuid REFERENCES delivery_routes(id) NOT NULL
order_id        uuid REFERENCES orders(id) NOT NULL
stop_order      integer NOT NULL
status          text DEFAULT 'pending' CHECK (status IN ('pending','arrived','delivered','failed'))
arrived_at      timestamptz
completed_at    timestamptz
failure_reason  text
created_at      timestamptz DEFAULT now()
```

### Tabla: reception_records
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
delivery_person_id  uuid REFERENCES users(id) NOT NULL
dispatch_cycle_id   uuid REFERENCES dispatch_cycles(id) NOT NULL
supplier_id         uuid REFERENCES users(id) NOT NULL
product_id          uuid REFERENCES products(id) NOT NULL
expected_quantity   numeric(10,3) NOT NULL
received_quantity   numeric(10,3) NOT NULL
rejected_quantity   numeric(10,3) DEFAULT 0
rejection_reason    text
photo_url           text NOT NULL  -- OBLIGATORIO
recorded_at         timestamptz DEFAULT now()
created_at          timestamptz DEFAULT now()
```

### Tabla: claims
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
order_id            uuid REFERENCES orders(id) NOT NULL
customer_id         uuid REFERENCES users(id) NOT NULL
product_id          uuid REFERENCES products(id) NOT NULL
claimed_quantity    numeric(10,3) NOT NULL
reason              text NOT NULL
photo_url           text NOT NULL  -- OBLIGATORIO
status              text DEFAULT 'pending' CHECK (status IN ('pending','approved','partially_approved','rejected'))
resolution_type     text CHECK (resolution_type IN ('wallet_credit','external_refund','reprogrammed'))
resolution_amount   numeric(10,2)
resolved_by         uuid REFERENCES users(id)
resolved_at         timestamptz
is_justified        boolean
created_at          timestamptz DEFAULT now()
```

### Tabla: reputation_events
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id             uuid REFERENCES users(id) NOT NULL
role                text NOT NULL
event_type          text NOT NULL
reference_id        uuid
points_delta        integer NOT NULL
notes               text
is_exception        boolean DEFAULT false
exception_reason    text
created_by          uuid REFERENCES users(id)
created_at          timestamptz DEFAULT now()
```

### Tabla: notifications
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
recipient_id    uuid REFERENCES users(id) NOT NULL
type            text NOT NULL
channel         text NOT NULL CHECK (channel IN ('push','whatsapp','in_app'))
title           text
body            text NOT NULL
reference_type  text
reference_id    uuid
status          text DEFAULT 'pending' CHECK (status IN ('pending','sent','failed'))
sent_at         timestamptz
created_at      timestamptz DEFAULT now()
```

### Tabla: product_suggestions
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
customer_id     uuid REFERENCES users(id) NOT NULL
product_name    text NOT NULL
description     text
use_case        text
status          text DEFAULT 'pending' CHECK (status IN ('pending','reviewing','added','rejected'))
reviewed_by     uuid REFERENCES users(id)
response_notes  text
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

---

## 6. Estructura de carpetas del proyecto

```
miski-go/
├── public/
│   ├── logo.svg          # PENDIENTE — usar placeholder hasta recibir
│   ├── logo.png          # PENDIENTE — usar placeholder hasta recibir
│   └── favicon.ico
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── (auth)/       # Login, registro
│   │   ├── (customer)/   # Catálogo, carrito, pedidos, billetera
│   │   ├── (supplier)/   # Publicaciones, historial
│   │   ├── (delivery)/   # Ruta, recepción, entregas
│   │   ├── (operator)/   # Panel operativo
│   │   ├── (admin)/      # Panel superadmin
│   │   └── api/          # API routes de Next.js
│   ├── components/
│   │   ├── ui/           # Componentes base (botones, inputs, modales)
│   │   └── shared/       # Componentes compartidos entre roles
│   ├── lib/
│   │   ├── supabase/     # Cliente de Supabase y helpers
│   │   ├── validations/  # Schemas de Zod
│   │   ├── utils/        # Funciones utilitarias puras
│   │   └── constants/    # Constantes del negocio (estados, enums)
│   ├── hooks/            # Custom React hooks
│   ├── stores/           # Zustand stores
│   ├── types/            # Tipos TypeScript globales
│   └── middleware.ts     # Protección de rutas por rol
├── supabase/
│   └── migrations/       # Migraciones SQL en orden
├── docs/
│   ├── api/              # OpenAPI spec
│   └── data-dictionary.md # Diccionario de datos
├── CLAUDE.md             # Este archivo
├── CHANGELOG.md          # Actualizar al final de cada sesión
├── .env.local            # Variables de entorno — NUNCA subir a git
├── .env.example          # Plantilla de variables sin valores reales
└── .gitignore
```

---

## 7. Convenciones de código

### TypeScript
- `strict: true` en tsconfig. Sin excepciones.
- NUNCA usar `any`. Usar `unknown` y hacer type narrowing.
- Interfaces para objetos con forma fija. Types para unions y aliases.
- Exportaciones nombradas siempre. Sin `export default` en componentes.

### Componentes React
- Funcionales únicamente. Sin class components.
- Server Components por defecto.
- `'use client'` solo cuando se necesite: eventos, hooks de estado, browser APIs.
- Props tipadas con interfaces explícitas.
- Máximo 150 líneas por componente. Si supera, extraer.

### API Routes
- Validar SIEMPRE con Zod antes de procesar.
- Respuestas tipadas con interfaces.
- Errores con códigos HTTP semánticos.
- Toda ruta sensible verifica rol desde el servidor, no solo en la UI.

### Base de datos
- NUNCA queries SQL en componentes. Solo en `src/lib/supabase/`.
- NUNCA calcular precios al vuelo desde tablas de productos en pedidos existentes.
- Usar transacciones para operaciones que afecten múltiples tablas.
- Toda escritura en `audit_log` dentro de la misma transacción que el evento.

### Nomenclatura
- Archivos: kebab-case (`order-card.tsx`)
- Componentes: PascalCase (`OrderCard`)
- Variables y funciones: camelCase (`getOrderById`)
- Constantes: UPPER_SNAKE_CASE (`MAX_CLAIM_WINDOW_HOURS`)
- Tablas BD: snake_case (`order_items`)

---

## 8. Seguridad y auditoría

### Row Level Security (RLS) en Supabase
- RLS activado en TODAS las tablas desde el inicio.
- `audit_log`: INSERT permitido para roles autorizados. SELECT para superadmin. UPDATE y DELETE: PROHIBIDO a nivel de base de datos, no solo de aplicación.
- `wallet_transactions`: INSERT y SELECT según rol. UPDATE y DELETE: PROHIBIDO.
- `orders`: SELECT filtrado por `customer_id` para clientes, por `region_id` para operadores de región.

### Variables de entorno
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # Solo en servidor, NUNCA en cliente

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_KEY=

# App
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_CLAIM_WINDOW_HOURS=2
NEXT_PUBLIC_CUTOFF_HOUR=12    # Hora de corte de pedidos (mediodía)
```

### Acciones que generan audit_log obligatorio
Toda la siguiente lista DEBE generar un registro en `audit_log` dentro de la misma transacción:
1. Aprobación o rechazo de comprobante de pago
2. Asignación o modificación de saldo en billetera
3. Aprobación de crédito de compensación
4. Activación de protocolo de fallo de fulfillment
5. Suspensión o rehabilitación de cualquier cuenta
6. Modificación de precios o parámetros del sistema
7. Asignación manual de proveedor sobreescribiendo el automático
8. Marcado de excepción en sistema de reputación
9. Reapertura de plazo de reclamo post-vencimiento
10. Creación o modificación de roles y permisos
11. Pago a proveedor registrado en sistema
12. Reporte de producto en mal estado (repartidor)
13. Conversión de rol de usuario (ej: customer → operator)
14. Cancelación excepcional de pedido post-pago (solo superadmin)

---

## 9. Flujo de trabajo por sesión

### Al INICIAR cada sesión
1. Leer este archivo completo
2. Leer CHANGELOG.md para saber el estado actual
3. Confirmar con el usuario qué se va a construir en esta sesión
4. Revisar los archivos relevantes antes de proponer cambios

### Al FINALIZAR cada sesión
Actualizar `CHANGELOG.md` con el siguiente formato y actualizar la sección **## Estado actual del proyecto** al final de este archivo con: agente usado, fecha, pasos completados, hash del último commit (`git log -1 --format="%H"`), próximo paso, y bugs o decisiones pendientes.

```markdown
## [YYYY-MM-DD] — Descripción breve de la sesión

### Añadido
- Descripción de cada cosa nueva

### Modificado
- Descripción de cada cambio con archivo afectado

### Corregido
- Descripción de cada bug corregido

### Archivos afectados
- src/ruta/al/archivo.tsx
- supabase/migrations/XXXXXX.sql
```

### Reglas de trabajo
- NUNCA modificar más de lo que se pidió en el prompt
- SIEMPRE mostrar el diff antes de aplicar cambios en archivos críticos
- SIEMPRE correr `npm run lint` antes de dar una tarea por terminada
- NUNCA instalar dependencias nuevas sin mencionarlo explícitamente
- Si hay duda sobre una decisión de negocio, preguntar antes de implementar

---

## 10. Funcionalidades futuras anotadas

> Estas funcionalidades NO se implementan en MVP pero el diseño NO debe imposibilitarlas.

- **WhatsApp Business API:** reemplazará el flujo manual. La tabla `notifications` ya está preparada.
- **Integración SUNAT/RENIEC:** autocompletar datos en registro. Los campos `dni` y `ruc` ya existen en `users`.
- **Sistema de reputación automatizado:** la tabla `reputation_events` ya existe. En MVP se gestiona manualmente.
- **Reasignación de inventario:** cuando el superadmin cancela un pedido post-pago, los productos reservados se reasignan al siguiente pedido pendiente del mismo ciclo que los necesite.
- **Pasarela de pagos (Culqi/Niubiz):** reemplazará la validación manual. La tabla `payment_verifications` ya está preparada.
- **Rol Operador de región:** para escala multi-región. El campo `region_id` ya existe en todas las tablas relevantes.
- **Docker:** para consistencia de entornos cuando el equipo crezca.
- **App móvil nativa:** el MVP es PWA mobile-first. La API ya estará lista para consumirse desde una app nativa.
- **CI/CD avanzado:** tests automáticos en cada PR antes de merge a main.
- **Reportes avanzados:** el modelo de datos ya captura toda la información necesaria.
- **Mapa de entregas con chinchetas por dirección:** al registrarse el cliente elige su ubicación en un mapa (Google Maps picker) o ingresa coordenadas. Esto permite mostrar marcadores exactos en la ruta del repartidor en vez de solo direcciones de texto.

---

## 11. Orden de construcción del MVP

Construir estrictamente en este orden. No avanzar al siguiente paso sin que el anterior funcione correctamente.

1. **Configuración base:** Next.js + TypeScript + Tailwind + Supabase + ESLint + estructura de carpetas
2. **Migraciones de base de datos:** todas las tablas en Supabase con RLS
3. **Autenticación:** registro y login por rol con Supabase Auth
4. **Middleware de rutas:** protección por rol, redirección automática
5. **Panel superadmin — gestión de catálogo:** CRUD de categorías y productos
6. **Panel superadmin — gestión de usuarios:** crear operadores y repartidores
7. **Vista proveedor — publicaciones:** publicar disponibilidad sobre catálogo existente
8. **Vista cliente — catálogo:** ver productos disponibles con disponibilidad en tiempo real
9. **Vista cliente — carrito y checkout:** pedido con selección de método de pago y carga de comprobante
10. **Panel operador — aprobación de pagos:** ver comprobantes, aprobar o rechazar
11. **Lógica de asignación de proveedores:** automática al aprobar pago
12. **Panel operador — gestión de pedidos:** vista completa con estados y mensajes WhatsApp prellenados
13. **Vista repartidor — recepción:** checklist de productos por proveedor con foto obligatoria
14. **Vista repartidor — ruta y entrega:** mapa optimizado, marcar entregado
15. **Notificación post-entrega:** ventana de reclamo de 2 horas
16. **Vista cliente — reclamos:** formulario con foto dentro de ventana
17. **Panel operador — gestión de reclamos:** resolver conflictos
18. **Billetera virtual:** saldo, recargas, historial de movimientos
19. **Log de auditoría:** vista para superadmin
20. **Parámetros del sistema:** márgenes, horarios de corte editables por superadmin
```

---

*Última actualización: inicio del proyecto*
*Versión del modelo de negocio: final*

---

## 12. Estado actual del proyecto

> Esta sección debe actualizarse al final de cada sesión por cualquier agente (Claude Code, Gemini, etc.).
> Todo agente que trabaje en este proyecto debe leer este archivo completo y respetar todas las decisiones documentadas aquí antes de proponer o aplicar cambios.

**Último agente:** Claude Code
**Fecha:** 2026-05-19
**Pasos completados:** 1 al 18
**Último commit:** 8b66de7 (pre-step-18 — sin commit nuevo aún en esta sesión)
**Próximo paso:** Paso 19 — log de auditoría (vista para superadmin)
**Bugs pendientes:** Ninguno
**Decisiones pendientes:** Ninguna
