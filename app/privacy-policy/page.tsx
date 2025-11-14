"use client"
import MainPrivacyPolicy from "@/framer/main-privacy-policy";
import RadialVignette from "@/components/RadialVignette";

export default function PrivacyPolicy() {
  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <RadialVignette />
      <div style={{ position: "relative", zIndex: 1 }}>
      <MainPrivacyPolicy.Responsive style={{ width: "100%", zIndex: 1, minWidth: "100%" }} />
      </div>
    </div>
  );
}