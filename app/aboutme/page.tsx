"use client"
import { useEffect } from "react";
import HeroAboutMe from "@/framer/hero-about-me";
import AboutPratham from "@/framer/about-pratham";

export default function AboutMe() {
  useEffect(() => {
    // Force AboutPratham component and all its parent containers to full width
    const fixAboutPrathamWidth = () => {
      // Try all variant selectors
      const selectors = [
        'section.framer-1LLwt.framer-fh5vyl',
        'section.framer-1LLwt.framer-v-1qy3aj.framer-fh5vyl',
        'section.framer-1LLwt.framer-v-41ux08.framer-fh5vyl'
      ];
      
      let aboutPrathamSection: Element | null = null;
      for (const selector of selectors) {
        aboutPrathamSection = document.querySelector(selector);
        if (aboutPrathamSection) break;
      }
      
      if (!aboutPrathamSection) return;

      // Set the component itself to full width
      const section = aboutPrathamSection as HTMLElement;
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
    fixAboutPrathamWidth();
    const timeout1 = setTimeout(fixAboutPrathamWidth, 100);
    const timeout2 = setTimeout(fixAboutPrathamWidth, 500);

    // Use MutationObserver to watch for style changes
    const observer = new MutationObserver(() => {
      fixAboutPrathamWidth();
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
    <div>
      <HeroAboutMe.Responsive style={{ width: "100%", zIndex: 1, minWidth: "100%" }} />
      <AboutPratham.Responsive style={{ width: "100%", zIndex: 1, minWidth: "100%" }} />
    </div>
  );
}