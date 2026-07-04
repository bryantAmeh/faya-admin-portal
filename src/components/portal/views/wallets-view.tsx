"use client";

/**
 * Faya Admin Portal — Wallets View (§9 Wallet & Ledger Management)
 *
 * Lists every consumer wallet on the Faya platform. Admins can:
 *   - Search by wallet ID or user name
 *   - Filter by country, status, currency
 *   - Freeze / unfreeze a wallet
 *   - Open a details Sheet showing balance breakdown, linked cards,
 *     and a placeholder for ledger entries (the ledger collection will
 *     be populated in a later phase)
 *
 * RESTRICTION: Manual balance adjustment (credit/debit) requires dual
 * approval — admins can only freeze/unfreeze wallets directly. Any
 * balance change must go through the Approvals workflow. A note in the
 * ViewHeader reinforces this.
 *
 * Country scoping: Super Admin → all; region/country-scoped staff → only
 * `getVisibleCountryCodes(staff, countries)`. The view self-subscribes to
 * `wallets`, `cards` (for linked-card names), and `countries` via
 * `adminData.subscribeX` because the stub takes no props.
 *
 * All mutations are mirrored to the audit log via `logAudit(...)` with the
 * action keys: wallet.freeze / wallet.unfreeze / wallet.view_details.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Search,
  Filter,
  Snowflake,
  Play,
  Eye,
  MoreHorizontal,
  Lock,
  Unlock,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Scale,
  ArrowRightLeft,
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
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { adminData, logAudit } from "@/lib/admin-data";
import {
  getVisibleCountryCodes,
  getScopeLabel,
} from "@/lib/access-scope";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatCompact,
  timeAgo,
} from "@/lib/formatters";
import type {
  Wallet as WalletType,
  WalletStatus,
  Card as CardType,
  CountryConfig,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------- Badges --------------------------------- */

const WALLET_STATUS_STYLES: Record<WalletStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  frozen: { label: "Frozen", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  closed: { label: "Closed", className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
};

const STATUS_FILTER_VALUES: { value: WalletStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "frozen", label: "Frozen" },
  { value: "closed", label: "Closed" },
];

/* ------------------------------- View ----------------------------------- */

