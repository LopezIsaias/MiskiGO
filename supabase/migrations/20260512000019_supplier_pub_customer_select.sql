-- 019: política RLS para que el rol customer pueda leer publicaciones activas
--
-- CONTEXTO: la política original "supplier_pub_select" solo cubre supplier,
-- superadmin, region_operator y operator. El rol customer no cumplía ninguna
-- condición y recibía 0 filas silenciosamente, dejando el catálogo vacío.
--
-- REGLA: customer puede leer publicaciones activas (catálogo público del marketplace).
-- No se expone supplier_id ni precio individual en la UI; la agregación ocurre
-- en la capa de aplicación (src/app/(customer)/customer/catalog/page.tsx).

CREATE POLICY "supplier_pub_select_customer"
  ON public.supplier_publications FOR SELECT TO authenticated
  USING (
    public.get_user_role() = 'customer' AND status = 'active'
  );
