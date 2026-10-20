function StatusCard({ title, value, color }) {
  return (
    <div className="status-card">
      <h3>{title}</h3>
      <h2 style={{ color }}>{value}</h2>
    </div>
  );
}

export default StatusCard;