"""Frame processing: face detection, eye detection, preprocessing, drowsiness analysis.

Per-frame pipeline:
    image -> grayscale -> face (Haar cascade) -> eyes (Haar cascade)
          -> eye crops -> Keras model gives P(eye closed / drowsy)

Without a trained model, an OpenCV fallback is used: the Haar eye detector
mostly finds *open* eyes, so a visible face with no eyes counts as closed.

The drowsiness score is the average eye closure over the last WINDOW_SIZE
frames, so a normal blink barely moves it but eyes kept closed raise it.
"""

import base64
import threading
from collections import deque

import cv2
import numpy as np

import alerts
import model

WINDOW_SIZE = 15        # frames in the rolling window (~3-5 s at 3-5 frames/s)
MAX_FRAME_WIDTH = 480   # larger frames are downscaled for speed

_face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
_eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")

_windows = {}              # user key -> deque of recent eye-closure values (0.0-1.0)
_lock = threading.Lock()   # frames from the dev server's threads are analyzed one at a time


def decode_image(data):
    """Decode a base64 image (optionally a data URL) into a BGR array, or None."""
    if not isinstance(data, str) or not data:
        return None
    if "," in data:  # strip "data:image/jpeg;base64,"
        data = data.split(",", 1)[1]
    try:
        raw = base64.b64decode(data, validate=True)
    except ValueError:
        return None
    return cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)


def _downscale(image):
    height, width = image.shape[:2]
    if width <= MAX_FRAME_WIDTH:
        return image
    scale = MAX_FRAME_WIDTH / width
    return cv2.resize(image, (MAX_FRAME_WIDTH, int(height * scale)))


def detect_face(gray):
    """Largest face as (x, y, w, h), or None."""
    faces = _face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    if len(faces) == 0:
        return None
    return max(faces, key=lambda f: f[2] * f[3])


def detect_eyes(gray, face):
    """Up to two eyes found in the upper part of the face, in image coordinates."""
    x, y, w, h = face
    top = y + int(h * 0.15)
    region = gray[top:y + int(h * 0.55), x:x + w]
    eyes = _eye_cascade.detectMultiScale(region, scaleFactor=1.1, minNeighbors=6, minSize=(w // 8, w // 8))
    eyes = sorted(eyes, key=lambda e: e[2] * e[3], reverse=True)[:2]
    return [(x + ex, top + ey, ew, eh) for ex, ey, ew, eh in eyes]


def estimate_eye_regions(face):
    """Eye boxes from face proportions, used when the detector finds no eyes (e.g. closed)."""
    x, y, w, h = face
    ew, eh, ey = int(w * 0.3), int(h * 0.2), y + int(h * 0.25)
    return [(x + int(w * 0.17), ey, ew, eh), (x + int(w * 0.53), ey, ew, eh)]


def preprocess_eye(image, gray, box):
    """Crop one eye and shape it for the model: resized, [0, 1] floats, (h, w, c)."""
    height, width, channels = model.input_shape()
    x, y, w, h = box
    if channels == 1:
        crop = gray[y:y + h, x:x + w]
    else:
        crop = cv2.cvtColor(image[y:y + h, x:x + w], cv2.COLOR_BGR2RGB)
    crop = cv2.resize(crop, (width, height)).astype("float32") / 255.0
    return crop.reshape(height, width, channels)


def eye_closure(image, gray, gray_eq, face):
    """How closed the eyes are in this frame, from 0.0 (open) to 1.0 (closed)."""
    eyes = detect_eyes(gray_eq, face)
    if model.is_loaded():
        boxes = eyes or estimate_eye_regions(face)
        return float(np.mean([model.predict(preprocess_eye(image, gray, box)) for box in boxes]))
    return 0.0 if eyes else 1.0


def _score(window):
    # Divide by the full window size so the score ramps up at the start
    # instead of jumping to 100% on the first closed-eye frame.
    return round(100 * sum(window) / WINDOW_SIZE)


def analyze_frame(image, key="default"):
    """Analyze one webcam frame for the given user and return the result dict."""
    image = _downscale(image)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray_eq = cv2.equalizeHist(gray)  # helps the cascades in uneven lighting

    with _lock:
        window = _windows.setdefault(key, deque(maxlen=WINDOW_SIZE))
        face = detect_face(gray_eq)
        if face is None:
            return {"status": "no_face", "score": _score(window), "eyes": "unknown",
                    "face": False, "alert": False}

        closure = eye_closure(image, gray, gray_eq, face)
        window.append(closure)
        score = _score(window)
        status = alerts.get_status(score)
        return {"status": status, "score": score, "eyes": "closed" if closure >= 0.5 else "open",
                "face": True, "alert": alerts.is_alert(status)}


def reset(key="default"):
    """Clear a user's rolling window, e.g. when detection is restarted."""
    with _lock:
        _windows.pop(key, None)
