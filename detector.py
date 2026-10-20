import os
import cv2
import numpy as np
import tensorflow as tf


# ============================================================
# PATHS
# ============================================================


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(
    BASE_DIR,
    "ai",
    "sentinel_model_best.keras"
)

# ============================================================
# MODEL SETTINGS
# ============================================================

IMG_SIZE = 64
SEQUENCE_LENGTH = 16

model = None
model_error = None


# ============================================================
# LOAD MODEL
# ============================================================

def load_model():

    global model
    global model_error

    if not os.path.exists(MODEL_PATH):
        model_error = "Model not found at:\n" + MODEL_PATH
        print(model_error)
        return None

    try:
        print("Model file found:")
        print(MODEL_PATH)

        model = tf.keras.models.load_model(MODEL_PATH)

        print("MODEL LOADED SUCCESSFULLY")
        return model

    except Exception as e:
        model_error = "MODEL LOAD ERROR: " + str(e)
        print(model_error)
        model = None
        return None


# Load model when detector is imported
load_model()


# ============================================================
# FRAME PREPROCESSING (matches Colab training exactly)
# ============================================================

def preprocess_frame(frame):
    frame = cv2.resize(frame, (IMG_SIZE, IMG_SIZE))
    frame = frame.astype(np.float32) / 255.0
    return frame


# ============================================================
# EXTRACT FRAMES (matches Colab's sequential skip sampling,
# with a fallback for files whose frame-count metadata is
# unreliable -- this is common for .webm clips recorded live
# via the browser's MediaRecorder, as opposed to .mp4 files
# with a proper index)
# ============================================================

def extract_frames(video_path):

    cap = cv2.VideoCapture(video_path, cv2.CAP_FFMPEG)

    if not cap.isOpened():
        raise ValueError("Could not open video: " + video_path)

    reported_total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # A reported frame count at or below SEQUENCE_LENGTH is suspicious for
    # anything but a very short clip -- webm files from MediaRecorder often
    # report 0 or an unreliable number here. In that case, do a real count
    # by reading through the file once, instead of trusting the metadata.
    if reported_total <= SEQUENCE_LENGTH:
        real_total = 0
        while True:
            ret, _ = cap.read()
            if not ret:
                break
            real_total += 1

        cap.release()

        if real_total <= 0:
            raise ValueError("Video contains no readable frames.")

        total_frames = real_total
        cap = cv2.VideoCapture(video_path, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            raise ValueError("Could not reopen video: " + video_path)
    else:
        total_frames = reported_total

    skip = max(total_frames // SEQUENCE_LENGTH, 1)

    frames = []
    frame_idx = 0

    while len(frames) < SEQUENCE_LENGTH:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % skip == 0:
            frames.append(preprocess_frame(frame))
        frame_idx += 1

    cap.release()

    if len(frames) == 0:
        raise ValueError("Could not extract frames from video.")

    while len(frames) < SEQUENCE_LENGTH:
        frames.append(frames[-1].copy())

    frames = frames[:SEQUENCE_LENGTH]

    return np.array(frames, dtype=np.float32)


# ============================================================
# VIDEO PREDICTION
# ============================================================

def predict_video(video_path):

    if model is None:
        return {
            "label": "DETECTION ERROR",
            "confidence": 0,
            "status": "error",
            "error": model_error
        }

    try:
        frames = extract_frames(video_path)

        input_data = np.expand_dims(frames, axis=0)

        prediction = model.predict(input_data, verbose=0)
        prediction = np.asarray(prediction)

        if prediction.ndim == 2 and prediction.shape[1] == 2:

            normal_probability = float(prediction[0][0])
            violence_probability = float(prediction[0][1])

            if violence_probability >= normal_probability:
                label = "VIOLENCE DETECTED"
                confidence = violence_probability * 100
            else:
                label = "NO VIOLENCE"
                confidence = normal_probability * 100

        else:
            raise ValueError("Unexpected model output shape: " + str(prediction.shape))

        return {
            "label": label,
            "confidence": round(confidence, 2),
            "status": "success"
        }

    except Exception as e:
        print("Detection error:", e)
        return {
            "label": "DETECTION ERROR",
            "confidence": 0,
            "status": "error",
            "error": str(e)
        }


# ============================================================
# TEST
# ============================================================

if __name__ == "__main__":

    print("=" * 60)
    print("SENTINEL EYE DETECTOR")
    print("=" * 60)

    if model is not None:
        print("Model status: READY")
        print("Model path:", MODEL_PATH)
        print("Input shape:", model.input_shape)
        print("Output shape:", model.output_shape)
    else:
        print("Model status: NOT LOADED")
        print(model_error)

    print("=" * 60)
