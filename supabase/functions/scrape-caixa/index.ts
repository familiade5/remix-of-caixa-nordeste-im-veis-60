import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Estados do Nordeste com seus códigos IBGE
const NORTHEAST_STATES = [
  { uf: 'AL', code: '27', name: 'Alagoas' },
  { uf: 'BA', code: '29', name: 'Bahia' },
  { uf: 'CE', code: '23', name: 'Ceará' },
  { uf: 'MA', code: '21', name: 'Maranhão' },
  { uf: 'PB', code: '25', name: 'Paraíba' },
  { uf: 'PE', code: '26', name: 'Pernambuco' },
  { uf: 'PI', code: '22', name: 'Piauí' },
  { uf: 'RN', code: '24', name: 'Rio Grande do Norte' },
  { uf: 'SE', code: '28', name: 'Sergipe' },
];

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
  areaTerreno: number | null;
  parkingSpaces: number | null;
  acceptsFgts: boolean;
  acceptsFinancing: boolean;
  modality: string;
  caixaLink: string;
  images: string[];
  description: string;
  auctionDate: string | null;
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

    console.log('Iniciando scraping - leilaoimovel.com.br (Imóveis Caixa Nordeste)');

    const allProperties: CaixaPropertyData[] = [];
    
    // Filtrar estados do config
    const configStates = config.states?.map((s: string) => s.toUpperCase()) || ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'];
    const statesToScrape = NORTHEAST_STATES.filter(s => configStates.includes(s.uf));
    
    // Buscar imóveis para cada estado
    for (const stateInfo of statesToScrape) {
      console.log(`\n🔍 Buscando imóveis em ${stateInfo.name}...`);
      
      try {
        // URL do leilaoimovel.com.br para Venda Direta Caixa no estado
        // venda=7,8 = Venda Direta Online e Licitação Aberta
        const listUrl = `https://www.leilaoimovel.com.br/caixa/imoveis-caixa-${stateInfo.uf.toLowerCase()}?venda=7,8&estado=${stateInfo.code}`;
        
        console.log(`URL: ${listUrl}`);
        
        // Usar Firecrawl para buscar a página de resultados
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: listUrl,
            formats: ['html'],
            waitFor: 3000,
            onlyMainContent: false,
          }),
        });

        if (!scrapeResponse.ok) {
          console.error(`Erro ao buscar ${stateInfo.uf}:`, await scrapeResponse.text());
          continue;
        }

        const scrapeData = await scrapeResponse.json();
        const html = scrapeData.data?.html || scrapeData.html || '';

        // Extrair links de imóveis individuais
        const propertyLinks = extractPropertyLinks(html);
        console.log(`📦 Encontrados ${propertyLinks.length} imóveis em ${stateInfo.name}`);
        
        // Processar cada imóvel
        let processedCount = 0;
        for (const link of propertyLinks) {
          try {
            const property = await fetchPropertyDetails(firecrawlApiKey, link, stateInfo.uf);
            if (property) {
              allProperties.push(property);
              processedCount++;
              console.log(`  ✓ [${processedCount}/${propertyLinks.length}] ${property.title?.substring(0, 50)}...`);
            }
            
            // Pequeno delay entre requisições
            await new Promise(resolve => setTimeout(resolve, 400));
          } catch (err) {
            console.error(`  ✗ Erro ao buscar detalhes:`, err);
          }
        }

        // Delay entre estados
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`Erro ao processar ${stateInfo.uf}:`, err);
      }
    }

    console.log(`\n📊 Total de imóveis coletados: ${allProperties.length}`);

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
            area: property.area || property.areaTerreno || 0,
            parking_spaces: property.parkingSpaces,
            images: property.images,
            description: property.description,
            accepts_fgts: property.acceptsFgts,
            accepts_financing: property.acceptsFinancing,
            modality: property.modality,
            caixa_link: property.caixaLink,
            auction_date: property.auctionDate,
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

    console.log(`\n✅ Scraping concluído: ${propertiesFound} encontrados, ${propertiesNew} novos`);

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

