"use client";

import { useState, useTransition } from "react";

import {
  createProductAction,
  recordInventoryMovementAction,
  updateProductAction,
} from "@/app/(app)/clients/[id]/products/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPeso } from "@/lib/format";
import { money } from "@/lib/money";
import {
  INVENTORY_MOVEMENT_TYPES,
  PRODUCT_KINDS,
} from "@/lib/validation/products";
import type { ProductKind, ProductsServicesRow } from "@/lib/supabase/types";

type AccountOption = { id: string; code: string; name: string };

const NO_ACCOUNT = "none";

const EMPTY_DRAFT = {
  sku: "",
  name: "",
  description: "",
  kind: "product" as ProductKind,
  unitPrice: "",
  costPrice: "",
  trackInventory: false,
  revenueAccountId: NO_ACCOUNT,
  cogsAccountId: NO_ACCOUNT,
};

export function ProductsPanel({
  clientId,
  products,
  revenueAccounts,
  cogsAccounts,
}: {
  clientId: string;
  products: ProductsServicesRow[];
  revenueAccounts: AccountOption[];
  cogsAccounts: AccountOption[];
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const onAdd = () => {
    setError(null);
    startTransition(async () => {
      const result = await createProductAction({
        clientId,
        sku: draft.sku || undefined,
        name: draft.name,
        description: draft.description || undefined,
        kind: draft.kind,
        unitPrice: Number(draft.unitPrice || 0),
        costPrice: draft.costPrice ? Number(draft.costPrice) : undefined,
        trackInventory: draft.trackInventory,
        revenueAccountId:
          draft.revenueAccountId === NO_ACCOUNT ? undefined : draft.revenueAccountId,
        cogsAccountId:
          draft.cogsAccountId === NO_ACCOUNT ? undefined : draft.cogsAccountId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(EMPTY_DRAFT);
      setShowAddForm(false);
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Products & services</CardTitle>
          {!showAddForm && (
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              Add item
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddForm && (
            <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>SKU (optional)</Label>
                <Input
                  value={draft.sku}
                  onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kind</Label>
                <Select
                  value={draft.kind}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, kind: v as ProductKind }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_KINDS.map((k) => (
                      <SelectItem key={k} value={k} className="capitalize">
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label>Description</Label>
                <Input
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                  placeholder="What this item is, for the client's records"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.unitPrice}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, unitPrice: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cost price (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.costPrice}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, costPrice: e.target.value }))
                  }
                />
              </div>
              <div className="flex items-end gap-2 pb-1.5">
                <Checkbox
                  checked={draft.trackInventory}
                  onCheckedChange={(checked) =>
                    setDraft((d) => ({ ...d, trackInventory: checked === true }))
                  }
                />
                <Label>Track inventory</Label>
              </div>
              <div className="space-y-1.5">
                <Label>Revenue account</Label>
                <Select
                  value={draft.revenueAccountId}
                  onValueChange={(v) =>
                    setDraft((d) => ({ ...d, revenueAccountId: v }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ACCOUNT}>None</SelectItem>
                    {revenueAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>COGS/expense account</Label>
                <Select
                  value={draft.cogsAccountId}
                  onValueChange={(v) => setDraft((d) => ({ ...d, cogsAccountId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ACCOUNT}>None</SelectItem>
                    {cogsAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 sm:col-span-3">
                {error && <p className="text-destructive text-sm">{error}</p>}
              </div>
              <div className="flex gap-2 sm:col-span-3">
                <Button size="sm" disabled={isPending || !draft.name.trim()} onClick={onAdd}>
                  Save item
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddForm(false);
                    setDraft(EMPTY_DRAFT);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {products.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Unit price</TableHead>
                    <TableHead>Qty on hand</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <ProductRow
                      key={p.id}
                      clientId={clientId}
                      product={p}
                      revenueAccounts={revenueAccounts}
                      cogsAccounts={cogsAccounts}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No products or services yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProductRow({
  clientId,
  product,
  revenueAccounts,
  cogsAccounts,
}: {
  clientId: string;
  product: ProductsServicesRow;
  revenueAccounts: AccountOption[];
  cogsAccounts: AccountOption[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [edit, setEdit] = useState({
    sku: product.sku ?? "",
    name: product.name,
    description: product.description ?? "",
    kind: product.kind,
    unitPrice: product.unit_price,
    costPrice: product.cost_price ?? "",
    trackInventory: product.track_inventory,
    revenueAccountId: product.revenue_account_id ?? NO_ACCOUNT,
    cogsAccountId: product.cogs_account_id ?? NO_ACCOUNT,
    active: product.active,
  });
  const [movementType, setMovementType] = useState<(typeof INVENTORY_MOVEMENT_TYPES)[number]>(
    "adjustment",
  );
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateProductAction({
        productId: product.id,
        clientId,
        sku: edit.sku || undefined,
        name: edit.name,
        description: edit.description || undefined,
        kind: edit.kind,
        unitPrice: Number(edit.unitPrice || 0),
        costPrice: edit.costPrice ? Number(edit.costPrice) : undefined,
        trackInventory: edit.trackInventory,
        revenueAccountId:
          edit.revenueAccountId === NO_ACCOUNT ? undefined : edit.revenueAccountId,
        cogsAccountId:
          edit.cogsAccountId === NO_ACCOUNT ? undefined : edit.cogsAccountId,
        active: edit.active,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIsEditing(false);
    });
  };

  const onAdjust = () => {
    setError(null);
    startTransition(async () => {
      const result = await recordInventoryMovementAction(clientId, {
        productId: product.id,
        movementType,
        quantity: Number(quantity || 0),
        note: note || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setQuantity("");
      setNote("");
      setIsAdjusting(false);
    });
  };

  if (isEditing) {
    return (
      <TableRow>
        <TableCell colSpan={6}>
          <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={edit.name}
                onChange={(e) => setEdit((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Input
                value={edit.sku}
                onChange={(e) => setEdit((d) => ({ ...d, sku: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select
                value={edit.kind}
                onValueChange={(v) =>
                  setEdit((d) => ({ ...d, kind: v as ProductKind }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_KINDS.map((k) => (
                    <SelectItem key={k} value={k} className="capitalize">
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label>Description</Label>
              <Input
                value={edit.description}
                onChange={(e) =>
                  setEdit((d) => ({ ...d, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit price</Label>
              <Input
                type="number"
                step="0.01"
                value={edit.unitPrice}
                onChange={(e) =>
                  setEdit((d) => ({ ...d, unitPrice: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cost price</Label>
              <Input
                type="number"
                step="0.01"
                value={edit.costPrice}
                onChange={(e) =>
                  setEdit((d) => ({ ...d, costPrice: e.target.value }))
                }
              />
            </div>
            <div className="flex items-end gap-4 pb-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={edit.trackInventory}
                  onCheckedChange={(checked) =>
                    setEdit((d) => ({ ...d, trackInventory: checked === true }))
                  }
                />
                <Label>Track inventory</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={edit.active}
                  onCheckedChange={(checked) =>
                    setEdit((d) => ({ ...d, active: checked === true }))
                  }
                />
                <Label>Active</Label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Revenue account</Label>
              <Select
                value={edit.revenueAccountId}
                onValueChange={(v) =>
                  setEdit((d) => ({ ...d, revenueAccountId: v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACCOUNT}>None</SelectItem>
                  {revenueAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>COGS/expense account</Label>
              <Select
                value={edit.cogsAccountId}
                onValueChange={(v) => setEdit((d) => ({ ...d, cogsAccountId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACCOUNT}>None</SelectItem>
                  {cogsAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-destructive text-sm sm:col-span-3">{error}</p>}
            <div className="flex gap-2 sm:col-span-3">
              <Button size="sm" disabled={isPending} onClick={onSave}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-2">
            {product.name}
            {!product.active && <Badge variant="outline">Inactive</Badge>}
          </div>
          {product.description && (
            <p className="text-muted-foreground text-xs">{product.description}</p>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground">{product.sku ?? "—"}</TableCell>
        <TableCell className="capitalize">{product.kind}</TableCell>
        <TableCell>{formatPeso(money(product.unit_price))}</TableCell>
        <TableCell>
          {product.track_inventory ? product.quantity_on_hand : "—"}
        </TableCell>
        <TableCell className="space-x-1">
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
          {product.track_inventory && (
            <Button size="sm" variant="ghost" onClick={() => setIsAdjusting(!isAdjusting)}>
              Adjust stock
            </Button>
          )}
        </TableCell>
      </TableRow>
      {isAdjusting && (
        <TableRow>
          <TableCell colSpan={6}>
            <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={movementType}
                  onValueChange={(v) =>
                    setMovementType(v as (typeof INVENTORY_MOVEMENT_TYPES)[number])
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_MOVEMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity (+/-)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-28"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label>Note</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <Button size="sm" disabled={isPending || !quantity} onClick={onAdjust}>
                Record
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAdjusting(false)}>
                Cancel
              </Button>
            </div>
            {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
