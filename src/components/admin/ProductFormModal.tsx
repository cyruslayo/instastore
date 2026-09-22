"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Product } from "@/lib/types";
import {
  deleteManagedProductImage,
  uploadProductImage,
} from "@/lib/productImages";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  onSaved: () => void;
  existingCategories?: string[];
}
interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  price: number;
  inventory: number;
  category: string;
  sku: string;
  featured: boolean;
  is_active: boolean;
  currentImage: string;
  removeImage: boolean;
}
const emptyForm = (category: string): ProductFormData => ({
  name: "",
  slug: "",
  description: "",
  price: 0,
  inventory: 0,
  category,
  sku: "",
  featured: false,
  is_active: true,
  currentImage: "",
  removeImage: false,
});
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ProductFormModal({
  isOpen,
  onClose,
  product,
  onSaved,
  existingCategories = [],
}: ProductFormModalProps) {
  const defaultCategory = existingCategories[0] || "General";
  const [formData, setFormData] = useState<ProductFormData>(
    emptyForm(defaultCategory),
  );
  const [newImage, setNewImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const revokePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };
  useEffect(() => {
    revokePreview();
    setNewImage(null);
    setFormData(
      product
        ? {
            name: product.name,
            slug: product.slug,
            description: product.description || "",
            price: product.price,
            inventory: product.inventory,
            category: product.category || defaultCategory,
            sku: product.sku || "",
            featured: product.featured,
            is_active: product.is_active,
            currentImage: product.image || "",
            removeImage: false,
          }
        : emptyForm(defaultCategory),
    );
    setError(null);
    setIsAddingNewCategory(false);
    setNewCategoryName("");
    // Reset only when opening or switching the edited product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, isOpen]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const categoryOptions = Array.from(
    new Set(
      [...existingCategories.filter(Boolean), formData.category].filter(
        Boolean,
      ),
    ),
  );
  const setField = <K extends keyof ProductFormData>(
    key: K,
    value: ProductFormData[K],
  ) => setFormData((current) => ({ ...current, [key]: value }));
  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  const handleNameChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const name = event.target.value;
    setFormData((current) => ({
      ...current,
      name,
      slug:
        current.slug === generateSlug(current.name) || !current.slug
          ? generateSlug(name)
          : current.slug,
    }));
  };
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Product image must be a JPEG, PNG, or WebP file.");
      return;
    }
    if (file.size > 5_242_880) {
      setError("Product image must be no larger than 5 MiB.");
      return;
    }
    revokePreview();
    setNewImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setField("removeImage", false);
    setError(null);
  };
  const save = async () => {
    setError(null);
    const category = isAddingNewCategory
      ? newCategoryName.trim()
      : formData.category.trim();
    if (!formData.name.trim() || !formData.slug.trim() || !category) {
      setError(
        isAddingNewCategory
          ? "Enter a category name."
          : "Name, slug, and category are required.",
      );
      return;
    }
    if (!Number.isFinite(formData.price) || formData.price < 0) {
      setError("Price must be a non-negative number.");
      return;
    }
    if (!Number.isInteger(formData.inventory) || formData.inventory < 0) {
      setError("Inventory must be a whole number of 0 or greater.");
      return;
    }
    setIsSaving(true);
    let uploadedImage: string | null = null;
    try {
      if (newImage) uploadedImage = await uploadProductImage(newImage);
      const image =
        uploadedImage ||
        (formData.removeImage ? null : formData.currentImage || null);
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        description: formData.description,
        price: formData.price,
        inventory: formData.inventory,
        category,
        image,
        sku: formData.sku.trim() || null,
        featured: formData.featured,
        is_active: formData.is_active,
      };
      const { getSupabase } = await import("@/lib/supabase");
      const { getCurrentAdminProfile } = await import("@/lib/auth");
      const supabase = getSupabase();
      let result;
      if (product?.id) {
        result = await supabase.from("products").update(payload).eq("id", product.id);
      } else {
        const profile = await getCurrentAdminProfile();
        if (!profile)
          throw new Error("No active merchant store is associated with this account.");
        result = await supabase
          .from("products")
          .insert({ ...payload, store_id: profile.store_id });
      }
      if (result.error) throw result.error;
      onSaved();
      onClose();
    } catch (cause) {
      if (uploadedImage) {
        try {
          await deleteManagedProductImage(uploadedImage);
        } catch (cleanupError) {
          console.warn(
            "Unable to clean up uncommitted product image",
            cleanupError,
          );
        }
      }
      const message =
        cause instanceof Error ? cause.message : "Failed to save product.";
      console.error("Error saving product:", cause);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };
  if (!isOpen) return null;
  const imageToShow =
    previewUrl || (formData.removeImage ? null : formData.currentImage);
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-surface rounded-t-3xl sm:rounded-2xl border border-outline-variant botanical-shadow max-w-2xl w-full flex flex-col max-h-[92dvh] animate-in fade-in sm:zoom-in duration-200">
        <div className="flex justify-between items-center px-5 py-4 sm:p-6 border-b border-outline-variant shrink-0">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-secondary font-bold block">
              Catalog Management
            </span>
            <h3 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-bold">
              {product ? "Edit Product" : "Add New Product"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="touch-target flex items-center justify-center p-2 text-on-surface-variant hover:bg-surface-container rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          className="px-5 py-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-5"
        >
          {error && (
            <div
              role="alert"
              className="p-3.5 bg-error/10 text-error rounded-xl text-xs sm:text-sm font-medium"
            >
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <Field
              label="Name"
              value={formData.name}
              onChange={handleNameChange}
              required
            />
            <Field
              label="Slug (URL)"
              name="slug"
              value={formData.slug}
              onChange={(e) => setField("slug", e.target.value)}
              required
            />
            <Field
              label="Description"
              name="description"
              value={formData.description}
              onChange={(e) => setField("description", e.target.value)}
              multiline
            />
            <Field
              label="Price (₦)"
              name="price"
              type="number"
              min="0"
              step="0.01"
              value={String(formData.price)}
              onChange={(e) => setField("price", Number(e.target.value))}
              required
            />
            <Field
              label="Inventory Count"
              name="inventory"
              type="number"
              min="0"
              value={String(formData.inventory)}
              onChange={(e) => setField("inventory", Number(e.target.value))}
              required
            />
            <Field
              label="SKU (optional)"
              name="sku"
              value={formData.sku}
              onChange={(e) => setField("sku", e.target.value)}
            />
            <label className="space-y-2">
              <span className="font-label-md text-label-md text-on-surface-variant">
                Category
              </span>
              {isAddingNewCategory ? (
                <input
                  required
                  value={newCategoryName}
                  placeholder="e.g. Accessories"
                  onChange={(e) => {
                    setNewCategoryName(e.target.value);
                    setField("category", e.target.value);
                  }}
                  className={inputClass}
                />
              ) : (
                <select
                  name="category"
                  value={formData.category}
                  onChange={(e) =>
                    e.target.value === "__new__"
                      ? (setIsAddingNewCategory(true), setNewCategoryName(""), setField("category", ""))
                      : setField("category", e.target.value)
                  }
                  className={inputClass}
                >
                  {categoryOptions.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                  <option value="__new__">+ New Custom Category...</option>
                </select>
              )}
              <button
                type="button"
                onClick={() => {
                  const choosingExisting = isAddingNewCategory;
                  setIsAddingNewCategory(!isAddingNewCategory);
                  if (choosingExisting) {
                    setField("category", existingCategories[0] || "General");
                  } else {
                    setNewCategoryName("");
                    setField("category", "");
                  }
                }}
                className="text-xs text-primary underline"
              >
                {isAddingNewCategory
                  ? "Choose from existing"
                  : "+ Add new category"}
              </button>
            </label>
            <div className="sm:col-span-2 space-y-3">
              <span className="font-label-md text-label-md text-on-surface-variant block">
                Product Image
              </span>
              {imageToShow ? (
                <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-surface-container">
                  <img
                    src={imageToShow}
                    alt={formData.name || "Product preview"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-xl bg-surface-container-highest flex items-center justify-center text-xs text-on-surface-variant">
                  No image
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="block w-full text-sm"
              />
              <p className="text-[11px] text-on-surface-variant">
                JPEG, PNG, or WebP. Maximum 5 MiB.
              </p>
              {(formData.currentImage || newImage) && (
                <button
                  type="button"
                  onClick={() => {
                    revokePreview();
                    setNewImage(null);
                    setField("removeImage", true);
                  }}
                  className="text-xs text-error underline"
                >
                  Remove current image
                </button>
              )}
            </div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.featured}
                onChange={(e) => setField("featured", e.target.checked)}
                className="w-5 h-5"
              />
              <span className="font-body-md text-on-surface">
                Featured product
              </span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setField("is_active", e.target.checked)}
                className="w-5 h-5"
              />
              <span className="font-body-md text-on-surface">
                Product is Active (Visible on store)
              </span>
            </label>
          </div>
        </form>
        <div className="p-6 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-lg text-on-surface-variant"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-lg bg-primary text-on-primary disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Product"}
          </button>
        </div>
      </div>
    </div>
  );
}
const inputClass =
  "w-full p-3 bg-surface border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";
function Field({
  label,
  value,
  onChange,
  multiline = false,
  ...props
}: {
  label: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  multiline?: boolean;
  [key: string]: unknown;
}) {
  const Tag = multiline ? "textarea" : "input";
  const fieldId = String(
    props.id || props.name || label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  );
  return (
    <label className="space-y-2" htmlFor={fieldId}>
      <span className="font-label-md text-label-md text-on-surface-variant">
        {label}
      </span>
      <Tag
        {...props}
        id={fieldId}
        value={value}
        onChange={onChange}
        className={inputClass}
      />
    </label>
  );
}