function extractPropertyLinks(html: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  
  // Regex para encontrar links de imóveis individuais
  // Formato: /imovel/{uf}/{cidade}/{slug}-{id}-{codigo}-venda-direta-caixa
  const linkRegex = /href="(https:\/\/www\.leilaoimovel\.com\.br\/imovel\/[a-z]{2}\/[^"]+(?:venda-direta-caixa|venda-online-caixa)[^"]*)"/gi;
  
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    if (!seen.has(url)) {
      seen.add(url);
      links.push(url);
    }
  }
  
  // Também buscar outros formatos de link de imóvel Caixa
  const altLinkRegex = /href="(https:\/\/www\.leilaoimovel\.com\.br\/imovel\/[a-z]{2}\/[^"]*caixa[^"]*)"/gi;
  while ((match = altLinkRegex.exec(html)) !== null) {
    const url = match[1];
    if (!seen.has(url)) {
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
        formats: ['html'],
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

    return parsePropertyDetails(html, url, state);
  } catch (err) {
    console.error('Erro ao buscar detalhes:', err);
    return null;
  }
}

function parsePropertyDetails(
  html: string, 
  url: string, 
  state: string
): CaixaPropertyData | null {
  try {
    // Extrair ID do imóvel da URL (formato: ...-1580032-8444405978325-venda-direta-caixa)
    const idMatch = url.match(/-(\d{6,})-(\d+)-(?:venda|leilao)/i);
    const id = idMatch ? `${idMatch[1]}-${idMatch[2]}` : `caixa_${Date.now()}`;
    
    // Extrair título do h1 ou h2
    // Formato: "Casa Caixa em Fortaleza / CE - 1580032"
    let title = '';
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      title = h1Match[1].trim();
    } else {
      const h2Match = html.match(/<h2[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h2>/i);
      if (h2Match) {
        title = h2Match[1].trim();
      }
    }
    
    if (!title) {
      // Tentar extrair do meta title
      const metaMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (metaMatch) {
        title = metaMatch[1].split('|')[0].trim();
      }
    }
    
    // Extrair tipo de imóvel do título
    let type = 'casa';
    const typeLower = title.toLowerCase();
    if (typeLower.includes('apartamento')) type = 'apartamento';
    else if (typeLower.includes('terreno')) type = 'terreno';
    else if (typeLower.includes('loja')) type = 'comercial';
    else if (typeLower.includes('sala')) type = 'comercial';
    else if (typeLower.includes('galpão') || typeLower.includes('galpao')) type = 'comercial';
    else if (typeLower.includes('prédio') || typeLower.includes('predio')) type = 'comercial';
    else if (typeLower.includes('comercial')) type = 'comercial';
    
    // Extrair preços
    let price = 0;
    let originalPrice = 0;
    
    // Preço com desconto (Valor do Imóvel)
    const discountPriceMatch = html.match(/<h2[^>]*class="[^"]*discount-price[^"]*"[^>]*>\s*R\$\s*([\d.,]+)/i);
    if (discountPriceMatch) {
      price = parsePrice(`R$ ${discountPriceMatch[1]}`);
    }
    
    // Preço original (Valor avaliado)
    const avaliadoMatch = html.match(/Valor\s+avaliado[\s\S]*?<h2[^>]*>\s*R\$\s*([\d.,]+)/i);
    if (avaliadoMatch) {
      originalPrice = parsePrice(`R$ ${avaliadoMatch[1]}`);
    }
    
    // Fallback: buscar todos os valores de preço
    if (price === 0) {
      const allPrices: number[] = [];
      const priceRegex = /R\$\s*([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?)/g;
      let priceMatch;
      while ((priceMatch = priceRegex.exec(html)) !== null) {
        const p = parsePrice(`R$ ${priceMatch[1]}`);
        if (p > 10000) { // Ignorar valores muito baixos
          allPrices.push(p);
        }
      }
      if (allPrices.length >= 2) {
        price = Math.min(...allPrices);
        originalPrice = Math.max(...allPrices);
      } else if (allPrices.length === 1) {
        price = allPrices[0];
        originalPrice = allPrices[0];
      }
    }
    
    // Extrair desconto
    let discount = 0;
    const discountMatch = html.match(/<b>\s*(\d+)%\s*<\/b>/i);
    if (discountMatch) {
      discount = parseInt(discountMatch[1]);
    } else if (originalPrice > 0 && price > 0) {
      discount = Math.round((1 - price / originalPrice) * 100);
    }
    
    // Extrair endereço completo
    let address = '';
    const addressMatch = html.match(/<p>\s*((?:RUA|AVENIDA|ALAMEDA|TRAVESSA|ESTRADA|RODOVIA|QUADRA|LOTEAMENTO|LOT\.)[^<]+CEP:\s*[\d-]+[^<]*)<\/p>/i);
    if (addressMatch) {
      address = addressMatch[1].trim();
    }
    
    // Extrair cidade da URL
    let city = '';
    const cityMatch = url.match(/\/imovel\/[a-z]{2}\/([^\/]+)\//);
    if (cityMatch) {
      city = cityMatch[1]
        .replace(/-/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    // Extrair bairro (geralmente está no endereço antes do CEP)
    let neighborhood = '';
    const neighborhoodMatch = address.match(/,\s*([A-Z][A-Z\s]+)\s*-\s*CEP/i);
    if (neighborhoodMatch) {
      neighborhood = neighborhoodMatch[1].trim();
    }
    
    // Extrair área total
    let area = 0;
    const areaTotalMatch = html.match(/Área\s+Total:[\s\S]*?<span>\s*([\d.,]+)\s*m/i);
    if (areaTotalMatch) {
      area = parseFloat(areaTotalMatch[1].replace('.', '').replace(',', '.'));
    }
    
    // Extrair área útil (fallback)
    if (area === 0) {
      const areaUtilMatch = html.match(/Área\s+Útil:[\s\S]*?<span>\s*([\d.,]+)\s*m/i);
      if (areaUtilMatch) {
        area = parseFloat(areaUtilMatch[1].replace('.', '').replace(',', '.'));
      }
    }
    
    // Área terreno
    let areaTerreno: number | null = null;
    const areaTerrenoMatch = html.match(/Área\s+Terreno:[\s\S]*?<span>\s*([\d.,]+)\s*m/i);
    if (areaTerrenoMatch) {
      areaTerreno = parseFloat(areaTerrenoMatch[1].replace('.', '').replace(',', '.'));
    }
    
    if (area === 0 && areaTerreno) {
      area = areaTerreno;
    }
    
    // Extrair quartos
    let bedrooms: number | null = null;
    const bedroomsMatch = html.match(/Quartos?:[\s\S]*?<span>\s*(\d+)/i);
    if (bedroomsMatch) {
      bedrooms = parseInt(bedroomsMatch[1]);
    }
    
    // Extrair banheiros
    let bathrooms: number | null = null;
    const bathroomsMatch = html.match(/Banheiros?:[\s\S]*?<span>\s*(\d+)/i);
    if (bathroomsMatch) {
      bathrooms = parseInt(bathroomsMatch[1]);
    }
    
    // Extrair vagas
    let parkingSpaces: number | null = null;
    const vagasMatch = html.match(/Vagas?(?:\s+(?:de\s+)?Garagem)?:[\s\S]*?<span>\s*(\d+)/i);
    if (vagasMatch) {
      parkingSpaces = parseInt(vagasMatch[1]);
    }
    
    // Verificar FGTS e Financiamento
    const acceptsFgts = html.includes('ACEITA FGTS') && !html.includes('NÃO ACEITA FGTS');
    const acceptsFinancing = html.includes('ACEITA Financiamento') && !html.includes('NÃO ACEITA Financiamento');
    
    // Extrair modalidade
    let modality = 'Venda Direta Online';
    if (html.includes('Venda Online')) {
      modality = 'Venda Direta Online';
    } else if (html.includes('Licitação')) {
      modality = 'Licitação Aberta';
    } else if (html.includes('Leilão')) {
      modality = 'Leilão';
    }
    
    // Extrair imagens em alta resolução
    const images: string[] = [];
    const seenImages = new Set<string>();
    
    // Formato: https://image.leilaoimovel.com.br/images/32/casa-caixa-...-m.webp
    const imageRegex = /https:\/\/image\.leilaoimovel\.com\.br\/images\/[^\s"']+\.webp/gi;
    let imgMatch;
    while ((imgMatch = imageRegex.exec(html)) !== null) {
      let img = imgMatch[0];
      // Preferir versão grande (-g.webp) ao invés da média (-m.webp)
      const largeImg = img.replace(/-m\.webp$/, '-g.webp').replace(/-p\.webp$/, '-g.webp');
      if (!seenImages.has(largeImg)) {
        seenImages.add(largeImg);
        images.push(largeImg);
      }
    }
    
    // Extrair data de encerramento
    let auctionDate: string | null = null;
    const dateMatch = html.match(/Encerra\s+em:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (dateMatch) {
      auctionDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }
    
    // Descrição (pode ser extraída de várias formas)
    let description = `${title}. ${address}`;
    if (acceptsFgts) description += ' Aceita FGTS.';
    if (acceptsFinancing) description += ' Aceita Financiamento.';
    
    // Validar dados mínimos
    if (!title || price === 0) {
      console.log(`  ⚠ Dados incompletos para ${url}`);
      return null;
    }
    
    return {
      id,
      title,
      type,
      price,
      originalPrice: originalPrice || price,
      discount,
      city,
      state: state.toUpperCase(),
      neighborhood,
      address,
      bedrooms,
      bathrooms,
      area: area || 0,
      areaTerreno,
      parkingSpaces,
      acceptsFgts,
      acceptsFinancing,
      modality,
      caixaLink: url,
      images,
      description,
      auctionDate,
    };
  } catch (err) {
    console.error('Erro ao parsear detalhes:', err);
    return null;
  }
}

function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  // Remove "R$", pontos de milhar e converte vírgula para ponto
  const cleaned = priceStr
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}
