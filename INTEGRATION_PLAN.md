# 📋 Plan de Integración - Validación en Formularios

## Objetivo
Integrar la validación DGII schema en los formularios del frontend para mostrar feedback en tiempo real al usuario.

## Fases

### Fase 1: Mostrar Errores de Validación en POST /api/facturas

**Ubicación**: [client/src/pages/crear-factura.tsx](client/src/pages/crear-factura.tsx) (o similar)

**Cambios necesarios**:
```typescript
// 1. Actualizar la mutación POST /api/facturas para capturar errores DGII
const createFactura = useMutation({
  mutationFn: async (data) => {
    const response = await fetch("/api/facturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw error; // Incluye dgiiErrors si existen
    }
    return response.json();
  },
  onError: (error) => {
    // Mostrar errores DGII en modal o banner
    if (error.dgiiErrors) {
      setValidationErrors(error.dgiiErrors);
    }
  }
});

// 2. Renderizar errores debajo del formulario
{validationErrors && (
  <div className="bg-red-50 border border-red-200 rounded p-4">
    <h3 className="font-bold text-red-800">Errores de Validación DGII:</h3>
    <ul className="list-disc ml-5 mt-2 text-red-700 text-sm">
      {validationErrors.map((err) => (
        <li key={err.field}>{err.field}: {err.message}</li>
      ))}
    </ul>
  </div>
)}
```

---

### Fase 2: Pre-validación Opcional (Antes de Enviar)

**Hook**: `useValidateDTE()`

**Uso**:
```typescript
const { mutate: validarDTE, isPending } = useValidateDTE();

const handleValidar = () => {
  validarDTE(formData, {
    onSuccess: (response) => {
      if (response.valid) {
        setValidationFeedback("✅ DTE válido según DGII");
        // Habilitar botón crear
      }
    },
    onError: (error) => {
      setValidationErrors(error.errors);
    }
  });
};

return (
  <>
    <button onClick={handleValidar} disabled={isPending}>
      Validar Antes de Crear
    </button>
    {validationFeedback && (
      <p className="text-green-600 mt-2">{validationFeedback}</p>
    )}
  </>
);
```

---

### Fase 3: Validación en Tiempo Real (Campo a Campo)

**Ubicación**: Componente de emisor/receptor

**Estrategia**:
```typescript
const validateField = (fieldName: string, value: any) => {
  // Importar validadores específicos
  if (fieldName === "emisor.nit") {
    const isValid = /^\d{14}-\d$/.test(value);
    return isValid 
      ? null 
      : "NIT debe tener formato: 14 dígitos - 1 verificador";
  }
  
  if (fieldName === "receptor.numDocumento") {
    const tipoDoc = form.getValues("receptor.tipoDocumento");
    if (tipoDoc === "13") { // DUI
      return /^\d{8}-\d$/.test(value)
        ? null
        : "DUI debe tener formato: 8 dígitos - 1 verificador";
    }
  }
  
  return null;
};

// En onChange del campo
<input
  {...field}
  onBlur={() => {
    const error = validateField(field.name, field.value);
    if (error) setFieldError(field.name, error);
  }}
/>
```

---

### Fase 4: Componente de Formulario Mejorado

**Crear**: [client/src/components/FormularioFactura.tsx](client/src/components/FormularioFactura.tsx)

```typescript
export function FormularioFactura() {
  const form = useForm({
    resolver: zodResolver(insertFacturaSchema),
    defaultValues: { ... }
  });
  
  const { mutate: validarDTE } = useValidateDTE();
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  const onSubmit = async (data) => {
    // Pre-validación
    const preValidation = await new Promise((resolve) => {
      validarDTE(data, {
        onSuccess: (response) => resolve(response.valid),
        onError: (error) => {
          setValidationErrors(error.errors);
          resolve(false);
        }
      });
    });
    
    if (!preValidation) return;
    
    // Crear si pasó validación
    createFactura.mutate(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Campos emisor */}
      <Emisor form={form} />
      
      {/* Campos receptor */}
      <Receptor form={form} />
      
      {/* Items */}
      <ItemsFactura form={form} />
      
      {/* Errores DGII */}
      {validationErrors.length > 0 && (
        <ValidationErrorBanner errors={validationErrors} />
      )}
      
      <button type="submit" disabled={createFactura.isPending}>
        Crear Factura
      </button>
    </form>
  );
}
```

---

### Fase 5: Componentes Específicos

