import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/home/HeroSection';
import { FeaturedProperties } from '@/components/home/FeaturedProperties';
import { HowItWorks } from '@/components/home/HowItWorks';
import { SoldProperties } from '@/components/home/SoldProperties';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <FeaturedProperties />
        <HowItWorks />
        <SoldProperties />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
