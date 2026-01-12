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
  areaTerreno: number | null;
  parkingSpaces: number | null;
  acceptsFgts: boolean;
  acceptsFinancing: boolean;
  modality: string;
  caixaLink: string;
  matriculaLink: string | null;
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

    console.log('Iniciando scraping - Venda Direta Caixa (vendadiretaimovel.com.br)');

    const allProperties: CaixaPropertyData[] = [];
    const states = config.states?.map((s: string) => s.toLowerCase()) || NORTHEAST_STATES;
    
    // Buscar imóveis para cada estado do Nordeste
    for (const state of states) {
      console.log(`Buscando imóveis em ${STATE_NAMES[state] || state}...`);
      
      try {
        // URL do agregador para imóveis da Caixa no estado (inclui Venda Direta Online)
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

        // Extrair links de imóveis individuais
        const propertyLinks = extractPropertyLinks(html, markdown, state);
        console.log(`Encontrados ${propertyLinks.length} links de imóveis em ${STATE_NAMES[state] || state}`);
        
        // Processar TODOS os imóveis encontrados (sem limite)
        let processedCount = 0;
        for (const link of propertyLinks) {
          try {
            const property = await fetchPropertyDetails(firecrawlApiKey, link, state);
            if (property) {
              allProperties.push(property);
              processedCount++;
              console.log(`[${processedCount}/${propertyLinks.length}] Coletado: ${property.title}`);
            }
            
            // Pequeno delay entre requisições para não sobrecarregar
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (err) {
            console.error(`Erro ao buscar detalhes do imóvel:`, err);
          }
        }

        // Delay entre estados
        await new Promise(resolve => setTimeout(resolve, 500));

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
    // Filtrar apenas imóveis do estado correto e que contenham "caixa"
    if (url.includes(`/imovel/${state}/`) && url.includes('caixa') && !seen.has(url)) {
      seen.add(url);
      links.push(url);
    }
  }
  
  // Também buscar no markdown
  const mdLinkRegex = /\(https:\/\/www\.vendadiretaimovel\.com\.br\/imovel\/[^)]+\)/gi;
  while ((match = mdLinkRegex.exec(markdown)) !== null) {
    const url = match[0].slice(1, -1); // Remove parênteses
    if (url.includes(`/imovel/${state}/`) && url.includes('caixa') && !seen.has(url)) {
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
    
    // Extrair título - formato: "## Casa Caixa em Salvador / BA - 2447394"
    const titleMatch = markdown.match(/##?\s*((?:Casa|Apartamento|Terreno|Comercial|Sala|Loja|Galpão|Prédio|Fazenda|Sítio|Chácara)[^\n#]+)/i);
    let title = titleMatch ? titleMatch[1].trim() : '';
    
    // Limpar título
    title = title.replace(/\\/g, '').replace(/\s+/g, ' ').trim();
    
    // Extrair tipo de imóvel
    let type = 'casa';
    const typeLower = title.toLowerCase();
    if (typeLower.includes('apartamento')) type = 'apartamento';
    else if (typeLower.includes('terreno')) type = 'terreno';
    else if (typeLower.includes('comercial') || typeLower.includes('sala') || typeLower.includes('loja') || typeLower.includes('galpão') || typeLower.includes('prédio')) type = 'comercial';
    else if (typeLower.includes('fazenda') || typeLower.includes('sítio') || typeLower.includes('chácara')) type = 'rural';
    
    // Extrair preços - procurar "Valor do Imóvel" e "Valor avaliado"
    let price = 0;
    let originalPrice = 0;
    
    // Valor do imóvel (preço atual)
    const valorImovelMatch = markdown.match(/Valor\s+(?:do\s+)?Im[óo]vel[\s\S]*?##?\s*R\$\s*([\d.,]+)/i);
    if (valorImovelMatch) {
      price = parsePrice(`R$ ${valorImovelMatch[1]}`);
    }
    
    // Valor avaliado (preço original)
    const valorAvaliadoMatch = markdown.match(/Valor\s+avaliado[\s\S]*?##?\s*R\$\s*([\d.,]+)/i);
    if (valorAvaliadoMatch) {
      originalPrice = parsePrice(`R$ ${valorAvaliadoMatch[1]}`);
    }
    
    // Fallback: buscar todos os preços
    if (price === 0 || originalPrice === 0) {
      const priceMatches = markdown.match(/R\$\s*([\d.,]+)/g) || [];
      if (priceMatches.length >= 2 && price === 0) {
        price = parsePrice(priceMatches[0] || '0');
        originalPrice = parsePrice(priceMatches[1] || '0');
        if (originalPrice < price) {
          [price, originalPrice] = [originalPrice, price];
        }
      } else if (priceMatches.length === 1 && price === 0) {
        price = parsePrice(priceMatches[0]);
        originalPrice = price;
      }
    }
    
    // Calcular desconto
    const discount = originalPrice > 0 ? Math.round((1 - price / originalPrice) * 100) : 0;
    
    // Extrair endereço completo (com CEP)
    const addressMatch = markdown.match(/(?:RUA|AVENIDA|ALAMEDA|TRAVESSA|ESTRADA|RODOVIA|QUADRA|LOTEAMENTO|LOT\.|QD)[^\n]+CEP:\s*[\d-]+[^\n]*/i);
    let address = addressMatch ? addressMatch[0].replace(/\\/g, '').trim() : '';
    
    // Extrair cidade
    let city = '';
    const cityFromUrl = url.match(/\/imovel\/[a-z]{2}\/([^\/]+)\//);
    if (cityFromUrl) {
      city = cityFromUrl[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Extrair bairro da seção "Localização"
    let neighborhood = '';
    const locationMatch = markdown.match(/\*\*Localização:\*\*[^\n]*\/([^\]\/\[]+)\]\(https:\/\/www\.vendadiretaimovel\.com\.br\/leilao-de-imovel\/[a-z]{2}\/[^\/]+\/([^\)\/]+)\)/i);
    if (locationMatch) {
      neighborhood = locationMatch[2].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Extrair área útil
    let area = 0;
    const areaUtilMatch = markdown.match(/[Áá]rea\s+[Úú]til:[\s\S]*?([\d.,]+)\s*m[²2]/i);
    if (areaUtilMatch) {
      area = parseFloat(areaUtilMatch[1].replace('.', '').replace(',', '.'));
    }
    
    // Extrair área do terreno
    let areaTerreno: number | null = null;
    const areaTerrenoMatch = markdown.match(/[Áá]rea\s+Terreno:[\s\S]*?([\d.,]+)\s*m[²2]/i);
    if (areaTerrenoMatch) {
      areaTerreno = parseFloat(areaTerrenoMatch[1].replace('.', '').replace(',', '.'));
    }
    
    // Se não tem área útil mas tem área do terreno, usar terreno
    if (area === 0 && areaTerreno) {
      area = areaTerreno;
    }
    
    // Extrair vagas
    let parkingSpaces: number | null = null;
    const vagasMatch = markdown.match(/Vagas:[\s\S]*?(\d+)/i);
    if (vagasMatch) {
      parkingSpaces = parseInt(vagasMatch[1]);
    }
    
    // Extrair quartos
    let bedrooms: number | null = null;
    const bedroomsMatch = markdown.match(/(?:Quartos?|Dormit[óo]rios?):[\s\S]*?(\d+)/i);
    if (bedroomsMatch) {
      bedrooms = parseInt(bedroomsMatch[1]);
    }
    
    // Verificar FGTS e Financiamento
    const acceptsFgts = !markdown.includes('NÃO ACEITA FGTS') && 
                        (markdown.includes('ACEITA FGTS') || 
                         (markdown.includes('FGTS') && !markdown.includes('não aceita fgts')));
    const acceptsFinancing = !markdown.includes('NÃO ACEITA Financiamento') && 
                             (markdown.includes('ACEITA Financiamento') || 
                              (markdown.includes('Financiamento') && !markdown.includes('não aceita financiamento')));
    
    // Extrair modalidade
    let modality = 'Venda Direta Online';
    if (markdown.includes('Venda Online Caixa') || markdown.includes('Venda Online')) {
      modality = 'Venda Direta Online';
    } else if (markdown.includes('Leilão')) {
      modality = 'Leilão';
    } else if (markdown.includes('Licitação')) {
      modality = 'Licitação Aberta';
    }
    
    // Extrair imagens em alta resolução
    const images: string[] = [];
    const imageRegex = /https:\/\/image\.leilaoimovel\.com\.br\/images\/[^\s"')]+\.webp/gi;
    let imgMatch;
    const seenImages = new Set<string>();
    while ((imgMatch = imageRegex.exec(html + markdown)) !== null) {
      let img = imgMatch[0];
      // Preferir imagens grandes (-g.webp)
      const largeImg = img.replace(/-m\.webp$/, '-g.webp');
      if (!seenImages.has(largeImg)) {
        seenImages.add(largeImg);
        images.push(largeImg);
      }
    }
    
    // Extrair descrição
    let description = '';
    const descMatch = markdown.match(/\*\*Descrição:\*\*\s*([^\n]+(?:\n(?!\*\*)[^\n]+)*)/i);
    if (descMatch) {
      description = descMatch[1].trim().replace(/\\/g, '');
    }
    
    // Extrair link da matrícula (PDF oficial da Caixa)
    let matriculaLink: string | null = null;
    const matriculaMatch = markdown.match(/\[Matricula\]\((https:\/\/venda-imoveis\.caixa\.gov\.br\/editais\/matricula\/[^)]+)\)/i);
    if (matriculaMatch) {
      matriculaLink = matriculaMatch[1];
    }
    
    // Link original (a página do vendadiretaimovel ou link da Caixa)
    let caixaLink = url;
    const caixaLinkMatch = markdown.match(/https:\/\/venda-imoveis\.caixa\.gov\.br\/sistema\/[^\s"')]+/);
    if (caixaLinkMatch) {
      caixaLink = caixaLinkMatch[0];
    }
    
    // Extrair data do leilão/praça
    let auctionDate: string | null = null;
    const pracaMatch = markdown.match(/1[°º]?\s*Praça:[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i);
    if (pracaMatch) {
      // Converter DD/MM/YYYY para YYYY-MM-DD
      const [day, month, year] = pracaMatch[1].split('/');
      auctionDate = `${year}-${month}-${day}`;
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
      originalPrice: originalPrice || price,
      discount,
      city,
      state: state.toUpperCase(),
      neighborhood,
      address,
      bedrooms,
      bathrooms: null,
      area,
      areaTerreno,
      parkingSpaces,
      acceptsFgts,
      acceptsFinancing,
      modality,
      caixaLink,
      matriculaLink,
      images: images.slice(0, 15), // Até 15 imagens
      description,
      auctionDate,
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
