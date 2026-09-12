"use client"

import * as React from "react"
import {
  Plus,
  Trash2,
  UserPlus,
  UserCog,
  IdCard,
  Briefcase,
  HeartPulse,
  Landmark,
  FolderOpen,
  CircleDot,
  Wand2,
} from "lucide-react"

import type { Sede } from "@/lib/erp/api-inventory"
import {
  createEmployee,
  updateEmployee,
  type Employee,
  type EmployeeInput,
  type Position,
  type DocStatus,
  type EmpDocType,
  type ContractType,
  type EmployeeStatus,
  type Gender,
  type SalaryType,
  type ArlRiskLevel,
  type AccountType,
} from "@/lib/erp/api-employees"
import { getPayrollSettings } from "@/lib/erp/api-payroll"
import { ApiError } from "@/lib/api"

import { Button } from "@/components/ui/button"
import { Input, Textarea } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import {
  FormDialog,
  FormSection,
  FormAlert,
  FormActions,
} from "@/components/ui/form-dialog"
import {
  Field,
  FieldGrid,
  FieldSpan,
  NativeSelect,
} from "@/components/ui/field"

const DOC_TYPES: { value: EmpDocType; label: string }[] = [
  { value: "CC", label: "CC — Cédula de ciudadanía" },
  { value: "CE", label: "CE — Cédula de extranjería" },
  { value: "TI", label: "TI — Tarjeta de identidad" },
  { value: "PA", label: "PA — Pasaporte" },
  { value: "PEP", label: "PEP — Permiso especial" },
  { value: "NIT", label: "NIT — Empresa" },
]
const GENDERS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "O", label: "Otro" },
]
const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: "indefinido", label: "Término indefinido" },
  { value: "fijo", label: "Término fijo" },
  { value: "obra_labor", label: "Obra o labor" },
  { value: "aprendizaje", label: "Aprendizaje (SENA)" },
  { value: "prestacion_servicios", label: "Prestación de servicios" },
]
const SALARY_TYPES = [
  { value: "ordinario", label: "Ordinario" },
  { value: "integral", label: "Integral" },
]
const ARL_LEVELS: ArlRiskLevel[] = ["I", "II", "III", "IV", "V"]
/** Qué significa cada nivel, para que no haya que adivinar entre I y V. */
const ARL_LEVEL_LABELS: Record<ArlRiskLevel, string> = {
  I: "Nivel I — riesgo mínimo (oficina, caja)",
  II: "Nivel II — riesgo bajo",
  III: "Nivel III — riesgo medio (cocina, bodega)",
  IV: "Nivel IV — riesgo alto",
  V: "Nivel V — riesgo máximo (moto, altura)",
}
const ACCOUNT_TYPES = [
  { value: "ahorros", label: "Ahorros" },
  { value: "corriente", label: "Corriente" },
]
const STATUSES: { value: EmployeeStatus; label: string }[] = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
  { value: "retirado", label: "Retirado" },
]
const DOC_STATUSES: { value: DocStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "entregado", label: "Entregado" },
  { value: "vencido", label: "Vencido" },
]
const COMMON_DOCS = [
  "Contrato de trabajo",
  "Hoja de vida",
  "Fotocopia del documento",
  "Examen médico de ingreso",
  "Certificado de afiliación EPS",
  "Certificado de afiliación ARL",
  "Certificado de pensión (AFP)",
  "Certificado de cesantías",
  "Antecedentes judiciales",
  "Certificación bancaria",
]

interface DocRow {
  type: string
  number: string
  issueDate: string
  expiryDate: string
  status: DocStatus
  note: string
}

interface Form {
  docType: EmpDocType
  docNumber: string
  firstName: string
  lastName: string
  birthDate: string
  gender: string
  phone: string
  email: string
  address: string
  city: string
  emergencyContactName: string
  emergencyContactPhone: string
  positionId: string
  sedeId: string
  contractType: ContractType
  hireDate: string
  endDate: string
  salary: string
  salaryType: string
  workSchedule: string
  eps: string
  afp: string
  arl: string
  arlRiskLevel: string
  compensationFund: string
  severanceFund: string
  bank: string
  accountType: string
  accountNumber: string
  status: EmployeeStatus
  terminationDate: string
  terminationReason: string
  notes: string
}

