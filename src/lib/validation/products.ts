import { z } from "zod";

export const PRODUCT_KINDS = ["product", "service"] as const;
export const INVENTORY_MOVEMENT_TYPES = [
  "purchase",
  "sale",
  "adjustment",
  "initial",
] as const;

export const createProductSchema = z.object({
  clientId: z.string().uuid(),
  sku: z.string().trim().optional(),
  name: z.string().trim().min(1, "Name is required."),
  description: z.string().trim().optional(),
  kind: z.enum(PRODUCT_KINDS),
  unitPrice: z.coerce.number().nonnegative(),
  costPrice: z.coerce.number().nonnegative().optional(),
  trackInventory: z.coerce.boolean().default(false),
  revenueAccountId: z.string().uuid().optional(),
  cogsAccountId: z.string().uuid().optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.extend({
  productId: z.string().uuid(),
  active: z.coerce.boolean().default(true),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const recordInventoryMovementSchema = z.object({
  productId: z.string().uuid(),
  movementType: z.enum(INVENTORY_MOVEMENT_TYPES),
  quantity: z.coerce.number().refine((v) => v !== 0, "Quantity must be non-zero."),
  note: z.string().trim().optional(),
});
export type RecordInventoryMovementInput = z.infer<
  typeof recordInventoryMovementSchema
>;
