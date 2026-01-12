import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PropertyCard } from '@/components/property/PropertyCard';
import { mockProperties } from '@/data/mockProperties';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export function FeaturedProperties() {
  // Get top 6 available properties sorted by discount
  const featuredProperties = mockProperties
    .filter((p) => p.status === 'available')
    .sort((a, b) => (b.discount || 0) - (a.discount || 0))
    .slice(0, 6);

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10"
        >
          <div>
            <span className="text-sm font-medium text-primary uppercase tracking-wider">
              Destaques
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl mt-2">
              Melhores Oportunidades
            </h2>
            <p className="text-muted-foreground mt-2 max-w-lg">
              Imóveis com os maiores descontos disponíveis agora. Não perca essas oportunidades únicas.
            </p>
          </div>
          <Link to="/imoveis">
            <Button variant="outline" className="gap-2">
              Ver Todos
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredProperties.map((property, index) => (
            <PropertyCard key={property.id} property={property} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
