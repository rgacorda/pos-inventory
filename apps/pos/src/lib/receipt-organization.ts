import { dbHelpers } from "@/lib/db";
import {
  cachedOrganizationName,
  type ReceiptOrganization,
} from "@/lib/receipt-template";

function nonempty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/**
 * Store header for a receipt. The name is taken from IndexedDB when that
 * record has loaded, and from the login cache otherwise, so printing before
 * the database read finishes still shows the real store name.
 */
export async function readReceiptOrganization(
  current?: ReceiptOrganization | null,
): Promise<ReceiptOrganization | null> {
  let loaded: Awaited<ReturnType<typeof dbHelpers.getOrganization>> = null;
  try {
    loaded = await dbHelpers.getOrganization();
  } catch {
    loaded = null;
  }
  const name =
    nonempty(loaded?.name) ||
    nonempty(current?.name) ||
    cachedOrganizationName();
  if (!name) return null;

  try {
    localStorage.setItem("organizationName", name);
  } catch {
    // Ignore quota or private-mode failures; the name is still returned.
  }

  return {
    name,
    address: nonempty(loaded?.address) || nonempty(current?.address),
    phone: nonempty(loaded?.phone) || nonempty(current?.phone),
  };
}
