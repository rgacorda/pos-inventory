"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  showSuccessToast,
  showErrorFromException,
  showErrorToast,
} from "@/lib/toast-utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { printVarianceSummary } from "@/lib/variance-print";

interface VarianceCount {
  id: string;
  countedQuantity: number;
  systemQuantity: number;
  variance: number;
  countedByName: string;
  updatedAt: string;
}

interface VarianceRow {
  productId: string;
  name: string;
  sku: string;
  barcode?: string | null;
  category?: string | null;
  status: string;
  stockQuantity: number;
  cost: number;
  packQuantity?: number | null;
  halfPackQuantity?: number | null;
  count: VarianceCount | null;
}

type VarianceFilter = "all" | "counted" | "differences" | "uncounted";
type SortColumn = "name" | "sku" | "stock" | "counted" | "difference" | "countedBy";

interface VarianceIssue {
  productId: string;
  countId: string;
  name: string;
  sku: string;
  reason: string;
}

const FILTERS: { id: VarianceFilter; label: string }[] = [
  { id: "all", label: "All products" },
  { id: "counted", label: "Counted" },
  { id: "differences", label: "Differences" },
  { id: "uncounted", label: "Not counted" },
];

const SAVE_DELAY_MS = 400;

interface CountDraft {
  packs: string;
  halves: string;
  units: string;
}

function emptyDraft(): CountDraft {
  return { packs: "", halves: "", units: "" };
}

function isBlankDraft(draft: CountDraft | undefined) {
  if (!draft) return true;
  return draft.packs.trim() === "" && draft.halves.trim() === "" && draft.units.trim() === "";
}

