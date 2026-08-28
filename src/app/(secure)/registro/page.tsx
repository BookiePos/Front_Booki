"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useId, useState } from "react";
import {
  Eye,
  EyeOff,
  LayoutDashboard,
  LoaderCircle,
  ShoppingBag,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";
import { AuthBrandPanel } from "@/components/auth/brand-panel";
import { BookiPosLogo } from "@/components/marketing/bookipos-logo";
import { ZoneLink } from "@/components/marketing/zone-link";
import {
  ApiError,
  BusinessPlan,
  BusinessType,
  RegisterPayload,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const PLANS: Record<BusinessPlan, { name: string; blurb: string }> = {
  punto: {
    name: "Punto",
    blurb: "Un local: vender y cuadrar caja.",
  },
  negocio: {
    name: "Negocio",
    blurb: "Compras, restaurante y flujo de caja.",
  },
  control: {
    name: "Control",
    blurb: "Contabilidad, estados y nómina.",
  },
  cadena: {
    name: "Cadena",
    blurb: "Varias sedes con consolidado.",
  },
};

const RESPONSABILIDAD_FISCAL: { value: string; label: string }[] = [
  { value: "responsable_iva", label: "Responsable de IVA" },
  { value: "no_responsable_iva", label: "No responsable de IVA" },
  { value: "regimen_simple", label: "Régimen simple" },
  { value: "gran_contribuyente", label: "Gran contribuyente" },
];

function RegistroForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { register, hasPermission, user } = useAuth();

  const planParam = params.get("plan");
  const initialPlan: BusinessPlan =
    planParam === "punto" ||
    planParam === "negocio" ||
    planParam === "control" ||
    planParam === "cadena"
      ? planParam
      : "negocio";

  const [plan, setPlan] = useState<BusinessPlan>(initialPlan);
  const [tipoNegocio, setTipoNegocio] = useState<BusinessType>("restaurante");

  const [businessName, setBusinessName] = useState("");
  const [nit, setNit] = useState("");
  const [nitDv, setNitDv] = useState("");
  const [responsabilidadFiscal, setResponsabilidadFiscal] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [emailFacturacion, setEmailFacturacion] = useState("");

  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!businessName.trim()) {
      setError("Escribe el nombre de tu negocio.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    const clean = (v: string) => {
      const t = v.trim();
      return t.length > 0 ? t : undefined;
    };

    const payload: RegisterPayload = {
      businessName: businessName.trim(),
      plan,
      tipoNegocio,
      nit: clean(nit),
      nitDv: clean(nitDv),
      responsabilidadFiscal: clean(responsabilidadFiscal) as
        | RegisterPayload["responsabilidadFiscal"],
      ciudad: clean(ciudad),
      departamento: clean(departamento),
      address: clean(address),
      phone: clean(phone),
      emailFacturacion: clean(emailFacturacion),
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim(),
      password,
    };

    setPending(true);
    try {
      await register(payload);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No hay conexión con el servidor de BookiPos. Verifica tu internet e intenta de nuevo.",
      );
    } finally {
      setPending(false);
    }
  }

  const canPos = hasPermission("pos.sell");
  const canPanel = [
    "reports.view",
    "finance.view",
    "inventory.view",
    "users.manage",
  ].some((permission) => hasPermission(permission));

  return (
    <main className="zone-marketing grid min-h-svh bg-surface text-ink lg:grid-cols-[1fr_1.1fr]">
      {/* Panel de marca: solo en ≥lg. Se queda a la vista mientras el
          formulario baja, con su propia deriva. Ver `auth/brand-panel`. */}
      <AuthBrandPanel
        titulo="Tu negocio, listo para vender en minutos."
        bajada="Crea la cuenta y empieza los 14 días de prueba. Sin tarjeta. Tu caja, tu inventario y tu factura DIAN, desde el primer día."
      />

      <div className="flex items-start justify-center overflow-y-auto px-5 py-14 sm:px-10">
        <div className="w-full max-w-lg">
          <Link
            href="/"
            className="inline-block lg:hidden"
            aria-label="BookiPos — inicio"
          >
            <BookiPosLogo />
          </Link>

          {!done ? (
            <>
              <h1 className="mt-10 font-display text-4xl font-semibold text-ink lg:mt-0">
                Crea tu negocio
              </h1>
              <p className="mt-3 leading-relaxed text-ink-muted">
                ¿Ya tienes cuenta?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800"
                >
                  Inicia sesión
                </Link>
                .
              </p>

              <form onSubmit={onSubmit} className="mt-8 space-y-8" noValidate>
                {/* Plan */}
                <section className="space-y-3">
                  <SectionTitle>Plan</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(PLANS) as BusinessPlan[]).map((key) => (
                      <ChoiceCard
                        key={key}
                        active={plan === key}
                        onClick={() => setPlan(key)}
                        title={PLANS[key].name}
                        body={PLANS[key].blurb}
                      />
                    ))}
                  </div>
                </section>

                {/* Negocio */}
                <section className="space-y-4">
                  <SectionTitle>Tu negocio</SectionTitle>

                  <div className="grid grid-cols-2 gap-3">
                    <ChoiceCard
                      active={tipoNegocio === "restaurante"}
                      onClick={() => setTipoNegocio("restaurante")}
                      icon={<UtensilsCrossed className="size-5" aria-hidden />}
                      title="Restaurante"
                      body="Mesas, comandas y propina."
                    />
                    <ChoiceCard
                      active={tipoNegocio === "retail"}
                      onClick={() => setTipoNegocio("retail")}
                      icon={<ShoppingBag className="size-5" aria-hidden />}
                      title="Retail / tienda"
                      body="Código de barras y variantes."
                    />
                  </div>

                  <Field
                    label="Nombre del negocio"
                    value={businessName}
                    onChange={setBusinessName}
                    placeholder="Tu marca comercial"
                    required
                    autoComplete="organization"
                  />

                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <Field
                      label="NIT / identificación"
                      value={nit}
                      onChange={setNit}
                      placeholder="900123456"
                      optional
                    />
                    <Field
                      label="DV"
                      value={nitDv}
                      onChange={setNitDv}
                      placeholder="7"
                      optional
                      className="w-20"
                    />
                  </div>

                  <SelectField
                    label="Responsabilidad fiscal"
                    value={responsabilidadFiscal}
                    onChange={setResponsabilidadFiscal}
                    optional
                    options={RESPONSABILIDAD_FISCAL}
                    placeholder="Selecciona…"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Ciudad"
                      value={ciudad}
                      onChange={setCiudad}
                      placeholder="Bogotá"
                      optional
                    />
                    <Field
                      label="Departamento"
                      value={departamento}
                      onChange={setDepartamento}
                      placeholder="Cundinamarca"
                      optional
                    />
                  </div>

                  <Field
                    label="Dirección"
                    value={address}
                    onChange={setAddress}
                    placeholder="Calle 123 #45-67"
                    optional
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Teléfono"
                      value={phone}
                      onChange={setPhone}
                      placeholder="3001234567"
                      optional
                      inputMode="tel"
                    />
                    <Field
                      label="Correo de facturación"
                      value={emailFacturacion}
                      onChange={setEmailFacturacion}
                      placeholder="facturas@negocio.com"
                      optional
                      type="email"
                      inputMode="email"
                    />
                  </div>
                </section>

                {/* Dueño */}
                <section className="space-y-4">
                  <SectionTitle>Tu cuenta (dueño)</SectionTitle>

                  <Field
                    label="Tu nombre"
                    value={ownerName}
                    onChange={setOwnerName}
                    placeholder="Juan García"
                    required
                    autoComplete="name"
                  />
                  <Field
                    label="Correo electrónico"
                    value={ownerEmail}
                    onChange={setOwnerEmail}
                    placeholder="tu@negocio.com"
                    required
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-ink">
                        Contraseña
                      </label>
                      <div className="relative mt-2">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="h-13 w-full rounded-xl border border-hairline bg-white px-4 pr-13 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
                        >
                          <span className="sr-only">
                            {showPassword
                              ? "Ocultar contraseña"
                              : "Mostrar contraseña"}
                          </span>
                          {showPassword ? (
                            <EyeOff className="size-5" aria-hidden="true" />
                          ) : (
                            <Eye className="size-5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                    <Field
                      label="Confirmar contraseña"
                      value={confirm}
                      onChange={setConfirm}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </section>

                <div aria-live="polite">
                  {error && (
                    <p
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                    >
                      {error}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-base font-semibold text-white transition-[background-image,transform] duration-150 hover:from-brand-700 hover:to-brand-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending && (
                    <LoaderCircle
                      className="size-5 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {pending ? "Creando tu negocio…" : "Crear negocio y empezar"}
                </button>

                <p className="text-center text-xs leading-relaxed text-ink-muted">
                  14 días de prueba sin tarjeta. Al continuar aceptas los
                  términos y la política de datos de BookiPos.
                </p>
              </form>
            </>
          ) : (
            <div>
              <h1 className="font-display text-4xl font-semibold text-ink">
                ¡Listo, {user?.name.split(" ")[0] ?? ""}!
              </h1>
              <p className="mt-3 leading-relaxed text-ink-muted">
                Tu {tipoNegocio === "retail" ? "tienda" : "restaurante"}{" "}
                <strong>{businessName}</strong> ya está{" "}
                {tipoNegocio === "retail" ? "creada" : "creado"}. ¿Por dónde
                quieres empezar?
              </p>

              <div className="mt-8 space-y-3">
                {plan === "punto" ? (
                  <>
                    {canPos && (
                      <ZoneLink
                        href="/pos"
                        onNavigate={router.push}
                        icon={<ShoppingCart className="size-6" aria-hidden />}
                        title="Punto de venta"
                        body="Vender, cobrar, abrir y cerrar caja."
                      />
                    )}
                    {canPanel && (
                      <ZoneLink
                        href="/panel"
                        onNavigate={router.push}
                        icon={<LayoutDashboard className="size-6" aria-hidden />}
                        title="Panel de operación"
                        body="Inventario, cartera, nómina y reportes."
                      />
                    )}
                  </>
                ) : (
                  <>
                    {canPanel && (
                      <ZoneLink
                        href="/panel"
                        onNavigate={router.push}
                        icon={<LayoutDashboard className="size-6" aria-hidden />}
                        title="Panel de operación"
                        body="Inventario, cartera, nómina y reportes."
                      />
                    )}
                    {canPos && (
                      <ZoneLink
                        href="/pos"
                        onNavigate={router.push}
                        icon={<ShoppingCart className="size-6" aria-hidden />}
                        title="Punto de venta"
                        body="Vender, cobrar, abrir y cerrar caja."
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-brand-700">
      {children}
    </h2>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  optional = false,
  autoComplete,
  inputMode,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  className?: string;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between text-sm font-semibold text-ink"
      >
        {label}
        {optional && (
          <span className="text-xs font-normal text-ink-faint">opcional</span>
        )}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-2 h-13 w-full rounded-xl border border-hairline bg-white px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-500 ${className ?? ""}`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  optional?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between text-sm font-semibold text-ink"
      >
        {label}
        {optional && (
          <span className="text-xs font-normal text-ink-faint">opcional</span>
        )}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-13 w-full rounded-xl border border-hairline bg-white px-4 text-base text-ink outline-none transition-colors focus:border-brand-500"
      >
        <option value="">{placeholder ?? "Selecciona…"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  body,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-full flex-col rounded-2xl border p-4 text-left transition-colors ${
        active
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-300"
          : "border-hairline bg-white hover:border-brand-300"
      }`}
    >
      {icon && (
        <span
          className={`mb-2 inline-flex size-9 items-center justify-center rounded-lg ${
            active ? "bg-brand-100 text-brand-700" : "bg-surface-soft text-ink-muted"
          }`}
        >
          {icon}
        </span>
      )}
      <span className="font-semibold text-ink">{title}</span>
      <span className="mt-0.5 text-sm text-ink-muted">{body}</span>
    </button>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={null}>
      <RegistroForm />
    </Suspense>
  );
}
