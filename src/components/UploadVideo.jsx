import { useState } from "react";
import api from "../api/api";
import AlertPopup from "./AlertPopup";

function UploadVideo() {
  const [video, setVideo] = useState(null);
  const [result, setResult] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [confidence, setConfidence] = useState(0);

  const uploadVideo = async () => {
    if (!video) {
      setResult("Please select a video first.");
      return;
    }

    try {
  const response = await api.post("/upload", formData);

  if (response.data.label === "VIOLENCE DETECTED") {
    setResult("🚨 Violence Detected");
    setConfidence(response.data.confidence);
    setShowPopup(true);
  } else {
    setResult("Area Safe");
    setConfidence(response.data.confidence);
    setShowPopup(false);
  }
} catch (err) {
  console.error(err);
  setResult("❌ Unable to connect to Flask Backend");
  setShowPopup(false);
}

  return (
    <div>
      <AlertPopup
        show={showPopup}
        confidence={confidence}
      />

      <h2>Upload CCTV Video</h2>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => setVideo(e.target.files[0])}
      />

      <br />
      <br />

      <button onClick={uploadVideo}>
        Upload Video
      </button>

      <h2>{result}</h2>
    </div>
  );
}

export default UploadVideo;
}
