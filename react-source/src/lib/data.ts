import {
  Smartphone, Cpu, BatteryMedium, HardDrive, Monitor,
  Volume2, Globe, Accessibility, ClipboardList, Activity,
  Wifi, Type, MessageSquare, AppWindow, Layers, Zap,
  MapPin, Camera, Bluetooth, Navigation,
  Fingerprint, RotateCcw, Grid3x3,
} from "lucide-react";

export type Sensitivity = "passive" | "permissioned" | "advanced";

export interface SignalEntry {
  label: string;
  value: string;
}

export interface Signal {
  id: string;
  name: string;
  value: string;
  rationale: string;
  entries?: SignalEntry[];
}

export interface Category {
  id: string;
  sensitivity: Sensitivity;
  icon: any;
  title: string;
  subtitle: string;
  collect: () => Promise<Signal[]>;
}

// ─── Passive ────────────────────────────────────────────────────────────────

const deviceIdentity: Category = {
  id: "device-identity",
  sensitivity: "passive",
  icon: Smartphone,
  title: "Device Identity",
  subtitle: "Vendor ID and hardware identifiers",
  collect: async () => [
    {
      id: "userAgent",
      name: "navigator.userAgent",
      value: navigator.userAgent,
      rationale: "Full browser/OS version string sent with every request. Often the single most identifying piece of data.",
    },
    {
      id: "platform",
      name: "navigator.platform",
      value: navigator.platform || "not reported",
      rationale: "Reports the OS platform (e.g., 'Win32', 'MacIntel', 'iPhone'). Narrows device type immediately.",
    },
    {
      id: "vendor",
      name: "navigator.vendor",
      value: navigator.vendor || "(empty)",
      rationale: "Browser vendor string. Combined with userAgent, confirms which rendering engine is in use.",
    },
    {
      id: "appVersion",
      name: "navigator.appVersion",
      value: navigator.appVersion || "not reported",
      rationale: "Legacy browser version string. Duplicates much of the userAgent.",
    },
    {
      id: "product",
      name: "navigator.product",
      value: navigator.product || "not reported",
      rationale: "Always 'Gecko' in browsers that expose it — a compatibility artefact.",
    },
    {
      id: "cookieEnabled",
      name: "navigator.cookieEnabled",
      value: String(navigator.cookieEnabled),
      rationale: "Whether cookies are enabled. A 'false' reading is itself rare and identifying.",
    },
    {
      id: "javaEnabled",
      name: "navigator.javaEnabled()",
      value: typeof (navigator as any).javaEnabled === "function"
        ? String((navigator as any).javaEnabled())
        : "not supported",
      rationale: "Java plug-in status. Almost always false today, but the presence of the method varies.",
    },
  ],
};

const systemInfo: Category = {
  id: "system-info",
  sensitivity: "passive",
  icon: Cpu,
  title: "System Info",
  subtitle: "Kernel, runtime, and OS state",
  collect: async () => {
    const mem = (performance as any).memory;
    const uptime = Math.floor(performance.now() / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const secs = uptime % 60;

    const signals: Signal[] = [
      {
        id: "hardwareConcurrency",
        name: "navigator.hardwareConcurrency",
        value: String(navigator.hardwareConcurrency ?? "not reported"),
        rationale: "Number of logical CPU cores. Distinguishes low-end from high-end devices.",
      },
      {
        id: "deviceMemory",
        name: "navigator.deviceMemory",
        value: (navigator as any).deviceMemory != null
          ? `${(navigator as any).deviceMemory} GB`
          : "not reported",
        rationale: "Approximate device RAM rounded to the nearest power of two. Maps to device tier.",
      },
      {
        id: "pageUptime",
        name: "Page uptime",
        value: `${hours}h ${minutes}m ${secs}s`,
        rationale: "How long this page has been open, from performance.now(). Changes slowly during a session.",
      },
    ];

    if (mem) {
      signals.push({
        id: "jsHeap",
        name: "JS heap (used / total)",
        value: `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB / ${(mem.totalJSHeapSize / 1024 / 1024).toFixed(1)} MB`,
        rationale: "Current JavaScript heap usage. Non-standard but exposed by Chrome-based browsers.",
        entries: [
          { label: "Used", value: `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB` },
          { label: "Total", value: `${(mem.totalJSHeapSize / 1024 / 1024).toFixed(1)} MB` },
          { label: "Limit", value: `${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(1)} MB` },
        ],
      });
    }

    signals.push({
      id: "doNotTrack",
      name: "navigator.doNotTrack",
      value: navigator.doNotTrack ?? "not set",
      rationale: "Your Do Not Track preference — a signal websites typically ignore, but its value is still visible.",
    });

    return signals;
  },
};

const battery: Category = {
  id: "battery",
  sensitivity: "passive",
  icon: BatteryMedium,
  title: "Battery & Power",
  subtitle: "Charge, power, and thermal state",
  collect: async () => {
    const nav = navigator as any;
    if (!nav.getBattery) {
      return [{
        id: "unavailable",
        name: "Battery API",
        value: "Not available",
        rationale: "This browser has removed the Battery Status API for privacy. Firefox and Safari block it.",
      }];
    }
    try {
      const b = await nav.getBattery();
      const level = b.level >= 0 ? `${Math.round(b.level * 100)}%` : "unknown";
      const state = b.charging ? "Charging" : (b.level === 1 ? "Full" : "Discharging");
      return [
        {
          id: "batteryLevel",
          name: "Battery level & state",
          value: `${level} — ${state}`,
          rationale: "Battery level changes slowly and can be correlated across visits within the same session.",
          entries: [
            { label: "Level", value: level },
            { label: "State", value: state },
          ],
        },
        {
          id: "chargingTime",
          name: "chargingTime",
          value: isFinite(b.chargingTime) ? `${b.chargingTime}s` : "Infinity",
          rationale: "Seconds until fully charged. Infinity means not charging or already full.",
        },
        {
          id: "dischargingTime",
          name: "dischargingTime",
          value: isFinite(b.dischargingTime) ? `${b.dischargingTime}s` : "Infinity",
          rationale: "Estimated seconds of battery life remaining.",
        },
      ];
    } catch {
      return [{
        id: "error",
        name: "Battery API",
        value: "Access denied",
        rationale: "Browser supports the API but blocked access.",
      }];
    }
  },
};

const storage: Category = {
  id: "storage",
  sensitivity: "passive",
  icon: HardDrive,
  title: "Storage",
  subtitle: "Volume capacity and metadata",
  collect: async () => {
    const signals: Signal[] = [];

    if (navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const usedMB = est.usage != null ? (est.usage / 1024 / 1024).toFixed(1) : "?";
        const quotaMB = est.quota != null ? (est.quota / 1024 / 1024).toFixed(0) : "?";
        signals.push({
          id: "storageEstimate",
          name: "Storage estimate",
          value: `${usedMB} MB used of ${quotaMB} MB quota`,
          rationale: "Origin storage consumption. The quota size varies by device storage capacity.",
          entries: [
            { label: "Used", value: `${usedMB} MB` },
            { label: "Quota", value: `${quotaMB} MB` },
          ],
        });
      } catch {
        signals.push({ id: "storageError", name: "Storage estimate", value: "Unavailable", rationale: "" });
      }
    }

    try {
      const testKey = "__loupe_test__";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      signals.push({
        id: "localStorage",
        name: "localStorage",
        value: "Available",
        rationale: "Persistent key-value store that survives page reloads and browser restarts.",
      });
      signals.push({
        id: "localStorageItems",
        name: "localStorage item count",
        value: String(localStorage.length),
        rationale: "Number of items this origin has stored. A higher count can hint at prior activity.",
      });
    } catch {
      signals.push({ id: "localStorage", name: "localStorage", value: "Blocked", rationale: "Private browsing or user setting." });
    }

    signals.push({
      id: "sessionStorage",
      name: "sessionStorage",
      value: (() => { try { sessionStorage.setItem("__t__", "1"); sessionStorage.removeItem("__t__"); return "Available"; } catch { return "Blocked"; } })(),
      rationale: "Per-tab storage that is cleared when the tab closes.",
    });

    signals.push({
      id: "indexedDB",
      name: "indexedDB",
      value: typeof indexedDB !== "undefined" ? "Available" : "Not available",
      rationale: "Structured client-side database. Can store megabytes of data persistently.",
    });

    signals.push({
      id: "cacheAPI",
      name: "Cache API",
      value: typeof caches !== "undefined" ? "Available" : "Not available",
      rationale: "Service Worker cache storage — used by PWAs to store assets offline.",
    });

    return signals;
  },
};

