import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAnularDTE } from "@/hooks/use-anulaciones";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AnularDTEDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facturaId: string;
  codigoGeneracion: string;
  receptorRazonSocial?: string;
  monto?: number;
}

const MOTIVOS = [
  { code: "01", label: "Anulación por error en la emisión" },
  { code: "02", label: "Anulación por contabilización errónea" },
  { code: "03", label: "Anulación por devolución total del bien o servicio" },
  { code: "04", label: "Anulación por devolución parcial del bien o servicio" },
  { code: "05", label: "Anulación por acuerdo entre las partes" },
];

export function AnularDTEDialog({
  open,
  onOpenChange,
  facturaId,
  codigoGeneracion,
  receptorRazonSocial,
  monto,
}: AnularDTEDialogProps) {
  const [selectedMotivo, setSelectedMotivo] = useState<string>("");
  const { toast } = useToast();
  const anularMutation = useAnularDTE(facturaId);

  const handleAnular = async () => {
    if (!selectedMotivo) {
      toast({
        title: "Error",
        description: "Por favor selecciona un motivo de anulación",
        variant: "destructive",
      });
      return;
    }

    anularMutation.mutate(
      { motivo: selectedMotivo },
      {
        onSuccess: (data) => {
          toast({
            title: "Éxito",
            description: `Anulación ${data.estado === "aceptado" ? "procesada" : "encolada para procesamiento"}`,
            variant: "default",
          });
          setSelectedMotivo("");
          onOpenChange(false);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description:
              error instanceof Error
                ? error.message
                : "No se pudo procesar la anulación",
            variant: "destructive",
          });
        },
      }
    );
  };

  const selectedMotivoLabel = MOTIVOS.find(
    (m) => m.code === selectedMotivo
  )?.label;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Anular Documento Tributario</DialogTitle>
          <DialogDescription>
            Selecciona el motivo por el cual deseas anular este DTE
          </DialogDescription>
        </DialogHeader>

        {/* Warning Alert */}
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Esta acción es irreversible. Una vez procesada, el DTE no podrá ser
            transmitido.
          </AlertDescription>
        </Alert>

        {/* Invoice Details */}
        <div className="space-y-3 rounded-lg bg-gray-50 p-3">
          <div className="text-sm">
            <span className="font-semibold text-gray-700">Código Gen: </span>
            <span className="font-mono text-gray-600">{codigoGeneracion}</span>
          </div>
          {receptorRazonSocial && (
            <div className="text-sm">
              <span className="font-semibold text-gray-700">Receptor: </span>
              <span className="text-gray-600">{receptorRazonSocial}</span>
            </div>
          )}
          {monto && (
            <div className="text-sm">
              <span className="font-semibold text-gray-700">Monto: </span>
              <span className="text-gray-600">
                RD$ {monto.toLocaleString("es-DO", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          )}
        </div>

        {/* Motivo Selection */}
        <div className="space-y-3">
          <Label htmlFor="motivo" className="text-base font-semibold">
            Motivo de Anulación
          </Label>
          <Select value={selectedMotivo} onValueChange={setSelectedMotivo}>
            <SelectTrigger
              id="motivo"
              className="h-10 border-gray-300 text-base"
            >
              <SelectValue placeholder="Selecciona un motivo..." />
            </SelectTrigger>
            <SelectContent>
              {MOTIVOS.map((motivo) => (
                <SelectItem key={motivo.code} value={motivo.code}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-600">
                      {motivo.code}
                    </span>
                    <span>{motivo.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedMotivoLabel && (
            <div className="flex items-start gap-2 rounded-md bg-blue-50 p-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-800">{selectedMotivoLabel}</p>
            </div>
          )}
        </div>

        {/* Dialog Footer */}
        <DialogFooter className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={anularMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleAnular}
            disabled={!selectedMotivo || anularMutation.isPending}
            className="gap-2"
          >
            {anularMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {anularMutation.isPending ? "Procesando..." : "Anular DTE"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
