import { Plus } from "lucide-react";
import { FAQS } from "@/lib/site";
import { SOPORTE, enlaceWhatsapp } from "@/lib/soporte";

/**
 * Acordeón nativo con <details>/<summary>: accesible por teclado y operable
 * sin JavaScript. No hay razón para reimplementarlo con estado en React.
 *
 * El contacto sale de `lib/soporte`: WhatsApp solo si el dueño configuró el
 * número; si no, el correo de ventas.
 */
export function Faq() {
  const whatsapp = enlaceWhatsapp("Hola, tengo una pregunta sobre BookiPos");

  return (
    <section id="preguntas" aria-labelledby="preguntas-heading" className="border-t border-navy-950/15 bg-mesa py-24 sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[24rem_1fr] lg:gap-20">
        <div>
          <h2
            id="preguntas-heading"
            className="font-titular text-[clamp(2.25rem,4.4vw,4rem)] leading-[1] font-semibold tracking-[-0.045em] text-balance text-navy-950"
          >
            Lo que todos preguntan
          </h2>
          <a
            href={whatsapp ?? `mailto:${SOPORTE.ventas}`}
            className="mt-8 inline-flex min-h-11 items-center font-semibold text-navy-950 underline decoration-navy-950/30 underline-offset-4 hover:text-brand-700 hover:decoration-current"
            {...(whatsapp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {whatsapp ? "¿Falta la tuya? Escríbenos por WhatsApp" : `¿Falta la tuya? ${SOPORTE.ventas}`}
          </a>
        </div>

        <div className="border-t border-navy-950/25">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group border-b border-navy-950/20">
              {/* Toda la fila es el objetivo táctil, no solo el icono. */}
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left [&::-webkit-details-marker]:hidden">
                <span className="font-titular text-pretty text-lg font-medium leading-snug tracking-[-0.01em] text-navy-950 transition-colors group-hover:text-brand-700">
                  {faq.q}
                </span>
                <Plus
                  className="size-5 shrink-0 text-navy-950 transition-transform duration-200 group-open:rotate-45"
                  aria-hidden="true"
                />
              </summary>
              <p className="max-w-2xl text-pretty pb-7 leading-relaxed text-navy-950/75">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
