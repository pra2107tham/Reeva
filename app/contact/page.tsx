"use client"
import HeroContact from "@/framer/hero-contact";
import FAQContact from "@/framer/faq-contact";

export default function Contact() {
  return (
    <div>
      <HeroContact.Responsive style={{ width: "100%", zIndex: 1, minWidth: "100%" }} />
      <FAQContact.Responsive style={{ width: "100%", zIndex: 1, minWidth: "100%" }} />
    </div>
  );
}
