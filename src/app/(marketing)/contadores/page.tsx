import type { Metadata } from "next";
import Link from "next/link";
import { BookiPosLogo } from "@/components/marketing/bookipos-logo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CONTADORES } from "@/lib/contadores";
import { SOPORTE } from "@/lib/soporte";

export const metadata: Metadata = {
  title: "BookiPos para contadores",
  description:
    "Acceso de solo lectura para el contador de tu cliente: libro, reportes, compras, gastos y nómina, sin pedir exportes.",
  alternates: { canonical: "/contadores" },
};

/**
 * Programa para contadores (ítem 7.8). Los textos viven en `lib/contadores.ts`
 * y describen el rol de sistema «Contador»: solo lectura sobre lo contable.
 */
export default function ContadoresPage() {
  const { demo } = CONTADORES;
  const mailto = `mailto:${SOPORTE.ventas}?subject=${encodeURIComponent(demo.asunto)}&body=${encodeURIComponent(demo.cuerpo)}`;
  return (
    <>
      <header className="mx-auto flex max-w-5xl items-center px-5 py-6 sm:px-8">
        <Link href="/" aria-label="BookiPos — inicio">
          <BookiPosLogo />
        </Link>
      </header>
      <main id="contenido" className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {CONTADORES.titulo}
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-ink-muted">
          {CONTADORES.intro}
        </p>

        <section className="mt-12 grid gap-6 md:grid-cols-2" aria-label="Alcance del acceso">
          <div className="rounded-2xl border border-hairline bg-brand-50/50 p-6">
            <h2 className="text-xl font-bold text-ink">Qué ve el contador</h2>
            <ul className="mt-4 space-y-2 text-ink-soft">
              {CONTADORES.ve.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-hairline p-6">
            <h2 className="text-xl font-bold text-ink">Qué no puede hacer</h2>
            <ul className="mt-4 space-y-2 text-ink-soft">
              {CONTADORES.noHace.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </section>
        <p className="mt-4 max-w-3xl text-sm text-ink-muted">{CONTADORES.nota}</p>

        <section className="mt-14" aria-labelledby="como">
          <h2 id="como" className="text-2xl font-bold text-ink">
            Cómo te invita tu cliente
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {CONTADORES.pasos.map((p, i) => (
              <li key={p.titulo} className="rounded-2xl border border-hairline p-5">
                <p className="text-sm font-bold text-brand-700">Paso {i + 1}</p>
                <h3 className="mt-1 text-lg font-bold text-ink">{p.titulo}</h3>
                <p className="mt-2 text-ink-soft">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 rounded-2xl bg-brand-50 p-6 sm:p-8" aria-labelledby="demo">
          <h2 id="demo" className="text-2xl font-bold text-ink">
            {demo.titulo}
          </h2>
          <p className="mt-2 max-w-2xl text-ink-soft">{demo.texto}</p>
          <a
            href={mailto}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-brand-700 px-6 font-semibold text-white hover:bg-brand-800"
          >
            Pedir una demo
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