const display: Category = {
  id: "display",
  sensitivity: "passive",
  icon: Monitor,
  title: "Display",
  subtitle: "Screen specs and rendering capabilities",
  collect: async () => {
    const s = window.screen;
    const signals: Signal[] = [
      {
        id: "resolution",
        name: "Native resolution",
        value: `${s.width}×${s.height}`,
        rationale: "Physical screen dimensions. Together with devicePixelRatio, pins the exact screen model.",
        entries: [
          { label: "Width", value: `${s.width}` },
          { label: "Height", value: `${s.height}` },
        ],
      },
      {
        id: "availSize",
        name: "Available size",
        value: `${s.availWidth}×${s.availHeight}`,
        rationale: "Screen area minus OS chrome (taskbar, dock). Reveals OS layout choices.",
      },
      {
        id: "devicePixelRatio",
        name: "devicePixelRatio",
        value: String(window.devicePixelRatio),
        rationale: "CSS pixel to physical pixel ratio. @2x means Retina/HiDPI; @3x is typical on modern phones.",
      },
      {
        id: "colorDepth",
        name: "colorDepth",
        value: `${s.colorDepth}-bit`,
        rationale: "Bits per pixel the display supports. Almost always 24 or 30.",
      },
      {
        id: "pixelDepth",
        name: "pixelDepth",
        value: `${s.pixelDepth}-bit`,
        rationale: "Bits actually used per pixel. Matches colorDepth on most displays.",
      },
      {
        id: "orientation",
        name: "Orientation",
        value: screen.orientation?.type ?? "not reported",
        rationale: "Portrait or landscape. Useful for fingerprinting mobile devices.",
      },
      {
        id: "windowSize",
        name: "Window size (inner)",
        value: `${window.innerWidth}×${window.innerHeight}`,
        rationale: "Current viewport size. Varies with window arrangement — a soft signal.",
        entries: [
          { label: "Width", value: `${window.innerWidth}` },
          { label: "Height", value: `${window.innerHeight}` },
        ],
      },
      {
        id: "colorGamut",
        name: "Color gamut",
        value: (() => {
          if (matchMedia("(color-gamut: rec2020)").matches) return "rec2020";
          if (matchMedia("(color-gamut: p3)").matches) return "p3";
          if (matchMedia("(color-gamut: srgb)").matches) return "sRGB";
          return "unknown";
        })(),
        rationale: "Display color gamut (sRGB, P3, Rec2020). P3 indicates newer or premium displays.",
      },
      {
        id: "hdr",
        name: "HDR support",
        value: matchMedia("(dynamic-range: high)").matches ? "High (HDR)" : "Standard (SDR)",
        rationale: "Whether the display supports High Dynamic Range content.",
      },
    ];
    return signals;
  },
};

