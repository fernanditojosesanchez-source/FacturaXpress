import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function hash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function main() {
  const url = process.env.DGII_SCHEMA_URL;
  const baseDir = path.resolve("server/dgii-resources");
  const localFile = path.join(baseDir, "factura-schema.json");
  const remoteFile = path.join(baseDir, "factura-schema.remote.json");
  const metaFile = path.join(baseDir, "metadata.json");

  if (!url) {
    console.log("DGII_SCHEMA_URL no definida. Nada por hacer.");
    process.exit(0);
  }

  console.log(`Descargando schema desde: ${url}`);
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    console.error(`Error descargando schema: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const jsonText = await res.text();
  const remoteHash = hash(jsonText);

  let localHash = "";
  if (fs.existsSync(localFile)) {
    const localText = fs.readFileSync(localFile, "utf8");
    localHash = hash(localText);
  }

  const changed = remoteHash !== localHash;
  if (changed) {
    fs.writeFileSync(remoteFile, jsonText, "utf8");
    fs.writeFileSync(metaFile, JSON.stringify({
      lastChecked: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      sourceUrl: url,
      remoteHash,
      localHash,
      updated: true,
    }, null, 2));
    console.log("✅ Schema remoto actualizado en:", remoteFile);
  } else {
    fs.writeFileSync(metaFile, JSON.stringify({
      lastChecked: new Date().toISOString(),
      sourceUrl: url,
      remoteHash,
      localHash,
      updated: false,
    }, null, 2));
    console.log("Sin cambios en el schema.");
  }
}

main().catch((err) => {
  console.error("sync-schemas error:", err);
  process.exit(1);
});
