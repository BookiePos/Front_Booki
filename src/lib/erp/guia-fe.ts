import type { EmisorVista } from "@/lib/erp/api-einvoicing"
import type { PasoAsistente } from "@/lib/erp/asistente-fe"

/**
 * Guía para el dueño del negocio: qué hay que hacer FUERA de BookiPos (comprar
 * el certificado, registrarse en la DIAN) para destrabar cada paso del asistente.
 * Fuente: `Backend/docs/RUNBOOK-FACTURA-ELECTRONICA.md` §1 y §3. Los menús exactos
 * del portal de la DIAN no están confirmados (se confirman en la habilitación del
 * piloto), así que aquí se nombran de forma genérica.
 */
export interface GuiaPaso {
  /** Texto del desplegable. */
  titulo: string
  /** Lo que hace el negocio, en orden. */
  pasos: string[]
  /** Lo que hace BookiPos después, sin que el negocio intervenga. */
  bookipos?: string
  /** Advertencia o dato para no perder de vista. */
  nota?: string
}

/** Entidades de certificación digital (ECD) que BookiPos reconoce al validar el .p12. */
export const ENTIDADES_CERTIFICACION = ["Certicámara", "GSE", "Andes SCD"] as const

type EmisorGuia = Pick<
  EmisorVista,
  "nit" | "nitDv" | "tipoPersona" | "tieneCertificado" | "certificadoVigente" | "certAviso" | "habilitado" | "tipoAmbiente"
>

const nitTexto = (e: EmisorGuia | null): string =>
  e?.nit ? `el NIT ${e.nit}${e.nitDv ? `-${e.nitDv}` : ""}` : "el NIT de la sede"

/** Qué tipo de certificado pedir según sea persona natural o jurídica. */
export function tipoCertificado(tipoPersona: string | undefined): string {
  if (tipoPersona === "juridica") {
    return "Pide el certificado de «persona jurídica» (algunas entidades lo venden como «facturación electrónica»), a nombre de la empresa."
  }
  if (tipoPersona === "natural") {
    return "Pide el certificado para «facturación electrónica» de persona natural, a tu nombre."
  }
  return "Pide el certificado para «facturación electrónica»: de «persona jurídica» si el negocio es una empresa, o de persona natural si facturas a tu nombre."
}

function guiaCertificado(e: EmisorGuia | null, renovar: boolean): GuiaPaso {
  const entidades = ENTIDADES_CERTIFICACION.join(", ")
  return {
    titulo: renovar ? "Cómo renovar el certificado" : "Cómo conseguir el certificado",
    pasos: [
      `${renovar ? "Compra el nuevo certificado" : "Cómpralo"} a una entidad de certificación digital acreditada por ONAC (por ejemplo ${entidades}).`,
      tipoCertificado(e?.tipoPersona),
      `Debe quedar con ${nitTexto(e)}: si el NIT del certificado es otro, BookiPos lo rechaza.`,
      "Pide que te lo entreguen como archivo .p12 (también llamado PFX), no en token físico ni USB: BookiPos firma desde la nube y necesita el archivo.",
      "Guarda la contraseña que te den: sin ella el archivo no abre y hay que pedir otro.",
      renovar
        ? "Sube aquí el archivo nuevo con su contraseña. El anterior sigue firmando hasta que el nuevo pase la validación."
        : "Sube aquí el archivo con su contraseña.",
    ],
    bookipos:
      "BookiPos revisa que el certificado abra con la contraseña, esté vigente y sea del NIT de la sede, y guarda la contraseña cifrada.",
    nota: renovar
      ? "Un certificado vencido deja de firmar: no se puede emitir hasta subir uno vigente."
      : "Se renueva cada año (o según la vigencia que compres). BookiPos te avisa 30 días antes de que venza.",
  }
}

/**
 * La guía de un paso del asistente, o `null` si ese paso no necesita nada de
 * afuera en su estado actual. Función pura: la pantalla solo pinta el resultado.
 */
