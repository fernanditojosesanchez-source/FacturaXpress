import "dotenv/config";
import { storage } from "../server/storage";
import { mhService } from "../server/mh-service";
import { signDTE } from "../server/lib/signer";
import fs from "fs";

async function main() {
  console.log("🛠️  INICIANDO PRUEBA SAAS: CREACIÓN DE FERRETERÍA VIRTUAL");
  
  // 1. Crear el Tenant (La Ferretería)
  const nombre = "Ferretería El Tornillo";
  const slug = "ferreteria-el-tornillo";
  
  console.log(`1️⃣  Creando empresa: ${nombre}...`);
  let tenant = await storage.getTenantBySlug(slug);
  
  if (!tenant) {
    tenant = await storage.createTenant(nombre, slug);
    console.log("   ✅ Empresa creada con ID:", tenant.id);
  } else {
    console.log("   ℹ️  La empresa ya existía (ID:", tenant.id, ")");
  }

  // 2. Configurar Credenciales (Simular subida de .p12)
  console.log("2️⃣  Configurando certificado digital...");
  const p12Base64 = fs.readFileSync("test-cert.p12.base64", "utf8").trim();
  
  await storage.saveTenantCredentials(tenant.id, {
    mhUsuario: "ferretero01",
    mhPass: "ClaveFerreteria123",
    certificadoP12: p12Base64,
    certificadoPass: "password123",
    ambiente: "pruebas"
  });
  console.log("   ✅ Credenciales encriptadas y guardadas.");

  // 3. Configurar Datos del Emisor (Dirección, NIT, etc.)
  console.log("3️⃣  Configurando datos fiscales...");
  await storage.saveEmisor(tenant.id, {
    nit: "0614-010190-123-4",
    nrc: "123456-7",
    nombre: "Ferretería El Tornillo S.A. de C.V.",
    codActividad: "47520",
    descActividad: "Venta al por menor de artículos de ferretería",
    telefono: "22558899",
    correo: "ventas@eltornillo.com",
    direccion: {
      departamento: "06",
      municipio: "14",
      complemento: "Calle al Volcán, Local 5"
    }
  });
  console.log("   ✅ Datos fiscales guardados.");

  // 4. Emitir una Factura (Prueba de Fuego)
  console.log("4️⃣  Generando factura de prueba (Martillo + Clavos)...");
  
  const facturaPayload: any = {
    codigoGeneracion: "DTE-" + Date.now(), // Normalmente UUID
    fecEmi: "2026-01-08",
    horEmi: "10:30:00",
    emisor: { nit: "0614-010190-123-4" }, // Se rellenará con lo guardado
    receptor: {
      tipoDocumento: "36",
      numDocumento: "0614-201085-102-1",
      nombre: "Juan Pérez (Cliente Final)",
      direccion: { departamento: "06", municipio: "14", complemento: "San Salvador" },
      telefono: "77777777",
      correo: "juan@gmail.com"
    },
    cuerpoDocumento: [
      {
        numItem: 1,
        tipoItem: "1", // Bien
        cantidad: 1,
        descripcion: "Martillo de uña 16oz",
        precioUni: 15.00,
        ventaGravada: 15.00,
        uniMedida: 59
      },
      {
        numItem: 2,
        tipoItem: "1", // Bien
        cantidad: 50,
        descripcion: "Clavo de acero 2 pulg",
        precioUni: 0.05,
        ventaGravada: 2.50,
        uniMedida: 59
      }
    ],
    resumen: {
      subTotal: 17.50,
      totalGravada: 17.50,
      totalIva: 2.28,
      totalPagar: 19.78,
      totalLetras: "DIECINUEVE 78/100 USD"
    }
  };

  // Crear en BD
  const factura = await storage.createFactura(tenant.id, facturaPayload);
  console.log("   ✅ Factura guardada en DB (Estado: borrador)");

  // 5. Firmar y Transmitir
  console.log("5️⃣  Probando motor de firma...");
  try {
    const creds = await storage.getTenantCredentials(tenant.id);
    const { body: jws } = await signDTE(factura, creds.certificadoP12, creds.certificadoPass);
    console.log("   ✅ Firma JWS generada con éxito (Longitud:", jws.length, "caracteres)");
    console.log("   📝 Fragmento del JWS firmado:", jws.substring(0, 50) + "...");

    console.log("\n6️⃣  Simulando transmisión al MH...");
    // Forzamos modo simulación para obtener el sello final en esta prueba
    process.env.MH_MOCK_MODE = "true";
    const resultado = await mhService.transmitirDTE(factura, tenant.id);
    
    console.log("\n🎉 ¡FLUJO SAAS COMPLETADO CON ÉXITO!");
    console.log("   🏢 Empresa:", tenant.nombre);
    console.log("   📝 Sello de Hacienda:", resultado.selloRecibido);
    console.log("   🔒 Seguridad: Certificado P12 aislado y encriptado.");
  } catch (error) {
    console.error("   ❌ Error en el flujo:", error);
  }

  process.exit(0);
}

main().catch(console.error);
