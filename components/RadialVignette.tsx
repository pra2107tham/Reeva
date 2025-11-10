"use client";
import React from "react";

interface RadialVignetteProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function RadialVignette({ className, style }: RadialVignetteProps) {
  return (
    <div
      className={className}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        zIndex: 0,
        background: `
          radial-gradient(ellipse at center, rgba(79, 26, 214, 0.4) 0%, rgba(79, 26, 214, 0.2) 30%, rgba(79, 26, 214, 0.05) 50%, transparent 70%),
          radial-gradient(ellipse at center, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 20%, transparent 40%),
          radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.3) 60%, rgba(0, 0, 0, 0.8) 100%)
        `,
        ...style,
      }}
    />
  );
}

