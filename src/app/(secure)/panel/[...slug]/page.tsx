import { notFound } from "next/navigation"

// Captura cualquier URL inexistente bajo /panel. Sin esto Next la manda al 404
// raíz y el `not-found.tsx` de la zona nunca se muestra: ese solo aparece
// cuando algo llama a `notFound()`. Tiene la prioridad más baja, así que no
// tapa ninguna ruta definida.
export default function PanelCatchAll() {
  notFound()
}