function positiveInt(value: number | null | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function packSize(row: Pick<VarianceRow, "packQuantity">) {
  return positiveInt(row.packQuantity);
}

function halfPackSize(row: Pick<VarianceRow, "halfPackQuantity">) {
  return positiveInt(row.halfPackQuantity);
}

function parsePart(raw: string): number | null {
  const value = raw.trim();
  if (value === "") return 0;
  if (!/^\d+$/.test(value)) return null;
  return parseInt(value, 10);
}

function splitQuantity(total: number, row: VarianceRow): CountDraft {
  const pack = packSize(row);
  const half = halfPackSize(row);
  if (total <= 0 || (pack === 0 && half === 0)) {
    return { packs: "", halves: "", units: String(Math.max(0, total)) };
  }

  let remaining = total;
  let packs = 0;
  let halves = 0;
  const bundles = [
    pack > 0 ? { kind: "pack" as const, size: pack } : null,
    half > 0 ? { kind: "half" as const, size: half } : null,
  ]
    .filter((bundle): bundle is { kind: "pack" | "half"; size: number } => bundle !== null)
    .sort((a, b) => b.size - a.size);

  for (const bundle of bundles) {
    const count = Math.floor(remaining / bundle.size);
    if (count <= 0) continue;
    remaining -= count * bundle.size;
    if (bundle.kind === "pack") packs = count;
    else halves = count;
  }

  return {
    packs: packs > 0 ? String(packs) : "",
    halves: halves > 0 ? String(halves) : "",
    units: remaining > 0 ? String(remaining) : "",
  };
}

function draftFromRow(row: VarianceRow): CountDraft {
  if (!row.count) return emptyDraft();
  return splitQuantity(row.count.countedQuantity, row);
}

function countFromDraft(draft: CountDraft | undefined, row: VarianceRow): number | null {
  const value = draft ?? emptyDraft();
  if (isBlankDraft(value)) return null;
  const packs = parsePart(value.packs);
  const halves = parsePart(value.halves);
  const units = parsePart(value.units);
  if (packs === null || halves === null || units === null) return null;
  return packs * packSize(row) + halves * halfPackSize(row) + units;
}

function quantityPartsLabel(total: number, row: VarianceRow): string | null {
  if (packSize(row) === 0 && halfPackSize(row) === 0) return null;
  if (total <= 0) return null;
  const split = splitQuantity(total, row);
  const parts: string[] = [];
  if (split.packs) parts.push(`${split.packs} pack${split.packs === "1" ? "" : "s"}`);
  if (split.halves) parts.push(`${split.halves} half`);
  if (split.units) parts.push(`${split.units} pc`);
  return parts.length > 0 ? parts.join(" + ") : null;
}

export default function VarianceInventoryPage() {
  const [rows, setRows] = useState<VarianceRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CountDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const rowsRef = useRef<VarianceRow[]>([]);
  const draftsRef = useRef<Record<string, CountDraft>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const chainRef = useRef<Record<string, Promise<void>>>({});
  const savedValuesRef = useRef<Record<string, number | null>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<VarianceFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [applyTarget, setApplyTarget] = useState<"all" | string | null>(null);
  const [applyIssues, setApplyIssues] = useState<VarianceIssue[]>([]);
  const [readyToUpdate, setReadyToUpdate] = useState(0);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const itemsPerPage = 20;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      const user = raw ? JSON.parse(raw) : null;
      setIsAdmin(user?.role === "ADMIN");
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    loadWorksheet();
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  rowsRef.current = rows;
  draftsRef.current = drafts;

  function rememberDrafts(nextRows: VarianceRow[]) {
    const nextDrafts: Record<string, CountDraft> = {};
    for (const row of nextRows) {
      nextDrafts[row.productId] = draftFromRow(row);
    }
    setDrafts(nextDrafts);
  }

  function syncSavedValues(nextRows: VarianceRow[]) {
    const next: Record<string, number | null> = {};
    for (const row of nextRows) {
      next[row.productId] = row.count ? row.count.countedQuantity : null;
    }
    savedValuesRef.current = next;
  }

  async function loadWorksheet(options?: { quiet?: boolean; keepDrafts?: boolean }) {
    try {
      if (!options?.quiet) setLoading(true);
      const data: VarianceRow[] = await apiClient.getVarianceWorksheet();
      setRows(data);
      syncSavedValues(data);
      if (options?.keepDrafts) {
        setDrafts((current) => {
          const next: Record<string, CountDraft> = {};
          for (const row of data) {
            next[row.productId] = current[row.productId] ?? draftFromRow(row);
          }
          return next;
        });
      } else {
        rememberDrafts(data);
      }
    } catch (error) {
      showErrorFromException(error, "Failed to load variance inventory");
    } finally {
      if (!options?.quiet) setLoading(false);
    }
  }

  function isDirty(row: VarianceRow) {
    const draft = drafts[row.productId];
    const saved = row.count ? row.count.countedQuantity : null;
    if (isBlankDraft(draft)) return saved !== null;
    const total = countFromDraft(draft, row);
    if (total === null) return true;
    return total !== saved;
  }

  function draftError(row: VarianceRow) {
    const draft = drafts[row.productId];
    if (isBlankDraft(draft)) return null;
    if (countFromDraft(draft, row) === null) return "Enter a whole number of 0 or more";
    return null;
  }

  function displayedCount(row: VarianceRow) {
    const draft = drafts[row.productId];
    if (draft && !isBlankDraft(draft)) {
      const parsed = countFromDraft(draft, row);
      if (parsed !== null) return parsed;
    }
    return row.count ? row.count.countedQuantity : null;
  }

  function stockAtCount(row: VarianceRow) {
    return row.count ? Number(row.count.systemQuantity) : row.stockQuantity;
  }

  function difference(row: VarianceRow) {
    const counted = displayedCount(row);
    if (counted === null) return null;
    return counted - stockAtCount(row);
  }

  const summary = useMemo(() => {
    let counted = 0;
    let shortages = 0;
    let overages = 0;
    let matches = 0;
    let netUnits = 0;
    for (const row of rows) {
      const delta = difference(row);
      if (delta === null) continue;
      counted += 1;
      netUnits += delta;
      if (delta < 0) shortages += 1;
      else if (delta > 0) overages += 1;
      else matches += 1;
    }
    return { counted, shortages, overages, matches, netUnits };
  }, [rows, drafts]);

  const filteredRows = useMemo(() => {
    const terms = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const issueIds = showIssuesOnly ? new Set(applyIssues.map((issue) => issue.productId)) : null;
    return rows.filter((row) => {
      if (issueIds && !issueIds.has(row.productId)) return false;
      const delta = difference(row);
      if (filter === "counted" && displayedCount(row) === null) return false;
      if (filter === "uncounted" && displayedCount(row) !== null) return false;
      if (filter === "differences" && (delta === null || delta === 0)) return false;
      if (terms.length === 0) return true;
      return terms.every(
        (term) =>
          row.name?.toLowerCase().includes(term) ||
          row.sku?.toLowerCase().includes(term) ||
          row.barcode?.toLowerCase().includes(term) ||
          row.category?.toLowerCase().includes(term),
      );
    });
  }, [rows, drafts, searchQuery, filter, showIssuesOnly, applyIssues]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows;
    const direction = sortDirection === "asc" ? 1 : -1;
    const valueOf = (row: VarianceRow) => {
      if (sortColumn === "name") return row.name.toLowerCase();
      if (sortColumn === "sku") return row.sku.toLowerCase();
      if (sortColumn === "stock") return stockAtCount(row);
      if (sortColumn === "counted") return displayedCount(row);
      if (sortColumn === "difference") return difference(row);
      return (row.count?.countedByName || "").toLowerCase();
    };
    return [...filteredRows].sort((a, b) => {
      const aValue = valueOf(a);
      const bValue = valueOf(b);
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });
  }, [filteredRows, sortColumn, sortDirection, drafts, rows]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const pageRows = sortedRows.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  function collectDirty(productIds?: string[]) {
    const allowed = productIds ? new Set(productIds) : null;
    const invalid = rows.filter((row) => {
      if (allowed && !allowed.has(row.productId)) return false;
      return isDirty(row) && draftError(row);
    });
    if (invalid.length > 0) {
      throw new Error(draftError(invalid[0]) || "Enter a valid count");
    }
    return rows.flatMap((row) => {
      if (allowed && !allowed.has(row.productId)) return [];
      if (!isDirty(row)) return [];
      const countedQuantity = countFromDraft(drafts[row.productId], row);
      if (countedQuantity === null) return [];
      return [{ productId: row.productId, countedQuantity }];
    });
  }

  function markSaving(productId: string, isSaving: boolean) {
    setSavingIds((current) => {
      const next = new Set(current);
      if (isSaving) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }

  function enqueue(productId: string, task: () => Promise<void>) {
    const previous = chainRef.current[productId] ?? Promise.resolve();
    const next = previous.then(task, task);
    chainRef.current[productId] = next;
  }

  function replaceRow(productId: string, nextRow: VarianceRow) {
    rowsRef.current = rowsRef.current.map((row) =>
      row.productId === productId ? nextRow : row,
    );
    setRows(rowsRef.current);
  }

  function draftTotal(productId: string) {
    const row = rowsRef.current.find((entry) => entry.productId === productId);
    if (!row) return null;
    return countFromDraft(draftsRef.current[productId], row);
  }

  async function persistCount(productId: string, countedQuantity: number) {
    if (draftTotal(productId) !== countedQuantity) return;
    if (savedValuesRef.current[productId] === countedQuantity) return;

    markSaving(productId, true);
    try {
      const data: VarianceRow[] = await apiClient.saveVarianceCounts({
        items: [{ productId, countedQuantity }],
      });
      const latest = draftTotal(productId);
      if (latest !== countedQuantity) {
        const saved = data.find((row) => row.productId === productId);
        if (saved?.count && latest === null && isBlankDraft(draftsRef.current[productId])) {
          await apiClient.clearVarianceCount(saved.count.id);
          savedValuesRef.current[productId] = null;
          replaceRow(productId, { ...saved, count: null });
        }
        return;
      }
      const saved = data.find((row) => row.productId === productId);
      if (!saved) return;
      savedValuesRef.current[productId] = saved.count
        ? saved.count.countedQuantity
        : countedQuantity;
      replaceRow(productId, saved);
    } catch (error) {
      showErrorFromException(error, "Failed to save count");
    } finally {
      markSaving(productId, false);
    }
  }

  async function persistClear(productId: string) {
    if (!isBlankDraft(draftsRef.current[productId])) return;
    const currentRow = rowsRef.current.find((row) => row.productId === productId);
    if (!currentRow?.count) return;

    markSaving(productId, true);
    try {
      await apiClient.clearVarianceCount(currentRow.count.id);
      savedValuesRef.current[productId] = null;
      replaceRow(productId, { ...currentRow, count: null });
    } catch (error) {
      showErrorFromException(error, "Failed to clear count");
    } finally {
      markSaving(productId, false);
    }
  }

  function queueCountSave(productId: string, delay: number) {
    const existing = timersRef.current[productId];
    if (existing) clearTimeout(existing);
    timersRef.current[productId] = setTimeout(() => {
      delete timersRef.current[productId];
      const row = rowsRef.current.find((entry) => entry.productId === productId);
      if (!row) return;
      const draft = draftsRef.current[productId];
      if (isBlankDraft(draft)) {
        enqueue(productId, () => persistClear(productId));
        return;
      }
      const countedQuantity = countFromDraft(draft, row);
      if (countedQuantity === null) return;
      enqueue(productId, () => persistCount(productId, countedQuantity));
    }, delay);
  }

  function updateDraft(productId: string, part: keyof CountDraft, value: string) {
    const current = draftsRef.current[productId] ?? emptyDraft();
    draftsRef.current = {
      ...draftsRef.current,
      [productId]: { ...current, [part]: value },
    };
    setDrafts(draftsRef.current);
    queueCountSave(productId, SAVE_DELAY_MS);
  }

  async function handleClear(row: VarianceRow) {
    if (!row.count) return;
    const existing = timersRef.current[row.productId];
    if (existing) clearTimeout(existing);
    delete timersRef.current[row.productId];
    draftsRef.current = { ...draftsRef.current, [row.productId]: emptyDraft() };
    setDrafts(draftsRef.current);
    enqueue(row.productId, async () => {
      await persistClear(row.productId);
      if (!rowsRef.current.find((entry) => entry.productId === row.productId)?.count) {
        showSuccessToast("Count cleared");
      }
    });
  }

  function handlePrintSummary() {
    const lines = rows.flatMap((row) => {
      const newStock = displayedCount(row);
      if (newStock === null) return [];
      const oldStock = stockAtCount(row);
      const difference = newStock - oldStock;
      const unitCost = Number(row.cost) || 0;
      return [
        {
          name: row.name,
          sku: row.sku,
          oldStock,
          newStock,
          difference,
          unitCost,
          potentialCost: Math.abs(difference) * unitCost,
          updatedBy: row.count?.countedByName || "—",
        },
      ];
    });
    if (lines.length === 0) return;
    printVarianceSummary({
      organizationName: localStorage.getItem("organizationName") || "Inventory",
      printedAt: new Date().toLocaleString(),
      lines,
    });
  }

  async function requestApply(target: "all" | string) {
    try {
      collectDirty(target === "all" ? undefined : [target]);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Enter a valid count");
      return;
    }

    if (target === "all") {
      try {
        const items = collectDirty();
        if (items.length > 0) {
          await apiClient.saveVarianceCounts({ items });
        }
        const check = await apiClient.checkVarianceCounts();
        if (check.errors?.length) {
          setApplyIssues(check.errors);
          setReadyToUpdate(check.readyCount ?? 0);
          setIssueDialogOpen(true);
          return;
        }
      } catch (error) {
        showErrorFromException(error, "Failed to check counts");
        return;
      }
    }

    setApplyTarget(target);
  }

  async function confirmApply(targetOverride?: "all" | string, skipProductIds: string[] = []) {
    const target = targetOverride ?? applyTarget;
    if (!target) return;
    setApplyTarget(null);
    setIssueDialogOpen(false);
    try {
      setApplying(true);
      const items = collectDirty(target === "all" ? undefined : [target]);
      if (items.length > 0) {
        await apiClient.saveVarianceCounts({ items });
      }
      const result = await apiClient.applyVarianceCounts(
        target === "all" ? { skipProductIds } : { productIds: [target] },
      );
      if (target !== "all") {
        setDrafts((current) => ({ ...current, [target]: emptyDraft() }));
      }
      if (skipProductIds.length > 0) setShowIssuesOnly(false);
      await loadWorksheet({ quiet: true, keepDrafts: target !== "all" });
      showSuccessToast(
        result.updated === 1
          ? "Updated stock for 1 product"
          : `Updated stock for ${result.updated} products`,
      );
    } catch (error) {
      if (error instanceof Error && !("response" in error)) {
        showErrorToast(error.message);
      } else {
        showErrorFromException(error, "Failed to update stock");
      }
    } finally {
      setApplying(false);
    }
  }

  function quantityField(row: VarianceRow, prominent: boolean) {
    const error = draftError(row);
    const draft = drafts[row.productId] ?? emptyDraft();
    const pack = packSize(row);
    const half = halfPackSize(row);
    const total = displayedCount(row);
    const showConversion =
      (draft.packs.trim() !== "" || draft.halves.trim() !== "") && total !== null;
    const fields: { key: keyof CountDraft; label: string; hint: string }[] = [];
    if (pack > 0) fields.push({ key: "packs", label: "Pack", hint: `×${pack}` });
    if (half > 0) fields.push({ key: "halves", label: "Half", hint: `×${half}` });
    fields.push({ key: "units", label: pack > 0 || half > 0 ? "Pcs" : "Count", hint: "" });

    return (
      <div className={prominent ? "space-y-2" : "ml-auto w-fit space-y-1"}>
        <div
          className={
            fields.length > 1
              ? `grid gap-2 ${fields.length === 3 ? "grid-cols-3" : "grid-cols-2"} ${prominent ? "" : "w-[15rem]"}`
              : undefined
          }
        >
          {fields.map((field) => (
            <label key={field.key} className="block space-y-1">
              {fields.length > 1 && (
                <span className="block text-center text-[11px] font-medium text-muted-foreground">
                  {field.label}
                  {field.hint ? <span className="font-normal"> {field.hint}</span> : null}
                </span>
              )}
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="done"
                value={draft[field.key]}
                onChange={(e) => updateDraft(row.productId, field.key, e.target.value)}
                onBlur={() => queueCountSave(row.productId, 0)}
                className={
                  prominent
                    ? fields.length > 1
                      ? "h-14 text-center text-xl font-semibold"
                      : "h-14 text-center text-2xl font-semibold"
                    : fields.length > 1
                      ? "h-10 text-center text-base md:text-sm"
                      : "h-10 w-28 text-base md:text-sm"
                }
                aria-label={
                  fields.length > 1
                    ? `${field.label} counted for ${row.name}`
                    : `Counted quantity for ${row.name}`
                }
              />
            </label>
          ))}
        </div>
        {savingIds.has(row.productId) ? (
          <p className="text-xs text-muted-foreground">Saving...</p>
        ) : error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : showConversion ? (
          <p className="text-xs text-muted-foreground">= {total} units</p>
        ) : null}
      </div>
    );
  }

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortColumn(column);
    setSortDirection("asc");
  }

  function sortHeader(label: string, column: SortColumn, align: "left" | "right" = "left") {
    const active = sortColumn === column;
    return (
      <TableHead className={align === "right" ? "text-right" : undefined}>
        <button
          type="button"
          className={`inline-flex items-center gap-1 ${align === "right" ? "ml-auto" : ""}`}
          onClick={() => toggleSort(column)}
        >
          {label}
          {active ? (
            sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-50" />
          )}
        </button>
      </TableHead>
    );
  }

  function differenceLabel(delta: number | null) {
    if (delta === null) {
      return <span className="text-muted-foreground">—</span>;
    }
    if (delta === 0) {
      return <Badge variant="secondary">Match</Badge>;
    }
    return (
      <span className={delta < 0 ? "font-semibold text-red-600" : "font-semibold text-green-600"}>
        {delta > 0 ? `+${delta}` : delta}
      </span>
    );
  }

  const applyRow = applyTarget && applyTarget !== "all"
    ? rows.find((row) => row.productId === applyTarget) ?? null
    : null;
  const applyCount = applyRow ? displayedCount(applyRow) : null;
  const pendingApplyCount = applyTarget === "all"
    ? rows.filter((row) => displayedCount(row) !== null).length
    : applyRow
      ? 1
      : 0;
  const changingCount = applyTarget === "all"
    ? rows.filter((row) => {
        const delta = difference(row);
        return delta !== null && delta !== 0;
      }).length
    : applyRow && applyCount !== null && applyCount !== stockAtCount(applyRow)
      ? 1
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 space-y-6">
      <Card>
        <CardHeader className="px-4 md:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <CardTitle>Variance Inventory</CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Counts save as you type, in pieces or by pack and half pack. Updating stock keeps sales made after the count and applies only the original difference."
                  : "Enter the quantity on the shelf in pieces, packs, or half packs. Each count saves automatically, and an admin updates stock."}
              </CardDescription>
            </div>
            {isAdmin && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={handlePrintSummary}
                  disabled={summary.counted === 0}
                >
                  Print PDF
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => requestApply("all")}
                  disabled={applying || summary.counted === 0}
                >
                  {applying ? "Updating..." : "Update all quantities"}
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 md:grid-cols-4 md:gap-4 md:pt-4">
            <div className="rounded-lg border p-3 md:p-4">
              <h3 className="text-sm font-medium text-muted-foreground">Counted</h3>
              <p className="text-2xl font-bold mt-2">{summary.counted}</p>
            </div>
            <div className="rounded-lg border p-3 md:p-4">
              <h3 className="text-sm font-medium text-muted-foreground">Short</h3>
              <p className="text-2xl font-bold mt-2 text-red-600">{summary.shortages}</p>
            </div>
            <div className="rounded-lg border p-3 md:p-4">
              <h3 className="text-sm font-medium text-muted-foreground">Over</h3>
              <p className="text-2xl font-bold mt-2 text-green-600">{summary.overages}</p>
            </div>
            <div className="rounded-lg border p-3 md:p-4">
              <h3 className="text-sm font-medium text-muted-foreground">Net difference</h3>
              <p className={`text-2xl font-bold mt-2 ${summary.netUnits < 0 ? "text-red-600" : summary.netUnits > 0 ? "text-green-600" : ""}`}>
                {summary.netUnits > 0 ? `+${summary.netUnits}` : summary.netUnits}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, SKU, or barcode"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 pl-9 md:h-9"
              />
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              {FILTERS.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  className="h-10 w-full sm:h-8 sm:w-auto"
                  variant={filter === option.id ? "default" : "outline"}
                  onClick={() => {
                    setFilter(option.id);
                    setCurrentPage(1);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          {showIssuesOnly && (
            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <p>Showing products that could not be updated.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowIssuesOnly(false)}
              >
                Show all products
              </Button>
            </div>
          )}
          <div className="mb-3 flex gap-2 overflow-x-auto md:hidden">
            {(
              [
                ["name", "Name"],
                ["stock", "Stock"],
                ["counted", "Count"],
                ["difference", "Difference"],
              ] as [SortColumn, string][]
            ).map(([column, label]) => (
              <Button
                key={column}
                type="button"
                size="sm"
                variant={sortColumn === column ? "default" : "outline"}
                className="h-9 shrink-0"
                onClick={() => toggleSort(column)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="space-y-3 md:hidden">
            {pageRows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No products match this view.
              </p>
            ) : (
              pageRows.map((row) => {
                const delta = difference(row);
                return (
                  <div key={row.productId} className="rounded-lg border p-3">
                    <div className="mb-3">
                      <div className="font-medium leading-snug">{row.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{row.sku}</span>
                        <span>
                          Stock {stockAtCount(row)}
                          {quantityPartsLabel(stockAtCount(row), row)
                            ? ` (${quantityPartsLabel(stockAtCount(row), row)})`
                            : ""}
                        </span>
                        {row.count && row.stockQuantity !== Number(row.count.systemQuantity) && (
                          <span>Now {row.stockQuantity}</span>
                        )}
                        {differenceLabel(delta)}
                      </div>
                    </div>
                    <p className="mb-1 text-sm font-medium">Counted quantity</p>
                    {quantityField(row, true)}
                    {row.count?.countedByName && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Updated by {row.count.countedByName}
                      </p>
                    )}
                    {(row.count || isAdmin) && (
                      <div className="mt-3 flex gap-2">
                        {row.count && (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 flex-1"
                            onClick={() => handleClear(row)}
                            disabled={applying}
                          >
                            Clear
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 flex-1"
                            onClick={() => requestApply(row.productId)}
                            disabled={applying || displayedCount(row) === null}
                          >
                            Update stock
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {sortHeader("Product", "name")}
                  {sortHeader("SKU", "sku")}
                  {sortHeader("Stock at count", "stock", "right")}
                  {sortHeader("Counted quantity", "counted", "right")}
                  {sortHeader("Difference", "difference", "right")}
                  {sortHeader("Counted by", "countedBy")}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No products match this view.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((row) => {
                    const delta = difference(row);
                    return (
                      <TableRow key={row.productId}>
                        <TableCell>
                          <div className="font-medium">{row.name}</div>
                          {row.category && (
                            <div className="text-xs text-muted-foreground">{row.category}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.sku}</TableCell>
                        <TableCell className="text-right font-medium">
                          <div>{stockAtCount(row)}</div>
                          {quantityPartsLabel(stockAtCount(row), row) && (
                            <div className="text-xs font-normal text-muted-foreground">
                              {quantityPartsLabel(stockAtCount(row), row)}
                            </div>
                          )}
                          {row.count && row.stockQuantity !== Number(row.count.systemQuantity) && (
                            <div className="text-xs font-normal text-muted-foreground">
                              Now {row.stockQuantity}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {quantityField(row, false)}
                        </TableCell>
                        <TableCell className="text-right">
                          {differenceLabel(delta)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.count?.countedByName || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {row.count && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleClear(row)}
                                disabled={applying}
                              >
                                Clear
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => requestApply(row.productId)}
                                disabled={applying || displayedCount(row) === null}
                              >
                                Update stock
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {sortedRows.length > itemsPerPage && (
            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {sortedRows.length} products
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={applyTarget !== null} onOpenChange={(open) => !open && setApplyTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {applyTarget === "all" ? "Update all product quantities?" : "Update stock quantity?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {applyTarget === "all"
                ? `This applies the original difference to the current stock for ${pendingApplyCount} product${pendingApplyCount === 1 ? "" : "s"}. ${changingCount} will change. Sales after a product was counted stay in the quantity.`
                : applyRow && applyCount !== null
                  ? `Stock was ${stockAtCount(applyRow)} when ${applyRow.name} was counted. The count is ${applyCount}${quantityPartsLabel(applyCount, applyRow) ? ` (${quantityPartsLabel(applyCount, applyRow)})` : ""}. Current stock is ${applyRow.stockQuantity}, so it will become ${applyRow.stockQuantity + (applyCount - stockAtCount(applyRow))}.`
                  : "Save a count before updating stock."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmApply()}>Update stock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Some products cannot be updated</DialogTitle>
            <DialogDescription>
              {applyIssues.length} product{applyIssues.length === 1 ? "" : "s"} will be left unchanged. Fix them, or skip them and update the rest.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {applyIssues.map((issue) => (
              <div key={issue.productId} className="rounded-md border p-3">
                <div className="font-medium">{issue.name}</div>
                {issue.sku && <div className="text-xs text-muted-foreground">{issue.sku}</div>}
                <p className="mt-1 text-sm text-red-600">{issue.reason}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowIssuesOnly(true);
                setIssueDialogOpen(false);
                setCurrentPage(1);
              }}
            >
              Fix
            </Button>
            <Button
              type="button"
              onClick={() => confirmApply("all", applyIssues.map((issue) => issue.productId))}
              disabled={applying || readyToUpdate === 0}
            >
              Skip and update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