const audio: Category = {
  id: "audio",
  sensitivity: "passive",
  icon: Volume2,
  title: "Audio",
  subtitle: "Audio routes and capabilities",
  collect: async () => {
    const signals: Signal[] = [];
    try {
      const ctx = new AudioContext();
      signals.push({
        id: "sampleRate",
        name: "Hardware sample rate",
        value: `${ctx.sampleRate} Hz`,
        rationale: "The audio hardware's native sample rate. Correlates with device class.",
      });
      signals.push({
        id: "state",
        name: "AudioContext state",
        value: ctx.state,
        rationale: "Current state of the audio context (running / suspended / closed).",
      });
      signals.push({
        id: "baseLatency",
        name: "baseLatency",
        value: ctx.baseLatency != null ? `${ctx.baseLatency.toFixed(4)}s` : "not reported",
        rationale: "The minimum audio output latency. Varies by device audio hardware.",
      });
      ctx.close();
    } catch {
      signals.push({ id: "audioError", name: "Web Audio API", value: "Unavailable", rationale: "Could not create AudioContext." });
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioIn = devices.filter(d => d.kind === "audioinput").length;
      const audioOut = devices.filter(d => d.kind === "audiooutput").length;
      signals.push({
        id: "inputDevices",
        name: "Audio inputs",
        value: `${audioIn}`,
        rationale: "Number of audio input devices (microphones). Labels are hidden without permission.",
      });
      signals.push({
        id: "outputDevices",
        name: "Audio outputs",
        value: `${audioOut}`,
        rationale: "Number of audio output devices (speakers, headphones). Labels are hidden without permission.",
      });
    } catch {
      signals.push({ id: "devicesError", name: "Audio devices", value: "Unavailable", rationale: "enumerateDevices() blocked." });
    }

    return signals;
  },
};

const locale: Category = {
  id: "locale",
  sensitivity: "passive",
  icon: Globe,
  title: "Locale & Region",
  subtitle: "Language, region, and time settings",
  collect: async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions();
    const date = new Date(2026, 4, 27);
    const fmt = new Intl.DateTimeFormat(navigator.language, { year: "numeric", month: "2-digit", day: "2-digit" });

    return [
      {
        id: "language",
        name: "navigator.language",
        value: navigator.language,
        rationale: "Primary language preference. Reported with every page load.",
      },
      {
        id: "languages",
        name: "navigator.languages",
        value: navigator.languages.join(", "),
        rationale: "Ordered list of preferred languages. Fewer than 500 common combinations account for most users.",
        entries: navigator.languages.map(l => ({ label: l, value: "" })),
      },
      {
        id: "timezone",
        name: "Time zone",
        value: tz.timeZone,
        rationale: "Narrows your location to a geographic band. Combined with language, it often pinpoints a country.",
      },
      {
        id: "tzOffset",
        name: "UTC offset",
        value: (() => {
          const off = -new Date().getTimezoneOffset();
          const sign = off >= 0 ? "+" : "";
          const h = Math.floor(Math.abs(off) / 60);
          const m = Math.abs(off) % 60;
          return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
        })(),
        rationale: "Offset from UTC in hours and minutes. Changes with DST transitions.",
      },
      {
        id: "calendar",
        name: "Calendar system",
        value: tz.calendar,
        rationale: "Preferred calendar (Gregorian, Buddhist, Islamic, etc.).",
      },
      {
        id: "hourCycle",
        name: "Hour cycle",
        value: tz.hourCycle ?? "not reported",
        rationale: "12-hour or 24-hour preference. Deviating from the regional default is unusual.",
      },
      {
        id: "dateFormat",
        name: "Date format",
        value: fmt.format(date),
        rationale: "How a sample date renders in your locale (e.g., 27/05/2026 vs. 05/27/2026).",
      },
      {
        id: "numberFormat",
        name: "Number format",
        value: new Intl.NumberFormat(navigator.language).format(1234567.89),
        rationale: "Decimal separator and thousands grouping reveal regional settings.",
      },
    ];
  },
};

const accessibility: Category = {
  id: "accessibility",
  sensitivity: "passive",
  icon: Accessibility,
  title: "Accessibility",
  subtitle: "System accessibility flags",
  collect: async () => [
    {
      id: "colorScheme",
      name: "Color scheme",
      value: matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light",
      rationale: "Light or dark mode preference. An uncommon setting can be identifying.",
    },
    {
      id: "reducedMotion",
      name: "prefers-reduced-motion",
      value: matchMedia("(prefers-reduced-motion: reduce)").matches ? "Reduce" : "No preference",
      rationale: "Whether you have reduced motion turned on. An accessibility setting most users leave off.",
    },
    {
      id: "reducedTransparency",
      name: "prefers-reduced-transparency",
      value: matchMedia("(prefers-reduced-transparency: reduce)").matches ? "Reduce" : "No preference",
      rationale: "Reduces blur and glass effects in the UI.",
    },
    {
      id: "contrast",
      name: "prefers-contrast",
      value: (() => {
        if (matchMedia("(prefers-contrast: more)").matches) return "More";
        if (matchMedia("(prefers-contrast: less)").matches) return "Less";
        if (matchMedia("(prefers-contrast: forced)").matches) return "Forced";
        return "No preference";
      })(),
      rationale: "High or low contrast preference. Enabled by a small minority of users.",
    },
    {
      id: "forcedColors",
      name: "forced-colors",
      value: matchMedia("(forced-colors: active)").matches ? "Active" : "None",
      rationale: "Windows High Contrast mode. Very unusual and highly identifying.",
    },
    {
      id: "invertedColors",
      name: "inverted-colors",
      value: matchMedia("(inverted-colors: inverted)").matches ? "Inverted" : "None",
      rationale: "Smart Invert or classic Invert Colors setting.",
    },
    {
      id: "pointer",
      name: "Pointer type",
      value: (() => {
        if (matchMedia("(pointer: coarse)").matches) return "Coarse (touch)";
        if (matchMedia("(pointer: fine)").matches) return "Fine (mouse)";
        return "None";
      })(),
      rationale: "Touch screen vs. mouse/trackpad. Distinguishes mobile from desktop.",
    },
    {
      id: "hoverCapability",
      name: "Hover capability",
      value: matchMedia("(hover: hover)").matches ? "Hover supported" : "No hover",
      rationale: "Whether the primary pointer can hover. False on most touchscreens.",
    },
  ],
};

