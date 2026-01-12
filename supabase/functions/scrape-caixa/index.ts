import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Estados do Nordeste
const NORTHEAST_STATES = ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'];

// Mapeamento de tipo de imóvel
const PROPERTY_TYPE_MAP: Record<string, string> = {
  'casa': 'casa',
  'apartamento': 'apartamento',
  'apto': 'apartamento',
  'terreno': 'terreno',
  'lote': 'terreno',
  'sala': 'comercial',
  'comercial': 'comercial',
  'loja': 'comercial',
  'galpão': 'comercial',
  'galpao': 'comercial',
};

interface CaixaPropertyData {
  id: string;
  title: string;
  type: string;
  price: number;
  originalPrice: number;
  discount: number;
  city: string;
  state: string;
  neighborhood: string;
  address: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number;
  parkingSpaces: number | null;
  acceptsFgts: boolean;
  acceptsFinancing: boolean;
  modality: string;
  caixaLink: string;
  images: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY não configurada');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { configId } = await req.json();

    // Buscar configuração de scraping
    const { data: config, error: configError } = await supabase
      .from('scraping_config')
      .select('*')
      .eq('id', configId)
      .single();

    if (configError || !config) {
      console.error('Config error:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar log de execução
    const { data: logEntry, error: logError } = await supabase
      .from('scraping_logs')
      .insert({
        config_id: configId,
        status: 'running',
        properties_found: 0,
        properties_new: 0,
      })
      .select()
      .single();

    if (logError) {
      console.error('Log creation error:', logError);
    }

    console.log('Iniciando scraping real da Caixa - Venda Direta, Nordeste');

    const allProperties: CaixaPropertyData[] = [];
    const states = config.states || NORTHEAST_STATES;

    // Buscar imóveis para cada estado do Nordeste
    for (const state of states) {
      console.log(`Buscando imóveis em ${state}...`);
      
      try {
        // URL da Caixa para Venda Direta Online (código 35) no estado
        const searchUrl = `https://venda-imoveis.caixa.gov.br/sistema/busca-imovel.asp?sltTipoBusca=imoveis&sltEstado=${state}&hdnOrigem=index&hdnNumTipoVenda=35`;
        
        // Usar Firecrawl para buscar a página de resultados
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: searchUrl,
            formats: ['html', 'markdown'],
            waitFor: 3000,
            onlyMainContent: false,
          }),
        });

        if (!scrapeResponse.ok) {
          console.error(`Erro ao buscar ${state}:`, await scrapeResponse.text());
          continue;
        }

        const scrapeData = await scrapeResponse.json();
        const html = scrapeData.data?.html || scrapeData.html || '';
        const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';

        // Parsear os imóveis da resposta
        const properties = parsePropertiesFromHtml(html, markdown, state);
        console.log(`Encontrados ${properties.length} imóveis em ${state}`);
        
        allProperties.push(...properties);

