# Fix: campo "Fecha de pago" vacío en edición de cartera

**Commit:** `d291ee3` — `fix: parsea fechas en espanol de format_date_es en el campo de fecha de pago`
**Archivo:** `pages/financials/FinancialForm.tsx`
**Fecha:** 6 de octubre de 2026

---

## Síntoma

Al editar un registro de cartera con estado **PAGADO**, el campo **Fecha de pago** aparecía vacío (placeholder `dd/mm/aaaa`), aunque el registro sí estaba pagado y tenía un abono con fecha.

---

## Causa raíz

La respuesta real de `GET /api/financial/detail` para ese registro traía `payment_date` en **NULL**:

```json
{
  "estado_registro": "PAGADO",
  "fecha_pago": null,
  "payment_date": null,
  "v_texto_fecha_pago_human": null,
  "historial_abonos": [
    { "payment_date": "lun, 24 ago 2026", "payment_method": "TRANSFERENCIA", ... }
  ]
}
```

Eso pasa en registros marcados como pagados **antes** de que existiera el campo `financial_transactions.payment_date`, o pagados vía abono sin que se propagara la fecha. La fecha real solo vive en `historial_abonos`.

El frontend ya tenía un fallback a ese abono (`FinancialForm.tsx:760`):

```ts
payment_date: toISODate(
  tx.v_input_fecha_pago || tx.payment_date || tx.fecha_pago?.split('T')[0] ||
  (historial_abonos.length > 0 ? historial_abonos[historial_abonos.length - 1].payment_date : '')
)
```

…pero `toISODate` **no entendía el formato localizado** que devuelve `public.format_date_es()`:

| Formato | Ejemplo | ¿Lo entendía? |
| --- | --- | --- |
| ISO | `2026-08-24` | ✅ |
| ISO con hora | `2026-08-24T00:00:00.000Z` | ✅ |
| Numérico | `24/08/2026` | ✅ |
| **`format_date_es`** | **`lun, 24 ago 2026`** | ❌ → `''` |
| **`format_date_es` largo** | **`24 de agosto de 2026`** | ❌ → `''` |

`new Date("lun, 24 ago 2026")` es `Invalid Date`, así que el helper devolvía `''` y el `<input type="date">` quedaba vacío.

---

## Solución

Se añadió a `toISODate` un parser para el formato en español, con un mapa de meses:

```ts
const ES_MONTHS: Record<string, string> = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
  jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
};
```

La regex acepta ambos patrones de `format_date_es`, con o sin prefijo de día de la semana (`lun, `):

```
^(?:[a-záéíóúñ]{3},\s*)?(\d{1,2})\s+de\s+([a-záéíóúñ]+)(?:\s+de)?\s+(\d{4})$   → "24 de agosto de 2026"
^(?:[a-záéíóúñ]{3},\s*)?(\d{1,2})\s+([a-záéíóúñ]{3,})\s+(\d{4})$              → "lun, 24 ago 2026"
```

Se usa `.slice(0, 3)` sobre el mes para que sirva tanto `ago` como `agosto`.

### Verificación (node, casos reales)

| Entrada | Salida |
| --- | --- |
| `lun, 24 ago 2026` | `2026-08-24` |
| `24 de agosto de 2026` | `2026-08-24` |
| `mié, 3 sep 2026` | `2026-09-03` |
| `12 de julio de 2026` | `2026-07-12` |
| `2026-08-24T00:00:00.000Z` | `2026-08-24` |
| `24/08/2026` | `2026-08-24` |
| `Pago atraso de 5 dias` | `''` (sin falsos positivos) |
| `PILA ALCALINA` | `''` |
| `005-901-000010411` | `''` |
| `null` / `''` | `''` |

`tsc --noEmit` sin errores nuevos (126 preexistentes en otros módulos) y `npm run build` OK.

---

## Flujo completo de la fecha de pago

```
EDICIÓN
  FinancialForm.tsx:1180  value={transaction.payment_date}
  FinancialForm.tsx:997   payload.payment_date = status === 'PAGADO' ? valor : null
        │
        ▼
  POST /api/financials/update        (workflow n8n "UPDATE CARTERA", activo)
  Preparar Datos → cleanDate(input.payment_date)
  Actualizar BD  → d_pay = $1::jsonb->>'payment_date'
                   payment_date = CASE WHEN d.d_pay IS NOT NULL
                                       THEN TO_DATE(d.d_pay,'YYYY-MM-DD')
                                       ELSE financial_transactions.payment_date END
        │
        ▼
LECTURA
  GET /api/financial/detail          (workflow n8n "GET DETAIL CARTERA", activo)
    TO_CHAR(t.payment_date,'YYYY-MM-DD') AS payment_date      ← ISO
    public.format_date_es(t.payment_date) AS fecha_pago       ← localizado
    jsonb_agg(...) ORDER BY p.created_at DESC AS historial_abonos
        │
        ▼
  FinancialForm.tsx:760  toISODate(...)  ← fix aquí
  FinancialForm.tsx:1180 <input type="date">
```

### Notas

- `historial_abonos` llega ordenado `created_at DESC`: el **último elemento del array es el abono más antiguo**. Con varios abonos, el fallback tomaría la fecha/método/referencia del primero registrado, no del último. Hoy no afecta (registros con un solo abono), pero si se usa multi-abono conviene invertir el índice.
- `FinancialDetail.tsx:334` tiene el mismo fallback pero renderiza texto humano, no `<input type=date>`, por eso allí **sí** se veía la fecha.
- Al editar y guardar, el `payment_date` sí se persiste: los registros NULL "se autocuran" la primera vez que se guarda.
- El detalle de `retention_date` (`FinancialForm.tsx:761`) también cae sobre `fecha_retencion` localizado y se beneficia del mismo fix.
