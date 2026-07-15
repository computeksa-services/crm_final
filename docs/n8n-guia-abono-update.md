# Guia: Crear Workflow n8n - Actualizar Abono

## Paso 1: Crear Nuevo Workflow
1. En n8n, haz clic en **"Add Workflow"**
2. Nómbralo: `API - Actualizar Abono`

## Paso 2: Agregar Nodo Webhook Trigger
1. Busca **"Webhook"** en el panel de nodos
2. Configura:
   - **HTTP Method:** `POST`
   - **Path:** `api/financial/abono/update`
   - **Response Mode:** `Response Node`
3. **Guarda** y copia la URL de test:
   ```
   https://service.computeksa.com/webhook-test/api/financial/abono/update
   ```

## Paso 3: Agregar Nodo Code (Validar)
1. Agrega un nodo **"Code"**
2. Pega este código:

```javascript
const body = $input.first().json.body || $input.first().json;

const id_payment = body.id_payment;
const id_tenant = body.id_tenant;
const id_transaction = body.id_transaction;
const amount = body.amount !== undefined ? Number(body.amount) : undefined;
const payment_date = body.payment_date || undefined;
const payment_method = body.payment_method || undefined;
const reference = body.reference || undefined;
const notes = body.notes || undefined;

if (!id_payment || !id_tenant || !id_transaction) {
  return [{
    json: {
      success: false,
      message: 'Faltan campos requeridos: id_payment, id_tenant, id_transaction',
      status: 400
    }
  }];
}

if (amount !== undefined && (isNaN(amount) || amount <= 0)) {
  return [{
    json: {
      success: false,
      message: 'El monto debe ser un numero mayor a 0',
      status: 400
    }
  }];
}

if (payment_method && !['TRANSFERENCIA', 'EFECTIVO', 'CHEQUE', 'TARJETA'].includes(payment_method)) {
  return [{
    json: {
      success: false,
      message: 'Metodo de pago invalido. Use: TRANSFERENCIA, EFECTIVO, CHEQUE o TARJETA',
      status: 400
    }
  }];
}

return [{
  json: {
    id_payment,
    id_tenant,
    id_transaction,
    amount,
    payment_date,
    payment_method,
    reference,
    notes
  }
}];
```

## Paso 4: Agregar Nodo IF (Verificar Validacion)
1. Agrega un nodo **"IF"**
2. Condicion: `{{ $json.id_payment }}` **is not empty**

## Paso 5: Rama FALSE - Responder Error
1. Agrega nodo **"Respond to Webhook"**
2. Response Code: `{{ $json.status || 400 }}`
3. Response Body: `{{ JSON.stringify({ success: false, message: $json.message }) }}`

## Paso 6: Rama TRUE - Consultar Abono Actual
1. Agrega nodo **"Postgres"**
2. Operation: **Execute Query**
3. Query:
```sql
SELECT id_payment, amount, payment_date, payment_method, reference, notes
FROM pagos
WHERE id_payment = $1
  AND id_tenant = $2
  AND id_transaction = $3
```
4. Parameters:
   - $1: `{{ $('Code').item.json.id_payment }}`
   - $2: `{{ $('Code').item.json.id_tenant }}`
   - $3: `{{ $('Code').item.json.id_transaction }}`

## Paso 7: Verificar si Existe
1. Agrega nodo **"IF"**
2. Condicion: `{{ $json.length > 0 }}`

### Rama FALSE:
- **Respond to Webhook** con 404:
```json
{ "success": false, "message": "Abono no encontrado" }
```

### Rama TRUE:
Continuar al Paso 8...

## Paso 8: Recalcular (si amount cambio)
1. Agrega nodo **"Code"**:

```javascript
const currentPayment = $input.first().json;
const updateData = $('Code').first().json;

const oldAmount = Number(currentPayment.amount);
const newAmount = updateData.amount !== undefined ? Number(updateData.amount) : oldAmount;
const amountChanged = updateData.amount !== undefined && newAmount !== oldAmount;
const diff = amountChanged ? newAmount - oldAmount : 0;

return [{
  json: {
    ...updateData,
    old_amount: oldAmount,
    new_amount: newAmount,
    amount_changed: amountChanged,
    amount_diff: diff
  }
}];
```

