"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Droplets, Sparkles } from "lucide-react";

const BRAND_LETTERS = ["F", "L", "Y", "E", "R", "A"];

export function AppSplashLoader() {
  const pathname = usePathname();

  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [typedCount, setTypedCount] = useState(0);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);

  // In-app Route Navigation Bar State
  const [routeLoading, setRouteLoading] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // 1. Cinematic Initial App Open & Page Refresh Sequence (~2.0s)
  useEffect(() => {
    // Only run splash on initial mount (app open or browser refresh)
    // Progress bar animation frame interval
    const progressInterval = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return Math.min(100, prev + 2.5);
      });
    }, 40);

    // Letter-by-letter typewriter stagger
    const timeouts: NodeJS.Timeout[] = [];
    BRAND_LETTERS.forEach((_, idx) => {
      const t = setTimeout(() => {
        setTypedCount(idx + 1);
      }, 350 + idx * 140);
      timeouts.push(t);
    });

    // Subtitle reveal at ~1300ms
    const subT = setTimeout(() => {
      setShowSubtitle(true);
    }, 1300);
    timeouts.push(subT);

    // Trigger smooth fade & scale exit at ~2000ms
    const exitT = setTimeout(() => {
      setIsExiting(true);
    }, 2000);
    timeouts.push(exitT);

    // Fully unmount from DOM after exit transition (~2600ms)
    const finishT = setTimeout(() => {
      setShowSplash(false);
    }, 2600);
    timeouts.push(finishT);

    return () => {
      clearInterval(progressInterval);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  // 2. In-App Navigation Bar on Route Change
  useEffect(() => {
    if (pathname !== prevPathname) {
      setPrevPathname(pathname);
      setRouteLoading(true);
      const timer = setTimeout(() => {
        setRouteLoading(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [pathname, prevPathname]);

  return (
    <>
      {/* ============================================================== */}
      {/* 1. TOP PROGRESS BAR (For subsequent in-app page transitions) */}
      {/* ============================================================== */}
      {routeLoading && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-sky-950/20 pointer-events-none">
          <div className="h-full bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 animate-[progressLiquid_0.4s_ease-out_forwards] shadow-[0_0_12px_#38bdf8]" />
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. CINEMATIC DARK SAPPHIRE SPLASH SCREEN (Open & Refresh)      */}
      {/* ============================================================== */}
      {showSplash && (
        <div
          id="flyera-splash-loader"
          className={`fixed inset-0 z-[10000] flex flex-col items-center justify-center select-none overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isExiting
              ? "opacity-0 scale-105 pointer-events-none"
              : "opacity-100 scale-100"
          }`}
          style={{
            background: "radial-gradient(ellipse at 50% 45%, #0a1738 0%, #060d20 50%, #030712 100%)",
          }}
        >
          {/* Ambient Background Aura Lights */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none animate-ambient-glow" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-sky-400/15 rounded-full blur-[80px] pointer-events-none" />

          {/* Center Stage Container */}
          <div className="relative flex flex-col items-center z-10 px-6 max-w-md w-full text-center">
            
            {/* Water Droplet & Expanding Ripples */}
            <div className="relative w-28 h-28 flex items-center justify-center mb-8">
              {/* Harmonic Liquid Water Ripples */}
              <div className="absolute w-16 h-16 rounded-full border border-cyan-400/40 animate-ripple-1 pointer-events-none" />
              <div className="absolute w-16 h-16 rounded-full border border-sky-400/30 animate-ripple-2 pointer-events-none" />
              <div className="absolute w-16 h-16 rounded-full border border-blue-400/20 animate-ripple-3 pointer-events-none" />

              {/* Glowing Center Glass Gem with Droplet Icon */}
              <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 via-sky-500/10 to-transparent border border-cyan-300/30 backdrop-blur-xl flex items-center justify-center shadow-[0_0_35px_rgba(14,165,233,0.35)] animate-water-drop">
                <Droplets className="w-8 h-8 text-cyan-300 drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-300 rounded-full shadow-[0_0_8px_#38bdf8] animate-ping" />
              </div>
            </div>

            {/* Typewriter Letters "F L Y E R A" */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-3 h-14">
              {BRAND_LETTERS.map((letter, idx) => {
                const isVisible = idx < typedCount;
                return (
                  <span
                    key={idx}
                    className={`text-4xl sm:text-5xl font-black tracking-tight transition-all duration-300 ${
                      isVisible
                        ? "opacity-100 translate-y-0 scale-100"
                        : "opacity-0 translate-y-3 scale-90 pointer-events-none"
                    }`}
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      background: "linear-gradient(180deg, #FFFFFF 20%, #A5F3FC 75%, #38BDF8 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      filter: "drop-shadow(0 0 16px rgba(56, 189, 248, 0.45))",
                    }}
                  >
                    {letter}
                  </span>
                );
              })}

              {/* Glowing Typing Caret Beam */}
              {!isExiting && typedCount < BRAND_LETTERS.length && (
                <span className="w-1 h-8 sm:h-9 bg-cyan-300 rounded-full shadow-[0_0_12px_#38bdf8] animate-caret ml-0.5" />
              )}
            </div>

            {/* Subtitle: "WATER & CIRCULAR LOGISTICS" */}
            <div
              className={`flex items-center gap-2 mb-8 transition-all duration-700 transform ${
                showSubtitle
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-2 pointer-events-none"
              }`}
            >
              <span className="h-[1px] w-6 bg-gradient-to-r from-transparent to-cyan-400/50" />
              <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.32em] text-cyan-200/80 drop-shadow-[0_0_8px_rgba(56,189,248,0.3)]">
                Water & Circular Logistics
              </p>
              <span className="h-[1px] w-6 bg-gradient-to-l from-transparent to-cyan-400/50" />
            </div>

            {/* Fluid Shimmer Progress Bar */}
            <div className="w-48 sm:w-56 h-[3px] bg-slate-800/80 rounded-full overflow-hidden border border-cyan-500/20 p-[0.5px] shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 rounded-full shadow-[0_0_10px_#38bdf8] transition-all duration-75 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Micro Badge */}
            <div
              className={`mt-4 flex items-center gap-1.5 transition-opacity duration-500 ${
                showSubtitle ? "opacity-60" : "opacity-0"
              }`}
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Enterprise Logistics Engine
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
