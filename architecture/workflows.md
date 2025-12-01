
# Computeksa 360 - Backend Automation Architecture (n8n)

## 1. API Endpoints (Interface Layer)

Endpoints for n8n Webhook nodes.

### Tenants (SaaS Management)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/tenants` | List all subscribed tenants. |
| `POST` | `/api/tenants` | Create a new tenant. |
| `POST` | `/api/tenants/update` | Update tenant details. |
| `POST` | `/api/tenants/delete` | Delete a tenant (and all its data). |

### Users (Staff)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/users` | List users (optionally filter by tenant_id). |
| `POST` | `/api/users` | Create a new user attached to a tenant. |
| `POST` | `/api/users/update` | Update user (includes logic for blank passwords). |
| `POST` | `/api/users/delete` | Delete a user. |

### Client Companies (CRM)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/clients/companies` | List client companies for the logged-in tenant. |
| `POST` | `/api/clients/companies` | Create a new B2B client. |

### Quotes
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/cotizaciones` | Create a new quote header. |
| `POST` | `/api/cotizaciones/{id}/items` | Add items to quote. |
| `POST` | `/api/cotizaciones/{id}/generar` | Trigger PDF generation. |
| `POST` | `/api/cotizaciones/{id}/enviar` | Send email and create/link Deal. |

### C. Custom Statuses (Tenant Settings)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/statuses/deals` | Get all deal statuses for a tenant. |
| `POST` | `/api/statuses/deals` | Create a new deal status. |
| `POST` | `/api/statuses/deals/update` | Update an existing deal status. |
| `POST` | `/api/statuses/deals/delete` | Delete a deal status. |
| `GET` | `/api/statuses/quotes` | Get all quote statuses for a tenant. |
| `POST` | `/api/statuses/quotes` | Create a new quote status. |
| `POST` | `/api/statuses/quotes/update`| Update an existing quote status. |
| `POST` | `/api/statuses/quotes/delete`| Delete a quote status. |

### D. Deals (Tratos)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/deals` | Get all deals for a tenant. |
| `POST` | `/api/deals` | Create a new deal. |
| `POST` | `/api/deals/update` | Update an existing deal. |
| `POST` | `/api/deals/delete` | Delete a deal. |

---

## 2. n8n Database Queries (Configuration Guide)

### A. Tenants (Table: `tenants`)

**1. Create Tenant**
*Params:* `$1:ruc`, `$2:name`, `$3:country`, `$4:city`, `$5:addr`, `$6:web`, `$7:logo`
```sql
INSERT INTO tenants (
  id_tenant, ruc, name_tenant, country, city, address, website, logo_url
) VALUES (
  't_' || REPLACE(uuid_generate_v4()::text, '-', ''), $1, $2, $3, $4, $5, $6, $7
) RETURNING *;
```

**2. Update Tenant**
*Params:* `$1:ruc`, `$2:name`, `$3:country`, `$4:city`, `$5:addr`, `$6:web`, `$7:logo`, `$8:id_tenant`
```sql
UPDATE tenants SET 
    ruc = $1, name_tenant = $2, country = $3, city = $4, address = $5, website = $6, logo_url = $7
WHERE id_tenant = $8
RETURNING *;
```

**3. Delete Tenant**
*Params:* `$1:id_tenant`
```sql
DELETE FROM tenants WHERE id_tenant = $1;
```

---

### B. Users (Table: `users`)

**1. Create User**
```sql
INSERT INTO users (
  id_user, id_tenant, name_user, email_user, password_hash, phone_user, rol_user, job_title, avatar_url
) VALUES (
  'u_' || REPLACE(uuid_generate_v4()::text, '-', ''), $1, $2, $3, $4, $5, $6, $7, 
  'https://ui-avatars.com/api/?name=' || $2 || '&background=random'
) RETURNING *;
```

**2. Update User (Password Safe)**
*Note: Ensure n8n passes `__NO_CHANGE__` if password field is empty.*
```sql
UPDATE users SET 
    name_user = $1, email_user = $2, phone_user = $3, rol_user = $4, job_title = $5, id_tenant = $6,
    password_hash = CASE WHEN $7 = '__NO_CHANGE__' OR $7 IS NULL THEN password_hash ELSE $7 END
WHERE id_user = $8
RETURNING *;
```

**3. Delete User**
```sql
DELETE FROM users WHERE id_user = $1;
```

---

### C. Custom Statuses

**1. Get Deal Statuses**
*Params:* `$1:id_tenant` (from query parameter `{{ $request.query.id_tenant }}`)
```sql
SELECT * FROM deal_statuses WHERE id_tenant = $1 ORDER BY status_order;
```

