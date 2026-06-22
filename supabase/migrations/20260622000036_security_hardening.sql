-- ================================================================
-- 036 — Endurecimiento de seguridad (Fase 0)
--
-- 1. Trigger: protege columnas privilegiadas de public.users.
--    RLS users_update permitía a customer/supplier hacer UPDATE de su
--    propia fila, y el GRANT (mig 017) cubre TODAS las columnas. Sin
--    guard, un usuario podía auto-asignarse wallet_balance, role,
--    reputation_score, etc. vía PostgREST. Estas columnas solo deben
--    cambiarse por service_role (panel admin/operador usan adminClient).
--    Viola CLAUDE.md §3 y §8.
--
-- 2. Vista catalog_availability: el customer NO debe leer
--    supplier_publications directamente (expone supplier_id y
--    minimum_price → identidad del proveedor + margen de la plataforma).
--    La policy supplier_pub_select_customer (mig 019) lo permitía y la
--    "agregación solo en UI" no es seguridad. Se reemplaza por una vista
--    que solo expone producto, stock agregado y PRECIO DE VENTA ya
--    calculado, y se elimina el acceso directo del customer a la tabla.
-- ================================================================

-- ─── 1. Guard de columnas privilegiadas en users ─────────────────

CREATE OR REPLACE FUNCTION public.protect_user_privileged_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- service_role (adminClient), migraciones (postgres) y admin de Supabase pueden todo.
  IF current_user IN ('service_role', 'supabase_admin', 'postgres') THEN
    RETURN NEW;
  END IF;

  IF NEW.role             IS DISTINCT FROM OLD.role
     OR NEW.wallet_balance   IS DISTINCT FROM OLD.wallet_balance
     OR NEW.reputation_score IS DISTINCT FROM OLD.reputation_score
     OR NEW.status           IS DISTINCT FROM OLD.status
     OR NEW.region_id        IS DISTINCT FROM OLD.region_id THEN
    RAISE EXCEPTION 'users: role, wallet_balance, reputation_score, status y region_id solo son modificables por service_role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_protect_privileged ON public.users;
CREATE TRIGGER users_protect_privileged
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_privileged_fields();

-- ─── 2. Vista pública de catálogo (sin datos de proveedor) ───────
-- security_invoker = false (default en PG15): la vista corre con los
-- privilegios del owner (postgres) y SALTA RLS de supplier_publications
-- intencionalmente. Solo expone columnas no sensibles: ni supplier_id
-- ni minimum_price. El precio de venta se calcula aquí (CLAUDE.md §4:
-- precio = min_proveedor_más_caro / (1 - costo_op% - margen%), ceil 2 dec).

CREATE OR REPLACE VIEW public.catalog_availability AS
SELECT
  p.id                                   AS product_id,
  p.name,
  p.unit,
  p.image_url,
  p.description,
  pc.name                                AS category_name,
  SUM(sp.available_quantity)             AS total_available,
  CEIL(
    (MAX(sp.minimum_price) / (1 - pc.operational_cost_pct - pc.suggested_margin_pct)) * 100
  ) / 100                                AS sale_price,
  MIN(sp.expires_at)                     AS nearest_cutoff
FROM public.supplier_publications sp
JOIN public.products p           ON p.id = sp.product_id
JOIN public.product_categories pc ON pc.id = p.category_id
WHERE sp.status = 'active'
  AND sp.expires_at > now()
  AND p.is_active = true
  AND p.deleted_at IS NULL
  AND (1 - pc.operational_cost_pct - pc.suggested_margin_pct) > 0
GROUP BY p.id, p.name, p.unit, p.image_url, p.description,
         pc.name, pc.operational_cost_pct, pc.suggested_margin_pct;

-- ALTER DEFAULT PRIVILEGES (mig 017) otorga INSERT/UPDATE/DELETE a authenticated
-- y todo a anon sobre objetos nuevos, incluidas vistas. Limpiar y dejar solo
-- SELECT para authenticated (catálogo requiere sesión).
REVOKE ALL ON public.catalog_availability FROM anon, authenticated;
GRANT SELECT ON public.catalog_availability TO authenticated;

-- El customer ya no lee supplier_publications directamente.
DROP POLICY IF EXISTS "supplier_pub_select_customer" ON public.supplier_publications;
