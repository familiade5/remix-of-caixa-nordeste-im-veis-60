import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Estados do Nordeste
const NORTHEAST_STATES = ['al', 'ba', 'ce', 'ma', 'pb', 'pe', 'pi', 'rn', 'se'];

// Mapeamento de estado para nome completo
const STATE_NAMES: Record<string, string> = {
  'al': 'Alagoas',
  'ba': 'Bahia',
  'ce': 'Ceará',
  'ma': 'Maranhão',
  'pb': 'Paraíba',
  'pe': 'Pernambuco',
  'pi': 'Piauí',
  'rn': 'Rio Grande do Norte',
  'se': 'Sergipe',
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
  description: string;
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

    console.log('Iniciando scraping real - Venda Direta Caixa, Nordeste');

    const allProperties: CaixaPropertyData[] = [];
    const states = config.states?.map((s: string) => s.toLowerCase()) || NORTHEAST_STATES;
    
    // Limite de imóveis por estado para primeira execução
    const MAX_PROPERTIES_PER_STATE = 10;

    // Buscar imóveis para cada estado do Nordeste
    for (const state of states) {
      console.log(`Buscando imóveis em ${STATE_NAMES[state] || state}...`);
      
      try {
        // URL do agregador para Venda Direta Online da Caixa no estado
        const listUrl = `https://www.vendadiretaimovel.com.br/leilao-de-imoveis/${state}?banco=caixa-economica-federal-cef`;
        
        // Usar Firecrawl para buscar a página de resultados
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: listUrl,
            formats: ['html', 'markdown'],
            waitFor: 2000,
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

        // Extrair links de imóveis individuais
        const propertyLinks = extractPropertyLinks(html, markdown, state);
        console.log(`Encontrados ${propertyLinks.length} links de imóveis em ${STATE_NAMES[state] || state}`);
        
        // Limitar a quantidade de imóveis para não estourar tempo
        const linksToProcess = propertyLinks.slice(0, MAX_PROPERTIES_PER_STATE);
        
        // Buscar detalhes de cada imóvel
        for (const link of linksToProcess) {
          try {
            const property = await fetchPropertyDetails(firecrawlApiKey, link, state);
            if (property) {
              allProperties.push(property);
              console.log(`Coletado: ${property.title}`);
            }
            
            // Pequeno delay entre requisições
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            console.error(`Erro ao buscar detalhes do imóvel:`, err);
          }
        }

        // Delay entre estados
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (err) {
        console.error(`Erro ao processar estado ${state}:`, err);
      }
    }

    console.log(`Total de imóveis coletados com detalhes: ${allProperties.length}`);

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
            address_state: property.state.toUpperCase(),
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            area: property.area,
            parking_spaces: property.parkingSpaces,
            images: property.images,
            description: property.description,
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

function extractPropertyLinks(html: string, markdown: string, state: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  
  // Regex para encontrar links de imóveis individuais no HTML
  const linkRegex = /href="(https:\/\/www\.vendadiretaimovel\.com\.br\/imovel\/[^"]+)"/gi;
  
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    // Filtrar apenas imóveis do estado correto
    if (url.includes(`/imovel/${state}/`) && !seen.has(url)) {
      seen.add(url);
      links.push(url);
    }
  }
  
  // Também buscar no markdown
  const mdLinkRegex = /\(https:\/\/www\.vendadiretaimovel\.com\.br\/imovel\/[^)]+\)/gi;
  while ((match = mdLinkRegex.exec(markdown)) !== null) {
    const url = match[0].slice(1, -1); // Remove parênteses
    if (url.includes(`/imovel/${state}/`) && !seen.has(url)) {
      seen.add(url);
      links.push(url);
    }
  }
  
  return links;
}

