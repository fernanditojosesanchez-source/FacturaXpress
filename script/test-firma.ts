// test-firma.ts
import { signDTE } from '../server/lib/signer';
import fs from 'fs';

async function test() {
  const miCertificado = fs.readFileSync('./mi-certificado-falso.p12').toString('base64');
  const miPassword = 'prueba123'; // O la que hayas puesto
  
  const facturaPrueba = {
    nit: "0614-240797-001-1",
    total: 100.00
  };

  console.log("✍️ Firmando...");
  const resultado = await signDTE(facturaPrueba, miCertificado, miPassword);
  
  console.log("✅ ¡ÉXITO! JWS Generado:");
  console.log(resultado.body);
  console.log("\n📝 Longitud del JWS:", resultado.body.length);
  console.log("🔐 Firma (últimos 50 chars):", resultado.signature.slice(-50));
}

test().catch(error => {
  console.error("❌ Error en la prueba:", error.message);
  process.exit(1);
});
