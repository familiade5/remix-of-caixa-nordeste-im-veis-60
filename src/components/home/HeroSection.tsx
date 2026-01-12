import { Search, TrendingDown, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

export function HeroSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/imoveis?search=${encodeURIComponent(searchQuery)}`);
  };

  const stats = [
    { label: 'Imóveis Disponíveis', value: '150+' },
    { label: 'Estados Cobertos', value: '9' },
    { label: 'Desconto Médio', value: '25%' },
  ];

  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 hero-gradient opacity-95" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-20" />

      <div className="relative container py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-sm font-medium rounded-full bg-primary-foreground/10 text-primary-foreground backdrop-blur-sm border border-primary-foreground/20">
              <Zap className="h-4 w-4" />
              Atualização automática diária
            </span>

            <h1 className="font-heading font-bold text-4xl md:text-5xl lg:text-6xl text-primary-foreground mb-6 leading-tight">
              Oportunidades Imobiliárias da{' '}
              <span className="relative">
                Caixa
                <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 200 8" fill="none">
                  <path d="M2 6C50 2 150 2 198 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent" />
                </svg>
              </span>{' '}
              no Nordeste
            </h1>

            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
              Encontre imóveis com descontos de até 50% direto da Caixa Econômica Federal. 
              Casas, apartamentos e terrenos em todos os estados do Nordeste.
            </p>
          </motion.div>

          {/* Search Box */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            onSubmit={handleSearch}
            className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto mb-8"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Cidade, bairro ou tipo de imóvel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 pl-12 text-base bg-card border-0 shadow-lg"
              />
            </div>
            <Button type="submit" size="lg" className="h-14 px-8 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold shadow-lg">
              Buscar Imóveis
            </Button>
          </motion.form>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-2 mb-12"
          >
            {['Fortaleza', 'Salvador', 'Recife', 'Maceió', 'João Pessoa'].map((city) => (
              <Link
                key={city}
                to={`/imoveis?search=${encodeURIComponent(city)}`}
                className="px-4 py-2 text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 rounded-full transition-colors"
              >
                {city}
              </Link>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="grid grid-cols-3 gap-6 max-w-md mx-auto"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-heading font-bold text-2xl md:text-3xl text-primary-foreground">
                  {stat.value}
                </p>
                <p className="text-sm text-primary-foreground/70">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Features Strip */}
      <div className="relative bg-card border-t border-border">
        <div className="container py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: TrendingDown,
                title: 'Descontos Reais',
                description: 'Até 50% abaixo do valor de mercado',
              },
              {
                icon: Shield,
                title: 'Segurança Caixa',
                description: 'Imóveis direto do banco federal',
              },
              {
                icon: Zap,
                title: 'Atualização Automática',
                description: 'Novos imóveis adicionados diariamente',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
