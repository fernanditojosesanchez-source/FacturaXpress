import { spawn } from "child_process";
import path from "path";

async function runFullTest() {
  console.log("🚀 Iniciando servidor para prueba...");
  
  const server = spawn("npx", ["tsx", "server/index.ts"], {
    env: { ...process.env, PORT: "5000", NODE_ENV: "development", MH_MOCK_MODE: "true" },
    shell: true
  });

  server.stdout.on("data", (data) => {
    console.log(`[Server]: ${data}`);
  });

  server.stderr.on("data", (data) => {
    console.error(`[Server Error]: ${data}`);
  });

  // Esperar a que el servidor esté listo (aprox 5 seg)
  console.log("⏳ Esperando a que el servidor inicie...");
  await new Promise(resolve => setTimeout(resolve, 6000));

  console.log("🏃 Corriendo script de integración SIGMA...");
  const test = spawn("npx", ["tsx", "script/test-sigma-integration.ts"], {
    env: { ...process.env, PORT: "5000" },
    shell: true
  });

  test.stdout.on("data", (data) => {
    console.log(`[Test]: ${data}`);
  });

  test.stderr.on("data", (data) => {
    console.error(`[Test Error]: ${data}`);
  });

  test.on("close", (code) => {
    console.log(`🏁 Prueba finalizada con código ${code}`);
    server.kill();
    process.exit(code || 0);
  });
}

runFullTest();