export function WalletsView() {
  const { staff: currentStaff } = useAuth();

  /* Self-subscribe — the stub takes no props. */
  const [wallets, setWallets] = useState<WalletType[]>([]);
  const [cards, setCards] = useState<CardType[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubWallets: (() => void) | null = null;
    let unsubCards: (() => void) | null = null;
    let unsubCountries: (() => void) | null = null;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setLoading(false);
      }
    };
    unsubWallets = adminData.subscribeWallets((items) => {
      setWallets(items);
      finish();
    });
    unsubCards = adminData.subscribeCards((items) => {
      setCards(items);
      finish();
    });
    unsubCountries = adminData.subscribeCountries((items) => {
      setCountries(items);
      finish();
    });
    const t = setTimeout(finish, 1500);
    return () => {
      clearTimeout(t);
      unsubWallets?.();
      unsubCards?.();
      unsubCountries?.();
    };
  }, []);

  /* Country scoping. */
  const visibleCountryCodes = useMemo(
    () => getVisibleCountryCodes(currentStaff, countries),
    [currentStaff, countries],
  );

  const scopedWallets = useMemo(
    () => wallets.filter((w) => visibleCountryCodes.has(w.countryCode)),
    [wallets, visibleCountryCodes],
  );

  const filterableCountries = useMemo(() => {
    const codes = new Set(scopedWallets.map((w) => w.countryCode));
    return countries
      .filter((c) => codes.has(c.countryCode))
      .sort((a, b) => a.countryCode.localeCompare(b.countryCode));
  }, [countries, scopedWallets]);

  const filterableCurrencies = useMemo(() => {
    const set = new Set<string>();
    scopedWallets.forEach((w) => set.add(w.currency));
    return Array.from(set).sort();
  }, [scopedWallets]);

  /* Card lookup map for linked-card display in details sheet. */
  const cardsById = useMemo(() => {
    const m = new Map<string, CardType>();
    cards.forEach((c) => m.set(c.id, c));
    return m;
  }, [cards]);

  /* ----------------------------- Filters ----------------------------- */
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<WalletStatus | "all">("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedWallets.filter((w) => {
      if (q) {
        const hay = `${w.walletId} ${w.userName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (countryFilter !== "all" && w.countryCode !== countryFilter) return false;
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      if (currencyFilter !== "all" && w.currency !== currencyFilter) return false;
      return true;
    });
  }, [scopedWallets, search, countryFilter, statusFilter, currencyFilter]);

  /* ------------------------------ Stats ------------------------------ */
  const stats = useMemo(() => {
    const total = scopedWallets.length;
    const active = scopedWallets.filter((w) => w.status === "active").length;
    const frozen = scopedWallets.filter((w) => w.status === "frozen").length;
    const totalBalance = scopedWallets.reduce((s, w) => s + w.balance, 0);
    const heldBalance = scopedWallets.reduce((s, w) => s + w.heldBalance, 0);
    return { total, active, frozen, totalBalance, heldBalance };
  }, [scopedWallets]);

  /* Multi-currency balance aggregation: show one total per currency. */
  const totalsByCurrency = useMemo(() => {
    const m = new Map<string, { balance: number; held: number; count: number }>();
    scopedWallets.forEach((w) => {
      const e = m.get(w.currency) ?? { balance: 0, held: 0, count: 0 };
      e.balance += w.balance;
      e.held += w.heldBalance;
      e.count += 1;
      m.set(w.currency, e);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [scopedWallets]);

  /* ------------------------------ Sheet ------------------------------ */
  const [selected, setSelected] = useState<WalletType | null>(null);

  const countryName = (code: string) =>
    countries.find((c) => c.countryCode === code)?.countryName ?? code;

  /* ----------------------------- Actor ------------------------------- */
  function actor() {
    return {
      staffId: currentStaff?.id ?? "unknown",
      staffName: currentStaff
        ? `${currentStaff.firstName} ${currentStaff.lastName}`
        : "Unknown",
      department: currentStaff?.departmentId ?? "unknown",
      role: currentStaff?.roleId ?? "unknown",
    };
  }

  async function handleFreeze(wallet: WalletType) {
    await adminData.updateWallet(wallet.id, { status: "frozen", updatedAt: Date.now() });
    logAudit(actor(), "wallet.freeze", "wallet", wallet.id, {
      countryCode: wallet.countryCode,
      beforeValue: `status=${wallet.status}`,
      afterValue: "status=frozen",
      reason: "Admin-initiated wallet freeze",
    });
    toast.success(`Wallet ${wallet.walletId} frozen`, {
      description: `${wallet.userName} · ${formatCurrency(wallet.balance, wallet.currency)}`,
    });
  }

  async function handleUnfreeze(wallet: WalletType) {
    await adminData.updateWallet(wallet.id, { status: "active", updatedAt: Date.now() });
    logAudit(actor(), "wallet.unfreeze", "wallet", wallet.id, {
      countryCode: wallet.countryCode,
      beforeValue: `status=${wallet.status}`,
      afterValue: "status=active",
      reason: "Admin-initiated wallet unfreeze",
    });
    toast.success(`Wallet ${wallet.walletId} unfrozen`, {
      description: `${wallet.userName} · ${formatCurrency(wallet.balance, wallet.currency)}`,
    });
  }

  function handleViewDetails(wallet: WalletType) {
    setSelected(wallet);
    logAudit(actor(), "wallet.view_details", "wallet", wallet.id, {
      countryCode: wallet.countryCode,
      reason: "Admin opened wallet details sheet",
    });
  }

  function handleAdjustmentRequest(wallet: WalletType) {
    toast.info("Manual adjustment requires dual approval", {
      description: `Submit an approval request for wallet ${wallet.walletId}. Dual approval is required for all balance changes.`,
    });
  }

  const hasActiveFilters =
    search.trim() !== "" ||
    countryFilter !== "all" ||
    statusFilter !== "all" ||
    currencyFilter !== "all";

  function clearFilters() {
    setSearch("");
    setCountryFilter("all");
    setStatusFilter("all");
    setCurrencyFilter("all");
  }

  return (
    <>
      <ViewHeader
        title="Wallets"
        description={`Consumer wallet balances & ledger · ${getScopeLabel(currentStaff)}`}
        icon={Wallet}
        actions={
          <Badge
            variant="outline"
            className="text-emerald-800 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-900/30"
          >
            <ShieldCheck className="size-3 mr-1" />
            Dual approval enforced
          </Badge>
        }
      />
      <ViewContainer>
        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total Wallets" value={formatNumber(stats.total)} icon={Wallet} loading={loading} />
          <StatCard label="Active" value={formatNumber(stats.active)} icon={CheckCircle2} tone="success" loading={loading} />
          <StatCard label="Frozen" value={formatNumber(stats.frozen)} icon={Lock} tone="warning" loading={loading} />
          <StatCard
            label="Total Balance"
            value={totalsByCurrency.length === 1 ? formatCompact(totalsByCurrency[0][1].balance) : formatCompact(stats.totalBalance)}
            hint={totalsByCurrency.length === 1
              ? `${totalsByCurrency[0][0]} · ${formatNumber(totalsByCurrency[0][1].count)} wallets`
              : `${totalsByCurrency.length} currencies`}
            icon={Wallet}
            tone="info"
            loading={loading}
          />
          <StatCard
            label="Held Balance"
            value={totalsByCurrency.length === 1 ? formatCompact(totalsByCurrency[0][1].held) : formatCompact(stats.heldBalance)}
            hint={totalsByCurrency.length === 1 ? totalsByCurrency[0][0] : `${totalsByCurrency.length} currencies`}
            icon={Scale}
            tone="danger"
            loading={loading}
          />
        </div>

        {/* Dual-approval notice */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-3 text-sm text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
          <ShieldCheck className="size-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Balance integrity policy:</span>{" "}
            Manual balance adjustments (credit / debit) require{" "}
            <span className="font-semibold">dual approval</span> via the
            Approvals workflow. Admins may freeze / unfreeze wallets directly,
            but no admin can move funds unilaterally.
          </div>
        </div>

        {/* Filter + table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="size-4 text-emerald-600" />
              Consumer Wallets
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search wallet ID or user…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger size="sm" className="w-[180px] h-9 text-xs">
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
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as WalletStatus | "all")}>
                <SelectTrigger size="sm" className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_VALUES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger size="sm" className="w-[120px] h-9 text-xs">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All currencies</SelectItem>
                  {filterableCurrencies.map((cur) => (
                    <SelectItem key={cur} value={cur}>{cur}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-emerald-700">
                  Clear
                </Button>
              )}
              <Badge variant="secondary" className="ml-auto text-[11px]">
                {filtered.length} of {scopedWallets.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading wallets…</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title={hasActiveFilters ? "No wallets match these filters" : "No wallets in your scope"}
                description={hasActiveFilters ? "Adjust the filters or clear them to see all wallets." : "Consumer wallets in your countries will appear here."}
              />
            ) : (
              <ScrollTable>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                  <TableRow>
                    <TableHead className="pl-4">Wallet ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="hidden md:table-cell">Country</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead className="hidden md:table-cell">Available</TableHead>
                    <TableHead className="hidden lg:table-cell">Held</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Linked Cards</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((w) => {
                    const sb = WALLET_STATUS_STYLES[w.status];
                    return (
                      <TableRow key={w.id} className="cursor-pointer" onClick={() => handleViewDetails(w)}>
                        <TableCell className="pl-4 font-mono text-xs">{w.walletId}</TableCell>
                        <TableCell className="text-sm font-medium">
                          {w.userName}
                          <span className="block text-[10px] text-muted-foreground">{w.userId}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          <span className="font-mono">{w.countryCode}</span>
                          <span className="block text-[10px] text-muted-foreground">{countryName(w.countryCode)}</span>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{w.currency}</TableCell>
                        <TableCell className="text-sm font-semibold tabular-nums">
                          {formatCurrency(w.balance, w.currency)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs tabular-nums text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(w.availableBalance, w.currency)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs tabular-nums text-amber-700 dark:text-amber-400">
                          {w.heldBalance > 0 ? formatCurrency(w.heldBalance, w.currency) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-[10px]", sb.className)}>
                            {w.status === "frozen" && <Lock className="size-3 mr-0.5" />}
                            {sb.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {w.linkedCardIds.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground italic">No linked cards</span>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
                              <CreditCard className="size-3 mr-0.5" /> {w.linkedCardIds.length}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                          {timeAgo(w.createdAt)}
                        </TableCell>
                        <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                          <WalletActions
                            wallet={w}
                            onView={() => handleViewDetails(w)}
                            onFreeze={() => handleFreeze(w)}
                            onUnfreeze={() => handleUnfreeze(w)}
                            onAdjust={() => handleAdjustmentRequest(w)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </ScrollTable>
            )}
          </CardContent>
        </Card>

        {/* Per-currency totals */}
        {totalsByCurrency.length > 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Scale className="size-4 text-emerald-600" />
                Balance totals by currency
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollTable>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                  <TableRow>
                    <TableHead className="pl-4">Currency</TableHead>
                    <TableHead>Wallets</TableHead>
                    <TableHead>Total Balance</TableHead>
                    <TableHead>Held Balance</TableHead>
                    <TableHead className="pr-4">Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {totalsByCurrency.map(([cur, e]) => (
                    <TableRow key={cur}>
                      <TableCell className="pl-4 font-mono text-xs">{cur}</TableCell>
                      <TableCell className="text-xs tabular-nums">{formatNumber(e.count)}</TableCell>
                      <TableCell className="text-sm font-semibold tabular-nums">{formatCurrency(e.balance, cur)}</TableCell>
                      <TableCell className="text-xs tabular-nums text-amber-700 dark:text-amber-400">
                        {e.held > 0 ? formatCurrency(e.held, cur) : "—"}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-emerald-700 dark:text-emerald-400 pr-4">
                        {formatCurrency(e.balance - e.held, cur)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </ScrollTable>
            </CardContent>
          </Card>
        )}
      </ViewContainer>

      {/* Details Sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <WalletDetailsSheet
              wallet={selected}
              countryName={countryName}
              cardsById={cardsById}
              onAdjust={() => handleAdjustmentRequest(selected)}
            />
          )}
        </SheetContent>
      </Sheet>

      <SonnerToaster richColors closeButton position="top-right" />
    </>
  );
}

/* --------------------------- Wallet actions menu --------------------------- */

function WalletActions({
  wallet,
  onView,
  onFreeze,
  onUnfreeze,
  onAdjust,
}: {
  wallet: WalletType;
  onView: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  onAdjust: () => void;
}) {
  const isClosed = wallet.status === "closed";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open wallet actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
          Wallet actions
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <Eye className="size-4 mr-2" /> View details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {wallet.status === "active" && (
          <DropdownMenuItem onClick={onFreeze}>
            <Snowflake className="size-4 mr-2 text-sky-600" /> Freeze
          </DropdownMenuItem>
        )}
        {wallet.status === "frozen" && (
          <DropdownMenuItem onClick={onUnfreeze}>
            <Play className="size-4 mr-2 text-emerald-600" /> Unfreeze
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onAdjust}>
          <ArrowRightLeft className="size-4 mr-2 text-amber-600" /> Request adjustment…
        </DropdownMenuItem>
        {isClosed && (
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground italic">
            Wallet is closed — no actions available
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* --------------------------- Details sheet body --------------------------- */

function WalletDetailsSheet({
  wallet,
  countryName,
  cardsById,
  onAdjust,
}: {
  wallet: WalletType;
  countryName: (code: string) => string;
  cardsById: Map<string, CardType>;
  onAdjust: () => void;
}) {
  const sb = WALLET_STATUS_STYLES[wallet.status];
  const linkedCards = wallet.linkedCardIds
    .map((id) => cardsById.get(id))
    .filter((c): c is CardType => !!c);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Wallet className="size-5 text-emerald-600" />
          <span className="font-mono text-base">{wallet.walletId}</span>
        </SheetTitle>
        <SheetDescription>
          {wallet.userName} · {countryName(wallet.countryCode)} ({wallet.countryCode})
        </SheetDescription>
      </SheetHeader>

      <div className="px-4 pb-6 space-y-4">
        {/* Balance hero */}
        <div className="rounded-xl border bg-gradient-to-br from-emerald-900 to-emerald-700 dark:from-emerald-950 dark:to-emerald-800 text-white p-4 shadow-md">
          <div className="text-[11px] uppercase tracking-widest text-emerald-100/80">
            Current balance
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {formatCurrency(wallet.balance, wallet.currency)}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-[11px]">
            <div>
              <div className="text-emerald-100/70 uppercase tracking-wider">Available</div>
              <div className="font-semibold text-base tabular-nums mt-0.5">
                {formatCurrency(wallet.availableBalance, wallet.currency)}
              </div>
            </div>
            <div>
              <div className="text-emerald-100/70 uppercase tracking-wider">Held</div>
              <div className="font-semibold text-base tabular-nums mt-0.5">
                {formatCurrency(wallet.heldBalance, wallet.currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className={cn("text-[10px]", sb.className)}>
            {wallet.status === "frozen" && <Lock className="size-3 mr-0.5" />}
            {sb.label}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono">
            {wallet.currency}
          </Badge>
          {wallet.heldBalance > 0 && (
            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:bg-amber-900/30">
              <Scale className="size-3 mr-0.5" /> {formatCurrency(wallet.heldBalance, wallet.currency)} held
            </Badge>
          )}
          {linkedCards.length > 0 && (
            <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-900/30">
              <CreditCard className="size-3 mr-0.5" /> {linkedCards.length} linked card{linkedCards.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        {/* Dual-approval notice */}
        <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-2.5 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-1.5">
          <ShieldCheck className="size-3.5 mt-0.5 shrink-0" />
          <span>
            Balance adjustments require dual approval. Click &ldquo;Request adjustment&rdquo; below to start the approval workflow.
          </span>
        </div>

        <Separator />

        {/* Wallet owner */}
        <DetailSection title="Wallet owner">
          <DetailRow label="User ID" value={<span className="font-mono text-xs">{wallet.userId}</span>} />
          <DetailRow label="Name" value={wallet.userName} />
          <DetailRow label="Country" value={`${wallet.countryCode} · ${countryName(wallet.countryCode)}`} />
        </DetailSection>

        {/* Balance breakdown */}
        <DetailSection title="Balance breakdown">
          <DetailRow label="Currency" value={<span className="font-mono">{wallet.currency}</span>} />
          <DetailRow
            label="Total balance"
            value={<span className="font-mono tabular-nums font-semibold">{formatCurrency(wallet.balance, wallet.currency)}</span>}
          />
          <DetailRow
            label="Available"
            value={<span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(wallet.availableBalance, wallet.currency)}</span>}
          />
          <DetailRow
            label="Held (in-flight)"
            value={<span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">{formatCurrency(wallet.heldBalance, wallet.currency)}</span>}
          />
        </DetailSection>

        {/* Linked cards */}
        <DetailSection title="Linked cards">
          {linkedCards.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground italic">
              No cards linked to this wallet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {linkedCards.map((c) => (
                <div key={c.id} className="px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-mono">{c.cardId}</div>
                    <div className="text-[10px] text-muted-foreground">
                      •••• {c.last4} · {c.scheme.toUpperCase()} · {c.type}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] capitalize shrink-0",
                      c.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {c.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        {/* Ledger placeholder */}
        <DetailSection title="Ledger entries">
          <div className="px-3 py-4 text-center">
            <ArrowRightLeft className="size-5 mx-auto text-muted-foreground mb-1" />
            <div className="text-xs text-muted-foreground">
              Ledger entries will appear here once the ledger collection is populated.
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 italic">
              Phase 4 — full ledger integration pending
            </div>
          </div>
        </DetailSection>

        {/* Lifecycle */}
        <DetailSection title="Lifecycle">
          <DetailRow label="Created" value={formatDateTime(wallet.createdAt)} />
          <DetailRow label="Last updated" value={formatDateTime(wallet.updatedAt)} />
        </DetailSection>

        <Button variant="outline" className="w-full" onClick={onAdjust}>
          <ArrowRightLeft className="size-4 mr-2" />
          Request balance adjustment
        </Button>
      </div>
    </>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      <div className="rounded-lg border bg-card divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right truncate">{value}</span>
    </div>
  );
}

/* --------------------------- Scroll table wrapper --------------------------- */

function ScrollTable({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={
        "max-h-[60vh] overflow-auto " +
        "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent " +
        "[&::-webkit-scrollbar-thumb]:rounded-full " +
        "[&::-webkit-scrollbar-thumb]:bg-slate-300 " +
        "dark:[&::-webkit-scrollbar-thumb]:bg-slate-700"
      }
    >
      <table className="w-full caption-bottom text-sm">{children}</table>
    </div>
  );
}
