import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PriceTag } from '@/components/ui/price-tag'
import { SinEscalasRule } from '@/components/ui/sin-escalas-rule'

export const metadata: Metadata = { title: 'Identidad visual' }

const palette = [
  ['forest', 'bg-miski-forest', 'text-white', '#1B4D32'],
  ['green', 'bg-miski-green', 'text-white', '#3E8E4F'],
  ['lima', 'bg-miski-lime', 'text-miski-forest', '#9FC131'],
  ['maíz', 'bg-miski-gold', 'text-miski-forest', '#E0A53B'],
  ['hueso', 'bg-miski-hueso border border-miski-border', 'text-miski-tinta', '#F6F8F1'],
  ['tinta', 'bg-miski-tinta', 'text-white', '#16241B'],
] as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-lg font-bold text-miski-forest">{title}</h2>
      {children}
    </section>
  )
}

export default function StyleGuidePage() {
  return (
    <main className="min-h-screen bg-miski-hueso px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-12">
        {/* Hero */}
        <header className="space-y-4">
          <SinEscalasRule from="campo" to="mesa" />
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] text-miski-forest sm:text-5xl">
            Del campo<br />a tu mesa.
          </h1>
          <p className="max-w-md text-miski-muted">
            Identidad visual de Miski GO — dirección «selva alta». Bricolage Grotesque,
            verdes de dosel, lima fresca y maíz para el precio justo.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button>Ver catálogo</Button>
            <Button variant="secondary">Cómo funciona</Button>
          </div>
        </header>

        <SinEscalasRule />

        <Section title="Color">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {palette.map(([name, bg, fg, hex]) => (
              <div key={name} className={`rounded-xl p-4 ${bg} ${fg}`}>
                <div className="font-display font-bold capitalize">{name}</div>
                <div className="tabular text-xs opacity-80">{hex}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tipografía">
          <Card className="space-y-3 p-6">
            <p className="font-display text-3xl font-extrabold text-miski-forest">Bricolage Grotesque</p>
            <p className="text-miski-muted">Display — titulares y números de héroe, con restricción.</p>
            <hr className="border-miski-border" />
            <p className="text-base text-miski-tinta">
              Hanken Grotesk — cuerpo legible y tranquilo para descripciones, formularios y listas.
            </p>
            <p className="tabular text-sm text-miski-tinta">Geist Mono — S/ 1,234.50 · 12.5 kg · cifras tabulares</p>
          </Card>
        </Section>

        <Section title="Componentes">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primario</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Peligro</Button>
            <Button disabled>Deshabilitado</Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="fresh">◣ fresco</Badge>
            <Badge tone="value">precio justo</Badge>
            <Badge tone="neutral">estándar</Badge>
            <Badge tone="success">entregado</Badge>
            <Badge tone="warning">pendiente</Badge>
            <Badge tone="danger">fallido</Badge>
          </div>
          <div className="max-w-sm">
            <Input label="Correo" name="email" type="email" placeholder="tu@correo.com" hint="Usamos esto para tu cuenta." />
          </div>
        </Section>

        <Section title="Card de producto">
          <Card as="article" className="flex max-w-sm gap-4 overflow-hidden p-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-miski-green-soft text-2xl">🥭</div>
            <div className="flex flex-1 flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display font-bold text-miski-forest">Mango</h3>
                  <p className="text-xs text-miski-muted">Tarapoto · cosecha fresca</p>
                </div>
                <Badge tone="fresh">◣ fresco</Badge>
              </div>
              <div className="flex items-center justify-between">
                <PriceTag amount={8} unit="kg" size="lg" />
                <Button size="sm">+ agregar</Button>
              </div>
            </div>
          </Card>
        </Section>

        <SinEscalasRule from="campo" to="mesa" />
      </div>
    </main>
  )
}
