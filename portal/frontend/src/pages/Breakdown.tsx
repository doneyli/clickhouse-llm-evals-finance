import { Link as RouterLink, useParams } from "react-router-dom";
import {
  BigStat,
  Button,
  Panel,
  Table,
  Title,
  type TableColumnConfigProps,
  type TableRowType,
} from "@clickhouse/click-ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AsyncView, useAsync } from "../components/AsyncView";
import PageHeader from "../components/PageHeader";
import ProvenanceStrip from "../components/ProvenanceStrip";
import ScoreBar from "../components/ScoreBar";
import StatusBadge from "../components/StatusBadge";
import { api } from "../lib/api";
import { useChartTheme } from "../lib/chartTheme";
import { datasetLabel } from "../lib/datasets";
import { barFor, barPct } from "../lib/gate";
import type { ScoreAggregate } from "../types";

const TAIL_HEADERS: TableColumnConfigProps[] = [
  { label: "Mean", width: "200px" },
  { label: "Min", width: "90px" },
  { label: "Max", width: "90px" },
  { label: "Pass rate", width: "110px" },
  { label: "Items", width: "90px" },
];

// The per-dimension "Gate" column belongs to agent runs: their gate names a bar
// for each dimension. A model gate enforces one score against one bar, so
// repeating that bar on every evaluator would claim gates that don't exist.
const GATE_HEADERS: TableColumnConfigProps[] = [
  { label: "Evaluator" },
  { label: "Gate", width: "90px" },
  ...TAIL_HEADERS,
];

const SCALAR_HEADERS: TableColumnConfigProps[] = [
  { label: "Evaluator" },
  ...TAIL_HEADERS,
];

interface AggRow {
  name: string;
  agg: ScoreAggregate;
  /** The bar this evaluator's mean is judged against, or null if none. */
  bar: number | null;
  /** Whether that bar is this dimension's own (agent gate) or the run's single
   *  threshold, which is not attributable to any one evaluator. */
  perDimension: boolean;
}

function aggRow({ name, agg, bar, perDimension }: AggRow): TableRowType {
  const gateCell = {
    label: (
      <span
        className="mono"
        style={{
          fontSize: 13,
          color: bar === null ? "var(--text-subtle)" : "var(--text-muted)",
        }}
      >
        {bar === null ? "—" : `≥ ${barPct(bar)}`}
      </span>
    ),
  };
  return {
    id: name,
    items: [
      { label: <span style={{ fontWeight: 600 }}>{name}</span> },
      ...(perDimension ? [gateCell] : []),
      { label: <ScoreBar value={agg.mean} threshold={bar} /> },
      {
        label: (
          <span className="mono" style={{ fontSize: 13 }}>
            {(agg.min * 100).toFixed(1)}%
          </span>
        ),
      },
      {
        label: (
          <span className="mono" style={{ fontSize: 13 }}>
            {(agg.max * 100).toFixed(1)}%
          </span>
        ),
      },
      {
        label: (
          <span className="mono" style={{ fontSize: 13 }}>
            {(agg.pass_rate * 100).toFixed(1)}%
          </span>
        ),
      },
      {
        label: (
          <span className="mono" style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {agg.count}
          </span>
        ),
      },
    ],
  };
}

