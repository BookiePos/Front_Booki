/**
 * Formulario oficial de Wompi para capturar la tarjeta (widget en modo
 * `tokenize`). Antes pedíamos número, fecha y CVC con inputs propios: aceptaban
 * cualquier cantidad de dígitos y el dato de la tarjeta pasaba por nuestra
 * página. El widget valida la tarjeta con las reglas de Wompi, corre en su
 * propio modal y solo nos devuelve el `tok_...` para crear la fuente de pago.
 */

const WIDGET_SRC = "https://checkout.wompi.co/widget.js"

export interface WompiPaymentSource {
  token: string
  type: string
}

interface WidgetCheckoutInstance {
  open(callback: (result: { payment_source?: WompiPaymentSource }) => void): void
}

declare global {
  interface Window {
    WidgetCheckout?: new (config: {
      publicKey: string
      widgetOperation: "tokenize"
    }) => WidgetCheckoutInstance
  }
}

let loading: Promise<void> | null = null

/** Carga `widget.js` una sola vez por pestaña, aunque se abra varias veces. */
function loadWidget(): Promise<void> {
  if (window.WidgetCheckout) return Promise.resolve()
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script")
      script.src = WIDGET_SRC
      script.async = true
      script.onload = () =>
        window.WidgetCheckout
          ? resolve()
          : reject(new Error("El formulario de Wompi no respondió."))
      script.onerror = () => {
        // Se permite reintentar: un fallo de red no debe dejar la página sin
        // forma de pagar hasta recargar.
        loading = null
        script.remove()
        reject(new Error("No se pudo cargar el formulario seguro de Wompi. Revisa tu conexión e inténtalo de nuevo."))
      }
      document.head.appendChild(script)
    })
  }
  return loading
}

/**
 * Abre el modal de Wompi para registrar la tarjeta. `onToken` solo se llama si
 * la persona completa el formulario: si cierra el modal, Wompi no avisa, por
 * eso no se modela como una promesa que quedaría colgada.
 */
export async function openCardTokenizer(
  publicKey: string,
  onToken: (source: WompiPaymentSource) => void,
): Promise<void> {
  await loadWidget()
  const WidgetCheckout = window.WidgetCheckout
  if (!WidgetCheckout) throw new Error("El formulario de Wompi no respondió.")
  const checkout = new WidgetCheckout({ publicKey, widgetOperation: "tokenize" })
  checkout.open((result) => {
    const source = result?.payment_source
    if (source?.token) onToken(source)
  })
}
