"use client";
import MainHowItWorks from "@/framer/main-how-it-works.jsx";

export default function HowItWorks() {
  // RichText content - these accept React.ReactNode despite TypeScript types saying undefined
  const description = (
    <p>
      Reeva connects directly with your Instagram account to make your Saved Reels easy to organize, search, and rediscover — and soon, to help creators understand what their audience truly saves.
    </p>
  );

  const mainContent1 = (
    <p>
      Your Saved Reels, automatically organized and searchable.
    </p>
  );

  const subContent1 = (
    <p>
      Send a message to Reeva's official Instagram account. You'll instantly receive a unique link to securely connect your Instagram to Reeva. No downloads. No setup. Just one message, and you're connected.
    </p>
  );

  const subContent2 = (
    <>
    <p>Once linked, everything you send or save to that Instagram chat automatically syncs to your Reeva dashboard. Reeva stores each Reel with context — tags, summaries, and thumbnails — so you can find it easily later.</p>
      <blockquote>Your “Saved” section now has structure.</blockquote>
    </>
  );
  const mainContent2 = <p>Reeva for Creators helps you see what audiences actually save, not just what they scroll past.</p>;
  const subContent3 = (
    <>
      <p>Ask naturally — "show me that café I saved last week" or "find that video about transitions." Reeva's AI layer searches through your synced Reels, instantly pulling up what you need — no endless scrolling.</p>
      <blockquote>Your inspiration, always a message away.</blockquote>
    </>
  );

  const subHeading4 = "Coming Soon Overview:";
  const subContent4 = (
    <>
    <ol>
      <p>Connect Your Instagram Business Account: Securely sync your Saved Reels data with Reeva.</p>
      <p>Audience Save Analytics: Learn which Reels, topics, and sounds get saved most often.</p>
      <p>Trend Insights: Discover the saving trends shaping engagement — before they go viral.</p>
      <p>Performance Dashboard: Visualize what content truly resonates.</p>
    </ol>
      <blockquote>This feature is currently in development — launching soon for verified creators and agencies.</blockquote>
    </>
  );

  return (
    <div>
      <MainHowItWorks.Responsive
        className="text-white"
        date="2025"
        innerTitle="How Reeva Works"
        description={description as any}
        image1={{ src: "/image-1.png", alt: "Reeva Instagram Connection" }}
        mainHeading1="For Users — Reeva in Action."
        mainContent1={mainContent1 as any}
        subHeading1="1. Connect via Instagram DMs"
        subContent1={subContent1 as any}
        subHeading2="2. Sync Your Saved Reels"
        subContent2={subContent2 as any}
        image2={{ src: "/image-2.png", alt: "Reeva Features" }}
        mainHeading2="For Creators & Agencies — Insights That Go Beyond Likes."
        mainContent2={mainContent2 as any}
        subHeading3="3. Retrieve Anything, Instantly"
        subContent3={subContent3 as any}
        image4={{ src: "/image-3.png", alt: "Reeva Solution" }}
        subHeading4={subHeading4}
        subContent4={subContent4 as any}
      />
    </div>
  );
}
