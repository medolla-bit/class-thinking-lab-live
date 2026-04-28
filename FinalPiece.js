import React from "react";

const h = React.createElement;

export function FinalPiece({ piece }) {
  if (!piece) return null;
  return h(
    "section",
    { className: "panel" },
    h("p", { className: "muted" }, "Final reflective piece"),
    h("div", { className: "final-piece" }, piece)
  );
}
