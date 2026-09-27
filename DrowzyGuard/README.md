# DrowzyGuard

Real-time driver drowsiness detection: React + Vite frontend, Flask + OpenCV +
TensorFlow/Keras backend, MongoDB storage.

> Work in progress — being built phase by phase. Setup and usage instructions
> will be added as each phase is completed.

## Structure

```text
backend/    Flask API, detection pipeline, model loading, MongoDB access
frontend/   React (Vite) web app
model/      Trained Keras model (drowsiness_model.h5) goes here
dataset/    Training images: awake/ and drowsy/
docs/       Architecture, use-case, DFD and ER diagrams
```

## Detection

Each webcam frame goes through: face detection → eye detection (OpenCV Haar
cascades) → eye crops → Keras model. The drowsiness score (0–100%) is the
average eye closure over the last 15 frames, so a normal blink barely moves it.

Status thresholds live in `backend/alerts.py` (0–30 awake, 31–60 warning,
61–100 drowsy). They are application settings, not medically validated values.

Until a trained model exists, an OpenCV fallback is used: a visible face with
no detected (open) eyes counts as closed. `/api/health` shows which mode is active.

## Training a model

1. Put **eye crop** images in `dataset/awake/` (open eyes) and `dataset/drowsy/` (closed eyes).
2. From `backend/`, run `python train.py` (options: `--epochs`, `--img-size`).
3. It prints accuracy on a held-out 20% split and saves `model/drowsiness_model.h5`.
4. Restart the backend — it loads the model automatically.
