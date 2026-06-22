-- ================================================================
-- 038 — catalog_availability ahora lee de cycle_offerings (Fase 1)
--
-- El catálogo deja de depender de supplier_publications (que requería
-- que el proveedor publicara) y pasa a leer las ofertas sembradas por
-- el operador para el ciclo ABIERTO de cada región. El precio mostrado
-- es el sale_price fijado por el operador (§4); el stock es la cantidad
-- esperada de la oferta. supplier_publications queda como sourcing.
--
-- ponytail: asume un ciclo abierto por región a la vez. Si hubiera
-- varios, DISTINCT ON toma la oferta del corte más próximo por producto.
-- ================================================================

-- DROP + CREATE (no REPLACE): cambian los tipos de columna respecto a la
-- vista de mig 036 (numeric sin typmod → numeric(10,3)/(10,2)).
DROP VIEW IF EXISTS public.catalog_availability;

CREATE VIEW public.catalog_availability AS
SELECT DISTINCT ON (co.product_id, dc.region_id)
  co.product_id,
  p.name,
  p.unit,
  p.image_url,
  p.description,
  pc.name              AS category_name,
  co.expected_quantity AS total_available,
  co.sale_price,
  dc.cutoff_at         AS nearest_cutoff,
  dc.region_id
FROM public.cycle_offerings co
JOIN public.dispatch_cycles dc    ON dc.id = co.dispatch_cycle_id
JOIN public.products p            ON p.id = co.product_id
JOIN public.product_categories pc ON pc.id = p.category_id
WHERE co.status = 'active'
  AND dc.status = 'open'
  AND dc.cutoff_at > now()
  AND p.is_active = true
  AND p.deleted_at IS NULL
ORDER BY co.product_id, dc.region_id, dc.cutoff_at ASC;

-- CREATE OR REPLACE conserva los grants previos (mig 036), pero los
-- re-afirmamos por claridad/idempotencia.
REVOKE ALL ON public.catalog_availability FROM anon, authenticated;
GRANT SELECT ON public.catalog_availability TO authenticated;
