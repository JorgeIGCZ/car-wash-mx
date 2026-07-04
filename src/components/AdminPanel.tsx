"use client";

import {
  FormEvent,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CalendarRange,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  HandCoins,
  KeyRound,
  PackagePlus,
  Plus,
  Save,
  Settings,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { WashHistory } from "@/components/WashHistory";
import { formatMoney } from "@/lib/format";
import type {
  BootstrapData,
  CommissionRuleOption,
  ServicePackageOption,
  ServicePriceOption,
  VehicleTypeOption,
} from "@/types/domain";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "ADMINISTRATIVE" | "EMPLOYEE";
  active: boolean;
  mustChangePassword: boolean;
  _count: { washesCreated: number; washParticipations: number };
};

type WorkWeekSettings = {
  startDay: number;
  endDay: number;
};

type Tab =
  | "HISTORY"
  | "PRICES"
  | "COMMISSIONS"
  | "CATALOG"
  | "USERS"
  | "SETTINGS";

const weekDays = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("HISTORY");
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [commissionRules, setCommissionRules] = useState<
    CommissionRuleOption[]
  >([]);
  const [settings, setSettings] = useState<WorkWeekSettings | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [
      catalogResponse,
      usersResponse,
      settingsResponse,
      commissionsResponse,
    ] = await Promise.all([
      fetch("/api/bootstrap", { cache: "no-store" }),
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/admin/settings", { cache: "no-store" }),
      fetch("/api/admin/commissions", { cache: "no-store" }),
    ]);
    if (catalogResponse.ok) setBootstrap(await catalogResponse.json());
    if (usersResponse.ok) setUsers(await usersResponse.json());
    if (settingsResponse.ok) setSettings(await settingsResponse.json());
    if (commissionsResponse.ok) {
      setCommissionRules(await commissionsResponse.json());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2200);
  }

  if (!bootstrap) return <div className="page-loading">Cargando administración…</div>;
  const canEdit = bootstrap.user.role === "ADMIN";

  return (
    <div className="admin-page">
      <PageHero title="Administración" eyebrow="TURBO WASH · CONFIGURACIÓN">
        <div className="admin-tabs">
          <button className={tab === "HISTORY" ? "selected" : ""} onClick={() => setTab("HISTORY")}>
            <ClipboardList size={18} /> Historial
          </button>
          <button className={tab === "PRICES" ? "selected" : ""} onClick={() => setTab("PRICES")}>
            <CircleDollarSign size={18} /> Precios
          </button>
          <button className={tab === "COMMISSIONS" ? "selected" : ""} onClick={() => setTab("COMMISSIONS")}>
            <HandCoins size={18} /> Comisiones
          </button>
          {canEdit && (
            <>
              <button className={tab === "CATALOG" ? "selected" : ""} onClick={() => setTab("CATALOG")}>
                <Settings size={18} /> Catálogo
              </button>
              <button className={tab === "USERS" ? "selected" : ""} onClick={() => setTab("USERS")}>
                <Users size={18} /> Usuarios
              </button>
              <button className={tab === "SETTINGS" ? "selected" : ""} onClick={() => setTab("SETTINGS")}>
                <CalendarRange size={18} /> Semana
              </button>
            </>
          )}
        </div>
      </PageHero>

      {message && <div className="admin-toast"><Check size={17} />{message}</div>}

      {tab === "HISTORY" && (
        <WashHistory embedded scope="ALL" users={users} />
      )}
      {tab === "PRICES" && (
        <PriceEditor
          packages={bootstrap.packages}
          vehicles={bootstrap.vehicleTypes}
          prices={bootstrap.prices}
          readOnly={!canEdit}
          onSaved={() => {
            flash("Precio actualizado");
            void load();
          }}
        />
      )}
      {tab === "COMMISSIONS" && (
        <CommissionEditor
          packages={bootstrap.packages}
          vehicles={bootstrap.vehicleTypes}
          users={users.filter(
            (user) => user.active && user.role !== "ADMINISTRATIVE",
          )}
          commissionRules={commissionRules}
          readOnly={!canEdit}
          onSaved={() => {
            flash("Comisión actualizada");
            void load();
          }}
        />
      )}
      {tab === "CATALOG" && (
        <CatalogEditor
          packages={bootstrap.packages}
          vehicles={bootstrap.vehicleTypes}
          reload={load}
          flash={flash}
        />
      )}
      {tab === "USERS" && (
        <UserEditor
          users={users}
          currentUserId={bootstrap.user.id}
          reload={load}
          flash={flash}
        />
      )}
      {tab === "SETTINGS" && settings && (
        <WorkWeekEditor settings={settings} reload={load} flash={flash} />
      )}
    </div>
  );
}

