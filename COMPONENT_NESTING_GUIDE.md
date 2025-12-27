# Guía de Componentes Sensibles a Anidación

## Problema: Anidado de Etiquetas Semánticas

HTML tiene restricciones estrictas sobre qué elementos pueden contener otros. Los errores de anidación más comunes causados por mal uso de `<Link>` de Wouter:

### ❌ INCORRECTO: `<a>` dentro de `<Link>`

```tsx
<Link href="/page">
  <a className="...">Click me</a>
</Link>
```

**Problema**: Wouter's `<Link>` ya renderiza un `<a>` internamente. Añadir otro `<a>` crea HTML inválido:
```html
<a href="/page"><a>Click me</a></a>  <!-- ❌ INVALID -->
```

**Error en consola**:
```
Warning: validateDOMNesting(...): <a> cannot appear as a descendant of <a>.
```

---

## ✅ CORRECTO: Patrones Válidos

### 1. Link con className directo
```tsx
<Link
  href="/page"
  className="px-3.5 py-2 text-sm font-medium rounded-full hover:bg-white/70"
>
  Click me
</Link>
```
**Resultado HTML**:
```html
<a href="/page" class="px-3.5 py-2 ...">Click me</a>  ✅ VALID
```

---

### 2. Link con componentes de UI (Button, Badge, etc.)
```tsx
<Link href="/page">
  <Button>Click me</Button>
</Link>
```
**OK porque**: `<Button>` es un componente custom que típicamente renderiza `<button>` o un elemento no-link. Wouter maneja bien esto.

**PERO**: Si `<Button>` internamente puede renderizar `<a>`, entonces es un problema.

---

### 3. Link con contenido mixto
```tsx
<Link href="/page" className="block p-4 hover:bg-gray-100">
  <h2>Título</h2>
  <p>Descripción</p>
</Link>
```
**Resultado HTML**:
```html
<a href="/page" class="block p-4 ...">
  <h2>Título</h2>
  <p>Descripción</p>
</a>  ✅ VALID
```

---

## 🚨 Otros Anidados Peligrosos

### `<button>` dentro de `<button>`
```tsx
// ❌ INCORRECTO
<button onClick={handleClick}>
  <button onClick={handleNested}>Nested</button>
</button>

// ✅ CORRECTO
<button onClick={handleClick}>
  <span>Content</span>
</button>
```

### `<div>` dentro de `<a>` sin precaución
```tsx
// ⚠️ Puede ser válido pero evitar si es posible
<Link href="/page">
  <div className="card">
    <p>Contenido</p>
  </div>
</Link>

// ✅ MÁS LIMPIO - Usar className directamente
<Link href="/page" className="block p-4 rounded">
  <p>Contenido</p>
</Link>
```

---

## 📋 Checklist para Componentes Link

Cuando uses `<Link>` de Wouter:

- [ ] **No hay `<a>` directo dentro**: No pongas `<a>` como hijo directo de `<Link>`
- [ ] **No hay `<button>` anidado**: Si necesitas `<button>`, usa el Click Handler del Link
- [ ] **Usa className si solo necesitas estilar**: `<Link className="...">` es más limpio
- [ ] **Verifica formatos especiales**: Card, Badge, etc. están OK si no son semánticos (no son `<a>` ni `<button>`)
- [ ] **Revisa console en dev**: Busca warnings de `validateDOMNesting`

---

## 🎯 Patrón Recomendado para Botones/Links

```tsx
// ❌ ANTIGUO (con <a> anidado)
<Link href="/factura/nueva">
  <a className="px-3 py-2 rounded">Nueva Factura</a>
</Link>

// ✅ NUEVO (className directo)
<Link
  href="/factura/nueva"
  className="px-3 py-2 rounded hover:bg-gray-100 transition"
>
  Nueva Factura
</Link>

// ✅ ALTERNATIVA: Si necesitas componente Button
<Link href="/factura/nueva">
  <Button>Nueva Factura</Button>
</Link>
```

---

## 🛠️ ESLint Rule

Se ha añadido una regla ESLint personalizada que alerta sobre estos patrones. Ejecuta:

```bash
npm run lint
```

Para validar tu código automáticamente.

---

## 📚 Referencias

- [Wouter Docs](https://github.com/molefrog/wouter)
- [HTML Spec: Interactive Content](https://html.spec.whatwg.org/multipage/dom.html#interactive-content)
- [React Docs: Composition](https://react.dev/learn/composition-with-components)