export function guiaPaso(paso: PasoAsistente, emisor: EmisorGuia | null): GuiaPaso | null {
  switch (paso.id) {
    case "datos":
      return null

    case "registro":
      if (paso.estado === "hecho") return null
      return {
        titulo: "Cómo registrarse en la DIAN",
        pasos: [
          "Entra al portal de habilitación de facturación electrónica de la DIAN con el usuario de la empresa (lo hace el representante legal o quien tenga su firma).",
          "Regístrate como facturador electrónico y elige el modo «software propio». No elijas un proveedor tecnológico: BookiPos funciona como el software de tu negocio.",
          "Registra el software con el nombre BookiPos y define un PIN. Anótalo: la DIAN no lo vuelve a mostrar y BookiPos lo necesita.",
          "Copia el SoftwareID (identificador del software) y el TestSetId (identificador del set de pruebas) que te entrega el portal.",
          "Pega SoftwareID, PIN y TestSetId más abajo, en «Credenciales del software de factura».",
          "Si tienes empleados, repite el registro para nómina electrónica: tiene su propio SoftwareID, PIN y TestSetId, que van en la tarjeta «Nómina electrónica» de esta sede.",
          "Si el portal te pide registrar aparte el documento equivalente POS (el tiquete de caja), haz lo mismo y guarda esos datos.",
        ],
        nota: "Los nombres de los menús del portal pueden cambiar; si no encuentras una opción, busca «habilitación» y «software propio».",
      }

    case "certificado": {
      if (!emisor?.tieneCertificado) return guiaCertificado(emisor, false)
      if (!emisor.certificadoVigente || emisor.certAviso) return guiaCertificado(emisor, true)
      return null
    }

    case "credenciales":
      if (paso.estado === "hecho" && paso.detalle === "") return null
      return {
        titulo: "Dónde salen estos datos",
        pasos: [
          "Los tres salen del portal de habilitación de la DIAN, al registrar BookiPos como software propio.",
          "SoftwareID: el identificador que la DIAN le da al software registrado.",
          "PIN: el que tú definiste al registrar el software.",
          "TestSetId: el identificador del set de pruebas de factura. Sin él BookiPos no puede correr las pruebas.",
        ],
        nota: "Los de nómina electrónica son otros y van en la tarjeta «Nómina electrónica»: no los mezcles con los de factura.",
      }

    case "resolucion":
      if (paso.estado !== "pendiente") return null
      return {
        titulo: "Cómo conseguir la resolución",
        pasos: [
          "Pide a la DIAN la resolución de numeración (el rango de números autorizado) para cada tipo de documento que vayas a emitir: factura, documento POS y notas.",
          "En el portal de facturación electrónica, asocia cada prefijo de esa resolución al software BookiPos.",
          "En BookiPos, entra a Resoluciones y usa «Traer rangos de la DIAN» para cargar el número, el rango, la vigencia y la clave técnica. También puedes escribirlos a mano.",
        ],
        nota: "El documento POS y las notas necesitan un prefijo propio, distinto al de la factura. Pide la renovación antes de que el rango se agote o venza.",
      }

    case "pruebas":
      if (paso.estado === "hecho") return null
      return {
        titulo: "Qué pasa con el set de pruebas",
        pasos: [
          "No tienes que armar facturas de prueba: solo deja guardados el certificado, el SoftwareID, el PIN y el TestSetId.",
          "La DIAN exige que el software envíe un grupo de documentos de prueba (facturas y notas) antes de dejarte facturar.",
        ],
        bookipos:
          "BookiPos envía esos documentos a la DIAN en el ambiente de pruebas, sin tocar tu numeración ni tus ventas reales, y sigue el resultado. Cuando la DIAN lo aprueba, este paso queda en «Hecho».",
      }

    case "produccion":
      if (paso.estado === "hecho" || !emisor?.habilitado) return null
      return {
        titulo: "Cómo pasar a producción",
        pasos: [
          "Con el set de pruebas aprobado, pide en la DIAN la resolución de numeración real y asóciala al software BookiPos.",
          "Regístrala en BookiPos, en Resoluciones.",
          "Avisa al soporte de BookiPos para activar el ambiente de producción de la sede.",
        ],
        bookipos:
          "BookiPos solo emite facturas reales cuando la sede está habilitada, en producción y con resolución real. Conviene empezar con pocas ventas.",
      }
  }
}