const clipboard: Category = {
  id: "clipboard",
  sensitivity: "passive",
  icon: ClipboardList,
  title: "Clipboard",
  subtitle: "Clipboard activity and content types",
  collect: async () => {
    const signals: Signal[] = [];

    if (navigator.clipboard) {
      signals.push({
        id: "clipboardAPI",
        name: "Clipboard API",
        value: "Available",
        rationale: "The async Clipboard API is present. Reading content still requires a permission prompt.",
      });

      try {
        const perm = await navigator.permissions.query({ name: "clipboard-read" as PermissionName });
        signals.push({
          id: "clipboardReadPerm",
          name: "clipboard-read permission",
          value: perm.state,
          rationale: "Whether this site has been granted read access to your clipboard.",
        });
      } catch {
        signals.push({ id: "clipboardReadPerm", name: "clipboard-read permission", value: "query not supported", rationale: "" });
      }
    } else {
      signals.push({ id: "clipboardAPI", name: "Clipboard API", value: "Not available", rationale: "Older browser or blocked context." });
    }

    signals.push({
      id: "execCommandCopy",
      name: "execCommand('copy') support",
      value: document.queryCommandSupported?.("copy") ? "Supported" : "Not supported",
      rationale: "Legacy clipboard write method. Presence indicates older browser compatibility layer.",
    });

    return signals;
  },
};

const deviceMotion: Category = {
  id: "device-motion",
  sensitivity: "passive",
  icon: Activity,
  title: "Device Motion",
  subtitle: "Accelerometer, gyro, and orientation sensors",
  collect: async () => {
    const signals: Signal[] = [
      {
        id: "deviceMotionEvent",
        name: "DeviceMotionEvent",
        value: typeof DeviceMotionEvent !== "undefined" ? "Supported" : "Not supported",
        rationale: "Indicates whether the browser exposes the motion sensor API at all.",
      },
      {
        id: "deviceOrientationEvent",
        name: "DeviceOrientationEvent",
        value: typeof DeviceOrientationEvent !== "undefined" ? "Supported" : "Not supported",
        rationale: "Whether orientation events (alpha, beta, gamma) are available.",
      },
    ];

    if (typeof DeviceMotionEvent !== "undefined" && typeof (DeviceMotionEvent as any).requestPermission === "function") {
      signals.push({
        id: "iosPermission",
        name: "iOS permission gate",
        value: "Required (iOS 13+)",
        rationale: "On iOS 13+, accessing motion sensors requires an explicit user permission prompt.",
      });
    } else if (typeof DeviceMotionEvent !== "undefined") {
      signals.push({
        id: "iosPermission",
        name: "iOS permission gate",
        value: "Not required on this platform",
        rationale: "This platform exposes motion data without an explicit permission prompt.",
      });
    }

    signals.push({
      id: "screenOrientation",
      name: "screen.orientation.angle",
      value: screen.orientation?.angle != null ? `${screen.orientation.angle}°` : "not reported",
      rationale: "Current screen rotation angle. 0° is portrait, 90°/270° is landscape.",
    });

    return signals;
  },
};

const network: Category = {
  id: "network",
  sensitivity: "passive",
  icon: Wifi,
  title: "Network",
  subtitle: "Interfaces, addresses, and connection signals",
  collect: async () => {
    const conn = (navigator as any).connection ?? (navigator as any).mozConnection ?? (navigator as any).webkitConnection;
    const signals: Signal[] = [
      {
        id: "onLine",
        name: "navigator.onLine",
        value: String(navigator.onLine),
        rationale: "Whether the browser believes it has network access. Not always accurate.",
      },
    ];

    if (conn) {
      if (conn.effectiveType) {
        signals.push({
          id: "effectiveType",
          name: "effectiveType",
          value: conn.effectiveType,
          rationale: "Estimated connection quality: slow-2g, 2g, 3g, or 4g. Inferred from RTT and bandwidth.",
        });
      }
      if (conn.type) {
        signals.push({
          id: "type",
          name: "Connection type",
          value: conn.type,
          rationale: "Physical connection type (wifi, cellular, ethernet, etc.).",
        });
      }
      if (conn.downlink != null) {
        signals.push({
          id: "downlink",
          name: "downlink",
          value: `${conn.downlink} Mbps`,
          rationale: "Estimated download bandwidth. Rounds to the nearest 25 Kbps for privacy.",
        });
      }
      if (conn.rtt != null) {
        signals.push({
          id: "rtt",
          name: "rtt",
          value: `${conn.rtt} ms`,
          rationale: "Estimated round-trip latency. Rounds to the nearest 25 ms.",
        });
      }
      if (conn.saveData != null) {
        signals.push({
          id: "saveData",
          name: "saveData",
          value: String(conn.saveData),
          rationale: "Whether Data Saver mode is enabled. Unusual and identifying when true.",
        });
      }
    } else {
      signals.push({
        id: "networkInfo",
        name: "Network Information API",
        value: "Not available",
        rationale: "Safari and Firefox do not expose the Network Information API.",
      });
    }

    signals.push({
      id: "maxTouchPoints",
      name: "maxTouchPoints",
      value: String(navigator.maxTouchPoints),
      rationale: "Maximum simultaneous touch points. 0 = desktop, ≥1 = touch device.",
    });

    return signals;
  },
};

