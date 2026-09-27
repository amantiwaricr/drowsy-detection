"""TensorFlow/Keras model loading and prediction.

The model classifies a preprocessed image as AWAKE or DROWSY. Two output
formats are supported:
    - 1 unit  (sigmoid): the value is P(drowsy)
    - 2 units (softmax): [P(awake), P(drowsy)]  (alphabetical folder order)

The input size is read from the model itself, so any image size and
grayscale/colour input works. detection.py resizes images to input_shape().
"""

import os

import numpy as np

_model = None


def _model_path():
    default = os.path.join(os.path.dirname(__file__), "..", "model", "drowsiness_model.h5")
    path = os.getenv("MODEL_PATH", default)
    # Relative paths in .env are relative to the backend folder, not the cwd.
    if not os.path.isabs(path):
        path = os.path.join(os.path.dirname(__file__), path)
    return os.path.normpath(path)


def load_model():
    """Load the model once. Returns True if a model is ready, False otherwise."""
    global _model
    if _model is not None:
        return True

    path = _model_path()
    if not os.path.exists(path):
        print(f"[model] No model found at {path}. Detection will run without predictions.")
        return False

    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")  # hide TensorFlow info logs
    from tensorflow import keras  # imported here so the app starts fast without a model

    try:
        _model = keras.models.load_model(path, compile=False)
    except Exception as exc:  # corrupt or incompatible file
        print(f"[model] Failed to load {path}: {exc}")
        return False

    print(f"[model] Loaded {path} (input {input_shape()})")
    return True


def is_loaded():
    return _model is not None


def input_shape():
    """(height, width, channels) the model expects, or None if no model."""
    if _model is None:
        return None
    _, height, width, channels = _model.input_shape
    return height, width, channels


def predict(image):
    """Return P(drowsy) in [0, 1] for one preprocessed image, or None if no model.

    `image` must already match input_shape() with values scaled to [0, 1].
    """
    if _model is None:
        return None

    image = np.asarray(image, dtype="float32")
    if image.shape != input_shape():
        raise ValueError(f"Expected image shape {input_shape()}, got {image.shape}")

    # Calling the model directly is much faster than model.predict() for one image.
    output = _model(image[np.newaxis, ...], training=False).numpy()[0]
    drowsy = output[0] if output.shape[-1] == 1 else output[1]
    return float(np.clip(drowsy, 0.0, 1.0))
