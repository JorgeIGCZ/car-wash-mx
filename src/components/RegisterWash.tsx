"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Armchair,
  BusFront,
  Camera,
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  Droplets,
  Layers3,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRoundPlus,
  Wind,
  X,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import type {
  BootstrapData,
  ServicePackageOption,
} from "@/types/domain";
import { PageHero } from "@/components/PageHero";

const vehicleIcons = {
  sedan: CarFront,
  pickup: Truck,
  suv: BusFront,
  "tres-filas": Layers3,
  especial: Sparkles,
};

const categoryLabels = {
  NORMAL: "Lavado normal",
  INTERIOR: "Lavado de interiores",
  SPECIAL: "Servicio especial",
};

const categoryOptions = {
  NORMAL: {
    icon: Droplets,
    subtitle: "Exterior o completo",
  },
  INTERIOR: {
    icon: Armchair,
    subtitle: "Limpieza profunda",
  },
  SPECIAL: {
    icon: ClipboardPlus,
    subtitle: "Servicio y precio libres",
  },
};

const wizardSteps = ["Servicio", "Vehículo", "Paquete", "Detalles"] as const;
const lastWizardStep = wizardSteps.length - 1;

function packageIcon(item: ServicePackageOption) {
  if (item.category === "SPECIAL") return ClipboardPlus;
  if (item.slug.includes("asientos")) return Armchair;
  if (item.slug.includes("cielo")) return Wind;
  if (item.slug.includes("alfombra")) return Layers3;
  return item.slug.includes("exterior") ? Sparkles : ShieldCheck;
}

