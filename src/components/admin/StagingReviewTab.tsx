import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  useStagingProperties, 
  useImportProperty, 
  useIgnoreProperty, 
  useBulkImport,
  useScrapingConfigs,
  useScrapingLogs,
  useRunScraping,
} from '@/hooks/useProperties';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from 'lucide-react';

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

export function StagingReviewTab() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('pending');

  const { data: pendingProperties, isLoading, refetch } = useStagingProperties('pending');
  const { data: configs } = useScrapingConfigs();
  const { data: logs } = useScrapingLogs();

  const importMutation = useImportProperty();
  const ignoreMutation = useIgnoreProperty();
  const bulkImportMutation = useBulkImport();
  const runScrapingMutation = useRunScraping();

  const handleSelectAll = () => {
    if (selectedIds.length === pendingProperties?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingProperties?.map(p => p.id) || []);
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

  const handleRunScraping = () => {
    if (configs && configs.length > 0) {
      runScrapingMutation.mutate(configs[0].id);
    }
  };

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
              Coleta Automática
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeConfig ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Configuração:</span>
                  <span className="font-medium">{activeConfig.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estados:</span>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {activeConfig.states.slice(0, 5).map(s => (
                      <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                    {activeConfig.states.length > 5 && (
                      <Badge variant="secondary" className="text-xs">+{activeConfig.states.length - 5}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Última execução:</span>
                  <span className="font-medium">{formatDate(activeConfig.last_run_at)}</span>
                </div>
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
                      Buscar Novos Imóveis
                    </>
                  )}
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhuma configuração encontrada</p>
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
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
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

      {/* Pending Properties */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Imóveis Pendentes de Revisão
              {pendingProperties && pendingProperties.length > 0 && (
                <Badge className="bg-warning/10 text-warning border-0">
                  {pendingProperties.length}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {selectedIds.length > 0 && (
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
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !pendingProperties || pendingProperties.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
              <p className="text-lg font-medium">Tudo em dia!</p>
              <p className="text-muted-foreground">
                Não há imóveis pendentes de revisão.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Select All */}
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Checkbox
                  checked={selectedIds.length === pendingProperties.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  Selecionar todos
                </span>
              </div>

              {/* Property Cards */}
              <AnimatePresence mode="popLayout">
                {pendingProperties.map((property, index) => (
                  <motion.div
                    key={property.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex gap-4 p-4 bg-muted/50 rounded-xl border border-border"
                  >
                    {/* Checkbox */}
                    <div className="flex items-start pt-1">
                      <Checkbox
                        checked={selectedIds.includes(property.id)}
                        onCheckedChange={() => handleSelect(property.id)}
                      />
                    </div>

                    {/* Image */}
                    <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                      {property.images && property.images.length > 0 ? (
                        <img
                          src={property.images[0]}
                          alt={property.title || 'Imóvel'}
                          className="w-full h-full object-cover"
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
                        {property.bedrooms && (
                          <span className="flex items-center gap-1">
                            <Bed className="h-3.5 w-3.5" />
                            {property.bedrooms}
                          </span>
                        )}
                        {property.parking_spaces && (
                          <span className="flex items-center gap-1">
                            <Car className="h-3.5 w-3.5" />
                            {property.parking_spaces}
                          </span>
                        )}
                        {property.area && (
                          <span className="flex items-center gap-1">
                            <Ruler className="h-3.5 w-3.5" />
                            {property.area}m²
                          </span>
                        )}
                        {property.accepts_fgts && (
                          <Badge variant="outline" className="text-xs">FGTS</Badge>
                        )}
                        {property.accepts_financing && (
                          <Badge variant="outline" className="text-xs">Financiamento</Badge>
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
                        >
                          <X className="h-4 w-4 mr-1" />
                          Ignorar
                        </Button>
                        {property.caixa_link && (
                          <Button
                            size="sm"
                            variant="ghost"
                            asChild
                          >
                            <a 
                              href={property.caixa_link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Ver na Caixa
                            </a>
                          </Button>
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
    </div>
  );
}
