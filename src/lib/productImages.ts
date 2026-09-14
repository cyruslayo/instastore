import { getSupabase } from "@/lib/supabase";

const BUCKET = "product-images";
const MAX_FILE_SIZE = 5_242_880;
const MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
type ProductImageMime = keyof typeof MIME_EXTENSIONS;

function createSecureId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }
  throw new Error("This browser cannot securely name product images.");
}

function validateFile(file: File): ProductImageMime {
  if (!(file.type in MIME_EXTENSIONS)) {
    throw new Error("Product image must be a JPEG, PNG, or WebP file.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Product image must be no larger than 5 MiB.");
  }
  return file.type as ProductImageMime;
}

export async function uploadProductImage(file: File): Promise<string> {
  const mime = validateFile(file);
  const path = `products/${createSecureId()}.${MIME_EXTENSIONS[mime]}`;
  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, file, {
      contentType: mime,
      upsert: false,
    });
  if (error) throw new Error(`Product image upload failed: ${error.message}`);
  return getSupabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function deleteManagedProductImage(
  imageUrl: string,
): Promise<boolean> {
  if (!imageUrl.trim()) return false;
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return false;
  }
  const configuredUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return false;
  let configured: URL;
  try {
    configured = new URL(configuredUrl);
  } catch {
    return false;
  }
  const prefix = "/storage/v1/object/public/product-images/";
  if (
    parsed.origin !== configured.origin ||
    !parsed.pathname.startsWith(prefix)
  )
    return false;
  const encodedPath = parsed.pathname.slice(prefix.length);
  let objectPath: string;
  try {
    objectPath = decodeURIComponent(encodedPath);
  } catch {
    return false;
  }
  if (!/^products\/[A-Za-z0-9-]{20,64}\.(jpg|jpeg|png|webp)$/.test(objectPath))
    return false;
  if (
    objectPath.split("/").some((segment) => segment === ".." || segment === ".")
  )
    return false;
  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .remove([objectPath]);
  if (error) throw new Error(`Product image cleanup failed: ${error.message}`);
  return true;
}
