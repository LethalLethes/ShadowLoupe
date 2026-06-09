import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ChevronRight, Eye, LockKeyhole, FlaskConical, RefreshCw, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, PASSIVE, PERMISSIONED, ADVANCED, type Category, type Sensitivity } from "@/lib/data";

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const dateStr = time.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <span className="text-xs text-muted-foreground font-mono">
      {dateStr} · {timeStr}
    </span>
  );
}

const SENSITIVITY_META: Record<Sensitivity, {
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  dotColor: string;
  blurb: string;
}> = {
  passive: {
    label: "Passive",
    shortLabel: "Passive",
    icon: Eye,
    color: "text-green-400",
    dotColor: "bg-green-400",
    blurb: "Any website can read these without a prompt and without you seeing any indicator.",
  },
  permissioned: {
    label: "Needs Permission",
    shortLabel: "Permission",
    icon: LockKeyhole,
    color: "text-orange-400",
    dotColor: "bg-orange-400",
    blurb: "The browser shows a permission prompt the first time a site asks for access.",
  },
  advanced: {
    label: "Advanced",
    shortLabel: "Advanced",
    icon: FlaskConical,
    color: "text-pink-400",
    dotColor: "bg-pink-400",
    blurb: "Clever uses of public APIs to extract more details than they were meant to give.",
  },
};

function CategoryRow({ category }: { category: Category }) {
  const Icon = category.icon;
  const meta = SENSITIVITY_META[category.sensitivity];
  return (
    <Link
      href={`/${category.id}`}
      className="flex items-center gap-4 px-4 py-3 active:bg-white/5 transition-colors cursor-pointer group"
      data-testid={`category-row-${category.id}`}
    >
      <div
        className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
          category.sensitivity === "passive" && "bg-green-400/15",
          category.sensitivity === "permissioned" && "bg-orange-400/15",
          category.sensitivity === "advanced" && "bg-pink-400/15",
        )}
      >
        <Icon className={cn("w-5 h-5", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px] text-white leading-tight">{category.title}</div>
        <div className="text-[13px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{category.subtitle}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
    </Link>
  );
}

function SectionHeader({ sensitivity }: { sensitivity: Sensitivity }) {
  const meta = SENSITIVITY_META[sensitivity];
  const Icon = meta.icon;
  return (
    <div className={cn("flex items-center gap-2 px-4 py-2", meta.color)}>
      <Icon className="w-4 h-4" />
      <span className="text-[13px] font-semibold tracking-wide uppercase">{meta.label}</span>
    </div>
  );
}

