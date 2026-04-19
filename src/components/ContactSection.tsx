import { motion } from "framer-motion";
import { FormEvent, useState } from "react";

import type { BlockConfig } from "@/content/portfolio.schema";

type ContactBlock = Extract<BlockConfig, { type: "contact" }>;

type ContactSectionProps = {
  block: ContactBlock;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function ContactSection({ block }: ContactSectionProps) {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitState("submitting");
    setFeedbackMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      message: String(formData.get("message") ?? "").trim(),
      website: String(formData.get("website") ?? "").trim(),
    };

    try {
      // Determine the contact endpoint
      const customEndpoint = import.meta.env.VITE_CONTACT_ENDPOINT;
      const endpoint = customEndpoint || "/api/contact";

      // Check if we're on GitHub Pages without a custom endpoint
      if (!customEndpoint && typeof window !== "undefined" && window.location.hostname.includes("github.io")) {
        setSubmitState("error");
        setFeedbackMessage(
          "Contact form is not available on GitHub Pages. Please configure VITE_CONTACT_ENDPOINT to use a backend service."
        );
        return;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let result: { ok: boolean; error?: string };
      try {
        result = (await response.json()) as { ok: boolean; error?: string };
      } catch {
        // Handle non-JSON responses
        result = { ok: response.ok, error: response.statusText || "Unknown error" };
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || block.errorMessage);
      }

      setSubmitState("success");
      setFeedbackMessage(block.successMessage);
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : block.errorMessage;
      setSubmitState("error");
      setFeedbackMessage(message);
    }
  };

  return (
    <section id="contact" className="section-padding relative overflow-hidden">
      <div className="absolute top-10 right-10 w-72 h-72 rounded-full bg-coral/8 blur-3xl animate-pulse-glow" />
      <div
        className="absolute bottom-10 left-10 w-60 h-60 rounded-full bg-accent/8 blur-3xl animate-pulse-glow"
        style={{ animationDelay: "2s" }}
      />

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight font-display">
            {block.title} <span className="text-gradient">{block.titleHighlight}</span>
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">{block.subtitle}</p>

          <div className="mt-8 space-y-5">
            {block.contactItems.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
                whileHover={{ x: 6 }}
                className="flex items-center gap-4 cursor-default"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="w-12 h-12 rounded-xl glass-card flex items-center justify-center text-xl"
                >
                  {item.icon}
                </motion.div>
                <div>
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                  {item.href ? (
                    <a
                      href={item.href}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                      className="font-medium text-foreground hover:text-coral transition-colors"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <div className="font-medium text-foreground">{item.value}</div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-8"
        >
          <div className="animate-float">
            <img
              src={block.image.src}
              alt={block.image.alt}
              loading="lazy"
              width={block.image.width ?? 800}
              height={block.image.height ?? 800}
              className="w-full max-w-xs"
            />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            whileHover={{ scale: 1.01 }}
            className="glass-card rounded-2xl p-6 w-full hover:glow-coral-sm transition-shadow duration-500"
          >
            <h3 className="font-display font-bold text-foreground mb-4">{block.cardTitle}</h3>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <input
                type="text"
                name="name"
                placeholder="Your Name"
                required
                className="w-full px-4 py-3 rounded-xl glass-input text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-coral transition-all duration-300"
              />
              <input
                type="email"
                name="email"
                placeholder="Your Email"
                required
                className="w-full px-4 py-3 rounded-xl glass-input text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-coral transition-all duration-300"
              />
              <textarea
                name="message"
                placeholder="Your Message"
                rows={4}
                required
                className="w-full px-4 py-3 rounded-xl glass-input text-foreground text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-coral resize-none transition-all duration-300"
              />

              <input
                type="text"
                name="website"
                autoComplete="off"
                tabIndex={-1}
                className="hidden"
                aria-hidden="true"
              />

              <motion.button
                type="submit"
                disabled={submitState === "submitting"}
                whileHover={{ scale: submitState === "submitting" ? 1 : 1.02 }}
                whileTap={{ scale: submitState === "submitting" ? 1 : 0.98 }}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors glow-coral disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {submitState === "submitting" ? "Sending..." : block.submitLabel}
              </motion.button>
            </form>

            {feedbackMessage ? (
              <p
                className={`mt-3 text-sm ${
                  submitState === "success" ? "text-primary" : "text-destructive"
                }`}
              >
                {feedbackMessage}
              </p>
            ) : null}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