function blankForm(): Form {
  return {
    docType: "CC",
    docNumber: "",
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    positionId: "",
    sedeId: "",
    contractType: "indefinido",
    hireDate: "",
    endDate: "",
    salary: "",
    salaryType: "",
    workSchedule: "",
    eps: "",
    afp: "",
    arl: "",
    arlRiskLevel: "",
    compensationFund: "",
    severanceFund: "",
    bank: "",
    accountType: "",
    accountNumber: "",
    status: "activo",
    terminationDate: "",
    terminationReason: "",
    notes: "",
  }
}

function fromEmployee(e: Employee): Form {
  return {
    docType: e.docType,
    docNumber: e.docNumber,
    firstName: e.firstName,
    lastName: e.lastName,
    birthDate: e.birthDate ?? "",
    gender: e.gender ?? "",
    phone: e.phone ?? "",
    email: e.email ?? "",
    address: e.address ?? "",
    city: e.city ?? "",
    emergencyContactName: e.emergencyContactName ?? "",
    emergencyContactPhone: e.emergencyContactPhone ?? "",
    positionId: e.positionId ?? "",
    sedeId: e.sedeId ?? "",
    contractType: e.contractType,
    hireDate: e.hireDate ?? "",
    endDate: e.endDate ?? "",
    salary: e.salary != null ? String(e.salary) : "",
    salaryType: e.salaryType ?? "",
    workSchedule: e.workSchedule ?? "",
    eps: e.eps ?? "",
    afp: e.afp ?? "",
    arl: e.arl ?? "",
    arlRiskLevel: e.arlRiskLevel ?? "",
    compensationFund: e.compensationFund ?? "",
    severanceFund: e.severanceFund ?? "",
    bank: e.bank ?? "",
    accountType: e.accountType ?? "",
    accountNumber: e.accountNumber ?? "",
    status: e.status,
    terminationDate: e.terminationDate ?? "",
    terminationReason: e.terminationReason ?? "",
    notes: e.notes ?? "",
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Error desconocido"
}

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
})

/**
 * Ficha de alta y edición de empleado.
 *
 * Los seis bloques no son decorativos: responden a las seis preguntas que se
 * hacen por separado al contratar (quién es, en qué condiciones entra, a qué
 * entidades está afiliado, dónde se le paga, qué papeles entregó y en qué
 * estado está). Antes era una sola columna de cuarenta campos en un cajón
 * lateral; no había forma de saber por dónde ibas.
 */
