import { HeroSection } from "./HeroSection";
import { FeaturesSection } from "./FeaturesSection";
import { CTASection } from "./CTASection";
import { Footer } from "./Footer";

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeroSection />
      <FeaturesSection />
      <CTASection />
      <Footer />
    </div>
  );
}
