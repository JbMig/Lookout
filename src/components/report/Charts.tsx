"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ItemView, ReportStats, ShadeFamily } from "@/lib/types";

const US = "#13233F";
const EU = "#F2A33A";
const GRID = "#eef0f3";
const TICK = { fontSize: 12, fill: "#6f7b8e" };
const TOOLTIP = {
  contentStyle: { borderRadius: 10, border: "1px solid #e4e6eb", boxShadow: "0 8px 20px -12px rgb(19 35 63 / .35)", fontSize: 13 },
  cursor: { fill: "rgb(19 35 63 / 0.04)" },
};

/** Couleur de référence de chaque famille de teintes. */
export const FAMILY_COLORS: Record<ShadeFamily, string> = {
  Rose: "#E58FA0",
  "Pêche / corail": "#EE9474",
  Rouge: "#C8243B",
  "Baie / prune": "#8E3557",
  Mauve: "#A884B5",
  "Nude / brun": "#B98667",
  Autre: "#C9CED6",
};

const Empty = ({ text }: { text: string }) => <p className="py-12 text-center text-sm text-ink-faint">{text}</p>;

export function PriceByBrandChart({ items }: { items: ItemView[] }) {
  const map = new Map<string, { brand: string; US?: number; EU?: number }>();
  for (const i of items) {
    if (i.product?.priceEur == null) continue;
    const row = map.get(i.circana.brand) ?? { brand: i.circana.brand };
    row[i.circana.zone] = i.product.priceEur;
    map.set(i.circana.brand, row);
  }
  const data = [...map.values()];
  if (!data.length) return <Empty text="Les prix apparaîtront avec les premières fiches." />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 48 }} barGap={3}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="brand" angle={-30} textAnchor="end" interval={0} tick={TICK} axisLine={false} tickLine={false} />
        <YAxis unit=" €" tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => `${Number(v).toFixed(2)} €`} {...TOOLTIP} />
        <Legend verticalAlign="top" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} />
        <Bar dataKey="US" name="États-Unis" fill={US} radius={[5, 5, 0, 0]} maxBarSize={22} />
        <Bar dataKey="EU" name="Europe" fill={EU} radius={[5, 5, 0, 0]} maxBarSize={22} />
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
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" unit=" M$" tick={TICK} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="brand" width={124} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => `${Number(v).toFixed(2)} M$`} {...TOOLTIP} />
        <Legend verticalAlign="top" height={30} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} />
        <Bar dataKey="US" name="États-Unis" stackId="s" fill={US} maxBarSize={18} />
        <Bar dataKey="EU" name="Europe" stackId="s" fill={EU} radius={[0, 5, 5, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FormatsChart({ stats }: { stats: ReportStats }) {
  const data = stats.formats.slice(0, 8);
  if (!data.length) return <Empty text="Aucun format relevé pour l'instant." />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" allowDecimals={false} domain={[0, "dataMax"]} tick={TICK} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="format" width={190} tick={TICK} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP} />
        <Bar dataKey="count" name="Produits" fill={US} radius={[0, 5, 5, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
