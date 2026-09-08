"use client";

import { useState, useTransition } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import {
  createTemplateAccountAction,
  deleteTemplateAccountAction,
  deleteTemplateSetAction,
  duplicateTemplateSetAction,
  renameTemplateSetAction,
  setTemplateSetDefaultsAction,
  updateTemplateAccountAction,
} from "@/app/(app)/settings/accounting-standards/actions";
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
import { ACCOUNT_TYPES, NORMAL_BALANCES } from "@/lib/validation/accounting";
import { ENTITY_TYPES, ENTITY_TYPE_LABELS } from "@/lib/validation/self-registration";
import type {
  AccountType,
  ChartOfAccountTemplateSetsRow,
  ChartOfAccountTemplatesRow,
  EntityType,
  NormalBalance,
} from "@/lib/supabase/types";

export function AccountingStandardsPanel({
  sets,
  templates,
}: {
  sets: ChartOfAccountTemplateSetsRow[];
  templates: ChartOfAccountTemplatesRow[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {sets.map((set) => (
        <TemplateSetCard
          key={set.id}
          set={set}
          rows={templates.filter((t) => t.template_set_id === set.id)}
          expanded={expandedId === set.id}
          onToggleExpand={() =>
            setExpandedId(expandedId === set.id ? null : set.id)
          }
        />
      ))}
    </div>
  );
}

function TemplateSetCard({
  set,
  rows,
  expanded,
  onToggleExpand,
}: {
  set: ChartOfAccountTemplateSetsRow;
  rows: ChartOfAccountTemplatesRow[];
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [isEditingDefaults, setIsEditingDefaults] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [name, setName] = useState(set.name);
  const [description, setDescription] = useState(set.description ?? "");
  const [duplicateName, setDuplicateName] = useState("");
  const [showDuplicateForm, setShowDuplicateForm] = useState(false);
  const [defaultTypes, setDefaultTypes] = useState<EntityType[]>(
    set.default_for_entity_types,
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSaveRename = () => {
    setError(null);
    startTransition(async () => {
      const result = await renameTemplateSetAction({
        setId: set.id,
        name,
        description: description || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIsRenaming(false);
    });
  };

  const onDuplicate = () => {
    setError(null);
    startTransition(async () => {
      const result = await duplicateTemplateSetAction({
        setId: set.id,
        name: duplicateName,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDuplicateName("");
      setShowDuplicateForm(false);
    });
  };

  const onDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteTemplateSetAction(set.id);
      if (!result.ok) setError(result.error);
    });
  };

  const onSaveDefaults = () => {
    setError(null);
    startTransition(async () => {
      const result = await setTemplateSetDefaultsAction({
        setId: set.id,
        entityTypes: defaultTypes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIsEditingDefaults(false);
    });
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 text-left"
          >
            {expanded ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronRightIcon className="size-4" />
            )}
            <CardTitle>{set.name}</CardTitle>
          </button>
          <div className="flex flex-wrap gap-1.5">
            {set.is_builtin && <Badge variant="secondary">Built-in</Badge>}
            {set.default_for_entity_types.map((t) => (
              <Badge key={t} variant="outline">
                Default: {ENTITY_TYPE_LABELS[t]}
              </Badge>
            ))}
          </div>
        </div>
        {set.description && !isRenaming && (
          <p className="text-muted-foreground text-sm">{set.description}</p>
        )}

        {isRenaming ? (
          <div className="space-y-2 rounded-md border p-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={isPending} onClick={onSaveRename}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsRenaming(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : isEditingDefaults ? (
          <div className="space-y-2 rounded-md border p-3">
            <Label>Default for entity types</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {ENTITY_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={defaultTypes.includes(t)}
                    onCheckedChange={(checked) =>
                      setDefaultTypes((prev) =>
                        checked ? [...prev, t] : prev.filter((x) => x !== t),
                      )
                    }
                  />
                  {ENTITY_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Assigning an entity type here removes it from whichever other
              template currently claims it.
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={isPending} onClick={onSaveDefaults}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingDefaults(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : showDuplicateForm ? (
          <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
            <div className="flex-1 space-y-1.5">
              <Label>New template name</Label>
              <Input
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder={`${set.name} (Copy)`}
              />
            </div>
            <Button
              size="sm"
              disabled={isPending || !duplicateName.trim()}
              onClick={onDuplicate}
            >
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDuplicateForm(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsRenaming(true)}>
              Rename
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditingDefaults(true)}
            >
              Set defaults
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDuplicateForm(true)}
            >
              Duplicate
            </Button>
            {!set.is_builtin &&
              (isConfirmingDelete ? (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={onDelete}
                  >
                    Confirm delete
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsConfirmingDelete(false)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsConfirmingDelete(true)}
                >
                  Delete
                </Button>
              ))}
          </div>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardHeader>

      {expanded && (
        <CardContent>
          <TemplateAccountsEditor templateSetId={set.id} rows={rows} />
        </CardContent>
      )}
    </Card>
  );
}

const EMPTY_ACCOUNT_DRAFT = {
  code: "",
  name: "",
  type: "expense" as AccountType,
  normalBalance: "debit" as NormalBalance,
  parentCode: "",
  sequence: 999,
};

function TemplateAccountsEditor({
  templateSetId,
  rows,
}: {
  templateSetId: string;
  rows: ChartOfAccountTemplatesRow[];
}) {
  const [draft, setDraft] = useState(EMPTY_ACCOUNT_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(EMPTY_ACCOUNT_DRAFT);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sorted = [...rows].sort((a, b) => a.sequence - b.sequence);

  const onAdd = () => {
    setError(null);
    startTransition(async () => {
      const result = await createTemplateAccountAction({
        templateSetId,
        ...draft,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(EMPTY_ACCOUNT_DRAFT);
    });
  };

  const startEdit = (row: ChartOfAccountTemplatesRow) => {
    setEditingId(row.id);
    setEditDraft({
      code: row.code,
      name: row.name,
      type: row.type,
      normalBalance: row.normal_balance,
      parentCode: row.parent_code ?? "",
      sequence: row.sequence,
    });
  };

  const onSaveEdit = () => {
    if (!editingId) return;
    setError(null);
    startTransition(async () => {
      const result = await updateTemplateAccountAction({
        templateId: editingId,
        templateSetId,
        ...editDraft,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditingId(null);
    });
  };

  const onDelete = (templateId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await deleteTemplateAccountAction(templateId);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Normal balance</TableHead>
              <TableHead>Parent code</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const isEditing = editingId === row.id;
              if (isEditing) {
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Input
                        value={editDraft.code}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, code: e.target.value }))
                        }
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editDraft.name}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, name: e.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={editDraft.type}
                        onValueChange={(v) =>
                          setEditDraft((d) => ({ ...d, type: v as AccountType }))
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="capitalize">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={editDraft.normalBalance}
                        onValueChange={(v) =>
                          setEditDraft((d) => ({
                            ...d,
                            normalBalance: v as NormalBalance,
                          }))
                        }
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NORMAL_BALANCES.map((b) => (
                            <SelectItem key={b} value={b} className="capitalize">
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editDraft.parentCode}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            parentCode: e.target.value,
                          }))
                        }
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell className="space-x-1">
                      <Button size="sm" disabled={isPending} onClick={onSaveEdit}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              }
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-mono">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="capitalize">{row.type}</TableCell>
                  <TableCell className="capitalize">
                    {row.normal_balance}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.parent_code ?? "—"}
                  </TableCell>
                  <TableCell className="space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => onDelete(row.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-6">
        <div className="space-y-1.5 sm:col-span-1">
          <Label>Code</Label>
          <Input
            value={draft.code}
            onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Name</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select
            value={draft.type}
            onValueChange={(v) =>
              setDraft((d) => ({ ...d, type: v as AccountType }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Normal balance</Label>
          <Select
            value={draft.normalBalance}
            onValueChange={(v) =>
              setDraft((d) => ({ ...d, normalBalance: v as NormalBalance }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NORMAL_BALANCES.map((b) => (
                <SelectItem key={b} value={b} className="capitalize">
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Parent code</Label>
          <Input
            value={draft.parentCode}
            onChange={(e) =>
              setDraft((d) => ({ ...d, parentCode: e.target.value }))
            }
          />
        </div>
        <div className="sm:col-span-6">
          {error && <p className="text-destructive mb-2 text-sm">{error}</p>}
          <Button size="sm" disabled={isPending} onClick={onAdd}>
            Add account
          </Button>
        </div>
      </div>
    </div>
  );
}
