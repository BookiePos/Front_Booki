import { describe, expect, it } from "vitest"
import {
  actorCanGrant,
  actorCanGrantSede,
  actorSeesAllSedes,
  permsAllowOperation,
  permsAllowPos,
  roleFitsArea,
  type Actor,
} from "./access"

/**
 * Qué zona ve cada quien y qué puede repartir. Es espejo de lo que el backend
 * rechaza con 403: si se desalinea, la pantalla ofrece botones que fallan.
 */
const actor = (over: Partial<Actor> = {}): Actor => ({
  id: "u1",
  role: "admin",
  permissions: [],
  sedeIds: ["s1"],
  ...over,
})

describe("zonas por permisos", () => {
  it("el POS necesita pos.sell y la operación cualquier permiso de back-office", () => {
    expect(permsAllowPos(["pos.sell"])).toBe(true)
    expect(permsAllowPos(["inventory.view"])).toBe(false)
    expect(permsAllowOperation(["payroll.view"])).toBe(true)
    expect(permsAllowOperation(["pos.sell", "caja.open"])).toBe(false)
    expect(roleFitsArea(["pos.sell"], "pos")).toBe(true)
    expect(roleFitsArea(["pos.sell"], "operacion")).toBe(false)
  })
})

describe("jerarquía", () => {
  it("el Dueño ve todas las sedes y concede cualquier permiso", () => {
    const duena = actor({ role: "owner" })
    expect(actorSeesAllSedes(duena)).toBe(true)
    expect(actorCanGrant(duena, "billing.manage")).toBe(true)
    expect(actorCanGrantSede(duena, "otra")).toBe(true)
  })

  it("los demás solo conceden lo que tienen y reparten sus sedes", () => {
    const admin = actor({ permissions: ["users.manage"] })
    expect(actorSeesAllSedes(admin)).toBe(false)
    expect(actorCanGrant(admin, "users.manage")).toBe(true)
    expect(actorCanGrant(admin, "billing.manage")).toBe(false)
    expect(actorCanGrantSede(admin, "s1")).toBe(true)
    expect(actorCanGrantSede(admin, "s2")).toBe(false)
    expect(actorSeesAllSedes(actor({ permissions: ["sede.view_all"] }))).toBe(true)
  })
})
