from flask import Flask, request, jsonify
from flask_cors import CORS
from detector import predict_video, MODEL_PATH
from alerts import alerts_bp, init_db, log_alert
import cv2
import os

app = Flask(__name__)
CORS(app)

init_db()
app.register_blueprint(alerts_bp)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"mp4", "avi", "mov", "mkv", "webm"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def grab_frame(path):
    """Grab a frame from the middle of the clip for the alert snapshot."""
    cap = cv2.VideoCapture(path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    ok, frame = False, None
    if total > 0:
        cap.set(cv2.CAP_PROP_POS_FRAMES, total // 2)
        ok, frame = cap.read()
    if not ok:  # webm from the browser often has no frame count: use first frame
        cap.release()
        cap = cv2.VideoCapture(path)
        ok, frame = cap.read()
    cap.release()
    return frame if ok else None


@app.route("/")
def home():
    return {
        "status": "Backend Running",
        "model_loaded": os.path.exists(MODEL_PATH),
    }


@app.route("/upload", methods=["POST"])
def upload():

    if "video" not in request.files:
        return jsonify({"error": True, "message": "No video uploaded"}), 400

    file = request.files["video"]

    if file.filename == "":
        return jsonify({"error": True, "message": "No video selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": True, "message": "Unsupported file type"}), 400

    path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(path)

    result = predict_video(path)

    if result.get("error"):
        return jsonify(result), 500

    if result["label"] == "VIOLENCE DETECTED":
        log_alert(
            request.form.get("source", "upload").capitalize(),
            "violence",
            result["confidence"] / 100,  # model gives 0-100, alerts.py expects 0-1
            grab_frame(path),
        )

    return jsonify(result)


if __name__ == "__main__":
    if not os.path.exists(MODEL_PATH):
        print(f"warning: no model found at {MODEL_PATH} - /upload will return an error until it's added")

    # host 0.0.0.0 lets your phone reach the backend on the same Wi-Fi
    app.run(debug=True, host="0.0.0.0", port=5000)
