import React from "react";

const h = React.createElement;

export function CoachResponse({ response, nudge, busy }) {
  return h(
    "section",
    { className: "panel" },
    h("p", { className: "muted" }, busy ? "Thinking with you..." : "AI coach"),
    response
      ? h("div", { className: "coach" }, response)
      : h("div", { className: "coach muted" }, "Submit a thought and the coach will respond here."),
    nudge ? h("div", { className: "thought", style: { marginTop: "1rem" } }, nudge) : null
  );
}
