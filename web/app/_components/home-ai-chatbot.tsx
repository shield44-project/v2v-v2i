"use client";

import { FormEvent, useState } from "react";

type ChatbotMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};
const MAX_CHAT_MESSAGES = 6;
const MESSAGES_PER_SUBMISSION = 2;

function buildResponse(prompt: string) {
  const text = prompt.toLowerCase();

  if (text.includes("route") || text.includes("path")) {
    return "Use the Emergency and Signal modules together to coordinate route priority and reduce clearance time.";
  }
  if (text.includes("sign") || text.includes("login") || text.includes("account")) {
    return "Use Google sign-in from the top bar, then open Dashboard for authenticated V2X operations.";
  }
  if (text.includes("safety") || text.includes("risk") || text.includes("collision")) {
    return "Focus on AI guidance cards and confidence metrics to spot high-risk intersections before conflicts happen.";
  }

  return "I can help with route clearance, dashboard navigation, and V2X safety guidance. Ask me what you want to do.";
}

function createMessageId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export default function HomeAiChatbot() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatbotMessage[]>([
    {
      id: "init-assistant",
      role: "assistant",
      text: "Hi, I am your V2X AI chatbot. Ask for quick help with route clearance, safety, or dashboard actions.",
    },
  ]);

  const canSend = input.trim().length > 0;
  const placeholder = "Ask: how do I clear an emergency route?";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((existing) => [
      ...existing.slice(-(MAX_CHAT_MESSAGES - MESSAGES_PER_SUBMISSION)),
      { id: createMessageId("user"), role: "user", text: trimmed },
      { id: createMessageId("assistant"), role: "assistant", text: buildResponse(trimmed) },
    ]);
    setInput("");
  }

  return (
    <section className="card-glow animate-fade-in-up rounded-2xl border border-cyan-500/25 bg-zinc-950/90 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-zinc-100">AI Chatbot</h3>
        <span className="status-badge">
          <span className="status-badge-dot" />
          Ready
        </span>
      </div>

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 bg-black/40 p-3 text-sm">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-lg border px-3 py-2 ${
              message.role === "assistant"
                ? "border-cyan-500/25 bg-cyan-500/5 text-cyan-100"
                : "border-zinc-700 bg-zinc-900 text-zinc-100"
            }`}
          >
            <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
              {message.role === "assistant" ? "Assistant" : "You"}
            </p>
            <p>{message.text}</p>
          </article>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="home-ai-chatbot-input" className="sr-only">
          Ask the AI chatbot
        </label>
        <input
          id="home-ai-chatbot-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          className="h-10 flex-1 rounded-lg border border-zinc-700 bg-black px-3 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
        <button
          type="submit"
          className="btn-primary h-10 cursor-pointer px-4 py-0 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canSend}
        >
          Send
        </button>
      </form>
    </section>
  );
}
