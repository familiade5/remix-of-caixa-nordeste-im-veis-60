import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Estados do Nordeste com suas principais cidades (maior volume de imóveis)
const NORTHEAST_LOCATIONS = [
  // Ceará
  { uf: 'CE', city: 'fortaleza', cityName: 'Fortaleza' },
  { uf: 'CE', city: 'caucaia', cityName: 'Caucaia' },
  { uf: 'CE', city: 'maracanau', cityName: 'Maracanaú' },
  { uf: 'CE', city: 'juazeiro-do-norte', cityName: 'Juazeiro do Norte' },
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

    console.log('🚀 Iniciando scraping - leilaoimovel.com.br (Todos os imóveis Caixa Nordeste)');

    const allProperties: CaixaPropertyData[] = [];
    const seenPropertyIds = new Set<string>();
    
    // Filtrar estados do config
    const configStates = config.states?.map((s: string) => s.toUpperCase()) || ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'];
    const locationsToScrape = NORTHEAST_LOCATIONS.filter(loc => configStates.includes(loc.uf));
    
    console.log(`📍 Buscando em ${locationsToScrape.length} cidades dos estados: ${configStates.join(', ')}`);
    
    // Buscar imóveis para cada cidade
    for (const location of locationsToScrape) {
      console.log(`\n🔍 Buscando imóveis em ${location.cityName}/${location.uf}...`);
      
      try {
        // URL do leilaoimovel.com.br (busca TODOS os imóveis, sem filtro de modalidade)
        const listUrl = `https://www.leilaoimovel.com.br/caixa/imoveis-caixa-em-${location.city}-${location.uf.toLowerCase()}`;
        
        console.log(`   URL: ${listUrl}`);
        
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
          console.error(`   ❌ Erro ao buscar ${location.cityName}:`, await scrapeResponse.text());
          continue;
        }

        const scrapeData = await scrapeResponse.json();
        const html = scrapeData.data?.html || scrapeData.html || '';

        // Verificar se retornou erro
        if (html.includes('500-errointernodeservidor') || html.includes('404-naoencontrado')) {
          console.log(`   ⚠️ Página não disponível para ${location.cityName}`);
          continue;
        }

        // Extrair links e dados básicos direto do HTML da listagem
        const propertiesFromList = extractPropertiesFromList(html, location.uf, location.cityName);
        console.log(`   📦 Encontrados ${propertiesFromList.length} imóveis`);
        
        // Adicionar apenas os que não foram vistos antes
        for (const prop of propertiesFromList) {
          if (!seenPropertyIds.has(prop.id)) {
            seenPropertyIds.add(prop.id);
            allProperties.push(prop);
          }
        }

        // Delay entre cidades
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`   ❌ Erro ao processar ${location.cityName}:`, err);
      }
    }

    console.log(`\n📊 Total de imóveis únicos coletados: ${allProperties.length}`);

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

