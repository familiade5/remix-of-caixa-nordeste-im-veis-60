import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useStagingProperties, 
  useImportProperty, 
  useIgnoreProperty, 
  useBulkImport,
  useScrapingConfigs,
  useScrapingLogs,
  useRunScraping,
  useDeleteStagingProperty,
  useBulkDeleteStaging,
  useClearAllStaging,
  StagingProperty,
} from '@/hooks/useProperties';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Download,
  X,
  ExternalLink,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Home,
  MapPin,
  Bed,
  Car,
  Ruler,
  Percent,
  Play,
  History,
  Search,
  Filter,
  SlidersHorizontal,
  Trash2,
  Link,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import { NORTHEAST_STATES, PROPERTY_TYPES, PRICE_RANGES } from '@/types/property';

const formatPrice = (price: number | null) => {
  if (!price) return 'N/A';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(price);
};

const formatDate = (date: string | null) => {
  if (!date) return 'Nunca';
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getPropertyTypeLabel = (type: string | null) => {
  const found = PROPERTY_TYPES.find(t => t.value === type);
  return found ? found.label : type || 'Imóvel';
};

const getStateLabel = (state: string | null) => {
  const found = NORTHEAST_STATES.find(s => s.value === state);
  return found ? found.label : state || 'N/A';
};

export function StagingReviewTab() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(true);
  
  // Scraping options
  const [scrapeStateFilter, setScrapeStateFilter] = useState('all');
  const [manualUrl, setManualUrl] = useState('');
  const [showManualUrlInput, setShowManualUrlInput] = useState(false);
  
  // Dialogs
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: pendingProperties, isLoading, refetch } = useStagingProperties('pending');
  const { data: configs } = useScrapingConfigs();
  const { data: logs } = useScrapingLogs();

  const importMutation = useImportProperty();
  const ignoreMutation = useIgnoreProperty();
  const bulkImportMutation = useBulkImport();
  const runScrapingMutation = useRunScraping();
  const deleteStagingMutation = useDeleteStagingProperty();
  const bulkDeleteStagingMutation = useBulkDeleteStaging();
  const clearAllStagingMutation = useClearAllStaging();

  // Filtrar propriedades
  const filteredProperties = useMemo(() => {
    if (!pendingProperties) return [];

    return pendingProperties.filter((property) => {
      // Busca por texto
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          property.title?.toLowerCase().includes(query) ||
          property.address_city?.toLowerCase().includes(query) ||
          property.address_neighborhood?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Filtro por estado
      if (stateFilter !== 'all' && property.address_state !== stateFilter) {
        return false;
      }

      // Filtro por tipo
      if (typeFilter !== 'all' && property.type !== typeFilter) {
        return false;
      }

      // Filtro por faixa de preço
      if (priceFilter !== 'all' && property.price) {
        const [min, max] = priceFilter.split('-').map(v => v === '+' ? Infinity : parseInt(v));
        if (priceFilter.includes('+')) {
          if (property.price < parseInt(priceFilter.replace('+', ''))) return false;
        } else {
          if (property.price < min || property.price > max) return false;
        }
      }

      return true;
    });
  }, [pendingProperties, searchQuery, stateFilter, typeFilter, priceFilter]);

  const handleSelectAll = () => {
    if (selectedIds.length === filteredProperties.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProperties.map(p => p.id));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleBulkImport = () => {
    if (selectedIds.length > 0) {
      bulkImportMutation.mutate(selectedIds, {
        onSuccess: () => setSelectedIds([]),
      });
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length > 0) {
      bulkDeleteStagingMutation.mutate(selectedIds, {
        onSuccess: () => {
          setSelectedIds([]);
          setShowDeleteConfirm(false);
        },
      });
    }
  };

  const handleRunScraping = () => {
    if (configs && configs.length > 0) {
      const states = scrapeStateFilter !== 'all' ? [scrapeStateFilter] : undefined;
      const url = showManualUrlInput && manualUrl.trim() ? manualUrl.trim() : undefined;
      
      runScrapingMutation.mutate({
        configId: configs[0].id,
        states,
        manualUrl: url,
      });
    }
  };

  const handleClearAllStaging = () => {
    clearAllStagingMutation.mutate(undefined, {
      onSuccess: () => setShowClearConfirm(false),
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStateFilter('all');
    setTypeFilter('all');
    setPriceFilter('all');
  };

  const hasActiveFilters = searchQuery || stateFilter !== 'all' || typeFilter !== 'all' || priceFilter !== 'all';

  const activeConfig = configs?.[0];
  const recentLogs = logs?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Config & Controls */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Coleta de Imóveis
            </CardTitle>
            <CardDescription>
              Busque imóveis automaticamente ou adicione uma URL manualmente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtro de Estado para Scraping */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado para buscar</label>
              <Select value={scrapeStateFilter} onValueChange={setScrapeStateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados (Nordeste)</SelectItem>
                  {NORTHEAST_STATES.filter(s => s.value !== 'all').map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle URL Manual */}
            <div className="flex items-center gap-2">
              <Button
                variant={showManualUrlInput ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowManualUrlInput(!showManualUrlInput)}
              >
                <Link className="h-4 w-4 mr-2" />
                URL Manual
              </Button>
              <span className="text-xs text-muted-foreground">
                Para buscar em outros sites
              </span>
            </div>

            {/* Input URL Manual */}
            <AnimatePresence>
              {showManualUrlInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2"
                >
                  <Textarea
                    placeholder="Cole a URL aqui... (ex: https://www.leilaoimovel.com.br/...)"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    <Globe className="h-3 w-3 inline mr-1" />
                    A IA tentará extrair os imóveis desta URL
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <Button 
              onClick={handleRunScraping} 
              className="w-full hero-gradient"
              disabled={runScrapingMutation.isPending}
            >
              {runScrapingMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {showManualUrlInput && manualUrl ? 'Buscar da URL' : 'Buscar Novos Imóveis'}
                </>
              )}
            </Button>

            {/* Última execução */}
            {activeConfig?.last_run_at && (
              <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
                <span>Última busca:</span>
                <span>{formatDate(activeConfig.last_run_at)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLogs.length > 0 ? (
              <div className="space-y-2">
                {recentLogs.map(log => (
                  <div 
                    key={log.id} 
                    className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {log.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : log.status === 'running' ? (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      ) : log.status === 'failed' ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="text-muted-foreground">
                        {formatDate(log.started_at)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">{log.properties_new}</span>
                      <span className="text-muted-foreground"> novos</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhuma execução registrada</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              Filtros
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar filtros
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Busca por texto */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Buscar</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cidade, bairro, título..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Filtro de Estado */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Estado</label>
                    <Select value={stateFilter} onValueChange={setStateFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os estados" />
                      </SelectTrigger>
                      <SelectContent>
                        {NORTHEAST_STATES.map((state) => (
                          <SelectItem key={state.value} value={state.value}>
                            {state.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filtro de Tipo */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Tipo de Imóvel</label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os tipos" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROPERTY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filtro de Preço */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Faixa de Preço</label>
                    <Select value={priceFilter} onValueChange={setPriceFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Qualquer valor" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRICE_RANGES.map((range) => (
                          <SelectItem key={range.value} value={range.value}>
                            {range.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Filtros ativos como badges */}
                {hasActiveFilters && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
                    <span className="text-sm text-muted-foreground">Filtros ativos:</span>
                    {searchQuery && (
                      <Badge variant="secondary" className="gap-1">
                        Busca: "{searchQuery}"
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => setSearchQuery('')}
                        />
                      </Badge>
                    )}
                    {stateFilter !== 'all' && (
                      <Badge variant="secondary" className="gap-1">
                        {getStateLabel(stateFilter)}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => setStateFilter('all')}
                        />
                      </Badge>
                    )}
                    {typeFilter !== 'all' && (
                      <Badge variant="secondary" className="gap-1">
                        {getPropertyTypeLabel(typeFilter)}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => setTypeFilter('all')}
                        />
                      </Badge>
                    )}
                    {priceFilter !== 'all' && (
                      <Badge variant="secondary" className="gap-1">
                        {PRICE_RANGES.find(r => r.value === priceFilter)?.label}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => setPriceFilter('all')}
                        />
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Pending Properties */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Imóveis Pendentes de Revisão
              {pendingProperties && pendingProperties.length > 0 && (
                <Badge className="bg-warning/10 text-warning border-0">
                  {filteredProperties.length}
                  {filteredProperties.length !== pendingProperties.length && (
                    <span className="text-muted-foreground ml-1">/ {pendingProperties.length}</span>
                  )}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              
              {/* Limpar tudo */}
              {pendingProperties && pendingProperties.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar Tudo
                </Button>
              )}

              {selectedIds.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Deletar ({selectedIds.length})
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleBulkImport}
                    disabled={bulkImportMutation.isPending}
                    className="hero-gradient"
                  >
                    {bulkImportMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Importar ({selectedIds.length})
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !filteredProperties || filteredProperties.length === 0 ? (
            <div className="text-center py-12">
              {pendingProperties && pendingProperties.length > 0 ? (
                <>
                  <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">Nenhum resultado encontrado</p>
                  <p className="text-muted-foreground mb-4">
                    Tente ajustar os filtros para ver mais imóveis.
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
                  <p className="text-lg font-medium">Tudo em dia!</p>
                  <p className="text-muted-foreground">
                    Não há imóveis pendentes de revisão.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Select All */}
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Checkbox
                  checked={selectedIds.length === filteredProperties.length && filteredProperties.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Selecionar todos ({filteredProperties.length})
                </span>
              </div>

              {/* Property Cards */}
              <AnimatePresence mode="popLayout">
                {filteredProperties.map((property, index) => (
                  <motion.div
                    key={property.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex gap-4 p-4 bg-muted/50 rounded-xl border border-border hover:border-primary/30 transition-colors"
                  >
                    {/* Checkbox */}
                    <div className="flex items-start pt-1">
                      <Checkbox
                        checked={selectedIds.includes(property.id)}
                        onCheckedChange={() => handleSelect(property.id)}
                      />
                    </div>

                    {/* Image */}
                    <div className="w-28 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                      {property.images && property.images.length > 0 && property.images[0] ? (
                        <img
                          src={property.images[0]}
                          alt={property.title || 'Imóvel'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Home className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {getPropertyTypeLabel(property.type)}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {property.address_state}
                            </Badge>
                            {property.alreadyImported && (
                              <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Já Importado
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-medium line-clamp-1">
                            {property.title || 'Imóvel sem título'}
                          </h4>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>
                              {property.address_city || 'Cidade'} - {property.address_state || 'UF'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-primary">
                            {formatPrice(property.price)}
                          </p>
                          {property.discount && property.discount > 0 && (
                            <Badge className="bg-success/10 text-success border-0">
                              <Percent className="h-3 w-3 mr-1" />
                              {property.discount.toFixed(0)}% OFF
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        {property.bedrooms && property.bedrooms > 0 && (
                          <span className="flex items-center gap-1">
                            <Bed className="h-3.5 w-3.5" />
                            {property.bedrooms} quarto{property.bedrooms > 1 ? 's' : ''}
                          </span>
                        )}
                        {property.parking_spaces && property.parking_spaces > 0 && (
                          <span className="flex items-center gap-1">
                            <Car className="h-3.5 w-3.5" />
                            {property.parking_spaces} vaga{property.parking_spaces > 1 ? 's' : ''}
                          </span>
                        )}
                        {property.area && (
                          <span className="flex items-center gap-1">
                            <Ruler className="h-3.5 w-3.5" />
                            {property.area}m²
                          </span>
                        )}
                        {property.accepts_fgts && (
                          <Badge variant="outline" className="text-xs bg-primary/5">FGTS</Badge>
                        )}
                        {property.accepts_financing && (
                          <Badge variant="outline" className="text-xs bg-primary/5">Financiamento</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => importMutation.mutate(property.id)}
                          disabled={importMutation.isPending}
                          className="hero-gradient"
                        >
                          {importMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-1" />
                              Importar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => ignoreMutation.mutate(property.id)}
                          disabled={ignoreMutation.isPending}
                          className="hover:bg-muted"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Ignorar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteStagingMutation.mutate(property.id)}
                          disabled={deleteStagingMutation.isPending}
                          className="text-destructive hover:bg-destructive/10 hover:border-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {property.caixa_link && (
                          <a 
                            href={property.caixa_link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex"
                          >
                            <Button
                              size="sm"
                              variant="ghost"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Ver Original
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clear All Confirmation Dialog */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Limpar Todos os Imóveis?
            </DialogTitle>
            <DialogDescription>
              Esta ação irá remover permanentemente todos os {pendingProperties?.length || 0} imóveis 
              pendentes do staging. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleClearAllStaging}
              disabled={clearAllStagingMutation.isPending}
            >
              {clearAllStagingMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Limpar Tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Deletar Imóveis Selecionados?
            </DialogTitle>
            <DialogDescription>
              Esta ação irá remover permanentemente {selectedIds.length} imóveis selecionados. 
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={bulkDeleteStagingMutation.isPending}
            >
              {bulkDeleteStagingMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Deletar {selectedIds.length} Imóveis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