## Paso 9: IF - Monto Cambio?
1. Agrega nodo **"IF"**
2. Condicion: `{{ $json.amount_changed }}`

### Rama TRUE (monto cambio):
1. **Postgres** - Consultar transaccion:
```sql
SELECT monto_pagado_caja, total_factura, due_date, status
FROM financial_transactions
WHERE id_transaction = $1 AND id_tenant = $2
```

2. **Code** - Recalcular estado:
```javascript
const tx = $input.first().json;
const updateData = $('Code').first().json;

const currentPaid = Number(tx.monto_pagado_caja || 0);
const totalInvoice = Number(tx.total_factura || 0);
const diff = updateData.amount_diff;

const newPaidAmount = currentPaid + diff;

let newStatus = tx.status;
if (newPaidAmount >= totalInvoice && totalInvoice > 0) {
  newStatus = 'PAGADO';
} else if (newPaidAmount < totalInvoice) {
  const now = new Date();
  const dueDate = tx.due_date ? new Date(tx.due_date) : null;
  if (dueDate && dueDate < now) {
    newStatus = 'VENCIDO';
  } else {
    newStatus = 'PENDIENTE';
  }
}

return [{
  json: {
    id_transaction: updateData.id_transaction,
    id_tenant: updateData.id_tenant,
    new_paid_amount: newPaidAmount,
    new_status: newStatus,
    update_data: updateData
  }
}];
```

3. **Postgres** - Actualizar transaccion:
```sql
UPDATE financial_transactions
SET monto_pagado_caja = $1, status = $2, fecha_modificacion = NOW()
WHERE id_transaction = $3 AND id_tenant = $4
```

### Rama FALSE (monto NO cambio):
Ir directo al Paso 10

## Paso 10: Actualizar Abono
1. **Postgres** - Query dinamico con COALESCE:

```sql
UPDATE pagos SET
  amount = COALESCE($1, amount),
  payment_date = COALESCE($2, payment_date),
  payment_method = COALESCE($3, payment_method),
  reference = COALESCE($4, reference),
  notes = COALESCE($5, notes),
  fecha_modificacion = NOW()
WHERE id_payment = $6
  AND id_tenant = $7
  AND id_transaction = $8
RETURNING id_payment, amount, payment_date, payment_method, reference, notes
```

Parameters:
- $1: `{{ $('Code').first().json.amount || null }}`
- $2: `{{ $('Code').first().json.payment_date || null }}`
- $3: `{{ $('Code').first().json.payment_method || null }}`
- $4: `{{ $('Code').first().json.reference || null }}`
- $5: `{{ $('Code').first().json.notes || null }}`
- $6: `{{ $('Code').first().json.id_payment }}`
- $7: `{{ $('Code').first().json.id_tenant }}`
- $8: `{{ $('Code').first().json.id_transaction }}`

## Paso 11: Responder Exito
1. **Respond to Webhook** - Response Code: `200`
2. Response Body:
```json
{
  "success": true,
  "message": "Abono actualizado correctamente",
  "payment": {
    "id_payment": "{{ $json.id_payment }}",
    "amount": {{ $json.amount }},
    "payment_date": "{{ $json.payment_date }}",
    "payment_method": "{{ $json.payment_method }}",
    "reference": "{{ $json.reference }}",
    "notes": "{{ $json.notes }}"
  }
}
```

## Paso 12: Probar
1. Clic en **"Test Workflow"** en n8n
2. Abre la consola del navegador (F12) en el CRM
3. Ve a una transaccion y edita un abono
4. Verifica en Network Tab que llega a n8n

## URL de Production (cuando actives)
```
https://service.computeksa.com/webhook/api/financial/abono/update
```

## Notas Importantes
- El **Path** del Webhook debe ser exactamente: `api/financial/abono/update`
- Si usas Gateway, verifica que el Gateway esté configurado para enrutar este endpoint a n8n
- La tabla `pagos` debe existir en tu base de datos
- La tabla `financial_transactions` debe tener las columnas `monto_pagado_caja`, `total_factura`, `due_date`, `status`
