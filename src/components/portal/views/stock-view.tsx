"use client";

/**
 * Faya Admin Portal — Stock & Inventory View (Task STK1)
 *
 * Rebuilt to address user feedback:
 *   1. "There is no price"            → each item shows price prominently
 *   2. "No room to add pictures"      → each item shows its product image
 *   3. "Order only what's there"      → only in_stock items can be ordered;
 *                                         if a type has zero in_stock items,
 *                                         ordering for that type is disabled
 *   4. "Delivery fee should be incl." → Unit Price + Delivery Fee = Total
 *
 * Two tabs:
 *   • Inventory — product-card grid showing image, price, status, serial, etc.
 *   • Orders    — table of all StockOrders with delivery fee + total
 *
 * Audit action keys:
 *   stock.create / stock.mark_damaged / stock.mark_in_stock
 *   stock_order.create / stock_order.ship / stock_order.deliver / stock_order.cancel
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Plus,
  MoreHorizontal,
  Eye,
  PackageCheck,
  AlertTriangle,
  Search,
  Filter,
  CreditCard,
  Smartphone,
  XCircle,
  Building2,
  PackageX,
  Truck,
  CheckCircle2,
  Ban,
  ImageOff,
  ShoppingCart,
  Wallet,
  Clock,
  Package,
  User,
  Receipt,
  ArrowRight,
  PlusCircle,
  Info,
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
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  timeAgo,
} from "@/lib/formatters";
import type {
  CountryConfig,
  StockItem,
  StockItemStatus,
  StockItemType,
  StockOrder,
  StockOrderStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const SUPER_ADMIN_DEPT = "dept_super_admin";

/* Default delivery fee by country (currency code looked up from country). */
const DEFAULT_DELIVERY_FEE: Record<string, number> = {
  NG: 2000,
  GH: 20,
  KE: 300,
  ZA: 100,
};

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
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  },
  delivered: {
    label: "Delivered",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  damaged: {
    label: "Damaged",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
  lost: {
    label: "Lost",
    className:
      "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
};

const ORDER_STATUS_STYLES: Record<
  StockOrderStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  },
  fulfilled: {
    label: "Fulfilled",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  shipped: {
    label: "Shipped",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  },
  delivered: {
    label: "Delivered",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  },
};

const TYPE_META: Record<
  StockItemType,
  { label: string; icon: typeof Smartphone; shortLabel: string }
> = {
  physical_terminal: {
    label: "Physical Terminal",
    icon: Smartphone,
    shortLabel: "Terminal",
  },
  physical_card: { label: "Physical Card", icon: CreditCard, shortLabel: "Card" },
};

export function StockView() {
  const { staff } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [orders, setOrders] = useState<StockOrder[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);

  // Top-level tab
  const [activeTab, setActiveTab] = useState<"inventory" | "orders">(
    "inventory",
  );

  // Inventory filters
  const [invSearch, setInvSearch] = useState("");
  const [invCountry, setInvCountry] = useState<string>("all");
  const [invType, setInvType] = useState<string>("all");
  const [invStatus, setInvStatus] = useState<string>("all");

  // Orders filters
  const [ordSearch, setOrdSearch] = useState("");
  const [ordCountry, setOrdCountry] = useState<string>("all");
  const [ordStatus, setOrdStatus] = useState<string>("all");

  // Dialog state
  const [detailItem, setDetailItem] = useState<StockItem | null>(null);
  const [detailOrder, setDetailOrder] = useState<StockOrder | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderKey, setOrderKey] = useState(0);

  /* ----------------------- Subscriptions ----------------------- */
  useEffect(() => {
    const unsubStock = adminData.subscribeStock(setItems);
    const unsubOrders = adminData.subscribeStockOrders(setOrders);
    const unsubCountries = adminData.subscribeCountries(setCountries);
    return () => {
      unsubStock();
      unsubOrders();
      unsubCountries();
    };
  }, []);

  /* ----------------- New-order real-time notification ----------------- *
   * Watches the live `orders` list. Whenever an order ID appears that
   * wasn't present in the previous render, fires a sonner toast so the
   * admin gets instant feedback when a user/merchant pays from their app.
   * The first snapshot (initial load) is captured silently so we don't
   * toast every existing order on mount. */
  const seenOrderIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (orders.length === 0) return;
    const seen = seenOrderIdsRef.current;
    if (seen === null) {
      // First load — seed the set without toasting.
      seenOrderIdsRef.current = new Set(orders.map((o) => o.id));
      return;
    }
    const fresh = orders.filter((o) => !seen.has(o.id));
    if (fresh.length === 0) return;
    // Sort fresh by createdAt asc so older-fresh orders toast first.
    fresh
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((o) => {
        toast.success("New order received", {
          description: `${o.orderCode} — ${o.userName} ordered ${o.model} for ${formatCurrency(o.totalAmount, o.currency)}`,
        });
      });
    fresh.forEach((o) => seen.add(o.id));
  }, [orders]);

  /* ----------------------- Country scoping --------------------- */
  const visibleCountryCodes = useMemo(
    () => getVisibleCountryCodes(staff, countries),
    [staff, countries],
  );
  const isSuperAdmin =
    isGlobalScope(staff) || staff?.departmentId === SUPER_ADMIN_DEPT;

  const filterableCountries = useMemo(
    () =>
      isSuperAdmin
        ? countries
        : countries.filter((c) => visibleCountryCodes.has(c.countryCode)),
    [countries, isSuperAdmin, visibleCountryCodes],
  );

  const visibleItems = useMemo(
    () => items.filter((it) => visibleCountryCodes.has(it.countryCode)),
    [items, visibleCountryCodes],
  );
  const visibleOrders = useMemo(
    () => orders.filter((o) => visibleCountryCodes.has(o.countryCode)),
    [orders, visibleCountryCodes],
  );

  const existingSerials = useMemo(
    () => new Set(items.map((i) => i.serialNumber.toLowerCase())),
    [items],
  );

  /* ----------------------- Inventory filtering ----------------- */
  const filteredItems = useMemo(() => {
    let list = visibleItems;
    if (invCountry !== "all")
      list = list.filter((i) => i.countryCode === invCountry);
    if (invType !== "all") list = list.filter((i) => i.type === invType);
    if (invStatus !== "all") {
      if (invStatus === "damaged_lost")
        list = list.filter(
          (i) => i.status === "damaged" || i.status === "lost",
        );
      else list = list.filter((i) => i.status === invStatus);
    }
    if (invSearch.trim()) {
      const q = invSearch.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.serialNumber.toLowerCase().includes(q) ||
          i.model.toLowerCase().includes(q) ||
          (i.allocatedToName ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [visibleItems, invCountry, invType, invStatus, invSearch]);

  /* ----------------------- Orders filtering -------------------- */
  const filteredOrders = useMemo(() => {
    let list = visibleOrders;
    if (ordCountry !== "all")
      list = list.filter((o) => o.countryCode === ordCountry);
    if (ordStatus !== "all")
      list = list.filter((o) => o.status === ordStatus);
    if (ordSearch.trim()) {
      const q = ordSearch.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.orderCode.toLowerCase().includes(q) ||
          o.userName.toLowerCase().includes(q) ||
          o.model.toLowerCase().includes(q),
      );
    }
    return list;
  }, [visibleOrders, ordCountry, ordStatus, ordSearch]);

  /* ----------------------- Stats ------------------------------- */
  const inventoryStats = useMemo(() => {
    const total = visibleItems.length;
    const inStock = visibleItems.filter((i) => i.status === "in_stock").length;
    const allocated = visibleItems.filter((i) => i.status === "allocated").length;
    const damaged = visibleItems.filter(
      (i) => i.status === "damaged" || i.status === "lost",
    ).length;

    // Stock value — group by currency to avoid mixing NGN + GHS + KES + ZAR
    const byCurrency = new Map<string, number>();
    visibleItems
      .filter((i) => i.status === "in_stock" || i.status === "allocated")
      .forEach((i) => {
        byCurrency.set(
          i.currency,
          (byCurrency.get(i.currency) ?? 0) + i.price,
        );
      });
    const totalStockValue = Array.from(byCurrency.entries())
      .map(([cur, amt]) => formatCurrency(amt, cur))
      .join(" · ") || "—";

    return { total, inStock, allocated, damaged, totalStockValue };
  }, [visibleItems]);

  const orderStats = useMemo(() => {
    const total = visibleOrders.length;
    const pending = visibleOrders.filter((o) => o.status === "pending").length;
    const shipped = visibleOrders.filter((o) => o.status === "shipped").length;
    const delivered = visibleOrders.filter(
      (o) => o.status === "delivered",
    ).length;

    // Total revenue — group by currency, only delivered orders
    const byCurrency = new Map<string, number>();
    visibleOrders
      .filter((o) => o.status === "delivered")
      .forEach((o) => {
        byCurrency.set(
          o.currency,
          (byCurrency.get(o.currency) ?? 0) + o.totalAmount,
        );
      });
    const totalRevenue = Array.from(byCurrency.entries())
      .map(([cur, amt]) => formatCurrency(amt, cur))
      .join(" · ") || "—";

    return { total, pending, shipped, delivered, totalRevenue };
  }, [visibleOrders]);

  /* ----------------------- Helpers ----------------------------- */
  function countryName(code: string): string {
    return countries.find((c) => c.countryCode === code)?.countryName ?? code;
  }
  function countryCurrency(code: string): string {
    return countries.find((c) => c.countryCode === code)?.currency ?? "NGN";
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
      description: `${item.model} · available for ordering`,
    });
  }

  function markOrderShipped(order: StockOrder) {
    const a = actor();
    if (!a) return;
    adminData.updateStockOrder(order.id, {
      status: "shipped",
      updatedAt: Date.now(),
    });
    if (order.stockItemId) {
      adminData.updateStockItem(order.stockItemId, {
        status: "shipped",
        shippedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    logAudit(a, "stock_order.ship", "stock_order", order.id, {
      countryCode: order.countryCode,
      beforeValue: order.status,
      afterValue: "shipped",
    });
    toast.success(`Order shipped: ${order.orderCode}`, {
      description: `${order.userName} · ${order.model}`,
    });
  }

  function markOrderDelivered(order: StockOrder) {
    const a = actor();
    if (!a) return;
    adminData.updateStockOrder(order.id, {
      status: "delivered",
      updatedAt: Date.now(),
    });
    if (order.stockItemId) {
      adminData.updateStockItem(order.stockItemId, {
        status: "delivered",
        deliveredAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    logAudit(a, "stock_order.deliver", "stock_order", order.id, {
      countryCode: order.countryCode,
      beforeValue: order.status,
      afterValue: "delivered",
    });
    toast.success(`Order delivered: ${order.orderCode}`, {
      description: `${order.userName} · ${order.model}`,
    });
  }

  function cancelOrder(order: StockOrder) {
    const a = actor();
    if (!a) return;
    adminData.updateStockOrder(order.id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    // Release the allocated item back to inventory
    if (order.stockItemId) {
      adminData.updateStockItem(order.stockItemId, {
        status: "in_stock",
        allocatedToId: null,
        allocatedToName: null,
        allocatedAt: null,
        shippedAt: null,
        deliveredAt: null,
        updatedAt: Date.now(),
      });
    }
    logAudit(a, "stock_order.cancel", "stock_order", order.id, {
      countryCode: order.countryCode,
      beforeValue: order.status,
      afterValue: "cancelled",
      reason: "Cancelled by admin",
    });
    toast.success(`Order cancelled: ${order.orderCode}`, {
      description: `Item returned to inventory`,
    });
  }

  /* In-stock items grouped by type, for the order dialog */
  const inStockByType = useMemo(() => {
    const groups: Record<StockItemType, StockItem[]> = {
      physical_terminal: [],
      physical_card: [],
    };
    visibleItems
      .filter((i) => i.status === "in_stock")
      .forEach((i) => groups[i.type].push(i));
    return groups;
  }, [visibleItems]);

  const hasTerminalInStock = inStockByType.physical_terminal.length > 0;
  const hasCardInStock = inStockByType.physical_card.length > 0;

  return (
    <>
      <ViewHeader
        title="Stock & Inventory"
        description="Track physical terminals and cards in stock. When users order and pay from their apps, items move here to their profile. Admin fulfils and tracks delivery."
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
          ) : null
        }
      />

      <ViewContainer>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "inventory" | "orders")}
          className="w-full"
        >
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="inventory" className="text-xs">
              <Boxes className="size-3.5" /> Inventory
              <Badge variant="secondary" className="text-[10px] ml-1">
                {visibleItems.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-xs">
              <ShoppingCart className="size-3.5" /> Orders
              <Badge variant="secondary" className="text-[10px] ml-1">
                {visibleOrders.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ====================== INVENTORY TAB ====================== */}
          <TabsContent value="inventory" className="space-y-4">
            {/* Stat cards */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
              <StatCard
                label="Total Items"
                value={inventoryStats.total}
                hint="Terminals + cards"
                icon={Boxes}
              />
              <StatCard
                label="In Stock"
                value={inventoryStats.inStock}
                hint="Available to order"
                icon={PackageCheck}
                tone="success"
              />
              <StatCard
                label="Allocated"
                value={inventoryStats.allocated}
                hint="Bound to a user"
                icon={Building2}
                tone="warning"
              />
              <StatCard
                label="Damaged"
                value={inventoryStats.damaged}
                hint="Pulled from circulation"
                icon={AlertTriangle}
                tone="danger"
              />
              <StatCard
                label="Stock Value"
                value={inventoryStats.totalStockValue}
                hint="In stock + allocated"
                icon={Wallet}
                tone="info"
              />
            </div>

            {/* Availability banner */}
            <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20 p-3 flex items-start gap-2 text-xs">
              <PackageCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="text-emerald-900 dark:text-emerald-200 leading-relaxed space-y-0.5">
                <div>
                  <span className="font-medium">Availability-based ordering:</span>{" "}
                  users can only order what is currently{" "}
                  <span className="font-medium">In Stock</span>. If no terminals
                  are in stock, terminal ordering is disabled. Same for cards.
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  <span className="inline-flex items-center gap-1">
                    <Smartphone className="size-3" />
                    Terminals in stock:{" "}
                    <span className={cn("font-mono font-semibold", hasTerminalInStock ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>
                      {inStockByType.physical_terminal.length}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CreditCard className="size-3" />
                    Cards in stock:{" "}
                    <span className={cn("font-mono font-semibold", hasCardInStock ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300")}>
                      {inStockByType.physical_card.length}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Filter className="size-4 text-emerald-600" />
                  Filter inventory
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search serial, model, merchant..."
                      value={invSearch}
                      onChange={(e) => setInvSearch(e.target.value)}
                      className="pl-7 h-8 w-56 text-xs"
                    />
                  </div>
                  <Select value={invCountry} onValueChange={setInvCountry}>
                    <SelectTrigger size="sm" className="w-44 text-xs h-8">
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
                  <Select value={invType} onValueChange={setInvType}>
                    <SelectTrigger size="sm" className="w-36 text-xs h-8">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="physical_terminal">Terminal</SelectItem>
                      <SelectItem value="physical_card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={invStatus} onValueChange={setInvStatus}>
                    <SelectTrigger size="sm" className="w-36 text-xs h-8">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="in_stock">In Stock</SelectItem>
                      <SelectItem value="allocated">Allocated</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="damaged_lost">Damaged / Lost</SelectItem>
                    </SelectContent>
                  </Select>
                  {(invSearch ||
                    invCountry !== "all" ||
                    invType !== "all" ||
                    invStatus !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setInvSearch("");
                        setInvCountry("all");
                        setInvType("all");
                        setInvStatus("all");
                      }}
                    >
                      <XCircle className="size-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Product cards grid */}
            {filteredItems.length === 0 ? (
              <Card>
                <CardContent className="p-0">
                  <EmptyState
                    icon={Boxes}
                    title="No items match"
                    description="Adjust filters or add new items to Faya's warehouse inventory."
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredItems.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    countryName={countryName(item.countryCode)}
                    onDetail={() => setDetailItem(item)}
                    onMarkDamaged={() => markDamaged(item)}
                    onMarkInStock={() => markInStock(item)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ======================= ORDERS TAB ======================= */}
          <TabsContent value="orders" className="space-y-4">
            {/* Info banner — explains the order flow */}
            <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20 p-3 flex items-start gap-2 text-xs">
              <Info className="size-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="text-emerald-900 dark:text-emerald-200 leading-relaxed">
                Orders are placed by users and merchants from their own apps
                (Faya Pay for cards, Faya Merchant for terminals). When they
                pay, the item is automatically allocated from stock and appears
                on their profile. Admin fulfils by marking shipped → delivered.
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
              <StatCard
                label="Total Orders"
                value={orderStats.total}
                hint="All time"
                icon={ShoppingCart}
              />
              <StatCard
                label="Pending"
                value={orderStats.pending}
                hint="Awaiting fulfilment"
                icon={Clock}
                tone="warning"
              />
              <StatCard
                label="Shipped"
                value={orderStats.shipped}
                hint="In transit"
                icon={Truck}
                tone="info"
              />
              <StatCard
                label="Delivered"
                value={orderStats.delivered}
                hint="Completed"
                icon={CheckCircle2}
                tone="success"
              />
              <StatCard
                label="Revenue"
                value={orderStats.totalRevenue}
                hint="Delivered orders only"
                icon={Wallet}
                tone="success"
              />
            </div>

            {/* Filter bar */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Filter className="size-4 text-emerald-600" />
                  Filter orders
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search order code, user, model..."
                      value={ordSearch}
                      onChange={(e) => setOrdSearch(e.target.value)}
                      className="pl-7 h-8 w-64 text-xs"
                    />
                  </div>
                  <Select value={ordCountry} onValueChange={setOrdCountry}>
                    <SelectTrigger size="sm" className="w-44 text-xs h-8">
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
                  <Select value={ordStatus} onValueChange={setOrdStatus}>
                    <SelectTrigger size="sm" className="w-36 text-xs h-8">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="fulfilled">Fulfilled</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  {(ordSearch ||
                    ordCountry !== "all" ||
                    ordStatus !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setOrdSearch("");
                        setOrdCountry("all");
                        setOrdStatus("all");
                      }}
                    >
                      <XCircle className="size-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredOrders.length === 0 ? (
                  <EmptyState
                    icon={ShoppingCart}
                    title="No orders match"
                    description="Orders placed by consumers and merchants for physical items will appear here."
                  />
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
                          <TableHead className="pl-4">Order Code</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Delivery Fee</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden lg:table-cell">Delivery Address</TableHead>
                          <TableHead className="hidden md:table-cell">Created</TableHead>
                          <TableHead className="text-right pr-3">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((o) => {
                          const statusStyle = ORDER_STATUS_STYLES[o.status];
                          const typeMeta = TYPE_META[o.itemType];
                          const TypeIcon = typeMeta.icon;
                          return (
                            <TableRow key={o.id}>
                              <TableCell className="pl-4 font-mono text-xs">
                                {o.orderCode}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium inline-flex items-center gap-1">
                                    {o.userType === "merchant" ? (
                                      <Building2 className="size-3 text-emerald-600" />
                                    ) : (
                                      <User className="size-3 text-amber-600" />
                                    )}
                                    {o.userName}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] w-fit mt-0.5 capitalize"
                                  >
                                    {o.userType}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium inline-flex items-center gap-1">
                                    <TypeIcon className="size-3 text-emerald-600" />
                                    {o.model}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground capitalize">
                                    {typeMeta.shortLabel} · {o.countryCode}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono">
                                {formatCurrency(o.unitPrice, o.currency)}
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono text-muted-foreground">
                                {formatCurrency(o.deliveryFee, o.currency)}
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                                {formatCurrency(o.totalAmount, o.currency)}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={cn("text-[10px]", statusStyle.className)}
                                >
                                  {statusStyle.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell max-w-[200px] text-xs text-muted-foreground line-clamp-2">
                                {o.deliveryAddress || "—"}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                {timeAgo(o.createdAt)}
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
                                      {o.orderCode}
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setDetailOrder(o)}>
                                      <Eye className="size-3.5 mr-2" /> View details
                                    </DropdownMenuItem>
                                    {o.status === "pending" && (
                                      <DropdownMenuItem
                                        onClick={() => markOrderShipped(o)}
                                        className="text-sky-700 dark:text-sky-300 focus:text-sky-700"
                                      >
                                        <Truck className="size-3.5 mr-2" /> Mark shipped
                                      </DropdownMenuItem>
                                    )}
                                    {o.status === "shipped" && (
                                      <DropdownMenuItem
                                        onClick={() => markOrderDelivered(o)}
                                        className="text-emerald-700 dark:text-emerald-300 focus:text-emerald-700"
                                      >
                                        <CheckCircle2 className="size-3.5 mr-2" /> Mark delivered
                                      </DropdownMenuItem>
                                    )}
                                    {o.status === "pending" && (
                                      <DropdownMenuItem
                                        onClick={() => cancelOrder(o)}
                                        className="text-red-700 dark:text-red-300 focus:text-red-700"
                                      >
                                        <Ban className="size-3.5 mr-2" /> Cancel order
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
          </TabsContent>
        </Tabs>
      </ViewContainer>

      {/* Detail Dialog — keyed by item id so internal imgError state resets per item */}
      {detailItem && (
        <StockDetailDialog
          key={detailItem.id}
          item={detailItem}
          countryName={countryName}
          onOpenChange={(o) => !o && setDetailItem(null)}
        />
      )}

      {/* Order Detail Dialog */}
      <OrderDetailDialog
        order={detailOrder}
        countryName={countryName}
        onOpenChange={(o) => !o && setDetailOrder(null)}
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
            afterValue: `${newItem.type} · ${newItem.model} · ${newItem.serialNumber} · ${formatCurrency(newItem.price, newItem.currency)}`,
          });
          toast.success(`Added to stock: ${newItem.serialNumber}`, {
            description: `${newItem.type === "physical_terminal" ? "Terminal" : "Card"} · ${newItem.model} · ${formatCurrency(newItem.price, newItem.currency)}`,
          });
          setAddOpen(false);
        }}
      />

      <SonnerToaster richColors closeButton position="bottom-right" />
    </>
  );
}

/* ============================== Product Card ============================== */

interface ProductCardProps {
  item: StockItem;
  countryName: string;
  onDetail: () => void;
  onMarkDamaged: () => void;
  onMarkInStock: () => void;
}

function ProductCard({
  item,
  countryName,
  onDetail,
  onMarkDamaged,
  onMarkInStock,
}: ProductCardProps) {
  const statusStyle = STOCK_STATUS_STYLES[item.status];
  const typeMeta = TYPE_META[item.type];
  const TypeIcon = typeMeta.icon;
  const [imgError, setImgError] = useState(false);

  const showImage = item.imageUrl && !imgError;

  return (
    <Card className="overflow-hidden flex flex-col group hover:shadow-md transition-shadow">
      {/* Product image */}
      <button
        type="button"
        onClick={onDetail}
        className="relative w-full h-[120px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden text-left"
        aria-label={`View details for ${item.model}`}
      >
        {showImage ? (
          <img
            src={item.imageUrl!}
            alt={item.model}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <ImageOff className="size-8 mb-1" />
            <span className="text-[10px]">No image</span>
          </div>
        )}
        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm",
              item.type === "physical_terminal"
                ? "text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-800"
                : "text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800",
            )}
          >
            <TypeIcon className="size-2.5 mr-0.5" />
            {typeMeta.label}
          </Badge>
        </div>
        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <Badge
            variant="secondary"
            className={cn("text-[10px]", statusStyle.className)}
          >
            {statusStyle.label}
          </Badge>
        </div>
      </button>

      <CardContent className="p-4 flex-1 flex flex-col gap-2">
        {/* Model + serial */}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{item.model}</h3>
          <p className="text-[11px] font-mono text-muted-foreground truncate">
            {item.serialNumber}
          </p>
        </div>

        {/* Description */}
        {item.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 min-h-[28px]">
            {item.description}
          </p>
        )}

        {/* Price */}
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 px-2.5 py-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Price
          </div>
          <div className="text-lg font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
            {formatCurrency(item.price, item.currency)}
          </div>
        </div>

        {/* Allocated-to row */}
        {item.allocatedToName && (
          <div className="text-[11px] flex items-center gap-1 text-amber-700 dark:text-amber-300">
            <Building2 className="size-3 shrink-0" />
            <span className="truncate">
              Allocated to: <span className="font-medium">{item.allocatedToName}</span>
            </span>
          </div>
        )}

        {/* Country + notes */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
              {item.countryCode}
            </span>
            <span className="truncate hidden sm:inline">· {countryName}</span>
          </span>
          {item.notes ? (
            <span className="truncate italic" title={item.notes}>
              {item.notes}
            </span>
          ) : null}
        </div>

        {/* Actions */}
        <div className="mt-auto pt-2 flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs flex-1"
            onClick={onDetail}
          >
            <Eye className="size-3 mr-1" /> Details
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs font-mono">
                {item.serialNumber}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDetail}>
                <Eye className="size-3.5 mr-2" /> View details
              </DropdownMenuItem>
              {item.status !== "damaged" && item.status !== "lost" && (
                <DropdownMenuItem
                  onClick={onMarkDamaged}
                  className="text-red-700 dark:text-red-300 focus:text-red-700"
                >
                  <PackageX className="size-3.5 mr-2" /> Mark damaged
                </DropdownMenuItem>
              )}
              {item.status !== "in_stock" && (
                <DropdownMenuItem
                  onClick={onMarkInStock}
                  className="text-emerald-700 dark:text-emerald-300 focus:text-emerald-700"
                >
                  <PackageCheck className="size-3.5 mr-2" /> Mark in stock
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
  item: StockItem;
  countryName: (code: string) => string;
  onOpenChange: (open: boolean) => void;
}) {
  const [imgError, setImgError] = useState(false);

  const statusStyle = STOCK_STATUS_STYLES[item.status];
  const typeMeta = TYPE_META[item.type];
  const TypeIcon = typeMeta.icon;
  const showImage = item.imageUrl && !imgError;

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
          {/* Product image */}
          <div className="relative w-full h-[180px] rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            {showImage ? (
              <img
                src={item.imageUrl!}
                alt={item.model}
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                <ImageOff className="size-10 mb-1" />
                <span className="text-xs">No image available</span>
              </div>
            )}
          </div>

          {/* Header chip */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                item.type === "physical_terminal"
                  ? "text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                  : "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
              )}
            >
              <TypeIcon className="size-2.5 mr-0.5" />
              {typeMeta.label}
            </Badge>
            <Badge variant="secondary" className={cn("text-[10px]", statusStyle.className)}>
              {statusStyle.label}
            </Badge>
          </div>

          {/* Model + description */}
          <div>
            <div className="text-sm font-semibold">{item.model}</div>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            )}
          </div>

          {/* Price prominent */}
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 px-3 py-2 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Unit Price
              </div>
              <div className="text-xs text-muted-foreground">
                Charged at order time + delivery fee
              </div>
            </div>
            <div className="text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
              {formatCurrency(item.price, item.currency)}
            </div>
          </div>

          {/* Detail rows */}
          <div className="rounded-md border divide-y">
            <DetailRow label="Serial Number" value={<span className="font-mono text-xs">{item.serialNumber}</span>} />
            <DetailRow
              label="Country"
              value={
                <span className="text-sm">
                  <span className="font-mono">{item.countryCode}</span>
                  <span className="text-muted-foreground ml-1">· {countryName(item.countryCode)}</span>
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
              <DetailRow label="Allocated At" value={<span className="text-xs">{formatDateTime(item.allocatedAt)}</span>} />
            )}
            {item.shippedAt && (
              <DetailRow label="Shipped At" value={<span className="text-xs">{formatDateTime(item.shippedAt)}</span>} />
            )}
            {item.deliveredAt && (
              <DetailRow label="Delivered At" value={<span className="text-xs">{formatDateTime(item.deliveredAt)}</span>} />
            )}
            <DetailRow label="Created At" value={<span className="text-xs">{formatDateTime(item.createdAt)}</span>} />
            <DetailRow label="Last Updated" value={<span className="text-xs">{formatDateTime(item.updatedAt)}</span>} />
          </div>

          {item.notes && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                Notes
              </div>
              <p className="text-sm bg-muted/40 border rounded-md p-3">{item.notes}</p>
            </div>
          )}
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 px-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm text-right min-w-0">{value}</span>
    </div>
  );
}

/* ========================= Order Detail Dialog ========================= */

function OrderDetailDialog({
  order,
  countryName,
  onOpenChange,
}: {
  order: StockOrder | null;
  countryName: (code: string) => string;
  onOpenChange: (open: boolean) => void;
}) {
  if (!order) return null;
  const statusStyle = ORDER_STATUS_STYLES[order.status];
  const typeMeta = TYPE_META[order.itemType];
  const TypeIcon = typeMeta.icon;

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="size-5 text-emerald-600" />
            Order Detail
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px]">
            {order.orderCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Status + type */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={cn("text-[10px]", statusStyle.className)}>
              {statusStyle.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                order.itemType === "physical_terminal"
                  ? "text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                  : "text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
              )}
            >
              <TypeIcon className="size-2.5 mr-0.5" />
              {typeMeta.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] capitalize">
              {order.userType}
            </Badge>
          </div>

          {/* Cost summary */}
          <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-900/10 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Receipt className="size-3" /> Unit price
              </span>
              <span className="font-mono">{formatCurrency(order.unitPrice, order.currency)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground inline-flex items-center gap-1">
                <Truck className="size-3" /> Delivery fee
              </span>
              <span className="font-mono">{formatCurrency(order.deliveryFee, order.currency)}</span>
            </div>
            <div className="border-t border-emerald-200 dark:border-emerald-900/50 my-1" />
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold inline-flex items-center gap-1">
                <Wallet className="size-3.5 text-emerald-600" /> Total amount
              </span>
              <span className="font-mono font-bold text-emerald-800 dark:text-emerald-200">
                {formatCurrency(order.totalAmount, order.currency)}
              </span>
            </div>
          </div>

          {/* Detail rows */}
          <div className="rounded-md border divide-y">
            <DetailRow
              label="Customer"
              value={
                <span className="text-sm inline-flex items-center gap-1">
                  {order.userType === "merchant" ? (
                    <Building2 className="size-3 text-emerald-600" />
                  ) : (
                    <User className="size-3 text-amber-600" />
                  )}
                  {order.userName}
                </span>
              }
            />
            <DetailRow label="Customer ID" value={<span className="font-mono text-xs">{order.userId}</span>} />
            <DetailRow label="Item Model" value={<span className="text-sm">{order.model}</span>} />
            <DetailRow
              label="Country"
              value={
                <span className="text-sm">
                  <span className="font-mono">{order.countryCode}</span>
                  <span className="text-muted-foreground ml-1">· {countryName(order.countryCode)}</span>
                </span>
              }
            />
            <DetailRow
              label="Delivery Address"
              value={<span className="text-xs">{order.deliveryAddress || "—"}</span>}
            />
            {order.stockItemId && (
              <DetailRow label="Stock Item" value={<span className="font-mono text-xs">{order.stockItemId}</span>} />
            )}
            <DetailRow label="Created" value={<span className="text-xs">{formatDateTime(order.createdAt)}</span>} />
            <DetailRow label="Last Updated" value={<span className="text-xs">{formatDateTime(order.updatedAt)}</span>} />
          </div>

          {order.notes && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                Notes
              </div>
              <p className="text-sm bg-muted/40 border rounded-md p-3">{order.notes}</p>
            </div>
          )}
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
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [countryCode, setCountryCode] = useState<string>(
    () => countries[0]?.countryCode ?? "",
  );
  const [notes, setNotes] = useState("");
  const [imgPreviewError, setImgPreviewError] = useState(false);

  const currency = useMemo(() => {
    return countries.find((c) => c.countryCode === countryCode)?.currency ?? "NGN";
  }, [countryCode, countries]);

  const serialError = useMemo(() => {
    if (!serialNumber.trim()) return null;
    if (existingSerials.has(serialNumber.trim().toLowerCase())) {
      return "Serial number already exists in stock.";
    }
    return null;
  }, [serialNumber, existingSerials]);

  const priceNum = useMemo(() => {
    const n = Number(price);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [price]);

  const canSubmit =
    serialNumber.trim() &&
    model.trim() &&
    price.trim() &&
    priceNum > 0 &&
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
      description: description.trim(),
      price: priceNum,
      currency,
      imageUrl: imageUrl.trim() || null,
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
            Register a new physical item in Faya&apos;s warehouse. Items enter as{" "}
            <span className="font-medium text-emerald-700 dark:text-emerald-400">In Stock</span>{" "}
            and become available for ordering.
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
                <RadioGroupItem value="physical_terminal" id="opt_terminal" className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <Smartphone className="size-3.5 text-emerald-600" />
                    Physical Terminal
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Card POS device (e.g. Ingenico Move 2500).
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
                <RadioGroupItem value="physical_card" id="opt_card" className="mt-0.5" />
                <div className="space-y-0.5">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <CreditCard className="size-3.5 text-emerald-600" />
                    Physical Card
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Embossed/plastic card with issuance fee.
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

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief product description shown on the card"
              className="text-sm min-h-[60px]"
            />
          </div>

          {/* Price + country */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Price <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 45000"
                  className="h-9 text-sm pr-14 font-mono"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">
                  {currency}
                </span>
              </div>
              {price.trim() && priceNum <= 0 && (
                <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                  <XCircle className="size-3" /> Price must be greater than 0
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Warehouse country <span className="text-red-500">*</span>
              </Label>
              <Select
                value={countryCode}
                onValueChange={(v) => {
                  setCountryCode(v);
                  setImgPreviewError(false);
                }}
              >
                <SelectTrigger size="sm" className="w-full text-sm h-9">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.countryCode} value={c.countryCode}>
                      {c.countryCode} · {c.countryName} ({c.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Image URL with live preview */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Product image URL</Label>
            <Input
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                setImgPreviewError(false);
              }}
              placeholder="https://...product-image.jpg"
              className="h-9 text-sm"
            />
            {imageUrl.trim() && !imgPreviewError ? (
              <div className="mt-2 relative w-full h-[100px] rounded-md overflow-hidden border bg-slate-50 dark:bg-slate-800">
                <img
                  src={imageUrl.trim()}
                  alt="Preview"
                  onError={() => setImgPreviewError(true)}
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-1 left-1">
                  <Badge variant="secondary" className="text-[9px] bg-white/90 dark:bg-slate-900/80">
                    Live preview
                  </Badge>
                </div>
              </div>
            ) : imageUrl.trim() && imgPreviewError ? (
              <div className="mt-2 w-full h-[100px] rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 flex flex-col items-center justify-center text-red-600 dark:text-red-400">
                <ImageOff className="size-6 mb-1" />
                <span className="text-[10px]">Image could not be loaded</span>
              </div>
            ) : null}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. New shipment arrived 2025-03 batch. QA-tested."
              className="text-sm min-h-[60px]"
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

/* ============================ Create Order Dialog ============================ */

interface CreateOrderPayload {
  userType: "consumer" | "merchant";
  userId: string;
  userName: string;
  countryCode: string;
  itemType: StockItemType;
  item: StockItem;
  deliveryAddress: string;
  deliveryFee: number;
  notes: string;
}

function CreateOrderDialog({
  open,
  onOpenChange,
  countries,
  inStockByType,
  countryCurrency,
  defaultDeliveryFee,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countries: CountryConfig[];
  inStockByType: Record<StockItemType, StockItem[]>;
  countryCurrency: (code: string) => string;
  defaultDeliveryFee: Record<string, number>;
  onSubmit: (payload: CreateOrderPayload) => void;
}) {
  const [userType, setUserType] = useState<"consumer" | "merchant">("merchant");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [countryCode, setCountryCode] = useState<string>(
    () => countries[0]?.countryCode ?? "",
  );

  // Determine which item types are available (have at least 1 in stock)
  const hasTerminal = inStockByType.physical_terminal.length > 0;
  const hasCard = inStockByType.physical_card.length > 0;

  const [itemType, setItemType] = useState<StockItemType>(() =>
    inStockByType.physical_terminal.length > 0 ? "physical_terminal" : "physical_card",
  );
  const [stockItemId, setStockItemId] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<string>(() => {
    const cc = countries[0]?.countryCode ?? "";
    return String(defaultDeliveryFee[cc] ?? 0);
  });
  const [notes, setNotes] = useState("");

  // When item type changes, clear the previously selected item — handled inline
  // in the RadioGroup onValueChange below.
  // When country changes, refresh the default delivery fee — handled inline in
  // the Select onValueChange below.

  const availableItems = inStockByType[itemType] ?? [];

  const selectedItem = useMemo(
    () => availableItems.find((i) => i.id === stockItemId) ?? null,
    [availableItems, stockItemId],
  );

  const currency = selectedItem?.currency ?? countryCurrency(countryCode);
  const deliveryFeeNum = useMemo(() => {
    const n = Number(deliveryFee);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [deliveryFee]);

  const totalAmount = (selectedItem?.price ?? 0) + deliveryFeeNum;

  const canSubmit =
    userName.trim() &&
    userId.trim() &&
    countryCode &&
    selectedItem &&
    deliveryAddress.trim() &&
    deliveryFee.trim();

  function handleSubmit() {
    if (!canSubmit || !selectedItem) return;
    onSubmit({
      userType,
      userId: userId.trim(),
      userName: userName.trim(),
      countryCode,
      itemType,
      item: selectedItem,
      deliveryAddress: deliveryAddress.trim(),
      deliveryFee: deliveryFeeNum,
      notes: notes.trim(),
    });
  }

  // If no items of any type are in stock, show a blocking message
  const nothingInStock = !hasTerminal && !hasCard;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-emerald-600" />
            Create Order
          </DialogTitle>
          <DialogDescription>
            Place an order on behalf of a consumer or merchant. You can only
            order items that are currently{" "}
            <span className="font-medium text-emerald-700 dark:text-emerald-400">In Stock</span>.
            The unit price + delivery fee = total amount charged.
          </DialogDescription>
        </DialogHeader>

        {nothingInStock ? (
          <div className="py-6">
            <EmptyState
              icon={PackageX}
              title="No items in stock"
              description="There are currently no terminals or cards available to order. Add items to stock first, or mark existing items as In Stock."
            />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* User type */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">User type</Label>
              <RadioGroup
                value={userType}
                onValueChange={(v) => setUserType(v as "consumer" | "merchant")}
                className="grid grid-cols-2 gap-2"
              >
                <label
                  htmlFor="ut_merchant"
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition-colors text-sm",
                    userType === "merchant"
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
                      : "border-input hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value="merchant" id="ut_merchant" />
                  <Building2 className="size-3.5 text-emerald-600" />
                  Merchant
                </label>
                <label
                  htmlFor="ut_consumer"
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition-colors text-sm",
                    userType === "consumer"
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
                      : "border-input hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value="consumer" id="ut_consumer" />
                  <User className="size-3.5 text-amber-600" />
                  Consumer
                </label>
              </RadioGroup>
            </div>

            {/* User name + id */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {userType === "merchant" ? "Merchant name" : "Consumer name"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder={userType === "merchant" ? "e.g. Lagos Foods Ltd" : "e.g. Adebayo Ogun"}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {userType === "merchant" ? "Merchant ID" : "Consumer ID"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="e.g. mch_NG_001"
                  className="h-9 text-sm font-mono"
                />
              </div>
            </div>

            {/* Country */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Delivery country <span className="text-red-500">*</span>
              </Label>
              <Select
                value={countryCode}
                onValueChange={(v) => {
                  setCountryCode(v);
                  setDeliveryFee(String(defaultDeliveryFee[v] ?? 0));
                }}
              >
                <SelectTrigger size="sm" className="w-full text-sm h-9">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.countryCode} value={c.countryCode}>
                      {c.countryCode} · {c.countryName} ({c.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item type selector — only types with in-stock items are enabled */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Item type <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                value={itemType}
                onValueChange={(v) => {
                  setItemType(v as StockItemType);
                  setStockItemId("");
                }}
                className="grid grid-cols-2 gap-2"
              >
                <label
                  htmlFor="it_terminal"
                  className={cn(
                    "flex items-start gap-2 rounded-md border p-2.5 transition-colors",
                    hasTerminal
                      ? "cursor-pointer"
                      : "opacity-50 cursor-not-allowed",
                    itemType === "physical_terminal" && hasTerminal
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
                      : "border-input",
                  )}
                >
                  <RadioGroupItem
                    value="physical_terminal"
                    id="it_terminal"
                    disabled={!hasTerminal}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <Smartphone className="size-3.5 text-emerald-600" />
                      Terminal
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {hasTerminal
                        ? `${inStockByType.physical_terminal.length} in stock`
                        : "None in stock — disabled"}
                    </div>
                  </div>
                </label>
                <label
                  htmlFor="it_card"
                  className={cn(
                    "flex items-start gap-2 rounded-md border p-2.5 transition-colors",
                    hasCard ? "cursor-pointer" : "opacity-50 cursor-not-allowed",
                    itemType === "physical_card" && hasCard
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
                      : "border-input",
                  )}
                >
                  <RadioGroupItem
                    value="physical_card"
                    id="it_card"
                    disabled={!hasCard}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <CreditCard className="size-3.5 text-emerald-600" />
                      Card
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {hasCard
                        ? `${inStockByType.physical_card.length} in stock`
                        : "None in stock — disabled"}
                    </div>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* Select specific item */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Select item <span className="text-red-500">*</span>
              </Label>
              <Select
                value={stockItemId}
                onValueChange={setStockItemId}
                disabled={availableItems.length === 0}
              >
                <SelectTrigger size="sm" className="w-full text-sm h-9">
                  <SelectValue
                    placeholder={
                      availableItems.length === 0
                        ? "No items in stock"
                        : "Choose an item..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableItems.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      <span className="font-mono text-xs mr-2">{i.serialNumber}</span>
                      <span className="text-xs">{i.model}</span>
                      <span className="ml-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(i.price, i.currency)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableItems.length === 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="size-3" /> No items of this type are
                  currently in stock. Select another type or add items first.
                </p>
              )}
            </div>

            {/* Delivery address */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Delivery address <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Full delivery address (street, city, region)"
                className="text-sm min-h-[60px]"
              />
            </div>

            {/* Delivery fee */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Delivery fee <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  placeholder="e.g. 2000"
                  className="h-9 text-sm pr-14 font-mono"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">
                  {currency}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pre-filled with the default for {countryCode || "—"}. Adjust as needed.
              </p>
            </div>

            {/* Cost summary */}
            <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-900/10 p-3 space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-1">
                Cost Summary
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Unit price</span>
                <span className="font-mono">
                  {selectedItem ? formatCurrency(selectedItem.price, currency) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Delivery fee</span>
                <span className="font-mono">
                  {formatCurrency(deliveryFeeNum, currency)}
                </span>
              </div>
              <div className="border-t border-emerald-200 dark:border-emerald-900/50 my-1" />
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold inline-flex items-center gap-1">
                  <PlusCircle className="size-3.5 text-emerald-600" />
                  Total amount
                </span>
                <span className="font-mono font-bold text-emerald-800 dark:text-emerald-200">
                  {formatCurrency(totalAmount, currency)}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                Unit price <ArrowRight className="size-2.5" /> + Delivery fee{" "}
                <ArrowRight className="size-2.5" /> Total
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this order"
                className="text-sm min-h-[50px]"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={!canSubmit || nothingInStock}
            onClick={handleSubmit}
          >
            <ShoppingCart className="size-4 mr-1" /> Place order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