**2. Create Deal Status**
*Params:* `$1:id_tenant`, `$2:name`, `$3:color`, `$4:icon`
```sql
INSERT INTO deal_statuses (id_status, id_tenant, name, color, icon)
VALUES ('dstat_' || REPLACE(uuid_generate_v4()::text, '-', ''), $1, UPPER($2), $3, $4)
RETURNING *;
```

**3. Update Deal Status**
*Params:* `$1:name`, `$2:color`, `$3:icon`, `$4:id_status`, `$5:id_tenant` (security)
```sql
UPDATE deal_statuses SET name = UPPER($1), color = $2, icon = $3 WHERE id_status = $4 AND id_tenant = $5 RETURNING *;
```

**4. Delete Deal Status**
*Params:* `$1:id_status`, `$2:id_tenant` (security)
```sql
DELETE FROM deal_statuses WHERE id_status = $1 AND id_tenant = $2;
```

**5. Get Quote Statuses**
*Params:* `$1:id_tenant` (from query parameter `{{ $request.query.id_tenant }}`)
```sql
SELECT * FROM quote_statuses WHERE id_tenant = $1 ORDER BY status_order;
```

**6. Create Quote Status**
*Params:* `$1:id_tenant`, `$2:name`, `$3:color`, `$4:icon`
```sql
INSERT INTO quote_statuses (id_status, id_tenant, name, color, icon)
VALUES ('qstat_' || REPLACE(uuid_generate_v4()::text, '-', ''), $1, UPPER($2), $3, $4)
RETURNING *;
```

**7. Update Quote Status**
*Params:* `$1:name`, `$2:color`, `$3:icon`, `$4:id_status`, `$5:id_tenant` (security)
```sql
UPDATE quote_statuses SET name = UPPER($1), color = $2, icon = $3 WHERE id_status = $4 AND id_tenant = $5 RETURNING *;
```

**8. Delete Quote Status**
*Params:* `$1:id_status`, `$2:id_tenant` (security)
```sql
DELETE FROM quote_statuses WHERE id_status = $1 AND id_tenant = $2;
```

---
### D. Deals (Tratos)

**1. Get Deals**
*Params:* `$1:id_tenant` (from query parameter `{{ $request.query.id_tenant }}`)
```sql
SELECT
  d.id_trato, d.id_tenant, d.id_user_owner, d.id_client_company, d.id_contact, d.nombre_trato, d.valor_trato, d.id_deal_status, d.interes, d.created_at,
  cc.name_company AS client_company_name,
  u.name_user AS owner_name,
  ds.name AS estado,
  ds.color AS estado_color,
  ds.icon AS estado_icon
FROM deals d
LEFT JOIN client_companies cc ON d.id_client_company = cc.id_client_company
LEFT JOIN users u ON d.id_user_owner = u.id_user
LEFT JOIN deal_statuses ds ON d.id_deal_status = ds.id_status
WHERE d.id_tenant = $1
ORDER BY d.created_at DESC;
```

**2. Create Deal**
*Params:* `$1:id_tenant`, `$2:id_user_owner`, `$3:id_client_company`, `$4:id_contact`, `$5:nombre_trato`, `$6:valor_trato`, `$7:id_deal_status`, `$8:interes`
```sql
INSERT INTO deals (id_trato, id_tenant, id_user_owner, id_client_company, id_contact, nombre_trato, valor_trato, id_deal_status, interes)
VALUES ('deal_' || REPLACE(uuid_generate_v4()::text, '-', ''), $1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;
```

**3. Update Deal**
*Params:* `$1:nombre_trato`, `$2:valor_trato`, `$3:id_deal_status`, `$4:interes`, `$5:id_client_company`, `$6:id_contact`, `$7:id_trato`, `$8:id_tenant` (security)
```sql
UPDATE deals SET
  nombre_trato = $1,
  valor_trato = $2,
  id_deal_status = $3,
  interes = $4,
  id_client_company = $5,
  id_contact = $6
WHERE id_trato = $7 AND id_tenant = $8
RETURNING *;
```

**4. Delete Deal**
*Params:* `$1:id_trato`, `$2:id_tenant` (security)
```sql
DELETE FROM deals WHERE id_trato = $1 AND id_tenant = $2;
```
---

### E. Quotes (Cotizaciones) - *Plantilla*

**1. Get Quotes**
```sql
-- SQL Query to get all quotes for a tenant, joining with client, user, and status tables.
```

**2. Create Quote**
```sql
-- SQL Query to insert a new quote.
```
