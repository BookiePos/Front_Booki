/**
 * Zona pública (portada). No lleva `RequireAuth`: es la única parte del sitio
 * que se ve sin sesión.
 *
 * El fondo se pinta aquí y no en el <body> porque el body lo comparten las tres
 * zonas: el ERP y el POS son grafito sobre papel cálido y la web pública es
 * violeta sobre blanco. Cada una manda en su propio contenedor.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="zone-marketing min-h-svh bg-surface text-ink">{children}</div>
  );
}
