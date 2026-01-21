/**
 * Script de Verificación del Gateway
 * 
 * Ejecutar en la consola del navegador (DevTools) para verificar
 * que la integración con el Gateway está funcionando correctamente
 */

// ============================================
// 1. VERIFICAR TOKENS GUARDADOS
// ============================================

const appToken = localStorage.getItem('appToken');
const user = JSON.parse(localStorage.getItem('user') || '{}');







// ============================================
// 2. VERIFICAR HEADERS EN REQUESTS
// ============================================



console.log('  Authorization: Bearer ' + (appToken ? appToken.substring(0, 20) + '...' : 'NO ENCONTRADO'));

// ============================================
// 3. PROBAR ENDPOINTS DEL GATEWAY
// ============================================


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

  const tenantsResult = await callApi(`/api/tenants?id_user=${user?.id_user}`);


  
  if (user?.id_tenant) {

    const tenantResult = await callApi(`/api/tenants/detail?id_tenant=${user.id_tenant}`);


  }
}

// Ejecutar pruebas
testGatewayEndpoints();

// ============================================
// 4. RESUMEN DE INFORMACIÓN
// ============================================








// ============================================
// 5. COMANDOS ÚTILES
// ============================================


console.log('  localStorage.getItem("appToken")');

console.log('  JSON.parse(localStorage.getItem("user"))');
console.log('\nSimular logout (borrar tokens):');
console.log('  localStorage.removeItem("appToken")');
console.log('  localStorage.removeItem("user")');
console.log('  localStorage.removeItem("token")');

console.log('  location.reload()');

// ============================================
// 6. VERIFICACIÓN FINAL
// ============================================

const checks = {
  'appToken en localStorage': !!appToken,
  'Usuario en localStorage': !!user?.id_user,
  'ID Tenant disponible': !!user?.id_tenant,
  'Email disponible': !!user?.email,
};

let allPassed = true;
for (const [check, passed] of Object.entries(checks)) {

  if (!passed) allPassed = false;
}

console.log('\n' + (allPassed ? '✓ Todo OK' : '✗ Hay problemas'));
