import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PropertyCard } from '@/components/property/PropertyCard';
import { PropertyFilters } from '@/components/property/PropertyFilters';
import { mockProperties } from '@/data/mockProperties';
import { motion } from 'framer-motion';
import { Building2, SortAsc } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SortOption = 'price-asc' | 'price-desc' | 'discount' | 'recent';

const PropertiesPage = () => {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [filters, setFilters] = useState({
    search: initialSearch,
    state: 'all',
    type: 'all',
    priceRange: 'all',
    showSold: true,
  });

  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const filteredProperties = useMemo(() => {
    let result = [...mockProperties];

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(searchLower) ||
          p.address.city.toLowerCase().includes(searchLower) ||
          p.address.neighborhood.toLowerCase().includes(searchLower) ||
          p.address.state.toLowerCase().includes(searchLower)
      );
    }

    // Filter by state
    if (filters.state !== 'all') {
      result = result.filter((p) => p.address.state === filters.state);
    }

    // Filter by type
    if (filters.type !== 'all') {
      result = result.filter((p) => p.type === filters.type);
    }

    // Filter by price range
    if (filters.priceRange !== 'all') {
      const [min, max] = filters.priceRange.split('-').map((v) => {
        if (v.includes('+')) return Infinity;
        return parseInt(v, 10);
      });
      result = result.filter((p) => p.price >= min && p.price <= (max || Infinity));
    }

    // Filter sold
    if (!filters.showSold) {
      result = result.filter((p) => p.status !== 'sold');
    }

    // Sort
    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'discount':
        result.sort((a, b) => (b.discount || 0) - (a.discount || 0));
        break;
      case 'recent':
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    // Always put sold at the end
    result.sort((a, b) => {
      if (a.status === 'sold' && b.status !== 'sold') return 1;
      if (a.status !== 'sold' && b.status === 'sold') return -1;
      return 0;
    });

    return result;
  }, [filters, sortBy]);

  const availableCount = filteredProperties.filter((p) => p.status === 'available').length;
  const soldCount = filteredProperties.filter((p) => p.status === 'sold').length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Page Header */}
        <div className="hero-gradient py-12">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h1 className="font-heading font-bold text-3xl md:text-4xl text-primary-foreground mb-2">
                Imóveis Disponíveis
              </h1>
              <p className="text-primary-foreground/80">
                Explore todas as oportunidades da Caixa no Nordeste
              </p>
            </motion.div>
          </div>
        </div>

        <div className="container py-8">
          {/* Filters */}
          <PropertyFilters filters={filters} onFiltersChange={setFilters} />

          {/* Results Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">
                  {availableCount} imóvel{availableCount !== 1 ? 'is' : ''} disponível{availableCount !== 1 ? 'is' : ''}
                </p>
                {filters.showSold && soldCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    + {soldCount} vendido{soldCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <SortAsc className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais Recentes</SelectItem>
                  <SelectItem value="price-asc">Menor Preço</SelectItem>
                  <SelectItem value="price-desc">Maior Preço</SelectItem>
                  <SelectItem value="discount">Maior Desconto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Properties Grid */}
          {filteredProperties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProperties.map((property, index) => (
                <PropertyCard key={property.id} property={property} index={index} />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Building2 className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-heading font-semibold text-lg mb-2">
                Nenhum imóvel encontrado
              </h3>
              <p className="text-muted-foreground">
                Tente ajustar os filtros para encontrar mais opções.
              </p>
            </motion.div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PropertiesPage;