function CategorySection({ sensitivity, categories }: { sensitivity: Sensitivity; categories: Category[] }) {
  const meta = SENSITIVITY_META[sensitivity];
  return (
    <div>
      <SectionHeader sensitivity={sensitivity} />
      <div className="bg-[#1c1c1e] rounded-2xl overflow-hidden divide-y divide-white/[0.06]">
        {categories.map(cat => (
          <CategoryRow key={cat.id} category={cat} />
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground px-4 pt-2 pb-1 leading-relaxed">
        {meta.blurb}
      </p>
    </div>
  );
}

function IntroCard({ onShowSummary }: { onShowSummary: () => void }) {
  return (
    <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-white/[0.08]">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-orange-400/15 flex items-center justify-center shrink-0 mt-0.5">
          <Eye className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <div className="font-semibold text-white text-[15px] leading-tight">What websites can see</div>
          <div className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
            Each section below reads a public browser API that any website can quietly call. Tap a category to see what your device gives away, and how those values add up to a fingerprint.
          </div>
        </div>
      </div>
      <button
        onClick={onShowSummary}
        className="w-full bg-orange-500 hover:bg-orange-400 active:bg-orange-600 transition-colors text-white font-semibold rounded-xl py-2.5 text-[15px]"
        data-testid="button-see-highlights"
      >
        See the Highlights
      </button>
    </div>
  );
}

function SummarySheet({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="mt-auto bg-[#111] rounded-t-3xl max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.08]">
          <h2 className="text-[17px] font-semibold text-white">Fingerprinting Highlights</h2>
          <button onClick={onClose} className="text-orange-400 font-semibold text-[15px]" data-testid="button-summary-done">Done</button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Info className="w-8 h-8 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white text-[15px] mb-1">What is fingerprinting?</div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Fingerprinting recognizes a device by combining ordinary settings instead of relying on a tracker ID. Browser version, GPU, fonts, screen size, and timezone each narrow the pool of possible devices. Enough of them together can single yours out.
              </p>
            </div>
          </div>

          {[
            {
              icon: "🖥️",
              headline: `Your screen is ${window.screen.width}×${window.screen.height} at ${window.devicePixelRatio}× density`,
              basis: "Read from screen.width, screen.height, and devicePixelRatio — no permission needed.",
            },
            {
              icon: "🌐",
              headline: `You prefer ${navigator.language}${navigator.languages.length > 1 ? ` and ${navigator.languages.length - 1} other language${navigator.languages.length > 2 ? "s" : ""}` : ""}`,
              basis: "navigator.language and navigator.languages are sent with every page load.",
            },
            {
              icon: "🕐",
              headline: `Your timezone is ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
              basis: "Intl.DateTimeFormat().resolvedOptions().timeZone — readable by any page.",
            },
            {
              icon: "⚙️",
              headline: `Your device has ${navigator.hardwareConcurrency ?? "unknown"} CPU cores${(navigator as any).deviceMemory ? ` and ~${(navigator as any).deviceMemory} GB RAM` : ""}`,
              basis: "navigator.hardwareConcurrency and navigator.deviceMemory.",
            },
            {
              icon: "🎨",
              headline: `You prefer ${matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"} mode${matchMedia("(prefers-reduced-motion: reduce)").matches ? " with reduced motion" : ""}`,
              basis: "CSS media queries — available without any prompt.",
            },
          ].map((item, i) => (
            <div key={i} className="bg-[#1c1c1e] rounded-xl p-4 border border-white/[0.06]">
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">{item.icon}</span>
                <div>
                  <div className="font-semibold text-white text-[14px] leading-snug">{item.headline}</div>
                  <div className="text-[12px] text-muted-foreground mt-1">{item.basis}</div>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-[#1c1c1e] rounded-xl p-4 border border-white/[0.06]">
            <div className="flex items-start gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <div className="font-semibold text-white text-[14px]">Put it together</div>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              None of these readings are a name or an account. But together, they can be distinctive enough to recognize your device again. When a tracker sees the same combination twice, it can link those sessions across sites or days.
            </p>
            <p className="text-[12px] text-white/30 mt-3">
              This app reads all of this locally. Nothing is uploaded, synced, or shared.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Home() {
  const [showSummary, setShowSummary] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = () => {
    setSpinning(true);
    setRefreshKey(k => k + 1);
    setTimeout(() => setSpinning(false), 700);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-lg mx-auto px-4 py-6 pb-20">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] font-bold tracking-tight text-white">Loupe</h1>
            <LiveClock />
          </div>
          <button
            onClick={handleRefresh}
            className="w-9 h-9 rounded-full bg-[#1c1c1e] flex items-center justify-center text-white/60 hover:text-white transition-colors"
            data-testid="button-refresh"
          >
            <RefreshCw className={cn("w-4 h-4 transition-transform", spinning && "animate-spin")} />
          </button>
        </div>

        <div key={refreshKey} className="flex flex-col gap-6">
          <IntroCard onShowSummary={() => setShowSummary(true)} />

          <CategorySection sensitivity="passive" categories={PASSIVE} />
          <CategorySection sensitivity="permissioned" categories={PERMISSIONED} />
          <CategorySection sensitivity="advanced" categories={ADVANCED} />
        </div>
      </div>

      {showSummary && <SummarySheet onClose={() => setShowSummary(false)} />}
    </div>
  );
}
