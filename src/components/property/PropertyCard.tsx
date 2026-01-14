import { Property } from '@/types/property';
import { MapPin, Bed, Bath, Maximize, Car, Tag, BadgePercent, Landmark } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface PropertyCardProps {
  property: Property;
  index?: number;
}

// Lista de URLs conhecidas que são placeholders/logos de imobiliárias
const PLACEHOLDER_PATTERNS = [
  // Logos do site original
  'leilaoimovel.com.br/imagens/logo',
  'leilaoimovel.com.br/images/logo',
  'leilaoimovel.com.br/img/logo',
  // Padrões genéricos de logos
  '/logo.',
  '/logo-',
  '-logo.',
  '_logo.',
  'logo_',
  'logotipo',
  'logomarca',
  'marca.',
  'marca-',
  'brand.',
  'brand-',
  // Imobiliárias conhecidas
  'caixa-economica',
  'caixa.gov.br/logo',
  'cef.gov.br',
  'imobiliaria',
  'corretor',
  'realtor',
  // Placeholders genéricos
  'sem-foto',
  'no-image',
  'no_image',
  'nophoto',
  'no-photo',
  'placeholder',
  'default-property',
  'default_property',
  'default-image',
  'default_image',
  'sem-imagem',
  'sem_imagem',
  'image-not',
  'img-default',
  'foto-indisponivel',
  // Dimensões muito pequenas (miniaturas de logo)
  '100x100',
  '50x50',
  '32x32',
  '64x64',
  // Formatos de ícone
  'favicon',
  'icon.',
  'ico.',
  // Watermarks e banners
  'watermark',
  'banner-',
  '-banner',
];

// Lista de dimensões típicas de logos (width x height)
const LOGO_DIMENSIONS = [
  { maxWidth: 200, maxHeight: 100 },
  { maxWidth: 150, maxHeight: 150 },
];

// Nossa imagem de fallback com marca própria
const FALLBACK_IMAGE = '/placeholder.svg';

function isPlaceholderOrLogoImage(imageUrl: string): boolean {
  if (!imageUrl) return true;
  
  const lowerUrl = imageUrl.toLowerCase();
  
  // Verifica se a URL contém padrões de logos/placeholders
  const matchesPattern = PLACEHOLDER_PATTERNS.some(pattern => lowerUrl.includes(pattern));
  if (matchesPattern) return true;
  
  // Verifica se a URL parece ser de um thumbnail muito pequeno
  const tinyImagePattern = /[_-](\d{2,3})x(\d{2,3})\./;
  const tinyMatch = lowerUrl.match(tinyImagePattern);
  if (tinyMatch) {
    const width = parseInt(tinyMatch[1]);
    const height = parseInt(tinyMatch[2]);
    if (width < 200 && height < 200) return true;
  }
  
  return false;
}

function getPropertyImage(images: string[] | undefined): string {
  if (!images || images.length === 0) return FALLBACK_IMAGE;
  
  // Procurar a primeira imagem que não seja placeholder ou logo
  const validImage = images.find(img => !isPlaceholderOrLogoImage(img));
  
  return validImage || FALLBACK_IMAGE;
}

export function PropertyCard({ property, index = 0 }: PropertyCardProps) {
  const isSold = property.status === 'sold';
  const propertyImage = getPropertyImage(property.images);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const typeLabels: Record<string, string> = {
    casa: 'Casa',
    apartamento: 'Apartamento',
    terreno: 'Terreno',
    comercial: 'Comercial',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link
        to={`/imovel/${property.id}`}
        className={`block group relative bg-card rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 ${
          isSold ? 'opacity-75' : ''
        }`}
      >
        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={propertyImage}
            alt={property.title}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              isSold ? 'grayscale' : ''
            }`}
            onError={(e) => {
              // Se a imagem falhar ao carregar, usar fallback
              (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
            }}
          />
          
          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />

          {/* Sold Badge */}
          {isSold && (
            <div className="absolute inset-0 sold-overlay flex items-center justify-center">
              <div className="bg-sold text-sold-foreground px-6 py-2 rounded-lg font-heading font-bold text-lg uppercase tracking-wider rotate-[-5deg] shadow-lg">
                Vendido
              </div>
            </div>
          )}

          {/* Top Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            {property.discount && property.discount > 0 && !isSold && (
              <span className="property-badge bg-accent text-accent-foreground">
                <BadgePercent className="h-3 w-3" />
                -{property.discount}%
              </span>
            )}
            <span className="property-badge bg-card/90 text-foreground backdrop-blur-sm">
              {typeLabels[property.type]}
            </span>
          </div>

          {/* Bottom Info */}
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex items-center gap-1.5 text-primary-foreground/90 text-sm">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">
                {property.address.neighborhood}, {property.address.city} - {property.address.state}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-heading font-semibold text-base line-clamp-2 mb-3 group-hover:text-primary transition-colors">
            {property.title}
          </h3>

          {/* Features */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
            {property.features.bedrooms && (
              <div className="flex items-center gap-1">
                <Bed className="h-4 w-4" />
                <span>{property.features.bedrooms}</span>
              </div>
            )}
            {property.features.bathrooms && (
              <div className="flex items-center gap-1">
                <Bath className="h-4 w-4" />
                <span>{property.features.bathrooms}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Maximize className="h-4 w-4" />
              <span>{property.features.area}m²</span>
            </div>
            {property.features.parkingSpaces && (
              <div className="flex items-center gap-1">
                <Car className="h-4 w-4" />
                <span>{property.features.parkingSpaces}</span>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {property.acceptsFGTS && (
              <span className="property-badge property-badge-fgts">
                <Landmark className="h-3 w-3" />
                FGTS
              </span>
            )}
            {property.acceptsFinancing && (
              <span className="property-badge property-badge-financing">
                <Tag className="h-3 w-3" />
                Financiável
              </span>
            )}
          </div>

          {/* Price */}
          <div className="flex items-end justify-between gap-2">
            <div>
              {property.originalPrice && property.originalPrice > property.price && (
                <p className="text-sm text-muted-foreground line-through">
                  {formatPrice(property.originalPrice)}
                </p>
              )}
              <p className={`font-heading font-bold text-xl ${isSold ? 'text-sold' : 'text-primary'}`}>
                {formatPrice(property.price)}
              </p>
            </div>
            {property.modality && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                {property.modality}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
