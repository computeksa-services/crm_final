# Endpoint: Actualizar Abono (Pago)

## Configuración en n8n

**URL:** `POST /api/financial/abono/update`

### Headers

```
Content-Type: application/json
Authorization: Bearer {{token}}
```

### Body (JSON)

```json
{
  "id_payment": "string (requerido) — ID del abono a actualizar",
  "id_tenant": "string (requerido) — ID del tenant",
  "id_transaction": "string (requerido) — ID de la transacción padre",
  "amount": "number (opcional) — Nuevo monto del abono",
  "payment_date": "string (opcional) — Nueva fecha de pago (ISO date)",
  "payment_method": "string (opcional) — Nuevo método: TRANSFERENCIA | EFECTIVO | CHEQUE | TARJETA",
  "reference": "string (opcional) — Nuevo número de referencia",
  "notes": "string (opcional) — Nuevas notas"
}
```

### Ejemplo de Request

```json
{
  "id_payment": "abc123",
  "id_tenant": "tenant_456",
  "id_transaction": "tx_789",
  "amount": 50.00,
  "payment_date": "2026-07-13",
  "payment_method": "TRANSFERENCIA",
  "reference": "NUEVA-REF-12345",
  "notes": "Referencia corregida"
}
```

### Respuesta Esperada (200)

```json
{
  "success": true,
  "message": "Abono actualizado correctamente",
  "payment": {
    "id_payment": "abc123",
    "amount": 50.00,
    "payment_date": "2026-07-13",
    "payment_method": "TRANSFERENCIA",
    "reference": "NUEVA-REF-12345",
    "notes": "Referencia corregida"
  }
}
```

### Respuesta de Error (400/500)

```json
{
  "success": false,
  "message": "Error al actualizar el abono"
}
```

---

## Lógica del Workflow en n8n

### Pasos del workflow:

1. **Webhook Trigger** — Recibe el POST con el body
2. **Validar campos** — Verificar que `id_payment`, `id_tenant`, `id_transaction` existan
3. **Consultar abono actual** — SELECT de la tabla de pagos/abonos donde `id_payment = ?` para obtener el valor actual
4. **Recalcular pagado** — Si el `amount` cambió, recalcular `monto_pagado_caja` en la transacción:
   - `nuevo_monto_pagado = monto_pagado_actual - abono_anterior + nuevo_monto`
   - UPDATE en la tabla de transacciones: `monto_pagado_caja = nuevo_monto_pagado`
5. **Actualizar abono** — UPDATE en la tabla de pagos/abonos:
   ```sql
   UPDATE pagos SET
     amount = COALESCE(:amount, amount),
     payment_date = COALESCE(:payment_date, payment_date),
     payment_method = COALESCE(:payment_method, payment_method),
     reference = COALESCE(:reference, reference),
     notes = COALESCE(:notes, notes),
     fecha_modificacion = NOW()
   WHERE id_payment = :id_payment
     AND id_tenant = :id_tenant
   ```
6. **Verificar estado** — Recalcular si la factura ahora está pagada o no:
   - Si `monto_pagado_caja >= total_factura` → estado = `PAGADO`
   - Si `monto_pagado_caja < total_factura` y vencida → estado = `VENCIDO`
   - Si `monto_pagado_caja < total_factura` y no vencida → estado = `PENDIENTE`
7. **Retornar respuesta** — Devolver el abono actualizado

### Notas importantes:

- Usar `COALESCE` para solo actualizar los campos que se envían (parcial update)
- Si cambia el `amount`, recalcular el `monto_pagado_caja` en la transacción padre
- Verificar que el `id_payment` pertenezca a la `id_transaction` y `id_tenant` proporcionadas
- Mantener un log de auditoría del cambio (opcional pero recomendado)
