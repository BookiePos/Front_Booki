import { Factura } from "@/components/marketing/factura";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { fuenteTitular } from "@/components/marketing/fuentes-portada";
import { LineaDelDia } from "@/components/marketing/linea-del-dia";
import { MediosDePago } from "@/components/marketing/medios-de-pago";
import { Portada } from "@/components/marketing/portada";
import { Pricing } from "@/components/marketing/pricing";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";

/**
 * Portada. Fondo lila pálido, tinta marina y el orquídea del isotipo como
 * único color. El orden:
 *
 *   "BookiPos" gigante, por cuya letra se entra (portal) → adentro, la
 *   factura de la mesa 7 con lo que movió en el sistema → lo que duele con
 *   otros sistemas y cómo lo resuelve BookiPos (línea de tiempo) → medios de
 *   pago → precios → preguntas → cierre.
 *
 * La factura es de servidor y entra al portal (de cliente) como hijo.
 */
export default function HomePage() {
  return (
    <div className={`${fuenteTitular.variable} bg-mesa text-navy-950`}>
      <SiteNav />
      <main id="contenido">
        <Portada>
          <Factura />
        </Portada>
        <LineaDelDia />
        <MediosDePago />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
