-- Step 20: system_params — global editable parameters for superadmin
CREATE TABLE IF NOT EXISTS system_params (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  label       text NOT NULL,
  description text,
  updated_by  uuid REFERENCES public.users(id),
  updated_at  timestamptz DEFAULT now()
);

-- Seed defaults
INSERT INTO system_params (key, value, label, description) VALUES
  ('cutoff_hour',         '12', 'Hora de corte de pedidos',    'Hora (0-23, Lima UTC-5) en que cierra el ciclo de despacho el día anterior al reparto'),
  ('claim_window_hours',  '2',  'Ventana de reclamo (horas)',  'Horas disponibles para que el cliente reporte un problema después de recibir su pedido')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE system_params ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (catalog page needs cutoff_hour)
CREATE POLICY "system_params_select" ON system_params
  FOR SELECT TO authenticated USING (true);

-- Only superadmin can update
CREATE POLICY "system_params_update" ON system_params
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- Grant to PostgREST roles
GRANT SELECT ON system_params TO anon, authenticated, service_role;
GRANT UPDATE ON system_params TO authenticated, service_role;
