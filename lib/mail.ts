import nodemailer from "nodemailer";
import fs from "fs";
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
