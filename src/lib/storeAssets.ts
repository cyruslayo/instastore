import { getCurrentAdminProfile } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

const BUCKET = "product-images";
const MAX_FILE_SIZE = 5_242_880;
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
type ImageMime = keyof typeof TYPES;

function secureId(): string {
  if (typeof crypto === "undefined" || !crypto.randomUUID)
    throw new Error("This browser cannot securely name store images.");
  return crypto.randomUUID();
}

async function upload(file: File, kind: "logo" | "hero"): Promise<string> {
  if (!(file.type in TYPES)) throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Image must be no larger than 5 MiB.");
  const profile = await getCurrentAdminProfile();
  if (!profile) throw new Error("No active merchant store is associated with this account.");
  const mime = file.type as ImageMime;
  const path = `stores/${profile.store_id}/${kind}/${secureId()}.${TYPES[mime]}`;
  const { error } = await getSupabase().storage.from(BUCKET).upload(path, file, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(`Store image upload failed: ${error.message}`);
  return getSupabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export const uploadStoreLogo = (file: File) => upload(file, "logo");
export const uploadStoreHero = (file: File) => upload(file, "hero");

async function managedPath(url: string): Promise<string | null> {
  let parsed: URL;
  let configured: URL;
  try {
    parsed = new URL(url);
    configured = new URL(import.meta.env.PUBLIC_SUPABASE_URL || "");
  } catch {
    return null;
  }
  const prefix = "/storage/v1/object/public/product-images/";
  if (parsed.origin !== configured.origin || !parsed.pathname.startsWith(prefix)) return null;
  let path: string;
  try {
    path = decodeURIComponent(parsed.pathname.slice(prefix.length));
  } catch {
    return null;
  }
  const match = /^stores\/([0-9a-fA-F-]{36})\/(logo|hero)\/[A-Za-z0-9-]{32,36}\.(jpg|png|webp)$/.exec(path);
  if (!match || match[1].toLowerCase() !== (await getCurrentAdminProfile())?.store_id.toLowerCase()) return null;
  return path;
}

export async function isManagedStoreAsset(url: string): Promise<boolean> {
  return Boolean(url.trim() && (await managedPath(url)));
}

export async function deleteManagedStoreAsset(url: string): Promise<boolean> {
  const path = await managedPath(url);
  if (!path) return false;
  const { error } = await getSupabase().storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Store image cleanup failed: ${error.message}`);
  return true;
}
