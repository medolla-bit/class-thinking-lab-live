import React, { useEffect, useRef } from "react";

const h = React.createElement;

export function ChatThread({ messages, busy, finalPiece, pair }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy, finalPiece]);

  return h(
    "section",
    { className: "chat-shell", "aria-label": "Thinking conversation" },
    h(
      "div",
      { className: "chat-thread" },
      messages.length
        ? messages.map((message) =>
          h(
            "div",
            { className: `chat-row ${message.role}`, key: message.id },
            h("div", { className: "chat-name" }, message.role === "student" ? "You" : message.kind === "nudge" ? "Thinking Coach nudge" : "Thinking Coach"),
            h("div", { className: "chat-bubble" }, message.text)
          )
        )
        : h(
          "div",
          { className: "chat-empty" },
          h("div", { className: "chat-empty-pair" }, `${pair?.[0] || ""} + ${pair?.[1] || ""}`),
          h("p", null, "Find one connection between these two nouns. A small, strange, or unfinished thought is enough.")
        ),
      busy
        ? h(
          "div",
          { className: "chat-row coach" },
          h("div", { className: "chat-name" }, "Thinking Coach"),
          h("div", { className: "chat-bubble typing" }, h("span", null), h("span", null), h("span", null))
        )
        : null,
      finalPiece
        ? h(
          "div",
          { className: "chat-row coach final-chat" },
          h("div", { className: "chat-name" }, "Final piece"),
          h("div", { className: "chat-bubble" }, finalPiece)
        )
        : null,
      h("div", { ref: endRef })
    )
  );
}
