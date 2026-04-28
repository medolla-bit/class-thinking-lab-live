import React, { useMemo, useState } from "react";
import { getJson, postJson } from "./api.js";
import { ChatThread } from "./ChatThread.js";
import { ExportPanel } from "./ExportPanel.js";
import { NounPair } from "./Home.js";
import { ThoughtInput } from "./ThoughtInput.js";

const h = React.createElement;
const errorText = "Something went wrong. Try again.";

export function StudentSession() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [session, setSession] = useState(null);
  const [draft, setDraft] = useState("");
  const [thoughts, setThoughts] = useState([]);
  const [coachResponses, setCoachResponses] = useState([]);
  const [messages, setMessages] = useState([]);
  const [finalPiece, setFinalPiece] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const join = async () => {
    if (!code.trim() || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await postJson("/api/join", { code, name });
      setStudentId(response.studentId);
      setSession(response.session);
    } catch {
      setError(errorText);
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!session?.code) return;
    const latest = await getJson(`/api/sessions/${session.code}`);
    setSession(latest);
  };

  const submitThought = async () => {
    const currentThought = draft.trim();
    if (!currentThought || busy || thoughts.length >= 3) return;
    setBusy(true);
    setError("");
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "student", text: currentThought }]);
    try {
      const coach = await postJson("/api/coach", {
        noun1: session.noun1,
        noun2: session.noun2,
        level: session.level,
        currentThought,
        previousThoughts: thoughts,
        round: thoughts.length + 1
      });
      const nextThoughts = [...thoughts, currentThought];
      setThoughts(nextThoughts);
      setCoachResponses((items) => [...items, coach.text]);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "coach", text: coach.text }]);
      setDraft("");
      await postJson("/api/session-thought", { code: session.code, studentId, thought: currentThought, coach: coach.text });
      if (nextThoughts.length === 3) {
        const poem = await postJson("/api/student-poem", {
          noun1: session.noun1,
          noun2: session.noun2,
          level: session.level,
          thoughts: nextThoughts
        });
        setFinalPiece(poem.text);
        await postJson("/api/session-final", { code: session.code, studentId, finalPiece: poem.text });
      }
      await refresh();
    } catch {
      setError(errorText);
    } finally {
      setBusy(false);
    }
  };

  const askNudge = async () => {
    if (busy || thoughts.length >= 3 || !session) return;
    setBusy(true);
    setError("");
    try {
      const response = await postJson("/api/nudge", {
        noun1: session.noun1,
        noun2: session.noun2,
        level: session.level,
        thoughts
      });
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "coach", kind: "nudge", text: response.text }]);
      await postJson("/api/session-nudge", { code: session.code, studentId });
    } catch {
      setError(errorText);
    } finally {
      setBusy(false);
    }
  };

  const copyText = useMemo(() => {
    if (!finalPiece || !session) return "";
    return [
      `${name}`,
      `${session.noun1} and ${session.noun2}`,
      "",
      "Thoughts:",
      ...thoughts.map((item, index) => `${index + 1}. ${item}`),
      "",
      finalPiece
    ].join("\n");
  }, [finalPiece, name, session, thoughts]);

  if (!session) {
    return h(
      "section",
      { className: "hero" },
      h("h2", null, "Join a class session"),
      h(
        "div",
        { className: "control-row" },
        h("div", { className: "field" }, h("label", null, "Name"), h("input", { value: name, onChange: (event) => setName(event.target.value), placeholder: "Student name" })),
        h("div", { className: "field" }, h("label", null, "Session code"), h("input", { value: code, onChange: (event) => setCode(event.target.value.toUpperCase()), placeholder: "ABCDE" }))
      ),
      h("button", { className: "primary", type: "button", onClick: join, disabled: busy }, "Join"),
      error ? h("p", { className: "danger" }, error) : null
    );
  }

  return h(
    "div",
    { className: "main-stack" },
    h(NounPair, { pair: [session.noun1, session.noun2] }),
    h(
      "div",
      { className: "work-grid" },
      h(
        "div",
        { className: "main-stack" },
        h(ChatThread, { messages, busy, finalPiece, pair: [session.noun1, session.noun2] }),
        h(ThoughtInput, {
          round: thoughts.length + 1,
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
        h("section", { className: "panel" }, h("p", { className: "muted" }, `${name} · ${session.code}`), h("p", null, `${thoughts.length}/3 thoughts submitted`)),
        h(ExportPanel, { kind: "student", payload: { copyText } })
      )
    ),
    h(
      "article",
      { className: "print-sheet" },
      h("h1", null, "Class Thinking Lab"),
      h("p", null, name),
      h("h2", null, `${session.noun1} and ${session.noun2}`),
      h("h2", null, "Thoughts"),
      thoughts.map((item, index) => h("p", { key: index }, `${index + 1}. ${item}`)),
      h("h2", null, "Final Reflective Piece"),
      h("pre", null, finalPiece)
    )
  );
}
