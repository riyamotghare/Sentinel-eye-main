function CameraCard({ cameraName }) {
  return (
    <div className="camera-card">
      <video
        className="camera-video"
        autoPlay
        muted
        loop
        controls
      >
        <source src="/videos/Assault005_x264.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      <h3>{cameraName}</h3>

      <p className="online">🟢 Online</p>
    </div>
  );
}

export default CameraCard;