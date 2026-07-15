import type { Metadata } from "next";
import "@fontsource/commit-mono/400.css";
import "@fontsource/commit-mono/600.css";
import "./globals.css";
import { GlassNav } from "@/components/GlassNav";
import { Footer } from "@/components/Footer";
import { Bootstrap } from "@/components/Bootstrap";
import { AuthProvider } from "@/lib/auth";
import { AuthGate } from "@/components/AuthGate";
import { PageTransition } from "@/components/PageTransition";
import { loadContent } from "@/lib/serverContent";

export const metadata: Metadata = {
  title: "clpr - a better dopamine loop",
  description: "Pick a track, climb the stages, clear the clpr quizzes, and race your friends. Effort you can see.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const content = await loadContent();
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Bootstrap content={content}>
            <GlassNav />
            <main>
              <div className="frame">
                <AuthGate>
                  <PageTransition>{children}</PageTransition>
                </AuthGate>
              </div>
            </main>
            <Footer />
          </Bootstrap>
        </AuthProvider>
      </body>
    </html>
  );
}
