# CI/CD y despliegue a producción

Estado verificado el **6 de octubre de 2026**.

```
push a main ──▶ Build & Push Docker Image ──▶ ghcr.io/.../crm_final:latest
                                                    │
                          Deploy to EasyPanel ◀─────┘ (workflow_run)
                                    │
                                    ▼
                   POST {EASYPANEL_URL}/api/rpc/service.deploy
                                    │
                                    ▼
              crm.computeksa.com sirve el bundle nuevo
```

---

## 1. Repositorio e identidad

| Dato | Valor |
| --- | --- |
| Repo desplegado | `https://github.com/computeksa-services/crm_final.git` |
| Rama | `main` |
| Build Method en EasyPanel | **Imagen de contenedor** (no Nixpacks) |
| Puerto | **80** (antes Nixpacks + `vite preview` en 3000) |
| Producción | `https://crm.computeksa.com` |
| Gateway | `https://gateway.computeksa.com` |

> `crm_final_limpio` (carpeta hermana) es una copia local legada **sin remote de GitHub**: no se despliega.
> `.nixpacks.yaml` y `.easypanel.json` quedaron obsoletos por el cambio a imagen; no los toques.

### Push desde esta máquina

La llave de trabajo autentica como `computeksa-services`:

```bash
export GIT_SSH_COMMAND='ssh -i C:/Users/Computeksa/.ssh/id_rsa_trabajo -o IdentitiesOnly=yes'
git push origin main
```

> En Windows PowerShell usar rutas con `/`: las `\` las come el shell.

---

## 2. `build.yml` — Build & Push Docker Image

Disparado en `push` y `pull_request` a `main`. ~50 s.

1. `actions/checkout@v4`
2. Login a ghcr con `secrets.GITHUB_TOKEN`
3. `docker/metadata-action` → tags `latest` y `sha-<corto>`
4. `docker/build-push-action@v5` → build y push

**No necesita secrets**: los `build-args` (`VITE_WEBHOOK_URL`, `VITE_GOOGLE_CLIENT_ID`) ya son innecesarios porque la config se resuelve en runtime (ver §4). El `Dockerfile` los declara con `ARG ...=""` para que el build nunca falle.

### Ver la imagen publicada

```bash
# tags (ghcr exige token de pull aunque el paquete sea público)
$tok = (Invoke-RestMethod "https://ghcr.io/token?scope=repository:computeksa-services/crm_final:pull&service=ghcr.io").token
(Invoke-RestMethod "https://ghcr.io/v2/computeksa-services/crm_final/tags/list" -Headers @{Authorization="Bearer $tok"}).tags
```

### Ver un run

```bash
gh run list --workflow=build.yml --limit 5
gh run watch <run-id> --exit-status
```

---

## 3. `deploy.yml` — Deploy to EasyPanel

Reescrito en `a7a35d4`. Tres disparadores:

| Disparador | Cuándo despliega |
| --- | --- |
| `workflow_run` de *Build & Push Docker Image* | Automático, solo si el build terminó `success` **y** fue un `push` a `main` |
| `workflow_dispatch` | Manual: Actions → *Deploy to EasyPanel* → **Run workflow** |
| `schedule` `0 4 * * *` (04:00 UTC = 23:00 Ecuador) | Seguridad: solo si hay cambios desde el tag `deployed` |

Pasos:

1. **Verificar secrets** — falla con mensaje claro si faltan (antes salía `curl` exit 3 con URL vacía).
2. **Check if deploy is needed** — para `workflow_run`/`dispatch` siempre `true`; para el cron compara `HEAD` con el tag `deployed`.
3. **Trigger EasyPanel Redeploy** — `POST {EASYPANEL_URL}/api/rpc/service.deploy` con `Authorization: Bearer {EASYPANEL_REDEPLOY_CICD}`.
4. **Mark as deployed** — `git tag -f deployed && git push --force`.

### Secrets requeridos (no los puedo crear yo: 403)

En **Settings → Secrets and variables → Actions**:

| Secret | Contenido |
| --- | --- |
| `EASYPANEL_URL` | URL base del panel, sin barra final (ej. `https://panel.tudominio.com`) |
| `EASYPANEL_REDEPLOY_CICD` | Token de EasyPanel (Settings → API Keys) |

### ⚠️ Estado pendiente

A fecha de verificación el workflow aparece **`disabled_manually`** y sus últimos runs (todos `schedule`) fallaron por los secrets vacíos. Para activarlo:

1. **Actions → Deploy to EasyPanel → Enable workflow**
2. Crear los dos secrets de arriba
3. Probar con **Run workflow** y comprobar que sale `HTTP Status: 200`

Mientras tanto, el despliegue se hace **manualmente desde EasyPanel → Redeploy** (eso es lo que puso la versión actual en producción).

---

## 4. Configuración en runtime (por qué la imagen es reutilizable)

El build de Vite queda horneado, pero los valores se resuelven **al arrancar el contenedor**:

| Archivo | Rol |
| --- | --- |
| `docker-entrypoint.sh` | Escribe `/usr/share/nginx/html/config.js` con las env vars del contenedor y arranca nginx |
| `public/config.js` | Stub para dev local (`window.__APP_CONFIG__ = {}`) |
| `index.html:56` | `<script src="/config.js"></script>` — se carga **antes** del bundle |
| `vite.config.ts` | `define` reemplaza `import.meta.env.VITE_*` por `window.__APP_CONFIG__.<CLAVE>` |
| `services/runtimeConfig.ts` / `services/oauthConfig.ts` | Lectura de `window.__APP_CONFIG__` |
| `nginx.conf` | Bloque `location = /config.js { add_header Cache-Control "no-store"; }` **dentro de `server {}`** |

