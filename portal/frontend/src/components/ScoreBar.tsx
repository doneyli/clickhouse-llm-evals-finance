interface Props {
  value: number | null | undefined;
  /** The bar this score is judged against. Null/undefined means no bar was
   *  recorded, so the fill stays neutral instead of implying a verdict. */
  threshold?: number | null;
}

export default function ScoreBar({ value, threshold }: Props) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="score-pill mute">—</span>;
  }
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const verdict =
    threshold === null || threshold === undefined
      ? "neutral"
      : value >= threshold
        ? "pass"
        : "fail";
  return (
    <div className="score-bar">
      <div className="score-bar-track">
        <div
          className={`score-bar-fill ${verdict}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="score-bar-value">{pct.toFixed(1)}%</span>
    </div>
  );
}
