import React, { useMemo, useState } from "react";
import { postJson } from "./api.js";
import { levelLabels } from "./data.js";
import { ChatThread } from "./ChatThread.js";
import { ExportPanel } from "./ExportPanel.js";
import { NounPair } from "./Home.js";
import { ThoughtInput } from "./ThoughtInput.js";

const h = React.createElement;
const errorText = "Something went wrong. Try again.";

export function SoloMode({ level, pair }) {
  const [thoughts, setThoughts] = useState([]);
  const [draft, setDraft] = useState("");
  const [coachResponses, setCoachResponses] = useState([]);
  const [messages, setMessages] = useState([]);
  const [finalPiece, setFinalPiece] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const round = thoughts.length + 1;

  const submitThought = async () => {
    const currentThought = draft.trim();
    if (!currentThought || busy || thoughts.length >= 3) return;
    setBusy(true);
    setError("");
    const studentMessage = { id: crypto.randomUUID(), role: "student", text: currentThought };
    setMessages((items) => [...items, studentMessage]);
    try {
      const coach = await postJson("/api/coach", {
        noun1: pair[0],
        noun2: pair[1],
        level,
        currentThought,
        previousThoughts: thoughts,
        round
      });
      const nextThoughts = [...thoughts, currentThought];
      setThoughts(nextThoughts);
      setCoachResponses((items) => [...items, coach.text]);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "coach", text: coach.text }]);
      setDraft("");
      if (nextThoughts.length === 3) {
        const poem = await postJson("/api/student-poem", {
          noun1: pair[0],
          noun2: pair[1],
          level,
          thoughts: nextThoughts
        });
        setFinalPiece(poem.text);
      }
    } catch {
      setError(errorText);
    } finally {
      setBusy(false);
    }
  };

  const askNudge = async () => {
    if (busy || thoughts.length >= 3) return;
    setBusy(true);
    setError("");
    try {
      const response = await postJson("/api/nudge", { noun1: pair[0], noun2: pair[1], level, thoughts });
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "coach", kind: "nudge", text: response.text }]);
    } catch {
      setError(errorText);
    } finally {
      setBusy(false);
    }
  };

  const copyText = useMemo(() => {
    if (!finalPiece) return "";
    return [
      `${pair[0]} and ${pair[1]}`,
      "",
      "Idea bursts:",
      ...thoughts.map((item, index) => `${index + 1}. ${item}`),
      "",
      finalPiece
    ].join("\n");
  }, [finalPiece, pair, thoughts]);

  return h(
    "div",
    { className: "main-stack" },
    h(NounPair, { pair }),
    h(
      "div",
      { className: "work-grid" },
      h(
        "div",
        { className: "main-stack" },
        h(ChatThread, { messages, busy, finalPiece, pair }),
        h(ThoughtInput, {
          round,
          value: draft,
          setValue: setDraft,
          onSubmit: submitThought,
          onNudge: askNudge,
          disabled: busy,
          complete: thoughts.length >= 3
        }),
        error ? h("p", { className: "danger" }, error) : null
      ),
      h(
        "aside",
        { className: "side-stack" },
        h(
          "section",
          { className: "panel" },
          h("p", { className: "muted" }, `${levelLabels[level] || level} · ${thoughts.length}/3 idea bursts`),
          h(
            "div",
            { className: "thought-list" },
            thoughts.length
              ? thoughts.map((item, index) => h("div", { className: "thought", key: `${item}-${index}` }, item))
              : h("p", { className: "muted" }, "Your idea bursts will collect here.")
          )
        ),
        h(ExportPanel, { kind: "student", payload: { copyText } })
      )
    ),
    h(
      "article",
      { className: "print-sheet" },
      h("h1", null, "Class Thinking Lab"),
      h("h2", null, `${pair[0]} and ${pair[1]}`),
      h("h2", null, "Idea Bursts"),
      thoughts.map((item, index) => h("p", { key: index }, `${index + 1}. ${item}`)),
      h("h2", null, "Final Reflective Piece"),
      h("pre", null, finalPiece)
    )
  );
}
