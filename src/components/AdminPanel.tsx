"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Check,
  CircleDollarSign,
  KeyRound,
  PackagePlus,
  Save,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHero } from "@/components/PageHero";
import type {
  BootstrapData,
  ServicePackageOption,
  ServicePriceOption,
  VehicleTypeOption,
} from "@/types/domain";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  active: boolean;
  mustChangePassword: boolean;
  _count: { washesCreated: number; washParticipations: number };
};

type WorkWeekSettings = {
  startDay: number;
  endDay: number;
};

type Tab = "PRICES" | "CATALOG" | "USERS" | "SETTINGS";

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
  const [tab, setTab] = useState<Tab>("PRICES");
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<WorkWeekSettings | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [catalogResponse, usersResponse, settingsResponse] = await Promise.all([
      fetch("/api/bootstrap", { cache: "no-store" }),
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/admin/settings", { cache: "no-store" }),
    ]);
    if (catalogResponse.ok) setBootstrap(await catalogResponse.json());
    if (usersResponse.ok) setUsers(await usersResponse.json());
    if (settingsResponse.ok) setSettings(await settingsResponse.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2200);
  }

  if (!bootstrap) return <div className="page-loading">Cargando administración…</div>;

  return (
    <div className="admin-page">
      <PageHero title="Administración" eyebrow="TURBO WASH · CONFIGURACIÓN">
        <div className="admin-tabs">
          <button className={tab === "PRICES" ? "selected" : ""} onClick={() => setTab("PRICES")}>
            <CircleDollarSign size={18} /> Precios
          </button>
          <button className={tab === "CATALOG" ? "selected" : ""} onClick={() => setTab("CATALOG")}>
            <Settings size={18} /> Catálogo
          </button>
          <button className={tab === "USERS" ? "selected" : ""} onClick={() => setTab("USERS")}>
            <Users size={18} /> Usuarios
          </button>
          <button className={tab === "SETTINGS" ? "selected" : ""} onClick={() => setTab("SETTINGS")}>
            <CalendarRange size={18} /> Semana
          </button>
        </div>
      </PageHero>

      {message && <div className="admin-toast"><Check size={17} />{message}</div>}

      {tab === "PRICES" && (
        <PriceEditor
          packages={bootstrap.packages}
          vehicles={bootstrap.vehicleTypes}
          prices={bootstrap.prices}
          onSaved={() => {
            flash("Precio actualizado");
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
  onSaved,
}: {
  packages: ServicePackageOption[];
  vehicles: VehicleTypeOption[];
  prices: ServicePriceOption[];
  onSaved: () => void;
}) {
  const fixedPackages = packages.filter(
    (item) => !item.requiresCustomPrice && item.category !== "SPECIAL",
  );
  const fixedVehicles = vehicles.filter((item) => !item.requiresCustom);
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        prices.map((price) => [
          `${price.packageId}-${price.vehicleTypeId}`,
          String(price.amount),
        ]),
      ),
    [prices],
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  useEffect(() => setValues(initialValues), [initialValues]);

  async function save(packageId: number, vehicleTypeId: number) {
    const key = `${packageId}-${vehicleTypeId}`;
    const amount = Number(values[key]);
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
          <p>Los cambios se guardan al salir de cada campo.</p>
        </div>
      </div>
      <div className="price-table-wrap">
        <table className="price-table">
          <thead>
            <tr>
              <th>Paquete</th>
              {fixedVehicles.map((vehicle) => <th key={vehicle.id}>{vehicle.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {fixedPackages.map((item) => (
              <tr key={item.id}>
                <th>
                  <span>{item.name}</span>
                  <small>{item.category === "NORMAL" ? "Normal" : "Interiores"}</small>
                </th>
                {fixedVehicles.map((vehicle) => {
                  const key = `${item.id}-${vehicle.id}`;
                  return (
                    <td key={vehicle.id}>
                      <span className="compact-money">
                        $
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={values[key] ?? ""}
                          onChange={(event) =>
                            setValues((current) => ({ ...current, [key]: event.target.value }))
                          }
                          onBlur={() => void save(item.id, vehicle.id)}
                        />
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
          <label>Rol<select name="role" defaultValue="EMPLOYEE"><option value="EMPLOYEE">Encargado</option><option value="ADMIN">Administrador</option></select></label>
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
