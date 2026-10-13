"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { useApi } from "@/lib/useApi";
import { pathForView } from "@/lib/dashboardViews";
import type { Provider } from "@/lib/api/types";
import {
  groupAppsByCategory,
  logoForAppName,
} from "@/helpers/apps";
import { formatInr } from "@/helpers/currency";
import { formatMonthTitle } from "@/helpers/finance";
import { BrandMark } from "@/components/BrandMark";
import { AppCardSkeleton } from "@/components/AppCardSkeleton";
import { LedgerlineFadeContent } from "@/components/animations/LedgerlineFadeContent";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { LoadingState } from "@/components/ui/LoadingState";
import type { CategorySummary } from "@/types";

function categoryChoices(categories: CategorySummary[], current: string | null) {
  const parents = categories.filter((category) => !category.meta?.parent);
  if (!current || parents.some((category) => category.slug === current)) return parents;
  const selected = categories.find((category) => category.slug === current);
  return selected ? [selected, ...parents] : parents;
}

function AppCard({
  name,
  logoUrl,
  total,
  count,
  categorySlug,
  categories,
  upiHandles,
  onCategory,
  onAddUpi,
}: {
  name: string;
  logoUrl: string | null;
  total: number;
  count: number;
  categorySlug: string | null;
  categories: CategorySummary[];
  upiHandles: string[];
  onCategory: (slug: string) => Promise<void>;
  onAddUpi: (handle: string) => Promise<void>;
}) {
  return (
    <article className="app-card">
      <header className="app-card-head">
        <BrandMark name={name} logoUrl={logoUrl} size={40} />
        <div className="app-card-id">
          <strong>{name}</strong>
          <p className="meta">
            {count > 0
              ? `${formatInr(total)} · ${count} txn${count === 1 ? "" : "s"}`
              : "No tagged spend yet"}
          </p>
        </div>
      </header>
      <label className="field field-compact">
        <span>Category</span>
        <select
          aria-label={`Category for ${name}`}
          value={categorySlug ?? ""}
          onChange={(event) => {
            void onCategory(event.target.value);
          }}
        >
          {categoryChoices(categories, categorySlug).map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <form
        className="app-upi"
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem("upi");
          if (!(input instanceof HTMLInputElement)) return;
          const handle = input.value.trim();
          if (!handle) return;
          void onAddUpi(handle).then(() => {
            input.value = "";
          });
        }}
      >
        <span className="app-upi-label">UPI ids</span>
        {upiHandles.length > 0 ? (
          <ul className="app-upi-list" tabIndex={0} aria-label={`UPI ids for ${name}`}>
            {upiHandles.map((handle) => (
              <li key={handle} title={handle}>
                {handle}
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">No vendor UPI id yet</p>
        )}
        <div className="app-upi-add">
          <input name="upi" aria-label={`Add a UPI id for ${name}`} placeholder="name@bank" autoComplete="off" />
          <button type="submit">Add</button>
        </div>
      </form>
    </article>
  );
}

export function AppsPage() {
  const { data, month, fetching, refresh } = useDashboard();
  const api = useApi();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [name, setName] = useState("");
  const [categorySlug, setCategorySlug] = useState("food");
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showUnused, setShowUnused] = useState(false);

  const loadProviders = useCallback(async () => {
    if (!api) return;
    const res = await api.listProviders();
    setProviders(res.providers);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    api
      .listProviders()
      .then((res) => {
        if (!cancelled) setProviders(res.providers);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load apps");
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const groups = useMemo(
    () =>
      groupAppsByCategory(
        providers,
        data?.transactions ?? [],
        data?.categories ?? [],
      ),
    [providers, data],
  );

  // Most catalog apps have no spending for a given person; show those only on request.
  const unusedCount = groups.reduce(
    (sum, group) => sum + group.apps.filter((app) => app.count === 0).length,
    0,
  );
  const visibleGroups = showUnused
    ? groups
    : groups
        .map((group) => ({ ...group, apps: group.apps.filter((app) => app.count > 0) }))
        .filter((group) => group.apps.length > 0);

  if (fetching && !data) {
    return <LoadingState text="Loading apps" variant="skeleton" />;
  }
  if (!data) return null;

  return (
    <div className="view-stack">
      <LedgerlineFadeContent>
        <header>
          <p className="stat-kicker mb-2">Apps</p>
          <h2 className="month-label">{formatMonthTitle(month)}</h2>
          <p className="meta mt-1.5">
            Move an app between categories here. To capture per-vendor totals,
            open{" "}
            <Link
              href={pathForView("transactions")}
              className="text-link"
            >
              Transactions
            </Link>{" "}
            and set Category + App on each spend.
          </p>
        </header>
      </LedgerlineFadeContent>

      {visibleGroups.length === 0 && !showUnused ? (
        <p className="meta">No spending matched an app in {formatMonthTitle(month)} yet.</p>
      ) : null}

      {visibleGroups.map((group, index) => (
        <LedgerlineFadeContent key={group.slug} delay={80 + index * 40}>
          <Panel>
            <PanelHead
              title={group.label}
              subtitle={`${group.apps.length} app${group.apps.length === 1 ? "" : "s"}`}
            />
            {group.apps.length === 0 ? (
              fetching ? (
                <div className="apps-grid">
                  {[1, 2, 3].map((i) => (
                    <AppCardSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <p className="meta">No apps in this category yet</p>
              )
            ) : (
              <div className="apps-grid">
                {group.apps.map(({ provider, total, count }) => (
                  <AppCard
                    key={provider.id}
                    name={provider.canonicalName}
                    logoUrl={provider.logoUrl}
                    total={total}
                    count={count}
                    categorySlug={provider.categorySlug}
                    categories={data.categories ?? []}
                    upiHandles={provider.upiHandles}
                    onCategory={async (next) => {
                      if (!api || !provider.id) return;
                      try {
                        setError(null);
                        await api.patchProvider(provider.id, { categorySlug: next });
                        await loadProviders();
                        refresh();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Could not move app");
                      }
                    }}
                    onAddUpi={async (handle) => {
                      if (!api || !provider.id) return;
                      try {
                        setError(null);
                        await api.patchProvider(provider.id, { addUpiHandle: handle });
                        setMessage(`${handle} saved on ${provider.canonicalName}`);
                        await loadProviders();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Could not save UPI id");
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </Panel>
        </LedgerlineFadeContent>
      ))}

      {unusedCount > 0 ? (
        <button
          type="button"
          className="ghost apps-unused-toggle"
          aria-expanded={showUnused}
          onClick={() => setShowUnused((value) => !value)}
        >
          {showUnused
            ? "Hide apps with no spending"
            : `Show ${unusedCount} app${unusedCount === 1 ? "" : "s"} with no spending this month`}
        </button>
      ) : null}

      <LedgerlineFadeContent delay={200}>
        <Panel>
          <PanelHead
            title="Add an app"
            subtitle="New vendors show up here and in the transaction pickers"
          />
          {message ? <p className="meta">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <form
            className="apps-add"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!api) return;
              const trimmed = name.trim();
              if (!trimmed) {
                setError("Enter an app name");
                return;
              }
              try {
                setError(null);
                await api.createProvider({
                  canonicalName: trimmed,
                  categorySlug,
                  aliases: [trimmed],
                  logoUrl: logoForAppName(trimmed),
                });
                setName("");
                setMessage(`${trimmed} added`);
                await loadProviders();
                refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not add app");
              }
            }}
          >
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zepto"
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
              >
                {(data.categories ?? [])
                  .filter((category) => !category.meta?.parent)
                  .map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="cta">
              Add app
            </button>
          </form>
        </Panel>
      </LedgerlineFadeContent>

      <LedgerlineFadeContent delay={240}>
        <Panel>
          <PanelHead
            title="Add a category"
            subtitle="Healthcare and Family are already there. Add your own when a spend does not fit."
          />
          <form
            className="apps-add"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!api) return;
              const trimmed = newCategory.trim();
              if (!trimmed) {
                setError("Enter a category name");
                return;
              }
              try {
                setError(null);
                const res = await api.createCategory({ label: trimmed });
                setNewCategory("");
                setCategorySlug(res.category.slug);
                setMessage(`${res.category.label} category added`);
                refresh();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not add category",
                );
              }
            }}
          >
            <label className="field">
              <span>Category name</span>
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Pets"
              />
            </label>
            <button type="submit" className="cta">
              Add category
            </button>
          </form>
        </Panel>
      </LedgerlineFadeContent>
    </div>
  );
}
