import type { Factura, Emisor, InsertFactura } from "@shared/schema";
import { randomUUID } from "crypto";

// Datos de prueba realistas para El Salvador

export const EMISOR_PRUEBA: Emisor = {
  nit: "0614-160689-101-8",
  nrc: "12345-6",
  nombre: "COMERCIAL LA ESPERANZA S.A. DE C.V.",
  nombreComercial: "La Esperanza",
  codActividad: "47191",
  descActividad: "Venta al por menor en comercios no especializados",
  tipoEstablecimiento: "01",
  direccion: {
    departamento: "06",
    municipio: "14",
    complemento: "Colonia Escalón, Calle Principal #123, San Salvador"
  },
  telefono: "2250-1234",
  correo: "ventas@laesperanza.com.sv",
  codEstableMH: "0001",
  codEstable: "0001",
  codPuntoVentaMH: "0001",
  codPuntoVenta: "0001"
};

export const RECEPTORES_PRUEBA = [
  {
    tipoDocumento: "36" as const,
    numDocumento: "0614-250588-102-5",
    nrc: "23456-7",
    nombre: "INVERSIONES TÉCNICAS S.A. DE C.V.",
    codActividad: "62010",
    descActividad: "Programación informática",
    direccion: {
      departamento: "06",
      municipio: "14",
      complemento: "Zona Rosa, Edificio Empresarial Torre 2, Oficina 305"
    },
    telefono: "2245-6789",
    correo: "contabilidad@invtec.com.sv"
  },
  {
    tipoDocumento: "13" as const,
    numDocumento: "03456789-1",
    nombre: "MARÍA JOSÉ RAMÍREZ GONZÁLEZ",
    direccion: {
      departamento: "06",
      municipio: "14",
      complemento: "Colonia Miramonte, Pasaje Los Robles #45"
    },
    telefono: "7123-4567",
    correo: "mramirez@email.com"
  },
  {
    tipoDocumento: "36" as const,
    numDocumento: "0614-180692-103-2",
    nrc: "34567-8",
    nombre: "RESTAURANTE EL BUEN SABOR S.A. DE C.V.",
    codActividad: "56101",
    descActividad: "Restaurantes y puestos de comidas",
    direccion: {
      departamento: "06",
      municipio: "14",
      complemento: "Boulevard del Hipódromo, Local 12-A"
    },
    telefono: "2260-8888",
    correo: "administracion@buensabor.sv"
  },
  {
    tipoDocumento: "36" as const,
    numDocumento: "0614-110585-104-9",
    nrc: "45678-9",
    nombre: "FARMACIA SALUD TOTAL S.A. DE C.V.",
    codActividad: "47730",
    descActividad: "Venta al por menor de productos farmacéuticos",
    direccion: {
      departamento: "06",
      municipio: "14",
      complemento: "Centro Comercial Galerías, Local B-23"
    },
    telefono: "2234-5678",
    correo: "ventas@saludtotal.com.sv"
  },
  {
    tipoDocumento: "13" as const,
    numDocumento: "04567890-2",
    nombre: "CARLOS ALBERTO GARCÍA MÉNDEZ",
    direccion: {
      departamento: "05",
      municipio: "08",
      complemento: "Residencial Santa Elena, Casa 456"
    },
    telefono: "7234-5678",
    correo: "cgarcia@outlook.com"
  }
];

