"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ItemView, ReportStats, ShadeFamily } from "@/lib/types";

const US = "#13233F";
const EU = "#F2A33A";
const FAMILY_COLORS: Record<ShadeFamily, string> = {
  Rose: "#E8869B",
  "Pêche / corail": "#F2A07A",
  Rouge: "#C23B3B",
  "Baie / prune": "#7E2F55",
  Mauve: "#A884B5",
  "Nude / brun": "#B98667",
  Autre: "#C9C4BA",
};

const Empty = ({ text }: { text: string }) => <p className="py-10 text-center text-sm text-ink-soft">{text}</p>;

export function PriceByBrandChart({ items }: { items: ItemView[] }) {
  const map = new Map<string, { brand: string; US?: number; EU?: number }>();
  for (const i of items) {
    if (i.product?.priceEur == null) continue;
    const row = map.get(i.circana.brand) ?? { brand: i.circana.brand };
    row[i.circana.zone] = i.product.priceEur;
    map.set(i.circana.brand, row);
  }
  const data = [...map.values()];
  if (!data.length) return <Empty text="Pas encore de prix collectés." />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e0d8" vertical={false} />
        <XAxis dataKey="brand" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
        <YAxis unit=" €" tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} />
        <Legend verticalAlign="top" height={28} />
        <Bar dataKey="US" name="États-Unis" fill={US} radius={[4, 4, 0, 0]} />
        <Bar dataKey="EU" name="Europe" fill={EU} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SalesByBrandChart({ items }: { items: ItemView[] }) {
  const map = new Map<string, { brand: string; US: number; EU: number }>();
  for (const i of items) {
    if (!i.circana.salesValue) continue;
    const row = map.get(i.circana.brand) ?? { brand: i.circana.brand, US: 0, EU: 0 };
    row[i.circana.zone] += i.circana.salesValue / 1_000_000;
    map.set(i.circana.brand, row);
  }
  const data = [...map.values()].sort((a, b) => b.US + b.EU - (a.US + a.EU));
  if (!data.length) return <Empty text="Aucune donnée de ventes dans le fichier." />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e0d8" horizontal={false} />
        <XAxis type="number" unit=" M$" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="brand" width={120} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => `${Number(v).toFixed(2)} M$`} />
        <Legend verticalAlign="top" height={28} />
        <Bar dataKey="US" name="États-Unis" stackId="s" fill={US} />
        <Bar dataKey="EU" name="Europe" stackId="s" fill={EU} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ShadeFamiliesChart({ stats }: { stats: ReportStats }) {
  const families = Object.keys(FAMILY_COLORS) as ShadeFamily[];
  const data = stats.shadeFamilies.map((b) => ({ brand: b.brand, ...b.families }));
  if (!data.length) return <Empty text="Aucune teinte collectée." />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e0d8" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="brand" width={120} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend verticalAlign="top" height={44} wrapperStyle={{ fontSize: 12 }} />
        {families.map((f) => <Bar key={f} dataKey={f} stackId="f" fill={FAMILY_COLORS[f]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FormatsChart({ stats }: { stats: ReportStats }) {
  const data = stats.formats.slice(0, 8);
  if (!data.length) return <Empty text="Aucun format collecté." />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e0d8" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="format" width={170} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" name="Produits" fill={US} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