function WorkWeekEditor({
  settings,
  reload,
  flash,
}: {
  settings: WorkWeekSettings;
  reload: () => Promise<void>;
  flash: (text: string) => void;
}) {
  const [startDay, setStartDay] = useState(settings.startDay);
  const [endDay, setEndDay] = useState(settings.endDay);

  useEffect(() => {
    setStartDay(settings.startDay);
    setEndDay(settings.endDay);
  }, [settings]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDay, endDay }),
    });
    if (response.ok) {
      flash("Semana laboral actualizada");
      await reload();
    }
  }

  return (
    <section className="admin-section work-week-section">
      <div className="content-heading">
        <CalendarRange size={23} />
        <div>
          <h2>Semana laboral</h2>
          <p>Define qué días incluye el filtro semanal del historial.</p>
        </div>
      </div>
      <form className="work-week-form" onSubmit={save}>
        <label>
          Inicia
          <select value={startDay} onChange={(event) => setStartDay(Number(event.target.value))}>
            {weekDays.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
        </label>
        <label>
          Termina
          <select value={endDay} onChange={(event) => setEndDay(Number(event.target.value))}>
            {weekDays.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
        </label>
        <div className="week-preview">
          <span>El historial semanal mostrará</span>
          <strong>{weekDays[startDay]} a {weekDays[endDay]}</strong>
        </div>
        <button className="primary-button">
          <Save size={18} />
          Guardar semana laboral
        </button>
      </form>
    </section>
  );
}

function PriceEditor({
  packages,
  vehicles,
  prices,
  readOnly,
  onSaved,
}: {
  packages: ServicePackageOption[];
  vehicles: VehicleTypeOption[];
  prices: ServicePriceOption[];
  readOnly: boolean;
  onSaved: () => void;
}) {
  const activeVehicles = vehicles.filter(
    (vehicle) => vehicle.active && !vehicle.requiresCustom,
  );
  const serviceGroups = [
    {
      category: "NORMAL",
      label: "Servicio normal",
      description: "Lavado completo y exterior",
    },
    {
      category: "INTERIOR",
      label: "Servicio de interiores",
      description: "Limpieza de asientos, cielo y alfombra",
    },
  ]
    .map((group) => ({
      ...group,
      combinations: packages
        .filter(
          (item) =>
            item.active &&
            !item.requiresCustomPrice &&
            item.category === group.category,
        )
        .flatMap((item) =>
          activeVehicles.map((vehicle) => ({ item, vehicle })),
        ),
    }))
    .filter((group) => group.combinations.length > 0);
  const initialPriceValues = useMemo(
    () =>
      Object.fromEntries(
        prices.map((price) => [
          `${price.packageId}-${price.vehicleTypeId}`,
          String(price.amount),
        ]),
      ),
    [prices],
  );
  const [priceValues, setPriceValues] =
    useState<Record<string, string>>(initialPriceValues);

  useEffect(() => setPriceValues(initialPriceValues), [initialPriceValues]);

  async function savePrice(packageId: number, vehicleTypeId: number) {
    const key = `${packageId}-${vehicleTypeId}`;
    const amount = Number(priceValues[key]);
    if (Number.isNaN(amount) || amount < 0) return;
    const response = await fetch("/api/admin/prices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId, vehicleTypeId, amount }),
    });
    if (response.ok) onSaved();
  }

  return (
    <section className="admin-section">
      <div className="content-heading">
        <CircleDollarSign size={23} />
        <div>
          <h2>Precios por vehículo</h2>
          <p>
            Los precios libres se capturan al registrar. Los demás cambios se
            guardan al salir del campo.
          </p>
        </div>
      </div>
      <p className="price-free-note">
        Servicios especiales y el vehículo Especial conservan precio libre.
      </p>
      <div className="price-table-wrap">
        <table className="price-table">
          <thead>
            <tr>
              <th>Servicio</th>
              <th>Vehículo</th>
              <th>Precio</th>
            </tr>
          </thead>
          <tbody>
            {serviceGroups.map((group) => (
              <Fragment key={group.category}>
                <tr className="price-category-row">
                  <th colSpan={3}>
                    <span>{group.label}</span>
                    <small>{group.description}</small>
                  </th>
                </tr>
                {group.combinations.map(({ item, vehicle }) => {
                const priceKey = `${item.id}-${vehicle.id}`;
                return (
                  <tr key={`${item.id}-${vehicle.id}`}>
                    <th data-label="Servicio">
                      <span>{item.name}</span>
                      <small>
                        {item.category === "NORMAL"
                          ? "Normal"
                          : item.category === "INTERIOR"
                            ? "Interiores"
                            : "Especial"}
                      </small>
                    </th>
                    <td data-label="Vehículo">
                      <strong className="vehicle-name">{vehicle.name}</strong>
                    </td>
                    <td data-label="Precio">
                      <span className="compact-money">
                        $
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={priceValues[priceKey] ?? ""}
                          disabled={readOnly}
                          onChange={(event) =>
                            setPriceValues((current) => ({
                              ...current,
                              [priceKey]: event.target.value,
                            }))
                          }
                          onBlur={() => void savePrice(item.id, vehicle.id)}
                        />
                      </span>
                    </td>
                  </tr>
                );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type CommissionTarget =
  | {
      scope: "CATEGORY";
      category: "NORMAL" | "INTERIOR" | "SPECIAL";
      packageId?: never;
      vehicleTypeId?: never;
    }
  | {
      scope: "PACKAGE";
      packageId: number;
      category?: never;
      vehicleTypeId?: never;
    }
  | {
      scope: "VEHICLE_PACKAGE";
      packageId: number;
      vehicleTypeId: number;
      category?: never;
    };

type CommissionDraft = {
  type: "PERCENTAGE" | "FIXED";
  value: string;
};

function targetScopeKey(target: CommissionTarget) {
  if (target.scope === "CATEGORY") {
    return `category:${target.category}`;
  }
  if (target.scope === "VEHICLE_PACKAGE") {
    return `package:${target.packageId}:vehicle:${target.vehicleTypeId}`;
  }
  return `package:${target.packageId}`;
}

function CommissionEditor({
  packages,
  vehicles,
  users,
  commissionRules,
  readOnly,
  onSaved,
}: {
  packages: ServicePackageOption[];
  vehicles: VehicleTypeOption[];
  users: AdminUser[];
  commissionRules: CommissionRuleOption[];
  readOnly: boolean;
  onSaved: () => void;
}) {
  const activePackages = packages.filter((item) => item.active);
  const activeVehicles = vehicles.filter((item) => item.active);
  const interiorPackages = activePackages.filter(
    (item) => item.category === "INTERIOR",
  );
  const specialPackages = activePackages.filter(
    (item) => item.category === "SPECIAL",
  );
  const initialDrafts = useMemo(
    () =>
      Object.fromEntries(
        commissionRules.map((rule) => [
          `${rule.userId}-${rule.scopeKey}`,
          { type: rule.type, value: String(rule.value) },
        ]),
      ) as Record<string, CommissionDraft>,
    [commissionRules],
  );
  const [selectedUser, setSelectedUser] = useState(
    users[0] ? String(users[0].id) : "",
  );
  const [drafts, setDrafts] =
    useState<Record<string, CommissionDraft>>(initialDrafts);
  const [showExceptions, setShowExceptions] = useState(false);
  const [exceptionPackageId, setExceptionPackageId] = useState(
    activePackages[0] ? String(activePackages[0].id) : "",
  );
  const [exceptionVehicleId, setExceptionVehicleId] = useState(
    activeVehicles[0] ? String(activeVehicles[0].id) : "",
  );
  const [exceptionType, setExceptionType] =
    useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [exceptionValue, setExceptionValue] = useState("0");

  useEffect(() => setDrafts(initialDrafts), [initialDrafts]);
  useEffect(() => {
    if (!selectedUser && users[0]) setSelectedUser(String(users[0].id));
  }, [selectedUser, users]);

  function draftFor(target: CommissionTarget) {
    return (
      drafts[`${selectedUser}-${targetScopeKey(target)}`] ?? {
        type: "PERCENTAGE",
        value: "0",
      }
    );
  }

  function updateDraft(
    target: CommissionTarget,
    patch: Partial<CommissionDraft>,
  ) {
    const key = `${selectedUser}-${targetScopeKey(target)}`;
    setDrafts((current) => ({
      ...current,
      [key]: { ...draftFor(target), ...patch },
    }));
  }

  async function saveRule(
    target: CommissionTarget,
    typeOverride?: "PERCENTAGE" | "FIXED",
  ) {
    if (readOnly) return;
    const userId = Number(selectedUser);
    const draft = draftFor(target);
    const type = typeOverride ?? draft.type;
    const value = Number(draft.value);
    if (
      !userId ||
      Number.isNaN(value) ||
      value < 0 ||
      (type === "PERCENTAGE" && value > 100)
    ) {
      return;
    }
    const response = await fetch("/api/admin/commissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...target, type, value }),
    });
    if (response.ok) onSaved();
  }

  async function createException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const userId = Number(selectedUser);
    const packageId = Number(exceptionPackageId);
    const vehicleTypeId = Number(exceptionVehicleId);
    const value = Number(exceptionValue);
    if (
      !userId ||
      !packageId ||
      !vehicleTypeId ||
      Number.isNaN(value) ||
      value < 0 ||
      (exceptionType === "PERCENTAGE" && value > 100)
    ) {
      return;
    }
    const response = await fetch("/api/admin/commissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        scope: "VEHICLE_PACKAGE",
        packageId,
        vehicleTypeId,
        type: exceptionType,
        value,
      }),
    });
    if (response.ok) onSaved();
  }

  async function removeException(rule: CommissionRuleOption) {
    if (readOnly || !rule.packageId || !rule.vehicleTypeId) return;
    const response = await fetch("/api/admin/commissions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: rule.userId,
        scope: "VEHICLE_PACKAGE",
        packageId: rule.packageId,
        vehicleTypeId: rule.vehicleTypeId,
      }),
    });
    if (response.ok) onSaved();
  }

  const selectedUserId = Number(selectedUser);
  const exceptions = commissionRules.filter(
    (rule) =>
      rule.userId === selectedUserId &&
      rule.packageId !== null &&
      rule.vehicleTypeId !== null,
  );

  function ruleCard(
    title: string,
    description: string,
    target: CommissionTarget,
  ) {
    const draft = draftFor(target);
    return (
      <CommissionRuleCard
        key={targetScopeKey(target)}
        title={title}
        description={description}
        draft={draft}
        readOnly={readOnly || !selectedUser}
        onTypeChange={(type) => {
          updateDraft(target, { type });
          void saveRule(target, type);
        }}
        onValueChange={(value) => updateDraft(target, { value })}
        onSave={() => void saveRule(target)}
      />
    );
  }

  return (
    <section className="admin-section commission-editor">
      <div className="content-heading">
        <HandCoins size={23} />
        <div>
          <h2>Comisiones por trabajador</h2>
          <p>
            Las reglas generales reducen capturas repetidas. La ganancia real
            queda registrada en cada lavado.
          </p>
        </div>
      </div>

      <div className="commission-toolbar">
        <label>
          Trabajador
          <select
            value={selectedUser}
            onChange={(event) => setSelectedUser(event.target.value)}
          >
            {users.map((user) => (
              <option value={user.id} key={user.id}>
                {user.name} ·{" "}
                {user.role === "ADMIN" ? "Administrador" : "Encargado"}
              </option>
            ))}
          </select>
        </label>
        <p>
          {readOnly
            ? "Vista de consulta. Este perfil no puede modificar comisiones."
            : "Los cambios se guardan al salir del campo."}
        </p>
      </div>

      <div className="commission-rule-section">
        <div className="commission-section-heading">
          <div>
            <h3>Lavado normal</h3>
            <p>Una regla para completo y exterior, sin importar el vehículo.</p>
          </div>
          <span>1 regla</span>
        </div>
        <div className="commission-rule-grid single">
          {ruleCard(
            "Todos los lavados normales",
            "Completo y exterior · todos los vehículos",
            { scope: "CATEGORY", category: "NORMAL" },
          )}
        </div>
      </div>

      <div className="commission-rule-section">
        <div className="commission-section-heading">
          <div>
            <h3>Lavado de interiores</h3>
            <p>Una regla particular para cada servicio de interiores.</p>
          </div>
          <span>{interiorPackages.length} reglas</span>
        </div>
        <div className="commission-rule-grid">
          {interiorPackages.map((item) =>
            ruleCard(item.name, item.description ?? "Servicio de interiores", {
              scope: "PACKAGE",
              packageId: item.id,
            }),
          )}
        </div>
      </div>

      {specialPackages.length > 0 && (
        <div className="commission-rule-section">
          <div className="commission-section-heading">
            <div>
              <h3>Servicios especiales</h3>
              <p>La comisión se calcula sobre el precio libre registrado.</p>
            </div>
            <span>{specialPackages.length} reglas</span>
          </div>
          <div className="commission-rule-grid">
            {specialPackages.map((item) =>
              ruleCard(item.name, item.description ?? "Servicio especial", {
                scope: "PACKAGE",
                packageId: item.id,
              }),
            )}
          </div>
        </div>
      )}

      <div className="commission-exceptions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => setShowExceptions((current) => !current)}
        >
          <Plus size={17} />
          {showExceptions ? "Ocultar excepciones" : "Configurar excepción por vehículo"}
        </button>

        {showExceptions && (
          <form className="commission-exception-form" onSubmit={createException}>
            <label>
              Servicio
              <select
                value={exceptionPackageId}
                onChange={(event) => setExceptionPackageId(event.target.value)}
                disabled={readOnly}
              >
                {activePackages.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vehículo
              <select
                value={exceptionVehicleId}
                onChange={(event) => setExceptionVehicleId(event.target.value)}
                disabled={readOnly}
              >
                {activeVehicles.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select
                value={exceptionType}
                onChange={(event) =>
                  setExceptionType(
                    event.target.value as "PERCENTAGE" | "FIXED",
                  )
                }
                disabled={readOnly}
              >
                <option value="PERCENTAGE">Porcentaje</option>
                <option value="FIXED">Cantidad fija</option>
              </select>
            </label>
            <label>
              Valor
              <span className="commission-value-control">
                {exceptionType === "FIXED" && "$"}
                <input
                  type="number"
                  min="0"
                  max={exceptionType === "PERCENTAGE" ? 100 : 999999}
                  step="0.01"
                  value={exceptionValue}
                  onChange={(event) => setExceptionValue(event.target.value)}
                  disabled={readOnly}
                />
                {exceptionType === "PERCENTAGE" && "%"}
              </span>
            </label>
            <button className="primary-button" disabled={readOnly}>
              <Save size={17} /> Guardar excepción
            </button>
          </form>
        )}

        {exceptions.length > 0 && (
          <div className="commission-exception-list">
            {exceptions.map((rule) => {
              const servicePackage = packages.find(
                (item) => item.id === rule.packageId,
              );
              const vehicle = vehicles.find(
                (item) => item.id === rule.vehicleTypeId,
              );
              return (
                <div key={rule.id}>
                  <span>
                    <b>{servicePackage?.name ?? "Servicio"}</b>
                    {vehicle?.name ?? "Vehículo"}
                  </span>
                  <strong>
                    {rule.type === "PERCENTAGE"
                      ? `${rule.value}%`
                      : formatMoney(rule.value)}
                  </strong>
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label="Eliminar excepción"
                      onClick={() => void removeException(rule)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function CommissionRuleCard({
  title,
  description,
  draft,
  readOnly,
  onTypeChange,
  onValueChange,
  onSave,
}: {
  title: string;
  description: string;
  draft: CommissionDraft;
  readOnly: boolean;
  onTypeChange: (type: "PERCENTAGE" | "FIXED") => void;
  onValueChange: (value: string) => void;
  onSave: () => void;
}) {
  const numericValue = Number(draft.value || 0);
  return (
    <article className="commission-rule-card">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <label>
        Tipo
        <span className="commission-type-control">
          <select
            className="commission-type"
            value={draft.type}
            disabled={readOnly}
            onChange={(event) =>
              onTypeChange(event.target.value as "PERCENTAGE" | "FIXED")
            }
          >
            <option value="PERCENTAGE">Porcentaje</option>
            <option value="FIXED">Cantidad fija</option>
          </select>
          <ChevronDown aria-hidden="true" size={17} strokeWidth={2} />
        </span>
      </label>
      <label>
        Valor
        <span className="commission-value-control">
          {draft.type === "FIXED" && "$"}
          <input
            type="number"
            min="0"
            max={draft.type === "PERCENTAGE" ? 100 : 999999}
            step="0.01"
            value={draft.value}
            disabled={readOnly}
            onChange={(event) => onValueChange(event.target.value)}
            onBlur={onSave}
          />
          {draft.type === "PERCENTAGE" && "%"}
        </span>
      </label>
      <small>
        {draft.type === "PERCENTAGE"
          ? `${numericValue}% del precio · el negocio conserva ${Math.max(0, 100 - numericValue)}% antes de otras comisiones`
          : `${formatMoney(numericValue)} por lavado`}
      </small>
    </article>
  );
}

function CatalogEditor({
  packages,
  vehicles,
  reload,
  flash,
}: {
  packages: ServicePackageOption[];
  vehicles: VehicleTypeOption[];
  reload: () => Promise<void>;
  flash: (text: string) => void;
}) {
  async function patch(path: string, body: object, message: string) {
    const response = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      flash(message);
      await reload();
    }
  }

  async function addPackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        category: form.get("category"),
        description: form.get("description"),
        requiresCustomPrice: form.get("customPrice") === "on",
        requiresDescription: form.get("customDescription") === "on",
      }),
    });
    if (response.ok) {
      event.currentTarget.reset();
      flash("Paquete agregado");
      await reload();
    }
  }

  async function addVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/vehicle-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        requiresCustom: form.get("requiresCustom") === "on",
      }),
    });
    if (response.ok) {
      event.currentTarget.reset();
      flash("Tipo de vehículo agregado");
      await reload();
    }
  }

  return (
    <div className="catalog-columns">
      <section className="admin-section">
        <div className="content-heading">
          <PackagePlus size={23} />
          <div><h2>Paquetes</h2><p>Edita el nombre, descripción y disponibilidad.</p></div>
        </div>
        <div className="catalog-list">
          {packages.map((item) => (
            <CatalogRow
              key={item.id}
              title={item.name}
              subtitle={item.description ?? "Sin descripción"}
              category={item.category}
              active={item.active}
              onSave={(name, description) =>
                patch("/api/admin/packages", { id: item.id, name, description }, "Paquete actualizado")
              }
              onToggle={() =>
                patch("/api/admin/packages", { id: item.id, active: !item.active }, "Disponibilidad actualizada")
              }
            />
          ))}
        </div>
        <form className="inline-create-form" onSubmit={addPackage}>
          <h3>Agregar paquete</h3>
          <input name="name" placeholder="Nombre del paquete" required />
          <input name="description" placeholder="Descripción breve" />
          <select name="category" defaultValue="NORMAL">
            <option value="NORMAL">Lavado normal</option>
            <option value="INTERIOR">Lavado de interiores</option>
            <option value="SPECIAL">Servicio especial</option>
          </select>
          <label className="check-field"><input type="checkbox" name="customPrice" /> Precio libre</label>
          <label className="check-field"><input type="checkbox" name="customDescription" /> Solicitar información</label>
          <button className="secondary-button"><PackagePlus size={18} />Agregar</button>
        </form>
      </section>

      <section className="admin-section">
        <div className="content-heading">
          <Settings size={23} />
          <div><h2>Tipos de vehículo</h2><p>Configura las opciones visibles al encargado.</p></div>
        </div>
        <div className="catalog-list">
          {vehicles.map((item) => (
            <CatalogRow
              key={item.id}
              title={item.name}
              subtitle={item.requiresCustom ? "Precio libre" : "Precio de catálogo"}
              active={item.active}
              onSave={(name) =>
                patch("/api/admin/vehicle-types", { id: item.id, name }, "Vehículo actualizado")
              }
              onToggle={() =>
                patch("/api/admin/vehicle-types", { id: item.id, active: !item.active }, "Disponibilidad actualizada")
              }
            />
          ))}
        </div>
        <form className="inline-create-form" onSubmit={addVehicle}>
          <h3>Agregar tipo</h3>
          <input name="name" placeholder="Nombre del vehículo" required />
          <label className="check-field"><input type="checkbox" name="requiresCustom" /> Precio libre</label>
          <button className="secondary-button"><PackagePlus size={18} />Agregar</button>
        </form>
      </section>
    </div>
  );
}

