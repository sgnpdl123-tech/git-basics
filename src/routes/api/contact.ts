import { createFileRoute } from "@tanstack/react-router";
import nodemailer from "nodemailer";
import { z } from "zod";
import { portfolioConfig } from "@/content/portfolio.config";

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

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
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

export const Route = createFileRoute("/api/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);

        if (isRateLimited(ip)) {
          return Response.json(
            {
              ok: false,
              error: "Too many requests. Please try again in a few minutes.",
            },
            { status: 429 },
          );
        }

        let payload: unknown;

        try {
          payload = await request.json();
        } catch {
          return Response.json(
            { ok: false, error: "Invalid JSON payload." },
            { status: 400 },
          );
        }

        const parsed = ContactPayloadSchema.safeParse(payload);

        if (!parsed.success) {
          const firstIssue = parsed.error.issues[0];
          return Response.json(
            {
              ok: false,
              error: firstIssue?.message ?? "Invalid contact form input.",
            },
            { status: 400 },
          );
        }

        if (parsed.data.website && parsed.data.website.length > 0) {
          return Response.json({ ok: true }, { status: 200 });
        }

        try {
          const senderName = portfolioConfig.site.name;
          const host = getRequiredEnv("SMTP_HOST");
          const portRaw = getRequiredEnv("SMTP_PORT");
          const user = getRequiredEnv("SMTP_USER");
          let pass = getRequiredEnv("SMTP_PASS");

          // Normalize Gmail app password formatting (strip spaces/quotes)
          pass = pass.replace(/[\s"']/g, "");

          const port = Number(portRaw);

          if (!Number.isFinite(port) || port <= 0) {
            throw new Error("SMTP_PORT must be a valid positive number");
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

          await transporter.sendMail({
            from: `${senderName} Contact <${user}>`,
            to: parsed.data.email,
            replyTo: parsed.data.email,
            subject: `New portfolio message from ${parsed.data.name}`,
            text: [
              `Name: ${parsed.data.name}`,
              `Email: ${parsed.data.email}`,
              "",
              parsed.data.message,
            ].join("\n"),
          });

          await transporter.sendMail({
            from: `${senderName} <${user}>`,
            to: parsed.data.email,
            subject: "Thank you for your message",
            text: [
              `Hello ${parsed.data.name},`,
              "",
              `Thank you for reaching out to ${senderName}.`,
              "I have received your query and will get back to you soon.",
              "",
              "Best regards,",
              senderName,
            ].join("\n"),
            html: `
              <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
                <h2 style="margin: 0 0 12px;">Thank you for your message</h2>
                <p style="margin: 0 0 10px;">Hello ${parsed.data.name},</p>
                <p style="margin: 0 0 10px;">
                  Thank you for reaching out to ${senderName}.
                  I have received your query and will get back to you soon.
                </p>
                <p style="margin: 16px 0 0;">
                  Best regards,<br />
                  ${senderName}
                </p>
              </div>
            `,
          });

          return Response.json({ ok: true }, { status: 200 });
        } catch (error) {
          console.error("Contact API error:", error);
          return Response.json(
            {
              ok: false,
              error:
                "Contact service is not configured right now. Please try again later.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
