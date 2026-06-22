# Mejoras de Control de Acceso - Seguridad

## Resumen del Problema

Se identificó un problema de seguridad crítico donde los usuarios con acceso `VIEW` (solo lectura) a tratos y cotizaciones podían realizar acciones que no deberían estar permitidas, tales como:

- Crear/modificar artículos en cotizaciones
- Cambiar el estado de una cotización
- Generar PDFs
- Enviar cotizaciones
- Ver y editar permisos en tratos

## Solución Implementada

### 1. **QuoteDetail.tsx** - Validaciones de Acceso en Cotizaciones

Se agregaron validaciones de `access_level` en todos los handlers que realizan operaciones de escritura:

#### Handlers Modificados:
- `handleAddItem()` - Valida antes de permitir agregar artículos
- `handleProductSelection()` - Valida antes de guardar artículos seleccionados
- `handleUpdateItem()` - Valida antes de modificar cantidad/precio
- `handleDeleteItem()` - Valida antes de eliminar artículos
- `handleSaveHeader()` - Valida antes de guardar cambios en nombre/estado
- `handleGeneratePDF()` - Valida antes de generar PDFs
- `handleSendQuote()` - Valida antes de enviar cotizaciones

#### UI Modificada:
1. **Botón "Agregar Artículos"** - Solo visible si `access_level === 'EDIT'` o rol es admin
2. **Inputs de Cantidad y Precio** - Deshabilitados si `access_level !== 'EDIT'`
3. **Botón de Eliminar Artículos** - Solo visible si `access_level === 'EDIT'` o rol es admin
4. **Selector de Estado** - Deshabilitado si `access_level !== 'EDIT'`
5. **Botón Generar PDF** - Deshabilitado si `access_level !== 'EDIT'`
6. **Botón Enviar al Cliente** - Deshabilitado si `access_level !== 'EDIT'`
7. **Inputs de Edición (Nombre/Estado)** - Deshabilitados si `access_level !== 'EDIT'`

### 2. **DealDetail.tsx** - Validaciones de Acceso en Tratos

#### Cambios Realizados:
1. **Pestaña "Permisos"** - Solo visible si `access_level === 'EDIT'` o rol es admin
2. **Botón "Compartir"** - Mantiene la validación existente (solo visible si EDIT o admin)

## Validación de Seguridad

Las validaciones se realizan en dos niveles:

### Nivel 1: Lógica (Backend)
Cada handler verifica:
```typescript
if (quote.access_level !== 'EDIT' && user?.rol_user !== 'admin') {
  setToast({ message: 'No tienes permiso para modificar esta cotización.', type: 'error' });
  return;
}
```

### Nivel 2: Interfaz (Frontend)
- Botones se ocultan si no hay permisos
- Inputs se deshabilitan (desactivados visualmente con `disabled` attribute)
- Selectores se deshabilitan para evitar interacción

## Flujo de Permisos

### Estado: `access_level = 'VIEW'`
- ✅ Ver cotizaciones (lectura)
- ✅ Ver detalles del trato
- ❌ Crear artículos
- ❌ Modificar artículos
- ❌ Eliminar artículos
- ❌ Cambiar estado
- ❌ Generar PDF
- ❌ Enviar cotización
- ❌ Ver/editar permisos

### Estado: `access_level = 'EDIT'` o `rol_user = 'admin'`
- ✅ Todas las operaciones permitidas

## Testing Recomendado

1. **Crear un trato compartido con acceso VIEW**
   - Verificar que no se muestren opciones de edición
   - Intentar modificar URL para entrar en modo edición
   - Verificar que los handlers rechazan las operaciones

2. **Cambiar a acceso EDIT**
   - Verificar que aparecen todas las opciones
   - Probar crear, modificar y eliminar artículos
   - Probar cambiar estado y enviar cotización

3. **Casos Edge**
   - Admin con acceso VIEW debe poder hacer todo
   - Usuario normal con acceso VIEW no debe poder hacer nada
   - Inputs deshabilitados no deben permitir cambios por console

## Archivos Modificados

- `pages/QuoteDetail.tsx` - Validaciones y UI
- `pages/DealDetail.tsx` - Ocultamiento de pestaña de permisos
