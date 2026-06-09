import { useParams, useLocation } from "wouter";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Eye, LockKeyhole, FlaskConical, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, type Signal, type Sensitivity } from "@/lib/data";
import NotFound from "./not-found";

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
      {/* Signal name */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-semibold text-[14px] text-white/90 leading-snug font-mono">{signal.name}</span>
        <CopyButton text={signal.value} />
      </div>

      {/* Value */}
      {!hasEntries && (
        <div className={cn(
          "font-mono text-[13px] text-green-300 leading-relaxed break-all",
          isLong && "text-[11px]"
        )}>
          {signal.value}
        </div>
      )}

      {/* Key-value entries */}
      {hasEntries && (
        <div className="flex flex-col gap-0.5 mt-1">
          {signal.entries!.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              {e.label && (
                <span className="text-[12px] text-white/40 shrink-0 w-28 truncate">{e.label}</span>
              )}
              <span className="font-mono text-[12px] text-green-300 break-all">{e.value || signal.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Rationale */}
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

  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

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
            <div className="flex-1" />
          </div>
        </div>

        {/* Category hero */}
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

        {/* Signal list */}
        <div className="mt-2">
          <div className="mx-4 bg-[#1c1c1e] rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
            {loading ? (
              <LoadingRows />
            ) : signals && signals.length > 0 ? (
              signals.map((s, i) => (
                <SignalRow key={s.id} signal={s} index={i} />
              ))
            ) : (
              <div className="px-4 py-8 text-center text-muted-foreground text-[14px]">
                No signals collected.
              </div>
            )}
          </div>
        </div>

        {/* Privacy note */}
        <p className="text-[11px] text-white/20 text-center px-6 mt-5 leading-relaxed">
          All data is read locally in your browser. Nothing is transmitted or stored outside this page.
        </p>
      </div>
    </div>
  );
}