> ⚠️ Ese bloque debe ir dentro de `server {}`: si queda fuera, nginx arranca en loop con
> `"location" directive is not allowed here in /etc/nginx/conf.d/default.conf:15` (bug corregido en `77f8382`).
> El `>> default.conf` que añadía el bloque desde el Dockerfile fue eliminado.

> ⚠️ `define` de esbuild solo admite **nombres de entidad** (`window.__APP_CONFIG__.CLAVE`),
> no expresiones. Por eso el patrón es `runtimeConfigExpr('CLAVE')`.

### Variables de entorno — van en **EasyPanel → Environment**, no en GitHub Secrets

| Variable | Uso |
| --- | --- |
| `VITE_WEBHOOK_URL` | URL del gateway/n8n. Sin ella el entrypoint avisa y `vite.config.ts` falla en dev |
| `VITE_GOOGLE_CLIENT_ID` | OAuth Google |
| `VITE_MICROSOFT_CLIENT_ID` | OAuth Microsoft |
| `VITE_REDIRECT_URI` | Redirect OAuth |
| `VITE_GOOGLE_MAPS_API_KEY` | Mapas |
| `VITE_MICROSOFT_TENANT_ID` | Tenant Microsoft |
| `VITE_MICROSOFT_CRM_CLIENT_ID` | CRM Microsoft |

`.env` está en `.gitignore` (no trackeado) y solo aporta valores en desarrollo local.

---

## 5. Verificación post-deploy

```bash
# 1. Bundle servido (cambia el hash con cada build)
(Invoke-WebRequest "https://crm.computeksa.com/" -UseBasicParsing).Content `
  | Select-String 'assets/index-[A-Za-z0-9_-]+\.js' -AllMatches | % Matches.Value

# 2. config.js generado en runtime con las 7 claves
(Invoke-WebRequest "https://crm.computeksa.com/config.js" -UseBasicParsing).Content

# 3. Que el bundle coincida con el último build de Actions
gh run list --workflow=build.yml --limit 1
```

Compara el hash con el de `dist/index.html` local (`npm run build`) si quieres confirmar exactamente qué commit está en producción.

**Checklist**

- [ ] `index-<hash>.js` cambió respecto al deploy anterior
- [ ] `config.js` devuelve `window.__APP_CONFIG__` con las 7 claves
- [ ] Login con Google/Microsoft funciona (las OAuth leen la config runtime)
- [ ] `/api/financials` responde desde el bundle nuevo
- [ ] `gh run list` → build `success`, y deploy `success` si está habilitado

---

## 6. Comandos útiles

```bash
# Builds recientes
gh run list --limit 5

# Ver logs de un run
gh run view <id> --log
gh run view <id> --log-failed

# Habilitar el workflow de deploy (requiere admin)
gh workflow enable "Deploy to EasyPanel"

# Disparar deploy manual
gh workflow run "Deploy to EasyPanel"

# Estado de los workflows
gh api repos/computeksa-services/crm_final/actions/workflows --jq '.workflows[] | [.name,.state] | @tsv'

# tag que marca el último deploy cron
git fetch --tags && git tag -l
```

---

## 7. Troubleshooting

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `curl: (3) URL using bad/illegal format` en el deploy | `EASYPANEL_URL` vacío o mal formado | Crear el secret; debe empezar con `https://` y sin `/` final |
| `Faltan secrets. Ve a Settings...` | Faltan los dos secrets | Crearlos en GitHub → Settings → Secrets and variables → Actions |
| Workflow no aparece en la lista de runs | `disabled_manually` | Actions → *Deploy to EasyPanel* → Enable workflow |
| `"location" directive is not allowed here` | Bloque de `config.js` fuera de `server{}` en `nginx.conf` | Ver §4, ya corregido en `77f8382` |
| `aviso: VITE_WEBHOOK_URL no esta definida...` en logs del contenedor | Falta la env var en EasyPanel | Añadirla en Environment y redeploy |
| App carga pero API responde 401/404 | `VITE_WEBHOOK_URL` apunta al origen equivocado | Revisar Environment → `VITE_WEBHOOK_URL` |
| Producción con bundle viejo tras un push | Deploy no corrió | Run workflow manual o EasyPanel → Redeploy |
| `npm ci` falla en el build | `package-lock.json` desincronizado | Regenerarlo localmente y commitear |
| Contenedor reinicia en loop | Entrypoint con CRLF | `.gitattributes` fuerza `*.sh text eol=lf`; verificar con `file docker-entrypoint.sh` |

---

## 8. Historial reciente de cambios

| Commit | Qué hizo |
| --- | --- |
| `31257dd` | `FinancialForm.tsx`: Fecha de pago como `<input type="date">`, helper `pickValue` |
| `612b7de` | Config en runtime: `Dockerfile` multi-stage, `docker-entrypoint.sh`, `config.js`, `runtimeConfig.ts`, `define` en Vite, `.gitattributes` |
| `77f8382` | Fix nginx: bloque `config.js` movido dentro de `server {}` (reinicio en loop) |
| `d291ee3` | Fix fecha de pago: `toISODate` parsea fechas en español de `format_date_es` → [doc](fix-fecha-pago.md) |
| `a7a35d4` | `deploy.yml`: deploy automático tras build exitoso + validación de secrets |
