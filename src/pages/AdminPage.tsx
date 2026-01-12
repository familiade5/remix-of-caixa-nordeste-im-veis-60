import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { mockProperties } from '@/data/mockProperties';
import { Property } from '@/types/property';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Search, CheckCircle2, XCircle, Eye, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const AdminPage = () => {
  const [properties, setProperties] = useState<Property[]>(mockProperties);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; property: Property | null; action: 'sell' | 'unsell' }>({
    open: false,
    property: null,
    action: 'sell',
  });

  const filteredProperties = properties.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.includes(searchQuery)
  );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleStatusChange = (property: Property, action: 'sell' | 'unsell') => {
    setConfirmDialog({ open: true, property, action });
  };

  const confirmStatusChange = () => {
    if (!confirmDialog.property) return;

    setProperties((prev) =>
      prev.map((p) => {
        if (p.id === confirmDialog.property!.id) {
          return {
            ...p,
            status: confirmDialog.action === 'sell' ? 'sold' : 'available',
            soldAt: confirmDialog.action === 'sell' ? new Date().toISOString().split('T')[0] : undefined,
          };
        }
        return p;
      })
    );

    toast.success(
      confirmDialog.action === 'sell'
        ? `Imóvel marcado como vendido!`
        : `Imóvel voltou para disponível!`
    );

    setConfirmDialog({ open: false, property: null, action: 'sell' });
  };

  const availableCount = properties.filter((p) => p.status === 'available').length;
  const soldCount = properties.filter((p) => p.status === 'sold').length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Page Header */}
        <div className="border-b border-border bg-card">
          <div className="container py-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg hero-gradient">
                <ShieldCheck className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="font-heading font-bold text-2xl md:text-3xl">
                Painel Administrativo
              </h1>
            </div>
            <p className="text-muted-foreground">
              Gerencie o status dos imóveis cadastrados na plataforma.
            </p>
          </div>
        </div>

        <div className="container py-8">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl border border-border p-4"
            >
              <p className="text-sm text-muted-foreground">Total de Imóveis</p>
              <p className="font-heading font-bold text-2xl">{properties.length}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-xl border border-border p-4"
            >
              <p className="text-sm text-muted-foreground">Disponíveis</p>
              <p className="font-heading font-bold text-2xl text-success">{availableCount}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card rounded-xl border border-border p-4"
            >
              <p className="text-sm text-muted-foreground">Vendidos</p>
              <p className="font-heading font-bold text-2xl text-sold">{soldCount}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card rounded-xl border border-border p-4"
            >
              <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
              <p className="font-heading font-bold text-2xl">
                {properties.length > 0 ? Math.round((soldCount / properties.length) * 100) : 0}%
              </p>
            </motion.div>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, título ou cidade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 max-w-md"
            />
          </div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border border-border overflow-hidden"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProperties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-mono text-sm">#{property.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={property.images[0]}
                          alt={property.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <p className="font-medium line-clamp-1">{property.title}</p>
                          <p className="text-sm text-muted-foreground">{property.address.neighborhood}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {property.address.city} - {property.address.state}
                    </TableCell>
                    <TableCell className="font-semibold">{formatPrice(property.price)}</TableCell>
                    <TableCell>
                      {property.status === 'available' ? (
                        <Badge className="bg-success/10 text-success border-0">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Disponível
                        </Badge>
                      ) : (
                        <Badge className="bg-sold/10 text-sold border-0">
                          <XCircle className="h-3 w-3 mr-1" />
                          Vendido
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/imovel/${property.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {property.status === 'available' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(property, 'sell')}
                            className="text-sold hover:text-sold"
                          >
                            Marcar Vendido
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(property, 'unsell')}
                            className="text-success hover:text-success"
                          >
                            Reativar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        </div>
      </main>
      <Footer />

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === 'sell' ? 'Marcar como Vendido?' : 'Reativar Imóvel?'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === 'sell'
                ? 'O imóvel será exibido com a marcação "VENDIDO" e aparecerá como histórico de vendas.'
                : 'O imóvel voltará a ficar disponível para consulta pública.'}
            </DialogDescription>
          </DialogHeader>
          {confirmDialog.property && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <img
                src={confirmDialog.property.images[0]}
                alt={confirmDialog.property.title}
                className="w-16 h-16 rounded-lg object-cover"
              />
              <div>
                <p className="font-medium">{confirmDialog.property.title}</p>
                <p className="text-sm text-muted-foreground">
                  {confirmDialog.property.address.city} - {confirmDialog.property.address.state}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
              Cancelar
            </Button>
            <Button
              onClick={confirmStatusChange}
              className={confirmDialog.action === 'sell' ? 'bg-sold hover:bg-sold/90' : 'bg-success hover:bg-success/90'}
            >
              {confirmDialog.action === 'sell' ? 'Confirmar Venda' : 'Reativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