const fonts: Category = {
  id: "fonts",
  sensitivity: "passive",
  icon: Type,
  title: "Fonts",
  subtitle: "Installed fonts",
  collect: async () => {
    const signals: Signal[] = [];

    if (document.fonts) {
      await document.fonts.ready;
      const loaded: string[] = [];
      document.fonts.forEach(f => {
        if (f.status === "loaded") loaded.push(f.family);
      });
      const unique = [...new Set(loaded)].sort();
      signals.push({
        id: "pageLoadedFonts",
        name: "Fonts loaded by page",
        value: `${unique.length}`,
        rationale: "Fonts the current page has loaded. Includes system defaults and any web fonts.",
      });
      if (unique.length > 0) {
        signals.push({
          id: "fontList",
          name: "Loaded font families",
          value: unique.join(", "),
          rationale: "Full list of fonts currently loaded. Custom fonts reveal app or OS configuration.",
          entries: unique.map(f => ({ label: f, value: "" })),
        });
      }
    }

    const probeFonts = [
      "Arial", "Helvetica", "Times New Roman", "Courier New", "Verdana",
      "Georgia", "Palatino", "Garamond", "Bookman", "Comic Sans MS",
      "Trebuchet MS", "Arial Black", "Impact", "Lucida Sans Unicode",
      "Tahoma", "Geneva", "Monaco", "Optima", "Futura", "Gill Sans",
    ];

    const detected: string[] = [];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      for (const font of probeFonts) {
        ctx.font = `16px '${font}', monospace`;
        const w1 = ctx.measureText("mmmmmmmmmml").width;
        ctx.font = "16px monospace";
        const w2 = ctx.measureText("mmmmmmmmmml").width;
        if (w1 !== w2) detected.push(font);
      }
      signals.push({
        id: "detectedFonts",
        name: "System fonts detected",
        value: `${detected.length} of ${probeFonts.length} probed`,
        rationale: "Canvas-based font detection. A distinctive combination of installed fonts is a classic fingerprint.",
        entries: detected.map(f => ({ label: f, value: "" })),
      });
    }

    return signals;
  },
};

const voices: Category = {
  id: "voices",
  sensitivity: "passive",
  icon: MessageSquare,
  title: "Installed Voices",
  subtitle: "Installed text-to-speech voices",
  collect: async () => {
    const getVoices = (): Promise<SpeechSynthesisVoice[]> =>
      new Promise(resolve => {
        const list = speechSynthesis.getVoices();
        if (list.length > 0) return resolve(list);
        speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
        setTimeout(() => resolve(speechSynthesis.getVoices()), 1000);
      });

    if (!("speechSynthesis" in window)) {
      return [{ id: "unavailable", name: "speechSynthesis", value: "Not available", rationale: "This browser does not support the Web Speech API." }];
    }

    const all = await getVoices();
    if (all.length === 0) {
      return [{ id: "noVoices", name: "Voices", value: "0 found", rationale: "No voices were returned. Browser may be restricting access." }];
    }

    const locals = all.filter(v => v.localService);
    const remote = all.filter(v => !v.localService);
    const langs = [...new Set(all.map(v => v.lang))].sort();

    return [
      {
        id: "totalVoices",
        name: "Total voices",
        value: `${all.length}`,
        rationale: "Total number of TTS voices installed. Varies by OS, version, and user downloads.",
      },
      {
        id: "localVoices",
        name: "Local voices",
        value: `${locals.length}`,
        rationale: "On-device voices don't require internet. Their count reflects OS version and language packs.",
      },
      {
        id: "remoteVoices",
        name: "Remote (cloud) voices",
        value: `${remote.length}`,
        rationale: "Cloud voices require connectivity. Their presence indicates browser-specific features.",
      },
      {
        id: "languages",
        name: "Languages covered",
        value: `${langs.length}: ${langs.slice(0, 6).join(", ")}${langs.length > 6 ? "…" : ""}`,
        rationale: "Number of distinct language codes across all voices.",
        entries: langs.map(l => ({ label: l, value: "" })),
      },
    ];
  },
};

const appBundle: Category = {
  id: "app-bundle",
  sensitivity: "passive",
  icon: AppWindow,
  title: "Browser & Tab",
  subtitle: "App build and session info",
  collect: async () => [
    {
      id: "href",
      name: "window.location.href",
      value: window.location.href,
      rationale: "The full URL of the current page, including any query parameters or hash.",
    },
    {
      id: "origin",
      name: "window.location.origin",
      value: window.location.origin,
      rationale: "Protocol and hostname. Defines the security origin.",
    },
    {
      id: "referrer",
      name: "document.referrer",
      value: document.referrer || "(none)",
      rationale: "The URL of the page that linked here. Absent in incognito or direct navigation.",
    },
    {
      id: "historyLength",
      name: "history.length",
      value: String(history.length),
      rationale: "Number of entries in the browser session history. Reveals how many pages were visited before this one.",
    },
    {
      id: "scriptOrigin",
      name: "Script origin",
      value: window.location.origin,
      rationale: "Where this script is loaded from.",
    },
    {
      id: "cookieEnabled",
      name: "Cookies enabled",
      value: String(navigator.cookieEnabled),
      rationale: "Whether cookies are permitted in this browser context.",
    },
    {
      id: "pdfViewer",
      name: "PDF viewer plugin",
      value: navigator.pdfViewerEnabled != null ? String(navigator.pdfViewerEnabled) : "not reported",
      rationale: "Whether the browser has a built-in PDF viewer.",
    },
  ],
};

