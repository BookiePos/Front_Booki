import { AppSidebar } from "@/components/erp/app-sidebar"
import { AppTopbar } from "@/components/erp/app-topbar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppTopbar />
        <main className="flex-1 bg-muted p-5 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
