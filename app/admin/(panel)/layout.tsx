import { DATA_MODE } from "@/lib/env"
import { AdminProvider } from "@/components/admin/admin-provider"
import { AdminShell } from "@/components/admin/admin-shell"

/**
 * The panel renders as a client app. Access is enforced on the server: the
 * proxy redirects signed-out visitors, and every Server Action re-checks that
 * the user is an admin before reading or writing anything.
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider mode={DATA_MODE}>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  )
}
