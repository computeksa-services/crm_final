# Índice de documentación

Documentación técnica del CRM Computeksa (frontend + n8n).

## CI/CD y despliegue

| Doc | Contenido |
| --- | --- |
| [CI/CD y deploy](cicd-y-deploy.md) | Cómo se construye la imagen, cómo llega a producción, secrets, env vars, verificación y troubleshooting. |

## Correcciones de código

| Doc | Contenido |
| --- | --- |
| [Fix: fecha de pago](fix-fecha-pago.md) | Por qué el campo "Fecha de pago" quedaba vacío en edición y qué se cambió. |

## Backend (n8n)

| Doc | Contenido |
| --- | --- |
| [Endpoint: actualizar abono](endpoint-abono-update.md) | Contrato de `POST /api/financial/abono/update`. |
| [Guía n8n: actualizar abono](n8n-guia-abono-update.md) | Implementación del workflow de actualización de abonos. |
| [`../architecture/workflows.md`](../architecture/workflows.md) | Mapa general de endpoints y workflows de n8n. |
