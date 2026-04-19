import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";
import { z } from "zod";

const ContactPayloadSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long"),
  email: z.string().trim().email("Please provide a valid email address"),
  message: z.string().trim().min(10, "Message must be at least 10 characters long"),
  website: z.string().optional(),
});

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  __contactRateLimitStore?: Map<string, RateLimitEntry>;
};

const rateLimitStore =
  globalForRateLimit.__contactRateLimitStore ?? new Map<string, RateLimitEntry>();

globalForRateLimit.__contactRateLimitStore = rateLimitStore;

function getClientIp(request: VercelRequest): string {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const cfConnectingIp = request.headers["cf-connecting-ip"];
  const xRealIp = request.headers["x-real-ip"];

  if (typeof cfConnectingIp === "string") {
    return cfConnectingIp;
  }

  if (typeof xRealIp === "string") {
    return xRealIp;
  }

  return "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const existing = rateLimitStore.get(ip);

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  existing.count += 1;
  rateLimitStore.set(ip, existing);

  return existing.count > RATE_LIMIT_MAX_REQUESTS;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Only allow POST
  if (request.method !== "POST") {
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const ip = getClientIp(request);

  if (isRateLimited(ip)) {
    return response.status(429).json({
      ok: false,
      error: "Too many requests. Please try again in a few minutes.",
    });
  }

  let payload: unknown;

  try {
    payload = request.body;
  } catch {
    return response.status(400).json({
      ok: false,
      error: "Invalid JSON payload.",
    });
  }

  const parsed = ContactPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return response.status(400).json({
      ok: false,
      error: firstIssue?.message ?? "Invalid contact form input.",
    });
  }

  // Honeypot: if website field is filled, pretend success
  if (parsed.data.website && parsed.data.website.length > 0) {
    return response.status(200).json({ ok: true });
  }

  try {
    const siteName = "Portfolio";
    const host = getRequiredEnv("SMTP_HOST");
    const portRaw = getRequiredEnv("SMTP_PORT");
    const user = getRequiredEnv("SMTP_USER");
    let pass = getRequiredEnv("SMTP_PASS");

    // Normalize Gmail app password formatting (strip spaces/quotes)
    pass = pass.replace(/[\s"']/g, "");

    const port = Number(portRaw);

    if (!Number.isFinite(port) || port <= 0) {
      return response.status(500).json({
        ok: false,
        error: "SMTP_PORT must be a valid positive number.",
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    // Send confirmation email to the submitter
    await transporter.sendMail({
      from: `${siteName} <${user}>`,
      to: parsed.data.email,
      subject: "Thank you for your message",
      text: [
        `Hello ${parsed.data.name},`,
        "",
        `Thank you for reaching out to ${siteName}.`,
        "I have received your query and will get back to you soon.",
        "",
        "Best regards,",
        siteName,
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <h2 style="margin: 0 0 12px;">Thank you for your message</h2>
          <p style="margin: 0 0 10px;">Hello ${parsed.data.name},</p>
          <p style="margin: 0 0 10px;">
            Thank you for reaching out to ${siteName}.
            I have received your query and will get back to you soon.
          </p>
          <p style="margin: 16px 0 0;">
            Best regards,<br />
            ${siteName}
          </p>
        </div>
      `,
    });

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("Contact API error:", error);
    return response.status(500).json({
      ok: false,
      error: "Contact service is not configured right now. Please try again later.",
    });
  }
}
