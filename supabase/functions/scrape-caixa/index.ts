import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// URLs alternativas que funcionam melhor - por modalidade/região
const SEARCH_URLS = {
  // Busca por modalidade - Venda Direta (mais estável)
  vendaDireta: 'https://www.leilaoimovel.com.br/imoveis/caixa/venda-direta',
  // Busca por tipo de imóvel da Caixa
  caixaGeral: 'https://www.leilaoimovel.com.br/imoveis/caixa',
  // Busca por estados específicos (usando formato diferente)
  nordeste: 'https://www.leilaoimovel.com.br/imoveis/caixa?regiao=nordeste',
};

// Mapeamento de estados do Nordeste
const NORTHEAST_STATES = ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'];

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
              status: 'failed',
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
    
    // Filtrar estados
    let filterStates: string[] = [];
    if (states && states.length > 0) {
      filterStates = states.map((s: string) => s.toUpperCase());
    } else {
      filterStates = config.states?.map((s: string) => s.toUpperCase()) || NORTHEAST_STATES;
    }
    
    console.log(`📍 Estados filtrados: ${filterStates.join(', ')}`);
    
    // ESTRATÉGIA: Usar busca geral da Caixa e filtrar por estados do Nordeste
    const searchUrls = [
      SEARCH_URLS.caixaGeral,
      SEARCH_URLS.vendaDireta,
    ];
    
    console.log(`\n📍 Fase 1: Coletando links de ${searchUrls.length} fontes`);
    
    for (const baseUrl of searchUrls) {
      console.log(`\n🔍 Buscando em: ${baseUrl}`);
      
      let currentPage = 1;
      const maxPages = 15; // Mais páginas para compensar filtragem
      let hasMorePages = true;
      let urlPropertyCount = 0;
      let consecutiveEmptyPages = 0;
      
      while (hasMorePages && currentPage <= maxPages && consecutiveEmptyPages < 2) {
        try {
          const listUrl = currentPage === 1 
            ? baseUrl
            : `${baseUrl}?pag=${currentPage}`;
          
          if (currentPage === 1) {
            console.log(`   URL base: ${listUrl}`);
          }
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout
          
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
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          if (!scrapeResponse.ok) {
            console.error(`   ❌ Erro página ${currentPage}: ${scrapeResponse.status}`);
            consecutiveEmptyPages++;
            currentPage++;
            continue;
          }

          const scrapeData = await scrapeResponse.json();
          const html = scrapeData.data?.html || scrapeData.html || '';

          // Verificar se página tem erro ou está vazia
          if (!html || html.length < 1000) {
            console.log(`   ⚠️ Página ${currentPage} vazia ou muito pequena`);
            consecutiveEmptyPages++;
            currentPage++;
            continue;
          }

          if (html.includes('500-errointernodeservidor') || html.includes('404-naoencontrado')) {
            console.log(`   ⚠️ Página ${currentPage} com erro do site`);
            consecutiveEmptyPages++;
            currentPage++;
            continue;
          }

          // Extrair links dos imóveis
          const linksFromPage = extractPropertyLinks(html, filterStates);
          
          if (linksFromPage.length === 0) {
            console.log(`   📄 Pág ${currentPage}: 0 imóveis encontrados`);
            consecutiveEmptyPages++;
            currentPage++;
            continue;
          }
          
          consecutiveEmptyPages = 0; // Reset contador
          
          let newLinksCount = 0;
          for (const link of linksFromPage) {
            if (!seenPropertyIds.has(link.id)) {
              seenPropertyIds.add(link.id);
              allPropertyLinks.push(link);
              newLinksCount++;
              urlPropertyCount++;
            }
          }
          
          console.log(`   📄 Pág ${currentPage}: ${linksFromPage.length} imóveis (${newLinksCount} novos)`);
          
          // Verificar próxima página
          const hasNextPageLink = html.includes(`pag=${currentPage + 1}`) || 
                                  html.includes('proxima') ||
                                  html.includes('próxima') ||
                                  linksFromPage.length >= 12;
          
          if (!hasNextPageLink || linksFromPage.length < 8) {
            hasMorePages = false;
          } else {
            currentPage++;
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms entre páginas
          }

        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            console.error(`   ⏱️ Timeout página ${currentPage}`);
          } else {
            console.error(`   ❌ Erro:`, err);
          }
          consecutiveEmptyPages++;
          currentPage++;
        }
      }
      
      console.log(`   ✅ Fonte processada: ${urlPropertyCount} imóveis coletados`);
      
      // Delay entre fontes
      await new Promise(resolve => setTimeout(resolve, 500));
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
    
    if (newPropertyLinks.length === 0) {
      // Atualizar log
      if (logEntry) {
        await supabase
          .from('scraping_logs')
          .update({
            status: 'completed',
            finished_at: new Date().toISOString(),
            properties_found: allPropertyLinks.length,
            properties_new: 0,
          })
          .eq('id', logEntry.id);
      }

      await supabase
        .from('scraping_config')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', configId);

      console.log(`\n✅ Scraping concluído: ${allPropertyLinks.length} encontrados, 0 novos`);

      return new Response(
        JSON.stringify({
          success: true,
          propertiesFound: allPropertyLinks.length,
          propertiesNew: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // FASE 2: Buscar detalhes de cada imóvel novo
    const maxNewProperties = 25;
    const propertiesToProcess = newPropertyLinks.slice(0, maxNewProperties);
    
    console.log(`\n🔎 Fase 2: Buscando detalhes de ${propertiesToProcess.length} imóveis (max ${maxNewProperties})...`);
    
    let propertiesNew = 0;
    const batchSize = 3;
    
    for (let i = 0; i < propertiesToProcess.length; i += batchSize) {
      const batch = propertiesToProcess.slice(i, i + batchSize);
      
      // Processar batch em paralelo com timeout
      const detailPromises = batch.map(async (link) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          const detailResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: link.url,
              formats: ['html'],
              waitFor: 3000,
              onlyMainContent: false,
            }),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          if (!detailResponse.ok) {
            console.error(`   ❌ Erro ao buscar ${link.id}: ${detailResponse.status}`);
            return null;
          }

          const detailData = await detailResponse.json();
          const html = detailData.data?.html || detailData.html || '';
          
          if (!html || html.length < 500) {
            console.error(`   ❌ HTML vazio para ${link.id}`);
            return null;
          }
          
          // Extrair detalhes completos
          return extractPropertyDetails(html, link);
          
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            console.error(`   ⏱️ Timeout ${link.id}`);
          } else {
            console.error(`   ❌ Erro ${link.id}:`, err);
          }
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
  const propertyLinks = extractPropertyLinks(html, NORTHEAST_STATES);
  
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
    for (const link of newLinks.slice(0, 30)) {
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
            waitFor: 3000,
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
        
        await new Promise(r => setTimeout(r, 400));
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

function extractPropertyLinks(html: string, filterStates: string[]): PropertyLink[] {
  const links: PropertyLink[] = [];
  
  // Regex para extrair links de imóveis - aceita ambos formatos
  const linkRegex = /href="(https:\/\/www\.leilaoimovel\.com\.br\/imovel\/[^"]+)"/gi;
  
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    
    // Extrair ID do imóvel
    const idMatch = url.match(/-(\d{6,})-(\d+)-/);
    const id = idMatch ? `${idMatch[1]}-${idMatch[2]}` : null;
    
    // Extrair cidade/estado do URL
    let city = '';
    let state = '';
    
    const locationMatch = url.match(/em-([^-]+(?:-[^-]+)*)-([a-z]{2})\//i);
    if (locationMatch) {
      city = locationMatch[1]
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      state = locationMatch[2].toUpperCase();
    }
    
    // Filtrar por estados se especificado
    if (filterStates.length > 0 && state && !filterStates.includes(state)) {
      continue; // Pular imóveis de outros estados
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
