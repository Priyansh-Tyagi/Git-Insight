import LandingNav from '../components/landing/LandingNav';
import Hero from '../components/landing/Hero';
import Features from '../components/landing/Features';
import HowItWorks from '../components/landing/HowItWorks';
import Research from '../components/landing/Research';
import CtaBand from '../components/landing/CtaBand';
import Footer from '../components/landing/Footer';

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas">
      <LandingNav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Research />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
