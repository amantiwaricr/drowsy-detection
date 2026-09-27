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