export const PRODUCTOS_SERVICIOS = [
  {
    descripcion: "Laptop Dell Inspiron 15, 8GB RAM, 256GB SSD",
    precioUni: 650.00,
    tipoItem: "1" as const,
    codigo: "LAP-DEL-001"
  },
  {
    descripcion: "Mouse inalámbrico Logitech M185",
    precioUni: 12.50,
    tipoItem: "1" as const,
    codigo: "MOU-LOG-185"
  },
  {
    descripcion: "Teclado mecánico RGB",
    precioUni: 45.00,
    tipoItem: "1" as const,
    codigo: "TEC-RGB-001"
  },
  {
    descripcion: "Monitor LED 24 pulgadas Full HD",
    precioUni: 180.00,
    tipoItem: "1" as const,
    codigo: "MON-LED-24"
  },
  {
    descripcion: "Servicio de instalación y configuración de software",
    precioUni: 75.00,
    tipoItem: "2" as const,
    codigo: "SRV-INST-001"
  },
  {
    descripcion: "Impresora multifuncional HP LaserJet",
    precioUni: 320.00,
    tipoItem: "1" as const,
    codigo: "IMP-HP-LJ"
  },
  {
    descripcion: "Cable HDMI 2.0 de 2 metros",
    precioUni: 8.50,
    tipoItem: "1" as const,
    codigo: "CAB-HDMI-2M"
  },
  {
    descripcion: "Webcam HD 1080p con micrófono integrado",
    precioUni: 55.00,
    tipoItem: "1" as const,
    codigo: "WEB-HD-1080"
  },
  {
    descripcion: "Disco duro externo 1TB USB 3.0",
    precioUni: 65.00,
    tipoItem: "1" as const,
    codigo: "HDD-EXT-1TB"
  },
  {
    descripcion: "Soporte técnico mensual remoto",
    precioUni: 150.00,
    tipoItem: "2" as const,
    codigo: "SRV-SUP-MEN"
  },
  {
    descripcion: "Memoria USB 32GB Kingston",
    precioUni: 10.00,
    tipoItem: "1" as const,
    codigo: "USB-32GB"
  },
  {
    descripcion: "Audífonos Bluetooth con cancelación de ruido",
    precioUni: 85.00,
    tipoItem: "1" as const,
    codigo: "AUD-BT-NC"
  },
  {
    descripcion: "Cargador universal para laptop 90W",
    precioUni: 25.00,
    tipoItem: "1" as const,
    codigo: "CAR-UNI-90W"
  },
  {
    descripcion: "Mousepad ergonómico con reposa muñecas",
    precioUni: 15.00,
    tipoItem: "1" as const,
    codigo: "MPD-ERG-001"
  },
  {
    descripcion: "Licencia Microsoft Office 365 Personal (1 año)",
    precioUni: 69.99,
    tipoItem: "4" as const,
    codigo: "LIC-OFF365-P"
  }
];

function generarNumeroControl(tipo: string, consecutivo: number): string {
  const establecimiento = "0001";
  const puntoVenta = "0001";
  return `DTE-${tipo}-${establecimiento}-${puntoVenta}-${consecutivo.toString().padStart(15, "0")}`;
}

function generarCodigoGeneracion(): string {
  return randomUUID().toUpperCase();
}

function numeroALetras(numero: number): string {
  const unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
  const decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
  const centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
  
  let parteEntera = Math.floor(numero);
  const parteDecimal = Math.round((numero - parteEntera) * 100);
  
  if (parteEntera === 0) {
    return `CERO DÓLARES CON ${parteDecimal.toString().padStart(2, "0")}/100`;
  }
  
  let resultado = "";
  
  if (parteEntera >= 1000) {
    const miles = Math.floor(parteEntera / 1000);
    resultado += miles === 1 ? "MIL " : `${unidades[miles]} MIL `;
    parteEntera %= 1000;
  }
  
  if (parteEntera >= 100) {
    resultado += centenas[Math.floor(parteEntera / 100)] + " ";
    parteEntera %= 100;
  }
  
  if (parteEntera >= 10) {
    resultado += decenas[Math.floor(parteEntera / 10)] + " ";
    parteEntera %= 10;
  }
  
  if (parteEntera > 0) {
    resultado += unidades[parteEntera] + " ";
  }
  
  return `${resultado.trim()} DÓLARES CON ${parteDecimal.toString().padStart(2, "0")}/100`;
}

