/**
 * Firma Digital JWS - LEGACY IMPLEMENTATION
 * 
 * ADVERTENCIA: Esta implementación ejecuta en el hilo principal y es CPU-intensive.
 * Para uso en producción, usar signer-worker.ts que delega a Worker Threads.
 * 
 * Este archivo se mantiene por compatibilidad y testing, pero NO debería
 * usarse directamente en endpoints de producción.
 * 
 * @deprecated Usar signDTE de signer-worker.ts en su lugar
 * @see server/lib/signer-worker.ts
 */

import forge from "node-forge";
import stringify from "fast-json-stable-stringify";

export interface SignResult {
  body: string; 
  signature: string;
}

/**
 * Firma un DTE usando el estándar JWS requerido por el MH.
 * CORREGIDO: Usa canonicalización JSON para garantizar orden consistente del Hash.
 * 
 * IMPORTANTE: Esta implementación es CPU-intensive y bloquea el event loop.
 * En producción, usar signDTE de signer-worker.ts que usa Worker Threads.
 * 
 * @deprecated Usar signer-worker.ts para evitar bloqueo del event loop
 */
export async function signDTESync(
  dte: any, 
  p12Base64: string, 
  password: string
): Promise<SignResult> {
  try {
    // 1. Decodificar el P12
    const p12Der = forge.util.decode64(p12Base64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    if (!p12) {
      throw new Error("No se pudo decodificar el certificado P12.");
    }

    let privateKey: any = null;

    // Buscar llave en los SafeBags (estrategia robusta multi-formato)
    try {
        const pkcs8Bags = p12!.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })!;
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
            const simpleBags = p12!.getBags({ bagType: forge.pki.oids.keyBag })!;
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

    // 2. Construcción del JWS (CORREGIDO - Con canonicalización)
    
    // A. Payload Canonicalizado (Orden alfabético GARANTIZADO)
    const payloadString = stringify(dte); 
    const payloadB64 = Buffer.from(payloadString).toString("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    // B. Header (Hacienda exige JWS Compact)
    const header = {
      alg: "RS256",
      typ: "JOSE"
    };
    
    // Canonicalizamos también el header por seguridad
    const headerString = stringify(header);
    const headerB64 = Buffer.from(headerString).toString("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    // C. Firmar con SHA-256
    const dataToSign = `${headerB64}.${payloadB64}`;
    const md = forge.md.sha256.create();
    md.update(dataToSign, "utf8");
    const signature = privateKey.sign(md);
    const signatureB64 = Buffer.from(signature, "binary").toString("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const jws = `${headerB64}.${payloadB64}.${signatureB64}`;

    return {
      body: jws, // Este es el string que va al campo "documento" de la API MH
      signature: signatureB64
    };
  } catch (error) {
    console.error("Error al firmar DTE:", error);
    throw new Error(`Fallo en la firma digital: ${error instanceof Error ? error.message : "Error desconocido"}`);
  }
}