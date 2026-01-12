import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NORTHEAST_STATES, PROPERTY_TYPES, PRICE_RANGES } from '@/types/property';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface PropertyFiltersProps {
  filters: {
    search: string;
    state: string;
    type: string;
    priceRange: string;
    showSold: boolean;
  };
  onFiltersChange: (filters: PropertyFiltersProps['filters']) => void;
}

export function PropertyFilters({ filters, onFiltersChange }: PropertyFiltersProps) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const updateFilter = (key: keyof typeof filters, value: string | boolean) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      state: 'all',
      type: 'all',
      priceRange: 'all',
      showSold: true,
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.state !== 'all' ||
    filters.type !== 'all' ||
    filters.priceRange !== 'all';

  return (
    <div className="bg-card rounded-xl shadow-card border border-border p-4">
      {/* Search and Mobile Toggle */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cidade, bairro ou título..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          className="md:hidden"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Desktop Filters */}
      <div className="hidden md:flex gap-3 mt-4">
        <Select
          value={filters.state}
          onValueChange={(value) => updateFilter('state', value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {NORTHEAST_STATES.map((state) => (
              <SelectItem key={state.value} value={state.value}>
                {state.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.type}
          onValueChange={(value) => updateFilter('type', value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.priceRange}
          onValueChange={(value) => updateFilter('priceRange', value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Faixa de Preço" />
          </SelectTrigger>
          <SelectContent>
            {PRICE_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filters.showSold ? 'secondary' : 'outline'}
          onClick={() => updateFilter('showSold', !filters.showSold)}
          className="shrink-0"
        >
          {filters.showSold ? 'Mostrar Vendidos' : 'Ocultar Vendidos'}
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="shrink-0 gap-2">
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Mobile Filters */}
      <AnimatePresence>
        {showMobileFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden mt-4 space-y-3"
          >
            <Select
              value={filters.state}
              onValueChange={(value) => updateFilter('state', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {NORTHEAST_STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>
                    {state.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.type}
              onValueChange={(value) => updateFilter('type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.priceRange}
              onValueChange={(value) => updateFilter('priceRange', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Faixa de Preço" />
              </SelectTrigger>
              <SelectContent>
                {PRICE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                variant={filters.showSold ? 'secondary' : 'outline'}
                onClick={() => updateFilter('showSold', !filters.showSold)}
                className="flex-1"
              >
                {filters.showSold ? 'Mostrar Vendidos' : 'Ocultar Vendidos'}
              </Button>

              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="gap-2">
                  <X className="h-4 w-4" />
                  Limpar
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
