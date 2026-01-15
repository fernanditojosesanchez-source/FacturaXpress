// script/generar-certificado-prueba.ts
import forge from 'node-forge';
import fs from 'fs';

console.log("🔐 Generando certificado P12 de prueba...\n");

// 1. Generar par de llaves RSA
const keys = forge.pki.rsa.generateKeyPair(2048);
console.log("✅ Par de llaves RSA generado");

// 2. Crear certificado X.509
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [{
  name: 'commonName',
  value: 'Prueba FacturaXpress'
}, {
  name: 'countryName',
  value: 'SV'
}, {
  shortName: 'ST',
  value: 'San Salvador'
}, {
  name: 'organizationName',
  value: 'Test Organization'
}];

cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey, forge.md.sha256.create());
console.log("✅ Certificado X.509 creado");

// 3. Crear PKCS#12
const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
  keys.privateKey,
  cert,
  'prueba123', // Password
  {
    algorithm: '3des'
  }
);

const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
fs.writeFileSync('mi-certificado-falso.p12', p12Der, 'binary');

console.log("✅ Certificado P12 guardado: mi-certificado-falso.p12");
console.log("🔑 Password: prueba123");
console.log("\n✨ ¡Listo para usar con test-firma.ts!");