export function RegisterWash() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [category, setCategory] = useState<keyof typeof categoryLabels>("NORMAL");
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [packageId, setPackageId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<number[]>([]);
  const [customPrice, setCustomPrice] = useState("");
  const [plate, setPlate] = useState("");
  const [notes, setNotes] = useState("");
  const [customServiceDescription, setCustomServiceDescription] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  async function load() {
    const response = await fetch("/api/bootstrap", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }

  useEffect(() => {
    void load();
  }, []);

  const photoPreviews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos],
  );

  useEffect(
    () => () => {
      photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [photoPreviews],
  );

  const vehicles = useMemo(
    () => data?.vehicleTypes.filter((item) => item.active) ?? [],
    [data],
  );
  const packages = useMemo(
    () =>
      data?.packages.filter(
        (item) => item.active && item.category === category,
      ) ?? [],
    [category, data],
  );
  const selectedVehicle = vehicles.find((item) => item.id === vehicleId);
  const selectedPackage = packages.find((item) => item.id === packageId);
  const needsCustomPrice =
    selectedVehicle?.requiresCustom || selectedPackage?.requiresCustomPrice;
  const configuredPrice = data?.prices.find(
    (price) =>
      price.vehicleTypeId === vehicleId && price.packageId === packageId,
  )?.amount;
  const total = needsCustomPrice ? Number(customPrice) || 0 : configuredPrice ?? 0;
  const hasRequiredDescription =
    !selectedPackage?.requiresDescription || customServiceDescription.trim().length > 0;
  const hasRequiredCustomPrice = !needsCustomPrice || Number(customPrice) > 0;
  const hasConfiguredPackagePrice =
    Boolean(packageId && selectedPackage) && (Boolean(needsCustomPrice) || Boolean(configuredPrice));
  const canSave = Boolean(
    vehicleId &&
      packageId &&
      total > 0 &&
      hasRequiredCustomPrice &&
      hasRequiredDescription,
  );
  const canAdvance =
    currentStep === 0 ||
    (currentStep === 1 && Boolean(vehicleId)) ||
    (currentStep === 2 && hasConfiguredPackagePrice) ||
    (currentStep === 3 && canSave);

  function chooseCategory(value: keyof typeof categoryLabels) {
    setCategory(value);
    setPackageId(null);
    setCustomServiceDescription("");
    setMessage(null);
    setCurrentStep(1);
  }

  function chooseVehicle(id: number) {
    setVehicleId(id);
    setPackageId(null);
    setCustomPrice("");
    setCustomServiceDescription("");
    setMessage(null);
    setCurrentStep(2);
  }

  function choosePackage(item: ServicePackageOption, price?: number) {
    const custom = Boolean(selectedVehicle?.requiresCustom || item.requiresCustomPrice);
    setPackageId(item.id);
    if (!custom) setCustomPrice("");
    if (!item.requiresDescription) setCustomServiceDescription("");

    if (!custom && !price) {
      setMessage({ type: "error", text: "Este paquete no tiene un precio configurado." });
      return;
    }

    setMessage(null);
    setCurrentStep(3);
  }

  function wizardError() {
    if (currentStep === 1) return "Selecciona el tipo de vehículo.";
    if (currentStep === 2) {
      if (!packageId) return "Selecciona el paquete.";
      return "Este paquete no tiene un precio configurado.";
    }
    if (needsCustomPrice && !hasRequiredCustomPrice) return "Captura el precio acordado.";
    if (!hasRequiredDescription) return "Describe el servicio especial.";
    return "Completa los datos requeridos.";
  }

  function goNext() {
    if (!canAdvance) {
      setMessage({ type: "error", text: wizardError() });
      return;
    }
    setMessage(null);
    setCurrentStep((step) => Math.min(lastWizardStep, step + 1));
  }

  function goBack() {
    setMessage(null);
    setCurrentStep((step) => Math.max(0, step - 1));
  }

  function canOpenStep(step: number) {
    if (step <= currentStep) return true;
    if (step === 1) return true;
    if (step === 2) return Boolean(vehicleId);
    return hasConfiguredPackagePrice;
  }

  function selectPhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";

    const compatible = selected.filter(
      (file) => file.type.startsWith("image/") && file.size <= 15 * 1024 * 1024,
    );
    const available = Math.max(0, 6 - photos.length);

    setPhotos((current) => [...current, ...compatible.slice(0, available)]);

    if (compatible.length !== selected.length) {
      setMessage({
        type: "error",
        text: "Algunas imágenes no son compatibles o pesan más de 15 MB.",
      });
    } else if (selected.length > available) {
      setMessage({ type: "error", text: "Puedes agregar un máximo de 6 fotografías." });
    } else {
      setMessage(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vehicleId || !packageId) return;

    const formElement = event.currentTarget;
    setSaving(true);
    setMessage(null);

    let response: Response;
    try {
      response = await fetch("/api/washes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleTypeId: vehicleId,
          packageId,
          plate,
          customPrice: needsCustomPrice ? Number(customPrice) : null,
          notes,
          customServiceDescription: selectedPackage?.requiresDescription
            ? customServiceDescription
            : null,
          participantIds: participants,
        }),
      });
    } catch {
      setMessage({ type: "error", text: "No fue posible conectar con el servidor." });
      setSaving(false);
      return;
    }
    const result = await response.json();

    if (!response.ok) {
      setMessage({ type: "error", text: result.error ?? "No fue posible registrar el lavado." });
      setSaving(false);
      return;
    }

    let uploadedPhotos = 0;
    for (let index = 0; index < photos.length; index += 1) {
      setUploadProgress(index + 1);
      const photoForm = new FormData();
      photoForm.set("photo", photos[index]);
      try {
        const photoResponse = await fetch(`/api/washes/${result.id}/photos`, {
          method: "POST",
          body: photoForm,
        });
        if (photoResponse.ok) uploadedPhotos += 1;
      } catch {
        // El lavado permanece registrado aunque una fotografía falle.
      }
    }

    formElement.reset();
    setVehicleId(null);
    setPackageId(null);
    setParticipants([]);
    setCustomPrice("");
    setPlate("");
    setNotes("");
    setCustomServiceDescription("");
    setPhotos([]);
    setUploadProgress(null);
    setCurrentStep(0);
    setMessage(
      uploadedPhotos === photos.length
        ? {
            type: "ok",
            text: `Lavado #${result.id} registrado correctamente${
              uploadedPhotos ? ` con ${uploadedPhotos} fotografías` : ""
            }.`,
          }
        : {
            type: "error",
            text: `El lavado #${result.id} fue registrado, pero ${
              photos.length - uploadedPhotos
            } fotografías no pudieron guardarse.`,
          },
    );
    setSaving(false);
    await load();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!data) {
    return <div className="page-loading">Cargando catálogo…</div>;
  }

  return (
    <div className="mobile-page">
      <PageHero title="Registro de lavados" />

      {message && (
        <div className={`notice ${message.type}`}>
          {message.type === "ok" && <Check size={19} />}
          {message.text}
        </div>
      )}

      <form onSubmit={submit} className="wash-form">
        <div className="wizard-progress" aria-label="Progreso del registro">
          {wizardSteps.map((step, index) => (
            <button
              type="button"
              key={step}
              className={[
                "wizard-step",
                index === currentStep ? "active" : "",
                index < currentStep ? "completed" : "",
              ].join(" ")}
              disabled={!canOpenStep(index) || saving}
              aria-current={index === currentStep ? "step" : undefined}
              onClick={() => setCurrentStep(index)}
            >
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </button>
          ))}
        </div>

        <section className={`form-section wizard-panel ${currentStep === 0 ? "active" : ""}`}>
          <div className="section-heading">
            <span>1</span>
            <div>
              <h2>Tipo de servicio</h2>
              <p>Selecciona el servicio que se realizará.</p>
            </div>
          </div>
          <div className="option-grid vehicle-grid">
            {(Object.keys(categoryLabels) as (keyof typeof categoryLabels)[]).map((key) => {
              const option = categoryOptions[key];
              const Icon = option.icon;
              return (
              <OptionButton
                key={key}
                selected={category === key}
                onClick={() => chooseCategory(key)}
                title={categoryLabels[key]}
                subtitle={option.subtitle}
                icon={<Icon size={27} />}
              />
              );
            })}
          </div>
        </section>

        <section className={`form-section wizard-panel ${currentStep === 1 ? "active" : ""}`}>
          <div className="section-heading">
            <span>2</span>
            <div>
              <h2>Tipo de vehículo</h2>
              <p>El precio depende del vehículo seleccionado.</p>
            </div>
          </div>
          <div className="option-grid vehicle-grid">
            {vehicles.map((vehicle) => {
              const Icon =
                vehicleIcons[vehicle.slug as keyof typeof vehicleIcons] ?? CarFront;
              return (
                <OptionButton
                  key={vehicle.id}
                  selected={vehicleId === vehicle.id}
                  onClick={() => chooseVehicle(vehicle.id)}
                  title={vehicle.name}
                  icon={<Icon size={28} />}
                  subtitle={vehicle.requiresCustom ? "Precio libre" : undefined}
                />
              );
            })}
          </div>
        </section>

        <section className={`form-section wizard-panel ${currentStep === 2 ? "active" : ""}`}>
          <div className="section-heading">
            <span>3</span>
            <div>
              <h2>Paquete</h2>
              <p>
                {vehicleId
                  ? "Selecciona el trabajo que se realizará."
                  : "Primero selecciona un vehículo."}
              </p>
            </div>
          </div>
          <div className="option-grid package-grid">
            {packages.map((item) => {
              const Icon = packageIcon(item);
              const price = data.prices.find(
                (candidate) =>
                  candidate.vehicleTypeId === vehicleId &&
                  candidate.packageId === item.id,
              )?.amount;
              const custom = selectedVehicle?.requiresCustom || item.requiresCustomPrice;
              return (
                <OptionButton
                  key={item.id}
                  selected={packageId === item.id}
                  disabled={!vehicleId}
                  onClick={() => choosePackage(item, price)}
                  title={item.name}
                  icon={<Icon size={25} />}
                  subtitle={
                    item.description ??
                    (custom ? "Precio libre" : price ? formatMoney(price) : "Sin precio")
                  }
                  price={item.description && price ? formatMoney(price) : undefined}
                />
              );
            })}
          </div>
        </section>

        <section className={`form-section details-section wizard-panel ${currentStep === 3 ? "active" : ""}`}>
          <div className="section-heading">
            <span>4</span>
            <div>
              <h2>Detalles</h2>
              <p>Adjunta fotografías y agrega quién participó.</p>
            </div>
          </div>

          <div className="photo-field">
            <div className="collaborators-title">
              <Camera size={20} />
              <div>
                <strong>Fotografías</strong>
                <small>Opcional · máximo 6</small>
              </div>
            </div>
            <p>
              Se ajustan automáticamente a 1920 px y se optimizan sin conservar
              el archivo pesado original.
            </p>
            <div className="photo-picker">
              {photoPreviews.map((preview, index) => (
                <div className="photo-preview" key={`${preview.file.name}-${index}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.url} alt={`Vista previa ${index + 1}`} />
                  <button
                    type="button"
                    aria-label={`Quitar fotografía ${index + 1}`}
                    onClick={() =>
                      setPhotos((current) =>
                        current.filter((_, photoIndex) => photoIndex !== index),
                      )
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <label className="add-photo">
                  <Camera size={25} />
                  <span>Añadir</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={selectPhotos}
                    disabled={saving}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="collaborators">
            <div className="collaborators-title">
              <UserRoundPlus size={20} />
              <div>
                <strong>Participantes adicionales</strong>
                <small>Opcional</small>
              </div>
            </div>
            <div className="chip-list">
              {data.users
                .filter(
                  (user) =>
                    user.id !== data.user.id &&
                    user.role !== "ADMINISTRATIVE",
                )
                .map((user) => {
                  const selected = participants.includes(user.id);
                  return (
                    <button
                      type="button"
                      key={user.id}
                      className={selected ? "selected" : ""}
                      onClick={() =>
                        setParticipants((current) =>
                          selected
                            ? current.filter((id) => id !== user.id)
                            : [...current, user.id],
                        )
                      }
                    >
                      {selected && <Check size={15} />}
                      {user.name}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="field-grid">
            <label>
              Placa / referencia <em>Opcional</em>
              <input
                name="plate"
                placeholder="ABC-123"
                maxLength={32}
                value={plate}
                onChange={(event) => setPlate(event.target.value)}
              />
            </label>

            {needsCustomPrice && (
              <label>
                Precio acordado
                <span className="money-input">
                  <b>$</b>
                  <input
                    inputMode="decimal"
                    type="number"
                    min="1"
                    step="0.01"
                    value={customPrice}
                    onChange={(event) => setCustomPrice(event.target.value)}
                    placeholder="0.00"
                    required
                  />
                </span>
              </label>
            )}

            {selectedPackage?.requiresDescription && (
              <label className="wide">
                Información del servicio especial
                <textarea
                  name="customServiceDescription"
                  placeholder="Describe el trabajo que se realizará…"
                  value={customServiceDescription}
                  onChange={(event) => setCustomServiceDescription(event.target.value)}
                  required
                />
              </label>
            )}

            <label className="wide">
              Observaciones <em>Opcional</em>
              <textarea
                name="notes"
                placeholder="Detalles del vehículo o indicaciones…"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </div>
        </section>

        <div className="register-bar">
          <div>
            <span>PASO {currentStep + 1} / {wizardSteps.length}</span>
            <strong>{total > 0 ? formatMoney(total) : "—"}</strong>
            <small>{wizardSteps[currentStep]}</small>
          </div>
          <div className="wizard-actions">
            {currentStep > 0 && (
              <button
                type="button"
                className="secondary-button"
                onClick={goBack}
                disabled={saving}
              >
                <ChevronLeft size={19} />
                Atrás
              </button>
            )}
            {currentStep < lastWizardStep ? (
              <button
                type="button"
                className="primary-button"
                onClick={goNext}
                disabled={saving}
              >
                Siguiente
                <ChevronRight size={19} />
              </button>
            ) : (
              <button className="primary-button" disabled={!canSave || saving}>
                <ClipboardPlus size={21} />
                {uploadProgress
                  ? `Subiendo ${uploadProgress}/${photos.length}…`
                  : saving
                    ? "Guardando…"
                    : "Registrar lavado"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function OptionButton({
  selected,
  disabled,
  onClick,
  title,
  subtitle,
  price,
  icon,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
  price?: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`option-card ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <span className="option-icon">{icon}</span>
      <span>
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
        {price && <b>{price}</b>}
      </span>
      {selected && (
        <i>
          <Check size={14} />
        </i>
      )}
    </button>
  );
}
