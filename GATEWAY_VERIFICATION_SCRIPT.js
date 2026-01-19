/**
 * Script de Verificación del Gateway
 * 
 * Ejecutar en la consola del navegador (DevTools) para verificar
 * que la integración con el Gateway está funcionando correctamente
 */

// ============================================
// 1. VERIFICAR TOKENS GUARDADOS
// ============================================
console.log('=== VERIFICACIÓN DE TOKENS ===');
const appToken = localStorage.getItem('appToken');
const user = JSON.parse(localStorage.getItem('user') || '{}');

console.log('✓ appToken guardado:', appToken ? '✓ Sí' : '✗ No');
console.log('✓ Usuario guardado:', user?.id_user ? '✓ Sí' : '✗ No');
console.log('  - ID Usuario:', user?.id_user);
console.log('  - ID Tenant:', user?.id_tenant);
console.log('  - Email:', user?.email);

// ============================================
// 2. VERIFICAR HEADERS EN REQUESTS
// ============================================
console.log('\n=== VERIFICACIÓN DE HEADERS ===');
console.log('Abre Network tab en DevTools y haz una petición');
console.log('Verifica que tenga header:');
console.log('  Authorization: Bearer ' + (appToken ? appToken.substring(0, 20) + '...' : 'NO ENCONTRADO'));

// ============================================
// 3. PROBAR ENDPOINTS DEL GATEWAY
// ============================================
console.log('\n=== PRUEBA DE ENDPOINTS ===');

async function testGatewayEndpoints() {
  const token = localStorage.getItem('appToken');
  
  if (!token) {
    console.error('✗ No hay appToken. Debes hacer login primero.');
    return;
  }
  
  // Función helper para peticiones
  async function callApi(endpoint, method = 'GET', body = null) {
    try {
      const response = await fetch(`${import.meta.env.VITE_WEBHOOK_URL}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      
      const data = await response.json();
      return { status: response.status, ok: response.ok, data };
    } catch (error) {
      return { status: 'ERROR', ok: false, error: error.message };
    }
  }
  
  // Probar endpoints
  console.log('\n1. Listado de Tenants:');
  const tenantsResult = await callApi(`/api/tenants?id_user=${user?.id_user}`);
  console.log('   Status:', tenantsResult.status);
  console.log('   ✓ Response:', tenantsResult.ok ? '✓ OK' : '✗ Error');
  
  if (user?.id_tenant) {
    console.log('\n2. Detalle de Tenant:');
    const tenantResult = await callApi(`/api/tenants/detail?id_tenant=${user.id_tenant}`);
    console.log('   Status:', tenantResult.status);
    console.log('   ✓ Response:', tenantResult.ok ? '✓ OK' : '✗ Error');
  }
}

// Ejecutar pruebas
testGatewayEndpoints();

// ============================================
// 4. RESUMEN DE INFORMACIÓN
// ============================================
console.log('\n=== RESUMEN ===');
console.log(`Gateway URL: ${import.meta.env.VITE_WEBHOOK_URL}`);
console.log('Auth Endpoint: /auth/login');
console.log('API Base: /api/...');
console.log('Provider usado: google | microsoft');
console.log('\nToken Storage: localStorage.appToken');
console.log('Usuario Storage: localStorage.user');

// ============================================
// 5. COMANDOS ÚTILES
// ============================================
console.log('\n=== COMANDOS ÚTILES ===');
console.log('Ver token:');
console.log('  localStorage.getItem("appToken")');
console.log('\nVer usuario:');
console.log('  JSON.parse(localStorage.getItem("user"))');
console.log('\nSimular logout (borrar tokens):');
console.log('  localStorage.removeItem("appToken")');
console.log('  localStorage.removeItem("user")');
console.log('  localStorage.removeItem("token")');
console.log('\nRecargar página:');
console.log('  location.reload()');

// ============================================
// 6. VERIFICACIÓN FINAL
// ============================================
console.log('\n=== VERIFICACIÓN FINAL ===');
const checks = {
  'appToken en localStorage': !!appToken,
  'Usuario en localStorage': !!user?.id_user,
  'ID Tenant disponible': !!user?.id_tenant,
  'Email disponible': !!user?.email,
};

let allPassed = true;
for (const [check, passed] of Object.entries(checks)) {
  console.log(`${passed ? '✓' : '✗'} ${check}`);
  if (!passed) allPassed = false;
}

console.log('\n' + (allPassed ? '✓ Todo OK' : '✗ Hay problemas'));
