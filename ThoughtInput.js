import React from "react";

const h = React.createElement;

const burstLabels = ["First Connections", "Twists + Surprises", "Strongest Lines"];

export function ThoughtInput({ round, value, setValue, onSubmit, onNudge, disabled, complete }) {
  const label = burstLabels[Math.max(0, Math.min(round - 1, burstLabels.length - 1))];

  return h(
    "section",
    { className: "panel composer" },
    h("div", { className: "field" },
      h("label", null, complete ? "All three idea bursts are in" : `${label} · burst ${round} of 3`),
      h("textarea", {
        value,
        disabled: disabled || complete,
        maxLength: 1400,
        placeholder: "List several connections, fragments, images, questions, opposites, or strange possibilities. One per line is great. Rough is welcome.",
        onChange: (event) => setValue(event.target.value)
      })
    ),
    h(
      "div",
      { className: "button-row", style: { marginTop: "0.85rem" } },
      h("button", { className: "primary", type: "button", onClick: onSubmit, disabled: disabled || complete || !value.trim() }, "Send Ideas"),
      h("button", { type: "button", onClick: onNudge, disabled: disabled || complete }, "Nudge")
    )
  );
}
