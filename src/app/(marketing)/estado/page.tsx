import type { Metadata } from "next";
import Link from "next/link";
import { BookiPosLogo } from "@/components/marketing/bookipos-logo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { enlaceWhatsapp, SOPORTE } from "@/lib/soporte";
import { EstadoServicio } from "./estado-servicio";

export const metadata: Metadata = {
  title: "Estado del servicio",
  description:
    "Estado en vivo de BookiPos y cómo contactar al equipo de soporte.",
};

/**
 * Página de estado y soporte (ítem 2.12). El estado se consulta en vivo desde
 * el navegador contra `/health` del API; los canales salen de `lib/soporte`.
 */
export default function EstadoPage() {
  const whatsapp = enlaceWhatsapp();
  return (
    <>
      <header className="mx-auto flex max-w-3xl items-center px-5 py-6 sm:px-8">
        <Link href="/" aria-label="BookiPos — inicio">
          <BookiPosLogo />
        </Link>
      </header>
      <main id="contenido" className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Estado del servicio
        </h1>
        <p className="mt-2 text-ink-muted">
          Se consulta en vivo cada 30 segundos.
        </p>

        <EstadoServicio />

        <section className="mt-12" aria-labelledby="soporte">
          <h2 id="soporte" className="text-xl font-bold text-ink">
            ¿Necesitas ayuda?
          </h2>
          <ul className="mt-4 space-y-2 text-ink-soft">
            {whatsapp && (
              <li>
                WhatsApp:{" "}
                <a href={whatsapp} className="font-medium text-brand-700 underline">
                  escríbenos
                </a>
              </li>
            )}
            <li>
              Correo:{" "}
              <a
                href={`mailto:${SOPORTE.email}`}
                className="font-medium text-brand-700 underline"
              >
                {SOPORTE.email}
              </a>
            </li>
            {SOPORTE.horario && <li>Horario: {SOPORTE.horario}</li>}
            {SOPORTE.tiempoRespuesta && <li>{SOPORTE.tiempoRespuesta}</li>}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
