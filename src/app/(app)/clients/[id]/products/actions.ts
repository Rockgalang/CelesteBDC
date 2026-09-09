"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/(auth)/actions";
import { requireRole } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { toDbString, money } from "@/lib/money";
import {
  createProductSchema,
  recordInventoryMovementSchema,
  updateProductSchema,
  type CreateProductInput,
  type RecordInventoryMovementInput,
  type UpdateProductInput,
} from "@/lib/validation/products";

export async function createProductAction(
  input: CreateProductInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products_services").insert({
    client_id: parsed.data.clientId,
    sku: parsed.data.sku || null,
    name: parsed.data.name,
    description: parsed.data.description || null,
    kind: parsed.data.kind,
    unit_price: toDbString(money(parsed.data.unitPrice)),
    cost_price:
      parsed.data.costPrice !== undefined
        ? toDbString(money(parsed.data.costPrice))
        : null,
    track_inventory: parsed.data.trackInventory,
    revenue_account_id: parsed.data.revenueAccountId || null,
    cogs_account_id: parsed.data.cogsAccountId || null,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${parsed.data.clientId}/products`);
  return { ok: true };
}

export async function updateProductAction(
  input: UpdateProductInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products_services")
    .update({
      sku: parsed.data.sku || null,
      name: parsed.data.name,
      description: parsed.data.description || null,
      kind: parsed.data.kind,
      unit_price: toDbString(money(parsed.data.unitPrice)),
      cost_price:
        parsed.data.costPrice !== undefined
          ? toDbString(money(parsed.data.costPrice))
          : null,
      track_inventory: parsed.data.trackInventory,
      revenue_account_id: parsed.data.revenueAccountId || null,
      cogs_account_id: parsed.data.cogsAccountId || null,
      active: parsed.data.active,
    })
    .eq("id", parsed.data.productId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${parsed.data.clientId}/products`);
  return { ok: true };
}

export async function recordInventoryMovementAction(
  clientId: string,
  input: RecordInventoryMovementInput,
): Promise<ActionResult> {
  await requireRole("owner", "staff");

  const parsed = recordInventoryMovementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_inventory_movement", {
    p_product_id: parsed.data.productId,
    p_movement_type: parsed.data.movementType,
    p_quantity: parsed.data.quantity,
    p_note: parsed.data.note || null,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/clients/${clientId}/products`);
  return { ok: true };
}