        // Pequeno delay entre requisições para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        console.error(`Erro ao processar estado ${state}:`, err);
      }
    }

    console.log(`Total de imóveis encontrados: ${allProperties.length}`);

    let propertiesFound = allProperties.length;
    let propertiesNew = 0;

    // Inserir imóveis no staging
    for (const property of allProperties) {
      // Verificar se já existe
      const { data: existingStaging } = await supabase
        .from('staging_properties')
        .select('id')
        .eq('external_id', property.id)
        .maybeSingle();

      const { data: existingProperty } = await supabase
        .from('properties')
        .select('id')
        .eq('external_id', property.id)
        .maybeSingle();

      if (!existingStaging && !existingProperty) {
        const { error: insertError } = await supabase
          .from('staging_properties')
          .insert({
            external_id: property.id,
            raw_data: property,
            title: property.title,
            type: property.type,
            price: property.price,
            original_price: property.originalPrice,
            discount: property.discount,
            address_neighborhood: property.neighborhood,
            address_city: property.city,
            address_state: property.state,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            area: property.area,
            parking_spaces: property.parkingSpaces,
            images: property.images,
            description: `Imóvel disponível pela Caixa Econômica Federal - Venda Direta. ${property.address}`,
            accepts_fgts: property.acceptsFgts,
            accepts_financing: property.acceptsFinancing,
            modality: property.modality,
            caixa_link: property.caixaLink,
            status: 'pending',
          });

        if (!insertError) {
          propertiesNew++;
        } else {
          console.error('Insert error:', insertError);
        }
      }
    }

    // Atualizar log e config
    if (logEntry) {
      await supabase
        .from('scraping_logs')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
          properties_found: propertiesFound,
          properties_new: propertiesNew,
        })
        .eq('id', logEntry.id);
    }

    await supabase
      .from('scraping_config')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', configId);

    console.log(`Scraping concluído: ${propertiesFound} encontrados, ${propertiesNew} novos`);

    return new Response(
      JSON.stringify({
        success: true,
        propertiesFound,
        propertiesNew,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scraping error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parsePropertiesFromHtml(html: string, markdown: string, state: string): CaixaPropertyData[] {
  const properties: CaixaPropertyData[] = [];
  
  try {
    // Regex para encontrar links de imóveis individuais
    const propertyLinkRegex = /detalhe-imovel\.asp\?[^"'\s]*(hdnimovel|hdnImovel)=(\d+)/gi;
    const matches = html.matchAll(propertyLinkRegex);
    const foundIds = new Set<string>();
    
    for (const match of matches) {
      const imovelId = match[2];
      if (!foundIds.has(imovelId)) {
        foundIds.add(imovelId);
      }
    }

    // Para cada imóvel encontrado, extrair informações do HTML
    // Procurar por padrões de cards de imóveis no HTML da Caixa
    const cardPatterns = [
      // Padrão 1: Div com informações do imóvel
      /<div[^>]*class="[^"]*card[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      // Padrão 2: Article com imóvel
      /<article[^>]*>[\s\S]*?<\/article>/gi,
      // Padrão 3: Lista de imóveis
      /<li[^>]*class="[^"]*imovel[^"]*"[^>]*>[\s\S]*?<\/li>/gi,
    ];

    // Extrair informações do markdown também
    const lines = markdown.split('\n');
    let currentProperty: Partial<CaixaPropertyData> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Detectar início de novo imóvel
      if (line.includes('R$') && line.includes(',')) {
        // Extrair valor
        const priceMatch = line.match(/R\$\s*([\d.,]+)/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
          
          if (currentProperty && currentProperty.id) {
            properties.push(currentProperty as CaixaPropertyData);
          }
          
          currentProperty = {
            id: `caixa_${Date.now()}_${properties.length}`,
            price: price,
            originalPrice: price,
            discount: 0,
            state: state,
            city: '',
            neighborhood: '',
            address: '',
            title: '',
            type: 'casa',
            bedrooms: null,
            bathrooms: null,
            area: 0,
            parkingSpaces: null,
            acceptsFgts: false,
            acceptsFinancing: false,
            modality: 'Venda Direta',
            caixaLink: `https://venda-imoveis.caixa.gov.br/sistema/busca-imovel.asp?sltEstado=${state}`,
            images: [],
          };
        }
      }

      // Extrair tipo de imóvel
      const lowerLine = line.toLowerCase();
      for (const [keyword, type] of Object.entries(PROPERTY_TYPE_MAP)) {
        if (lowerLine.includes(keyword)) {
          if (currentProperty) {
            currentProperty.type = type;
          }
          break;
        }
      }

      // Extrair quartos
      const bedroomMatch = line.match(/(\d+)\s*(quartos?|dormit[oó]rios?)/i);
      if (bedroomMatch && currentProperty) {
        currentProperty.bedrooms = parseInt(bedroomMatch[1]);
      }

      // Extrair área
      const areaMatch = line.match(/([\d.,]+)\s*m[²2]/i);
      if (areaMatch && currentProperty) {
        currentProperty.area = parseFloat(areaMatch[1].replace(',', '.'));
      }

      // Extrair cidade
      const cityStateMatch = line.match(/([A-Za-zÀ-ÿ\s]+)\s*[-–]\s*([A-Z]{2})/);
      if (cityStateMatch && currentProperty) {
        currentProperty.city = cityStateMatch[1].trim();
        if (cityStateMatch[2] === state) {
          currentProperty.state = cityStateMatch[2];
        }
      }

      // Detectar FGTS
      if (lowerLine.includes('fgts')) {
        if (currentProperty) currentProperty.acceptsFgts = true;
      }

      // Detectar Financiamento
      if (lowerLine.includes('financ')) {
        if (currentProperty) currentProperty.acceptsFinancing = true;
      }

      // Extrair desconto
      const discountMatch = line.match(/([\d.,]+)\s*%\s*(desc|off|abaixo)/i);
      if (discountMatch && currentProperty) {
        currentProperty.discount = parseFloat(discountMatch[1].replace(',', '.'));
      }
    }

    // Adicionar último imóvel
    if (currentProperty && currentProperty.id) {
      properties.push(currentProperty as CaixaPropertyData);
    }

    // Se não encontrou pelo markdown, tentar criar propriedades a partir dos IDs
    if (properties.length === 0 && foundIds.size > 0) {
      for (const id of foundIds) {
        properties.push({
          id: id,
          title: `Imóvel Caixa - ${state}`,
          type: 'casa',
          price: 0,
          originalPrice: 0,
          discount: 0,
          city: state,
          state: state,
          neighborhood: 'Centro',
          address: `${state} - Brasil`,
          bedrooms: null,
          bathrooms: null,
          area: 0,
          parkingSpaces: null,
          acceptsFgts: true,
          acceptsFinancing: true,
          modality: 'Venda Direta',
          caixaLink: `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel=${id}`,
          images: [],
        });
      }
    }

    // Gerar títulos para propriedades
    properties.forEach(prop => {
      if (!prop.title || prop.title.includes('Imóvel Caixa')) {
        const typeLabel = prop.type === 'casa' ? 'Casa' :
                         prop.type === 'apartamento' ? 'Apartamento' :
                         prop.type === 'terreno' ? 'Terreno' :
                         prop.type === 'comercial' ? 'Comercial' : 'Imóvel';
        
        const bedroomInfo = prop.bedrooms ? `${prop.bedrooms} Quarto${prop.bedrooms > 1 ? 's' : ''}` : '';
        const location = prop.neighborhood || prop.city || state;
        
        prop.title = bedroomInfo 
          ? `${typeLabel} ${bedroomInfo} - ${location}`
          : `${typeLabel} - ${location}`;
      }
    });

  } catch (err) {
    console.error('Erro ao parsear HTML:', err);
  }

  return properties;
}
