import { useEffect, useRef, useState } from "react";

async function detectQrFromImage(file) {
  if (!file || !("BarcodeDetector" in window)) return "";
  const bitmap = await createImageBitmap(file);
  try {
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    const codes = await detector.detect(bitmap);
    return String(codes[0]?.rawValue || "").trim();
  } finally {
    bitmap.close?.();
  }
}

function Corner({ className }) {
  return (
    <span
      className={`pointer-events-none absolute h-8 w-8 border-[#A3E635] ${className}`}
      aria-hidden
    />
  );
}

export default function QrScanModal({
  open,
  onClose,
  onScan,
  title = "Scan any QR",
  error = "",
  hint = "Align the QR inside the frame",
  actionLabel = "Use",
}) {
  const [raw, setRaw] = useState("");
  const [camError, setCamError] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const fileRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!open) return undefined;
    setRaw("");
    setCamError("");
    setTorchOn(false);
    setTorchOk(false);
    setPasteOpen(false);
    let active = true;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError("Camera unavailable. Upload a QR photo or paste the value.");
        setPasteOpen(true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = track.getCapabilities?.() || {};
        setTorchOk(Boolean(caps.torch));
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (!("BarcodeDetector" in window)) {
          setCamError("Live scan needs Chrome or Edge. Use Upload QR or paste.");
          return;
        }
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        let found = false;
        const tick = async () => {
          if (!active || !videoRef.current || found) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              found = true;
              onScanRef.current(codes[0].rawValue);
              return;
            }
          } catch {
            /* keep scanning */
          }
          if (active && !found) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch {
        setCamError("Camera permission denied. Upload a QR photo or paste the value.");
        setPasteOpen(true);
      }
    };
    start();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      trackRef.current = null;
    };
  }, [open]);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track || !torchOk) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      setTorchOn(false);
    }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const value = await detectQrFromImage(file);
      if (value) {
        onScan(value);
        return;
      }
      setCamError("Could not read a QR from that photo. Try another or paste.");
      setPasteOpen(true);
    } catch {
      setCamError("Could not read that photo. Paste the scanned QR below.");
      setPasteOpen(true);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-black" role="dialog" aria-modal="true" aria-label={title}>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        playsInline
        autoPlay
      />

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start gap-3 bg-black/55 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center text-white"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-[17px] font-bold leading-tight text-white">{title || "Scan any QR"}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-white/80">{hint}</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden px-8">
          <div
            className="relative aspect-square w-[min(72vw,18.5rem)] rounded-[1.35rem]"
            style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
          >
            <Corner className="left-0 top-0 rounded-tl-[1.1rem] border-l-[5px] border-t-[5px]" />
            <Corner className="right-0 top-0 rounded-tr-[1.1rem] border-r-[5px] border-t-[5px]" />
            <Corner className="bottom-0 left-0 rounded-bl-[1.1rem] border-b-[5px] border-l-[5px]" />
            <Corner className="bottom-0 right-0 rounded-br-[1.1rem] border-b-[5px] border-r-[5px]" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-5 bg-black/55 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {error ? <p className="max-w-xs text-center text-[12px] font-semibold text-red-300">{error}</p> : null}
          {camError ? <p className="max-w-xs text-center text-[12px] text-white/80">{camError}</p> : null}

          <div className="flex items-start justify-center gap-10">
            <button type="button" className="flex w-20 flex-col items-center gap-2 text-white" onClick={() => fileRef.current?.click()}>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="8.5" cy="10" r="1.4" fill="currentColor" stroke="none" />
                  <path d="M21 16l-5.5-5.5L8 18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-[12px] font-medium">Upload QR</span>
            </button>
            <button type="button" className="flex w-20 flex-col items-center gap-2 text-white disabled:opacity-40" onClick={toggleTorch} disabled={!torchOk}>
              <span className={`flex h-14 w-14 items-center justify-center rounded-full ring-1 ring-white/25 backdrop-blur-sm ${torchOn ? "bg-amber-400 text-black" : "bg-white/15"}`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M9 2h6l-1 7h4L8 22l2-9H7L9 2z" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-[12px] font-medium">Torch</span>
            </button>
          </div>

          <button type="button" className="text-[12px] font-semibold text-white/80 underline-offset-2 hover:underline" onClick={() => setPasteOpen((v) => !v)}>
            {pasteOpen ? "Hide paste" : "Paste QR instead"}
          </button>

          {pasteOpen ? (
            <div className="flex w-full max-w-sm gap-2">
              <input
                className="min-h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-xs text-white outline-none placeholder:text-white/45"
                placeholder="greengrocc:batch:… or greengrocc:order:…"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
              />
              <button
                type="button"
                disabled={!raw.trim()}
                className="rounded-xl bg-[#217346] px-4 text-xs font-semibold text-white disabled:opacity-50"
                onClick={() => onScan(raw.trim())}
              >
                {actionLabel}
              </button>
            </div>
          ) : null}

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
        </div>
      </div>
    </div>
  );
}