function extractPropertiesFromList(html: string, stateUf: string, cityName: string): CaixaPropertyData[] {
  const properties: CaixaPropertyData[] = [];
  
  // Regex para extrair cada bloco de imóvel (place-box)
  const placeBoxRegex = /<div class="place-box">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
  
  let match;
  while ((match = placeBoxRegex.exec(html)) !== null) {
    try {
      const block = match[1];
      
      // Extrair link do imóvel
      const linkMatch = block.match(/href="(https:\/\/www\.leilaoimovel\.com\.br\/imovel\/[^"]+)"/i);
      if (!linkMatch) continue;
      
      const link = linkMatch[1];
      
      // Extrair ID do imóvel (formato: ...-1580032-8444405978325-venda-direta-caixa)
      const idMatch = link.match(/-(\d{6,})-(\d+)-/);
      const id = idMatch ? `${idMatch[1]}-${idMatch[2]}` : `caixa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Extrair título (b dentro de .address p)
      let title = '';
      const titleMatch = block.match(/<b>([^<]+Caixa[^<]+)<\/b>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
      
      // Extrair tipo do título
      let type = 'casa';
      const typeLower = title.toLowerCase();
      if (typeLower.includes('apartamento')) type = 'apartamento';
      else if (typeLower.includes('terreno')) type = 'terreno';
      else if (typeLower.includes('loja')) type = 'comercial';
      else if (typeLower.includes('sala')) type = 'comercial';
      else if (typeLower.includes('galpão') || typeLower.includes('galpao')) type = 'comercial';
      else if (typeLower.includes('prédio') || typeLower.includes('predio')) type = 'comercial';
      
      // Extrair preço com desconto
      let price = 0;
      const discountPriceMatch = block.match(/<span class="discount-price[^"]*">\s*R\$\s*([\d.,]+)/i);
      if (discountPriceMatch) {
        price = parsePrice(`R$ ${discountPriceMatch[1]}`);
      }
      
      // Extrair preço original
      let originalPrice = 0;
      const lastPriceMatch = block.match(/<span class="last-price[^"]*">\s*R\$\s*([\d.,]+)/i);
      if (lastPriceMatch) {
        originalPrice = parsePrice(`R$ ${lastPriceMatch[1]}`);
      }
      
      if (price === 0) continue; // Pular se não tem preço
      
      // Extrair desconto
      let discount = 0;
      const discountMatch = block.match(/<b>(\d+)%\s*&nbsp;<\/b>/i);
      if (discountMatch) {
        discount = parseInt(discountMatch[1]);
      } else if (originalPrice > 0 && price > 0) {
        discount = Math.round((1 - price / originalPrice) * 100);
      }
      
      // Extrair endereço (span dentro de .address p)
      let address = '';
      const addressMatch = block.match(/<span>([^<]*CEP:[^<]+)<\/span>/i);
      if (addressMatch) {
        address = addressMatch[1].trim();
      }
      
      // Extrair bairro do endereço
      let neighborhood = '';
      const neighborhoodMatch = address.match(/,\s*([A-Z][A-Z\sÀ-ÿ]+)\s*-\s*CEP/i);
      if (neighborhoodMatch) {
        neighborhood = neighborhoodMatch[1].trim();
      }
      
      // Extrair imagem
      const images: string[] = [];
      const imgMatch = block.match(/src="(https:\/\/image\.leilaoimovel\.com\.br\/images\/[^"]+)"/i);
      if (imgMatch) {
        // Converter para versão grande da imagem
        const largeImg = imgMatch[1].replace(/-m\.webp$/, '-g.webp').replace(/-p\.webp$/, '-g.webp');
        images.push(largeImg);
      }
      
      // Extrair modalidade das categorias
      let modality = 'Venda Direta Online';
      if (block.includes('Leilão')) {
        modality = 'Leilão';
      } else if (block.includes('Licitação')) {
        modality = 'Licitação Aberta';
      } else if (block.includes('Venda Online')) {
        modality = 'Venda Direta Online';
      }
      
      // Verificar FGTS
      const acceptsFgts = block.includes('/imoveis/fgts') || block.includes('FGTS');
      
      // Extrair data de encerramento
      let auctionDate: string | null = null;
      const dateMatch = block.match(/(?:Encerra em|encerramento):\s*(\d{2})\/(\d{2})\/(\d{4})/i);
      if (dateMatch) {
        auctionDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
      }
      
      const property: CaixaPropertyData = {
        id,
        title: title || `Imóvel Caixa em ${cityName}/${stateUf}`,
        type,
        price,
        originalPrice: originalPrice || price,
        discount,
        city: cityName,
        state: stateUf,
        neighborhood,
        address,
        bedrooms: null,
        bathrooms: null,
        area: 0,
        areaTerreno: null,
        parkingSpaces: null,
        acceptsFgts,
        acceptsFinancing: false, // Será determinado nos detalhes
        modality,
        caixaLink: link,
        images,
        description: `${title}. ${address}`,
        auctionDate,
      };
      
      properties.push(property);
      
    } catch (err) {
      console.error('Erro ao parsear imóvel:', err);
    }
  }
  
  return properties;
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
