import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Fija la raíz del workspace a esta app para evitar la advertencia por
  // múltiples lockfiles detectados en directorios superiores.
  turbopack: {
    root: path.join(__dirname),
  },

  experimental: {
    /**
     * 61 archivos importan del barril de `lucide-react`, que reexporta más de
     * mil iconos. Sin esto, el bundler recorre el barril entero en cada uno;
     * con esto reescribe cada import a su módulo concreto.
     *
     * `@base-ui/react` es el otro barril grande: lo usan todos los componentes
     * de shadcn del ERP y del POS.
     */
    optimizePackageImports: ["lucide-react", "@base-ui/react"],
  },

  /**
   * Cabeceras de seguridad. Ahora que las tres zonas comparten origen, una
   * sola política cubre la web pública, el panel y el POS.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
