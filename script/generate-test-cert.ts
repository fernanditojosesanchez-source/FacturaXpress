import forge from "node-forge";
import fs from "fs";

export function generateTestP12(password: string) {
  console.log("Generating test certificate...");
  
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  
  const attrs = [
    { name: "commonName", value: "FacturaXpress Test Cert" },
    { name: "countryName", value: "SV" },
    { shortName: "ST", value: "San Salvador" },
    { name: "localityName", value: "San Salvador" },
    { name: "organizationName", value: "FS Digital" },
    { shortName: "OU", value: "Desarrollo" }
  ];
  
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  
  // Convertir a P12 ASN.1
  // Importante: No usar opciones complejas para máxima compatibilidad al leer
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, password, {
    generateLocalKeyId: true,
    friendlyName: "test-cert",
    algorithm: "aes256"
  });
  
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Base64 = Buffer.from(p12Der, "binary").toString("base64");
  
  return p12Base64;
}

if (process.argv[1].includes("generate-test-cert") || process.env.RUN_SCRIPT === "true") {
  const b64 = generateTestP12("password123");
  fs.writeFileSync("test-cert.p12.base64", b64);
  console.log("✅ Certificado de prueba generado en test-cert.p12.base64");
}