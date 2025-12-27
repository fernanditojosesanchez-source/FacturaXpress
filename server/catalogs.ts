/**
 * Catálogos estándar de El Salvador (DGII)
 * Estos datos se pueden servir desde API y cachear en cliente
 */

export const DEPARTAMENTOS_EL_SALVADOR = [
  { codigo: "01", nombre: "Ahuachapán" },
  { codigo: "02", nombre: "Santa Ana" },
  { codigo: "03", nombre: "Sonsonate" },
  { codigo: "04", nombre: "Chalatenango" },
  { codigo: "05", nombre: "La Libertad" },
  { codigo: "06", nombre: "San Salvador" },
  { codigo: "07", nombre: "Cuscatlán" },
  { codigo: "08", nombre: "La Paz" },
  { codigo: "09", nombre: "Cabañas" },
  { codigo: "10", nombre: "San Vicente" },
  { codigo: "11", nombre: "Usulután" },
  { codigo: "12", nombre: "San Miguel" },
  { codigo: "13", nombre: "Morazán" },
  { codigo: "14", nombre: "La Unión" },
];

export const TIPOS_DOCUMENTO = [
  { codigo: "36", nombre: "NIT", patron: /^\d{14}-\d/ },
  { codigo: "13", nombre: "DUI", patron: /^\d{8}-\d/ },
  { codigo: "02", nombre: "Carnet de Residente", patron: null },
  { codigo: "03", nombre: "Pasaporte", patron: null },
  { codigo: "37", nombre: "Otro", patron: null },
];

export const TIPOS_DTE = [
  { codigo: "01", nombre: "Factura" },
  { codigo: "03", nombre: "Comprobante de Crédito Fiscal" },
  { codigo: "05", nombre: "Nota de Crédito" },
  { codigo: "06", nombre: "Nota de Débito" },
  { codigo: "07", nombre: "Nota de Remisión" },
  { codigo: "08", nombre: "Comprobante de Liquidación" },
  { codigo: "09", nombre: "Documento Contable de Liquidación" },
  { codigo: "11", nombre: "Factura de Exportación" },
  { codigo: "14", nombre: "Factura Sujeto Excluido" },
  { codigo: "15", nombre: "Comprobante de Donación" },
];

export const CONDICIONES_OPERACION = [
  { codigo: "1", nombre: "Contado" },
  { codigo: "2", nombre: "A crédito" },
  { codigo: "3", nombre: "Otro" },
];

export const FORMAS_PAGO = [
  { codigo: "01", nombre: "Billetes y monedas" },
  { codigo: "02", nombre: "Tarjeta Débito" },
  { codigo: "03", nombre: "Tarjeta Crédito" },
  { codigo: "04", nombre: "Cheque" },
  { codigo: "05", nombre: "Transferencia - Depósito Bancario" },
  { codigo: "06", nombre: "Vales" },
  { codigo: "07", nombre: "Pago a cuenta" },
  { codigo: "08", nombre: "Bitcoin" },
  { codigo: "99", nombre: "Otros" },
];

export const TIPOS_ITEM = [
  { codigo: "1", nombre: "Bienes" },
  { codigo: "2", nombre: "Servicios" },
  { codigo: "3", nombre: "Ambos (Bien y Servicio)" },
  { codigo: "4", nombre: "Otro" },
];

export const UNIDADES_MEDIDA = [
  { codigo: 1, nombre: "Metro" },
  { codigo: 2, nombre: "Yarda" },
  { codigo: 3, nombre: "Vara" },
  { codigo: 4, nombre: "Pie" },
  { codigo: 5, nombre: "Pulgada" },
  { codigo: 6, nombre: "Milímetro" },
  { codigo: 7, nombre: "Centímetro" },
  { codigo: 8, nombre: "Kilómetro" },
  { codigo: 9, nombre: "Metro Cuadrado" },
  { codigo: 10, nombre: "Hectárea" },
  { codigo: 11, nombre: "Metro Cúbico" },
  { codigo: 12, nombre: "Onza" },
  { codigo: 13, nombre: "Libra" },
  { codigo: 14, nombre: "Gramo" },
  { codigo: 15, nombre: "Kilogramo" },
  { codigo: 16, nombre: "Tonelada" },
  { codigo: 17, nombre: "Litro" },
  { codigo: 18, nombre: "Galón" },
  { codigo: 19, nombre: "Barril" },
  { codigo: 20, nombre: "Unidad" },
  { codigo: 21, nombre: "Par" },
  { codigo: 22, nombre: "Docena" },
  { codigo: 23, nombre: "Ciento" },
  { codigo: 24, nombre: "Millar" },
  { codigo: 99, nombre: "Otra" },
];

/**
 * Validación de NIT (14 dígitos + 1 verificador)
 * Formato: XXXXXXXXXXX-X
 */
export function validateNIT(nit: string): boolean {
  const nitPattern = /^\d{14}-\d$/;
  if (!nitPattern.test(nit)) return false;
  // Aquí podrías añadir lógica de checksum si lo requiere DGII
  return true;
}

/**
 * Validación de DUI (8 dígitos + 1 verificador)
 * Formato: XXXXXXXX-X
 */
export function validateDUI(dui: string): boolean {
  const duiPattern = /^\d{8}-\d$/;
  if (!duiPattern.test(dui)) return false;
  // Aquí podrías añadir lógica de checksum
  return true;
}

/**
 * Validación de correo electrónico
 */
export function validateEmail(email: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}
