"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { formatNaira } from "@/lib/utils";
import {
  createDeliveryZone,
  deleteDeliveryZone,
  listMerchantDeliveryZones,
  updateDeliveryZone,
} from "@/lib/deliveryZones";
import type { DeliveryCity, DeliveryZone } from "@/lib/types";

const CITIES: DeliveryCity[] = ["Abuja", "Lagos"];

interface ZoneForm {
  city: DeliveryCity;
  name: string;
  provider: string;
  fee: string;
  estimate: string;
  note: string;
  is_active: boolean;
}

const emptyForm = (): ZoneForm => ({
  city: "Abuja",
  name: "",
  provider: "",
  fee: "0",
  estimate: "",
  note: "",
  is_active: true,
});

function zoneErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/duplicate key/i.test(message))
    return "A zone with this name already exists for this store.";
  return message || "The delivery zone could not be saved.";
}

export default function AdminDelivery() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [form, setForm] = useState<ZoneForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [zoneToDelete, setZoneToDelete] = useState<DeliveryZone | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setZones(await listMerchantDeliveryZones());
    } catch (loadError) {
      console.error("Error loading delivery zones: ", loadError);
      setZones([]);
      setError("Delivery zones could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (zoneToDelete && dialog && !dialog.open) dialog.showModal();
    else if (!zoneToDelete && dialog?.open) dialog.close();
  }, [zoneToDelete]);

  const closeDeleteDialog = () => {
    if (deleting) return;
    if (deleteDialogRef.current?.open) deleteDialogRef.current.close();
    else setZoneToDelete(null);
  };

  const handleDeleteDialogClose = () => {
    setZoneToDelete(null);
    deleteTriggerRef.current?.focus();
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setFormOpen(true);
  };

  const openEdit = (zone: DeliveryZone) => {
    setEditing(zone);
    setForm({
      city: zone.city,
      name: zone.name,
      provider: zone.provider,
      fee: String(zone.fee),
      estimate: zone.estimate ?? "",
      note: zone.note ?? "",
      is_active: zone.is_active,
    });
    setError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const save = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fee = Number(form.fee);
    if (!form.name.trim() || !form.provider.trim()) {
      setError("Zone name and logistics provider are required.");
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      setError("Delivery fee must be a non-negative number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        city: form.city,
        name: form.name.trim(),
        provider: form.provider.trim(),
        fee,
        estimate: form.estimate.trim() || null,
        note: form.note.trim() || null,
        is_active: form.is_active,
      };
      if (editing) await updateDeliveryZone(editing.id, payload);
      else await createDeliveryZone(payload);
      closeForm();
      await load();
    } catch (saveError) {
      console.error("Error saving delivery zone: ", saveError);
      setError(zoneErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (zone: DeliveryZone) => {
    setError(null);
    try {
      await updateDeliveryZone(zone.id, { is_active: !zone.is_active });
      await load();
    } catch (toggleError) {
      console.error("Error updating delivery zone: ", toggleError);
      setError("The delivery zone could not be updated.");
    }
  };

  const confirmDelete = async () => {
    if (!zoneToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDeliveryZone(zoneToDelete.id);
      setZoneToDelete(null);
      await load();
    } catch (deleteError) {
      console.error("Error deleting delivery zone: ", deleteError);
      setError("The delivery zone could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 bg-surface-container-lowest border border-outline rounded-xl font-body-sm text-primary focus:border-secondary focus:outline-none";

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-md text-xl sm:text-headline-md text-on-surface">
            Delivery
          </h2>
          <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant">
            Set delivery zones and fees for Abuja and Lagos.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="min-h-11 pointer-coarse:min-h-12 flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-sm text-xs uppercase tracking-wider font-bold hover:bg-primary/90 active:scale-[0.98] transition-all w-full sm:w-auto shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add zone</span>
        </button>
      </div>

      {error && !formOpen && (
        <div role="alert" className="p-4 rounded-xl border border-error/30 bg-error/10 text-error text-sm">
          {error}
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={save}
          className="@container bg-surface rounded-2xl border border-outline-variant/60 p-5 sm:p-6 botanical-shadow max-w-3xl space-y-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-base sm:text-headline-sm text-primary font-bold">
              {editing ? "Edit zone" : "Add zone"}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="min-h-11 px-3 text-xs font-mono text-on-surface-variant hover:text-primary"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p role="alert" className="p-3 bg-error/10 text-error rounded-xl text-xs font-medium">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 @min-[560px]:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">City</span>
              <select
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({ ...current, city: event.target.value as DeliveryCity }))
                }
                className={inputClass}
              >
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Zone name</span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="e.g. Wuse 2"
                className={inputClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Logistics provider</span>
              <input
                value={form.provider}
                onChange={(event) =>
                  setForm((current) => ({ ...current, provider: event.target.value }))
                }
                placeholder="e.g. Private Rider"
                className={inputClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Delivery fee (NGN)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.fee}
                onChange={(event) =>
                  setForm((current) => ({ ...current, fee: event.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Estimated delivery (optional)</span>
              <input
                value={form.estimate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, estimate: event.target.value }))
                }
                placeholder="e.g. Same day"
                className={inputClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Delivery note (optional)</span>
              <input
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({ ...current, note: event.target.value }))
                }
                placeholder="e.g. Orders before 2pm only"
                className={inputClass}
              />
            </label>
          </div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                setForm((current) => ({ ...current, is_active: event.target.checked }))
              }
              className="w-5 h-5"
            />
            <span className="font-label-sm text-sm text-primary font-bold">Active</span>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 pointer-coarse:min-h-12 px-8 py-3 bg-primary text-on-primary rounded-xl font-label-sm text-xs uppercase tracking-wider font-bold disabled:opacity-50"
          >
            {saving ? "Saving..." : editing ? "Save zone" : "Add zone"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="p-8 text-center text-on-surface-variant text-sm bg-surface rounded-2xl border border-outline-variant">
          Loading delivery zones...
        </div>
      ) : zones.length === 0 ? (
        <div className="p-8 text-center text-on-surface-variant text-sm bg-surface rounded-2xl border border-outline-variant">
          No delivery zones yet. Add a zone so customers can check out.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="bg-surface rounded-2xl border border-outline-variant/70 p-4 sm:p-5 botanical-shadow space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="p-2 bg-secondary-container rounded-xl text-secondary shrink-0">
                    <MapPin className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-body-md font-bold text-primary truncate">{zone.name}</p>
                    <p className="font-mono text-[11px] text-on-surface-variant">{zone.city}</p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    zone.is_active
                      ? "bg-secondary-container text-on-secondary-container"
                      : "bg-surface-variant text-on-surface-variant"
                  }`}
                >
                  {zone.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="space-y-1 text-xs text-on-surface-variant">
                <div className="flex justify-between gap-4">
                  <span>Provider</span>
                  <span className="font-mono text-primary text-right">{zone.provider}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Fee</span>
                  <span className="font-mono text-primary">{formatNaira(zone.fee)}</span>
                </div>
                {zone.estimate && (
                  <div className="flex justify-between gap-4">
                    <span>Estimate</span>
                    <span className="text-right">{zone.estimate}</span>
                  </div>
                )}
                {zone.note && (
                  <div className="flex justify-between gap-4">
                    <span>Note</span>
                    <span className="text-right">{zone.note}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/40">
                <button
                  type="button"
                  onClick={() => toggleActive(zone)}
                  className="min-h-11 pointer-coarse:min-h-12 px-3 py-1.5 rounded-lg bg-surface-container-high text-primary hover:bg-surface-container text-xs font-semibold transition-colors cursor-pointer"
                >
                  {zone.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(zone)}
                  aria-label={`Edit ${zone.name}`}
                  className="min-h-11 min-w-11 pointer-coarse:min-h-12 pointer-coarse:min-w-12 p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    deleteTriggerRef.current = event.currentTarget;
                    setZoneToDelete(zone);
                  }}
                  aria-label={`Delete ${zone.name}`}
                  className="min-h-11 min-w-11 pointer-coarse:min-h-12 pointer-coarse:min-w-12 p-2 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-error/10 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <dialog
        ref={deleteDialogRef}
        aria-labelledby="delete-zone-title"
        aria-describedby="delete-zone-description"
        onClose={handleDeleteDialogClose}
        onCancel={(event) => {
          if (deleting) event.preventDefault();
        }}
        className="hidden open:flex fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md flex-col overflow-y-auto rounded-xl border border-outline-variant bg-surface p-6 text-on-surface botanical-shadow backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <h3 id="delete-zone-title" className="font-headline-sm text-headline-sm text-on-surface mb-2">
          Delete zone
        </h3>
        <p id="delete-zone-description" className="font-body-md text-body-md text-on-surface-variant mb-6">
          Delete <strong>{zoneToDelete?.name}</strong>? Existing orders keep their saved
          delivery details. This cannot be undone.
        </p>
        <div className="mt-auto flex flex-wrap justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={closeDeleteDialog}
            disabled={deleting}
            className="min-h-11 px-4 py-2 rounded-lg font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            className="min-h-11 px-4 py-2 rounded-lg font-label-sm text-label-sm bg-error text-on-error hover:bg-error/90 transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