export function generarFacturasPrueba(cantidad: number = 10): InsertFactura[] {
  const facturas: InsertFactura[] = [];
  const fechaBase = new Date();
  
  for (let i = 0; i < cantidad; i++) {
    // Fecha aleatoria en los últimos 30 días
    const diasAtras = Math.floor(Math.random() * 30);
    const fecha = new Date(fechaBase);
    fecha.setDate(fecha.getDate() - diasAtras);
    
    const fecEmi = fecha.toISOString().split("T")[0];
    const horEmi = `${fecha.getHours().toString().padStart(2, "0")}:${fecha.getMinutes().toString().padStart(2, "0")}:${fecha.getSeconds().toString().padStart(2, "0")}`;
    
    // Receptor aleatorio
    const receptor = RECEPTORES_PRUEBA[Math.floor(Math.random() * RECEPTORES_PRUEBA.length)];
    
    // Número aleatorio de ítems (1-5)
    const numItems = Math.floor(Math.random() * 5) + 1;
    const items = [];
    
    let totalGravada = 0;
    
    for (let j = 0; j < numItems; j++) {
      const producto = PRODUCTOS_SERVICIOS[Math.floor(Math.random() * PRODUCTOS_SERVICIOS.length)];
      const cantidad = Math.floor(Math.random() * 5) + 1;
      const ventaGravada = producto.precioUni * cantidad;
      totalGravada += ventaGravada;
      
      items.push({
        numItem: j + 1,
        tipoItem: producto.tipoItem,
        cantidad: cantidad,
        codigo: producto.codigo,
        uniMedida: 99,
        descripcion: producto.descripcion,
        precioUni: producto.precioUni,
        montoDescu: 0,
        ventaNoSuj: 0,
        ventaExenta: 0,
        ventaGravada: ventaGravada,
        tributos: ["20"],
        psv: 0,
        noGravado: 0,
        ivaItem: ventaGravada * 0.13
      });
    }
    
    const subTotal = totalGravada;
    const totalIva = subTotal * 0.13;
    const totalPagar = subTotal + totalIva;
    
    // Estado aleatorio (más facturas generadas para poder transmitir)
    const estados: Array<"borrador" | "generada" | "transmitida" | "sellada" | "anulada"> = 
      ["borrador", "generada", "generada", "generada", "sellada", "sellada", "transmitida"];
    const estado = estados[Math.floor(Math.random() * estados.length)];
    
    const factura: InsertFactura = {
      version: 1,
      ambiente: "00",
      tipoDte: "01",
      numeroControl: generarNumeroControl("01", 1000 + i),
      codigoGeneracion: generarCodigoGeneracion(),
      tipoModelo: "1",
      tipoOperacion: "1",
      tipoContingencia: null,
      motivoContin: null,
      fecEmi,
      horEmi,
      tipoMoneda: "USD",
      emisor: EMISOR_PRUEBA,
      receptor,
      cuerpoDocumento: items,
      resumen: {
        totalNoSuj: 0,
        totalExenta: 0,
        totalGravada: totalGravada,
        subTotalVentas: totalGravada,
        descuNoSuj: 0,
        descuExenta: 0,
        descuGravada: 0,
        porcentajeDescuento: 0,
        totalDescu: 0,
        tributos: [{
          codigo: "20",
          descripcion: "Impuesto al Valor Agregado 13%",
          valor: totalIva
        }],
        subTotal: subTotal,
        ivaRete1: 0,
        reteRenta: 0,
        montoTotalOperacion: totalPagar,
        totalNoGravado: 0,
        totalPagar: totalPagar,
        totalLetras: numeroALetras(totalPagar),
        totalIva: totalIva,
        saldoFavor: 0,
        condicionOperacion: "1",
        pagos: [{
          codigo: "01",
          montoPago: totalPagar,
          referencia: undefined,
          plazo: undefined,
          periodo: undefined
        }],
        numPagoElectronico: undefined
      },
      extension: {
        nombEntrega: "Juan Pérez",
        docuEntrega: "01234567-8",
        nombRecibe: receptor.nombre.split(" ")[0] + " " + receptor.nombre.split(" ")[1],
        docuRecibe: receptor.numDocumento,
        observaciones: "Entrega inmediata",
        placaVehiculo: undefined
      },
      apendice: undefined,
      selloRecibido: estado === "sellada" || estado === "transmitida" 
        ? `SELLO-PRUEBA-${Date.now()}-${i}` 
        : null,
      estado
    };
    
    facturas.push(factura);
  }
  
  return facturas;
}

export function generarFacturaUnica(): InsertFactura {
  return generarFacturasPrueba(1)[0];
}
