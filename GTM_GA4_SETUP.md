# Configuración GTM + GA4 para Conversiones de Landing

## Objetivo
Medir conversiones de la landing enfocadas en:
- Agendar demo
- Iniciar sesión
- Contacto por correo a ventas

## Estado actual del código
Ya está implementado en frontend:
- Carga de GTM en `index.html` con `VITE_GTM_ID`
- Eventos en `pages/LandingPage.tsx`:
  - `landing_cta_click` (evento en `dataLayer`)
  - `cta_action` (parámetro)
  - `cta_label` (parámetro)

Acciones que se envían:
- `click_demo`
- `click_login`
- `click_sales_email`

## 1) Activar GTM en entorno
En tu archivo de variables de entorno del frontend, define:

```env
VITE_GTM_ID=GTM-XXXXXXX
```

## 2) Configurar GTM (contenedor Web)

### 2.1 Tag base de GA4
1. Crear Tag: **Google Tag** (o GA4 Configuration según versión de GTM).
2. Measurement ID: `G-XXXXXXXXXX`.
3. Trigger: **All Pages**.
4. Guardar.

### 2.2 Variables de Data Layer
Crear estas variables:
- `dlv_cta_action`
  - Tipo: Data Layer Variable
  - Nombre de variable: `cta_action`
- `dlv_cta_label`
  - Tipo: Data Layer Variable
  - Nombre de variable: `cta_label`

### 2.3 Trigger para evento de CTA
Crear Trigger:
- Tipo: Custom Event
- Event name: `landing_cta_click`
- This trigger fires on: All Custom Events

### 2.4 Tag de evento GA4
Crear Tag:
- Tipo: GA4 Event
- Event Name: `landing_cta_click`
- Event Parameters:
  - `cta_action`: `{{dlv_cta_action}}`
  - `cta_label`: `{{dlv_cta_label}}`
- Trigger: `landing_cta_click`

Publicar cambios.

## 3) Configurar conversiones en GA4
En GA4, marca como conversiones los eventos recomendados:

### Opción A (rápida)
Marcar como conversión el evento:
- `landing_cta_click`

Y filtrar en reportes por parámetro:
- `cta_action = click_demo` (principal)
- `cta_action = click_sales_email`
- `cta_action = click_login`

### Opción B (recomendada para reporting)
Crear en GTM 3 tags de evento GA4 por acción:
- Event name: `generate_lead` (cuando `cta_action = click_demo`)
- Event name: `contact` (cuando `cta_action = click_sales_email`)
- Event name: `login` (cuando `cta_action = click_login`)

Luego marcar como conversiones en GA4:
- `generate_lead`
- `contact`
- (opcional) `login`

## 4) Validación
1. Entrar a Preview de GTM.
2. Abrir landing y hacer clic en CTAs:
   - Nav Agendar Demo
   - Hero Agendar Demo
   - Botón de calendario en contacto
   - Correo de ventas
   - Iniciar sesión
3. Verificar en el panel de GTM:
   - Se dispara `landing_cta_click`
   - Llegan `cta_action` y `cta_label`
4. Verificar en GA4 DebugView que entren los eventos.

## 5) Convención de labels actuales
Ejemplos de `cta_label` enviados por la landing:
- `nav_demo`
- `hero_primary_demo`
- `features_cta_demo`
- `faq_cta_demo`
- `contact_calendar_demo`
- `features_cta_sales_email`
- `contact_sales_email`
- `nav_login`
- `hero_secondary_login`

## Recomendación operativa
Usa `click_demo` como KPI principal de intención comercial y `contact_sales_email` como KPI secundario de contacto directo.
