import React from "react";
import { levelLabels, levels, randomMixedPair } from "./data.js";

const h = React.createElement;

export function NounPair({ pair }) {
  return h(
    "div",
    { className: "noun-pair", "aria-label": `${pair[0]} and ${pair[1]}` },
    h("span", null, pair[0]),
    h("span", { className: "and" }, "and"),
    h("span", null, pair[1])
  );
}

export function Home({ level, setLevel, pairIndex, setPairIndex, pair, options, addCustomPair, goSolo, goTeacher, goJoin }) {
  const generatePair = async () => {
    addCustomPair(randomMixedPair(level, pair));
  };

  return h(
    "section",
    { className: "hero" },
    h(NounPair, { pair }),
    h(
      "div",
      { className: "control-row" },
      h(
        "div",
        { className: "field" },
        h("label", null, "Thinking style"),
        h(
          "select",
          {
            value: level,
            onChange: (event) => {
              setLevel(event.target.value);
              setPairIndex(0);
            }
          },
          levels.map((item) => h("option", { key: item, value: item }, levelLabels[item]))
        )
      ),
      h(
        "div",
        { className: "field" },
        h("label", null, "Noun pair"),
        h(
          "select",
          { value: pairIndex, onChange: (event) => setPairIndex(Number(event.target.value)) },
          options.map((item, index) => h("option", { key: `${item.join("-")}-${index}`, value: index }, `${item[0]} and ${item[1]}`))
        )
      )
    ),
    h(
      "div",
      { className: "button-row" },
      h("button", { type: "button", onClick: generatePair }, "Random Pair"),
      h("button", { className: "primary", type: "button", onClick: goSolo }, "Solo Mode"),
      h("button", { type: "button", onClick: goTeacher }, "Class Session Mode"),
      h("button", { className: "ghost", type: "button", onClick: goJoin }, "Join Session")
    )
  );
}
