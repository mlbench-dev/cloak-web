import nodemailer from "nodemailer";
import path from "path";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOTPEmail(email: string, otp: string) {
  const logoPath = path.join(process.cwd(), "public/images/logo/cloakLogo.png"); // use a PNG, not SVG

  const mailOptions = {
    from: `"Cloak" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Your Cloak Verification Code",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Cloak Verification Code</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F5F5F5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F5F5F5;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
                <tr>
                  <td style="padding: 30px 40px 10px; text-align: center;">
                    <img src="cid:cloaklogo" alt="Cloak Logo" width="34" height="39" style="display: inline-block;">
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 40px 40px;">
                    <h1 style="color: #2D2D2D; font-size: 24px; font-weight: 600; margin: 0 0 20px; line-height: 1.2;">
                      Verify Your Email
                    </h1>
                    <p style="color: #8F98A0; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                      Hello,
                    </p>
                    <p style="color: #8F98A0; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                      Your one-time password (OTP) for Cloak is:
                    </p>
                    <div style="background-color: #FAFEFE; border: 1px solid #E8F3F4; border-radius: 18px; padding: 30px 20px; text-align: center; margin: 0 0 24px;">
                      <p style="color: #2D2D2D; font-size: 40px; font-weight: 600; letter-spacing: 12px; margin: 0;">
                        ${otp}
                      </p>
                    </div>
                    <p style="color: #8F98A0; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                      This code will expire in 10 minutes. If you didn't request this, please ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px 30px; border-top: 1px solid #E3E3E3;">
                    <p style="color: #8F98A0; font-size: 12px; text-align: center; margin: 0;">
                      &copy; ${new Date().getFullYear()} Cloak. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: "cloakLogo.png",
        path: logoPath,
        cid: "cloaklogo", // must match the cid: reference in the img src above
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { success: false, error };
  }
}

// Emails render in whatever mail client opens the support inbox — user-
// controlled fields (message, name, username) must be HTML-escaped before
// going into the template, same reasoning as escaping for a browser.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Cloak Pro's "Contact Support" perk — lands in the same inbox SMTP_USER
// sends from, with the reporting user set as replyTo so support can reply
// directly without needing to look anything up first.
export async function sendSupportEmail(input: {
  fromEmail: string;
  fromName?: string | null;
  username?: string | null;
  subject: string;
  message: string;
}) {
  const supportInbox = process.env.SMTP_USER;
  if (!supportInbox) {
    console.error("SMTP_USER is not configured — cannot deliver support request.");
    return { success: false, error: "Support inbox is not configured." };
  }

  const logoPath = path.join(process.cwd(), "public/images/logo/cloakLogo.png");

  const displayName = input.fromName || input.username || input.fromEmail;
  const safeDisplayName = escapeHtml(displayName);
  const safeFromEmail = escapeHtml(input.fromEmail);
  const safeUsername = input.username ? escapeHtml(input.username) : null;
  const safeSubject = escapeHtml(input.subject);
  const safeMessage = escapeHtml(input.message);

  const mailOptions = {
    from: `"Cloak Support Form" <${supportInbox}>`,
    to: supportInbox,
    replyTo: input.fromEmail,
    subject: `[Cloak Pro Support] ${input.subject}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${safeSubject}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F5F5F5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #F5F5F5;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
                <tr>
                  <td style="padding: 30px 40px 10px; text-align: center;">
                    <img src="cid:cloaklogo" alt="Cloak Logo" width="34" height="39" style="display: inline-block;">
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 40px 10px; text-align: center;">
                    <span style="display: inline-block; background-color: #E8FEFF; color: #14C3CF; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 6px 14px; border-radius: 999px;">
                      Cloak Pro Support
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 40px 0;">
                    <h1 style="color: #2D2D2D; font-size: 22px; font-weight: 600; margin: 0 0 16px; line-height: 1.3;">
                      ${safeSubject}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 20px;">
                    <div style="background-color: #FAFEFE; border: 1px solid #E8F3F4; border-radius: 14px; padding: 14px 16px;">
                      <p style="color: #8F98A0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">
                        From
                      </p>
                      <p style="color: #2D2D2D; font-size: 14px; line-height: 1.5; margin: 0;">
                        ${safeDisplayName}${safeUsername ? ` &middot; @${safeUsername}` : ""}<br>
                        <a href="mailto:${safeFromEmail}" style="color: #14C3CF; text-decoration: none;">${safeFromEmail}</a>
                      </p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 40px;">
                    <p style="color: #8F98A0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">
                      Message
                    </p>
                    <div style="background-color: #FAFEFE; border: 1px solid #E8F3F4; border-left: 3px solid #14C3CF; border-radius: 14px; padding: 18px 20px; white-space: pre-wrap; color: #2D2D2D; font-size: 14px; line-height: 1.6;">${safeMessage}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px 30px; border-top: 1px solid #E3E3E3;">
                    <p style="color: #8F98A0; font-size: 12px; text-align: center; margin: 0;">
                      &copy; ${new Date().getFullYear()} Cloak. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: "cloakLogo.png",
        path: logoPath,
        cid: "cloaklogo",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Error sending support email:", error);
    return { success: false, error };
  }
}
