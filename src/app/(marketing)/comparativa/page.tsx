import type { Metadata } from "next";
import Link from "next/link";
import { BookiPosLogo } from "@/components/marketing/bookipos-logo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { COMPARATIVA, COMPETIDORES } from "@/lib/comparativa";

export const metadata: Metadata = {
  title: "BookiPos frente a Siigo, Alegra y Loggro",
  description:
    "Qué cambia con BookiPos: costo real por receta, compras por foto y punto de venta, inventario y contabilidad en un solo sistema.",
  alternates: { canonical: "/comparativa" },
};

/**
 * Comparativa pública (ítem 7.7). Solo afirma lo propio con seguridad; de la
 * competencia usa la fecha de la revisión y «Verifícalo en su sitio» cuando no
 * hay certeza. Los datos viven en `lib/comparativa.ts`.
 */
export default function ComparativaPage() {
  return (
    <>
      <header className="mx-auto flex max-w-5xl items-center px-5 py-6 sm:px-8">
        <Link href="/" aria-label="BookiPos — inicio">
          <BookiPosLogo />
        </Link>
      </header>
      <main id="contenido" className="mx-auto max-w-5xl px-5 pb-16 sm:px-8">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          BookiPos frente a Siigo, Alegra y Loggro
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-ink-muted">
          Son buenos programas y muchos negocios los usan. Aquí contamos en qué
          se diferencia BookiPos para un restaurante o comercio pequeño: tres
          cosas que normalmente toca resolver con otra herramienta.
        </p>

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {COMPARATIVA.diferenciales.map((d) => (
            <li
              key={d.titulo}
              className="rounded-2xl border border-hairline bg-brand-50/50 p-5"
            >
              <h2 className="text-lg font-bold text-ink">{d.titulo}</h2>
              <p className="mt-2 text-ink-soft">{d.texto}</p>
            </li>
          ))}
        </ul>

        <section className="mt-14" aria-labelledby="tabla">
          <h2 id="tabla" className="text-2xl font-bold text-ink">
            Capacidad por capacidad
          </h2>
          <p className="mt-2 text-ink-muted">
            Revisión según los sitios públicos de cada marca,{" "}
            {COMPARATIVA.fecha}.
          </p>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-hairline">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Comparación de capacidades entre BookiPos, Siigo, Alegra y
                Loggro
              </caption>
              <thead className="bg-brand-50 text-ink">
                <tr>
                  <th scope="col" className="p-3 font-bold">
                    Capacidad
                  </th>
                  <th scope="col" className="p-3 font-bold text-brand-700">
                    BookiPos
                  </th>
                  {COMPETIDORES.map((c) => (
                    <th key={c} scope="col" className="p-3 font-bold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARATIVA.filas.map((fila) => (
                  <tr key={fila.capacidad} className="border-t border-hairline">
                    <th scope="row" className="p-3 font-medium text-ink">
                      {fila.capacidad}
                    </th>
                    <td className="p-3 font-semibold text-brand-700">
                      {fila.bookipos}
                    </td>
                    {fila.otros.map((valor, i) => (
                      <td key={COMPETIDORES[i]} className="p-3 text-ink-soft">
                        {valor}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="descargo">
          <h2 id="descargo" className="text-lg font-bold text-ink">
            Nota importante
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-ink-muted">
            {COMPARATIVA.descargo}
          </p>
        </section>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/#precios"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-700 px-6 font-semibold text-white hover:bg-brand-800"
          >
            Ver planes
          </Link>
          <Link
            href="/#preguntas"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-hairline px-6 font-semibold text-ink hover:text-brand-700"
          >
            Preguntas frecuentes
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
