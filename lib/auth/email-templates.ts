import { getConfiguredSiteUrl, getPublicAssetUrl } from "@/lib/site-url";

type AuthEmailTemplateId = "confirm-signup" | "reset-password";

type AuthEmailTemplate = {
  id: AuthEmailTemplateId;
  label: string;
  subject: string;
  html: string;
};

type TemplateOptions = {
  actionLabel: string;
  actionUrl: string;
  intro: string;
  outro: string;
  previewText: string;
  title: string;
};

const emailContainerStyle = "margin:0;padding:0;background-color:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#111111;";
const cardStyle = "width:100%;max-width:640px;margin:0 auto;background-color:#ffffff;border:1px solid #d6d3d1;border-radius:24px;overflow:hidden;";
const bodyCellStyle = "padding:32px 28px;";
const paragraphStyle = "margin:0 0 16px;font-size:16px;line-height:1.7;color:#44403c;";
const smallStyle = "margin:0;font-size:12px;line-height:1.6;color:#78716c;";
const ctaStyle = "display:inline-block;padding:14px 22px;background-color:#111111;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-radius:14px;";

function buildEmailShell(options: TemplateOptions) {
  const siteUrl = getConfiguredSiteUrl() ?? "http://localhost:3000";
  const logoUrl = getPublicAssetUrl(siteUrl, "/logo-dark-png.png");

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${options.title}</title>
  </head>
  <body style="${emailContainerStyle}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${options.previewText}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background-color:#f5f5f4;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="${cardStyle}">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #e7e5e4;background-color:#fafaf9;">
                <img src="${logoUrl}" alt="Zetsu" width="180" style="display:block;width:180px;height:auto;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="${bodyCellStyle}">
                <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#78716c;">
                  seguridad de cuenta
                </p>
                <h1 style="margin:0 0 18px;font-size:28px;line-height:1.15;color:#111111;">
                  ${options.title}
                </h1>
                <p style="${paragraphStyle}">
                  ${options.intro}
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 24px;">
                  <tr>
                    <td>
                      <a href="${options.actionUrl}" style="${ctaStyle}">
                        ${options.actionLabel}
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="${paragraphStyle}">
                  ${options.outro}
                </p>
                <p style="${smallStyle}">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:
                </p>
                <p style="margin:8px 0 0;font-size:12px;line-height:1.7;word-break:break-all;color:#0f172a;">
                  <a href="${options.actionUrl}" style="color:#0f172a;text-decoration:underline;">
                    ${options.actionUrl}
                  </a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;border-top:1px solid #e7e5e4;background-color:#fafaf9;">
                <p style="${smallStyle}">
                  Enviado por Zetsu. Si no esperabas este correo, puedes ignorarlo con tranquilidad.
                </p>
                <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#78716c;">
                  <a href="{{ .SiteURL }}" style="color:#44403c;text-decoration:underline;">Ir a Zetsu</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function getConfirmSignupTemplate() {
  return buildEmailShell({
    actionLabel: "confirmar correo",
    actionUrl: "{{ .ConfirmationURL }}",
    intro:
      "Tu cuenta ya está casi lista. Confirma tu correo para activar el acceso y continuar con tu onboarding financiero en Zetsu.",
    outro:
      "Este enlace te llevará de vuelta a la aplicación para verificar tu cuenta de forma segura.",
    previewText: "Confirma tu correo para activar tu cuenta de Zetsu.",
    title: "Confirma tu cuenta",
  });
}

export function getResetPasswordTemplate() {
  return buildEmailShell({
    actionLabel: "restablecer contraseña",
    actionUrl: "{{ .ConfirmationURL }}",
    intro:
      "Recibimos una solicitud para restablecer la contraseña de tu cuenta de Zetsu. Usa el siguiente enlace para crear una nueva clave.",
    outro:
      "Si no hiciste esta solicitud, puedes ignorar este correo. Tu contraseña actual seguirá siendo válida.",
    previewText: "Restablece la contraseña de tu cuenta de Zetsu.",
    title: "Restablece tu contraseña",
  });
}

export function getAuthEmailTemplates(): AuthEmailTemplate[] {
  return [
    {
      id: "confirm-signup",
      label: "Confirm sign up",
      subject: "Confirma tu cuenta de Zetsu",
      html: getConfirmSignupTemplate(),
    },
    {
      id: "reset-password",
      label: "Reset password",
      subject: "Restablece tu contraseña de Zetsu",
      html: getResetPasswordTemplate(),
    },
  ];
}
