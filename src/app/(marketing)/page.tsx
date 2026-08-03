import { Benefits } from "@/components/marketing/benefits";
import { Faq } from "@/components/marketing/faq";
import { Flow } from "@/components/marketing/flow";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { Modules } from "@/components/marketing/modules";
import { Pricing } from "@/components/marketing/pricing";
import { ScrollLogo } from "@/components/marketing/scroll-logo";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { WhatsNew } from "@/components/marketing/whats-new";

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main id="contenido">
        {/* La cortina de marca abre la página; el hero recoge justo después. */}
        <ScrollLogo />
        <Hero />
        <Benefits />
        <Flow />
        <Modules />
        <WhatsNew />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
