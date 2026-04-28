import React from "react";

const h = React.createElement;

export function ThoughtInput({ round, value, setValue, onSubmit, onNudge, disabled, complete }) {
  return h(
    "section",
    { className: "panel composer" },
    h("div", { className: "field" },
      h("label", null, complete ? "All three thoughts are in" : `Your next thought goes here · ${round} of 3`),
      h("textarea", {
        value,
        disabled: disabled || complete,
        maxLength: 700,
        placeholder: "Try one angle, twist, question, image, or surprising connection. Rough is welcome.",
        onChange: (event) => setValue(event.target.value)
      })
    ),
    h(
      "div",
      { className: "button-row", style: { marginTop: "0.85rem" } },
      h("button", { className: "primary", type: "button", onClick: onSubmit, disabled: disabled || complete || !value.trim() }, "Send Thought"),
      h("button", { type: "button", onClick: onNudge, disabled: disabled || complete }, "Nudge")
    )
  );
}