export function EmployeeDialog({
  open,
  employee,
  positions,
  sedes,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  employee: Employee | null
  positions: Position[]
  sedes: Sede[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = React.useState<Form>(blankForm)
  const [docs, setDocs] = React.useState<DocRow[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // Salario mínimo legal vigente (SMMLV), tomado de los parámetros de nómina.
  // Habilita el botón para llenar el salario con un clic. Se carga la primera
  // vez que se abre el formulario.
  const [smmlv, setSmmlv] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!open || smmlv != null) return
    let active = true
    getPayrollSettings()
      .then((s) => {
        if (active) setSmmlv(s.smmlv)
      })
      .catch(() => {
        // Sin parámetros de nómina el botón queda deshabilitado; no es crítico.
      })
    return () => {
      active = false
    }
  }, [open, smmlv])

  // Reinicia el formulario cada vez que se abre.
  React.useEffect(() => {
    if (!open) return
    setError(null)
    if (employee) {
      setForm(fromEmployee(employee))
      setDocs(
        employee.documents.map((d) => ({
          type: d.type,
          number: d.number ?? "",
          issueDate: d.issueDate ?? "",
          expiryDate: d.expiryDate ?? "",
          status: d.status,
          note: d.note ?? "",
        })),
      )
    } else {
      setForm(blankForm())
      setDocs([])
    }
  }, [open, employee])

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addDoc() {
    setDocs((prev) => [
      ...prev,
      {
        type: "",
        number: "",
        issueDate: "",
        expiryDate: "",
        status: "pendiente",
        note: "",
      },
    ])
  }

  function setDoc(i: number, patch: Partial<DocRow>) {
    setDocs((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  }

  function removeDoc(i: number) {
    setDocs((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function submit() {
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.docNumber.trim()
    ) {
      setError("Nombre, apellido y documento son obligatorios.")
      return
    }
    setSaving(true)
    setError(null)
    const isRetired = form.status === "retirado"
    const payload: EmployeeInput = {
      docType: form.docType,
      docNumber: form.docNumber.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      birthDate: form.birthDate,
      gender: (form.gender || undefined) as Gender | undefined,
      phone: form.phone,
      email: form.email,
      address: form.address,
      city: form.city,
      emergencyContactName: form.emergencyContactName,
      emergencyContactPhone: form.emergencyContactPhone,
      positionId: form.positionId,
      sedeId: form.sedeId,
      contractType: form.contractType,
      hireDate: form.hireDate,
      endDate: form.endDate,
      salary: form.salary ? Number(form.salary) : undefined,
      salaryType: (form.salaryType || undefined) as SalaryType | undefined,
      workSchedule: form.workSchedule,
      eps: form.eps,
      afp: form.afp,
      arl: form.arl,
      arlRiskLevel: (form.arlRiskLevel || undefined) as ArlRiskLevel | undefined,
      compensationFund: form.compensationFund,
      severanceFund: form.severanceFund,
      bank: form.bank,
      accountType: (form.accountType || undefined) as AccountType | undefined,
      accountNumber: form.accountNumber,
      documents: docs
        .filter((d) => d.type.trim())
        .map((d) => ({
          type: d.type.trim(),
          number: d.number || undefined,
          issueDate: d.issueDate || undefined,
          expiryDate: d.expiryDate || undefined,
          status: d.status,
          note: d.note || undefined,
        })),
      status: form.status,
      terminationDate: isRetired ? form.terminationDate : undefined,
      terminationReason: isRetired ? form.terminationReason : undefined,
      notes: form.notes,
    }
    try {
      if (employee) await updateEmployee(employee._id, payload)
      else await createEmployee(payload)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const salaryNumber = form.salary ? Number(form.salary) : null

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="4xl"
      icon={employee ? UserCog : UserPlus}
      title={employee ? "Editar empleado" : "Nuevo empleado"}
      description={
        employee
          ? `${employee.firstName} ${employee.lastName} · ${employee.docType} ${employee.docNumber}`
          : "Datos personales, contratación, seguridad social y documentos. Solo nombre, apellido y documento son obligatorios; el resto se puede completar después."
      }
      footer={
        <FormActions
          onCancel={() => onOpenChange(false)}
          onSubmit={() => void submit()}
          busy={saving}
          icon={employee ? UserCog : UserPlus}
          submitLabel={employee ? "Guardar cambios" : "Crear empleado"}
        />
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      {/* ── Datos personales ─────────────────────────────────────── */}
      <FormSection
        icon={IdCard}
        title="Datos personales"
        description="Quién es la persona y cómo ubicarla."
      >
        <FieldGrid cols={3}>
          <Field
            id="emp-doctype"
            label="Tipo de documento"
            help={{ term: "tipoDocumento" }}
          >
            <NativeSelect
              id="emp-doctype"
              value={form.docType}
              onChange={(v) => set("docType", v as EmpDocType)}
              options={DOC_TYPES}
            />
          </Field>
          <FieldSpan span={2}>
            <Field id="emp-docnum" label="Número de documento" required>
              <Input
                id="emp-docnum"
                inputMode="numeric"
                value={form.docNumber}
                onChange={(e) => set("docNumber", e.target.value)}
                placeholder="1020304050"
              />
            </Field>
          </FieldSpan>

          <Field id="emp-first" label="Nombres" required>
            <Input
              id="emp-first"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="María Camila"
            />
          </Field>
          <Field id="emp-last" label="Apellidos" required>
            <Input
              id="emp-last"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              placeholder="Restrepo Gómez"
            />
          </Field>
          <Field id="emp-birth" label="Fecha de nacimiento">
            <Input
              id="emp-birth"
              type="date"
              value={form.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
            />
          </Field>

          <Field id="emp-gender" label="Género">
            <NativeSelect
              id="emp-gender"
              value={form.gender}
              onChange={(v) => set("gender", v)}
              options={GENDERS}
              placeholder="Sin especificar"
            />
          </Field>
          <Field id="emp-phone" label="Teléfono">
            <Input
              id="emp-phone"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="300 123 4567"
            />
          </Field>
          <Field id="emp-email" label="Correo">
            <Input
              id="emp-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="nombre@correo.com"
            />
          </Field>

          <FieldSpan span={2}>
            <Field id="emp-address" label="Dirección">
              <Input
                id="emp-address"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Cra 45 # 12-30"
              />
            </Field>
          </FieldSpan>
          <Field id="emp-city" label="Ciudad">
            <Input
              id="emp-city"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Medellín"
            />
          </Field>

          <FieldSpan span={2}>
            <Field
              id="emp-emergency"
              label="Contacto de emergencia"
              hint="A quién llamamos si le pasa algo en el turno."
            >
              <Input
                id="emp-emergency"
                value={form.emergencyContactName}
                onChange={(e) => set("emergencyContactName", e.target.value)}
                placeholder="Nombre y parentesco"
              />
            </Field>
          </FieldSpan>
          <Field id="emp-emergency-tel" label="Tel. de emergencia">
            <Input
              id="emp-emergency-tel"
              type="tel"
              inputMode="tel"
              value={form.emergencyContactPhone}
              onChange={(e) => set("emergencyContactPhone", e.target.value)}
              placeholder="301 987 6543"
            />
          </Field>
        </FieldGrid>
      </FormSection>

      {/* ── Contratación ─────────────────────────────────────────── */}
      <FormSection
        icon={Briefcase}
        title="Contratación"
        description="En qué condiciones entra y cuánto se le paga."
      >
        <FieldGrid cols={3}>
          <Field id="emp-position" label="Cargo" help={{ term: "cargo" }}>
            <NativeSelect
              id="emp-position"
              value={form.positionId}
              onChange={(v) => set("positionId", v)}
              options={positions.map((p) => ({ value: p._id, label: p.name }))}
              placeholder="Sin cargo"
            />
          </Field>
          <Field id="emp-sede" label="Sede" help={{ term: "sede" }}>
            <NativeSelect
              id="emp-sede"
              value={form.sedeId}
              onChange={(v) => set("sedeId", v)}
              options={sedes.map((s) => ({ value: s._id, label: s.name }))}
              placeholder="Sin sede"
            />
          </Field>
          <Field
            id="emp-contract"
            label="Tipo de contrato"
            help={
              form.contractType === "obra_labor"
                ? { term: "contratoObraLabor" }
                : form.contractType === "aprendizaje"
                  ? { term: "contratoAprendizaje" }
                  : undefined
            }
          >
            <NativeSelect
              id="emp-contract"
              value={form.contractType}
              onChange={(v) => set("contractType", v as ContractType)}
              options={CONTRACT_TYPES}
            />
          </Field>

          <Field id="emp-hire" label="Fecha de ingreso">
            <Input
              id="emp-hire"
              type="date"
              value={form.hireDate}
              onChange={(e) => set("hireDate", e.target.value)}
            />
          </Field>
          {/* Solo el contrato a término fijo tiene fecha de cierre. Pedirla en
              un indefinido invita a inventarse una. */}
          {form.contractType === "fijo" && (
            <Field
              id="emp-end"
              label="Fin de contrato"
              hint="Un término fijo necesita fecha de cierre."
            >
              <Input
                id="emp-end"
                type="date"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </Field>
          )}
          <Field id="emp-schedule" label="Jornada / horario">
            <Input
              id="emp-schedule"
              value={form.workSchedule}
              onChange={(e) => set("workSchedule", e.target.value)}
              placeholder="Lun-Sáb 8am-5pm"
            />
          </Field>
          <Field
            id="emp-salary-type"
            label="Tipo de salario"
            help={
              form.salaryType === "integral"
                ? { term: "salarioIntegral" }
                : undefined
            }
          >
            <NativeSelect
              id="emp-salary-type"
              value={form.salaryType}
              onChange={(v) => set("salaryType", v)}
              options={SALARY_TYPES}
              placeholder="Sin especificar"
            />
          </Field>

          <FieldSpan span={2}>
            <Field
              id="emp-salary"
              label="Salario mensual"
              help={{ term: "smmlv" }}
              hint={
                smmlv != null
                  ? `Mínimo legal vigente: ${copFormatter.format(smmlv)}.`
                  : undefined
              }
            >
              <div className="flex items-center gap-2">
                {/* `MoneyInput` pasa su className al input, no al envoltorio
                    posicionado, así que el flex-1 va en un div de fuera. */}
                <div className="min-w-0 flex-1">
                  <MoneyInput
                    id="emp-salary"
                    value={salaryNumber}
                    onValueChange={(v) =>
                      set("salary", v == null ? "" : String(v))
                    }
                    placeholder="0"
                  />
                </div>
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  className="shrink-0"
                  disabled={smmlv == null}
                  onClick={() => smmlv != null && set("salary", String(smmlv))}
                  title={
                    smmlv != null
                      ? `Poner el salario mínimo: ${copFormatter.format(smmlv)}`
                      : "Cargando el salario mínimo…"
                  }
                >
                  <Wand2 />
                  Mínimo
                </Button>
              </div>
            </Field>
          </FieldSpan>
        </FieldGrid>
      </FormSection>

      {/* ── Seguridad social ─────────────────────────────────────── */}
      <FormSection
        icon={HeartPulse}
        title="Seguridad social"
        description="Las entidades a las que hay que afiliarlo y reportarlo cada mes en la PILA."
      >
        <FieldGrid cols={3}>
          <Field id="emp-eps" label="EPS (salud)" help={{ term: "eps" }}>
            <Input
              id="emp-eps"
              value={form.eps}
              onChange={(e) => set("eps", e.target.value)}
              placeholder="Sura, Sanitas, Nueva EPS…"
            />
          </Field>
          <Field id="emp-afp" label="Fondo de pensión" help={{ term: "afp" }}>
            <Input
              id="emp-afp"
              value={form.afp}
              onChange={(e) => set("afp", e.target.value)}
              placeholder="Porvenir, Protección, Colpensiones…"
            />
          </Field>
          <Field id="emp-arl" label="ARL (riesgos)" help={{ term: "arl" }}>
            <Input
              id="emp-arl"
              value={form.arl}
              onChange={(e) => set("arl", e.target.value)}
              placeholder="Sura, Positiva, Colmena…"
            />
          </Field>

          <Field
            id="emp-arl-level"
            label="Nivel de riesgo"
            help={{ term: "nivelRiesgo" }}
          >
            <NativeSelect
              id="emp-arl-level"
              value={form.arlRiskLevel}
              onChange={(v) => set("arlRiskLevel", v)}
              options={ARL_LEVELS.map((r) => ({
                value: r,
                label: ARL_LEVEL_LABELS[r],
              }))}
              placeholder="Sin especificar"
            />
          </Field>
          <Field
            id="emp-ccf"
            label="Caja de compensación"
            help={{ term: "cajaCompensacion" }}
          >
            <Input
              id="emp-ccf"
              value={form.compensationFund}
              onChange={(e) => set("compensationFund", e.target.value)}
              placeholder="Comfama, Compensar, Comfenalco…"
            />
          </Field>
          <Field
            id="emp-severance"
            label="Fondo de cesantías"
            help={{ term: "fondoCesantias" }}
          >
            <Input
              id="emp-severance"
              value={form.severanceFund}
              onChange={(e) => set("severanceFund", e.target.value)}
              placeholder="Porvenir, Protección, FNA…"
            />
          </Field>
        </FieldGrid>
      </FormSection>

      {/* ── Datos bancarios ──────────────────────────────────────── */}
      <FormSection
        icon={Landmark}
        title="Datos bancarios"
        description="A dónde se le consigna la nómina."
      >
        <FieldGrid cols={3}>
          <Field id="emp-bank" label="Banco">
            <Input
              id="emp-bank"
              value={form.bank}
              onChange={(e) => set("bank", e.target.value)}
              placeholder="Bancolombia, Davivienda, Nequi…"
            />
          </Field>
          <Field id="emp-acct-type" label="Tipo de cuenta">
            <NativeSelect
              id="emp-acct-type"
              value={form.accountType}
              onChange={(v) => set("accountType", v)}
              options={ACCOUNT_TYPES}
              placeholder="Sin especificar"
            />
          </Field>
          <Field id="emp-acct" label="Número de cuenta">
            <Input
              id="emp-acct"
              inputMode="numeric"
              value={form.accountNumber}
              onChange={(e) => set("accountNumber", e.target.value)}
              placeholder="000-000000-00"
            />
          </Field>
        </FieldGrid>
      </FormSection>

      {/* ── Documentos ───────────────────────────────────────────── */}
      <FormSection
        icon={FolderOpen}
        title="Documentos y certificados"
        description="El contrato, los exámenes médicos y las afiliaciones que ya entregó."
        boxed
        action={
          <Button type="button" variant="outline" size="sm" onClick={addDoc}>
            <Plus />
            Agregar
          </Button>
        }
      >
        <datalist id="common-docs">
          {COMMON_DOCS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>

        {docs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-6 text-center text-xs text-muted-foreground">
            Sin documentos todavía. Agrega el contrato, el examen médico de
            ingreso o los certificados de afiliación.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {docs.map((d, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-3.5"
              >
                <FieldGrid cols={4}>
                  <FieldSpan span={2}>
                    <Field id={`doc-type-${i}`} label="Documento">
                      <Input
                        id={`doc-type-${i}`}
                        list="common-docs"
                        value={d.type}
                        placeholder="Contrato de trabajo"
                        onChange={(e) => setDoc(i, { type: e.target.value })}
                      />
                    </Field>
                  </FieldSpan>
                  <Field id={`doc-num-${i}`} label="N.º / referencia">
                    <Input
                      id={`doc-num-${i}`}
                      value={d.number}
                      onChange={(e) => setDoc(i, { number: e.target.value })}
                    />
                  </Field>
                  <Field id={`doc-status-${i}`} label="Estado">
                    <NativeSelect
                      id={`doc-status-${i}`}
                      value={d.status}
                      onChange={(v) => setDoc(i, { status: v as DocStatus })}
                      options={DOC_STATUSES}
                    />
                  </Field>
                  <Field id={`doc-issue-${i}`} label="Emisión">
                    <Input
                      id={`doc-issue-${i}`}
                      type="date"
                      value={d.issueDate}
                      onChange={(e) => setDoc(i, { issueDate: e.target.value })}
                    />
                  </Field>
                  <Field id={`doc-exp-${i}`} label="Vencimiento">
                    <Input
                      id={`doc-exp-${i}`}
                      type="date"
                      value={d.expiryDate}
                      onChange={(e) => setDoc(i, { expiryDate: e.target.value })}
                    />
                  </Field>
                  <FieldSpan span={2}>
                    <Field id={`doc-note-${i}`} label="Nota">
                      <div className="flex items-center gap-2">
                        <Input
                          id={`doc-note-${i}`}
                          value={d.note}
                          onChange={(e) => setDoc(i, { note: e.target.value })}
                          placeholder="Opcional"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Quitar documento"
                          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeDoc(i)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </Field>
                  </FieldSpan>
                </FieldGrid>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      {/* ── Estado ───────────────────────────────────────────────── */}
      <FormSection
        icon={CircleDot}
        title="Estado y notas"
        description="Si sigue trabajando, y cualquier cosa que valga la pena recordar."
      >
        <FieldGrid cols={3}>
          <Field id="emp-status" label="Estado del empleado">
            <NativeSelect
              id="emp-status"
              value={form.status}
              onChange={(v) => set("status", v as EmployeeStatus)}
              options={STATUSES}
            />
          </Field>
          {form.status === "retirado" && (
            <>
              <Field
                id="emp-term-date"
                label="Fecha de retiro"
                help={{ term: "liquidacion" }}
              >
                <Input
                  id="emp-term-date"
                  type="date"
                  value={form.terminationDate}
                  onChange={(e) => set("terminationDate", e.target.value)}
                />
              </Field>
              <Field id="emp-term-reason" label="Motivo de retiro">
                <Input
                  id="emp-term-reason"
                  value={form.terminationReason}
                  onChange={(e) => set("terminationReason", e.target.value)}
                  placeholder="Renuncia voluntaria"
                />
              </Field>
            </>
          )}
          <FieldSpan span={3}>
            <Field id="emp-notes" label="Notas">
              <Textarea
                id="emp-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Alergias, restricciones de horario, acuerdos puntuales…"
                className="min-h-16"
              />
            </Field>
          </FieldSpan>
        </FieldGrid>
      </FormSection>
    </FormDialog>
  )
}