async function fetchPropertyDetails(
  apiKey: string, 
  url: string, 
  state: string
): Promise<CaixaPropertyData | null> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['html', 'markdown'],
        waitFor: 2000,
        onlyMainContent: false,
      }),
    });

    if (!response.ok) {
      console.error(`Erro ao buscar detalhes: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const html = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';

    return parsePropertyDetails(html, markdown, url, state);
  } catch (err) {
    console.error('Erro ao buscar detalhes:', err);
    return null;
  }
}

function parsePropertyDetails(
  html: string, 
  markdown: string, 
  url: string, 
  state: string
): CaixaPropertyData | null {
  try {
    // Extrair ID do imóvel da URL
    const idMatch = url.match(/(\d+)$/);
    const id = idMatch ? idMatch[1] : `caixa_${Date.now()}`;
    
    // Extrair título (formato: "Casa Caixa em Salvador / BA - 2447394")
    const titleMatch = markdown.match(/##?\s*((?:Casa|Apartamento|Terreno|Comercial)[^#\n]+)/i);
    let title = titleMatch ? titleMatch[1].trim() : '';
    
    // Limpar título
    title = title.replace(/\\/g, '').replace(/\s+/g, ' ').trim();
    
    // Extrair tipo de imóvel
    let type = 'casa';
    const typeLower = title.toLowerCase();
    if (typeLower.includes('apartamento')) type = 'apartamento';
    else if (typeLower.includes('terreno')) type = 'terreno';
    else if (typeLower.includes('comercial') || typeLower.includes('sala') || typeLower.includes('loja')) type = 'comercial';
    
    // Extrair preços
    const priceMatches = markdown.match(/R\$\s*([\d.,]+)/g) || [];
    let price = 0;
    let originalPrice = 0;
    
    if (priceMatches.length >= 2) {
      // Primeiro preço geralmente é o valor atual, segundo é o avaliado
      price = parsePrice(priceMatches[0] || '0');
      originalPrice = parsePrice(priceMatches[1] || '0');
      
      // Se o segundo for maior, está correto; senão inverte
      if (originalPrice < price) {
        [price, originalPrice] = [originalPrice, price];
      }
    } else if (priceMatches.length === 1) {
      price = parsePrice(priceMatches[0]);
      originalPrice = price;
    }
    
    // Calcular desconto
    const discount = originalPrice > 0 ? Math.round((1 - price / originalPrice) * 100) : 0;
    
    // Extrair endereço
    const addressMatch = markdown.match(/(?:RUA|AVENIDA|ALAMEDA|TRAVESSA|ESTRADA|QUADRA|LOTEAMENTO)[^\n]+CEP:\s*[\d-]+[^-\n]+-\s*([A-Z\s]+)/i);
    let address = '';
    let city = '';
    let neighborhood = '';
    
    if (addressMatch) {
      address = addressMatch[0].replace(/\\/g, '').trim();
      // Extrair cidade do final do endereço
      const cityMatch = address.match(/,\s*([^-,]+)\s*-\s*[A-Z]{2,}$/i);
      if (cityMatch) {
        city = cityMatch[1].trim();
      }
    }
    
    // Tentar extrair bairro
    const neighborhoodMatch = markdown.match(/\[\/([^\]]+)\]\(https:\/\/www\.vendadiretaimovel\.com\.br\/leilao-de-imovel\/[a-z]{2}\/[^\/]+\/[^\)]+\)/i);
    if (neighborhoodMatch) {
      neighborhood = neighborhoodMatch[1].trim();
    }
    
    // Extrair cidade da URL ou título
    const cityFromUrl = url.match(/\/imovel\/[a-z]{2}\/([^\/]+)\//);
    if (cityFromUrl && !city) {
      city = cityFromUrl[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Extrair área
    let area = 0;
    const areaMatch = markdown.match(/Área\s*(?:Útil|Privativa)?:?\s*[\s\S]*?([\d.,]+)\s*m[²2]/i);
    if (areaMatch) {
      area = parseFloat(areaMatch[1].replace('.', '').replace(',', '.'));
    }
    
    // Extrair vagas
    let parkingSpaces: number | null = null;
    const vagasMatch = markdown.match(/Vagas?:?\s*[\s\S]*?(\d+)/i);
    if (vagasMatch) {
      parkingSpaces = parseInt(vagasMatch[1]);
    }
    
    // Extrair quartos (se houver)
    let bedrooms: number | null = null;
    const bedroomsMatch = markdown.match(/(\d+)\s*(?:quartos?|dormit[óo]rios?|qto)/i);
    if (bedroomsMatch) {
      bedrooms = parseInt(bedroomsMatch[1]);
    }
    
    // Verificar FGTS e Financiamento
    const acceptsFgts = !markdown.toLowerCase().includes('não aceita fgts') && 
                        (markdown.toLowerCase().includes('fgts') || markdown.toLowerCase().includes('aceita fgts'));
    const acceptsFinancing = !markdown.toLowerCase().includes('não aceita financiamento') && 
                             (markdown.toLowerCase().includes('financiamento') || markdown.toLowerCase().includes('financ'));
    
    // Extrair imagens
    const images: string[] = [];
    const imageRegex = /https:\/\/image\.leilaoimovel\.com\.br\/images\/[^\s"')]+\.webp/gi;
    let imgMatch;
    const seenImages = new Set<string>();
    while ((imgMatch = imageRegex.exec(html + markdown)) !== null) {
      const img = imgMatch[0];
      // Preferir imagens grandes (-g.webp)
      const largeImg = img.replace(/-m\.webp$/, '-g.webp');
      if (!seenImages.has(largeImg)) {
        seenImages.add(largeImg);
        images.push(largeImg);
      }
    }
    
    // Extrair descrição
    let description = '';
    const descMatch = markdown.match(/\*\*Descrição:\*\*\s*([^\n]+)/i);
    if (descMatch) {
      description = descMatch[1].trim();
    }
    
    // Extrair link original da Caixa (matrícula)
    let caixaLink = url;
    const matriculaMatch = markdown.match(/https:\/\/venda-imoveis\.caixa\.gov\.br\/[^\s"')]+/);
    if (matriculaMatch) {
      caixaLink = matriculaMatch[0];
    }
    
    // Validar dados mínimos
    if (!title || price === 0) {
      console.log('Dados insuficientes para imóvel:', url);
      return null;
    }
    
    return {
      id: `vdi_${id}`,
      title: title.substring(0, 200),
      type,
      price,
      originalPrice,
      discount,
      city,
      state: state.toUpperCase(),
      neighborhood,
      address,
      bedrooms,
      bathrooms: null,
      area,
      parkingSpaces,
      acceptsFgts,
      acceptsFinancing,
      modality: 'Venda Direta Online',
      caixaLink,
      images: images.slice(0, 10), // Limitar a 10 imagens
      description,
    };
  } catch (err) {
    console.error('Erro ao parsear detalhes:', err);
    return null;
  }
}

function parsePrice(priceStr: string): number {
  // Remove "R$" e espaços, converte para número
  const cleaned = priceStr.replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}
