"use client";

import * as React from "react";
import { API_URL } from "@/lib/env";

type Estado = "consultando" | "operativo" | "degradado" | "caido";

const TEXTO: Record<Estado, string> = {
  consultando: "Consultando…",
  operativo: "Operativo",
  degradado: "Con problemas",
  caido: "Sin servicio",
};

const COLOR: Record<Estado, string> = {
  consultando: "bg-ink-faint",
  operativo: "bg-success",
  degradado: "bg-warning",
  caido: "bg-destructive",
};

/**
 * Consulta `GET /health`. La base conecta de forma perezosa: una instancia
 * recién arrancada reporta `db: "connecting"` y eso no es una caída.
 */
async function consultar(): Promise<{ api: Estado; db: Estado }> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
    if (!res.ok) return { api: "degradado", db: "consultando" };
    const body = (await res.json()) as { status?: string; db?: string };
    const db: Estado =
      body.db === "connected" || body.db === "connecting"
        ? "operativo"
        : body.db === "disconnected"
          ? "degradado"
          : "consultando";
    return { api: body.status === "ok" ? "operativo" : "degradado", db };
  } catch {
    return { api: "caido", db: "consultando" };
  }
}

export function EstadoServicio() {
  const [estado, setEstado] = React.useState<{ api: Estado; db: Estado }>({
    api: "consultando",
    db: "consultando",
  });
  const [hora, setHora] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    const tick = async () => {
      const r = await consultar();
      if (!vivo) return;
      setEstado(r);
      setHora(new Date().toLocaleTimeString("es-CO"));
    };
    void tick();
    const id = setInterval(() => void tick(), 30_000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  const filas: [string, Estado][] = [
    ["Punto de venta y panel (API)", estado.api],
    ["Base de datos", estado.db],
  ];

  return (
    <div className="mt-8 rounded-2xl border border-hairline bg-white">
      <ul className="divide-y divide-hairline" aria-live="polite">
        {filas.map(([nombre, e]) => (
          <li key={nombre} className="flex items-center justify-between px-5 py-4">
            <span className="text-ink">{nombre}</span>
            <span className="flex items-center gap-2 text-sm font-medium text-ink-soft">
              <span aria-hidden="true" className={`size-2.5 rounded-full ${COLOR[e]}`} />
              {TEXTO[e]}
            </span>
          </li>
        ))}
      </ul>
      {hora && (
        <p className="border-t border-hairline px-5 py-3 text-sm text-ink-muted">
          Última consulta: {hora}
        </p>
      )}
    </div>
  );
}
