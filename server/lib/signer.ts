import forge from "node-forge";

export interface SignResult {
  body: string; 
  signature: string;
}

/**
 * Firma un DTE usando el estándar JWS requerido por el MH.
 */
export async function signDTE(
  dte: any, 
  p12Base64: string, 
  password: string
): Promise<SignResult> {
  try {
    const p12Der = forge.util.decode64(p12Base64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    let privateKey: any;
    let certificate: any;

    // Buscar llave y certificado en los SafeBags
    for (const safeContents of p12.safeContents as any[]) {
      for (const safeEntry of safeContents.safeEntries || []) {
        if (safeEntry.key) {
          privateKey = safeEntry.key;
        }
        if (safeEntry.cert) {
          certificate = safeEntry.cert;
        }
      }
    }

    // Intento alternativo si no se encontró en safeEntries
    if (!privateKey) {
      for (const safeContents of p12.safeContents as any[]) {
        const bags = safeContents.safeBags || [];
        for (const bag of bags) {
          if (bag.key) privateKey = bag.key;
          if (bag.cert) certificate = bag.cert;
        }
      }
    }

    if (!privateKey) {
      throw new Error("No se pudo extraer la llave privada del P12");
    }

    // Construcción del JWS (Payload -> Base64URL)
    const payload = JSON.stringify(dte);
    const payloadB64 = Buffer.from(payload).toString("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const header = {
      alg: "RS256",
      typ: "JOSE"
    };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const dataToSign = `${headerB64}.${payloadB64}`;
    const md = forge.md.sha256.create();
    md.update(dataToSign, "utf8");
    const signature = privateKey.sign(md);
    const signatureB64 = Buffer.from(signature, "binary").toString("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const jws = `${headerB64}.${payloadB64}.${signatureB64}`;

    return {
      body: jws,
      signature: signatureB64
    };
  } catch (error) {
    console.error("Error al firmar DTE:", error);
    throw new Error(`Fallo en la firma digital: ${error instanceof Error ? error.message : "Error desconocido"}`);
  }
}