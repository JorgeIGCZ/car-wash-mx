"use client";

import {
  FormEvent,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  HandCoins,
  KeyRound,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
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
  ExpenseRecord,
  ServicePackageOption,
  ServicePriceOption,
  VehicleTypeOption,
} from "@/types/domain";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "ADMINISTRATIVE" | "EMPLOYEE";
  isPartner: boolean;
  partnerSharePercentage: number | null;
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
  | "EXPENSES"
  | "PRICES"
  | "COMMISSIONS"
  | "CATALOG"
  | "USERS"
  | "SETTINGS";

type Period = "TODAY" | "WEEK" | "MONTH" | "RANGE";

const weekDays = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

type FlashMessage = {
  type: "success" | "error";
  text: string;
};

function formatDateInput(value = new Date()) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

async function responseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return typeof payload?.error === "string" ? payload.error : fallback;
}

function ExpenseToggleButton({
  type,
  title,
  description,
  selected,
  disabled,
  compact = false,
  onClick,
}: {
  type: "cash" | "reimbursement";
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const Icon = type === "cash" ? CircleDollarSign : HandCoins;

  return (
    <button
      type="button"
      className={`expense-toggle-card ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="expense-toggle-icon">
        <Icon size={compact ? 16 : 18} />
      </span>
      <span className="expense-toggle-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="expense-toggle-switch" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

function ExpenseSummaryCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof ReceiptText;
  label: string;
  value: string;
  tone?: "neutral" | "cash" | "reimbursement" | "total";
}) {
  return (
    <div className={`expense-summary-card ${tone}`}>
      <span>
        <Icon size={18} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function formatExpenseDay(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
  }).format(new Date(value));
}

function formatExpenseMonth(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    month: "short",
  }).format(new Date(value)).replace(".", "");
}

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("HISTORY");
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [commissionRules, setCommissionRules] = useState<
    CommissionRuleOption[]
  >([]);
  const [settings, setSettings] = useState<WorkWeekSettings | null>(null);
  const [message, setMessage] = useState<FlashMessage | null>(null);

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

  function flash(text: string, type: FlashMessage["type"] = "success") {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 2200);
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
          <button className={tab === "EXPENSES" ? "selected" : ""} onClick={() => setTab("EXPENSES")}>
            <ReceiptText size={18} /> Egresos
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
                <Users size={18} /> Personal
              </button>
              <button className={tab === "SETTINGS" ? "selected" : ""} onClick={() => setTab("SETTINGS")}>
                <CalendarRange size={18} /> Semana
              </button>
            </>
          )}
        </div>
      </PageHero>

      {message && (
        <div className={`admin-toast ${message.type}`}>
          {message.type === "success" ? <Check size={17} /> : <AlertCircle size={17} />}
          {message.text}
        </div>
      )}

      {tab === "HISTORY" && (
        <WashHistory
          embedded
          scope="ALL"
          users={users}
          canDelete={canEdit}
          canEditCommissions={canEdit}
          canEditPrices={canEdit}
        />
      )}
      {tab === "EXPENSES" && (
        <ExpenseEditor users={users} currentUser={bootstrap.user} flash={flash} />
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

function ExpenseEditor({
  users,
  currentUser,
  flash,
}: {
  users: AdminUser[];
  currentUser: BootstrapData["user"];
  flash: (text: string, type?: FlashMessage["type"]) => void;
}) {
  const [period, setPeriod] = useState<Period>("TODAY");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [takenFromCash, setTakenFromCash] = useState(false);
  const [reimbursable, setReimbursable] = useState(false);
  const canCreateExpense =
    currentUser.role === "ADMIN" || currentUser.role === "ADMINISTRATIVE";
  const canManageExpenses = currentUser.role === "ADMIN";
  const lockedPartner =
    currentUser.role === "ADMIN" && currentUser.isPartner
      ? currentUser
      : null;
  const partners = useMemo(
    () =>
      users.filter(
        (user) => user.active && user.role === "ADMIN" && user.isPartner,
      ),
    [users],
  );
  const cashTotal = useMemo(
    () =>
      expenses
        .filter((expense) => expense.takenFromCash)
        .reduce((sum, expense) => sum + expense.amount, 0),
    [expenses],
  );
  const reimbursementTotal = useMemo(
    () =>
      expenses
        .filter((expense) => expense.reimbursable && !expense.takenFromCash)
        .reduce((sum, expense) => sum + expense.amount, 0),
    [expenses],
  );
  const directExpenseTotal = Math.max(0, total - cashTotal);

  const load = useCallback(async () => {
    if (period === "RANGE" && (!from || !to)) return;
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (period === "RANGE") {
      params.set("from", from);
      params.set("to", to);
    }
    const response = await fetch(`/api/admin/expenses?${params}`, {
      cache: "no-store",
    });
    if (response.ok) {
      const data = await response.json();
      setExpenses(data.expenses);
      setTotal(data.stats.total);
    }
    setLoading(false);
  }, [from, period, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const shouldReimburse = !takenFromCash && reimbursable;
    const selectedPartnerId = lockedPartner
      ? lockedPartner.id
      : Number(form.get("partnerId"));
    setSaving(true);
    try {
      const response = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseDate: form.get("expenseDate"),
          concept: form.get("concept"),
          amount: Number(form.get("amount")),
          notes: form.get("notes"),
          takenFromCash,
          reimbursable: shouldReimburse,
          partnerId:
            shouldReimburse && selectedPartnerId > 0
              ? selectedPartnerId
              : null,
        }),
      });
      if (!response.ok) {
        flash(await responseError(response, "No fue posible registrar el egreso."), "error");
        return;
      }
      formElement.reset();
      setTakenFromCash(false);
      setReimbursable(false);
      flash("Egreso registrado");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-section expense-section">
      <div className="expense-section-head">
        <div className="content-heading">
          <ReceiptText size={23} />
          <div>
            <h2>Egresos</h2>
            <p>Gastos operativos, caja y reembolsos del periodo.</p>
          </div>
        </div>
        <div className="expense-period-chip">
          <CalendarDays size={17} />
          {period === "TODAY" && "Hoy"}
          {period === "WEEK" && "Semana"}
          {period === "MONTH" && "Mes"}
          {period === "RANGE" && "Rango"}
        </div>
      </div>

      <div className="expense-summary-grid">
        <ExpenseSummaryCard
          icon={ReceiptText}
          label="Total egresos"
          value={formatMoney(total)}
          tone="total"
        />
        <ExpenseSummaryCard
          icon={CircleDollarSign}
          label="Tomado de caja"
          value={formatMoney(cashTotal)}
          tone="cash"
        />
        <ExpenseSummaryCard
          icon={HandCoins}
          label="Reembolsos"
          value={formatMoney(reimbursementTotal)}
          tone="reimbursement"
        />
        <ExpenseSummaryCard
          icon={ClipboardList}
          label="Movimientos"
          value={String(expenses.length)}
        />
      </div>

      <div className="expense-workspace">
        {canCreateExpense && (
          <div className="expense-capture-panel">
            <div className="expense-panel-heading">
              <div>
                <h3>Nuevo egreso</h3>
                <p>Captura el gasto y define cómo se liquidó.</p>
              </div>
              <span>{formatMoney(directExpenseTotal)} fuera de caja</span>
            </div>
            <form className="expense-form" onSubmit={create}>
              <label>
                Fecha
                <input
                  type="date"
                  name="expenseDate"
                  defaultValue={formatDateInput()}
                  required
                />
              </label>
              <label className="wide">
                Concepto
                <input name="concept" placeholder="Consumibles, reparación..." required />
              </label>
              <label>
                Monto
                <input name="amount" type="number" min="0.01" step="0.01" required />
              </label>
              <label className="wide">
                Notas
                <input name="notes" placeholder="Opcional" />
              </label>
              <div className="expense-option-group">
                <ExpenseToggleButton
                  type="cash"
                  title="Salió de caja"
                  description="El negocio ya pagó este egreso."
                  selected={takenFromCash}
                  onClick={() => {
                    const nextValue = !takenFromCash;
                    setTakenFromCash(nextValue);
                    if (nextValue) setReimbursable(false);
                  }}
                />
                <ExpenseToggleButton
                  type="reimbursement"
                  title="Reembolsar a socio"
                  description="Se sumará al total a entregar."
                  selected={!takenFromCash && reimbursable}
                  disabled={takenFromCash}
                  onClick={() => setReimbursable((current) => !current)}
                />
              </div>
              <label className="wide">
                Socio
                <select
                  name="partnerId"
                  value={
                    lockedPartner && reimbursable && !takenFromCash
                      ? String(lockedPartner.id)
                      : undefined
                  }
                  disabled={Boolean(lockedPartner) || takenFromCash || !reimbursable}
                  onChange={() => undefined}
                >
                  <option value="">
                    {takenFromCash || !reimbursable
                      ? "Sin reembolso"
                      : "Seleccionar socio"}
                  </option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
                {lockedPartner && reimbursable && !takenFromCash && (
                  <small>Se registrará para {lockedPartner.name}.</small>
                )}
              </label>
              <button className="primary-button" disabled={saving}>
                <Plus size={18} />
                {saving ? "Guardando..." : "Registrar egreso"}
              </button>
            </form>
          </div>
        )}

        <div className="expense-history-panel">
          <div className="expense-panel-heading">
            <div>
              <h3>Movimientos</h3>
              <p>{loading ? "Consultando..." : `${expenses.length} egresos en vista`}</p>
            </div>
            <div className="expense-total">
              <span>Total</span>
              <strong>{formatMoney(total)}</strong>
            </div>
          </div>

          <div className="expense-toolbar">
            <div className="period-tabs">
              {([
                ["TODAY", "Hoy"],
                ["WEEK", "Semana"],
                ["MONTH", "Mes"],
                ["RANGE", "Rango"],
              ] as [Period, string][]).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={period === value ? "selected" : ""}
                  onClick={() => setPeriod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {period === "RANGE" && (
              <div className="range-fields">
                <label>
                  Desde
                  <input
                    type="date"
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  />
                </label>
                <label>
                  Hasta
                  <input
                    type="date"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="expense-list">
            {loading ? (
              <div className="empty-state">Consultando egresos...</div>
            ) : expenses.length === 0 ? (
              <div className="empty-state">
                <ReceiptText size={54} />
                <h2>Sin egresos registrados</h2>
                <p>No hay egresos en el periodo seleccionado.</p>
              </div>
            ) : (
              expenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  partners={partners}
                  currentUser={currentUser}
                  canEdit={canManageExpenses}
                  flash={flash}
                  onChanged={load}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ExpenseRow({
  expense,
  partners,
  currentUser,
  canEdit,
  flash,
  onChanged,
}: {
  expense: ExpenseRecord;
  partners: AdminUser[];
  currentUser: BootstrapData["user"];
  canEdit: boolean;
  flash: (text: string, type?: FlashMessage["type"]) => void;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseDate, setExpenseDate] = useState(formatDateInput(new Date(expense.expenseDate)));
  const [concept, setConcept] = useState(expense.concept);
  const [amount, setAmount] = useState(String(expense.amount));
  const [notes, setNotes] = useState(expense.notes ?? "");
  const [takenFromCash, setTakenFromCash] = useState(expense.takenFromCash);
  const [reimbursable, setReimbursable] = useState(expense.reimbursable);
  const [partnerId, setPartnerId] = useState(expense.partner ? String(expense.partner.id) : "");
  const lockedPartner =
    currentUser.role === "ADMIN" && currentUser.isPartner
      ? currentUser
      : null;

  useEffect(() => {
    setExpenseDate(formatDateInput(new Date(expense.expenseDate)));
    setConcept(expense.concept);
    setAmount(String(expense.amount));
    setNotes(expense.notes ?? "");
    setTakenFromCash(expense.takenFromCash);
    setReimbursable(expense.reimbursable);
    setPartnerId(expense.partner ? String(expense.partner.id) : "");
  }, [expense]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const shouldReimburse = !takenFromCash && reimbursable;
    const selectedPartnerId = lockedPartner
      ? lockedPartner.id
      : Number(partnerId);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: expense.id,
          expenseDate,
          concept,
          amount: Number(amount),
          notes,
          takenFromCash,
          reimbursable: shouldReimburse,
          partnerId:
            shouldReimburse && selectedPartnerId > 0
              ? selectedPartnerId
              : null,
        }),
      });
      if (!response.ok) {
        flash(await responseError(response, "No fue posible actualizar el egreso."), "error");
        return;
      }
      setEditing(false);
      flash("Egreso actualizado");
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (saving || !window.confirm("¿Eliminar este egreso?")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: expense.id }),
      });
      if (!response.ok) {
        flash(await responseError(response, "No fue posible eliminar el egreso."), "error");
        return;
      }
      flash("Egreso eliminado");
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form className="expense-row editing" onSubmit={save}>
        <input
          type="date"
          value={expenseDate}
          onChange={(event) => setExpenseDate(event.target.value)}
          required
        />
        <input
          value={concept}
          onChange={(event) => setConcept(event.target.value)}
          required
        />
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notas"
        />
        <div className="expense-option-group compact">
          <ExpenseToggleButton
            type="cash"
            title="Caja"
            description="Pagado por el negocio"
            selected={takenFromCash}
            compact
            onClick={() => {
              const nextValue = !takenFromCash;
              setTakenFromCash(nextValue);
              if (nextValue) {
                setReimbursable(false);
                setPartnerId("");
              }
            }}
          />
          <ExpenseToggleButton
            type="reimbursement"
            title="Reembolso"
            description="Sumar al socio"
            selected={!takenFromCash && reimbursable}
            disabled={takenFromCash}
            compact
            onClick={() => setReimbursable((current) => !current)}
          />
        </div>
        <select
          value={
            lockedPartner && reimbursable && !takenFromCash
              ? String(lockedPartner.id)
              : partnerId
          }
          disabled={Boolean(lockedPartner) || takenFromCash || !reimbursable}
          onChange={(event) => setPartnerId(event.target.value)}
        >
          <option value="">Socio</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.name}
            </option>
          ))}
        </select>
        <div className="expense-actions">
          <button className="icon-button" title="Guardar" disabled={saving}>
            <Save size={17} />
          </button>
          <button
            className="icon-button"
            type="button"
            title="Cancelar"
            disabled={saving}
            onClick={() => setEditing(false)}
          >
            <AlertCircle size={17} />
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="expense-row">
      <div className="expense-date-badge">
        <span>{formatExpenseMonth(expense.expenseDate)}</span>
        <strong>{formatExpenseDay(expense.expenseDate)}</strong>
      </div>
      <div className="expense-info">
        <strong>{expense.concept}</strong>
        <span>
          Registrado por {expense.createdBy.name}
          {expense.partner ? ` · ${expense.partner.name}` : ""}
        </span>
        {expense.notes && <small>{expense.notes}</small>}
      </div>
      <div className="expense-tags">
        <span className={expense.takenFromCash ? "cash" : "direct"}>
          {expense.takenFromCash ? "Caja" : "Fuera de caja"}
        </span>
        {expense.reimbursable && <span className="reimbursement">Reembolso</span>}
      </div>
      <strong className="expense-amount">{formatMoney(expense.amount)}</strong>
      {canEdit && (
        <div className="expense-actions">
          <button
            className="icon-button"
            type="button"
            title="Editar"
            disabled={saving}
            onClick={() => setEditing(true)}
          >
            <Pencil size={17} />
          </button>
          <button
            className="icon-button danger"
            type="button"
            title="Eliminar"
            disabled={saving}
            onClick={() => void remove()}
          >
            <Trash2 size={17} />
          </button>
        </div>
      )}
    </article>
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
  flash: (text: string, type?: FlashMessage["type"]) => void;
}) {
  const [savingCreate, setSavingCreate] = useState<"package" | "vehicle" | null>(null);

  async function responseError(response: Response, fallback: string) {
    const payload = await response.json().catch(() => null);
    return typeof payload?.error === "string" ? payload.error : fallback;
  }

  async function patch(path: string, body: object, message: string) {
    const response = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      flash(message);
      await reload();
      return;
    }
    flash(await responseError(response, "No fue posible guardar los cambios."), "error");
  }

  async function addPackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingCreate) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSavingCreate("package");
    try {
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
      if (!response.ok) {
        flash(await responseError(response, "No fue posible agregar el paquete."), "error");
        return;
      }
      formElement.reset();
      flash("Paquete agregado");
      await reload();
    } finally {
      setSavingCreate(null);
    }
  }

  async function addVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingCreate) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSavingCreate("vehicle");
    try {
      const response = await fetch("/api/admin/vehicle-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          requiresCustom: form.get("requiresCustom") === "on",
        }),
      });
      if (!response.ok) {
        flash(await responseError(response, "No fue posible agregar el vehículo."), "error");
        return;
      }
      formElement.reset();
      flash("Tipo de vehículo agregado");
      await reload();
    } finally {
      setSavingCreate(null);
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
          <button className="secondary-button" disabled={savingCreate !== null}>
            <PackagePlus size={18} />
            {savingCreate === "package" ? "Guardando..." : "Agregar"}
          </button>
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
          <button className="secondary-button" disabled={savingCreate !== null}>
            <PackagePlus size={18} />
            {savingCreate === "vehicle" ? "Guardando..." : "Agregar"}
          </button>
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
  onSave: (name: string, description: string) => Promise<void>;
  onToggle: () => Promise<void>;
}) {
  const [name, setName] = useState(title);
  const [description, setDescription] = useState(subtitle === "Sin descripción" ? "" : subtitle);
  const [saving, setSaving] = useState(false);

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
      <button
        className="icon-button"
        title="Guardar"
        disabled={saving}
        onClick={async () => {
          if (saving) return;
          setSaving(true);
          try {
            await onSave(name, description);
          } finally {
            setSaving(false);
          }
        }}
      >
        <Save size={18} />
      </button>
      <button
        className={`status-toggle ${active ? "active" : ""}`}
        disabled={saving}
        onClick={async () => {
          if (saving) return;
          setSaving(true);
          try {
            await onToggle();
          } finally {
            setSaving(false);
          }
        }}
      >
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
  flash: (text: string, type?: FlashMessage["type"]) => void;
}) {
  const [newRole, setNewRole] = useState<AdminUser["role"]>("EMPLOYEE");
  const [newIsPartner, setNewIsPartner] = useState(false);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);

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
    flash(result.error ?? "No fue posible actualizar el usuario", "error");
    return false;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingRef.current) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const isPartner = newRole === "ADMIN" && newIsPartner;
    creatingRef.current = true;
    setCreating(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          role: form.get("role"),
          isPartner,
          partnerSharePercentage: isPartner
            ? Number(form.get("partnerSharePercentage"))
            : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        flash(result.error ?? "No fue posible crear el usuario", "error");
        return;
      }
      formElement.reset();
      setNewRole("EMPLOYEE");
      setNewIsPartner(false);
      flash("Usuario creado");
      await reload();
    } catch {
      flash("No fue posible conectar con el servidor.", "error");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  return (
    <div className="user-admin-grid">
      <section className="admin-section">
        <div className="content-heading">
          <Users size={23} />
          <div><h2>Personal</h2><p>Administra cuentas, roles y acceso.</p></div>
        </div>
        <div className="admin-user-list">
          {users.map((user) => (
            <article className={user.active ? "" : "inactive"} key={user.id}>
              <div className="small-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
              <div className="admin-user-info">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <small>{user._count.washesCreated} lavados registrados</small>
                {user.isPartner && (
                  <small className="partner-status">
                    Socio {user.partnerSharePercentage ?? 0}%
                  </small>
                )}
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
              {user.role === "ADMIN" && (
                <PartnerSettingsForm user={user} onSave={update} />
              )}
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
          <div><h2>Nuevo usuario</h2><p>Crea una cuenta para el personal.</p></div>
        </div>
        <form className="stack-form" onSubmit={create}>
          <label>Nombre<input name="name" required /></label>
          <label>Correo<input name="email" type="email" required /></label>
          <label>Contraseña temporal<input name="password" type="password" minLength={10} required /></label>
          <p className="password-hint">El usuario deberá reemplazarla cuando inicie sesión.</p>
          <label>
            Rol
            <select
              name="role"
              value={newRole}
              onChange={(event) => {
                const role = event.target.value as AdminUser["role"];
                setNewRole(role);
                if (role !== "ADMIN") setNewIsPartner(false);
              }}
            >
              <option value="EMPLOYEE">Encargado</option>
              <option value="ADMINISTRATIVE">Administrativo</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
          {newRole === "ADMIN" && (
            <>
              <label className="check-field">
                <input
                  type="checkbox"
                  name="isPartner"
                  checked={newIsPartner}
                  onChange={(event) => setNewIsPartner(event.target.checked)}
                />
                Socio
              </label>
              <label>
                Porcentaje en la sociedad
                <input
                  name="partnerSharePercentage"
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  disabled={!newIsPartner}
                  required={newIsPartner}
                />
              </label>
            </>
          )}
          <button className="primary-button" disabled={creating}>
            <UserPlus size={18} />
            {creating ? "Creando..." : "Crear usuario"}
          </button>
        </form>
      </section>
    </div>
  );
}

function PartnerSettingsForm({
  user,
  onSave,
}: {
  user: AdminUser;
  onSave: (body: object) => Promise<boolean>;
}) {
  const [isPartner, setIsPartner] = useState(user.isPartner);
  const [percentage, setPercentage] = useState(
    user.partnerSharePercentage ? String(user.partnerSharePercentage) : "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsPartner(user.isPartner);
    setPercentage(
      user.partnerSharePercentage ? String(user.partnerSharePercentage) : "",
    );
  }, [user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        id: user.id,
        isPartner,
        partnerSharePercentage: isPartner ? Number(percentage) : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="partner-settings-form" onSubmit={submit}>
      <label className="check-field">
        <input
          type="checkbox"
          checked={isPartner}
          onChange={(event) => setIsPartner(event.target.checked)}
        />
        Socio
      </label>
      <input
        type="number"
        min="0.01"
        max="100"
        step="0.01"
        value={percentage}
        onChange={(event) => setPercentage(event.target.value)}
        placeholder="%"
        disabled={!isPartner}
        required={isPartner}
      />
      <button className="secondary-button" disabled={saving}>
        {saving ? "Guardando..." : "Guardar socio"}
      </button>
    </form>
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
