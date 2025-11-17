"use client";

import { Mic } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AIVoiceInputProps {
  onStart?: () => void;
  onStop?: (duration: number) => void;
  visualizerBars?: number;
  demoMode?: boolean;
  demoInterval?: number;
  className?: string;
  submitted?: boolean;
  onSubmittedChange?: (submitted: boolean) => void;
}

export function AIVoiceInput({
  onStart,
  onStop,
  visualizerBars = 48,
  demoMode = false,
  demoInterval = 3000,
  className,
  submitted: controlledSubmitted,
  onSubmittedChange
}: AIVoiceInputProps) {
  const [internalSubmitted, setInternalSubmitted] = useState(false);
  const [time, setTime] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [isDemo, setIsDemo] = useState(demoMode);
  const startTimestampRef = useRef<number | null>(null);
  const lastDurationRef = useRef(0);
  
  // Use controlled state if provided, otherwise use internal state
  const submitted = controlledSubmitted !== undefined ? controlledSubmitted : internalSubmitted;
  const isControlled = controlledSubmitted !== undefined;
  const previousSubmittedRef = useRef<boolean>(submitted);
  const setSubmitted = (value: boolean) => {
    if (!isControlled) {
      setInternalSubmitted(value);
    }
    onSubmittedChange?.(value);
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    if (submitted) {
      startTimestampRef.current = Date.now();
      lastDurationRef.current = 0;
      setTime(0);

      intervalId = setInterval(() => {
        if (startTimestampRef.current) {
          const elapsed = Math.floor((Date.now() - startTimestampRef.current) / 1000);
          setTime(elapsed);
        }
      }, 1000);
    } else {
      startTimestampRef.current = null;
      setTime(0);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        if (startTimestampRef.current) {
          lastDurationRef.current = Math.max(
            0,
            Math.floor((Date.now() - startTimestampRef.current) / 1000)
          );
          startTimestampRef.current = null;
        }
      }
    };
  }, [submitted]);

  useEffect(() => {
    const previous = previousSubmittedRef.current;
    if (previous === submitted) {
      return;
    }
    previousSubmittedRef.current = submitted;

    if (isControlled) {
      return;
    }

    if (submitted) {
      onStart?.();
    } else {
      onStop?.(lastDurationRef.current || time);
    }
  }, [submitted, isControlled, onStart, onStop, time]);

  useEffect(() => {
    // Don't run demo mode if component is controlled
    if (!isDemo || controlledSubmitted !== undefined) return;

    let timeoutId: NodeJS.Timeout;
    const runAnimation = () => {
      setSubmitted(true);
      timeoutId = setTimeout(() => {
        setSubmitted(false);
        timeoutId = setTimeout(runAnimation, 1000);
      }, demoInterval);
    };

    const initialTimeout = setTimeout(runAnimation, 100);
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(initialTimeout);
    };
  }, [isDemo, demoInterval, controlledSubmitted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClick = () => {
    if (isDemo) {
      setIsDemo(false);
      setSubmitted(false);
    } else {
      setSubmitted(!submitted);
    }
  };

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative max-w-xl w-full mx-auto flex items-center flex-col gap-2">
        <button
          className={cn(
            "group w-16 h-16 rounded-xl flex items-center justify-center transition-colors",
            submitted
              ? "bg-none"
              : "bg-none hover:bg-gray-800/50"
          )}
          type="button"
          onClick={handleClick}
        >
          {submitted ? (
            <div
              className="w-6 h-6 rounded-sm animate-spin bg-white cursor-pointer pointer-events-auto"
              style={{ animationDuration: "3s" }}
            />
          ) : (
            <Mic className="w-6 h-6 text-gray-300" />
          )}
        </button>

        <span
          className={cn(
            "font-mono text-sm transition-opacity duration-300",
            submitted
              ? "text-gray-300"
              : "text-gray-500"
          )}
        >
          {formatTime(time)}
        </span>

        <div className="h-4 w-64 flex items-center justify-center gap-0.5">
          {[...Array(visualizerBars)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-0.5 rounded-full transition-all duration-300",
                submitted
                  ? "bg-gray-400 animate-pulse"
                  : "bg-gray-700 h-1"
              )}
              style={
                submitted && isClient
                  ? {
                      height: `${20 + Math.random() * 80}%`,
                      animationDelay: `${i * 0.05}s`,
                    }
                  : undefined
              }
            />
          ))}
        </div>

        <p className="h-4 text-xs text-gray-400">
          {submitted ? "Listening..." : "Click to speak"}
        </p>
      </div>
    </div>
  );
}

