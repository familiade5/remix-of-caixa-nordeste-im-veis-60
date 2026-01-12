import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de códigos de estado para sigla
const stateCodeMap: Record<string, string> = {
  'AL': 'AL', 'BA': 'BA', 'CE': 'CE', 'MA': 'MA',
  'PB': 'PB', 'PE': 'PE', 'PI': 'PI', 'RN': 'RN', 'SE': 'SE'
};

// Mapeamento de modalidades da Caixa
const modalityMap: Record<string, string> = {
  'Venda Direta Online': '35',
  'Leilão SFI - Edital Único': '5',
  'Licitação Aberta': '32',
};

// Mapeamento de tipos de imóvel
const propertyTypeMap: Record<string, string> = {
  'casa': 'Casa',
  'apartamento': 'Apartamento',
  'terreno': 'Outros',
  'comercial': 'Outros',
};

interface CaixaProperty {
  realtyRegistration: string;
  propertyType: string;
  rooms: string;
  garage: string;
  propertyNumber: string;
  registrationNumber: string;
  district: string;
  office: string;
  evaluationValue: string;
  minimumSaleValue: string;
  minimumSaleValue1?: string;
  discount: string;
  privateArea: string;
  landArea?: string;
  address: string;
  notice?: string;
  paymentMethods: string[];
  firstAuctionDate?: string;
  secondAuctionDate?: string;
  url: string;
  images?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    console.log('Iniciando scraping com config:', config.name);

    // Simular dados da Caixa (em produção, isso viria de uma API real ou web scraping)
    // A Caixa não tem uma API pública oficial, então usamos dados simulados
    // que seguem o formato real dos imóveis da Caixa
    const mockCaixaProperties: CaixaProperty[] = generateMockCaixaData(config);

    let propertiesFound = 0;
    let propertiesNew = 0;

