import "dotenv/config";
import { storage } from "../server/storage";
import { randomUUID } from "crypto";

async function testSigmaIntegration() {
  console.log("🚀 Iniciando prueba de integración SIGMA...");

  try {
    // 1. Obtener o crear el tenant por defecto
    const tenant = await storage.ensureDefaultTenant();
    console.log(`✅ Usando Tenant: ${tenant.nombre} (${tenant.id})`);

    // 2. Generar una API Key para la prueba
    const apiKey = await storage.createApiKey(tenant.id, "Test SIGMA Integration");
    console.log(`🔑 API Key generada: ${apiKey}`);

    // 3. Simular el payload que enviaría SIGMA
    const sigmaPayload = {
      externalId: `SIGMA-CONSULTA-${Math.floor(Math.random() * 10000)}`,
      version: 1,
      ambiente: "00",
      tipoDte: "01",
      fecEmi: new Date().toISOString().split('T')[0],
      horEmi: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      tipoModelo: "1",
      tipoOperacion: "1",
      tipoMoneda: "USD",
      emisor: {
        nit: "06141234561015-5",
        nrc: "123456",
        nombre: "CLINICA MEDICA SIGMA",
        codActividad: "86201",
        descActividad: "Actividades de ejercicio de la medicina",
        direccion: {
          departamento: "06",
          municipio: "14",
          complemento: "Colonia Medica, Pasaje 2, #123"
        },
        telefono: "22223333",
        correo: "contacto@sigma.com"
      },
      receptor: {
        tipoDocumento: "13",
        numDocumento: "00000000-0",
        nombre: "PACIENTE DE PRUEBA SIGMA",
        direccion: {
          departamento: "06",
          municipio: "14",
          complemento: "San Salvador"
        },
        correo: "paciente@gmail.com"
      },
      cuerpoDocumento: [
        {
          numItem: 1,
          tipoItem: "2",
          cantidad: 1,
          descripcion: "CONSULTA MEDICA ESPECIALIZADA",
          precioUni: 40.00,
          montoDescu: 0,
          ventaNoSuj: 0,
          ventaExenta: 0,
          ventaGravada: 35.40,
          ivaItem: 4.60
        }
      ],
      resumen: {
        totalNoSuj: 0,
        totalExenta: 0,
        totalGravada: 35.40,
        subTotalVentas: 35.40,
        descuNoSuj: 0,
        descuExenta: 0,
        descuGravada: 0,
        totalDescu: 0,
        subTotal: 35.40,
        ivaRete1: 0,
        reteRenta: 0,
        montoTotalOperacion: 40.00,
        totalNoGravado: 0,
        totalPagar: 40.00,
        totalLetras: "CUARENTA DOLARES EXACTOS",
        totalIva: 4.60,
        condicionOperacion: "1"
      }
    };

    console.log("📡 Enviando factura a FacturaXpress...");

    // 4. Realizar la petición HTTP a nosotros mismos (Server debe estar corriendo o usamos la función directamente)
    // Para que sea una prueba REAL, usaremos fetch apuntando al localhost
    const PORT = process.env.PORT || 5000;
    const response = await fetch(`http://localhost:${PORT}/api/facturas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(sigmaPayload)
    });

    const result = await response.json();

    if (response.ok) {
      console.log("✨ ¡ÉXITO! Factura creada desde SIGMA.");
      console.log("🆔 ID FX:", result.id);
      console.log("📄 Código Generación:", result.codigoGeneracion);
      console.log("🔗 ID Externo (SIGMA):", result.externalId);
      console.log("✅ Estado:", result.estado);
    } else {
      console.error("❌ Falló la creación:", result);
    }

  } catch (error) {
    console.error("💥 Error en la prueba:", error);
  }
}

testSigmaIntegration();
