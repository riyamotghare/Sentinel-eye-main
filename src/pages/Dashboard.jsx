import "../App.css";
import { useEffect, useRef, useState } from "react";
import api from "../api/api";

const INITIAL_EVENTS = [];
const RECORD_DURATION_MS = 4000;

function Dashboard() {
  // ============================================================
  // CLOCK
  // ============================================================
  const [time, setTime] = useState("");

  // ============================================================
  // MODE
  // ============================================================
  const [mode, setMode] = useState("upload");
  // "upload" | "webcam"

  // ============================================================
  // UPLOAD VIDEO
  // ============================================================
  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const fileInputRef = useRef(null);

  // ============================================================
  // ANALYSIS / RESULT
  // ============================================================
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [events, setEvents] = useState(INITIAL_EVENTS);

  // ============================================================
  // WEBCAM
  // ============================================================
  const [webcamActive, setWebcamActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [camError, setCamError] = useState(null);

  const webcamVideoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // ============================================================
  // CLOCK
  // ============================================================
  useEffect(() => {
    const updateClock = () => {
      setTime(
        new Date().toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "medium",
        })
      );
    };

    updateClock();

    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, []);

  // ============================================================
  // CLEANUP VIDEO URL
  // ============================================================
  useEffect(() => {
    return () => {
      if (videoURL) {
        URL.revokeObjectURL(videoURL);
      }
    };
  }, [videoURL]);

  // ============================================================
  // STOP WEBCAM WHEN COMPONENT UNMOUNTS
  // ============================================================
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch (error) {
          console.warn("MediaRecorder cleanup error:", error);
        }
      }
    };
  }, []);

  // ============================================================
  // HANDLE FILE SELECTION
  // ============================================================
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    console.log("=================================");
    console.log("VIDEO SELECTED");
    console.log("Name:", file.name);
    console.log("Type:", file.type);
    console.log("Size:", file.size);
    console.log("=================================");

    if (!file.type.startsWith("video/")) {
      alert("Please select a valid video file.");
      return;
    }

    if (videoURL) {
      URL.revokeObjectURL(videoURL);
    }

    const url = URL.createObjectURL(file);

    console.log("Preview URL:", url);

    setVideoFile(file);
    setVideoURL(url);
    setResult(null);
  };

  // ============================================================
  // HANDLE DRAG & DROP
  // ============================================================
  const handleDrop = (e) => {
    e.preventDefault();

    const file = e.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    console.log("=================================");
    console.log("VIDEO DROPPED");
    console.log("Name:", file.name);
    console.log("Type:", file.type);
    console.log("Size:", file.size);
    console.log("=================================");

    if (!file.type.startsWith("video/")) {
      alert("Please drop a valid video file.");
      return;
    }

    if (videoURL) {
      URL.revokeObjectURL(videoURL);
    }

    const url = URL.createObjectURL(file);

    setVideoFile(file);
    setVideoURL(url);
    setResult(null);
  };

  // ============================================================
  // VIDEO LOADED
  // ============================================================
  const handleVideoLoadedMetadata = (e) => {
    const video = e.currentTarget;

    console.log("=================================");
    console.log("VIDEO LOADED SUCCESSFULLY");
    console.log("Duration:", video.duration);
    console.log("Width:", video.videoWidth);
    console.log("Height:", video.videoHeight);
    console.log("=================================");
  };

  // ============================================================
  // VIDEO ERROR
  // ============================================================
  const handleVideoError = (e) => {
    const video = e.currentTarget;

    console.error("=================================");
    console.error("VIDEO PLAYBACK ERROR");
    console.error("Error:", video.error);
    console.error("File:", videoFile?.name);
    console.error("Type:", videoFile?.type);
    console.error("=================================");
  };

  // ============================================================
  // ANALYZE VIDEO
  // ============================================================
  const analyzeFile = async (file, sourceLabel) => {
    if (!file) {
      return null;
    }

    setAnalyzing(true);
    setResult(null);

    const formData = new FormData();

    formData.append("video", file);
    formData.append("source", sourceLabel.toLowerCase());

    try {
      console.log("=================================");
      console.log("SENDING VIDEO TO BACKEND");
      console.log("File:", file.name);
      console.log("Type:", file.type);
      console.log("Source:", sourceLabel);
      console.log("=================================");

      const response = await api.post("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("BACKEND RESPONSE:", response.data);

      const data = response.data;

      // --------------------------------------------------------
      // NORMALIZE BACKEND RESPONSE
      // --------------------------------------------------------

      const label = String(data.label || "").toUpperCase();

      const violence =
        label === "VIOLENCE DETECTED" ||
        label === "VIOLENCE" ||
        label === "ASSAULT" ||
        data.violence === true;

      const confidence =
        data.confidence !== undefined
          ? Number(data.confidence).toFixed(2)
          : "0.00";

      const normalized = {
        ...data,
        label,
        confidence,
        violence,
      };

      setResult(normalized);

      // --------------------------------------------------------
      // ADD EVENT
      // --------------------------------------------------------

      const now = new Date().toLocaleTimeString("en-IN", {
        hour12: false,
      });

      const newEvent = {
        id: Date.now(),
        time: now,
        camera: sourceLabel,
        location: file.name,
        status: violence ? "violence" : "normal",
      };

      setEvents((previousEvents) => {
        return [newEvent, ...previousEvents].slice(0, 5);
      });

      return normalized;
    } catch (error) {
      console.error("=================================");
      console.error("ANALYSIS ERROR");
      console.error(error);
      console.error("=================================");

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Cannot reach the Flask backend. Make sure it is running on port 5000.";

      setResult({
        error: true,
        message,
      });

      return null;
    } finally {
      setAnalyzing(false);
    }
  };

  // ============================================================
  // ANALYZE UPLOADED FILE
  // ============================================================
  const handleAnalyze = async () => {
    if (!videoFile) {
      alert("Please select a video first.");
      return;
    }

    await analyzeFile(videoFile, "Upload");
  };

  // ============================================================
  // START WEBCAM
  // ============================================================
  const startWebcam = async () => {
    setCamError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Webcam API is not supported by this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;

        try {
          await webcamVideoRef.current.play();
        } catch (playError) {
          console.warn("Could not autoplay webcam:", playError);
        }
      }

      setWebcamActive(true);
      setResult(null);
    } catch (error) {
      console.error("WEBCAM ERROR:", error);

      setCamError(
        "Could not access webcam. Check browser permissions and try again."
      );
    }
  };

  // ============================================================
  // STOP WEBCAM
  // ============================================================
  const stopWebcam = () => {
    // Stop MediaRecorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.warn("MediaRecorder stop error:", error);
      }
    }

    mediaRecorderRef.current = null;

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    // Remove video source
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }

    setWebcamActive(false);
    setRecording(false);
  };

  // ============================================================
  // RECORD WEBCAM AND ANALYZE
  // ============================================================
  const recordAndAnalyze = () => {
    if (!streamRef.current) {
      alert("Please start the webcam first.");
      return;
    }

    if (recording || analyzing) {
      return;
    }

    chunksRef.current = [];

    let mimeType = "";

    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
      mimeType = "video/webm;codecs=vp9";
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
      mimeType = "video/webm;codecs=vp8";
    } else if (MediaRecorder.isTypeSupported("video/webm")) {
      mimeType = "video/webm";
    } else {
      alert("Your browser does not support webcam recording.");
      return;
    }

    console.log("Recording MIME type:", mimeType);

    let recorder;

    try {
      recorder = new MediaRecorder(streamRef.current, {
        mimeType,
      });
    } catch (error) {
      console.error("MediaRecorder error:", error);
      alert("Could not start webcam recording.");
      return;
    }

    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onerror = (event) => {
      console.error("Recording error:", event);
      setRecording(false);
    };

    recorder.onstop = async () => {
      setRecording(false);

      if (chunksRef.current.length === 0) {
        console.error("No webcam data was recorded.");
        return;
      }

      const blob = new Blob(chunksRef.current, {
        type: mimeType,
      });

      console.log("Webcam recording size:", blob.size);

      const file = new File(
        [blob],
        `webcam-${Date.now()}.webm`,
        {
          type: mimeType,
        }
      );

      await analyzeFile(file, "Webcam");
    };

    recorder.start(250);

    setRecording(true);

    setTimeout(() => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    }, RECORD_DURATION_MS);
  };

  // ============================================================
  // SWITCH MODE
  // ============================================================
  const switchMode = (nextMode) => {
    if (nextMode === mode) {
      return;
    }

    stopWebcam();
    setResult(null);
    setMode(nextMode);
  };

  // ============================================================
  // CLEAR UPLOADED VIDEO
  // ============================================================
  const clearVideo = () => {
    setResult(null);
    setVideoFile(null);

    if (videoURL) {
      URL.revokeObjectURL(videoURL);
    }

    setVideoURL(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ============================================================
  // RESULT STATUS CLASS
  // ============================================================
  const statusClass = analyzing
    ? "status-analyzing"
    : result?.error
      ? "status-error"
      : result?.violence
        ? "status-danger"
        : result
          ? "status-safe"
          : "";

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="dashboard">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="header">
        <div className="headerLeft">
          <div className="logo">
            <span className="logoIcon">
              👁
            </span>

            <div>
              <h1>SENTINEL EYE</h1>

              <p className="subtitle">
                AI-Powered Violence Detection System
              </p>
            </div>
          </div>
        </div>

        <div className="headerRight">
          <span className="liveBadge">
            ● LIVE
          </span>

          <span className="clockDisplay">
            {time}
          </span>
        </div>
      </header>

      {/* ======================================================
          MAIN GRID
      ====================================================== */}

      <section className="mainGrid">

        {/* ====================================================
            VIDEO PANEL
        ==================================================== */}

        <div className="videoPanel">

          <div className="panelHeader">
            <h2>
              CCTV Analysis Feed
            </h2>

            <div className="modeToggle">

              <button
                type="button"
                className={
                  mode === "upload"
                    ? "modeBtn modeBtnActive"
                    : "modeBtn"
                }
                onClick={() => switchMode("upload")}
              >
                Upload Video
              </button>

              <button
                type="button"
                className={
                  mode === "webcam"
                    ? "modeBtn modeBtnActive"
                    : "modeBtn"
                }
                onClick={() => switchMode("webcam")}
              >
                Live Webcam
              </button>

            </div>
          </div>

          {/* ==================================================
              UPLOAD MODE
          ================================================== */}

          {mode === "upload" && (
            <div className="videoWrapper">

              {videoURL ? (
                <>
                  {/* ACTUAL VIDEO PLAYER */}

                  <video
                    key={videoURL}
                    className="camera"
                    controls
                    autoPlay
                    muted
                    playsInline
                    preload="auto"
                    onLoadedMetadata={handleVideoLoadedMetadata}
                    onLoadedData={() => {
                      console.log("Video data loaded");
                    }}
                    onCanPlay={() => {
                      console.log("Video is ready to play");
                    }}
                    onError={handleVideoError}
                  >
                    <source
                      src={videoURL}
                      type={videoFile?.type || "video/mp4"}
                    />

                    Your browser does not support HTML5 video.
                  </video>

                  {/* VIDEO OVERLAY */}

                  <div className="videoOverlay">

                    <span className="recTag">
                      ● REC
                    </span>

                    <span className="videoDate">
                      {new Date().toLocaleDateString("en-IN")}
                    </span>

                  </div>

                  {/* ANALYZING OVERLAY */}

                  {analyzing && (
                    <div className="analyzingOverlay">

                      <div className="analyzingPulse">
                        <span className="pulseRing" />
                        <span className="pulseRing delay1" />
                        <span className="pulseRing delay2" />
                      </div>

                      <p className="analyzingText">
                        DETECTING…
                      </p>

                      <p className="analyzingSubtext">
                        AI model is analyzing the footage
                      </p>

                    </div>
                  )}
                </>
              ) : (

                /* VIDEO PLACEHOLDER */

                <div
                  className="videoPlaceholder"
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                >

                  <div className="placeholderIcon">
                    📹
                  </div>

                  <p className="placeholderText">
                    Drop a video here or click to select
                  </p>

                  <p className="placeholderSub">
                    Supports MP4, WebM and M4V video formats
                  </p>

                </div>
              )}

            </div>
          )}

          {/* ==================================================
              WEBCAM MODE
          ================================================== */}

          {mode === "webcam" && (
            <div className="videoWrapper">

              <video
                ref={webcamVideoRef}
                className="camera"
                autoPlay
                playsInline
                muted
              />

              {!webcamActive && (
                <div className="videoPlaceholder webcamOverlayPlaceholder">

                  <div className="placeholderIcon">
                    🎥
                  </div>

                  <p className="placeholderText">
                    Webcam is off
                  </p>

                  <p className="placeholderSub">
                    {camError
                      ? camError
                      : 'Click "Start Webcam" below to begin'}
                  </p>

                </div>
              )}

              {webcamActive && (
                <div className="videoOverlay">

                  <span
                    className={
                      recording
                        ? "recTag recTagActive"
                        : "recTag"
                    }
                  >
                    {recording
                      ? "● RECORDING"
                      : "● LIVE"}
                  </span>

                  <span className="videoDate">
                    {new Date().toLocaleDateString("en-IN")}
                  </span>

                </div>
              )}

              {(analyzing || recording) &&
                webcamActive && (
                  <div className="analyzingOverlay">

                    <div className="analyzingPulse">
                      <span className="pulseRing" />
                      <span className="pulseRing delay1" />
                      <span className="pulseRing delay2" />
                    </div>

                    <p className="analyzingText">
                      {recording
                        ? "CAPTURING CLIP…"
                        : "DETECTING…"}
                    </p>

                    <p className="analyzingSubtext">
                      {recording
                        ? "Recording a short clip from your webcam"
                        : "AI model is analyzing the footage"}
                    </p>

                  </div>
                )}

            </div>
          )}

        </div>

        {/* ====================================================
            DETECTION RESULT
        ==================================================== */}

        <div className={`resultPanel ${statusClass}`}>

          <div className="panelHeader">
            <h2>
              Detection Result
            </h2>
          </div>

          {/* IDLE */}

          {!result && !analyzing && (
            <div className="resultIdle">

              <div className="idleIcon">
                🛡
              </div>

              <p className="idleText">
                Awaiting Analysis
              </p>

              <p className="idleSub">

                {mode === "upload" ? (
                  <>
                    Upload a video and press{" "}
                    <strong>Analyze</strong>{" "}
                    to begin
                  </>
                ) : (
                  <>
                    Start the webcam and press{" "}
                    <strong>Record &amp; Analyze</strong>{" "}
                    to begin
                  </>
                )}

              </p>

            </div>
          )}

          {/* ANALYZING */}

          {analyzing && (
            <div className="resultBody">

              <div className="bigStatusLabel status-analyzing">
                ANALYZING…
              </div>

              <p className="bigSubtext">
                Processing video frames…
              </p>

              <div className="progressBar">
                <div className="progressFill" />
              </div>

            </div>
          )}

          {/* SUCCESS RESULT */}

          {result &&
            !analyzing &&
            !result.error && (
              <div
                className={
                  `resultBanner ${
                    result.violence
                      ? "banner-danger"
                      : "banner-safe"
                  }`
                }
              >

                <div className="bannerIcon">
                  {result.violence
                    ? "⚠"
                    : "✔"}
                </div>

                <div className="bannerText">

                  <div className="bannerLabel">
                    {result.violence
                      ? "VIOLENCE DETECTED"
                      : "NORMAL"}
                  </div>

                  <div className="bannerConfidence">
                    {result.confidence}%{" "}
                    Confidence
                  </div>

                  <div className="bannerDetail">
                    {result.violence
                      ? "Threat detected — review footage immediately"
                      : "No threat detected — area appears safe"}
                  </div>

                </div>

              </div>
            )}

          {/* ERROR */}

          {result?.error && (
            <div className="resultBody">

              <div className="bigStatusLabel status-error">
                DETECTION ERROR
              </div>

              <p className="bigSubtext">
                {result.message}
              </p>

            </div>
          )}

        </div>

      </section>

      {/* ======================================================
          UPLOAD / WEBCAM CONTROLS
      ====================================================== */}

      <section className="uploadSection">

        <div className="uploadCard">

          {/* ==================================================
              UPLOAD CONTROLS
          ================================================== */}

          {mode === "upload" && (
            <>

              <div className="uploadLeft">

                <div
                  className={
                    `dropZone ${
                      videoFile
                        ? "dropZoneHasFile"
                        : ""
                    }`
                  }
                  onDrop={handleDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                >

                  {videoFile ? (
                    <>
                      <span className="dropIcon">
                        🎞
                      </span>

                      <span className="dropFilename">
                        {videoFile.name}
                      </span>

                      <span className="dropChange">
                        Click to change
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="dropIcon">
                        📂
                      </span>

                      <span className="dropText">
                        Select or drop a CCTV video file
                      </span>
                    </>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp4,.webm,.m4v,video/mp4,video/webm"
                    style={{
                      display: "none",
                    }}
                    onChange={handleFileChange}
                  />

                </div>

              </div>

              <div className="uploadRight">

                {/* ANALYZE BUTTON */}

                <button
                  type="button"
                  className={
                    `analyzeBtn ${
                      analyzing
                        ? "analyzing"
                        : ""
                    }`
                  }
                  onClick={handleAnalyze}
                  disabled={
                    !videoFile ||
                    analyzing
                  }
                >

                  {analyzing ? (
                    <>
                      <span className="btnSpinner" />
                      Analyzing…
                    </>
                  ) : (
                    "▶  Analyze Video"
                  )}

                </button>

                {/* CLEAR BUTTON */}

                {videoFile && !analyzing && (
                  <button
                    type="button"
                    className="clearBtn"
                    onClick={clearVideo}
                  >
                    Clear
                  </button>
                )}

              </div>

            </>
          )}

          {/* ==================================================
              WEBCAM CONTROLS
          ================================================== */}

          {mode === "webcam" && (
            <div className="webcamControls">

              {!webcamActive ? (
                <button
                  type="button"
                  className="analyzeBtn"
                  onClick={startWebcam}
                >
                  🎥 Start Webcam
                </button>
              ) : (
                <>

                  <button
                    type="button"
                    className={
                      `analyzeBtn ${
                        recording || analyzing
                          ? "analyzing"
                          : ""
                      }`
                    }
                    onClick={recordAndAnalyze}
                    disabled={
                      recording ||
                      analyzing
                    }
                  >

                    {recording ? (
                      <>
                        <span className="btnSpinner" />
                        Recording…
                      </>
                    ) : analyzing ? (
                      <>
                        <span className="btnSpinner" />
                        Analyzing…
                      </>
                    ) : (
                      "⏺ Record & Analyze"
                    )}

                  </button>

                  <button
                    type="button"
                    className="clearBtn"
                    onClick={stopWebcam}
                  >
                    Stop Webcam
                  </button>

                </>
              )}

            </div>
          )}

        </div>

      </section>

      {/* ======================================================
          RECENT EVENTS
      ====================================================== */}

      <section className="eventsSection">

        <div className="panelHeader">

          <h2>
            Recent Detection Events
          </h2>

          <span className="eventCount">
            {events.length} events
          </span>

        </div>

        <div className="tableWrapper">

          <table>

            <thead>
              <tr>

                <th>
                  Time
                </th>

                <th>
                  Source
                </th>

                <th>
                  Location / File
                </th>

                <th>
                  Status
                </th>

              </tr>
            </thead>

            <tbody>

              {events.length === 0 ? (
                <tr>

                  <td
                    colSpan="4"
                    style={{
                      textAlign: "center",
                      padding: "30px",
                      opacity: 0.6,
                    }}
                  >
                    No detection events yet.
                  </td>

                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id}>

                    <td>
                      {event.time}
                    </td>

                    <td>
                      {event.camera}
                    </td>

                    <td className="locationCell">
                      {event.location}
                    </td>

                    <td>

                      <span
                        className={
                          event.status === "violence"
                            ? "dangerBadge"
                            : "safeBadge"
                        }
                      >

                        {event.status === "violence"
                          ? "⚠ Violence Detected"
                          : "✔ Normal Activity"}

                      </span>

                    </td>

                  </tr>
                ))
              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}

export default Dashboard;