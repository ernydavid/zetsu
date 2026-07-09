# SMTP2GO + Supabase Auth en Zetsu

Esta guía deja documentado el flujo de correos transaccionales de autenticación para Zetsu usando **Supabase Auth + Custom SMTP con SMTP2GO**.

## Qué cubre esta implementación

- `Confirm sign up`
- `Reset password`
- Plantillas HTML versionadas en el repo
- Preview local en `/email-previews`
- Flujo de signup con confirmación previa al onboarding

## Variables de entorno del proyecto

Define al menos estas variables en el runtime de la app:

```env
NEXT_PUBLIC_SITE_URL=https://tu-dominio.com
SITE_URL=https://tu-dominio.com
```

Notas:

- `NEXT_PUBLIC_SITE_URL` se usa para enlaces públicos y branding.
- `SITE_URL` permite separar el runtime server si más adelante hace falta.
- El proyecto sigue aceptando `NEXT_PUBLIC_APP_URL` como fallback por compatibilidad.

## Configuración en SMTP2GO

1. Crea una cuenta en SMTP2GO.
2. Verifica el dominio remitente que usarás, por ejemplo `mail.tudominio.com` o `tudominio.com`.
3. Configura y publica los registros DNS que te pida SMTP2GO.
   - SPF
   - DKIM
   - DMARC recomendado
4. Crea un SMTP user en SMTP2GO.
5. Guarda estos valores:
   - SMTP host
   - SMTP port
   - SMTP username
   - SMTP password

Referencias oficiales:

- Supabase Custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- SMTP2GO setup: https://www.smtp2go.com/setup/
- SMTP2GO SMTP relay: https://developers.smtp2go.com/docs/smtp-relay

## Configuración en Supabase Dashboard

Ve a tu proyecto en Supabase y abre:

`Authentication` → `Email`

### 1. Site URL y redirects

Configura:

- `Site URL`: `https://tu-dominio.com`

Permite los redirects necesarios para este proyecto:

- `https://tu-dominio.com/auth/confirm`
- `http://localhost:3000/auth/confirm`

Si usas previews o entornos extra, agrega sus dominios también.

### 2. Activar confirmación de correo

Dentro de `Authentication` → `Providers` → `Email`, activa la confirmación de correo para signup.

Con esta implementación, el usuario:

1. se registra,
2. ve la pantalla `/auth/check-email`,
3. confirma su correo,
4. entra a `/onboarding`.

### 3. SMTP Settings

En `Authentication` → `Email` → `SMTP Settings`:

- Enable Custom SMTP: `On`
- Sender name: `Zetsu`
- Sender email: `no-reply@tudominio.com`
- Host: `mail.smtp2go.com`
- Port: `2525`
- Username: `tu-smtp-username`
- Password: `tu-smtp-password`

Notas:

- `2525` es el puerto recomendado por SMTP2GO.
- Si tu red bloquea `2525`, usa `587`.
- El remitente debe pertenecer a un dominio verificado en SMTP2GO.

## Templates en Supabase

Ve a:

`Authentication` → `Email Templates`

Pega el HTML generado desde el repo para:

- `Confirm signup`
- `Reset password`

Fuente de verdad en el repo:

- `lib/auth/email-templates.ts`

Preview local:

- `/email-previews`

## Variables de Supabase usadas en las plantillas

Estas plantillas usan variables nativas de Supabase:

- `{{ .ConfirmationURL }}`
- `{{ .SiteURL }}`

## Flujo esperado

### Signup

1. Usuario crea cuenta en `/auth/signup`
2. `supabase.auth.signUp()` envía correo de confirmación
3. La app redirige a `/auth/check-email`
4. El correo lleva a `/auth/confirm?next=/onboarding`
5. `auth/confirm` valida el enlace y redirige a onboarding

### Reset password

1. Usuario solicita reset en `/auth/forgot-password`
2. Supabase envía el correo branded
3. El enlace lleva a `/auth/confirm?next=/auth/reset-password`
4. `auth/confirm` valida el enlace
5. Usuario define nueva contraseña
6. La app redirige a `/auth/login?message=...`

## Validación recomendada

- Crear una cuenta nueva y confirmar que no entra al producto sin verificar correo.
- Confirmar que el enlace del email de signup aterriza en onboarding.
- Solicitar reset y confirmar que el enlace aterriza en `/auth/reset-password`.
- Revisar logs de Supabase Auth si el correo no sale.
- Revisar logs de SMTP2GO si Supabase entrega el mensaje pero no llega al inbox.