const graphics: Category = {
  id: "graphics",
  sensitivity: "passive",
  icon: Layers,
  title: "Graphics & WebGL",
  subtitle: "GPU details and capabilities",
  collect: async () => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl") as WebGLRenderingContext | null;

    if (!gl) {
      return [{ id: "noWebgl", name: "WebGL", value: "Not available", rationale: "This browser or context does not support WebGL." }];
    }

    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const version = gl.getParameter(gl.VERSION);
    const shadingVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxVaryings = gl.getParameter(gl.MAX_VARYING_VECTORS);
    const maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    const extensions = gl.getSupportedExtensions() ?? [];

    return [
      {
        id: "vendor",
        name: "Vendor (unmasked)",
        value: vendor ?? "unknown",
        rationale: "GPU vendor string. Reveals GPU manufacturer — essential for fingerprinting graphics hardware.",
      },
      {
        id: "renderer",
        name: "Renderer (unmasked)",
        value: renderer ?? "unknown",
        rationale: "Full GPU model string. Extremely specific — often uniquely identifies the hardware.",
      },
      {
        id: "version",
        name: "WebGL version",
        value: version ?? "unknown",
        rationale: "OpenGL ES version. WebGL 2 is more capable and supported on newer devices.",
      },
      {
        id: "shadingLanguage",
        name: "Shading language",
        value: shadingVersion ?? "unknown",
        rationale: "GLSL version. Varies by GPU driver.",
      },
      {
        id: "maxTextureSize",
        name: "Max texture size",
        value: `${maxTextureSize}px`,
        rationale: "Largest texture dimension. High-end GPUs support 16384px or more.",
      },
      {
        id: "maxVaryings",
        name: "Max varying vectors",
        value: String(maxVaryings),
        rationale: "GPU capability limit. Varies by hardware.",
      },
      {
        id: "extensionCount",
        name: "Extensions",
        value: `${extensions.length} supported`,
        rationale: "Number of supported WebGL extensions. A detailed set can uniquely identify the GPU.",
        entries: extensions.map(e => ({ label: e, value: "" })),
      },
    ];
  },
};

// ─── Needs Permission ────────────────────────────────────────────────────────

const location: Category = {
  id: "location",
  sensitivity: "permissioned",
  icon: MapPin,
  title: "Location",
  subtitle: "Coordinate and movement data",
  collect: async () => {
    if (!navigator.geolocation) {
      return [{ id: "unavailable", name: "Geolocation API", value: "Not supported", rationale: "This browser does not support the Geolocation API." }];
    }

    try {
      const perm = await navigator.permissions.query({ name: "geolocation" });
      if (perm.state === "denied") {
        return [{ id: "denied", name: "Geolocation permission", value: "Denied", rationale: "The user has blocked geolocation for this site." }];
      }
    } catch { /* permissions API not available */ }

    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => resolve([
          {
            id: "coords",
            name: "Coordinates",
            value: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
            rationale: "GPS-accurate latitude and longitude.",
            entries: [
              { label: "Latitude", value: pos.coords.latitude.toFixed(5) },
              { label: "Longitude", value: pos.coords.longitude.toFixed(5) },
            ],
          },
          {
            id: "accuracy",
            name: "Accuracy",
            value: `±${Math.round(pos.coords.accuracy)} m`,
            rationale: "Horizontal accuracy radius. GPS gives ~5m; Wi-Fi triangulation ~50m.",
          },
          {
            id: "altitude",
            name: "Altitude",
            value: pos.coords.altitude != null ? `${pos.coords.altitude.toFixed(1)} m` : "not available",
            rationale: "Height above sea level. Available when GPS lock is strong.",
          },
          {
            id: "speed",
            name: "Speed",
            value: pos.coords.speed != null ? `${pos.coords.speed.toFixed(1)} m/s` : "not available",
            rationale: "Current movement speed. Non-null when the device is moving.",
          },
        ]),
        err => resolve([{
          id: "error",
          name: "Geolocation",
          value: err.code === 1 ? "Permission denied" : err.code === 2 ? "Position unavailable" : "Timeout",
          rationale: "Geolocation request was not successful.",
        }]),
        { timeout: 10000 }
      );
    });
  },
};

const camera: Category = {
  id: "camera",
  sensitivity: "permissioned",
  icon: Camera,
  title: "Cameras & Microphones",
  subtitle: "Camera lineup and capabilities",
  collect: async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return [{ id: "unavailable", name: "MediaDevices API", value: "Not supported", rationale: "This browser does not support enumerateDevices." }];
    }

    try {
      const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
      if (perm.state === "denied") {
        return [{ id: "denied", name: "Camera permission", value: "Denied", rationale: "Camera access is blocked for this site." }];
      }
    } catch { /* permissions API may not support camera query */ }

    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch { /* continue without stream */ }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === "videoinput");
    const mics = devices.filter(d => d.kind === "audioinput");
    const speakers = devices.filter(d => d.kind === "audiooutput");

    const signals: Signal[] = [
      {
        id: "cameraCount",
        name: "Cameras",
        value: `${cameras.length}`,
        rationale: "Number of video input devices. More cameras suggest a modern multi-camera phone.",
      },
      {
        id: "micCount",
        name: "Microphones",
        value: `${mics.length}`,
        rationale: "Number of audio input devices.",
      },
      {
        id: "speakerCount",
        name: "Speakers/headphones",
        value: `${speakers.length}`,
        rationale: "Number of audio output devices.",
      },
    ];

    cameras.forEach((cam, i) => {
      signals.push({
        id: `camera-${i}`,
        name: `Camera ${i + 1}`,
        value: cam.label || "(label requires permission)",
        rationale: "Camera label names (e.g., 'Front Camera') are exposed after permission is granted.",
      });
    });

    return signals;
  },
};

