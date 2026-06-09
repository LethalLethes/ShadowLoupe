import { ReactNode, useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Clock } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
}

export function Layout({ children, title = "DeviceRadar", showBack = false }: LayoutProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white w-full max-w-md mx-auto relative overflow-hidden flex flex-col font-sans">
      {/* Header */}
      <header className="flex items-center justify-between p-4 pt-8 shrink-0">
        <div className="flex items-center gap-2">
          {showBack ? (
            <Link href="/" className="text-primary hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-6 h-6" />
            </Link>
          ) : (
            <div className="text-xl font-bold tracking-tight">{title}</div>
          )}
        </div>
        {!showBack && (
          <div className="flex items-center text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full font-medium tracking-wide">
            <Clock className="w-3 h-3 mr-1.5" />
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}
      </header>
      
      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 pb-8">
        {children}
      </main>
    </div>
  );
}
