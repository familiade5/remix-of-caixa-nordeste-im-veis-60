export type PropertyStatus = 'available' | 'sold';

export type PropertyType = 'casa' | 'apartamento' | 'terreno' | 'comercial';

export interface Property {
  id: string;
  title: string;
  type: PropertyType;
  status: PropertyStatus;
  price: number;
  originalPrice?: number;
  discount?: number;
  address: {
    street?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode?: string;
  };
  features: {
    bedrooms?: number;
    bathrooms?: number;
    area: number;
    parkingSpaces?: number;
  };
  images: string[];
  description?: string;
  acceptsFGTS: boolean;
  acceptsFinancing: boolean;
  auctionDate?: string;
  modality?: string;
  caixaLink?: string;
  createdAt: string;
  soldAt?: string;
}

export const NORTHEAST_STATES = [
  { value: 'all', label: 'Todos os Estados' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'SE', label: 'Sergipe' },
];

export const PROPERTY_TYPES = [
  { value: 'all', label: 'Todos os Tipos' },
  { value: 'casa', label: 'Casa' },
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'comercial', label: 'Comercial' },
];

export const PRICE_RANGES = [
  { value: 'all', label: 'Qualquer valor' },
  { value: '0-100000', label: 'Até R$ 100 mil' },
  { value: '100000-200000', label: 'R$ 100 mil - R$ 200 mil' },
  { value: '200000-350000', label: 'R$ 200 mil - R$ 350 mil' },
  { value: '350000-500000', label: 'R$ 350 mil - R$ 500 mil' },
  { value: '500000+', label: 'Acima de R$ 500 mil' },
];
