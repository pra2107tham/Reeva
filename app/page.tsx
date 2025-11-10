"use client";
import { useEffect } from "react";
import Hero from "@/framer/hero";
import Background from "@/framer/background";
import WhyHow from "@/framer/why-how";
import IntroducingReeva from "@/framer/introducing-reeva";
import TheStory from "@/framer/the-story";
import Comparison from "@/framer/comparison";
import FAQ from "@/framer/faq"

export default function Home() {
  useEffect(() => {
    // Force WhyHow component and all its parent containers to full width
    const fixWhyHowWidth = () => {
      const whyHowSection = document.querySelector('section.framer-TqhQ8.framer-unpgzs');
      if (!whyHowSection) return;

      // Set the component itself to full width
      const section = whyHowSection as HTMLElement;
      section.style.setProperty('width', '100%', 'important');
      section.style.setProperty('max-width', '100%', 'important');

      // Fix all parent containers
      let parent = section.parentElement;
      let depth = 0;
      while (parent && parent !== document.body && depth < 10) {
        const parentEl = parent as HTMLElement;
        parentEl.style.setProperty('width', '100%', 'important');
        parentEl.style.setProperty('max-width', '100%', 'important');
        parent = parent.parentElement;
        depth++;
      }
    };

    // Run immediately and after a short delay to catch dynamic updates
    fixWhyHowWidth();
    const timeout1 = setTimeout(fixWhyHowWidth, 100);
    const timeout2 = setTimeout(fixWhyHowWidth, 500);

    // Use MutationObserver to watch for style changes
    const observer = new MutationObserver(() => {
      fixWhyHowWidth();
    });

    // Observe the document for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      observer.disconnect();
    };
  }, []);

  return (
    <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
      <Hero.Responsive style={{ width: "100%",zIndex: 3 }} />
      <Background.Responsive
        style={{
          position: "absolute",
          bottom: "5210px",
          left: "0px",
          right: "0px",
          top: "0px",
          maxWidth: "1480px",
          zIndex: 2,
          pointerEvents: "none",
          width: "100%",
        }}
      />
      <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
        <WhyHow.Responsive style={{ width: "100%", zIndex: 1, minWidth: "100%" }} />
      </div>
      <IntroducingReeva.Responsive style={{ width: "100%", zIndex: 1, minWidth: "100%" }} />
      <div style={{ display: "flex", justifyContent: "center", width: "100%", paddingTop: "100px" }}>
        <TheStory.Responsive style={{ zIndex: 1 }} />
      </div>
      <Comparison.Responsive style={{ width: "100%", zIndex: 1, minWidth: "100%" }} />
      <FAQ.Responsive style={{ width: "100%", zIndex: 1, minWidth: "100%" }} />
    </div>
  );
}