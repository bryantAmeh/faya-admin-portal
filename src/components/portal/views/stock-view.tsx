"use client";

/**
 * Faya Admin Portal — Stock / Inventory View
 *
 * Lists physical items in Faya's warehouse: physical POS terminals and
 * physical cards. Merchants request terminals from their Merchant app
 * (the request appears in the merchant-detail POS Requests tab); admin
 * allocates from this stock when fulfilling the request.
 *
 * Pricing model (per spec):
 *   - Physical terminals: provided FREE to merchants — no purchase / rental.
 *     Merchants cannot "order" them themselves; admin allocates from stock.
 *   - Physical cards: carry an issuance fee.
 *   - The POS app and Phone POS are FREE downloads — no stock needed.
 *     Phone POS uses the merchant's existing phone; the POS app is software.
 *
 * Country scoping: Super Admin sees all warehouses; other staff see only
 * the countries listed on their `staff.countries` access record.
 *
 * Tabs: All · In Stock · Allocated · Damaged
 * Table: Serial · Type · Model · Country · Status · Allocated To · Allocated At · Notes · Actions
 * Actions: View details (Dialog) · Mark damaged · Mark in stock
 *
 * Audit action keys: stock.create / stock.mark_damaged / stock.mark_in_stock
 */
import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Plus,
  MoreHorizontal,
  Eye,
  PackageCheck,
  AlertTriangle,
  Search,
  Filter,
  Info,
  CreditCard,
  Smartphone,
  XCircle,
  Building2,
  PackageX,
} from "lucide-react";
import { toast } from "sonner";
import {
  ViewHeader,
  ViewContainer,
  EmptyState,
  StatCard,
} from "@/components/portal/view-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import { getVisibleCountryCodes, isGlobalScope } from "@/lib/access-scope";
import { formatDateTime, timeAgo } from "@/lib/formatters";
import type {
  CountryConfig,
  StockItem,
  StockItemStatus,
  StockItemType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SUPER_ADMIN_DEPT = "dept_super_admin";

const STOCK_STATUS_STYLES: Record<
  StockItemStatus,
  { label: string; className: string }
> = {
  in_stock: {
    label: "In Stock",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  allocated: {
    label: "Allocated",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  shipped: {
    label: "Shipped",
    className:
      "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  },
  delivered: {
    label: "Delivered",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  damaged: {
    label: "Damaged",
    className:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
  lost: {
    label: "Lost",
    className:
      "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
};

const TYPE_LABELS: Record<StockItemType, { label: string; icon: typeof Smartphone }> = {
  physical_terminal: { label: "Terminal", icon: Smartphone },
  physical_card: { label: "Card", icon: CreditCard },
};

export function StockView() {
  const { staff } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("all");

  // Dialog state
  const [detailItem, setDetailItem] = useState<StockItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);

  // Set of existing serial numbers (lower-cased) to prevent duplicates
  const existingSerials = useMemo(
    () => new Set(items.map((i) => i.serialNumber.toLowerCase())),
    [items],
  );

  /* ----------------------- Subscriptions ----------------------- */
  useEffect(() => {
    const unsubStock = adminData.subscribeStock(setItems);
    const unsubCountries = adminData.subscribeCountries(setCountries);
    return () => {
      unsubStock();
      unsubCountries();
    };
  }, []);

  /* ----------------------- Country scoping --------------------- */
  const visibleCountryCodes = useMemo(
    () => getVisibleCountryCodes(staff, countries),
    [staff, countries],
  );
  const isSuperAdmin = isGlobalScope(staff) || staff?.departmentId === SUPER_ADMIN_DEPT;

  const filterableCountries = useMemo(
    () =>
      isSuperAdmin
        ? countries
        : countries.filter((c) => visibleCountryCodes.has(c.countryCode)),
    [countries, isSuperAdmin, visibleCountryCodes],
  );

  /* ----------------------- Filtering --------------------------- */
  const visibleItems = useMemo(
    () => items.filter((it) => visibleCountryCodes.has(it.countryCode)),
    [items, visibleCountryCodes],
  );

  const filtered = useMemo(() => {
    let list = visibleItems;
    if (activeTab === "in_stock") list = list.filter((i) => i.status === "in_stock");
    else if (activeTab === "allocated")
      list = list.filter((i) => i.status === "allocated");
    else if (activeTab === "damaged")
      list = list.filter((i) => i.status === "damaged" || i.status === "lost");

    if (countryFilter !== "all")
      list = list.filter((i) => i.countryCode === countryFilter);
    if (typeFilter !== "all") list = list.filter((i) => i.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.serialNumber.toLowerCase().includes(q) ||
          i.model.toLowerCase().includes(q) ||
          (i.allocatedToName ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [visibleItems, activeTab, countryFilter, typeFilter, search]);

  /* ----------------------- Stats ------------------------------- */
  const stats = useMemo(() => {
    const total = visibleItems.length;
    const inStock = visibleItems.filter((i) => i.status === "in_stock").length;
    const allocated = visibleItems.filter((i) => i.status === "allocated").length;
    const damaged = visibleItems.filter(
      (i) => i.status === "damaged" || i.status === "lost",
    ).length;
    return { total, inStock, allocated, damaged };
  }, [visibleItems]);

  /* ----------------------- Helpers ----------------------------- */
  function countryName(code: string): string {
    return countries.find((c) => c.countryCode === code)?.countryName ?? code;
  }

  function actor() {
    if (!staff) return null;
    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      department: staff.departmentId,
      role: staff.roleId,
    };
  }

  function markDamaged(item: StockItem) {
    const a = actor();
    if (!a) return;
    adminData.updateStockItem(item.id, {
      status: "damaged",
      updatedAt: Date.now(),
    });
    logAudit(a, "stock.mark_damaged", "stock_item", item.id, {
      countryCode: item.countryCode,
      beforeValue: item.status,
      afterValue: "damaged",
    });
    toast.success(`Marked damaged: ${item.serialNumber}`, {
      description: `${item.model} · pulled from fulfilment queue`,
    });
  }

  function markInStock(item: StockItem) {
    const a = actor();
    if (!a) return;
    adminData.updateStockItem(item.id, {
      status: "in_stock",
      allocatedToId: null,
      allocatedToName: null,
      allocatedAt: null,
      shippedAt: null,
      deliveredAt: null,
      updatedAt: Date.now(),
    });
    logAudit(a, "stock.mark_in_stock", "stock_item", item.id, {
      countryCode: item.countryCode,
      beforeValue: item.status,
      afterValue: "in_stock",
    });
    toast.success(`Marked in stock: ${item.serialNumber}`, {
      description: `${item.model} · available for allocation`,
    });
  }

  return (
    <>
      <ViewHeader
        title="Stock & Inventory"
        description="Physical terminals and physical cards in Faya's warehouse. Allocate to merchants when they request terminals from the Merchant app."
        icon={Boxes}
        actions={
          isSuperAdmin ? (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                setAddKey((k) => k + 1);
                setAddOpen(true);
              }}
            >
              <Plus className="size-4" /> Add to Stock
            </Button>
          ) : undefined
        }
      />
      <ViewContainer>
        {/* Pricing model info banner */}
        <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20 p-3 flex items-start gap-2 text-xs">
          <Info className="size-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-emerald-900 dark:text-emerald-200 leading-relaxed space-y-0.5">
            <div>
              <span className="font-medium">Physical terminals</span> are
              provided <span className="font-medium">FREE</span> to merchants —
              no purchase or rental fees. Merchants request them from the
              Merchant app; admin allocates from this stock.
            </div>
            <div>
              <span className="font-medium">Physical cards</span> carry an
              issuance fee.
            </div>
            <div>
              The <span className="font-medium">POS app</span> and{" "}
              <span className="font-medium">Phone POS</span> are free downloads
              — no stock needed. Phone POS uses the merchant's existing phone
              (NFC capable) and the POS app is software.
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatCard
            label="Total Items"
            value={stats.total}
            hint="Terminals + cards"
            icon={Boxes}
          />
          <StatCard
            label="In Stock"
            value={stats.inStock}
            hint="Available to allocate"
            icon={PackageCheck}
            tone="success"
          />
          <StatCard
            label="Allocated"
            value={stats.allocated}
            hint="With merchants"
            icon={Building2}
            tone="warning"
          />
          <StatCard
            label="Damaged / Lost"
            value={stats.damaged}
            hint="Pulled from circulation"
            icon={AlertTriangle}
            tone="danger"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="all" className="text-xs">
              <Boxes className="size-3.5" /> All
              <Badge variant="secondary" className="text-[10px] ml-1">
                {visibleItems.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="in_stock" className="text-xs">
              <PackageCheck className="size-3.5" /> In Stock
              <Badge variant="secondary" className="text-[10px] ml-1">
                {stats.inStock}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="allocated" className="text-xs">
              <Building2 className="size-3.5" /> Allocated
              <Badge variant="secondary" className="text-[10px] ml-1">
                {stats.allocated}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="damaged" className="text-xs">
              <AlertTriangle className="size-3.5" /> Damaged
              <Badge variant="secondary" className="text-[10px] ml-1">
                {stats.damaged}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ---------------- ALL / IN STOCK / ALLOCATED / DAMAGED -------------------- */}
          <TabsContent value="all">
            <StockTable
              items={filtered}
              countries={countries}
              onDetail={setDetailItem}
              onMarkDamaged={markDamaged}
              onMarkInStock={markInStock}
              search={search}
              setSearch={setSearch}
              countryFilter={countryFilter}
              setCountryFilter={setCountryFilter}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              filterableCountries={filterableCountries}
              isSuperAdmin={isSuperAdmin}
              emptyTitle="No stock items match"
              emptyDescription="Adjust filters or add new items to Faya's warehouse inventory."
            />
          </TabsContent>
          <TabsContent value="in_stock">
            <StockTable
              items={filtered}
              countries={countries}
              onDetail={setDetailItem}
              onMarkDamaged={markDamaged}
              onMarkInStock={markInStock}
              search={search}
              setSearch={setSearch}
              countryFilter={countryFilter}
              setCountryFilter={setCountryFilter}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              filterableCountries={filterableCountries}
              isSuperAdmin={isSuperAdmin}
              emptyTitle="No items in stock"
              emptyDescription="Items currently in the warehouse ready for allocation will appear here."
            />
          </TabsContent>
          <TabsContent value="allocated">
            <StockTable
              items={filtered}
              countries={countries}
              onDetail={setDetailItem}
              onMarkDamaged={markDamaged}
              onMarkInStock={markInStock}
              search={search}
              setSearch={setSearch}
              countryFilter={countryFilter}
              setCountryFilter={setCountryFilter}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              filterableCountries={filterableCountries}
              isSuperAdmin={isSuperAdmin}
              emptyTitle="No allocated items"
              emptyDescription="Items currently allocated to merchants will appear here."
            />
          </TabsContent>
          <TabsContent value="damaged">
            <StockTable
              items={filtered}
              countries={countries}
              onDetail={setDetailItem}
              onMarkDamaged={markDamaged}
              onMarkInStock={markInStock}
              search={search}
              setSearch={setSearch}
              countryFilter={countryFilter}
              setCountryFilter={setCountryFilter}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              filterableCountries={filterableCountries}
              isSuperAdmin={isSuperAdmin}
              emptyTitle="No damaged items"
              emptyDescription="Items marked damaged or lost will appear here."
            />
          </TabsContent>
        </Tabs>
      </ViewContainer>

      {/* Detail Dialog */}
      <StockDetailDialog
        item={detailItem}
        countryName={countryName}
        onOpenChange={(o) => !o && setDetailItem(null)}
      />

      {/* Add to Stock Dialog */}
      <AddToStockDialog
        key={addKey}
        open={addOpen}
        onOpenChange={setAddOpen}
        countries={filterableCountries}
        existingSerials={existingSerials}
        onCreate={(newItem) => {
          const a = actor();
          if (!a) return;
          adminData.createStockItem(newItem);
          logAudit(a, "stock.create", "stock_item", newItem.id, {
            countryCode: newItem.countryCode,
            afterValue: `${newItem.type} · ${newItem.model} · ${newItem.serialNumber}`,
          });
          toast.success(`Added to stock: ${newItem.serialNumber}`, {
            description: `${newItem.type === "physical_terminal" ? "Terminal" : "Card"} · ${newItem.model} · ${countryName(newItem.countryCode)}`,
          });
          setAddOpen(false);
        }}
      />

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}

/* ============================== Stock Table ============================== */

interface StockTableProps {
  items: StockItem[];
  countries: CountryConfig[];
  onDetail: (item: StockItem) => void;
  onMarkDamaged: (item: StockItem) => void;
  onMarkInStock: (item: StockItem) => void;
  search: string;
  setSearch: (s: string) => void;
  countryFilter: string;
  setCountryFilter: (s: string) => void;
  typeFilter: string;
  setTypeFilter: (s: string) => void;
  filterableCountries: CountryConfig[];
  isSuperAdmin: boolean;
  emptyTitle: string;
  emptyDescription: string;
}

function StockTable({
  items,
  countries,
  onDetail,
  onMarkDamaged,
  onMarkInStock,
  search,
  setSearch,
  countryFilter,
  setCountryFilter,
  typeFilter,
  setTypeFilter,
  filterableCountries,
  isSuperAdmin,
  emptyTitle,
  emptyDescription,
}: StockTableProps) {
  function countryName(code: string): string {
    return countries.find((c) => c.countryCode === code)?.countryName ?? code;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Boxes className="size-4 text-emerald-600" />
          Stock Items
          <Badge variant="secondary" className="text-[10px]">
            {items.length}
          </Badge>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search serial, model, merchant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8 w-56 text-xs"
            />
          </div>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger size="sm" className="w-44 text-xs h-8">
              <Filter className="size-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {filterableCountries.map((c) => (
                <SelectItem key={c.countryCode} value={c.countryCode}>
                  {c.countryCode} · {c.countryName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger size="sm" className="w-36 text-xs h-8">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="physical_terminal">Terminal</SelectItem>
              <SelectItem value="physical_card">Card</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <EmptyState icon={Boxes} title={emptyTitle} description={emptyDescription} />
        ) : (
          <div
            className={
              "max-h-[60vh] overflow-auto " +
              "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent " +
              "[&::-webkit-scrollbar-thumb]:rounded-full " +
              "[&::-webkit-scrollbar-thumb]:bg-slate-300 " +
              "dark:[&::-webkit-scrollbar-thumb]:bg-slate-700"
            }
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <TableRow>
                  <TableHead className="pl-4">Serial Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Allocated To</TableHead>
                  <TableHead className="hidden md:table-cell">Allocated At</TableHead>
                  <TableHead className="hidden lg:table-cell">Notes</TableHead>
                  <TableHead className="text-right pr-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const statusStyle = STOCK_STATUS_STYLES[item.status];
                  const typeMeta = TYPE_LABELS[item.type];
                  const TypeIcon = typeMeta.icon;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="pl-4 font-mono text-xs">
                        {item.serialNumber}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] capitalize",
                            item.type === "physical_terminal"
                              ? "text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                              : "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
                          )}
                        >
                          <TypeIcon className="size-2.5 mr-0.5" />
                          {typeMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{item.model}</TableCell>
                      <TableCell className="text-xs">
                        <span className="font-mono">{item.countryCode}</span>
                        <span className="text-muted-foreground ml-1 hidden xl:inline">
                          {countryName(item.countryCode)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn("text-[10px]", statusStyle.className)}
                        >
                          {statusStyle.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.allocatedToName ? (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="size-3 text-emerald-600" />
                            {item.allocatedToName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {item.allocatedAt ? timeAgo(item.allocatedAt) : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[200px] text-xs text-muted-foreground line-clamp-2">
                        {item.notes || "—"}
                      </TableCell>
                      <TableCell className="text-right pr-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel className="text-xs font-mono">
                              {item.serialNumber}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onDetail(item)}>
                              <Eye className="size-3.5 mr-2" /> View details
                            </DropdownMenuItem>
                            {item.status !== "damaged" &&
                              item.status !== "lost" && (
                                <DropdownMenuItem
                                  onClick={() => onMarkDamaged(item)}
                                  className="text-red-700 dark:text-red-300 focus:text-red-700"
                                >
                                  <PackageX className="size-3.5 mr-2" /> Mark damaged
                                </DropdownMenuItem>
                              )}
                            {item.status !== "in_stock" && (
                              <DropdownMenuItem
                                onClick={() => onMarkInStock(item)}
                                className="text-emerald-700 dark:text-emerald-300 focus:text-emerald-700"
                              >
                                <PackageCheck className="size-3.5 mr-2" /> Mark in stock
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================ Detail Dialog ============================ */

function StockDetailDialog({
  item,
  countryName,
  onOpenChange,
}: {
  item: StockItem | null;
  countryName: (code: string) => string;
  onOpenChange: (open: boolean) => void;
}) {
  if (!item) return null;
  const statusStyle = STOCK_STATUS_STYLES[item.status];
  const typeMeta = TYPE_LABELS[item.type];
  const TypeIcon = typeMeta.icon;

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Boxes className="size-5 text-emerald-600" />
            Stock Item Detail
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px]">
            {item.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Header chip */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] capitalize",
                item.type === "physical_terminal"
                  ? "text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                  : "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
              )}
            >
              <TypeIcon className="size-2.5 mr-0.5" />
              {typeMeta.label}
            </Badge>
            <Badge
              variant="secondary"
              className={cn("text-[10px]", statusStyle.className)}
            >
              {statusStyle.label}
            </Badge>
          </div>

          {/* Detail rows */}
          <div className="rounded-md border divide-y">
            <DetailRow label="Serial Number" value={<span className="font-mono text-xs">{item.serialNumber}</span>} />
            <DetailRow label="Model" value={<span className="text-sm">{item.model}</span>} />
            <DetailRow
              label="Country"
              value={
                <span className="text-sm">
                  <span className="font-mono">{item.countryCode}</span>
                  <span className="text-muted-foreground ml-1">
                    · {countryName(item.countryCode)}
                  </span>
                </span>
              }
            />
            <DetailRow
              label="Allocated To"
              value={
                item.allocatedToName ? (
                  <span className="text-sm inline-flex items-center gap-1">
                    <Building2 className="size-3 text-emerald-600" />
                    {item.allocatedToName}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">— not allocated —</span>
                )
              }
            />
            {item.allocatedAt && (
              <DetailRow
                label="Allocated At"
                value={<span className="text-xs">{formatDateTime(item.allocatedAt)}</span>}
              />
            )}
            {item.shippedAt && (
              <DetailRow
                label="Shipped At"
                value={<span className="text-xs">{formatDateTime(item.shippedAt)}</span>}
              />
            )}
            {item.deliveredAt && (
              <DetailRow
                label="Delivered At"
                value={<span className="text-xs">{formatDateTime(item.deliveredAt)}</span>}
              />
            )}
            <DetailRow
              label="Created At"
              value={<span className="text-xs">{formatDateTime(item.createdAt)}</span>}
            />
            <DetailRow
              label="Last Updated"
              value={<span className="text-xs">{formatDateTime(item.updatedAt)}</span>}
            />
          </div>

          {/* Notes */}
          {item.notes && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                Notes
              </div>
              <p className="text-sm bg-muted/40 border rounded-md p-3">
                {item.notes}
              </p>
            </div>
          )}

          {/* Pricing reminder */}
          <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-900/10 p-2.5 text-[11px] text-emerald-900 dark:text-emerald-200">
            {item.type === "physical_terminal" ? (
              <span>
                <strong>Free provision:</strong> physical terminals are provided
                to merchants at no cost. No purchase or rental fee applies.
              </span>
            ) : (
              <span>
                <strong>Issuance fee applies:</strong> physical cards carry an
                issuance fee charged to the consumer.
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 px-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm text-right min-w-0">{value}</span>
    </div>
  );
}

/* ============================ Add to Stock Dialog ============================ */

function AddToStockDialog({
  open,
  onOpenChange,
  countries,
  existingSerials,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countries: CountryConfig[];
  existingSerials: Set<string>;
  onCreate: (item: StockItem) => void;
}) {
  const [serialNumber, setSerialNumber] = useState("");
  const [type, setType] = useState<StockItemType>("physical_terminal");
  const [model, setModel] = useState("");
  const [countryCode, setCountryCode] = useState<string>(
    () => countries[0]?.countryCode ?? "",
  );
  const [notes, setNotes] = useState("");

  const serialError = useMemo(() => {
    if (!serialNumber.trim()) return null;
    if (existingSerials.has(serialNumber.trim().toLowerCase())) {
      return "Serial number already exists in stock.";
    }
    return null;
  }, [serialNumber, existingSerials]);

  const canSubmit =
    serialNumber.trim() &&
    model.trim() &&
    countryCode &&
    !serialError;

  function handleSubmit() {
    if (!canSubmit) return;
    const now = Date.now();
    const newItem: StockItem = {
      id: `stk_${now}_${Math.random().toString(36).slice(2, 8)}`,
      serialNumber: serialNumber.trim(),
      type,
      model: model.trim(),
      countryCode,
      status: "in_stock",
      allocatedToId: null,
      allocatedToName: null,
      allocatedAt: null,
      shippedAt: null,
      deliveredAt: null,
      notes: notes.trim(),
      createdAt: now,
      updatedAt: now,
    };
    onCreate(newItem);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-5 text-emerald-600" />
            Add to Stock
          </DialogTitle>
          <DialogDescription>
            Register a new physical item in Faya&apos;s warehouse. Items enter
            as <span className="font-medium text-emerald-700 dark:text-emerald-400">In Stock</span>{" "}
            and are allocated when a merchant&apos;s terminal request is fulfilled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type selector */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Item type</Label>
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(v as StockItemType)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              <label
                htmlFor="opt_terminal"
                className={cn(
                  "flex items-start gap-2 rounded-md border p-3 cursor-pointer transition-colors",
                  type === "physical_terminal"
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
                    : "border-input hover:bg-muted/40",
                )}
              >
                <RadioGroupItem
                  value="physical_terminal"
                  id="opt_terminal"
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <Smartphone className="size-3.5 text-emerald-600" />
                    Physical Terminal
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Card POS device (e.g. Ingenico Move 2500). Provided free —
                    no purchase or rental fees.
                  </div>
                </div>
              </label>
              <label
                htmlFor="opt_card"
                className={cn(
                  "flex items-start gap-2 rounded-md border p-3 cursor-pointer transition-colors",
                  type === "physical_card"
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
                    : "border-input hover:bg-muted/40",
                )}
              >
                <RadioGroupItem
                  value="physical_card"
                  id="opt_card"
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <CreditCard className="size-3.5 text-emerald-600" />
                    Physical Card
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Embossed/plastic card. Issuance fee applies — charged to the
                    consumer at order time.
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Serial number */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Serial number <span className="text-red-500">*</span>
            </Label>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="e.g. ING-2500-A4F92K"
              className="h-9 text-sm font-mono"
            />
            {serialError && (
              <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                <XCircle className="size-3" /> {serialError}
              </p>
            )}
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Model <span className="text-red-500">*</span>
            </Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={
                type === "physical_terminal"
                  ? "e.g. Ingenico Move 2500"
                  : "e.g. Visa Physical Card v2"
              }
              className="h-9 text-sm"
            />
          </div>

          {/* Country */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Warehouse country <span className="text-red-500">*</span>
            </Label>
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger size="sm" className="w-full text-sm h-9">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.countryCode} value={c.countryCode}>
                    {c.countryCode} · {c.countryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. New shipment arrived 2025-03 batch. QA-tested."
              className="text-sm min-h-[70px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            <Plus className="size-4 mr-1" /> Add to stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
