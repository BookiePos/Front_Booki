import { EntradaAlDia } from "@/components/marketing/entrada-al-dia";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { fuenteTirilla } from "@/components/marketing/fuente-tirilla";
import { Hero } from "@/components/marketing/hero";
import { LineaDelDia } from "@/components/marketing/linea-del-dia";
import { MediosDePago } from "@/components/marketing/medios-de-pago";
import { Pricing } from "@/components/marketing/pricing";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";

/**
 * Portada. Papel gris claro, tinta marina y el orquídea del isotipo como único
 * color. El orden:
 *
 *   tirilla del cobro (hero) → "BookiPos" gigante, por cuya letra se entra
 *   (portal) → un día de trabajo con una pantalla en cada hito (línea) →
 *   medios de pago → precios → preguntas → cierre.
 *
 * `--font-mono` se redefine aquí para que `font-mono` sea la letra de caja de
 * la portada (JetBrains Mono) sin tocar la del panel ni la del POS.
 */
export default function HomePage() {
  return (
    <div
      className={`${fuenteTirilla.variable} bg-mesa text-navy-950`}
      style={
        {
          "--font-mono": "var(--font-portada-mono), ui-monospace, monospace",
        } as React.CSSProperties
      }
    >
      <SiteNav />
      <main id="contenido">
        <Hero />
        <EntradaAlDia />
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
