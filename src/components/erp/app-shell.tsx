import { AppSidebar } from "@/components/erp/app-sidebar"
import { AppTopbar } from "@/components/erp/app-topbar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { OnboardingProvider } from "@/lib/onboarding/onboarding-context"
import { WelcomeDialog } from "@/components/onboarding/welcome-dialog"
import { ProductTour } from "@/components/onboarding/product-tour"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppTopbar />
          <main className="flex-1 bg-muted p-5 md:p-8">{children}</main>
        </SidebarInset>
        {/* Onboarding: bienvenida + tour interactivo (montados una sola vez). */}
        <WelcomeDialog />
        <ProductTour />
      </SidebarProvider>
    </OnboardingProvider>
  )
}
