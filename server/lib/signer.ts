import forge from "node-forge";
import stringify from "fast-json-stable-stringify";

export interface SignResult {
  body: string; 
  signature: string;
}

/**
 * Firma un DTE usando el estándar JWS requerido por el MH.
 * CORREGIDO: Usa canonicalización JSON para garantizar orden consistente del Hash.
 */
export async function signDTE(
  dte: any, 
  p12Base64: string, 
  password: string
): Promise<SignResult> {
  try {
    // 1. Decodificar el P12
    const p12Der = forge.util.decode64(p12Base64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    let privateKey: any;

    // Buscar llave en los SafeBags (estrategia robusta multi-formato)
    const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    if (bags[forge.pki.oids.pkcs8ShroudedKeyBag] && bags[forge.pki.oids.pkcs8ShroudedKeyBag].length > 0) {
        privateKey = bags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
    } else {
        // Fallback para certificados viejos o keyBags simples
        const keyBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
        if (keyBags[forge.pki.oids.keyBag] && keyBags[forge.pki.oids.keyBag].length > 0) {
            privateKey = keyBags[forge.pki.oids.keyBag][0].key;
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