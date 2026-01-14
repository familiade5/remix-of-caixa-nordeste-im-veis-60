import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DbProperty {
  id: string;
  external_id: string | null;
  title: string;
  type: string;
  status: string;
  price: number;
  original_price: number | null;
  discount: number | null;
  address_street: string | null;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_zipcode: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number;
  parking_spaces: number | null;
  images: string[];
  description: string | null;
  accepts_fgts: boolean;
  accepts_financing: boolean;
  auction_date: string | null;
  modality: string | null;
  caixa_link: string | null;
  created_at: string;
  updated_at: string;
  sold_at: string | null;
}

export interface StagingProperty {
  id: string;
  external_id: string;
  raw_data: any;
  title: string | null;
  type: string | null;
  price: number | null;
  original_price: number | null;
  discount: number | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  parking_spaces: number | null;
  images: string[];
  description: string | null;
  accepts_fgts: boolean;
  accepts_financing: boolean;
  auction_date: string | null;
  modality: string | null;
  caixa_link: string | null;
  status: string;
  scraped_at: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface ScrapingConfig {
  id: string;
  name: string;
  states: string[];
  property_types: string[];
  modalities: string[];
  min_price: number;
  max_price: number;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScrapingLog {
  id: string;
  config_id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  properties_found: number;
  properties_new: number;
  error_message: string | null;
  created_at: string;
}

// Hook para buscar propriedades
export function useDbProperties() {
  return useQuery({
    queryKey: ['db-properties'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DbProperty[];
    },
  });
}

// Hook para buscar propriedades no staging com verificação de duplicatas
export function useStagingProperties(status: string = 'pending') {
  return useQuery({
    queryKey: ['staging-properties', status],
    queryFn: async () => {
      // Buscar staging properties
      const { data: stagingData, error: stagingError } = await supabase
        .from('staging_properties')
        .select('*')
        .eq('status', status)
        .order('scraped_at', { ascending: false });

      if (stagingError) throw stagingError;

      // Buscar external_ids das propriedades já importadas
      const { data: importedData } = await supabase
        .from('properties')
        .select('external_id');

      const importedExternalIds = new Set(
        importedData?.map(p => p.external_id).filter(Boolean) || []
      );

      // Marcar quais já foram importadas
      return (stagingData || []).map(property => ({
        ...property,
        alreadyImported: importedExternalIds.has(property.external_id),
      })) as (StagingProperty & { alreadyImported: boolean })[];
    },
    staleTime: 10000, // 10 segundos
  });
}

// Hook para buscar configurações de scraping
export function useScrapingConfigs() {
  return useQuery({
    queryKey: ['scraping-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scraping_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ScrapingConfig[];
    },
  });
}

// Hook para buscar logs de scraping
export function useScrapingLogs(configId?: string) {
  return useQuery({
    queryKey: ['scraping-logs', configId],
    queryFn: async () => {
      let query = supabase
        .from('scraping_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

      if (configId) {
        query = query.eq('config_id', configId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ScrapingLog[];
    },
    staleTime: 30000, // 30 segundos - evita refetch contínuo
    refetchInterval: false, // Desabilita refetch automático
  });
}

// Hook para executar scraping com opções
export function useRunScraping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      configId, 
      states, 
      manualUrl 
    }: { 
      configId: string; 
      states?: string[];
      manualUrl?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('scrape-caixa', {
        body: { configId, states, manualUrl },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Scraping concluído: ${data.propertiesNew} novos imóveis encontrados`);
      queryClient.invalidateQueries({ queryKey: ['staging-properties'] });
      queryClient.invalidateQueries({ queryKey: ['scraping-logs'] });
      queryClient.invalidateQueries({ queryKey: ['scraping-configs'] });
    },
    onError: (error) => {
      toast.error('Erro ao executar scraping: ' + error.message);
    },
  });
}

// Hook para importar imóvel do staging
export function useImportProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stagingId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-staging', {
        body: { action: 'import', stagingId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Imóvel importado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['staging-properties'] });
      queryClient.invalidateQueries({ queryKey: ['db-properties'] });
    },
    onError: (error) => {
      toast.error('Erro ao importar imóvel: ' + error.message);
    },
  });
}

// Hook para ignorar imóvel do staging
export function useIgnoreProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stagingId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-staging', {
        body: { action: 'ignore', stagingId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Imóvel ignorado');
      queryClient.invalidateQueries({ queryKey: ['staging-properties'] });
    },
    onError: (error) => {
      toast.error('Erro ao ignorar imóvel: ' + error.message);
    },
  });
}

// Hook para deletar imóvel do staging
export function useDeleteStagingProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stagingId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-staging', {
        body: { action: 'delete-staging', stagingId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Imóvel removido do staging');
      queryClient.invalidateQueries({ queryKey: ['staging-properties'] });
    },
    onError: (error) => {
      toast.error('Erro ao deletar imóvel: ' + error.message);
    },
  });
}

// Hook para deletar imóvel importado
export function useDeleteProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (propertyId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-staging', {
        body: { action: 'delete-property', propertyId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Imóvel deletado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['db-properties'] });
    },
    onError: (error) => {
      toast.error('Erro ao deletar imóvel: ' + error.message);
    },
  });
}

// Hook para deletar múltiplos imóveis do staging
export function useBulkDeleteStaging() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stagingIds: string[]) => {
      const { data, error } = await supabase.functions.invoke('manage-staging', {
        body: { action: 'bulk-delete-staging', updates: { stagingIds } },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.deleted} imóveis removidos do staging`);
      queryClient.invalidateQueries({ queryKey: ['staging-properties'] });
    },
    onError: (error) => {
      toast.error('Erro ao deletar imóveis: ' + error.message);
    },
  });
}

// Hook para atualizar status de propriedade
export function useUpdatePropertyStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, status }: { propertyId: string; status: 'available' | 'sold' }) => {
      const { data, error } = await supabase.functions.invoke('manage-staging', {
        body: { 
          action: 'update-property-status', 
          propertyId, 
          updates: { status } 
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.status === 'sold' ? 'Imóvel marcado como vendido!' : 'Imóvel reativado!');
      queryClient.invalidateQueries({ queryKey: ['db-properties'] });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });
}

// Hook para importação em massa
export function useBulkImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stagingIds: string[]) => {
      const { data, error } = await supabase.functions.invoke('manage-staging', {
        body: { 
          action: 'bulk-import', 
          updates: { stagingIds } 
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.imported} imóveis importados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['staging-properties'] });
      queryClient.invalidateQueries({ queryKey: ['db-properties'] });
    },
    onError: (error) => {
      toast.error('Erro na importação em massa: ' + error.message);
    },
  });
}

// Hook para limpar todo o staging
export function useClearAllStaging() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-staging', {
        body: { action: 'clear-all-staging' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.deleted} imóveis removidos do staging`);
      queryClient.invalidateQueries({ queryKey: ['staging-properties'] });
    },
    onError: (error) => {
      toast.error('Erro ao limpar staging: ' + error.message);
    },
  });
}

// Hook para limpar todas as propriedades importadas
export function useClearAllProperties() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-staging', {
        body: { action: 'clear-all-properties' },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.deleted} imóveis deletados`);
      queryClient.invalidateQueries({ queryKey: ['db-properties'] });
    },
    onError: (error) => {
      toast.error('Erro ao limpar imóveis: ' + error.message);
    },
  });
}
