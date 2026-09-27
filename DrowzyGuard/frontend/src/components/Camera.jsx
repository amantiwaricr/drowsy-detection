import { useEffect, useRef, useState } from "react";

const CAPTURE_WIDTH = 480; // frames are sent at this width to keep requests small

function cameraErrorMessage(err) {
  if (!navigator.mediaDevices) return "Camera access needs https or http://localhost.";
  switch (err?.name) {
    case "NotAllowedError":
      return "Camera permission was denied. Allow camera access in your browser and try again.";
    case "NotFoundError":
      return "No camera was found on this device.";
    case "NotReadableError":
      return "The camera is being used by another application.";
    default:
      return "Could not start the camera.";
  }
}

/**
 * Shows the webcam while `active` is true and calls `onFrame(dataUrl)` in a
 * loop. The next frame is captured only after `onFrame` resolves, so slow
 * responses never pile up.
 */
export default function Camera({ active, onFrame, onError, interval = 250 }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const onFrameRef = useRef(onFrame);
  const onErrorRef = useRef(onError);
  const [error, setError] = useState("");

  useEffect(() => {
    onFrameRef.current = onFrame;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!active) return undefined;

    const video = videoRef.current;
    let stream = null;
    let stopped = false;
    let timer = null;

    function capture() {
      if (!video.videoWidth) return null;
      const canvas = canvasRef.current;
      canvas.width = CAPTURE_WIDTH;
      canvas.height = Math.round((video.videoHeight / video.videoWidth) * CAPTURE_WIDTH);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.7);
    }

    async function loop() {
      if (stopped) return;
      const frame = capture();
      if (frame && onFrameRef.current) {
        try {
          await onFrameRef.current(frame);
        } catch {
          // The parent shows request errors; keep the loop running.
        }
      }
      if (!stopped) timer = setTimeout(loop, interval);
    }

    async function start() {
      setError("");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        if (stopped) return;
        video.srcObject = stream;
        await video.play();
        loop();
      } catch (err) {
        if (stopped) return;
        const message = cameraErrorMessage(err);
        setError(message);
        onErrorRef.current?.(message);
      }
    }

    start();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [active, interval]);

  return (
    <div className={`camera ${active && !error ? "camera-on" : ""}`}>
      <video ref={videoRef} muted playsInline />
      <canvas ref={canvasRef} hidden />
      {!active && !error && (
        <div className="camera-overlay">
          <span className="camera-icon" aria-hidden="true" />
          <p>Camera is off</p>
          <small>Press Start to begin monitoring</small>
        </div>
      )}
      {error && (
        <div className="camera-overlay camera-error">
          <p>{error}</p>
        </div>
      )}
      {active && !error && <span className="live-badge">LIVE</span>}
    </div>
  );
}
