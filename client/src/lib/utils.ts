import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-SV", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string | undefined | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-SV", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("es-SV", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
}

export function generateNumeroControl(tipoDte: string, correlativo: number): string {
  const prefix = "DTE";
  const tipo = tipoDte.padStart(2, "0");
  const establecimiento = "M001";
  const punto = "P001";
  const corr = correlativo.toString().padStart(15, "0");
  return `${prefix}-${tipo}-${establecimiento}-${punto}-${corr}`;
}

export function numberToWords(num: number): string {
  const unidades = [
    "", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
    "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE",
    "DIECIOCHO", "DIECINUEVE"
  ];
  const decenas = [
    "", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA",
    "OCHENTA", "NOVENTA"
  ];
  const centenas = [
    "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
    "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"
  ];

  if (num === 0) return "CERO";
  if (num === 100) return "CIEN";

  const convertHundreds = (n: number): string => {
    if (n === 0) return "";
    if (n === 100) return "CIEN";
    if (n < 20) return unidades[n];
    if (n < 100) {
      const dec = Math.floor(n / 10);
      const uni = n % 10;
      if (dec === 2 && uni > 0) return `VEINTI${unidades[uni]}`;
      return uni === 0 ? decenas[dec] : `${decenas[dec]} Y ${unidades[uni]}`;
    }
    const cen = Math.floor(n / 100);
    const resto = n % 100;
    return `${centenas[cen]}${resto > 0 ? ` ${convertHundreds(resto)}` : ""}`;
  };

  const convertThousands = (n: number): string => {
    if (n < 1000) return convertHundreds(n);
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const milesStr = miles === 1 ? "MIL" : `${convertHundreds(miles)} MIL`;
    return resto > 0 ? `${milesStr} ${convertHundreds(resto)}` : milesStr;
  };

  const convertMillions = (n: number): string => {
    if (n < 1000000) return convertThousands(n);
    const millones = Math.floor(n / 1000000);
    const resto = n % 1000000;
    const millStr = millones === 1 ? "UN MILLON" : `${convertThousands(millones)} MILLONES`;
    return resto > 0 ? `${millStr} ${convertThousands(resto)}` : millStr;
  };

  const entero = Math.floor(num);
  const centavos = Math.round((num - entero) * 100);
  
  let resultado = convertMillions(entero);
  
  if (centavos > 0) {
    resultado += ` ${centavos.toString().padStart(2, "0")}/100`;
  } else {
    resultado += " 00/100";
  }
  
  return resultado + " USD";
}

export function calculateIVA(amount: number, rate: number = 0.13): number {
  return Math.round(amount * rate * 100) / 100;
}

export function calculateSubtotal(items: Array<{ cantidad: number; precioUni: number; montoDescu: number }>): number {
  return items.reduce((sum, item) => {
    return sum + (item.cantidad * item.precioUni - item.montoDescu);
  }, 0);
}
