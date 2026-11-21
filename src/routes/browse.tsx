import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  FilterX,
  Home,
  MapPin,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ListingCard, ListingCardSkeleton } from "@/components/listing-card";
import { ProviderCard } from "@/components/provider-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { isLocalDevPreview, useListingsQuery } from "@/lib/listings";
import { getOrCreateConversation, saveMessageIntent } from "@/lib/messaging";
import { type AccommodationProvider, useProvidersQuery } from "@/lib/providers";

// ── Validated Search Parameter Types ──────────────────────────────────────────
type BrowseSearch = {
  q?: string | undefined;
  school?: "MOUAU" | "ABSU" | undefined;
  kind?: "Full lodge" | "Bedspace" | "Takeover" | undefined;
  verified?: boolean | undefined;
  min?: number | undefined;
  max?: number | undefined;
};

export const Route = createFileRoute("/browse")({
  validateSearch: (search: Record<string, unknown>): BrowseSearch => {
    const school = search["school"];
    const kind = search["kind"];
    const minRaw = search["min"];
    const maxRaw = search["max"];
    const minNum = typeof minRaw === "number" ? minRaw : minRaw != null && !isNaN(Number(minRaw)) ? Number(minRaw) : undefined;
    const maxNum = typeof maxRaw === "number" ? maxRaw : maxRaw != null && !isNaN(Number(maxRaw)) ? Number(maxRaw) : undefined;
    return {
      q: typeof search["q"] === "string" && search["q"].trim() ? search["q"].trim() : undefined,
      school: school === "MOUAU" || school === "ABSU" ? school : undefined,
      kind: kind === "Full lodge" || kind === "Bedspace" || kind === "Takeover" ? kind : undefined,
      verified: search["verified"] === true || search["verified"] === "true" ? true : undefined,
      min: minNum !== undefined && minNum >= 0 ? minNum : undefined,
      max: maxNum !== undefined && maxNum >= 0 ? maxNum : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Browse Student Lodges & Accommodation Providers — LodgeMate" },
      {
        name: "description",
        content:
          "Filter verified lodges, bedspaces and tenancy takeovers near MOUAU and ABSU by school, room type, price, and discover verified landlords and independent agents.",
      },
      { property: "og:title", content: "Browse Student Lodges & Accommodation Providers — LodgeMate" },
      {
        property: "og:description",
        content: "Compare student rooms and discover verified landlords and independent agents near MOUAU and ABSU.",
      },
    ],
  }),
  component: Browse,
});

const schools = [
  { id: "All", label: "All Campuses", short: "All" },
  { id: "MOUAU", label: "MOUAU (Umudike)", short: "MOUAU" },
  { id: "ABSU", label: "ABSU (Uturu)", short: "ABSU" },
] as const;

const kinds = [
  { id: "All", label: "All Types" },
  { id: "Full lodge", label: "Full Lodge" },
  { id: "Bedspace", label: "Bedspace" },
  { id: "Takeover", label: "Takeover" },
] as const;

const providerTypes = [
  { id: "All", label: "All Providers" },
  { id: "landlord", label: "Landlords" },
  { id: "agent", label: "Independent Agents" },
  { id: "verified-agent", label: "Verified Agents" },
] as const;

const BUDGET_PRESETS = [
  { id: "under-50k", label: "Under ₦50,000", min: null, max: 50000 },
  { id: "50k-100k", label: "₦50,000 – ₦100,000", min: 50000, max: 100000 },
  { id: "100k-200k", label: "₦100,000 – ₦200,000", min: 100000, max: 200000 },
  { id: "200k-300k", label: "₦200,000 – ₦300,000", min: 200000, max: 300000 },
  { id: "above-300k", label: "Above ₦300,000", min: 300000, max: null },
] as const;

function formatShortNaira(amount: number): string {
  if (amount >= 1_000_000) {
    const m = amount / 1_000_000;
    return `₦${m % 1 === 0 ? m : m.toFixed(1)}m`;
  }
  if (amount >= 1_000) {
    const k = amount / 1_000;
    return `₦${k % 1 === 0 ? k : k.toFixed(0)}k`;
  }
  return `₦${amount}`;
}

function getBudgetShortLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return `${formatShortNaira(min)}–${formatShortNaira(max)}`;
  }
  if (min !== null) {
    return `${formatShortNaira(min)}+`;
  }
  if (max !== null) {
    return `< ${formatShortNaira(max)}`;
  }
  return "Any Price";
}

function getBudgetFullLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return `₦${min.toLocaleString("en-NG")} – ₦${max.toLocaleString("en-NG")}`;
  }
  if (min !== null) {
    return `₦${min.toLocaleString("en-NG")} and above`;
  }
  if (max !== null) {
    return `Under ₦${max.toLocaleString("en-NG")}`;
  }
  return "Any price";
}

function Browse() {
  // ── URL search params (source of truth for shareable / bookmarkable state) ──
  const urlSearch = Route.useSearch();
  const navigate = useNavigate();

  // ── Listings Filter State (initialised from URL params) ────────────────────
  const [searchScope, setSearchScope] = useState<"listings" | "providers">("listings");
  const [query, setQuery] = useState(urlSearch.q ?? "");
  const [school, setSchool] = useState<"All" | "MOUAU" | "ABSU">(urlSearch.school ?? "All");
  const [kind, setKind] = useState<"All" | "Full lodge" | "Bedspace" | "Takeover">(urlSearch.kind ?? "All");
  const [verifiedOnly, setVerifiedOnly] = useState(urlSearch.verified ?? false);
  const [selectedHostFilter, setSelectedHostFilter] = useState<{ id: string; name: string } | null>(null);

  // Budget Filter State
  const [appliedMinPrice, setAppliedMinPrice] = useState<number | null>(urlSearch.min ?? null);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState<number | null>(urlSearch.max ?? null);

  // Draft inputs for Budget Popover
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [minInput, setMinInput] = useState(urlSearch.min !== undefined ? String(urlSearch.min) : "");
  const [maxInput, setMaxInput] = useState(urlSearch.max !== undefined ? String(urlSearch.max) : "");
  const [budgetError, setBudgetError] = useState<string | null>(null);

  // ── Sync component state when URL search params change (back/forward/links) ─
  useEffect(() => {
    setQuery(urlSearch.q ?? "");
    setSchool(urlSearch.school ?? "All");
    setKind(urlSearch.kind ?? "All");
    setVerifiedOnly(urlSearch.verified ?? false);
    const newMin = urlSearch.min ?? null;
    const newMax = urlSearch.max ?? null;
    setAppliedMinPrice(newMin);
    setAppliedMaxPrice(newMax);
    setMinInput(newMin !== null ? String(newMin) : "");
    setMaxInput(newMax !== null ? String(newMax) : "");
    setBudgetError(null);
    // Clear host filter when URL changes externally (e.g. back/forward)
    setSelectedHostFilter(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch.q, urlSearch.school, urlSearch.kind, urlSearch.verified, urlSearch.min, urlSearch.max]);

  // ── URL-writing helper: update URL search params from filter state ──────────
  const updateUrl = (patch: {
    q?: string | undefined;
    school?: "MOUAU" | "ABSU" | undefined;
    kind?: "Full lodge" | "Bedspace" | "Takeover" | undefined;
    verified?: boolean | undefined;
    min?: number | undefined;
    max?: number | undefined;
  }) => {
    navigate({
      to: "/browse",
      search: (prev) => {
        const next = { ...prev, ...patch };
        // Strip undefined / falsy default values to keep URL clean
        if (!next.q) delete next.q;
        if (!next.school) delete next.school;
        if (!next.kind) delete next.kind;
        if (!next.verified) delete next.verified;
        if (next.min === undefined || next.min === null) delete next.min;
        if (next.max === undefined || next.max === null) delete next.max;
        return next;
      },
      replace: true,
    });
  };

  // ── Wrapped filter setters: update state AND URL atomically ───────────────
  const handleSetQuery = (q: string) => {
    setQuery(q);
    updateUrl({ q: q.trim() || undefined });
  };
  const handleSetSchool = (s: "All" | "MOUAU" | "ABSU") => {
    setSchool(s);
    updateUrl({ school: s === "All" ? undefined : s });
  };
  const handleSetKind = (k: "All" | "Full lodge" | "Bedspace" | "Takeover") => {
    setKind(k);
    updateUrl({ kind: k === "All" ? undefined : k });
  };
  const handleSetVerifiedOnly = (v: boolean) => {
    setVerifiedOnly(v);
    updateUrl({ verified: v || undefined });
  };

  // ── Providers Filter State ─────────────────────────────────────────────────
  const [providerQuery, setProviderQuery] = useState("");
  const [providerTypeFilter, setProviderTypeFilter] = useState<"All" | "landlord" | "agent">("All");
  const [providerSchool, setProviderSchool] = useState<"All" | "MOUAU" | "ABSU">("All");
  const [providerVerifiedOnly, setProviderVerifiedOnly] = useState(false);

  // ── Data Queries ───────────────────────────────────────────────────────────
  const { data: listingsData = [], isLoading: isLoadingListings, isError: isErrorListings, refetch: refetchListings } = useListingsQuery();
  const { data: providersData = [], isLoading: isLoadingProviders, isError: isErrorProviders, refetch: refetchProviders } = useProvidersQuery();

  // ── Active Filters Checks ──────────────────────────────────────────────────
  const hasBudgetFilter = appliedMinPrice !== null || appliedMaxPrice !== null;
  const hasActiveListingFilters = Boolean(
    query.trim() || school !== "All" || kind !== "All" || verifiedOnly || hasBudgetFilter || selectedHostFilter,
  );

  const hasActiveProviderFilters = Boolean(
    providerQuery.trim() || providerTypeFilter !== "All" || providerSchool !== "All" || providerVerifiedOnly,
  );

  // ── Clear / Reset Functions ────────────────────────────────────────────────
  const clearBudget = () => {
    setMinInput("");
    setMaxInput("");
    setAppliedMinPrice(null);
    setAppliedMaxPrice(null);
    setBudgetError(null);
    setIsBudgetOpen(false);
    updateUrl({ min: undefined, max: undefined });
  };

  const clearAllListingFilters = () => {
    setQuery("");
    setSchool("All");
    setKind("All");
    setVerifiedOnly(false);
    setSelectedHostFilter(null);
    setMinInput("");
    setMaxInput("");
    setAppliedMinPrice(null);
    setAppliedMaxPrice(null);
    setBudgetError(null);
    setIsBudgetOpen(false);
    navigate({ to: "/browse", search: {}, replace: true });
  };

  const clearAllProviderFilters = () => {
    setProviderQuery("");
    setProviderTypeFilter("All");
    setProviderSchool("All");
    setProviderVerifiedOnly(false);
  };

  // ── Budget Popover Handlers ────────────────────────────────────────────────
  const handlePresetClick = (preset: (typeof BUDGET_PRESETS)[number]) => {
    const curMin = minInput.trim() ? Number(minInput) : null;
    const curMax = maxInput.trim() ? Number(maxInput) : null;
    if (curMin === preset.min && curMax === preset.max) {
      setMinInput("");
      setMaxInput("");
    } else {
      setMinInput(preset.min !== null ? String(preset.min) : "");
      setMaxInput(preset.max !== null ? String(preset.max) : "");
    }
    setBudgetError(null);
  };

  const handleApplyBudget = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanMin = minInput.trim() ? Number(minInput.replace(/[^0-9]/g, "")) : null;
    const cleanMax = maxInput.trim() ? Number(maxInput.replace(/[^0-9]/g, "")) : null;

    if (cleanMin !== null && (isNaN(cleanMin) || cleanMin < 0)) {
      setBudgetError("Minimum budget cannot be negative.");
      return;
    }
    if (cleanMax !== null && (isNaN(cleanMax) || cleanMax < 0)) {
      setBudgetError("Maximum budget cannot be negative.");
      return;
    }
    if (cleanMin !== null && cleanMax !== null && cleanMin > cleanMax) {
      setBudgetError("Minimum budget cannot exceed maximum budget.");
      return;
    }

    setBudgetError(null);
    setAppliedMinPrice(cleanMin);
    setAppliedMaxPrice(cleanMax);
    setIsBudgetOpen(false);
    updateUrl({
      min: cleanMin !== null ? cleanMin : undefined,
      max: cleanMax !== null ? cleanMax : undefined,
    });
  };

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      setMinInput(appliedMinPrice !== null ? String(appliedMinPrice) : "");
      setMaxInput(appliedMaxPrice !== null ? String(appliedMaxPrice) : "");
      setBudgetError(null);
    }
    setIsBudgetOpen(open);
  };

  const activePreset = useMemo(() => {
    const numMin = minInput.trim() ? Number(minInput) : null;
    const numMax = maxInput.trim() ? Number(maxInput) : null;
    return BUDGET_PRESETS.find((p) => p.min === numMin && p.max === numMax);
  }, [minInput, maxInput]);

  // ── Listings Filter Logic ──────────────────────────────────────────────────
  const results = useMemo(
    () =>
      listingsData.filter((l) => {
        const qTokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const matchesQuery =
          qTokens.length === 0 ||
          qTokens.every(
            (token) =>
              l.title.toLowerCase().includes(token) ||
              l.area.toLowerCase().includes(token) ||
              l.school.toLowerCase().includes(token) ||
              l.kind.toLowerCase().includes(token) ||
              (l.description && l.description.toLowerCase().includes(token)) ||
              (l.host && l.host.name && l.host.name.toLowerCase().includes(token)) ||
              l.amenities.some((a) => a.toLowerCase().includes(token)),
          );

        const matchesSchool = school === "All" || l.school === school;
        const matchesKind = kind === "All" || l.kind === kind;
        const matchesVerified = !verifiedOnly || l.verified;

        const price = typeof l.rawPrice === "number" ? l.rawPrice : Number(l.rawPrice) || 0;
        const matchesMin = appliedMinPrice === null || price >= appliedMinPrice;
        const matchesMax = appliedMaxPrice === null || price <= appliedMaxPrice;

        const matchesHost =
          !selectedHostFilter ||
          l.ownerId === selectedHostFilter.id ||
          (l.host && l.host.name && l.host.name.toLowerCase().includes(selectedHostFilter.name.toLowerCase()));

        return (
          matchesQuery &&
          matchesSchool &&
          matchesKind &&
          matchesVerified &&
          matchesMin &&
          matchesMax &&
          matchesHost
        );
      }),
    [listingsData, query, school, kind, verifiedOnly, appliedMinPrice, appliedMaxPrice, selectedHostFilter],
  );

  // ── Providers Filter Logic ─────────────────────────────────────────────────
  const providerResults = useMemo(() => {
    return providersData.filter((p) => {
      const pTokens = providerQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

      const providerListings = listingsData.filter((l) => l.ownerId === p.id);
      const providerListingAreas = providerListings.map((l) => l.area.toLowerCase());

      const matchesQuery =
        pTokens.length === 0 ||
        pTokens.every(
          (token) =>
            p.fullName.toLowerCase().includes(token) ||
            (p.businessName && p.businessName.toLowerCase().includes(token)) ||
            (p.operatingArea && p.operatingArea.toLowerCase().includes(token)) ||
            providerListingAreas.some((area) => area.includes(token)) ||
            (p.school && p.school.toLowerCase().includes(token)) ||
            (p.bio && p.bio.toLowerCase().includes(token)),
        );

      const matchesType =
        providerTypeFilter === "All" || p.providerType === providerTypeFilter;

      const matchesSchool =
        providerSchool === "All" ||
        p.school === providerSchool ||
        (p.operatingArea && p.operatingArea.toLowerCase().includes(providerSchool.toLowerCase())) ||
        providerListingAreas.some((area) =>
          providerSchool === "MOUAU"
            ? area.includes("ishiagu") || area.includes("umudike") || area.includes("western")
            : area.includes("uturu") || area.includes("hilltop"),
        );

      const matchesVerified = !providerVerifiedOnly || p.verified;

      return matchesQuery && matchesType && matchesSchool && matchesVerified;
    });
  }, [providersData, listingsData, providerQuery, providerTypeFilter, providerSchool, providerVerifiedOnly]);

  // Navigate from provider card to their listings
  const handleViewProviderSpaces = (provider: AccommodationProvider) => {
    setSearchScope("listings");
    setSelectedHostFilter({ id: provider.id, name: provider.fullName });
    setQuery("");
    window.scrollTo({ top: 380, behavior: "smooth" });
  };

  const { user } = useAuth();

  const handleMessageProvider = async (provider: AccommodationProvider) => {
    if (!user) {
      saveMessageIntent({
        intent: "message",
        recipientId: provider.id,
        recipientName: provider.fullName,
        recipientRole: provider.providerType === "agent" ? "agent" : "landlord",
        returnTo: "/browse",
      });
      toast.info("Please sign in to message this provider", {
        description: "Create a free account or sign in to start a direct in-app conversation.",
      });
      navigate({
        to: "/auth",
        search: {
          intent: "message",
          recipientName: encodeURIComponent(provider.fullName),
          returnTo: "/browse",
        },
      });
      return;
    }

    if (user.id === provider.id) {
      toast.info("This is your own profile.", {
        description: "You cannot initiate a conversation with yourself.",
      });
      return;
    }

    try {
      const convId = await getOrCreateConversation(provider.id, null);
      navigate({
        to: "/messages",
        search: { conversation_id: convId },
      });
    } catch (err: any) {
      toast.error(err?.message || "Unable to start conversation right now.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      {isLocalDevPreview() && (
        <div className="border-b border-warning/40 bg-warning/15 px-4 py-2.5 text-center text-xs text-warning-foreground">
          <span className="font-semibold">Local Development Preview Mode:</span> Displaying verified student sample accommodations and accommodation providers across MOUAU and ABSU. Connect Supabase in <code>.env</code> to stream live database records.
        </div>
      )}
      <main className="flex-1">
        {/* Top Hero / Search Banner */}
        <section className="relative border-b border-border/80 bg-warm/80">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>MOUAU &amp; ABSU Student Marketplace</span>
              </div>

              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Find your next student space
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Discover verified lodges, shared bedspaces, tenancy takeovers, and connect with trusted landlords and campus agents.
              </p>
            </div>

            {/* Filter & Search Card */}
            <div className="mt-8 rounded-2xl border border-border/80 bg-card p-3 shadow-card sm:p-4">
              {/* Search Scope Switcher: Listings vs Landlords & Agents */}
              <div className="flex items-center gap-1.5 sm:gap-2 border-b border-border/60 pb-3 mb-3">
                <button
                  type="button"
                  onClick={() => setSearchScope("listings")}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    searchScope === "listings"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Home className="h-3.5 w-3.5" />
                  <span>Accommodation</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      searchScope === "listings"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {listingsData.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchScope("providers")}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    searchScope === "providers"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Landlords &amp; Agents</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      searchScope === "providers"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {providersData.length}
                  </span>
                </button>
              </div>

              {/* Scope A: Listings Search & Filters */}
              {searchScope === "listings" ? (
                <>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    {/* Search input with icon and clear button */}
                    <div className="relative flex flex-1 items-center rounded-xl border border-border/60 bg-muted/50 px-3 transition-colors focus-within:border-primary/50 focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/20">
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => handleSetQuery(e.target.value)}
                        placeholder="Search by area, lodge name, campus or amenity..."
                        className="h-10 border-0 bg-transparent pr-8 shadow-none focus-visible:ring-0 text-sm"
                      />
                      {query && (
                        <button
                          onClick={() => handleSetQuery("")}
                          className="absolute right-2.5 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Clear search"
                          aria-label="Clear search input"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Verified Only Toggle Button */}
                    <Button
                      variant={verifiedOnly ? "default" : "outline"}
                      onClick={() => handleSetVerifiedOnly(!verifiedOnly)}
                      className={`h-10 shrink-0 gap-2 rounded-xl text-xs font-semibold transition-all ${
                        verifiedOnly
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "border-border/70 hover:bg-muted"
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>Verified only</span>
                      {verifiedOnly && <Check className="h-3.5 w-3.5 ml-0.5" />}
                    </Button>
                  </div>

                  {/* Filter Pills row: Campus, Accommodation Type, Price */}
                  <div className="mt-3 flex flex-col gap-2.5 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      {/* 1. Campus: All, MOUAU, ABSU */}
                      <span className="mr-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-leaf" />
                        Campus:
                      </span>
                      {schools.map((s) => {
                        const active = school === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => handleSetSchool(s.id)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                              active
                                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                : "border border-border/50 bg-secondary/60 text-secondary-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {s.short}
                          </button>
                        );
                      })}

                      <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />

                      {/* 2. Accommodation Type: All Types, Full Lodge, Bedspace, Takeover */}
                      <span className="mr-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-clay" />
                        Accommodation Type:
                      </span>
                      {kinds.map((k) => {
                        const active = kind === k.id;
                        return (
                          <button
                            key={k.id}
                            onClick={() => handleSetKind(k.id)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                              active
                                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                : "border border-border/50 bg-secondary/60 text-secondary-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {k.label}
                          </button>
                        );
                      })}

                      <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />

                      {/* 3. Price: Any Price / selected price range */}
                      <span className="mr-0.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Wallet className="h-3 w-3 text-leaf" />
                        Price:
                      </span>
                      <Popover open={isBudgetOpen} onOpenChange={handlePopoverOpenChange}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Filter by price range"
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                              hasBudgetFilter
                                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                : "border border-border/50 bg-secondary/60 text-secondary-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            <span>
                              {hasBudgetFilter
                                ? getBudgetShortLabel(appliedMinPrice, appliedMaxPrice)
                                : "Any Price"}
                            </span>
                            <ChevronDown className="h-3 w-3 opacity-70" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[calc(100vw-2rem)] sm:w-96 p-4 shadow-lift rounded-2xl border-border/80"
                          align="start"
                        >
                          <form onSubmit={handleApplyBudget} className="space-y-4">
                            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                              <div>
                                <h4 className="text-sm font-semibold text-foreground">Filter by Price</h4>
                                <p className="text-[11px] text-muted-foreground">
                                  Select a suggested range or enter custom amounts
                                </p>
                              </div>
                              {hasBudgetFilter && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                  Active
                                </span>
                              )}
                            </div>

                            {/* Presets */}
                            <div>
                              <Label className="text-xs font-medium text-muted-foreground">
                                Preset ranges
                              </Label>
                              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                {BUDGET_PRESETS.map((p) => {
                                  const isSelected = activePreset?.id === p.id;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => handlePresetClick(p)}
                                      className={`rounded-lg px-2.5 py-1.5 text-xs transition-all text-left ${
                                        isSelected
                                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                                          : "border border-border/60 bg-muted/40 text-foreground hover:bg-muted font-medium"
                                      }`}
                                    >
                                      {p.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Custom range */}
                            <div>
                              <Label className="text-xs font-medium text-muted-foreground">
                                Custom amount (₦)
                              </Label>
                              <div className="mt-2 grid grid-cols-2 gap-2.5">
                                <div>
                                  <label
                                    htmlFor="budget-min-input"
                                    className="text-[11px] font-medium text-muted-foreground block mb-1"
                                  >
                                    Minimum
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                                      ₦
                                    </span>
                                    <Input
                                      id="budget-min-input"
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="Min"
                                      value={minInput}
                                      onChange={(e) => {
                                        const clean = e.target.value.replace(/[^0-9]/g, "");
                                        setMinInput(clean);
                                        if (budgetError) setBudgetError(null);
                                      }}
                                      className="h-9 pl-6 text-xs"
                                    />
                                  </div>
                                  {minInput && (
                                    <p className="mt-1 text-[10px] text-muted-foreground truncate">
                                      ₦{Number(minInput).toLocaleString("en-NG")}
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <label
                                    htmlFor="budget-max-input"
                                    className="text-[11px] font-medium text-muted-foreground block mb-1"
                                  >
                                    Maximum
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                                      ₦
                                    </span>
                                    <Input
                                      id="budget-max-input"
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="Max"
                                      value={maxInput}
                                      onChange={(e) => {
                                        const clean = e.target.value.replace(/[^0-9]/g, "");
                                        setMaxInput(clean);
                                        if (budgetError) setBudgetError(null);
                                      }}
                                      className="h-9 pl-6 text-xs"
                                    />
                                  </div>
                                  {maxInput && (
                                    <p className="mt-1 text-[10px] text-muted-foreground truncate">
                                      ₦{Number(maxInput).toLocaleString("en-NG")}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Error */}
                            {budgetError && (
                              <div className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>{budgetError}</span>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-between border-t border-border/60 pt-3">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={clearBudget}
                                disabled={!minInput && !maxInput && !hasBudgetFilter}
                                className="h-8 text-xs text-muted-foreground hover:text-destructive"
                              >
                                Clear budget
                              </Button>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setIsBudgetOpen(false)}
                                  className="h-8 text-xs"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  size="sm"
                                  className="h-8 text-xs font-semibold"
                                >
                                  Apply filter
                                </Button>
                              </div>
                            </div>
                          </form>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Reset button if any filter active */}
                    {hasActiveListingFilters && (
                      <button
                        onClick={clearAllListingFilters}
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive self-start sm:self-auto"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reset filters</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                /* Scope B: Landlords & Agents Search & Filters */
                <>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    {/* Provider Search input */}
                    <div className="relative flex flex-1 items-center rounded-xl border border-border/60 bg-muted/50 px-3 transition-colors focus-within:border-primary/50 focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/20">
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <Input
                        value={providerQuery}
                        onChange={(e) => setProviderQuery(e.target.value)}
                        placeholder="Search by landlord name, independent agent, business/agency, or operating area..."
                        className="h-10 border-0 bg-transparent pr-8 shadow-none focus-visible:ring-0 text-sm"
                      />
                      {providerQuery && (
                        <button
                          onClick={() => setProviderQuery("")}
                          className="absolute right-2.5 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Clear search"
                          aria-label="Clear search input"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Verified Only Toggle Button for Providers */}
                    <Button
                      variant={providerVerifiedOnly ? "default" : "outline"}
                      onClick={() => setProviderVerifiedOnly((v) => !v)}
                      className={`h-10 shrink-0 gap-2 rounded-xl text-xs font-semibold transition-all ${
                        providerVerifiedOnly
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "border-border/70 hover:bg-muted"
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>{providerTypeFilter === "agent" ? "Verified agents only" : "Verified only"}</span>
                      {providerVerifiedOnly && <Check className="h-3.5 w-3.5 ml-0.5" />}
                    </Button>
                  </div>

                  {/* Provider Filter Pills: Provider Type & Campus */}
                  <div className="mt-3 flex flex-col gap-2.5 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      {/* Provider Type */}
                      <span className="mr-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3 text-primary" />
                        Provider:
                      </span>
                      {providerTypes.map((pt) => {
                        const active =
                          pt.id === "verified-agent"
                            ? providerTypeFilter === "agent" && providerVerifiedOnly
                            : pt.id === "agent"
                            ? providerTypeFilter === "agent" && !providerVerifiedOnly
                            : pt.id === "landlord"
                            ? providerTypeFilter === "landlord"
                            : providerTypeFilter === "All" && !providerVerifiedOnly;

                        const handleClick = () => {
                          if (pt.id === "verified-agent") {
                            setProviderTypeFilter("agent");
                            setProviderVerifiedOnly(true);
                          } else if (pt.id === "agent") {
                            setProviderTypeFilter("agent");
                            setProviderVerifiedOnly(false);
                          } else if (pt.id === "landlord") {
                            setProviderTypeFilter("landlord");
                            setProviderVerifiedOnly(false);
                          } else {
                            setProviderTypeFilter("All");
                            setProviderVerifiedOnly(false);
                          }
                        };

                        return (
                          <button
                            key={pt.id}
                            onClick={handleClick}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                              active
                                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                : "border border-border/50 bg-secondary/60 text-secondary-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {pt.label}
                          </button>
                        );
                      })}

                      <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />

                      {/* Campus */}
                      <span className="mr-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-leaf" />
                        Campus:
                      </span>
                      {schools.map((s) => {
                        const active = providerSchool === s.id;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setProviderSchool(s.id)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                              active
                                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                : "border border-border/50 bg-secondary/60 text-secondary-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                          >
                            {s.short}
                          </button>
                        );
                      })}
                    </div>

                    {/* Reset button if any provider filter active */}
                    {hasActiveProviderFilters && (
                      <button
                        onClick={clearAllProviderFilters}
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive self-start sm:self-auto"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reset filters</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Results section */}
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {/* Beta Lodges Contextual Callout */}
          <div className="mb-8 rounded-2xl border border-warning/40 bg-gradient-to-r from-warning/10 via-background to-primary/5 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-foreground">
                      Looking for direct landlord numbers &amp; video walkthroughs?
                    </p>
                    <span className="rounded-full border border-warning/50 bg-warning/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-warning-foreground">
                      Beta
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Beta Lodges give students verified landlord phone numbers, 360° video tours, and physical inspection notes.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0 bg-warning font-semibold text-warning-foreground hover:bg-warning/90 gap-1.5 text-xs h-9 px-4"
                asChild
              >
                <Link to="/beta-lodges">
                  Explore Beta Lodges
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Scope A: Listings Results */}
          {searchScope === "listings" ? (
            <>
              {/* Status bar: Result counts & active tags */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {results.length} {results.length === 1 ? "Space Available" : "Spaces Available"}
                  </h2>
                  {hasActiveListingFilters && (
                    <span className="text-xs text-muted-foreground">
                      (filtered from {listingsData.length} total)
                    </span>
                  )}
                </div>

                {/* Active filter badges */}
                {hasActiveListingFilters && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {query.trim() && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                        Keyword: &ldquo;{query.trim()}&rdquo;
                        <button onClick={() => handleSetQuery("")} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {school !== "All" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                        Campus: {school}
                        <button onClick={() => handleSetSchool("All")} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {kind !== "All" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                        Type: {kind}
                        <button onClick={() => handleSetKind("All")} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {verifiedOnly && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                        Verified only
                        <button onClick={() => handleSetVerifiedOnly(false)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {hasBudgetFilter && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                        Price: {getBudgetFullLabel(appliedMinPrice, appliedMaxPrice)}
                        <button
                          onClick={clearBudget}
                          className="hover:text-destructive"
                          title="Remove price filter"
                          aria-label="Remove price filter"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {selectedHostFilter && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs text-primary font-medium">
                        Host: {selectedHostFilter.name}
                        <button
                          onClick={() => setSelectedHostFilter(null)}
                          className="hover:text-destructive"
                          title="Remove host filter"
                          aria-label="Remove host filter"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Listings Grid, Loading, Error, or Empty State */}
              {isLoadingListings ? (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <ListingCardSkeleton key={i} />
                  ))}
                </div>
              ) : isErrorListings ? (
                <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center sm:p-12">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    Unable to load listings right now
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground sm:text-sm">
                    There was a problem communicating with the accommodation database. Please try again.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => refetchListings()}
                      className="gap-2 rounded-xl text-xs font-semibold"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry
                    </Button>
                  </div>
                </div>
              ) : results.length === 0 ? (
                listingsData.length === 0 ? (
                  <div className="mt-8 rounded-2xl border border-dashed border-border/90 bg-card p-10 text-center sm:p-14">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <Home className="h-7 w-7" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-foreground">
                      No verified spaces listed yet
                    </h3>
                    <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                      There are currently no approved student spaces published near MOUAU or ABSU.
                      Landlords and agents submit new spaces for campus verification daily.
                    </p>
                    <div className="mt-6 flex justify-center gap-3">
                      <Button variant="outline" onClick={() => refetchListings()} className="gap-2 rounded-xl text-xs">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                      </Button>
                      <Button asChild className="rounded-xl text-xs">
                        <Link to="/list-a-space">List a space</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 rounded-2xl border border-dashed border-border/90 bg-card p-10 text-center sm:p-14">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <FilterX className="h-7 w-7" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-foreground">
                      No accommodation matching your filters
                    </h3>
                    <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                      {hasBudgetFilter
                        ? `We couldn't find any student spaces within your price range (${getBudgetFullLabel(appliedMinPrice, appliedMaxPrice)}) matching your criteria. Try adjusting or clearing your price range.`
                        : "We couldn't find any spaces that match your current search terms or campus filters. Try broadening your criteria."}
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                      {hasBudgetFilter && (
                        <Button variant="outline" onClick={clearBudget} className="gap-2 rounded-xl text-xs">
                          <RotateCcw className="h-3.5 w-3.5" />
                          Clear price filter
                        </Button>
                      )}
                      <Button variant="default" onClick={clearAllListingFilters} className="gap-2 rounded-xl text-xs">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Clear all filters
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((l) => (
                    <ListingCard key={l.id} listing={l} />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Scope B: Landlords & Agents Results */
            <>
              {/* Status bar: Provider counts & active tags */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    {providerResults.length} {providerResults.length === 1 ? "Provider Available" : "Providers Available"}
                  </h2>
                  {hasActiveProviderFilters && (
                    <span className="text-xs text-muted-foreground">
                      (filtered from {providersData.length} total)
                    </span>
                  )}
                </div>

                {/* Active filter badges for Providers */}
                {hasActiveProviderFilters && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {providerQuery.trim() && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                        Provider: &ldquo;{providerQuery.trim()}&rdquo;
                        <button onClick={() => setProviderQuery("")} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {providerTypeFilter !== "All" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                        Type: {providerTypeFilter === "agent" ? "Independent Agents" : "Landlords"}
                        <button onClick={() => setProviderTypeFilter("All")} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {providerSchool !== "All" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                        Campus: {providerSchool}
                        <button onClick={() => setProviderSchool("All")} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {providerVerifiedOnly && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs text-foreground">
                        Verified only
                        <button onClick={() => setProviderVerifiedOnly(false)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Provider Grid, Loading, Error, or Empty State */}
              {isLoadingProviders ? (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-48 animate-pulse rounded-2xl border border-border/80 bg-muted/40 p-5" />
                  ))}
                </div>
              ) : isErrorProviders ? (
                <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center sm:p-12">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    Unable to load providers right now
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground sm:text-sm">
                    There was a problem communicating with the user database. Please try again.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => refetchProviders()}
                      className="gap-2 rounded-xl text-xs font-semibold"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry
                    </Button>
                  </div>
                </div>
              ) : providerResults.length === 0 ? (
                providersData.length === 0 ? (
                  <div className="mt-8 rounded-2xl border border-dashed border-border/90 bg-card p-10 text-center sm:p-14">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <Users className="h-7 w-7" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-foreground">
                      No accommodation providers registered yet
                    </h3>
                    <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                      Registered landlords and independent agents will appear here once verified on LodgeMate.
                    </p>
                  </div>
                ) : (
                  <div className="mt-8 rounded-2xl border border-dashed border-border/90 bg-card p-10 text-center sm:p-14">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <FilterX className="h-7 w-7" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-foreground">
                      No providers matching your filters
                    </h3>
                    <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                      We couldn&apos;t find any landlords or independent agents matching &ldquo;{providerQuery || "your current criteria"}&rdquo;. Try clearing or broadening your filters.
                    </p>
                    <div className="mt-6 flex justify-center">
                      <Button variant="outline" onClick={clearAllProviderFilters} className="gap-2 rounded-xl text-xs">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Clear provider filters
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {providerResults.map((p) => {
                    const providerListings = listingsData.filter((l) => l.ownerId === p.id);
                    const activeCount = providerListings.length;
                    const operatingAreas = Array.from(
                      new Set(providerListings.map((l) => l.area).filter(Boolean)),
                    );
                    return (
                      <ProviderCard
                        key={p.id}
                        provider={p}
                        activeListingsCount={activeCount}
                        operatingAreas={operatingAreas}
                        onViewListings={() => handleViewProviderSpaces(p)}
                        onMessage={() => handleMessageProvider(p)}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
