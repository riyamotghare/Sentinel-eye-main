function AlertPopup({ show, confidence }) {
  if (!show) return null;

  return (
    <div className="popup">
      <h2>🚨 VIOLENCE DETECTED</h2>

      <p>Confidence: {confidence}%</p>

      <button onClick={() => window.location.reload()}>
        Dismiss
      </button>
    </div>
  );
}

export default AlertPopup;