#### Emisor.tsx
```typescript
export function Emisor({ form }) {
  const catalogos = useCatalogos();
  
  return (
    <fieldset className="border rounded p-4 mb-4">
      <legend className="font-bold">Datos del Emisor</legend>
      
      <FormField
        control={form.control}
        name="emisor.nit"
        render={({ field }) => (
          <FormItem>
            <FormLabel>NIT (14-dígitos-verificador)</FormLabel>
            <FormControl>
              <Input 
                placeholder="06050000000000-7"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      {/* Más campos... */}
    </fieldset>
  );
}
```

#### Receptor.tsx
```typescript
export function Receptor({ form }) {
  const tipoDocumento = form.watch("receptor.tipoDocumento");
  
  return (
    <fieldset className="border rounded p-4 mb-4">
      <legend className="font-bold">Datos del Receptor</legend>
      
      <FormField
        control={form.control}
        name="receptor.tipoDocumento"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de Documento</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DOCUMENTO.map(tipo => (
                  <SelectItem key={tipo.codigo} value={tipo.codigo}>
                    {tipo.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="receptor.numDocumento"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {tipoDocumento === "13" ? "DUI" : "Número de Documento"}
            </FormLabel>
            <FormControl>
              <Input 
                placeholder={tipoDocumento === "13" ? "12345678-9" : ""}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </fieldset>
  );
}
```

---

## 📊 Flujo Actual vs. Futuro

### Flujo Actual (Ya Implementado)
```
POST /api/facturas 
  ↓
Validación Zod + Validación AJV (server-side)
  ↓
{ error?, dgiiErrors? }
```

### Flujo Futuro (Con Integración UI)
```
Usuario escribe en formulario
  ↓
Validación en tiempo real (campo a campo)
  ↓
Mostrar errores bajo cada campo
  ↓
Usuario hace click "Validar"
  ↓
useValidateDTE() → POST /api/validar-dte
  ↓
Mostrar feedback visual (✅/❌)
  ↓
Si valid=true, usuario puede hacer click "Crear"
  ↓
POST /api/facturas (con pre-validación pasada)
  ↓
200 OK → Factura creada → Redirigir a dashboard
```

---

## 🎨 Componentes de UI Necesarios

1. **ValidationErrorBanner**: Mostrar errores DGII
2. **FormField**: Wrapper de inputs con validación
3. **DepartamentoSelect**: Desplegable de departamentos
4. **MunicipioSelect**: Desplegable de municipios (dinámico)
5. **TipoDTESelect**: Desplegable de tipos DTE
6. **ItemsTable**: Tabla para agregar items a la factura

---

## 📝 Ejemplos de Errores Esperados

### Error: NIT inválido
```json
{
  "valid": false,
  "errors": [
    {
      "field": "/emisor/nit",
      "message": "must match pattern \"^[0-9]{14}-[0-9]$\""
    }
  ]
}
```

### Error: Campo requerido
```json
{
  "valid": false,
  "errors": [
    {
      "field": "#/required",
      "message": "must have required property 'version'"
    }
  ]
}
```

### Error: Enum inválido
```json
{
  "valid": false,
  "errors": [
    {
      "field": "/tipoDte",
      "message": "must be equal to one of: 01, 03, 05, 06, ..."
    }
  ]
}
```

---

## 🚀 Orden de Implementación Recomendado

1. ✅ **Backend**: Validación DGII schema (COMPLETADO)
2. ✅ **Endpoint**: POST /api/validar-dte (COMPLETADO)
3. ⏳ **Hook**: useValidateDTE (COMPLETADO, listo para usar)
4. **Componente**: FormularioFactura principal
5. **Componentes**: Emisor.tsx, Receptor.tsx, ItemsFactura.tsx
6. **Validación**: En tiempo real campo a campo
7. **Tests**: E2E con casos válidos e inválidos
8. **Documentación**: Actualizar con ejemplos UI

---

## ✅ Checklist para Próxima Fase

- [ ] Crear componente principal FormularioFactura
- [ ] Crear componente Emisor con validación en tiempo real
- [ ] Crear componente Receptor con validación dinámica
- [ ] Crear componente ItemsFactura con tabla
- [ ] Crear ValidationErrorBanner para mostrar errores DGII
- [ ] Integrar useValidateDTE en formulario
- [ ] Mostrar feedback visual (✅/❌) de validación
- [ ] Testear flujo completo
- [ ] Documentar en README

---

**Estado**: Listo para comenzar Fase 1 de integración  
**Prerrequisitos**: Backend validación completado ✅
