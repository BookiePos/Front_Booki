import { AuthProvider } from "@/lib/auth-context"

/**
 * Zonas con sesión: /login, /invitacion, /panel y /pos.
 *
 * `AuthProvider` vive aquí y NO en el layout raíz. Puesto en la raíz, la
 * portada pública —que no tiene nada que autenticar— arrastraba el contexto de
 * sesión y el cliente de API en su primera carga.
 *
 * Y vive en UN layout compartido por las cuatro rutas, no en cada una: así
 * pasar de /login a /panel o de /panel a /pos no lo desmonta, y no se repite
 * la llamada de rehidratación `apiMe` en cada salto.
 */
export default function SecureLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthProvider>{children}</AuthProvider>
}
