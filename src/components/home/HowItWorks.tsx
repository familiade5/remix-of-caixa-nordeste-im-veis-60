import { Search, MousePointerClick, Phone, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export function HowItWorks() {
  const steps = [
    {
      icon: Search,
      title: 'Pesquise',
      description: 'Use os filtros para encontrar imóveis na sua cidade ou região de interesse.',
    },
    {
      icon: MousePointerClick,
      title: 'Selecione',
      description: 'Veja fotos, detalhes e condições do imóvel que mais combina com você.',
    },
    {
      icon: Phone,
      title: 'Entre em Contato',
      description: 'Fale conosco para tirar dúvidas e iniciar o processo de aquisição.',
    },
    {
      icon: CheckCircle2,
      title: 'Realize seu Sonho',
      description: 'Finalize a compra com condições especiais da Caixa, incluindo FGTS.',
    },
  ];

  return (
    <section id="como-funciona" className="py-16 md:py-24 bg-muted/50">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <span className="text-sm font-medium text-primary uppercase tracking-wider">
            Passo a Passo
          </span>
          <h2 className="font-heading font-bold text-3xl md:text-4xl mt-2">
            Como Funciona
          </h2>
          <p className="text-muted-foreground mt-4">
            Adquirir um imóvel da Caixa é mais simples do que você imagina. 
            Veja como funciona o processo.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="relative text-center"
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/30 to-primary/10" />
              )}
              
              {/* Step Number */}
              <div className="relative mx-auto mb-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card shadow-card border border-border mx-auto">
                  <step.icon className="h-8 w-8 text-primary" />
                </div>
                <span className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {index + 1}
                </span>
              </div>
              
              <h3 className="font-heading font-semibold text-lg mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
