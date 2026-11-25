import { AppSidebar } from "@/components/erp/app-sidebar"
import { AppTopbar } from "@/components/erp/app-topbar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { OnboardingProvider } from "@/lib/onboarding/onboarding-context"
import { AvisoFiscalPanel } from "@/components/onboarding/aviso-fiscal"
import { WelcomeDialog } from "@/components/onboarding/welcome-dialog"
import { ProductTour } from "@/components/onboarding/product-tour"
import { GuideAutoStart } from "@/components/onboarding/guide-autostart"
import { FondoLibro } from "@/components/ui/fondo-libro"
import { TituloPestana } from "@/components/ui/titulo-pestana"
import { PanelAyuda } from "@/components/ayuda/panel-ayuda"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <SidebarProvider>
        <AppSidebar />
        {/*
          `min-w-0` es la pieza clave de todo el responsive del panel.
          `SidebarInset` es un flex item en fila: por defecto `min-width: auto`
          lo obliga a ser al menos tan ancho como su contenido más ancho. Como
          el panel está lleno de tablas de 8-12 columnas con `whitespace-nowrap`,
          el inset crecía hasta el ancho de la tabla y arrastraba el documento
          entero: medido en el laboratorio, 791px de scroll horizontal a 390px
          y 1238px a 1024px. Con `min-w-0` el inset se queda en el ancho
          disponible y el `overflow-x-auto` que ya trae `<Table>` por fin puede
          hacer su trabajo: scrollea la tabla, no la página.
        */}
        {/* `isolate`: el fondo (z-index negativo) queda dentro de este bloque,
            encima de su color base y debajo del contenido. */}
        <SidebarInset className="isolate min-w-0">
          <FondoLibro />
          <TituloPestana zona="panel" />
          <PanelAyuda />
          <AppTopbar />
          {/*
            Era un <main> anidado dentro del <main> que ya renderiza
            `SidebarInset`: HTML inválido y dos landmarks para el lector de
            pantalla. Aquí solo hace falta el contenedor de relleno.
            Padding menor en móvil: cada 4px de padding lateral son 8px menos
            de tabla, y a 390px eso se nota.
          */}
          <div className="mx-auto w-full max-w-[1320px] min-w-0 flex-1 px-4 pt-5 pb-16 sm:px-6 md:px-8 md:pt-7">
            <AvisoFiscalPanel />
            {children}
          </div>
        </SidebarInset>
        {/* Onboarding: bienvenida + tour interactivo (montados una sola vez). */}
        <WelcomeDialog />
        <ProductTour />
        <GuideAutoStart />
      </SidebarProvider>
    </OnboardingProvider>
  )
}
