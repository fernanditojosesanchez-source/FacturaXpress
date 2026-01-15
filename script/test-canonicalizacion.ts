/**
 * Test de Canonicalización JSON
 * Demuestra que stringify() garantiza orden consistente vs JSON.stringify()
 */

import stringify from "fast-json-stable-stringify";
import crypto from "crypto";

console.log("🧪 TEST: Canonicalización JSON para Firma JWS\n");
console.log("═".repeat(70));

// Objeto de prueba simulando un DTE
const dte1 = {
  total: 100.50,
  nit: "0614-240797-001-1",
  fecha: "2026-01-14",
  items: [
    { cantidad: 2, precio: 25.25 },
    { cantidad: 1, precio: 50.00 }
  ]
};

// Mismo objeto pero con propiedades en orden diferente
const dte2 = {
  items: [
    { precio: 25.25, cantidad: 2 },
    { precio: 50.00, cantidad: 1 }
  ],
  fecha: "2026-01-14",
  nit: "0614-240797-001-1",
  total: 100.50
};

console.log("\n📋 OBJETO 1 (orden original):");
console.log(JSON.stringify(dte1, null, 2));

console.log("\n📋 OBJETO 2 (orden diferente, datos idénticos):");
console.log(JSON.stringify(dte2, null, 2));

console.log("\n" + "═".repeat(70));
console.log("🔴 PROBLEMA: JSON.stringify() SIN canonicalización\n");

const json1 = JSON.stringify(dte1);
const json2 = JSON.stringify(dte2);

console.log("String 1:", json1);
console.log("String 2:", json2);
console.log("\n¿Son iguales?:", json1 === json2 ? "✅ SÍ" : "❌ NO");
console.log("Longitud 1:", json1.length);
console.log("Longitud 2:", json2.length);

// Simular hash
const hash1 = crypto.createHash("sha256").update(json1).digest("hex");
const hash2 = crypto.createHash("sha256").update(json2).digest("hex");

console.log("\nHash SHA-256 (Objeto 1):", hash1);
console.log("Hash SHA-256 (Objeto 2):", hash2);
console.log("¿Hashes iguales?:", hash1 === hash2 ? "✅ SÍ" : "❌ NO");

console.log("\n⚠️  IMPACTO: Firmas diferentes para MISMO documento → Rechazo de Hacienda");

console.log("\n" + "═".repeat(70));
console.log("✅ SOLUCIÓN: fast-json-stable-stringify CON canonicalización\n");

const canonical1 = stringify(dte1);
const canonical2 = stringify(dte2);

console.log("String Canonicalizado 1:", canonical1);
console.log("String Canonicalizado 2:", canonical2);
console.log("\n¿Son iguales?:", canonical1 === canonical2 ? "✅ SÍ" : "❌ NO");
console.log("Longitud 1:", canonical1.length);
console.log("Longitud 2:", canonical2.length);

const hashCanon1 = crypto.createHash("sha256").update(canonical1).digest("hex");
const hashCanon2 = crypto.createHash("sha256").update(canonical2).digest("hex");

console.log("\nHash SHA-256 (Canónico 1):", hashCanon1);
console.log("Hash SHA-256 (Canónico 2):", hashCanon2);
console.log("¿Hashes iguales?:", hashCanon1 === hashCanon2 ? "✅ SÍ" : "❌ NO");

console.log("\n✅ RESULTADO: Firmas IDÉNTICAS para mismo documento → Aceptación garantizada");

console.log("\n" + "═".repeat(70));
console.log("📊 RESUMEN DE PRUEBA\n");

console.log("Método              | Strings Iguales | Hashes Iguales | Firma Estable");
console.log("-".repeat(70));
console.log(`JSON.stringify()    | ${json1 === json2 ? '✅ SÍ' : '❌ NO'}          | ${hash1 === hash2 ? '✅ SÍ' : '❌ NO'}           | ${hash1 === hash2 ? '✅' : '❌'}`);
console.log(`stringify() (canon) | ${canonical1 === canonical2 ? '✅ SÍ' : '❌ NO'}          | ${hashCanon1 === hashCanon2 ? '✅ SÍ' : '❌ NO'}           | ${hashCanon1 === hashCanon2 ? '✅' : '❌'}`);

console.log("\n" + "═".repeat(70));
console.log("🎯 CONCLUSIÓN\n");
console.log("✅ La canonicalización JSON es CRÍTICA para firmas digitales");
console.log("✅ fast-json-stable-stringify garantiza orden alfabético constante");
console.log("✅ Mismo documento = Mismo hash = Misma firma = Aceptación de Hacienda");
console.log("❌ Sin canonicalización = Firmas aleatorias = Rechazos impredecibles\n");
