import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Estados do Nordeste com suas principais cidades
const NORTHEAST_LOCATIONS = [
  // Ceará
  { uf: 'CE', city: 'fortaleza', cityName: 'Fortaleza' },
  { uf: 'CE', city: 'caucaia', cityName: 'Caucaia' },
  { uf: 'CE', city: 'maracanau', cityName: 'Maracanaú' },
  { uf: 'CE', city: 'juazeiro-do-norte', cityName: 'Juazeiro do Norte' },
  { uf: 'CE', city: 'sobral', cityName: 'Sobral' },
  // Bahia
  { uf: 'BA', city: 'salvador', cityName: 'Salvador' },
  { uf: 'BA', city: 'feira-de-santana', cityName: 'Feira de Santana' },
  { uf: 'BA', city: 'vitoria-da-conquista', cityName: 'Vitória da Conquista' },
  { uf: 'BA', city: 'camacari', cityName: 'Camaçari' },
  { uf: 'BA', city: 'lauro-de-freitas', cityName: 'Lauro de Freitas' },
  // Pernambuco
  { uf: 'PE', city: 'recife', cityName: 'Recife' },
  { uf: 'PE', city: 'jaboatao-dos-guararapes', cityName: 'Jaboatão dos Guararapes' },
  { uf: 'PE', city: 'olinda', cityName: 'Olinda' },
  { uf: 'PE', city: 'caruaru', cityName: 'Caruaru' },
  { uf: 'PE', city: 'paulista', cityName: 'Paulista' },
  // Maranhão
  { uf: 'MA', city: 'sao-luis', cityName: 'São Luís' },
  { uf: 'MA', city: 'imperatriz', cityName: 'Imperatriz' },
  { uf: 'MA', city: 'caxias', cityName: 'Caxias' },
  // Paraíba
  { uf: 'PB', city: 'joao-pessoa', cityName: 'João Pessoa' },
  { uf: 'PB', city: 'campina-grande', cityName: 'Campina Grande' },
  { uf: 'PB', city: 'santa-rita', cityName: 'Santa Rita' },
  // Rio Grande do Norte
  { uf: 'RN', city: 'natal', cityName: 'Natal' },
  { uf: 'RN', city: 'mossoro', cityName: 'Mossoró' },
  { uf: 'RN', city: 'parnamirim', cityName: 'Parnamirim' },
  // Alagoas
  { uf: 'AL', city: 'maceio', cityName: 'Maceió' },
  { uf: 'AL', city: 'arapiraca', cityName: 'Arapiraca' },
  // Piauí
  { uf: 'PI', city: 'teresina', cityName: 'Teresina' },
  { uf: 'PI', city: 'parnaiba', cityName: 'Parnaíba' },
  // Sergipe
  { uf: 'SE', city: 'aracaju', cityName: 'Aracaju' },
  { uf: 'SE', city: 'nossa-senhora-do-socorro', cityName: 'Nossa Senhora do Socorro' },
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

interface PropertyLink {
  url: string;
  id: string;
  city: string;
  state: string;
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

    const { configId, states, manualUrl } = await req.json();

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

    // Se tem URL manual, buscar dessa URL específica
    if (manualUrl) {
      console.log('🔗 Buscando imóveis da URL manual:', manualUrl);
      
      try {
        const result = await scrapeManualUrl(manualUrl, firecrawlApiKey, supabase);
        
        // Atualizar log
        if (logEntry) {
          await supabase
            .from('scraping_logs')
            .update({
              status: 'completed',
              finished_at: new Date().toISOString(),
              properties_found: result.found,
              properties_new: result.new,
            })
            .eq('id', logEntry.id);
        }

        await supabase
          .from('scraping_config')
          .update({ last_run_at: new Date().toISOString() })
          .eq('id', configId);

        return new Response(
          JSON.stringify({
            success: true,
            propertiesFound: result.found,
            propertiesNew: result.new,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error('Erro no scraping manual:', err);
        
        if (logEntry) {
          await supabase
            .from('scraping_logs')
            .update({
              status: 'error',
              finished_at: new Date().toISOString(),
              error_message: err instanceof Error ? err.message : 'Unknown error',
            })
            .eq('id', logEntry.id);
        }

        return new Response(
          JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Erro no scraping' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('🚀 Iniciando scraping automático - leilaoimovel.com.br');

    const allPropertyLinks: PropertyLink[] = [];
    const seenPropertyIds = new Set<string>();
    
    // Filtrar estados - priorizar parâmetro states, depois config
    let filterStates: string[] = [];
    if (states && states.length > 0) {
      filterStates = states.map((s: string) => s.toUpperCase());
      console.log(`📍 Filtrando por estados selecionados: ${filterStates.join(', ')}`);
    } else {
      filterStates = config.states?.map((s: string) => s.toUpperCase()) || ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'];
    }
    
    const locationsToScrape = NORTHEAST_LOCATIONS.filter(loc => filterStates.includes(loc.uf));
    
    console.log(`📍 Fase 1: Coletando links de ${locationsToScrape.length} cidades`);
    
    // FASE 1: Coletar todos os links de imóveis com paginação
    for (const location of locationsToScrape) {
      console.log(`\n🔍 Coletando links em ${location.cityName}/${location.uf}...`);
      
      let currentPage = 1;
      const maxPages = 30;
      let hasMorePages = true;
      
      while (hasMorePages && currentPage <= maxPages) {
        try {
          const listUrl = currentPage === 1 
            ? `https://www.leilaoimovel.com.br/caixa/imoveis-caixa-em-${location.city}-${location.uf.toLowerCase()}`
            : `https://www.leilaoimovel.com.br/caixa/imoveis-caixa-em-${location.city}-${location.uf.toLowerCase()}?pag=${currentPage}`;
          
          if (currentPage === 1) {
            console.log(`   URL: ${listUrl}`);
          }
          
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: listUrl,
              formats: ['html'],
              waitFor: 2000,
              onlyMainContent: false,
            }),
          });

          if (!scrapeResponse.ok) {
            console.error(`   ❌ Erro página ${currentPage}`);
            hasMorePages = false;
            continue;
          }

          const scrapeData = await scrapeResponse.json();
          const html = scrapeData.data?.html || scrapeData.html || '';

          if (html.includes('500-errointernodeservidor') || html.includes('404-naoencontrado')) {
            hasMorePages = false;
            continue;
          }

          // Extrair links dos imóveis
          const linksFromPage = extractPropertyLinks(html, location.uf, location.cityName);
          
          if (linksFromPage.length === 0) {
            hasMorePages = false;
            continue;
          }
          
          let newLinksCount = 0;
          for (const link of linksFromPage) {
            if (!seenPropertyIds.has(link.id)) {
              seenPropertyIds.add(link.id);
              allPropertyLinks.push(link);
              newLinksCount++;
            }
          }
          
          console.log(`   📄 Pág ${currentPage}: ${linksFromPage.length} (${newLinksCount} novos)`);
          
          // Verificar próxima página
          const hasNextPageLink = html.includes(`pag=${currentPage + 1}`) || 
                                  (linksFromPage.length >= 18);
          
          if (!hasNextPageLink || linksFromPage.length < 10) {
            hasMorePages = false;
          } else {
            currentPage++;
            await new Promise(resolve => setTimeout(resolve, 300));
          }

        } catch (err) {
          console.error(`   ❌ Erro:`, err);
          hasMorePages = false;
        }
      }
      
      // Pequeno delay entre cidades
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n📊 Total de links coletados: ${allPropertyLinks.length}`);
    
    // Verificar quais já existem no banco
    const existingIds = new Set<string>();
    
    // Verificar staging_properties
    const { data: existingStaging } = await supabase
      .from('staging_properties')
      .select('external_id');
    
    existingStaging?.forEach(p => existingIds.add(p.external_id));
    
    // Verificar properties
    const { data: existingProps } = await supabase
      .from('properties')
      .select('external_id');
    
    existingProps?.forEach(p => { if (p.external_id) existingIds.add(p.external_id); });
    
    // Filtrar apenas novos
    const newPropertyLinks = allPropertyLinks.filter(p => !existingIds.has(p.id));
    console.log(`📋 Imóveis novos para processar: ${newPropertyLinks.length}`);
    
    // FASE 2: Buscar detalhes de cada imóvel novo
    console.log(`\n🔎 Fase 2: Buscando detalhes completos...`);
    
    let propertiesNew = 0;
    const batchSize = 5;
    
    for (let i = 0; i < newPropertyLinks.length; i += batchSize) {
      const batch = newPropertyLinks.slice(i, i + batchSize);
      
      // Processar batch em paralelo
      const detailPromises = batch.map(async (link) => {
        try {
          const detailResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: link.url,
              formats: ['html'],
              waitFor: 2000,
              onlyMainContent: false,
            }),
          });

          if (!detailResponse.ok) {
            console.error(`   ❌ Erro ao buscar ${link.id}`);
            return null;
          }

          const detailData = await detailResponse.json();
          const html = detailData.data?.html || detailData.html || '';
          
          // Extrair detalhes completos
          return extractPropertyDetails(html, link);
          
        } catch (err) {
          console.error(`   ❌ Erro ${link.id}:`, err);
          return null;
        }
      });
      
      const properties = await Promise.all(detailPromises);
      
      // Inserir no banco
      for (const property of properties) {
        if (!property) continue;
        
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
      
      const successCount = properties.filter(p => p !== null).length;
      console.log(`   ✅ Batch ${Math.floor(i/batchSize) + 1}: ${successCount}/${batch.length} processados (Total: ${propertiesNew})`);
      
      // Delay entre batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Atualizar log e config
    if (logEntry) {
      await supabase
        .from('scraping_logs')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
          properties_found: allPropertyLinks.length,
          properties_new: propertiesNew,
        })
        .eq('id', logEntry.id);
    }

    await supabase
      .from('scraping_config')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', configId);

    console.log(`\n✅ Scraping concluído: ${allPropertyLinks.length} encontrados, ${propertiesNew} novos inseridos`);

    return new Response(
      JSON.stringify({
        success: true,
        propertiesFound: allPropertyLinks.length,
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

// Função para scraping de URL manual
async function scrapeManualUrl(url: string, apiKey: string, supabase: any): Promise<{ found: number; new: number }> {
  console.log('Scraping URL manual:', url);
  
  const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['html'],
      waitFor: 3000,
      onlyMainContent: false,
    }),
  });

  if (!scrapeResponse.ok) {
    throw new Error(`Erro ao acessar URL: ${scrapeResponse.status}`);
  }

  const scrapeData = await scrapeResponse.json();
  const html = scrapeData.data?.html || scrapeData.html || '';
  
  // Tentar extrair links de listagem primeiro
  const propertyLinks = extractPropertyLinks(html, '', '');
  
  if (propertyLinks.length > 0) {
    console.log(`Encontrados ${propertyLinks.length} links de imóveis`);
    
    // Buscar IDs existentes
    const existingIds = new Set<string>();
    const { data: existingStaging } = await supabase.from('staging_properties').select('external_id');
    existingStaging?.forEach((p: any) => existingIds.add(p.external_id));
    const { data: existingProps } = await supabase.from('properties').select('external_id');
    existingProps?.forEach((p: any) => { if (p.external_id) existingIds.add(p.external_id); });
    
    const newLinks = propertyLinks.filter(l => !existingIds.has(l.id));
    let inserted = 0;
    
    // Processar cada link
    for (const link of newLinks.slice(0, 50)) { // Limitar a 50 por vez
      try {
        const detailResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: link.url,
            formats: ['html'],
            waitFor: 2000,
          }),
        });

        if (detailResponse.ok) {
          const detailData = await detailResponse.json();
          const detailHtml = detailData.data?.html || detailData.html || '';
          const property = extractPropertyDetails(detailHtml, link);
          
          if (property) {
            const { error } = await supabase.from('staging_properties').insert({
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
            
            if (!error) inserted++;
          }
        }
        
        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.error('Erro ao processar link:', e);
      }
    }
    
    return { found: propertyLinks.length, new: inserted };
  }
  
  // Se não encontrou links, tentar extrair como página de imóvel único
  console.log('Tentando extrair como imóvel único...');
  
  // Gerar ID do URL
  const idMatch = url.match(/-(\d{6,})-(\d+)-/);
  const id = idMatch ? `${idMatch[1]}-${idMatch[2]}` : `manual-${Date.now()}`;
  
  // Extrair estado e cidade do URL se possível
  const locationMatch = url.match(/em-([^-]+)-([a-z]{2})/i);
  const city = locationMatch ? locationMatch[1].replace(/-/g, ' ') : '';
  const state = locationMatch ? locationMatch[2].toUpperCase() : '';
  
  const property = extractPropertyDetails(html, { url, id, city, state });
  
  if (property && property.price > 0) {
    // Verificar se já existe
    const { data: existing } = await supabase
      .from('staging_properties')
      .select('id')
      .eq('external_id', property.id);
    
    if (!existing || existing.length === 0) {
      const { error } = await supabase.from('staging_properties').insert({
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
      
      if (!error) {
        return { found: 1, new: 1 };
      }
    }
    
    return { found: 1, new: 0 };
  }
  
  return { found: 0, new: 0 };
}

function extractPropertyLinks(html: string, stateUf: string, cityName: string): PropertyLink[] {
  const links: PropertyLink[] = [];
  
  // Regex para extrair links de imóveis
  const linkRegex = /href="(https:\/\/www\.leilaoimovel\.com\.br\/imovel\/[^"]+)"/gi;
  
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    
    // Extrair ID do imóvel
    const idMatch = url.match(/-(\d{6,})-(\d+)-/);
    const id = idMatch ? `${idMatch[1]}-${idMatch[2]}` : null;
    
    // Tentar extrair cidade/estado do URL se não fornecidos
    let city = cityName;
    let state = stateUf;
    
    if (!city || !state) {
      const locationMatch = url.match(/em-([^-]+)-([a-z]{2})/i);
      if (locationMatch) {
        city = city || locationMatch[1].replace(/-/g, ' ');
        state = state || locationMatch[2].toUpperCase();
      }
    }
    
    if (id && !links.some(l => l.id === id)) {
      links.push({
        url,
        id,
        city,
        state,
      });
    }
  }
  
  return links;
}

function extractPropertyDetails(html: string, link: PropertyLink): CaixaPropertyData | null {
  try {
    // === TÍTULO ===
    let title = '';
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || 
                       html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/\s*\|.*$/, '').replace(/\s*-\s*Leilão Imóvel.*$/i, '').trim();
    }
    
    // === TIPO ===
    let type = 'casa';
    const typeLower = title.toLowerCase();
    if (typeLower.includes('apartamento')) type = 'apartamento';
    else if (typeLower.includes('terreno')) type = 'terreno';
    else if (typeLower.includes('loja') || typeLower.includes('sala') || typeLower.includes('galpão') || typeLower.includes('prédio')) type = 'comercial';
    
    // === PREÇOS ===
    let price = 0;
    let originalPrice = 0;
    
    // Preço com desconto
    const discountPriceMatch = html.match(/class="[^"]*discount-price[^"]*"[^>]*>\s*R\$\s*([\d.,]+)/i) ||
                               html.match(/Valor\s+(?:de\s+)?(?:Venda|Atual)[^R]*R\$\s*([\d.,]+)/i);
    if (discountPriceMatch) {
      price = parsePrice(discountPriceMatch[1]);
    }
    
    // Preço original
    const originalPriceMatch = html.match(/class="[^"]*last-price[^"]*"[^>]*>\s*R\$\s*([\d.,]+)/i) ||
                               html.match(/Valor\s+(?:de\s+)?Avalia[çc][ãa]o[^R]*R\$\s*([\d.,]+)/i);
    if (originalPriceMatch) {
      originalPrice = parsePrice(originalPriceMatch[1]);
    }
    
    if (price === 0) {
      // Tentar pegar qualquer preço
      const anyPriceMatch = html.match(/R\$\s*([\d]{2,3}(?:\.[\d]{3})+(?:,\d{2})?)/);
      if (anyPriceMatch) {
        price = parsePrice(anyPriceMatch[1]);
      }
    }
    
    if (price === 0) return null;
    
    // === DESCONTO ===
    let discount = 0;
    const discountMatch = html.match(/(\d{1,2})\s*%\s*(?:de\s+)?(?:desconto|abaixo)/i) ||
                          html.match(/<[^>]*discount[^>]*>.*?(\d{1,2})\s*%/i);
    if (discountMatch) {
      discount = parseInt(discountMatch[1]);
    } else if (originalPrice > 0 && price > 0 && originalPrice > price) {
      discount = Math.round((1 - price / originalPrice) * 100);
    }
    
    // === ENDEREÇO ===
    let address = '';
    let neighborhood = '';
    
    const addressMatch = html.match(/Endere[çc]o[^:]*:\s*([^<]+)/i) ||
                         html.match(/<span[^>]*class="[^"]*address[^"]*"[^>]*>([^<]+)</i);
    if (addressMatch) {
      address = addressMatch[1].trim();
    }
    
    // Bairro
    const neighborhoodMatch = html.match(/Bairro[^:]*:\s*([^<,]+)/i) ||
                              address.match(/,\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)\s*(?:-|,|$)/);
    if (neighborhoodMatch) {
      neighborhood = neighborhoodMatch[1].trim();
    }
    
    // === CARACTERÍSTICAS ===
    let bedrooms: number | null = null;
    let bathrooms: number | null = null;
    let parkingSpaces: number | null = null;
    let area = 0;
    let areaTerreno: number | null = null;
    
    // Quartos
    const bedroomsMatch = html.match(/(\d+)\s*(?:quarto|dormit[oó]rio|suite)/i) ||
                          html.match(/quartos?[^:]*:\s*(\d+)/i);
    if (bedroomsMatch) {
      bedrooms = parseInt(bedroomsMatch[1]);
    }
    
    // Banheiros
    const bathroomsMatch = html.match(/(\d+)\s*(?:banheiro|wc|lavabo)/i) ||
                           html.match(/banheiros?[^:]*:\s*(\d+)/i);
    if (bathroomsMatch) {
      bathrooms = parseInt(bathroomsMatch[1]);
    }
    
    // Vagas
    const parkingMatch = html.match(/(\d+)\s*(?:vaga|garagem)/i) ||
                         html.match(/vagas?[^:]*:\s*(\d+)/i);
    if (parkingMatch) {
      parkingSpaces = parseInt(parkingMatch[1]);
    }
    
    // Área útil/privativa
    const areaMatch = html.match(/[ÁáAa]rea\s*(?:[PpÚúUu]til|[Pp]rivativa|[Cc]onstru[íi]da)?[^:]*:\s*([\d.,]+)\s*m/i) ||
                      html.match(/([\d.,]+)\s*m[²2]\s*(?:[úu]til|privativ|constru[íi]d)/i);
    if (areaMatch) {
      area = parseFloat(areaMatch[1].replace('.', '').replace(',', '.'));
    }
    
    // Área do terreno
    const areaLandMatch = html.match(/[ÁáAa]rea\s*(?:do\s*)?[Tt]erreno[^:]*:\s*([\d.,]+)\s*m/i) ||
                          html.match(/([\d.,]+)\s*m[²2]\s*(?:de\s*)?terreno/i);
    if (areaLandMatch) {
      areaTerreno = parseFloat(areaLandMatch[1].replace('.', '').replace(',', '.'));
    }
    
    // Se não tem área útil, usar terreno
    if (area === 0 && areaTerreno) {
      area = areaTerreno;
    }
    
    // === IMAGENS ===
    const images: string[] = [];
    const imgRegex = /src="(https:\/\/image\.leilaoimovel\.com\.br\/images\/[^"]+)"/gi;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      // Converter para versão grande
      let imgUrl = imgMatch[1]
        .replace(/-m\.webp$/, '-g.webp')
        .replace(/-p\.webp$/, '-g.webp')
        .replace(/-m\.jpg$/, '-g.jpg')
        .replace(/-p\.jpg$/, '-g.jpg');
      
      // Evitar duplicatas e logos
      if (!images.includes(imgUrl) && !imgUrl.includes('/logo') && !imgUrl.includes('/banner')) {
        images.push(imgUrl);
      }
    }
    
    // === MODALIDADE ===
    let modality = 'Venda Direta Online';
    if (html.includes('Leilão SFI') || html.includes('leilao-sfi')) {
      modality = 'Leilão SFI';
    } else if (html.includes('Leilão') || html.includes('leilao')) {
      modality = 'Leilão';
    } else if (html.includes('Licitação Aberta') || html.includes('licitacao-aberta')) {
      modality = 'Licitação Aberta';
    } else if (html.includes('Venda Online') || html.includes('venda-online')) {
      modality = 'Venda Direta Online';
    } else if (html.includes('Venda Direta') || html.includes('venda-direta')) {
      modality = 'Venda Direta';
    }
    
    // === FGTS / FINANCIAMENTO ===
    const acceptsFgts = html.includes('FGTS') || html.includes('fgts') || html.includes('/imoveis/fgts');
    const acceptsFinancing = html.includes('Financiamento') || html.includes('financiamento') || html.includes('Financiável');
    
    // === DATA LEILÃO ===
    let auctionDate: string | null = null;
    const dateMatch = html.match(/(?:Encerra|Data)[^:]*:\s*(\d{2})\/(\d{2})\/(\d{4})/i) ||
                      html.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(?:às|as)/i);
    if (dateMatch) {
      auctionDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
    }
    
    // === DESCRIÇÃO ===
    let description = '';
    const descMatch = html.match(/<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                      html.match(/<p[^>]*class="[^"]*observacoes[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    if (descMatch) {
      description = descMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000);
    }
    
    if (!description) {
      description = `${title}. ${address}`.trim();
    }
    
    return {
      id: link.id,
      title: title || `Imóvel Caixa em ${link.city}/${link.state}`,
      type,
      price,
      originalPrice: originalPrice || price,
      discount,
      city: link.city,
      state: link.state,
      neighborhood,
      address,
      bedrooms,
      bathrooms,
      area,
      areaTerreno,
      parkingSpaces,
      acceptsFgts,
      acceptsFinancing,
      modality,
      caixaLink: link.url,
      images,
      description,
      auctionDate,
    };
    
  } catch (err) {
    console.error('Erro ao extrair detalhes:', err);
    return null;
  }
}

function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  const cleaned = priceStr
    .replace(/R\$\s*/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}
