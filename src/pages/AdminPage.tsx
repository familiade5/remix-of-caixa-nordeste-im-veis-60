import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StagingReviewTab } from '@/components/admin/StagingReviewTab';
import { PropertiesManagementTab } from '@/components/admin/PropertiesManagementTab';
import { ShieldCheck, Download, Home } from 'lucide-react';

const AdminPage = () => {
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
              Gerencie a importação automática e o status dos imóveis.
            </p>
          </div>
        </div>

        <div className="container py-8">
          <Tabs defaultValue="import" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Importação
              </TabsTrigger>
              <TabsTrigger value="properties" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Imóveis
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import">
              <StagingReviewTab />
            </TabsContent>

            <TabsContent value="properties">
              <PropertiesManagementTab />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminPage;