const motionSensors: Category = {
  id: "motion-sensors",
  sensitivity: "permissioned",
  icon: Navigation,
  title: "Motion & Sensors",
  subtitle: "Activity, steps, and altitude",
  collect: async () => {
    const signals: Signal[] = [];

    if (typeof DeviceMotionEvent === "undefined") {
      return [{ id: "unavailable", name: "DeviceMotionEvent", value: "Not supported", rationale: "This browser or device does not expose motion sensors." }];
    }

    if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
      try {
        const result = await (DeviceMotionEvent as any).requestPermission();
        if (result !== "granted") {
          return [{ id: "denied", name: "Motion permission", value: "Denied", rationale: "User denied motion sensor access." }];
        }
      } catch {
        return [{ id: "error", name: "Motion permission", value: "Error requesting", rationale: "Permission prompt failed." }];
      }
    }

    return new Promise(resolve => {
      const timeout = setTimeout(() => resolve([{
        id: "timeout",
        name: "Motion data",
        value: "No events received",
        rationale: "Device may not have motion hardware.",
      }]), 2000);

      window.addEventListener("devicemotion", (e) => {
        clearTimeout(timeout);
        const a = e.acceleration;
        const ag = e.accelerationIncludingGravity;
        const r = e.rotationRate;
        resolve([
          {
            id: "acceleration",
            name: "Acceleration (x, y, z)",
            value: a ? `${a.x?.toFixed(2)}, ${a.y?.toFixed(2)}, ${a.z?.toFixed(2)} m/s²` : "n/a",
            rationale: "Linear acceleration without gravity. Reveals movement patterns.",
            entries: a ? [
              { label: "X", value: `${a.x?.toFixed(3)}` },
              { label: "Y", value: `${a.y?.toFixed(3)}` },
              { label: "Z", value: `${a.z?.toFixed(3)}` },
            ] : undefined,
          },
          {
            id: "accelerationWithGravity",
            name: "Accel. incl. gravity",
            value: ag ? `${ag.x?.toFixed(2)}, ${ag.y?.toFixed(2)}, ${ag.z?.toFixed(2)} m/s²` : "n/a",
            rationale: "Includes gravitational pull. Reveals device orientation.",
          },
          {
            id: "rotationRate",
            name: "Rotation rate (α, β, γ)",
            value: r ? `${r.alpha?.toFixed(2)}, ${r.beta?.toFixed(2)}, ${r.gamma?.toFixed(2)} °/s` : "n/a",
            rationale: "Gyroscope readings. Each axis corresponds to a rotation direction.",
          },
          {
            id: "interval",
            name: "Event interval",
            value: e.interval ? `${e.interval} ms` : "n/a",
            rationale: "How frequently motion events fire. Varies by device hardware.",
          },
        ]);
      }, { once: true });
    });
  },
};

const bluetooth: Category = {
  id: "bluetooth",
  sensitivity: "permissioned",
  icon: Bluetooth,
  title: "Bluetooth",
  subtitle: "Adapter state and nearby devices",
  collect: async () => {
    if (!(navigator as any).bluetooth) {
      return [{ id: "unavailable", name: "Web Bluetooth API", value: "Not available", rationale: "Safari does not support Web Bluetooth. Chrome requires a secure context and a user gesture." }];
    }

    try {
      const available = await (navigator as any).bluetooth.getAvailability();
      const signals: Signal[] = [
        {
          id: "available",
          name: "Bluetooth available",
          value: String(available),
          rationale: "Whether a Bluetooth adapter is present and enabled.",
        },
      ];

      if (available) {
        signals.push({
          id: "scanNote",
          name: "Device scan",
          value: "Requires user gesture",
          rationale: "Scanning for nearby Bluetooth devices requires both permission and a user interaction (e.g. button click). Nearby device names can be used for location inference.",
        });
      }

      return signals;
    } catch (e) {
      return [{ id: "error", name: "Bluetooth", value: `Error: ${(e as Error).message}`, rationale: "" }];
    }
  },
};

// ─── Advanced ────────────────────────────────────────────────────────────────

const canvasFingerprint: Category = {
  id: "canvas-fingerprint",
  sensitivity: "advanced",
  icon: Fingerprint,
  title: "Canvas Fingerprint",
  subtitle: "Browser-style fingerprinting via 2D canvas",
  collect: async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [{ id: "error", name: "Canvas 2D", value: "Not available", rationale: "" }];

    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 280, 60);
    ctx.fillStyle = "#069";
    ctx.fillText("Loupe fingerprint test, 1a2b!", 2, 4);
    ctx.fillStyle = "rgba(100,200,0,0.7)";
    ctx.fillText("Cwm fjordbank glyphs vext quiz", 2, 26);
    ctx.strokeStyle = "rgba(200,80,150,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(240, 30, 20, 0, Math.PI * 2);
    ctx.stroke();

    const dataUrl = canvas.toDataURL();

    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(dataUrl));
    const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);

    return [
      {
        id: "canvasHash",
        name: "Canvas fingerprint hash",
        value: hashHex,
        rationale: "SHA-256 of a rendered canvas. Varies by GPU, OS, browser version, and installed fonts — uniquely identifying on most devices.",
      },
      {
        id: "canvasSize",
        name: "Canvas data URL size",
        value: `${dataUrl.length} chars`,
        rationale: "Data URL length is another canvas fingerprint dimension.",
      },
      {
        id: "canvasMethod",
        name: "How it works",
        value: "Text + shapes rendered with GPU, then hashed",
        rationale: "Tiny rendering differences caused by GPU hardware, driver version, and font rendering are captured in the pixel data and converted to a hash — without any permission prompt.",
      },
    ];
  },
};

