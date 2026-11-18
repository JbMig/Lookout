"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Graphique } from "@/lib/social";

/** Palette « nuancier » (DESIGN.md) : nuit, ambre, puis familles de teintes. */
const PALETTE = ["#13233F", "#F2A33A", "#E58FA0", "#8E3557", "#A884B5", "#EE9474", "#B98667", "#24406B", "#C8243B", "#17784F"];
const SANS_AMBRE = PALETTE.filter((c) => c !== "#F2A33A");
const LOREAL = "#F2A33A"; // ambre = marques du groupe L'Oréal
/** Nuances d'ambre : chaque marque L'Oréal garde l'ambre mais reste distincte des autres. */
const LOREAL_RAMP = ["#F2A33A", "#C97D14", "#F7C27A", "#8A560B", "#FAD9A8", "#E08A1E"];
const AUTRE = "#13233F";
const GRID = "#eef0f3";
const TICK = { fontSize: 12, fill: "#6f7b8e" };
const TOOLTIP = {
  contentStyle: { borderRadius: 10, border: "1px solid #e4e6eb", boxShadow: "0 8px 20px -12px rgb(19 35 63 / .35)", fontSize: 13 },
  cursor: { fill: "rgb(19 35 63 / 0.04)" },
};
const fmt = (v: unknown) =>
  typeof v === "number" ? new Intl.NumberFormat("fr-FR", { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 2 }).format(v) : String(v ?? "");

/** Rend un graphique décrit par l'analyse (données calculées par le job, jamais par le LLM). */
export function SocialChart({ g }: { g: Graphique }) {
  const data = g.donnees;
  if (!data?.length) return <p className="py-12 text-center text-sm text-ink-faint">Pas assez de données pour ce graphique.</p>;
  const loreal = (row: Record<string, unknown>) => row.loreal === true;

  if (g.type === "donut") {
    const key = g.series[0]?.cle ?? "valeur";
    // Les parts nulles n'apparaissent pas ; chaque marque a sa propre couleur.
    const rows = data.filter((row) => Number(row[key]) > 0);
    let l = 0, o = 0;
    const colors = rows.map((row) => (loreal(row) ? LOREAL_RAMP[l++ % LOREAL_RAMP.length] : SANS_AMBRE[o++ % SANS_AMBRE.length]));
    return (
      <>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={rows} dataKey={key} nameKey={g.axe_x} innerRadius={62} outerRadius={110} paddingAngle={1.5} stroke="#fff">
              {rows.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Pie>
            <Tooltip {...TOOLTIP} formatter={(v) => `${fmt(v)} %`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        {rows.some(loreal) && <p className="mt-1 text-center text-xs text-ink-faint">Nuances d&apos;ambre : marques du groupe L&apos;Oréal</p>}
      </>
    );
  }

  if (g.type === "lignes") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={g.axe_x} tick={TICK} tickFormatter={(d) => String(d).slice(5)} minTickGap={24} />
          <YAxis tick={TICK} />
          <Tooltip {...TOOLTIP} formatter={fmt} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {g.series.map((s, i) => <Line key={s.cle} type="monotone" dataKey={s.cle} name={s.nom} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} />)}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  const empile = g.type === "barres_empilees";
  const couleursEmpilees: Record<string, string> = { positif: "#17784F", negatif: "#B33939", "achète": "#17784F", "hésite": "#F2A33A", "n'achète pas": "#B33939" };
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={TICK} tickFormatter={fmt} />
        <YAxis type="category" dataKey={g.axe_x} tick={TICK} width={150} />
        <Tooltip {...TOOLTIP} formatter={fmt} />
        {empile && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {g.series.map((s, i) => (
          <Bar key={s.cle} dataKey={s.cle} name={s.nom} stackId={empile ? "a" : undefined} radius={empile ? 0 : [0, 4, 4, 0]}
               fill={couleursEmpilees[s.cle] ?? PALETTE[i % PALETTE.length]}>
            {!empile && data.map((row, j) => <Cell key={j} fill={loreal(row) ? LOREAL : AUTRE} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
