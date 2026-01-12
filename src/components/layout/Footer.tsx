import { Building2, Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg hero-gradient shadow-md">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-heading font-bold text-lg leading-tight">
                  Nordeste Imóveis
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Oportunidades Caixa
                </span>
              </div>
            </Link>
            <p className="text-sm text-muted-foreground max-w-md">
              Plataforma especializada em oportunidades imobiliárias da Caixa Econômica Federal 
              na região Nordeste. Encontre seu imóvel com descontos exclusivos.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-heading font-semibold mb-4">Links Úteis</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/imoveis" className="hover:text-foreground transition-colors">
                  Ver Imóveis
                </Link>
              </li>
              <li>
                <Link to="/#como-funciona" className="hover:text-foreground transition-colors">
                  Como Funciona
                </Link>
              </li>
              <li>
                <a 
                  href="https://www.caixa.gov.br/voce/habitacao/Paginas/default.aspx" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Site da Caixa
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-semibold mb-4">Contato</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                contato@nordesteimoveis.com.br
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                (85) 99999-9999
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Fortaleza, CE
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2025 Nordeste Imóveis. Todos os direitos reservados.</p>
          <p className="text-xs">
            Os imóveis exibidos são de responsabilidade da Caixa Econômica Federal.
          </p>
        </div>
      </div>
    </footer>
  );
}
