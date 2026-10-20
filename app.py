from flask import Flask, request, jsonify
from flask_cors import CORS
from detector import predict_video, MODEL_PATH
import os

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {"mp4", "avi", "mov", "mkv", "webm"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


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

    return jsonify(result)


if __name__ == "__main__":
    if not os.path.exists(MODEL_PATH):
        print(f"warning: no model found at {MODEL_PATH} - /upload will return an error until it's added")
    app.run(debug=True, port=5000)