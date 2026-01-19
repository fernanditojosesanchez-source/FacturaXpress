/**
 * Worker Thread Implementation para Firma Digital JWS
 * 
 * Este worker ejecuta operaciones CPU-intensive de firma en un hilo separado,
 * previniendo el bloqueo del event loop principal de Node.js.
 * 
 * @see AUDITORIA_SEGURIDAD_2026_01.md - Punto #5
 */

import { parentPort, workerData } from 'worker_threads';
import forge from 'node-forge';
import stringify from 'fast-json-stable-stringify';

interface WorkerInput {
  dte: any;
  p12: Buffer;
  password: Buffer;
}

interface WorkerOutput {
  success: boolean;
  body?: string;
  signature?: string;
  error?: string;
}

/**
 * Función principal del worker
 */
async function signDTEInWorker(input: WorkerInput): Promise<WorkerOutput> {
  try {
    const { dte, p12, password } = input;

    // 1. Decodificar el P12 (CPU-intensive)
    // Forge ASN1 from DER (Binary Buffer)
    // Convertir node buffer a forge binary string (eficiente)
    const p12Binary = p12.toString('binary');
    const p12Asn1 = forge.asn1.fromDer(p12Binary);
    const passwordStr = password.toString('utf-8');

    // Parse PKCS12
    const p12Parsed = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passwordStr);

    if (!p12Parsed) {
      throw new Error("No se pudo decodificar el certificado P12.");
    }

    let privateKey: any = null;

    // Buscar llave en los SafeBags (estrategia robusta multi-formato)
    try {
      const pkcs8Bags = p12Parsed!.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })!;
      const pkcs8Array = (pkcs8Bags![forge.pki.oids.pkcs8ShroudedKeyBag] || []) as any;
      if (pkcs8Array!.length > 0 && pkcs8Array![0]!.key) {
        privateKey = pkcs8Array![0]!.key;
      }
    } catch (e) {
      // Ignorar error y probar con keyBag
    }

    if (!privateKey) {
      // Fallback para certificados viejos o keyBags simples
      try {
        const simpleBags = p12Parsed!.getBags({ bagType: forge.pki.oids.keyBag })!;
        const simpleArray = (simpleBags![forge.pki.oids.keyBag] || []) as any;
        if (simpleArray!.length > 0 && simpleArray![0]!.key) {
          privateKey = simpleArray![0]!.key;
        }
      } catch (e) {
        // Ignorar error
      }
    }

    if (!privateKey) {
      throw new Error("No se pudo extraer la llave privada del P12. Verifique el formato.");
    }

    // 2. Construcción del JWS (CPU-intensive)

    // A. Payload Canonicalizado (Orden alfabético GARANTIZADO)
    const payloadString = stringify(dte);
    const payloadB64 = Buffer.from(payloadString).toString("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    // B. Header (Hacienda exige JWS Compact)
    const header = {
      alg: "RS256",
      typ: "JOSE"
    };

    // C. Canonicalizamos también el header por seguridad
    const headerString = stringify(header);
    const headerB64 = Buffer.from(headerString).toString("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    // D. Firmar con SHA-256 (CPU-intensive)
    const dataToSign = `${headerB64}.${payloadB64}`;
    const md = forge.md.sha256.create();
    md.update(dataToSign, "utf8");
    const signature = privateKey.sign(md);
    const signatureB64 = Buffer.from(signature, "binary").toString("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const jws = `${headerB64}.${payloadB64}.${signatureB64}`;

    return {
      success: true,
      body: jws,
      signature: signatureB64
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido en firma"
    };
  }
}

// Ejecutar cuando el worker recibe datos via postMessage
if (parentPort) {
  parentPort.on('message', (message: WorkerInput) => {
    signDTEInWorker(message)
      .then((result) => {
        parentPort!.postMessage(result);
      })
      .catch((error) => {
        parentPort!.postMessage({
          success: false,
          error: error instanceof Error ? error.message : "Error desconocido en worker thread"
        });
      });
  });
}
