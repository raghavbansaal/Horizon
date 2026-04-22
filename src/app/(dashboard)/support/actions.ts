"use server";

import { createClient } from "@/lib/supabase/server";
import nodemailer from "nodemailer";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "itsupporthorizon@gmail.com";
const SUPPORT_INBOX_EMAIL = process.env.SUPPORT_INBOX_EMAIL || "raghavbansal253@gmail.com";

function getMailTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = process.env.SMTP_USER || SUPPORT_EMAIL;
  const pass = process.env.SMTP_PASS;
  if (!pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendSupportMessage(content: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const userEmail = user.email || "unknown@unknown.com";
    const clean = content.trim();
    if (!clean) return { success: false, error: "Message is required." };
    const threadId = `USER-${user.id.slice(0, 8)}`;

    const transporter = getMailTransporter();
    if (!transporter) {
      return {
        success: false,
        error: "Support email is not configured. Set SMTP_USER and SMTP_PASS in .env",
      };
    }
    const createdAt = new Date().toISOString();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || SUPPORT_EMAIL,
      to: SUPPORT_INBOX_EMAIL,
      subject: `Horizon Support [${threadId}]`,
      text:
        `New support message from Horizon user\n` +
        `User ID: ${user.id}\n` +
        `User Email: ${userEmail}\n` +
        `Time: ${createdAt}\n\n` +
        `${clean}`,
      replyTo: userEmail,
    });

    return {
      success: true,
      message: {
        id: `local-${Date.now()}`,
        senderType: "USER",
        content: clean,
        createdAt,
      },
    };
  } catch (error) {
    console.error("Support send failed:", error);
    return {
      success: false,
      error:
        "Email login failed. Gmail rejected SMTP credentials. Use a Google App Password for SMTP/IMAP.",
    };
  }
}
