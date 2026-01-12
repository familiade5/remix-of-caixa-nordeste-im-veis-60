import { useParams, Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { mockProperties } from '@/data/mockProperties';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  MapPin,
  Bed,
  Bath,
  Maximize,
  Car,
  Tag,
  Landmark,
  BadgePercent,
  ArrowLeft,
  Calendar,
  ExternalLink,
  Phone,
  MessageCircle,
} from 'lucide-react';

const PropertyDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const property = mockProperties.find((p) => p.id === id);

  if (!property) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container py-16 text-center">
          <h1 className="font-heading text-2xl font-bold mb-4">Imóvel não encontrado</h1>
          <Link to="/imoveis">
            <Button>Voltar para lista</Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const isSold = property.status === 'sold';

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
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="border-b border-border bg-card">
          <div className="container py-4">
            <Link
              to="/imoveis"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para imóveis
            </Link>
          </div>
        </div>

        <div className="container py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Image */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative aspect-video rounded-xl overflow-hidden"
              >
                <img
                  src={property.images[0]}
                  alt={property.title}
                  className={`w-full h-full object-cover ${isSold ? 'grayscale' : ''}`}
                />
                {isSold && (
                  <div className="absolute inset-0 sold-overlay flex items-center justify-center">
                    <div className="bg-sold text-sold-foreground px-8 py-3 rounded-xl font-heading font-bold text-2xl uppercase tracking-wider rotate-[-5deg] shadow-xl">
                      Vendido
                    </div>
                  </div>
                )}
                {property.discount && property.discount > 0 && !isSold && (
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-accent text-accent-foreground text-base px-3 py-1">
                      <BadgePercent className="h-4 w-4 mr-1" />
                      -{property.discount}% de desconto
                    </Badge>
                  </div>
                )}
              </motion.div>

              {/* Title and Location */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="secondary">{typeLabels[property.type]}</Badge>
                  {property.modality && (
                    <Badge variant="outline">{property.modality}</Badge>
                  )}
                </div>
                <h1 className="font-heading font-bold text-2xl md:text-3xl mb-3">
                  {property.title}
                </h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span>
                    {property.address.neighborhood}, {property.address.city} - {property.address.state}
                  </span>
                </div>
              </motion.div>

              {/* Features */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
              >
                {property.features.bedrooms && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
                    <Bed className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-semibold">{property.features.bedrooms}</p>
                      <p className="text-sm text-muted-foreground">Quartos</p>
                    </div>
                  </div>
                )}
                {property.features.bathrooms && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
                    <Bath className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-semibold">{property.features.bathrooms}</p>
                      <p className="text-sm text-muted-foreground">Banheiros</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
                  <Maximize className="h-6 w-6 text-primary" />
                  <div>
                    <p className="font-semibold">{property.features.area}m²</p>
                    <p className="text-sm text-muted-foreground">Área</p>
                  </div>
                </div>
                {property.features.parkingSpaces && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
                    <Car className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-semibold">{property.features.parkingSpaces}</p>
                      <p className="text-sm text-muted-foreground">Vagas</p>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Description */}
              {property.description && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-card rounded-xl border border-border p-6"
                >
                  <h2 className="font-heading font-semibold text-lg mb-3">Descrição</h2>
                  <p className="text-muted-foreground leading-relaxed">{property.description}</p>
                </motion.div>
              )}

              {/* Conditions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-card rounded-xl border border-border p-6"
              >
                <h2 className="font-heading font-semibold text-lg mb-4">Condições de Pagamento</h2>
                <div className="flex flex-wrap gap-3">
                  {property.acceptsFGTS && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success/10 text-success">
                      <Landmark className="h-5 w-5" />
                      <span className="font-medium">Aceita FGTS</span>
                    </div>
                  )}
                  {property.acceptsFinancing && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary">
                      <Tag className="h-5 w-5" />
                      <span className="font-medium">Aceita Financiamento</span>
                    </div>
                  )}
                </div>
                {property.auctionDate && (
                  <div className="mt-4 flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-5 w-5" />
                    <span>Data do Leilão: {new Date(property.auctionDate).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="sticky top-24 bg-card rounded-xl border border-border p-6 shadow-card"
              >
                {/* Price */}
                <div className="mb-6">
                  {property.originalPrice && property.originalPrice > property.price && (
                    <p className="text-lg text-muted-foreground line-through">
                      {formatPrice(property.originalPrice)}
                    </p>
                  )}
                  <p className={`font-heading font-bold text-3xl ${isSold ? 'text-sold' : 'text-primary'}`}>
                    {formatPrice(property.price)}
                  </p>
                  {property.discount && property.discount > 0 && (
                    <p className="text-sm text-success font-medium mt-1">
                      Economia de {formatPrice((property.originalPrice || 0) - property.price)}
                    </p>
                  )}
                </div>

                {!isSold ? (
                  <>
                    <Button className="w-full mb-3 gap-2" size="lg">
                      <Phone className="h-5 w-5" />
                      Ligar Agora
                    </Button>
                    <Button variant="outline" className="w-full mb-3 gap-2" size="lg">
                      <MessageCircle className="h-5 w-5" />
                      WhatsApp
                    </Button>
                    {property.caixaLink && (
                      <a href={property.caixaLink} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" className="w-full gap-2">
                          <ExternalLink className="h-4 w-4" />
                          Ver no site da Caixa
                        </Button>
                      </a>
                    )}
                  </>
                ) : (
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <p className="font-semibold text-sold">Este imóvel já foi vendido</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Vendido em {property.soldAt ? new Date(property.soldAt).toLocaleDateString('pt-BR') : 'data não informada'}
                    </p>
                    <Link to="/imoveis">
                      <Button variant="outline" className="mt-4 w-full">
                        Ver outros imóveis
                      </Button>
                    </Link>
                  </div>
                )}

                {/* Info */}
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Imóvel cadastrado em {new Date(property.createdAt).toLocaleDateString('pt-BR')}. 
                    Informações sujeitas a alteração. Consulte condições atualizadas.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PropertyDetailPage;
