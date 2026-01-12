import { PropertyCard } from '@/components/property/PropertyCard';
import { mockProperties } from '@/data/mockProperties';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

export function SoldProperties() {
  const soldProperties = mockProperties
    .filter((p) => p.status === 'sold')
    .slice(0, 3);

  if (soldProperties.length === 0) return null;

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
            <span className="inline-flex items-center gap-2 text-sm font-medium text-success uppercase tracking-wider">
              <TrendingUp className="h-4 w-4" />
              Prova Social
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl mt-2">
              Vendidos Recentemente
            </h2>
            <p className="text-muted-foreground mt-2 max-w-lg">
              Veja alguns imóveis que já foram vendidos através da nossa plataforma. 
              O próximo pode ser seu!
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {soldProperties.map((property, index) => (
            <PropertyCard key={property.id} property={property} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
