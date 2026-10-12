export default function StatusChip({ status, label }) {
  const tone =
    status === 0
      ? "neutral"
      : status < 300
      ? "good"
      : status < 500
      ? "warn"
      : "bad";

  return (
    <span className={`chip chip-${tone}`}>
      {status === 0 ? "—" : status} {label}
    </span>
  );
}