export default function Breakdown() {
  const { dataset: d1, sub, runName } = useParams<{
    dataset: string;
    sub: string;
    runName: string;
  }>();
  const dataset = `${d1}/${sub}`;
  const run = runName ?? "";
  const state = useAsync(() => api.breakdown(dataset, run), [dataset, run]);
  const chart = useChartTheme();

  return (
    <AsyncView state={state}>
      {(data) => {
        // A model gate is one scalar bar; an agent gate is one bar per
        // dimension, all of which must clear. Show each evaluator against its
        // own bar rather than collapsing the gate into a single number.
        const gate = data.gate_thresholds;
        const scalar = data.threshold;
        const aggEntries: AggRow[] = Object.entries(data.aggregates)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, agg]) => ({
            name,
            agg,
            bar: barFor(name, gate, scalar),
            perDimension: gate !== null,
          }));

        const chartData = aggEntries.map(({ name, agg, bar }) => ({
          name,
          mean: agg.mean * 100,
          bar,
        }));

        const langfuseDeep = `${data.langfuse_url}/trace`;
        return (
          <>
            <ProvenanceStrip deepLink={langfuseDeep} />
            <PageHeader
              crumbs={[
                { label: "Dashboard", to: "/" },
                { label: datasetLabel(dataset), to: `/history/${dataset}` },
                { label: data.model },
              ]}
              title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {data.model}
                  <StatusBadge status={data.status} size="md" />
                </span>
              }
              subtitle={
                <span
                  className="mono"
                  style={{ fontSize: 12, color: "var(--text-muted)" }}
                >
                  {data.run_name}
                </span>
              }
              actions={
                <RouterLink
                  to={`/run/${dataset}/${encodeURIComponent(run)}`}
                  style={{ textDecoration: "none" }}
                >
                  <Button type="primary" iconRight="arrow-right">
                    Per-item view
                  </Button>
                </RouterLink>
              }
            />

            <div className="stat-grid">
              <BigStat
                label="Items evaluated"
                title={String(data.total_items)}
                size="lg"
              />
              {gate ? (
                <BigStat
                  label="Gate (all must clear)"
                  title={`${Object.keys(gate).length} dims`}
                  size="lg"
                  state="muted"
                />
              ) : (
                <BigStat
                  label="Threshold"
                  title={scalar !== null ? barPct(scalar) : "—"}
                  size="lg"
                  state="muted"
                />
              )}
              {aggEntries.map(({ name, agg, bar, perDimension }) => (
                <BigStat
                  key={name}
                  label={
                    !perDimension || bar === null ? (
                      name
                    ) : (
                      <>
                        {name}{" "}
                        <span style={{ color: "var(--text-muted)" }}>
                          ≥ {barPct(bar)}
                        </span>
                      </>
                    )
                  }
                  title={`${(agg.mean * 100).toFixed(1)}%`}
                  size="lg"
                  error={bar !== null && agg.mean < bar}
                />
              ))}
            </div>

            {chartData.length > 0 && (
              <Panel
                hasBorder
                radii="md"
                padding="md"
                color="default"
                className="section"
              >
                <div style={{ marginBottom: 12 }}>
                  <Title type="h3" size="sm">
                    Evaluator scores
                  </Title>
                </div>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 16, bottom: 8, left: 0 }}
                    >
                      <CartesianGrid
                        stroke={chart.grid}
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        stroke={chart.axisText}
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: chart.axis }}
                      />
                      <YAxis
                        stroke={chart.axisText}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                      />
                      {/* One line only makes sense when one bar applies to
                          every evaluator; an agent gate's per-dimension bars
                          are on each bar's tooltip and stat card instead. */}
                      {!gate && scalar !== null && (
                        <ReferenceLine
                          y={scalar * 100}
                          stroke={chart.threshold}
                          strokeDasharray="4 4"
                        />
                      )}
                      <Tooltip
                        contentStyle={{
                          background: chart.tooltipBg,
                          border: `1px solid ${chart.tooltipBorder}`,
                          borderRadius: 6,
                          fontSize: 12,
                          color: chart.tooltipText,
                        }}
                        labelStyle={{ color: chart.tooltipText }}
                        itemStyle={{ color: chart.tooltipText }}
                        formatter={(v: number, _name, item) => {
                          // Only an agent gate names a bar per dimension.
                          const bar = gate
                            ? (item?.payload as { bar: number | null })?.bar
                            : null;
                          return [
                            bar === null || bar === undefined
                              ? `${v.toFixed(1)}%`
                              : `${v.toFixed(1)}% (gate ≥ ${barPct(bar)})`,
                            "Mean",
                          ];
                        }}
                      />
                      <Bar dataKey="mean" radius={[4, 4, 0, 0]}>
                        {chartData.map((d) => (
                          <Cell
                            key={d.name}
                            fill={
                              d.bar === null
                                ? chart.neutral
                                : d.mean >= d.bar * 100
                                  ? chart.pass
                                  : chart.fail
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}

            <Panel
              padding="none"
              hasBorder
              radii="md"
              color="default"
              className="section"
            >
              <Table
                headers={gate ? GATE_HEADERS : SCALAR_HEADERS}
                rows={aggEntries.map(aggRow)}
                size="md"
                noDataMessage="No evaluator scores recorded."
              />
            </Panel>
          </>
        );
      }}
    </AsyncView>
  );
}
