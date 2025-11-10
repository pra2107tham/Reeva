"use client"
import MainTermsConditions from "@/framer/main-terms-conditions";
import RadialVignette from "@/components/RadialVignette";

export default function TermsConditions() {
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <RadialVignette />
      <div style={{ position: "relative", zIndex: 1 }}>
        <MainTermsConditions.Responsive style={{ width: "100%", zIndex: 1, minWidth: "100%" }} />
      </div>
    </div>
  );
}