# Plan de Migración a Monorepo

## Estrategia: Migración Incremental con Turborepo

### Estructura Objetivo

```
FacturaXpress/
├── apps/
│   ├── api/                    # Server (Express API)
│   │   ├── server/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web/                    # Client (React + Vite)
│   │   ├── client/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── load-tests/             # k6 load tests
│       ├── scenarios/
│       ├── package.json
│       └── k6.config.js
├── packages/
│   ├── shared/                 # Código compartido
│   │   ├── schema.ts
│   │   ├── types/
│   │   └── package.json
│   ├── ui/                     # Componentes UI reutilizables
│   │   ├── components/
│   │   └── package.json
│   ├── config/                 # Configuraciones compartidas
│   │   ├── eslint/
│   │   ├── typescript/
│   │   └── package.json
│   └── test-utils/             # Utilidades de testing
│       └── package.json
├── turbo.json                  # Configuración de Turborepo
├── package.json                # Root workspace
└── .gitignore
```

## Fase 1: Setup Monorepo Base

### 1.1 Instalar Turborepo
```bash
npm install -D turbo
```

### 1.2 Crear package.json root
```json
{
  "name": "facturaxpress-monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "check": "turbo run check"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

### 1.3 Configurar turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "check": {
      "outputs": []
    }
  }
}
```

## Fase 2: Migrar Packages Compartidos

### 2.1 packages/shared
- Mover `shared/schema.ts` y tipos
- Crear package.json independiente
- Exportar tipos TypeScript

### 2.2 packages/ui
- Extraer componentes UI de `client/src/components/ui`
- Configurar build con tsup o vite
- Exportar componentes reutilizables

### 2.3 packages/config
- Configuraciones ESLint, TypeScript, Tailwind
- Compartir entre apps

## Fase 3: Crear Apps

### 3.1 apps/api (Server)
```bash
mkdir -p apps/api
mv server apps/api/
mv drizzle.config.ts apps/api/
```

**apps/api/package.json**:
```json
{
  "name": "@facturaxpress/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "tsx script/build.ts",
    "start": "node dist/index.cjs",
    "check": "tsc"
  },
  "dependencies": {
    "@facturaxpress/shared": "workspace:*",
    "express": "^4.21.2",
    "drizzle-orm": "^0.39.3"
  }
}
```

### 3.2 apps/web (Client)
```bash
mkdir -p apps/web
mv client apps/web/
mv vite.config.ts apps/web/
mv postcss.config.js apps/web/
mv tailwind.config.ts apps/web/
```

**apps/web/package.json**:
```json
{
  "name": "@facturaxpress/web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host --port 3015",
    "build": "vite build",
    "preview": "vite preview",
    "check": "tsc"
  },
  "dependencies": {
    "@facturaxpress/shared": "workspace:*",
    "@facturaxpress/ui": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

### 3.3 apps/load-tests (k6)
```bash
mkdir -p apps/load-tests
```

**apps/load-tests/package.json**:
```json
{
  "name": "@facturaxpress/load-tests",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test:smoke": "k6 run scenarios/smoke.js",
    "test:load": "k6 run scenarios/load.js",
    "test:stress": "k6 run scenarios/stress.js",
    "test:spike": "k6 run scenarios/spike.js"
  },
  "devDependencies": {
    "k6": "latest"
  }
}
```

## Fase 4: Configurar Load Testing con k6

### 4.1 Instalar k6
```bash
# Windows (Chocolatey)
choco install k6