const webglFingerprint: Category = {
  id: "webgl-fingerprint",
  sensitivity: "advanced",
  icon: Zap,
  title: "WebGL Fingerprint",
  subtitle: "GPU-level browser fingerprint",
  collect: async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    if (!gl) return [{ id: "noWebgl", name: "WebGL", value: "Not available", rationale: "" }];

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, `attribute vec2 p; void main(){gl_Position=vec4(p,0,1);}`);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, `precision mediump float; void main(){gl_FragColor=vec4(0.31415,0.27182,0.14142,1.0);}`);
    gl.compileShader(fs);

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const pixels = new Uint8Array(256 * 128 * 4);
    gl.readPixels(0, 0, 256, 128, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    const hashBuf = await crypto.subtle.digest("SHA-256", pixels);
    const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);

    const paramKeys: [string, number][] = [
      ["MAX_VERTEX_ATTRIBS", gl.MAX_VERTEX_ATTRIBS],
      ["MAX_TEXTURE_IMAGE_UNITS", gl.MAX_TEXTURE_IMAGE_UNITS],
      ["MAX_RENDERBUFFER_SIZE", gl.MAX_RENDERBUFFER_SIZE],
      ["MAX_VERTEX_UNIFORM_VECTORS", gl.MAX_VERTEX_UNIFORM_VECTORS],
      ["MAX_FRAGMENT_UNIFORM_VECTORS", gl.MAX_FRAGMENT_UNIFORM_VECTORS],
    ];

    return [
      {
        id: "glHash",
        name: "WebGL render hash",
        value: hashHex,
        rationale: "Hash of pixels rendered by a fixed GLSL shader. GPU differences produce different pixel output — a stable, permission-free fingerprint.",
      },
      {
        id: "glParams",
        name: "GPU capability parameters",
        value: paramKeys.map(([k, v]) => `${k}: ${gl.getParameter(v)}`).join(", "),
        rationale: "Hardware limits reported by the GPU driver. Vary by GPU model and driver version.",
        entries: paramKeys.map(([k, v]) => ({ label: k, value: String(gl.getParameter(v)) })),
      },
    ];
  },
};

const previousInstalls: Category = {
  id: "previous-installs",
  sensitivity: "advanced",
  icon: RotateCcw,
  title: "Previous Installs Log",
  subtitle: "Reinstall history kept in localStorage",
  collect: async () => {
    const FIRST_VISIT_KEY = "__loupe_first_visit__";
    const VISIT_COUNT_KEY = "__loupe_visit_count__";

    let firstVisit = localStorage.getItem(FIRST_VISIT_KEY);
    if (!firstVisit) {
      firstVisit = new Date().toISOString();
      localStorage.setItem(FIRST_VISIT_KEY, firstVisit);
    }

    let visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? "0", 10);
    visitCount += 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));

    return [
      {
        id: "firstVisit",
        name: "First visit recorded",
        value: firstVisit,
        rationale: "localStorage persists across sessions. A timestamp written on first load survives until the user clears browser data — acting like a persistent install log.",
      },
      {
        id: "visitCount",
        name: "Visit count",
        value: String(visitCount),
        rationale: "Number of times this page has been loaded in this browser. Persists across restarts.",
      },
      {
        id: "daysSinceFirst",
        name: "Days since first visit",
        value: (() => {
          const d = (Date.now() - new Date(firstVisit!).getTime()) / 86400000;
          return d < 1 ? "Today" : `${Math.floor(d)} days`;
        })(),
        rationale: "How long this 'installation' has been tracked — without any native OS access.",
      },
    ];
  },
};

const installedApps: Category = {
  id: "installed-apps",
  sensitivity: "advanced",
  icon: Grid3x3,
  title: "App & Scheme Detection",
  subtitle: "App detection via URL schemes and resource timing",
  collect: async () => {
    const signals: Signal[] = [];

    signals.push({
      id: "resourceTiming",
      name: "Resource Timing API",
      value: typeof PerformanceObserver !== "undefined" ? "Available" : "Not available",
      rationale: "Timing data for loaded resources can reveal cross-origin information. Used by sophisticated fingerprinters to probe CDN cache state.",
    });

    signals.push({
      id: "performanceEntries",
      name: "Performance entries (this page)",
      value: String(performance.getEntriesByType("resource").length),
      rationale: "Number of resource entries. Higher counts may hint at more complex page setups.",
    });

    const uaData = (navigator as any).userAgentData;
    if (uaData) {
      signals.push({
        id: "uaDataBrands",
        name: "navigator.userAgentData brands",
        value: (uaData.brands ?? []).map((b: any) => `${b.brand} ${b.version}`).join(", "),
        rationale: "Structured brand list from the User-Agent Client Hints API. More precise than parsing the UA string.",
      });
      signals.push({
        id: "uaDataMobile",
        name: "userAgentData.mobile",
        value: String(uaData.mobile),
        rationale: "Whether the browser considers itself 'mobile'. Simplified equivalent of checking UA string.",
      });
      signals.push({
        id: "uaDataPlatform",
        name: "userAgentData.platform",
        value: uaData.platform ?? "not reported",
        rationale: "OS platform from Client Hints — more reliable than navigator.platform.",
      });
    } else {
      signals.push({
        id: "uaDataBrands",
        name: "User-Agent Client Hints",
        value: "Not available",
        rationale: "Chrome/Edge expose structured UA data. Safari and Firefox do not.",
      });
    }

    signals.push({
      id: "pdfViewer",
      name: "Built-in PDF viewer",
      value: (navigator as any).pdfViewerEnabled != null ? String((navigator as any).pdfViewerEnabled) : "not reported",
      rationale: "Whether the browser has a PDF viewer. Absence suggests a stripped or hardened browser.",
    });

    signals.push({
      id: "webdriver",
      name: "navigator.webdriver",
      value: String(navigator.webdriver ?? false),
      rationale: "True when controlled by automation (Selenium, Playwright, Puppeteer). Bots try to hide this.",
    });

    return signals;
  },
};

// ─── Export ──────────────────────────────────────────────────────────────────

export const CATEGORIES: Category[] = [
  // Passive
  deviceIdentity, systemInfo, battery, storage, display,
  audio, locale, accessibility, clipboard, deviceMotion,
  network, fonts, voices, appBundle, graphics,
  // Permissioned
  location, camera, motionSensors, bluetooth,
  // Advanced
  canvasFingerprint, webglFingerprint, previousInstalls, installedApps,
];

export const PASSIVE = CATEGORIES.filter(c => c.sensitivity === "passive");
export const PERMISSIONED = CATEGORIES.filter(c => c.sensitivity === "permissioned");
export const ADVANCED = CATEGORIES.filter(c => c.sensitivity === "advanced");
