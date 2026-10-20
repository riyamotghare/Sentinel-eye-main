import os
import sys

# Get the project root directory
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Allow Python to find detector.py in the project root
sys.path.insert(0, ROOT_DIR)

from flask import Flask, request, jsonify
from flask_cors import CORS

from detector import predict_video, MODEL_PATH


app = Flask(__name__)
CORS(app)


# Upload folder
UPLOAD_FOLDER = os.path.join(ROOT_DIR, "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# Allowed video formats
ALLOWED_EXTENSIONS = {
    "mp4",
    "avi",
    "mov",
    "mkv",
    "webm"
}


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower()
        in ALLOWED_EXTENSIONS
    )


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "Backend Running",
        "model_loaded": os.path.exists(MODEL_PATH)
    })


@app.route("/upload", methods=["POST"])
def upload():

    # Check if video exists
    if "video" not in request.files:
        return jsonify({
            "error": True,
            "message": "No video uploaded"
        }), 400

    file = request.files["video"]

    # Check filename
    if file.filename == "":
        return jsonify({
            "error": True,
            "message": "No video selected"
        }), 400

    # Check extension
    if not allowed_file(file.filename):
        return jsonify({
            "error": True,
            "message": "Unsupported file type"
        }), 400

    # Save video
    filename = os.path.basename(file.filename)
    path = os.path.join(UPLOAD_FOLDER, filename)

    file.save(path)

    try:
        # Run violence detection
        result = predict_video(path)

        if result.get("error"):
            return jsonify(result), 500

        return jsonify(result)

    except Exception as e:
        return jsonify({
            "error": True,
            "message": str(e)
        }), 500

    finally:
        # Remove uploaded video after processing
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass