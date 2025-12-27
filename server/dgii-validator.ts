import Ajv from "ajv";
import addFormats from "ajv-formats";
import factuuraSchema from "./dgii-resources/factura-schema.json";

const ajv = new Ajv();
addFormats(ajv); // Agregar soporte para formatos como 'email', 'date', etc.

// Compilar schemas de validación DGII
const validateFactura = ajv.compile(factuuraSchema);

export interface DTEValidationError {
  field: string;
  message: string;
}

/**
 * Valida un DTE (Documento Tributario Electrónico) contra el schema DGII oficial
 * @param dte - Objeto DTE a validar
 * @returns { valid: boolean, errors: DTEValidationError[] }
 */
export function validateDTESchema(dte: any): {
  valid: boolean;
  errors: DTEValidationError[];
} {
  const isValid = validateFactura(dte);

  if (isValid) {
    return { valid: true, errors: [] };
  }

  const errors: DTEValidationError[] = [];

  if (validateFactura.errors) {
    for (const error of validateFactura.errors) {
      errors.push({
        field: error.instancePath || error.schemaPath || "root",
        message: error.message || "Validation failed",
      });
    }
  }

  return { valid: false, errors };
}

/**
 * Valida el número de control (3 dígitos - 18 dígitos)
 */
export function validateNumeroControl(numeroControl: string): boolean {
  const pattern = /^[0-9]{3}-[0-9]{18}$/;
  return pattern.test(numeroControl);
}

/**
 * Valida el código de generación (UUID v4)
 */
export function validateCodigoGeneracion(codigoGeneracion: string): boolean {
  const pattern =
    /^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/;
  return pattern.test(codigoGeneracion);
}

/**
 * Calcula el verificador del NIT (dígito de verificación)
 * Algoritmo DGII
 */
export function calculateNITVerifier(nit: string): string {
  const cleanNit = nit.replace(/\D/g, "").slice(0, 14);
  if (cleanNit.length !== 14) return "";

  const multipliers = [3, 7, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59];
  let sum = 0;

  for (let i = 0; i < 14; i++) {
    sum += parseInt(cleanNit[i]) * multipliers[i];
  }

  const verifier = 11 - (sum % 11);
  return verifier === 10 ? "0" : verifier === 11 ? "9" : verifier.toString();
}

/**
 * Valida un NIT completo (incluye verificador)
 */
export function validateNITComplete(nit: string): boolean {
  const pattern = /^[0-9]{14}-[0-9]$/;
  if (!pattern.test(nit)) return false;

  const [nitPart, verifier] = nit.split("-");
  const calculatedVerifier = calculateNITVerifier(nitPart);

  return calculatedVerifier === verifier;
}

/**
 * Valida un DUI completo (8 dígitos - 1 verificador)
 */
export function validateDUIComplete(dui: string): boolean {
  const pattern = /^[0-9]{8}-[0-9]$/;
  if (!pattern.test(dui)) return false;

  const [duiPart, verifier] = dui.split("-");
  const duiDigits = duiPart.split("").map(Number);

  // Algoritmo de verificación DUI (Algoritmo Modulo 10)
  const multipliers = [2, 3, 4, 5, 6, 7, 2, 3];
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    const product = duiDigits[i] * multipliers[i];
    sum += product >= 10 ? 1 + (product % 10) : product;
  }

  const calculatedVerifier = (10 - (sum % 10)) % 10;
  return calculatedVerifier === parseInt(verifier);
}

/**
 * Obtiene el tipo de documento desde el código
 */
export function getDocumentTypeName(
  code: string
): string | null {
  const types: Record<string, string> = {
    "36": "NIT",
    "13": "DUI",
    "02": "Carnet Residente",
    "03": "Pasaporte",
    "37": "Otro",
  };
  return types[code] || null;
}

/**
 * Obtiene el nombre del tipo de DTE desde el código
 */
export function getDTETypeName(code: string): string | null {
  const types: Record<string, string> = {
    "01": "Factura",
    "03": "Comprobante de Crédito Fiscal",
    "05": "Nota de Débito",
    "06": "Nota de Crédito",
    "07": "Documento Contable de Liquidación",
    "08": "Documento de Retención Definitiva",
    "09": "Documento de Retención por Percepción",
    "11": "Exportación de Bienes",
    "14": "Factura de Sujeto Excluido",
    "15": "Factura Electrónica para Turismo",
  };
  return types[code] || null;
}

export default {
  validateDTESchema,
  validateNumeroControl,
  validateCodigoGeneracion,
  validateNITComplete,
  validateDUIComplete,
  calculateNITVerifier,
  getDocumentTypeName,
  getDTETypeName,
};
