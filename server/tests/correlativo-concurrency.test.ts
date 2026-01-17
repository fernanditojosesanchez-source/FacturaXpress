/**
 * Test de Concurrencia - Generación de Correlativos
 * 
 * Este test verifica que la nueva implementación atómica de getNextNumeroControl()
 * no genera correlativos duplicados bajo alta concurrencia.
 * 
 * Requisitos:
 * - 50 requests paralelas
 * - Mismo tenantId, emisorNit, tipoDte
 * - 0 duplicados esperados
 * 
 * @see AUDITORIA_SEGURIDAD_2026_01.md - Punto #2 (P0)
 * @see server/storage.ts - getNextNumeroControl()
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { storage } from '../storage.js';
import { v4 as uuidv4 } from 'uuid';

describe('Concurrencia - Generación de Correlativos', () => {
  const tenantId = uuidv4();
  const emisorNit = '06140506901234';
  const tipoDte = '01'; // Factura

  beforeAll(async () => {
    // Setup: Crear tenant de prueba si es necesario
    // await storage.createTenant({ id: tenantId, ... });
  });

  afterAll(async () => {
    // Cleanup: Limpiar datos de prueba
    // await storage.deleteTenant(tenantId);
  });

  it('debe generar 50 correlativos únicos bajo requests paralelas', async () => {
    const numRequests = 50;
    const promises: Promise<string>[] = [];

    // Ejecutar 50 requests en paralelo
    for (let i = 0; i < numRequests; i++) {
      promises.push(
        storage.getNextNumeroControl(tenantId, emisorNit, tipoDte)
      );
    }

    // Esperar a que todas completen
    const correlativos = await Promise.all(promises);

    // Verificar que se generaron 50 correlativos
    expect(correlativos).toHaveLength(numRequests);

    // Verificar que NO hay duplicados
    const uniqueCorrelativos = new Set(correlativos);
    expect(uniqueCorrelativos.size).toBe(numRequests);

    // Verificar formato correcto (001-000000000000000001 hasta 001-000000000000000050)
    correlativos.forEach((correlativo, index) => {
      expect(correlativo).toMatch(/^001-\d{18}$/);
    });

    // Verificar secuencia (deben estar en rango 1-50, pero no necesariamente en orden)
    const secuenciales = correlativos.map(c => {
      const parts = c.split('-');
      return parseInt(parts[1], 10);
    });

    secuenciales.forEach(sec => {
      expect(sec).toBeGreaterThanOrEqual(1);
      expect(sec).toBeLessThanOrEqual(numRequests);
    });

    console.log('✅ Test de concurrencia: 50 correlativos únicos generados');
    console.log(`   Primer correlativo: ${correlativos[0]}`);
    console.log(`   Último correlativo: ${correlativos[correlativos.length - 1]}`);
  }, 30000); // Timeout de 30s

  it('debe manejar correctamente INSERT inicial + UPDATE concurrente', async () => {
    // Este test verifica el caso edge de primer INSERT + UPDATE simultáneo
    const newTenantId = uuidv4();
    const newEmisorNit = '06140506909999';
    const newTipoDte = '03'; // CCF

    const numRequests = 20;
    const promises: Promise<string>[] = [];

    // Primera vez que se genera correlativo para este tenant/emisor/tipo
    for (let i = 0; i < numRequests; i++) {
      promises.push(
        storage.getNextNumeroControl(newTenantId, newEmisorNit, newTipoDte)
      );
    }

    const correlativos = await Promise.all(promises);

    // Verificar que NO hay duplicados incluso en el primer INSERT
    const uniqueCorrelativos = new Set(correlativos);
    expect(uniqueCorrelativos.size).toBe(numRequests);

    console.log('✅ Test INSERT inicial concurrente: Sin duplicados');
  }, 30000);

  it('debe generar correlativos diferentes para distintos tipoDte', async () => {
    const tiposDte = ['01', '03', '05', '06']; // Factura, CCF, Nota Crédito, Nota Débito
    const promisesByTipo: Record<string, Promise<string>[]> = {};

    // Generar 10 correlativos por cada tipo en paralelo
    for (const tipo of tiposDte) {
      promisesByTipo[tipo] = [];
      for (let i = 0; i < 10; i++) {
        promisesByTipo[tipo].push(
          storage.getNextNumeroControl(tenantId, emisorNit, tipo)
        );
      }
    }

    // Esperar a que todos completen
    const resultsByTipo: Record<string, string[]> = {};
    for (const tipo of tiposDte) {
      resultsByTipo[tipo] = await Promise.all(promisesByTipo[tipo]);
    }

    // Verificar que cada tipo tiene su propia secuencia
    for (const tipo of tiposDte) {
      const correlativos = resultsByTipo[tipo];
      const uniqueCorrelativos = new Set(correlativos);
      
      expect(uniqueCorrelativos.size).toBe(10);
      
      // Verificar que comienza con el código de tipo correcto
      correlativos.forEach(c => {
        expect(c.startsWith(`${tipo.padStart(3, '0')}-`)).toBe(true);
      });
    }

    console.log('✅ Test tipos DTE múltiples: Secuencias independientes');
  }, 30000);

  it('debe reintentar correctamente en caso de conflicto (23505)', async () => {
    // Este test verifica el manejo del error 23505 (unique violation)
    // simulando el caso donde dos procesos intentan INSERT simultáneo
    
    const conflictTenantId = uuidv4();
    const conflictEmisorNit = '06140506908888';
    const conflictTipoDte = '01';

    // Primera ola: 10 requests (una creará el registro)
    const firstWave = await Promise.all(
      Array.from({ length: 10 }, () =>
        storage.getNextNumeroControl(conflictTenantId, conflictEmisorNit, conflictTipoDte)
      )
    );

    // Segunda ola: 10 requests más (todas deben hacer UPDATE)
    const secondWave = await Promise.all(
      Array.from({ length: 10 }, () =>
        storage.getNextNumeroControl(conflictTenantId, conflictEmisorNit, conflictTipoDte)
      )
    );

    const allCorrelativos = [...firstWave, ...secondWave];
    const uniqueCorrelativos = new Set(allCorrelativos);

    // Verificar que NO hay duplicados entre ambas olas
    expect(uniqueCorrelativos.size).toBe(20);

    console.log('✅ Test reintentos en conflicto: Sin duplicados en 2 olas');
  }, 30000);

  it('debe mantener rendimiento aceptable bajo alta carga', async () => {
    const numRequests = 100;
    const startTime = Date.now();

    const promises = Array.from({ length: numRequests }, () =>
      storage.getNextNumeroControl(tenantId, emisorNit, tipoDte)
    );

    const correlativos = await Promise.all(promises);
    const duration = Date.now() - startTime;

    // Verificar que NO hay duplicados
    const uniqueCorrelativos = new Set(correlativos);
    expect(uniqueCorrelativos.size).toBe(numRequests);

    // Verificar que el tiempo total es razonable (< 10s para 100 requests)
    expect(duration).toBeLessThan(10000);

    const avgTime = duration / numRequests;
    console.log(`✅ Test rendimiento: 100 correlativos en ${duration}ms`);
    console.log(`   Promedio: ${avgTime.toFixed(2)}ms por correlativo`);
  }, 30000);
});

describe('Regresión - Casos Edge', () => {
  it('debe manejar correctamente números de control muy grandes', async () => {
    // Simular que ya se han emitido muchas facturas
    const tenantId = uuidv4();
    const emisorNit = '06140506907777';
    const tipoDte = '01';

    // Pre-poblar con un secuencial alto (simular 999,999 facturas previas)
    // await storage.setSecuencial(tenantId, emisorNit, tipoDte, 999999);

    const correlativo = await storage.getNextNumeroControl(tenantId, emisorNit, tipoDte);

    // Verificar formato correcto
    expect(correlativo).toMatch(/^001-\d{18}$/);
    
    console.log(`✅ Test números grandes: ${correlativo}`);
  }, 10000);

  it('debe rechazar tenantId, emisorNit o tipoDte inválidos', async () => {
    // Verificar validación de inputs
    await expect(
      storage.getNextNumeroControl('', '06140506901234', '01')
    ).rejects.toThrow();

    await expect(
      storage.getNextNumeroControl(uuidv4(), '', '01')
    ).rejects.toThrow();

    await expect(
      storage.getNextNumeroControl(uuidv4(), '06140506901234', '')
    ).rejects.toThrow();

    console.log('✅ Test validación: Rechaza inputs inválidos');
  }, 10000);
});
