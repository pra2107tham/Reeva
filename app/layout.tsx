import type { Metadata } from "next";
import Layout from "@/components/Layout";
import "./globals.css";
// import "../framer/styles.css";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "Reeva",
  description: "Finally, something for your saved reels",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={``}
        style={{ backgroundColor: "var(--unframer-ui-2)",color: "var(--unframer-white)"  }}
      >
        <Layout style={{minHeight: "100vh", display: "flex", flexDirection: "row", justifyContent: "center", width: "100%"}}>
          {children}
        </Layout>
      </body>
    </html>
  );
}
