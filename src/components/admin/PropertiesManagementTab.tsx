import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  useDbProperties, 
  useUpdatePropertyStatus, 
  useDeleteProperty,
  useClearAllProperties,
  DbProperty 
} from '@/hooks/useProperties';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Loader2,
  Home,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(price);
};

export function PropertiesManagementTab() {
  const { data: properties, isLoading } = useDbProperties();
  const updateStatusMutation = useUpdatePropertyStatus();
  const deletePropertyMutation = useDeleteProperty();
  const clearAllPropertiesMutation = useClearAllProperties();

  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    property: DbProperty | null;
    action: 'sell' | 'unsell';
  }>({
    open: false,
    property: null,
    action: 'sell',
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    property: DbProperty | null;
  }>({
    open: false,
    property: null,
  });

  const [clearAllDialog, setClearAllDialog] = useState(false);

  const filteredProperties = properties?.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address_city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.includes(searchQuery)
  ) || [];

  const handleStatusChange = (property: DbProperty, action: 'sell' | 'unsell') => {
    setConfirmDialog({ open: true, property, action });
  };

  const confirmStatusChange = () => {
    if (!confirmDialog.property) return;

    updateStatusMutation.mutate({
      propertyId: confirmDialog.property.id,
      status: confirmDialog.action === 'sell' ? 'sold' : 'available',
    }, {
      onSuccess: () => {
        setConfirmDialog({ open: false, property: null, action: 'sell' });
      },
    });
  };

  const handleDelete = (property: DbProperty) => {
    setDeleteDialog({ open: true, property });
  };

  const confirmDelete = () => {
    if (!deleteDialog.property) return;

    deletePropertyMutation.mutate(deleteDialog.property.id, {
      onSuccess: () => {
        setDeleteDialog({ open: false, property: null });
      },
    });
  };

  const handleClearAll = () => {
    clearAllPropertiesMutation.mutate(undefined, {
      onSuccess: () => {
        setClearAllDialog(false);
      },
    });
  };

  const availableCount = properties?.filter((p) => p.status === 'available').length || 0;
  const soldCount = properties?.filter((p) => p.status === 'sold').length || 0;
  const totalCount = properties?.length || 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Home className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-heading font-bold text-2xl">{totalCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Disponíveis</p>
                  <p className="font-heading font-bold text-2xl text-success">{availableCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-sold/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-sold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vendidos</p>
                  <p className="font-heading font-bold text-2xl text-sold">{soldCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conversão</p>
                  <p className="font-heading font-bold text-2xl">
                    {totalCount > 0 ? Math.round((soldCount / totalCount) * 100) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, título ou cidade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 max-w-md"
          />
        </div>
        
        {totalCount > 0 && (
          <Button
            variant="outline"
            onClick={() => setClearAllDialog(true)}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar Todos ({totalCount})
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="text-center py-12">
              <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">Nenhum imóvel encontrado</p>
              <p className="text-muted-foreground">
                {searchQuery 
                  ? 'Tente uma busca diferente'
                  : 'Execute uma coleta para importar imóveis da Caixa'
                }
              </p>
            </div>
          ) : (
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
                    <TableCell className="font-mono text-xs">
                      {property.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {property.images && property.images.length > 0 && property.images[0] ? (
                          <img
                            src={property.images[0]}
                            alt={property.title}
                            className="w-12 h-12 rounded-lg object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                            <Home className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium line-clamp-1">{property.title}</p>
                          <p className="text-sm text-muted-foreground">{property.address_neighborhood}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {property.address_city} - {property.address_state}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(property)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
          )}
        </CardContent>
      </Card>

      {/* Confirm Status Dialog */}
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
              {confirmDialog.property.images && confirmDialog.property.images.length > 0 && confirmDialog.property.images[0] ? (
                <img
                  src={confirmDialog.property.images[0]}
                  alt={confirmDialog.property.title}
                  className="w-16 h-16 rounded-lg object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80';
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-background flex items-center justify-center">
                  <Home className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium">{confirmDialog.property.title}</p>
                <p className="text-sm text-muted-foreground">
                  {confirmDialog.property.address_city} - {confirmDialog.property.address_state}
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
              disabled={updateStatusMutation.isPending}
              className={confirmDialog.action === 'sell' ? 'bg-sold hover:bg-sold/90' : 'bg-success hover:bg-success/90'}
            >
              {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {confirmDialog.action === 'sell' ? 'Confirmar Venda' : 'Reativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Property Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Deletar Imóvel?
            </DialogTitle>
            <DialogDescription>
              Esta ação irá remover permanentemente este imóvel do sistema. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {deleteDialog.property && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              {deleteDialog.property.images && deleteDialog.property.images.length > 0 && deleteDialog.property.images[0] ? (
                <img
                  src={deleteDialog.property.images[0]}
                  alt={deleteDialog.property.title}
                  className="w-16 h-16 rounded-lg object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80';
                  }}
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-background flex items-center justify-center">
                  <Home className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium">{deleteDialog.property.title}</p>
                <p className="text-sm text-muted-foreground">
                  {deleteDialog.property.address_city} - {deleteDialog.property.address_state}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ ...deleteDialog, open: false })}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deletePropertyMutation.isPending}
            >
              {deletePropertyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-2" />
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Dialog */}
      <Dialog open={clearAllDialog} onOpenChange={setClearAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Limpar Todos os Imóveis?
            </DialogTitle>
            <DialogDescription>
              Esta ação irá remover permanentemente todos os {totalCount} imóveis importados do sistema. 
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearAllDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={clearAllPropertiesMutation.isPending}
            >
              {clearAllPropertiesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-2" />
              Limpar Todos ({totalCount})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
