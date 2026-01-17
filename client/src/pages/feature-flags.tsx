import { useState } from "react";
import { useAdminFeatureFlags, useUpsertFeatureFlag, useToggleFeatureFlag, useIncrementRollout } from "@/hooks/use-feature-flags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Flag, TrendingUp, BarChart3, Plus } from "lucide-react";

export default function FeatureFlagsPage() {
  const { data: flags, isLoading } = useAdminFeatureFlags();
  const toggleMutation = useToggleFeatureFlag();
  const incrementRolloutMutation = useIncrementRollout();
  const upsertMutation = useUpsertFeatureFlag();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFlag, setEditingFlag] = useState<any>(null);

  const handleToggle = async (flagKey: string) => {
    try {
      await toggleMutation.mutateAsync(flagKey);
      toast({
        title: "Feature flag actualizado",
        description: `El estado del flag "${flagKey}" ha sido actualizado.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el flag",
        variant: "destructive",
      });
    }
  };

  const handleIncrementRollout = async (flagKey: string, incremento: number = 10) => {
    try {
      await incrementRolloutMutation.mutateAsync({ flagKey, incremento });
      toast({
        title: "Rollout incrementado",
        description: `El porcentaje de rollout ha sido incrementado en ${incremento}%.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo incrementar el rollout",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeFlags = flags?.filter((f: any) => f.habilitado) || [];
  const inactiveFlags = flags?.filter((f: any) => !f.habilitado) || [];

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Flag className="h-8 w-8" />
            Feature Flags
          </h1>
          <p className="text-muted-foreground">
            Gestiona features, rollouts graduales y configuraciones dinámicas
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Feature Flag
        </Button>
      </div>

      {/* Métricas generales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Flags</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{flags?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activos</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeFlags.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactivos</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{inactiveFlags.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Rollout</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {flags?.filter((f: any) => f.estrategia === "percentage" && f.porcentajeRollout < 100).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de flags activos/inactivos */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Activos ({activeFlags.length})
          </TabsTrigger>
          <TabsTrigger value="inactive">
            Inactivos ({inactiveFlags.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            Todos ({flags?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeFlags.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No hay feature flags activos
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeFlags.map((flag: any) => (
                <FeatureFlagCard
                  key={flag.id}
                  flag={flag}
                  onToggle={handleToggle}
                  onIncrementRollout={handleIncrementRollout}
                  onEdit={setEditingFlag}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inactive" className="space-y-4">
          {inactiveFlags.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No hay feature flags inactivos
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {inactiveFlags.map((flag: any) => (
                <FeatureFlagCard
                  key={flag.id}
                  flag={flag}
                  onToggle={handleToggle}
                  onIncrementRollout={handleIncrementRollout}
                  onEdit={setEditingFlag}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {flags?.map((flag: any) => (
              <FeatureFlagCard
                key={flag.id}
                flag={flag}
                onToggle={handleToggle}
                onIncrementRollout={handleIncrementRollout}
                onEdit={setEditingFlag}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateEditFeatureFlagDialog
        open={showCreateDialog || !!editingFlag}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingFlag(null);
          }
        }}
        flag={editingFlag}
        onSave={async (data) => {
          try {
            await upsertMutation.mutateAsync({
              key: editingFlag?.key || data.key,
              data,
              isNew: !editingFlag,
            });
            toast({
              title: editingFlag ? "Flag actualizado" : "Flag creado",
              description: "El feature flag ha sido guardado exitosamente.",
            });
            setShowCreateDialog(false);
            setEditingFlag(null);
          } catch (error: any) {
            toast({
              title: "Error",
              description: error.message || "No se pudo guardar el flag",
              variant: "destructive",
            });
          }
        }}
      />
    </div>
  );
}

// Componente de tarjeta individual de feature flag
function FeatureFlagCard({
  flag,
  onToggle,
  onIncrementRollout,
  onEdit,
}: {
  flag: any;
  onToggle: (key: string) => void;
  onIncrementRollout: (key: string, increment: number) => void;
  onEdit: (flag: any) => void;
}) {
  const getEstrategiaBadge = (estrategia: string) => {
    const colors: Record<string, string> = {
      boolean: "bg-gray-100 text-gray-800",
      percentage: "bg-blue-100 text-blue-800",
      tenants: "bg-purple-100 text-purple-800",
      user_ids: "bg-green-100 text-green-800",
      gradual: "bg-orange-100 text-orange-800",
    };
    return colors[estrategia] || "bg-gray-100 text-gray-800";
  };

  return (
    <Card className={flag.habilitado ? "border-green-200" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{flag.nombre}</CardTitle>
              <Switch
                checked={flag.habilitado}
                onCheckedChange={() => onToggle(flag.key)}
              />
            </div>
            <CardDescription className="mt-1">
              <code className="text-xs bg-muted px-2 py-1 rounded">{flag.key}</code>
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Badge className={getEstrategiaBadge(flag.estrategia)}>
            {flag.estrategia}
          </Badge>
          {flag.categoria && (
            <Badge variant="outline">{flag.categoria}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {flag.descripcion && (
          <p className="text-sm text-muted-foreground">{flag.descripcion}</p>
        )}

        {/* Rollout percentage */}
        {flag.estrategia === "percentage" || flag.estrategia === "gradual" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Rollout: {flag.porcentajeRollout || 0}%</span>
              {flag.habilitado && flag.porcentajeRollout < 100 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onIncrementRollout(flag.key, 10)}
                >
                  +10%
                </Button>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${flag.porcentajeRollout || 0}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center">
          <div>
            <div className="text-xs text-muted-foreground">Consultas</div>
            <div className="text-sm font-medium">{flag.vecesConsultado || 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Activados</div>
            <div className="text-sm font-medium text-green-600">{flag.vecesActivado || 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Desactivados</div>
            <div className="text-sm font-medium text-red-600">{flag.vecesDesactivado || 0}</div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => onEdit(flag)}
        >
          Ver Detalles / Editar
        </Button>
      </CardContent>
    </Card>
  );
}

// Dialog para crear/editar
function CreateEditFeatureFlagDialog({
  open,
  onOpenChange,
  flag,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flag?: any;
  onSave: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    key: "",
    nombre: "",
    descripcion: "",
    estrategia: "boolean",
    categoria: "feature",
    habilitado: false,
    porcentajeRollout: 0,
  });

  // Reset form cuando cambie el flag
  useState(() => {
    if (flag) {
      setFormData({
        key: flag.key || "",
        nombre: flag.nombre || "",
        descripcion: flag.descripcion || "",
        estrategia: flag.estrategia || "boolean",
        categoria: flag.categoria || "feature",
        habilitado: flag.habilitado || false,
        porcentajeRollout: flag.porcentajeRollout || 0,
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {flag ? "Editar Feature Flag" : "Crear Feature Flag"}
          </DialogTitle>
          <DialogDescription>
            {flag
              ? "Modifica la configuración del feature flag"
              : "Crea un nuevo feature flag para controlar funcionalidades"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="key">Key *</Label>
            <Input
              id="key"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="mi_nueva_feature"
              disabled={!!flag}
            />
            <p className="text-xs text-muted-foreground">
              Solo letras minúsculas, números y guiones bajos
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder="Mi Nueva Feature"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Descripción de la funcionalidad..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estrategia">Estrategia</Label>
              <Select
                value={formData.estrategia}
                onValueChange={(value) => setFormData({ ...formData, estrategia: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boolean">Boolean (On/Off)</SelectItem>
                  <SelectItem value="percentage">Porcentaje</SelectItem>
                  <SelectItem value="tenants">Por Tenant</SelectItem>
                  <SelectItem value="user_ids">Por Usuario</SelectItem>
                  <SelectItem value="gradual">Gradual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="experiment">Experimento</SelectItem>
                  <SelectItem value="killswitch">Kill Switch</SelectItem>
                  <SelectItem value="config">Configuración</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(formData.estrategia === "percentage" || formData.estrategia === "gradual") && (
            <div className="space-y-2">
              <Label>Porcentaje de Rollout: {formData.porcentajeRollout}%</Label>
              <Slider
                value={[formData.porcentajeRollout]}
                onValueChange={([value]) =>
                  setFormData({ ...formData, porcentajeRollout: value })
                }
                max={100}
                step={5}
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="habilitado"
              checked={formData.habilitado}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, habilitado: checked })
              }
            />
            <Label htmlFor="habilitado">Habilitado</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(formData)}>
            {flag ? "Guardar Cambios" : "Crear Flag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
