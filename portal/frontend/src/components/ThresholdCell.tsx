import { barPct, gateEntries, gateSummary } from "../lib/gate";
import type { GateThresholds } from "../types";

interface Props {
  /** Bar for the score shown next to this cell. */
  threshold: number | null;
  /** Per-dimension bars when the run was judged by an agent gate. */
  gate: GateThresholds | null;
}

/**
 * The "Threshold" table cell.
 *
 * A model gate has one bar, so we print it. An agent gate has one bar per
 * dimension and *all* of them must clear, so printing a single number would
 * misstate what the gate enforced: we print the bar for the score shown in the
 * row, mark how many dimensions stand behind the verdict, and spell the whole
 * gate out on hover (the Details page lists every bar).
 */
export default function ThresholdCell({ threshold, gate }: Props) {
  if (gate) {
    return (
      <span
        style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}
        title={gateSummary(gate)}
      >
        <span className="mono" style={{ fontSize: 13 }}>
          {threshold !== null ? barPct(threshold) : "—"}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          of {gateEntries(gate).length} gate dims
        </span>
      </span>
    );
  }

  if (threshold === null) {
    return (
      <span
        className="mono"
        style={{ fontSize: 13, color: "var(--text-subtle)" }}
        title="This run recorded no threshold"
      >
        —
      </span>
    );
  }

  return (
    <span className="mono" style={{ fontSize: 13 }}>
      {barPct(threshold)}
    </span>
  );
}
