"use client";
import Hero from "@/framer/hero";
import Background from "@/framer/background";

export default function Home() {
  return (
    <div>
      <Hero.Responsive style={{ width: "100%" }} />
      <Background.Responsive
        style={{
          position: "absolute",
          bottom: "5210px",
          left: "0px",
          right: "0px",
          top: "0px",
          maxWidth: "1480px",
          zIndex: -1,
          pointerEvents: "none",
          width: "100%",
        }}
      />
      {/* <WhyHow.Responsive style={{ width: "100%" }} /> */}
    </div>
  );
}