function CatalogRow({
  title,
  subtitle,
  category,
  active,
  onSave,
  onToggle,
}: {
  title: string;
  subtitle: string;
  category?: string;
  active: boolean;
  onSave: (name: string, description: string) => void;
  onToggle: () => void;
}) {
  const [name, setName] = useState(title);
  const [description, setDescription] = useState(subtitle === "Sin descripción" ? "" : subtitle);

  useEffect(() => {
    setName(title);
    setDescription(subtitle === "Sin descripción" ? "" : subtitle);
  }, [subtitle, title]);

  return (
    <div className={`catalog-row ${active ? "" : "inactive"}`}>
      <div className="catalog-fields">
        <input value={name} onChange={(e) => setName(e.target.value)} />
        {category && <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" />}
        {category && <small>{category === "NORMAL" ? "Normal" : category === "INTERIOR" ? "Interiores" : "Especial"}</small>}
      </div>
      <button className="icon-button" title="Guardar" onClick={() => onSave(name, description)}>
        <Save size={18} />
      </button>
      <button className={`status-toggle ${active ? "active" : ""}`} onClick={onToggle}>
        {active ? "Activo" : "Inactivo"}
      </button>
    </div>
  );
}

function UserEditor({
  users,
  currentUserId,
  reload,
  flash,
}: {
  users: AdminUser[];
  currentUserId: number;
  reload: () => Promise<void>;
  flash: (text: string) => void;
}) {
  async function update(body: object) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (response.ok) {
      flash("Usuario actualizado");
      await reload();
      return true;
    }
    flash(result.error ?? "No fue posible actualizar el usuario");
    return false;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: form.get("role"),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      flash(result.error ?? "No fue posible crear el usuario");
      return;
    }
    event.currentTarget.reset();
    flash("Usuario creado");
    await reload();
  }

  return (
    <div className="user-admin-grid">
      <section className="admin-section">
        <div className="content-heading">
          <Users size={23} />
          <div><h2>Usuarios</h2><p>Administra permisos y acceso.</p></div>
        </div>
        <div className="admin-user-list">
          {users.map((user) => (
            <article className={user.active ? "" : "inactive"} key={user.id}>
              <div className="small-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
              <div className="admin-user-info">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <small>{user._count.washesCreated} lavados registrados</small>
                {user.mustChangePassword && <small className="password-status">Cambio de contraseña pendiente</small>}
              </div>
              <select value={user.role} onChange={(e) => void update({ id: user.id, role: e.target.value })}>
                <option value="EMPLOYEE">Encargado</option>
                <option value="ADMINISTRATIVE">Administrativo</option>
                <option value="ADMIN">Administrador</option>
              </select>
              <button className={`status-toggle ${user.active ? "active" : ""}`} onClick={() => void update({ id: user.id, active: !user.active })}>
                {user.active ? "Activo" : "Inactivo"}
              </button>
              {user.id !== currentUserId && (
                <ResetPasswordForm
                  onReset={(password) => update({ id: user.id, password })}
                />
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <div className="content-heading">
          <UserPlus size={23} />
          <div><h2>Nuevo usuario</h2><p>Crea una cuenta para un encargado o administrador.</p></div>
        </div>
        <form className="stack-form" onSubmit={create}>
          <label>Nombre<input name="name" required /></label>
          <label>Correo<input name="email" type="email" required /></label>
          <label>Contraseña temporal<input name="password" type="password" minLength={10} required /></label>
          <p className="password-hint">El usuario deberá reemplazarla cuando inicie sesión.</p>
          <label>
            Rol
            <select name="role" defaultValue="EMPLOYEE">
              <option value="EMPLOYEE">Encargado</option>
              <option value="ADMINISTRATIVE">Administrativo</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
          <button className="primary-button"><UserPlus size={18} />Crear usuario</button>
        </form>
      </section>
    </div>
  );
}

function ResetPasswordForm({
  onReset,
}: {
  onReset: (password: string) => Promise<boolean>;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const saved = await onReset(password);
    if (saved) setPassword("");
    setSaving(false);
  }

  return (
    <form className="admin-password-reset" onSubmit={submit}>
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        minLength={10}
        placeholder="Nueva contraseña temporal"
        autoComplete="new-password"
        required
      />
      <button className="secondary-button" disabled={saving}>
        <KeyRound size={16} />
        {saving ? "Guardando…" : "Restablecer"}
      </button>
    </form>
  );
}
