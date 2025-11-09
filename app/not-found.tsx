"use client";
import Hero404 from "@/framer/hero-404";
import Background from "@/framer/background";

export default function NotFound() {
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {/* Background layer - behind everything */}
      <Background.Responsive
        style={{
          position: "absolute",
          top: "-100px",
          left: "0px",
          right: "0px",
          bottom: "438px",
        //   opacity: 0.9,
          zIndex: 0,
          pointerEvents: "none",
          width: "100%",
        }}
      />
      {/* Content layer - above background, below navbar/footer */}
      <div style={{ position: "relative", zIndex: 1, pointerEvents: "auto" }}>
        <Hero404.Responsive style={{ width: "100%" }} />
      </div>
    </div>
  );
}

