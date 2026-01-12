-- Tabela principal de imóveis (migrar do mock)
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('casa', 'apartamento', 'terreno', 'comercial')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold')),
  price NUMERIC NOT NULL,
  original_price NUMERIC,
  discount NUMERIC,
  address_street TEXT,
  address_neighborhood TEXT NOT NULL,
  address_city TEXT NOT NULL,
  address_state TEXT NOT NULL CHECK (address_state IN ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')),
  address_zipcode TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  area NUMERIC NOT NULL,
  parking_spaces INTEGER,
  images TEXT[] DEFAULT '{}',
  description TEXT,
  accepts_fgts BOOLEAN DEFAULT false,
  accepts_financing BOOLEAN DEFAULT false,
  auction_date DATE,
  modality TEXT,
  caixa_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sold_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de staging para imóveis pendentes de revisão
CREATE TABLE public.staging_properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE NOT NULL,
  raw_data JSONB NOT NULL,
  title TEXT,
  type TEXT,
  price NUMERIC,
  original_price NUMERIC,
  discount NUMERIC,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  area NUMERIC,
  parking_spaces INTEGER,
  images TEXT[] DEFAULT '{}',
  description TEXT,
  accepts_fgts BOOLEAN DEFAULT false,
  accepts_financing BOOLEAN DEFAULT false,
  auction_date DATE,
  modality TEXT,
  caixa_link TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'imported', 'ignored')),
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configuração de scraping
CREATE TABLE public.scraping_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  states TEXT[] DEFAULT '{"AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"}',
  property_types TEXT[] DEFAULT '{"casa", "apartamento", "terreno", "comercial"}',
  modalities TEXT[] DEFAULT '{"Venda Direta Online", "Leilão SFI - Edital Único"}',
  min_price NUMERIC DEFAULT 0,
  max_price NUMERIC DEFAULT 1000000,
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de logs de execução do scraping
CREATE TABLE public.scraping_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID REFERENCES public.scraping_config(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  properties_found INTEGER DEFAULT 0,
  properties_new INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (tabelas públicas para leitura, protegidas para escrita via edge function)
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_logs ENABLE ROW LEVEL SECURITY;

-- Properties: leitura pública
CREATE POLICY "Properties are viewable by everyone"
ON public.properties FOR SELECT
USING (true);

-- Staging: leitura pública (para admin review)
CREATE POLICY "Staging properties viewable by everyone"
ON public.staging_properties FOR SELECT
USING (true);

-- Scraping config: leitura pública
CREATE POLICY "Scraping config viewable by everyone"
ON public.scraping_config FOR SELECT
USING (true);

-- Scraping logs: leitura pública
CREATE POLICY "Scraping logs viewable by everyone"
ON public.scraping_logs FOR SELECT
USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scraping_config_updated_at
  BEFORE UPDATE ON public.scraping_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração padrão de scraping
INSERT INTO public.scraping_config (name, states, property_types, modalities, min_price, max_price)
VALUES (
  'Nordeste - Padrão',
  ARRAY['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  ARRAY['casa', 'apartamento', 'terreno', 'comercial'],
  ARRAY['Venda Direta Online', 'Leilão SFI - Edital Único'],
  0,
  1000000
);

-- Habilitar realtime para staging (notificações de novos imóveis)
ALTER PUBLICATION supabase_realtime ADD TABLE public.staging_properties;