# O descargar desde https://k6.io/docs/get-started/installation/
```

### 4.2 Crear Escenarios

**apps/load-tests/scenarios/smoke.js**:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:5000/api/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

**apps/load-tests/scenarios/load.js**:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp-up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp-up to 200
    { duration: '5m', target: 200 }, // Stay at 200
    { duration: '2m', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const endpoints = [
    '/api/facturas',
    '/api/productos',
    '/api/receptores',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`http://localhost:5000${endpoint}`);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  
  sleep(1);
}
```

**apps/load-tests/scenarios/stress.js**:
```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '5m', target: 300 },
    { duration: '2m', target: 400 },
    { duration: '5m', target: 400 },
    { duration: '10m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const res = http.post('http://localhost:5000/api/facturas', JSON.stringify({
    // Sample payload
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(res, {
    'status is 201': (r) => r.status === 201,
  });
}
```

**apps/load-tests/scenarios/spike.js**:
```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '10s', target: 1400 }, // Spike!
    { duration: '3m', target: 1400 },
    { duration: '10s', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '10s', target: 0 },
  ],
};

export default function () {
  const res = http.get('http://localhost:5000/api/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

### 4.3 Configurar SLOs (Service Level Objectives)

**apps/load-tests/slos.json**:
```json
{
  "slos": {
    "availability": {
      "target": 99.9,
      "threshold": "http_req_failed < 0.001"
    },
    "latency": {
      "p95": 500,
      "p99": 1000,
      "threshold": "http_req_duration{p(95)}<500"
    },
    "throughput": {
      "target": 1000,
      "unit": "req/s"
    }
  }
}
```

### 4.4 Chaos Testing con k6

**apps/load-tests/scenarios/chaos.js**:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  scenarios: {
    chaos: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 100 },
      ],
    },
  },
};

export default function () {
  // Simular fallos aleatorios
  const shouldFail = Math.random() < 0.1; // 10% de fallos
  
  if (shouldFail) {
    // Simular timeout o error de red
    sleep(randomIntBetween(5, 10));
    return;
  }
  
  const res = http.get('http://localhost:5000/api/facturas');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
```

## Fase 5: Scripts de Migración

### 5.1 Script de movimiento de archivos
```bash
#!/bin/bash
# migrate.sh

echo "Creando estructura de monorepo..."
mkdir -p apps/api apps/web apps/load-tests
mkdir -p packages/shared packages/ui packages/config

echo "Moviendo server..."
mv server apps/api/

echo "Moviendo client..."
mv client apps/web/

echo "Moviendo shared..."
mv shared packages/

echo "Migración completada!"
```

### 5.2 Actualizar imports
Crear script TypeScript para actualizar todos los imports:
```typescript
// script/update-imports.ts
import { promises as fs } from 'fs';
import { glob } from 'glob';

const updateImports = async () => {
  const files = await glob('apps/**/*.ts', { ignore: 'node_modules/**' });
  
  for (const file of files) {
    let content = await fs.readFile(file, 'utf-8');
    
    // Actualizar imports de shared
    content = content.replace(
      /from ['"]\.\.\/\.\.\/shared\//g,
      "from '@facturaxpress/shared/"
    );
    
    await fs.writeFile(file, content, 'utf-8');
  }
};

updateImports();
```

## Ventajas del Monorepo

1. **Compartición de código**: Tipos y utilidades compartidas sin duplicación
2. **Builds incrementales**: Solo reconstruye lo que cambió
3. **Testing unificado**: Ejecutar todos los tests desde un comando
4. **Load testing integrado**: k6 como parte del workspace
5. **Versionado atómico**: Cambios coordinados entre apps y packages
6. **CI/CD optimizado**: Cacheo inteligente de builds

## Próximos Pasos

1. ✅ Crear plan de migración
2. ⏳ Instalar turborepo
3. ⏳ Crear estructura de carpetas
4. ⏳ Migrar packages compartidos
5. ⏳ Configurar apps
6. ⏳ Instalar y configurar k6
7. ⏳ Crear escenarios de load testing
8. ⏳ Ejecutar pruebas de carga
9. ⏳ Documentar resultados

## Comandos Finales

```bash
# Desarrollo
npm run dev              # Inicia todas las apps
npm run dev --filter=api # Solo API
npm run dev --filter=web # Solo Web

# Testing
npm run test             # Todos los tests
npm run test:load        # Load tests con k6

# Build
npm run build            # Build de producción
npm run build --filter=api # Solo API

# Linting
npm run lint             # Lint de todo el monorepo
```