    for (const property of mockCaixaProperties) {
      propertiesFound++;

      // Verificar se já existe no staging ou properties
      const { data: existingStaging } = await supabase
        .from('staging_properties')
        .select('id')
        .eq('external_id', property.realtyRegistration)
        .maybeSingle();

      const { data: existingProperty } = await supabase
        .from('properties')
        .select('id')
        .eq('external_id', property.realtyRegistration)
        .maybeSingle();

      if (!existingStaging && !existingProperty) {
        // Processar e inserir no staging
        const parsedProperty = parseProperty(property);

        const { error: insertError } = await supabase
          .from('staging_properties')
          .insert({
            external_id: property.realtyRegistration,
            raw_data: property,
            ...parsedProperty,
            caixa_link: property.url,
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

function parseProperty(caixaProperty: CaixaProperty) {
  // Extrair cidade e estado do distrito
  const districtParts = caixaProperty.district.split('-');
  const city = districtParts[0]?.trim() || 'Não informado';
  const state = districtParts[1]?.trim() || 'CE';

  // Mapear tipo de imóvel
  const typeRaw = caixaProperty.propertyType?.toLowerCase() || '';
  let type = 'casa';
  if (typeRaw.includes('apartamento') || typeRaw.includes('apto')) {
    type = 'apartamento';
  } else if (typeRaw.includes('terreno') || typeRaw.includes('lote')) {
    type = 'terreno';
  } else if (typeRaw.includes('comercial') || typeRaw.includes('sala') || typeRaw.includes('loja')) {
    type = 'comercial';
  }

  // Parse valores
  const parseMoneyValue = (value: string): number => {
    if (!value) return 0;
    return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  };

  const parseAreaValue = (value: string): number => {
    if (!value) return 0;
    return parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  };

  const price = parseMoneyValue(caixaProperty.minimumSaleValue);
  const originalPrice = parseMoneyValue(caixaProperty.evaluationValue);
  const discount = parseFloat(caixaProperty.discount?.replace(',', '.') || '0');
  const area = parseAreaValue(caixaProperty.privateArea);

  // Extrair bairro do endereço
  const addressParts = caixaProperty.address?.split(',') || [];
  const neighborhood = addressParts.length > 2 
    ? addressParts[addressParts.length - 2]?.trim()?.replace(/- CEP:.*/, '')?.trim() 
    : 'Centro';

  // Verificar FGTS e financiamento
  const paymentMethods = caixaProperty.paymentMethods || [];
  const acceptsFgts = paymentMethods.some(m => m.toLowerCase().includes('fgts'));
  const acceptsFinancing = paymentMethods.some(m => m.toLowerCase().includes('financiamento'));

  // Determinar modalidade
  let modality = 'Venda Direta';
  if (caixaProperty.notice?.toLowerCase().includes('leilão')) {
    modality = 'Leilão';
  } else if (caixaProperty.notice?.toLowerCase().includes('licitação')) {
    modality = 'Licitação';
  }

  // Parse data de leilão
  let auctionDate = null;
  if (caixaProperty.firstAuctionDate) {
    const parts = caixaProperty.firstAuctionDate.split('/');
    if (parts.length === 3) {
      auctionDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  // Gerar título
  const bedrooms = parseInt(caixaProperty.rooms) || 0;
  const title = bedrooms > 0
    ? `${caixaProperty.propertyType || 'Imóvel'} ${bedrooms} Quarto${bedrooms > 1 ? 's' : ''} - ${neighborhood}`
    : `${caixaProperty.propertyType || 'Imóvel'} - ${neighborhood}`;

  return {
    title,
    type,
    price,
    original_price: originalPrice,
    discount,
    address_neighborhood: neighborhood,
    address_city: city,
    address_state: state in stateCodeMap ? state : 'CE',
    bedrooms: bedrooms || null,
    bathrooms: null,
    area,
    parking_spaces: parseInt(caixaProperty.garage) || null,
    images: caixaProperty.images || [],
    description: `Imóvel disponível pela Caixa Econômica Federal. ${caixaProperty.address}`,
    accepts_fgts: acceptsFgts,
    accepts_financing: acceptsFinancing,
    modality,
    auction_date: auctionDate,
  };
}

function generateMockCaixaData(config: any): CaixaProperty[] {
  // Em produção, isso seria substituído por scraping real
  // Por enquanto, geramos dados mock realistas baseados na estrutura da Caixa
  
  const mockProperties: CaixaProperty[] = [];
  const neighborhoods = [
    'Centro', 'Boa Vista', 'Aldeota', 'Meireles', 'Pituba', 'Barra',
    'Ponta Verde', 'Pajuçara', 'Tambaú', 'Manaíra', 'Cabo Branco',
    'Parnamirim', 'Casa Forte', 'Graças', 'Tirol', 'Petrópolis'
  ];
  
  const states = config.states || ['CE', 'PE', 'BA', 'AL', 'PB', 'RN', 'SE', 'PI', 'MA'];
  const cities: Record<string, string[]> = {
    'CE': ['FORTALEZA', 'MARACANAÚ', 'CAUCAIA', 'JUAZEIRO DO NORTE'],
    'PE': ['RECIFE', 'OLINDA', 'JABOATÃO DOS GUARARAPES', 'CARUARU'],
    'BA': ['SALVADOR', 'FEIRA DE SANTANA', 'VITÓRIA DA CONQUISTA', 'CAMAÇARI'],
    'AL': ['MACEIÓ', 'ARAPIRACA', 'RIO LARGO'],
    'PB': ['JOÃO PESSOA', 'CAMPINA GRANDE', 'PATOS'],
    'RN': ['NATAL', 'MOSSORÓ', 'PARNAMIRIM'],
    'SE': ['ARACAJU', 'NOSSA SENHORA DO SOCORRO', 'LAGARTO'],
    'PI': ['TERESINA', 'PARNAÍBA', 'PICOS'],
    'MA': ['SÃO LUÍS', 'IMPERATRIZ', 'CAXIAS'],
  };

  const propertyTypes = ['Casa', 'Apartamento', 'Terreno', 'Sala Comercial'];
  
  // Gerar 5-10 imóveis por execução
  const count = Math.floor(Math.random() * 6) + 5;
  
  for (let i = 0; i < count; i++) {
    const state = states[Math.floor(Math.random() * states.length)];
    const cityList = cities[state] || ['CAPITAL'];
    const city = cityList[Math.floor(Math.random() * cityList.length)];
    const neighborhood = neighborhoods[Math.floor(Math.random() * neighborhoods.length)];
    const propertyType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)];
    
    const baseValue = Math.floor(Math.random() * 400000) + 80000;
    const discountPercent = Math.floor(Math.random() * 30) + 10;
    const saleValue = Math.floor(baseValue * (1 - discountPercent / 100));
    
    const rooms = propertyType === 'Terreno' || propertyType === 'Sala Comercial' 
      ? '0' 
      : String(Math.floor(Math.random() * 3) + 1);
    const garage = propertyType === 'Terreno' ? '0' : String(Math.floor(Math.random() * 3));
    const area = propertyType === 'Terreno' 
      ? Math.floor(Math.random() * 400) + 200
      : Math.floor(Math.random() * 100) + 50;

    const registrationId = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
    
    mockProperties.push({
      realtyRegistration: registrationId,
      propertyType,
      rooms,
      garage,
      propertyNumber: `8555${Math.floor(Math.random() * 100000000)}`,
      registrationNumber: String(Math.floor(Math.random() * 100000)),
      district: `${city}-${state}`,
      office: String(Math.floor(Math.random() * 10) + 1).padStart(2, '0'),
      evaluationValue: baseValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      minimumSaleValue: saleValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      minimumSaleValue1: baseValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      discount: discountPercent.toFixed(2).replace('.', ','),
      privateArea: `${area},00m2`,
      address: `RUA ${neighborhood.toUpperCase()}, N. ${Math.floor(Math.random() * 1000)}, ${neighborhood} - CEP: ${String(Math.floor(Math.random() * 90000) + 10000)}-${String(Math.floor(Math.random() * 900) + 100)}, ${city} - ${state}`,
      notice: Math.random() > 0.5 ? 'Venda Direta Online' : 'Leilão SFI - Edital Único',
      paymentMethods: [
        'Recursos próprios.',
        Math.random() > 0.3 ? 'Permite utilização de FGTS. Consulte condições e enquadramento.' : '',
        Math.random() > 0.4 ? 'Permite financiamento - somente SBPE. Consulte condições antes de efetuar a proposta.' : '',
      ].filter(Boolean),
      firstAuctionDate: Math.random() > 0.5 
        ? `${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}/0${Math.floor(Math.random() * 3) + 2}/2025`
        : undefined,
      url: `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel=${registrationId}`,
      images: [
        `https://images.unsplash.com/photo-${1564013799919 + i}-ab600027ffc6?w=800&q=80`,
      ],
    });
  }

  return mockProperties;
}
