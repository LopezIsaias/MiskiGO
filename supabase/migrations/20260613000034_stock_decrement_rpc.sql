-- Migración 034 — Decremento/restauración atómica de stock de publicaciones
--
-- Problema (bug HIGH "oversell"): el decremento de available_quantity en checkout,
-- reasignación y asignación manual era read-modify-write desde la app (SELECT y luego
-- UPDATE en llamadas separadas, sin lock). Dos checkouts concurrentes leían el mismo
-- stock y ambos descontaban → sobreventa. Viola CLAUDE.md §7 (transacciones).
--
-- Solución: funciones que bloquean la fila (SELECT ... FOR UPDATE) y descuentan/restauran
-- de forma atómica. Concurrentes se serializan en el lock de fila → sin sobreventa.

-- Descuenta hasta `p_qty` del stock de una publicación ACTIVA. Devuelve la cantidad
-- realmente descontada (0 si no hay stock o la publicación no está activa).
--
-- NOTA sobre el agotamiento: la columna available_quantity tiene CHECK (> 0), así que
-- al agotarse NO se pone en 0. En su lugar la publicación pasa a 'fulfilled' y se deja
-- available_quantity con su último valor (>0). restore_publication_stock revierte esto
-- reactivando sin sumar. (Semántica idéntica a la lógica previa en app, ahora atómica.)
create or replace function public.decrement_publication_stock(
  p_pub_id uuid,
  p_qty    numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avail  numeric;
  v_deduct numeric;
  v_new    numeric;
begin
  if p_qty is null or p_qty <= 0 then
    return 0;
  end if;

  -- Bloquea la fila: cualquier otra transacción que intente descontar la misma
  -- publicación espera aquí hasta que esta termine.
  select available_quantity into v_avail
  from supplier_publications
  where id = p_pub_id and status = 'active'
  for update;

  if v_avail is null then
    return 0; -- no existe o no está activa
  end if;

  v_deduct := least(v_avail, p_qty);
  if v_deduct <= 0 then
    return 0;
  end if;

  v_new := round((v_avail - v_deduct)::numeric, 3);

  if v_new <= 0.0001 then
    -- Agotada: marcar fulfilled, dejar available_quantity intacto (CHECK > 0).
    update supplier_publications
    set status = 'fulfilled', updated_at = now()
    where id = p_pub_id;
  else
    update supplier_publications
    set available_quantity = v_new, updated_at = now()
    where id = p_pub_id;
  end if;

  return v_deduct;
end;
$$;

-- Restaura `p_qty` al stock de una publicación (al rechazar pago / cancelar pedido).
-- Coherente con decrement_publication_stock:
--   - Si está 'fulfilled' (se agotó por consumo total): reactivar; el valor numérico
--     ya quedó intacto al agotarse, sumar duplicaría → no se suma.
--   - Si está 'active' (consumo parcial): sumar p_qty de vuelta.
-- Atómica con lock de fila.
create or replace function public.restore_publication_stock(
  p_pub_id uuid,
  p_qty    numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avail  numeric;
  v_status text;
begin
  if p_qty is null or p_qty <= 0 then
    return 0;
  end if;

  select available_quantity, status into v_avail, v_status
  from supplier_publications
  where id = p_pub_id
  for update;

  if v_avail is null then
    return 0;
  end if;

  if v_status = 'fulfilled' then
    update supplier_publications
    set status = 'active', updated_at = now()
    where id = p_pub_id;
    return 0;
  end if;

  update supplier_publications
  set available_quantity = round((v_avail + p_qty)::numeric, 3), updated_at = now()
  where id = p_pub_id;

  return p_qty;
end;
$$;

-- Solo el rol de servicio (admin client del servidor) las ejecuta.
revoke all on function public.decrement_publication_stock(uuid, numeric) from public, anon, authenticated;
revoke all on function public.restore_publication_stock(uuid, numeric)   from public, anon, authenticated;
grant execute on function public.decrement_publication_stock(uuid, numeric) to service_role;
grant execute on function public.restore_publication_stock(uuid, numeric)   to service_role;
