"use client";

/**
 * Faya Admin Portal — Cards View (§8 Card Management)
 *
 * Lists every virtual & physical card issued through Faya's card provider
 * (Paymentology). Admins can:
 *   - Search by card ID, last4, or user name
 *   - Filter by country, type (virtual/physical), status, scheme
 *   - Freeze / unfreeze a card (mutates `frozen` + `status` together)
 *   - Terminate a card (confirm via AlertDialog — irreversible)
 *   - Open a details Sheet showing card metadata, spend limits, provider info
 *
 * SECURITY: Admins NEVER see the full PAN, CVV, or PIN. Only `last4`,
 * expiry month/year, scheme, and provider metadata are exposed. A warning
 * banner sits in the ViewHeader to reinforce this every time the view loads.
 *
 * Country scoping: Super Admin → all; region/country-scoped staff → only
 * `getVisibleCountryCodes(staff, countries)`. The view self-subscribes to
 * `cards` and `countries` via `adminData.subscribeCards` /
 * `adminData.subscribeCountries` because the stub takes no props.
 *
 * All mutations are mirrored to the audit log via `logAudit(...)` with the
 * action keys: card.freeze / card.unfreeze / card.terminate / card.view_details.
 */
import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Search,
  Filter,
  Snowflake,
  Play,
  Ban,
  Eye,
  MoreHorizontal,
  ShieldAlert,
  Wallet,
  CheckCircle2,
  Nfc,
  Lock,
  Unlock,
  Smartphone,
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
  timeAgo,
} from "@/lib/formatters";
import type {
  Card as CardType,
  CardStatus,
  CardScheme,
  CountryConfig,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------- Badges --------------------------------- */

const CARD_STATUS_STYLES: Record<CardStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  frozen: { label: "Frozen", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  blocked: { label: "Blocked", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  expired: { label: "Expired", className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  terminated: { label: "Terminated", className: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
  replaced: { label: "Replaced", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
};

const SCHEME_STYLES: Record<CardScheme, { label: string; className: string }> = {
  visa: { label: "Visa", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" },
  mastercard: { label: "Mastercard", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  verve: { label: "Verve", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

const TYPE_STYLES = {
  virtual: { label: "Virtual", className: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
  physical: { label: "Physical", className: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
} as const;

const STATUS_FILTER_VALUES: { value: CardStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "frozen", label: "Frozen" },
  { value: "blocked", label: "Blocked" },
  { value: "expired", label: "Expired" },
  { value: "terminated", label: "Terminated" },
  { value: "replaced", label: "Replaced" },
];

const SCHEME_FILTER_VALUES: { value: CardScheme | "all"; label: string }[] = [
  { value: "all", label: "All schemes" },
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "verve", label: "Verve" },
];

const TYPE_FILTER_VALUES: { value: "all" | "virtual" | "physical"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "virtual", label: "Virtual" },
  { value: "physical", label: "Physical" },
];

/* ------------------------------- View ----------------------------------- */

export function CardsView() {
  const { staff: currentStaff } = useAuth();

  /* Self-subscribe to data — the stub takes no props. */
  const [cards, setCards] = useState<CardType[]>([]);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubCards: (() => void) | null = null;
    let unsubCountries: (() => void) | null = null;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setLoading(false);
      }
    };
    unsubCards = adminData.subscribeCards((items) => {
      setCards(items);
      finish();
    });
    unsubCountries = adminData.subscribeCountries((items) => {
      setCountries(items);
      finish();
    });
    // Safety: never block UI forever if subscriptions are slow.
    const t = setTimeout(finish, 1500);
    return () => {
      clearTimeout(t);
      unsubCards?.();
      unsubCountries?.();
    };
  }, []);

  /* Country scoping via the shared helper. */
  const visibleCountryCodes = useMemo(
    () => getVisibleCountryCodes(currentStaff, countries),
    [currentStaff, countries],
  );

  const scopedCards = useMemo(
    () => cards.filter((c) => visibleCountryCodes.has(c.countryCode)),
    [cards, visibleCountryCodes],
  );

  const filterableCountries = useMemo(() => {
    const codes = new Set(scopedCards.map((c) => c.countryCode));
    return countries
      .filter((c) => codes.has(c.countryCode))
      .sort((a, b) => a.countryCode.localeCompare(b.countryCode));
  }, [countries, scopedCards]);

  /* ----------------------------- Filters ----------------------------- */
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "virtual" | "physical">("all");
  const [statusFilter, setStatusFilter] = useState<CardStatus | "all">("all");
  const [schemeFilter, setSchemeFilter] = useState<CardScheme | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedCards.filter((c) => {
      if (q) {
        const hay = `${c.cardId} ${c.last4} ${c.userName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (countryFilter !== "all" && c.countryCode !== countryFilter) return false;
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (schemeFilter !== "all" && c.scheme !== schemeFilter) return false;
      return true;
    });
  }, [scopedCards, search, countryFilter, typeFilter, statusFilter, schemeFilter]);

  /* ------------------------------ Stats ------------------------------ */
  const stats = useMemo(() => {
    const total = scopedCards.length;
    const active = scopedCards.filter((c) => c.status === "active").length;
    const virtual = scopedCards.filter((c) => c.type === "virtual").length;
    const physical = scopedCards.filter((c) => c.type === "physical").length;
    const frozenOrBlocked = scopedCards.filter(
      (c) => c.status === "frozen" || c.status === "blocked" || c.frozen,
    ).length;
    return { total, active, virtual, physical, frozenOrBlocked };
  }, [scopedCards]);

  /* ------------------------------ Sheet ------------------------------ */
  const [selected, setSelected] = useState<CardType | null>(null);

  /* ----------------------- Terminate confirm ------------------------- */
  const [terminateTarget, setTerminateTarget] = useState<CardType | null>(null);

  const countryName = (code: string) =>
    countries.find((c) => c.countryCode === code)?.countryName ?? code;

  /* ----------------------------- Actors ------------------------------ */
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

  async function handleFreeze(card: CardType) {
    await adminData.updateCard(card.id, { frozen: true, status: "frozen", updatedAt: Date.now() });
    logAudit(actor(), "card.freeze", "card", card.id, {
      countryCode: card.countryCode,
      beforeValue: `frozen=false,status=${card.status}`,
      afterValue: "frozen=true,status=frozen",
      reason: "Admin-initiated card freeze",
    });
    toast.success(`Card ${card.cardId} frozen`, {
      description: `${card.userName} · •••• ${card.last4}`,
    });
  }

  async function handleUnfreeze(card: CardType) {
    await adminData.updateCard(card.id, { frozen: false, status: "active", updatedAt: Date.now() });
    logAudit(actor(), "card.unfreeze", "card", card.id, {
      countryCode: card.countryCode,
      beforeValue: `frozen=true,status=${card.status}`,
      afterValue: "frozen=false,status=active",
      reason: "Admin-initiated card unfreeze",
    });
    toast.success(`Card ${card.cardId} unfrozen`, {
      description: `${card.userName} · •••• ${card.last4}`,
    });
  }

  async function handleTerminate(card: CardType) {
    await adminData.updateCard(card.id, { status: "terminated", frozen: true, updatedAt: Date.now() });
    logAudit(actor(), "card.terminate", "card", card.id, {
      countryCode: card.countryCode,
      beforeValue: `status=${card.status}`,
      afterValue: "status=terminated",
      reason: "Card permanently terminated by admin",
    });
    toast.success(`Card ${card.cardId} terminated`, {
      description: `${card.userName} · •••• ${card.last4}`,
    });
    setTerminateTarget(null);
    if (selected?.id === card.id) setSelected(null);
  }

  function handleViewDetails(card: CardType) {
    setSelected(card);
    logAudit(actor(), "card.view_details", "card", card.id, {
      countryCode: card.countryCode,
      reason: "Admin opened card details sheet",
    });
  }

  const hasActiveFilters =
    search.trim() !== "" ||
    countryFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    schemeFilter !== "all";

  function clearFilters() {
    setSearch("");
    setCountryFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setSchemeFilter("all");
  }

  return (
    <>
      <ViewHeader
        title="Cards"
        description={`Virtual & physical card management · ${getScopeLabel(currentStaff)}`}
        icon={CreditCard}
        actions={
          <Badge
            variant="outline"
            className="text-amber-800 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:bg-amber-900/30"
          >
            <ShieldAlert className="size-3 mr-1" />
            No PAN / CVV / PIN access
          </Badge>
        }
      />
      <ViewContainer>
        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total Cards" value={formatNumber(stats.total)} icon={CreditCard} loading={loading} />
          <StatCard label="Active" value={formatNumber(stats.active)} icon={CheckCircle2} tone="success" loading={loading} />
          <StatCard label="Virtual" value={formatNumber(stats.virtual)} icon={Nfc} tone="info" loading={loading} />
          <StatCard label="Physical" value={formatNumber(stats.physical)} icon={Smartphone} loading={loading} />
          <StatCard label="Frozen / Blocked" value={formatNumber(stats.frozenOrBlocked)} icon={Lock} tone="warning" loading={loading} />
        </div>

        {/* Security notice */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <ShieldAlert className="size-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Cardholder data protection:</span>{" "}
            Admins can only view the last 4 digits, scheme, expiry, and provider metadata. Full PAN, CVV, and PIN are never exposed in the Admin Portal.
          </div>
        </div>

        {/* Filter + table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="size-4 text-emerald-600" />
              Issued Cards
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search card ID, last4, or user…"
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
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                <SelectTrigger size="sm" className="w-[130px] h-9 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_FILTER_VALUES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CardStatus | "all")}>
                <SelectTrigger size="sm" className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_VALUES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={schemeFilter} onValueChange={(v) => setSchemeFilter(v as CardScheme | "all")}>
                <SelectTrigger size="sm" className="w-[140px] h-9 text-xs">
                  <SelectValue placeholder="Scheme" />
                </SelectTrigger>
                <SelectContent>
                  {SCHEME_FILTER_VALUES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-emerald-700">
                  Clear
                </Button>
              )}
              <Badge variant="secondary" className="ml-auto text-[11px]">
                {filtered.length} of {scopedCards.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading cards…</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title={hasActiveFilters ? "No cards match these filters" : "No cards in your scope"}
                description={hasActiveFilters ? "Adjust the filters or clear them to see all cards." : "Cards issued in your countries will appear here."}
              />
            ) : (
              <ScrollTable>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                  <TableRow>
                    <TableHead className="pl-4">Card ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="hidden md:table-cell">Country</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Scheme</TableHead>
                    <TableHead>Last 4</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden xl:table-cell">Currency</TableHead>
                    <TableHead className="hidden lg:table-cell">Provider</TableHead>
                    <TableHead className="hidden lg:table-cell">Frozen</TableHead>
                    <TableHead className="hidden xl:table-cell">Tokenized</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const statusBadge = CARD_STATUS_STYLES[c.status];
                    const schemeBadge = SCHEME_STYLES[c.scheme];
                    const typeBadge = TYPE_STYLES[c.type];
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => handleViewDetails(c)}>
                        <TableCell className="pl-4 font-mono text-xs">{c.cardId}</TableCell>
                        <TableCell className="text-sm font-medium">
                          {c.userName}
                          <span className="block text-[10px] text-muted-foreground">{c.userId}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          <span className="font-mono">{c.countryCode}</span>
                          <span className="block text-[10px] text-muted-foreground">{countryName(c.countryCode)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-[10px]", typeBadge.className)}>
                            {c.type === "virtual" ? <Nfc className="size-3 mr-0.5" /> : <Smartphone className="size-3 mr-0.5" />}
                            {typeBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="secondary" className={cn("text-[10px]", schemeBadge.className)}>
                            {schemeBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">•••• {c.last4}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn("text-[10px]", statusBadge.className)}>
                            {c.frozen && c.status !== "frozen" && c.status !== "terminated" ? (
                              <Lock className="size-3 mr-0.5" />
                            ) : null}
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-xs font-mono">{c.currency}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">{c.provider}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {c.frozen ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                              <Lock className="size-3" /> Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Unlock className="size-3" /> No
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {c.tokenized ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="size-3" /> Yes
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                          {timeAgo(c.createdAt)}
                        </TableCell>
                        <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                          <CardActions
                            card={c}
                            onView={() => handleViewDetails(c)}
                            onFreeze={() => handleFreeze(c)}
                            onUnfreeze={() => handleUnfreeze(c)}
                            onTerminate={() => setTerminateTarget(c)}
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
      </ViewContainer>

      {/* Details Sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <CardDetailsSheet card={selected} countryName={countryName} />
          )}
        </SheetContent>
      </Sheet>

      {/* Terminate confirm */}
      <AlertDialog open={!!terminateTarget} onOpenChange={(open) => !open && setTerminateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate card {terminateTarget?.cardId}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is <span className="font-semibold text-red-700 dark:text-red-400">irreversible</span>.
              The card will be permanently blocked at the provider (Paymentology) and cannot be re-activated.
              The cardholder must request a replacement.
              {terminateTarget && (
                <>
                  <br /><br />
                  Cardholder: <span className="font-medium">{terminateTarget.userName}</span>
                  <br />
                  Last 4: <span className="font-mono">{terminateTarget.last4}</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => terminateTarget && handleTerminate(terminateTarget)}
            >
              <Ban className="size-4 mr-1" /> Terminate card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SonnerToaster richColors closeButton position="top-right" />
    </>
  );
}

/* --------------------------- Card actions menu --------------------------- */

function CardActions({
  card,
  onView,
  onFreeze,
  onUnfreeze,
  onTerminate,
}: {
  card: CardType;
  onView: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  onTerminate: () => void;
}) {
  const isTerminal = card.status === "terminated" || card.status === "replaced" || card.status === "expired";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open card actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
          Card actions
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <Eye className="size-4 mr-2" /> View details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {!card.frozen && card.status === "active" && (
          <DropdownMenuItem onClick={onFreeze}>
            <Snowflake className="size-4 mr-2 text-sky-600" /> Freeze
          </DropdownMenuItem>
        )}
        {card.frozen && !isTerminal && (
          <DropdownMenuItem onClick={onUnfreeze}>
            <Play className="size-4 mr-2 text-emerald-600" /> Unfreeze
          </DropdownMenuItem>
        )}
        {!isTerminal && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onTerminate} className="text-red-600 dark:text-red-400 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-900/30">
              <Ban className="size-4 mr-2" /> Terminate…
            </DropdownMenuItem>
          </>
        )}
        {isTerminal && (
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground italic">
            Card is {CARD_STATUS_STYLES[card.status].label.toLowerCase()} — no actions available
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* --------------------------- Details sheet body --------------------------- */

function CardDetailsSheet({
  card,
  countryName,
}: {
  card: CardType;
  countryName: (code: string) => string;
}) {
  const statusBadge = CARD_STATUS_STYLES[card.status];
  const schemeBadge = SCHEME_STYLES[card.scheme];
  const typeBadge = TYPE_STYLES[card.type];

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <CreditCard className="size-5 text-emerald-600" />
          <span className="font-mono text-base">{card.cardId}</span>
        </SheetTitle>
        <SheetDescription>
          {card.userName} · {countryName(card.countryCode)} ({card.countryCode})
        </SheetDescription>
      </SheetHeader>

      <div className="px-4 pb-6 space-y-4">
        {/* Card visual */}
        <div className="rounded-xl border bg-gradient-to-br from-slate-900 to-slate-700 dark:from-slate-800 dark:to-slate-900 text-white p-4 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-slate-300">Faya {typeBadge.label}</span>
            <span className="text-sm font-semibold">{schemeBadge.label}</span>
          </div>
          <div className="mt-6 text-lg font-mono tracking-widest">
            •••• •••• •••• {card.last4}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-300">
            <span>
              <span className="block text-[9px] uppercase tracking-wider opacity-70">Cardholder</span>
              {card.userName}
            </span>
            <span>
              <span className="block text-[9px] uppercase tracking-wider opacity-70">Expires</span>
              {card.expiryMonth}/{card.expiryYear}
            </span>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className={cn("text-[10px]", statusBadge.className)}>
            {statusBadge.label}
          </Badge>
          <Badge variant="secondary" className={cn("text-[10px]", typeBadge.className)}>
            {typeBadge.label}
          </Badge>
          <Badge variant="secondary" className={cn("text-[10px]", schemeBadge.className)}>
            {schemeBadge.label}
          </Badge>
          {card.frozen && (
            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:bg-amber-900/30">
              <Lock className="size-3 mr-0.5" /> Frozen flag
            </Badge>
          )}
          {card.tokenized && (
            <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-900/30">
              <Nfc className="size-3 mr-0.5" /> Tokenized
            </Badge>
          )}
          {card.walletProvisioned && (
            <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-900/30">
              <Wallet className="size-3 mr-0.5" /> Wallet provisioned
            </Badge>
          )}
        </div>

        {/* Security reminder */}
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-2.5 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
          <ShieldAlert className="size-3.5 mt-0.5 shrink-0" />
          <span>
            Per security policy, only the last 4 digits of the PAN are visible. Full PAN, CVV, and PIN are never exposed in the Admin Portal.
          </span>
        </div>

        <Separator />

        {/* Cardholder */}
        <DetailSection title="Cardholder">
          <DetailRow label="User ID" value={<span className="font-mono text-xs">{card.userId}</span>} />
          <DetailRow label="Name" value={card.userName} />
          <DetailRow label="Country" value={`${card.countryCode} · ${countryName(card.countryCode)}`} />
        </DetailSection>

        <DetailSection title="Card metadata">
          <DetailRow label="Card ID" value={<span className="font-mono text-xs">{card.cardId}</span>} />
          <DetailRow label="Type" value={typeBadge.label} />
          <DetailRow label="Scheme" value={schemeBadge.label} />
          <DetailRow label="Last 4" value={<span className="font-mono">•••• {card.last4}</span>} />
          <DetailRow label="Expiry" value={`${card.expiryMonth}/${card.expiryYear}`} />
          <DetailRow label="Currency" value={<span className="font-mono">{card.currency}</span>} />
        </DetailSection>

        {/* Spend limits */}
        <DetailSection title="Spend limits">
          <DetailRow
            label="Daily limit"
            value={<span className="font-mono tabular-nums">{formatCurrency(card.spendLimitDaily, card.currency)}</span>}
          />
          <DetailRow
            label="Monthly limit"
            value={<span className="font-mono tabular-nums">{formatCurrency(card.spendLimitMonthly, card.currency)}</span>}
          />
          {card.spendLimitDaily === 0 && card.spendLimitMonthly === 0 && (
            <div className="text-[11px] text-amber-700 dark:text-amber-400 italic">
              Limits suspended — card cannot transact.
            </div>
          )}
        </DetailSection>

        {/* Provider info */}
        <DetailSection title="Provider">
          <DetailRow label="Provider" value={card.provider} />
          <DetailRow label="Provider card ID" value={<span className="font-mono text-xs">{card.providerCardId}</span>} />
          <DetailRow
            label="Tokenized"
            value={card.tokenized ? "Yes" : "No"}
          />
          <DetailRow
            label="Wallet provisioned"
            value={card.walletProvisioned ? "Yes" : "No"}
          />
        </DetailSection>

        {/* Lifecycle */}
        <DetailSection title="Lifecycle">
          <DetailRow label="Created" value={formatDateTime(card.createdAt)} />
          <DetailRow label="Last updated" value={formatDateTime(card.updatedAt)} />
        </DetailSection>
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
