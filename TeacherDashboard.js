import React, { useEffect, useMemo, useState } from "react";
import { getJson, postJson } from "./api.js";
import { levelLabels, levels, nounPairs, randomMixedPair } from "./data.js";
import { ExportPanel, teacherCsv } from "./ExportPanel.js";
import { NounPair } from "./Home.js";

const h = React.createElement;
const errorText = "Something went wrong. Try again.";

function responseText(session) {
  return (session.students || [])
    .map((student) => {
      const labels = ["First Connections", "Twists + Surprises", "Strongest Lines"];
      const thoughts = (student.thoughts || []).map((thought, index) => `${labels[index] || `Idea Burst ${index + 1}`}: ${thought}`).join("\n");
      return `${student.name}\n${thoughts}\nFinal: ${student.finalPiece || ""}`;
    })
    .join("\n\n");
}

export function TeacherDashboard({ initialLevel, initialPairIndex }) {
  const [level, setLevel] = useState(initialLevel);
  const [pairIndex, setPairIndex] = useState(initialPairIndex);
  const [customPairs, setCustomPairs] = useState({ "Upper Elementary": [], "High School": [] });
  const [session, setSession] = useState(null);
  const [variationFocus, setVariationFocus] = useState("balanced");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const options = useMemo(() => [...nounPairs[level], ...(customPairs[level] || [])], [customPairs, level]);
  const pair = options[pairIndex] || options[0];
  const generatePair = async () => {
    const newPair = randomMixedPair(level, pair);
    setCustomPairs((items) => {
      const nextItems = [...(items[level] || []), newPair];
      setPairIndex(nounPairs[level].length + nextItems.length - 1);
      return { ...items, [level]: nextItems };
    });
  };

  const startSession = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await postJson("/api/sessions", { level, pair });
      setSession(response);
    } catch {
      setError(errorText);
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!session?.code) return;
    try {
      const latest = await getJson(`/api/sessions/${session.code}`);
      setSession(latest);
    } catch {
      setError(errorText);
    }
  };

  useEffect(() => {
    if (!session?.code) return undefined;
    const timer = setInterval(refresh, 3500);
    return () => clearInterval(timer);
  }, [session?.code]);

  const createClassPoem = async (focus = variationFocus) => {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      const poem = await postJson("/api/class-poem", {
        noun1: session.noun1,
        noun2: session.noun2,
        level: session.level,
        responses: responseText(session),
        variationFocus: focus
      });
      const updated = await postJson("/api/session-class-poem", { code: session.code, classPoem: poem.text });
      setSession(updated);
    } catch {
      setError(errorText);
    } finally {
      setBusy(false);
    }
  };

  const exportPayload = useMemo(() => {
    if (!session) return { copyText: "" };
    const copyText = [
      `${session.noun1} and ${session.noun2}`,
      "",
      "Student Responses:",
      responseText(session),
      "",
      session.classPoem || ""
    ].join("\n");
    return {
      copyText,
      csv: teacherCsv(session),
      csvName: `class-thinking-lab-${session.code}.csv`,
      jsonName: `class-thinking-lab-evidence-${session.code}.json`,
      json: {
        app: "Class Thinking Lab",
        sessionCode: session.code,
        nounPair: [session.noun1, session.noun2],
        thinkingStyle: levelLabels[session.level] || session.level,
        createdAt: session.createdAt,
        students: session.students || [],
        classPoemAndNotes: session.classPoem || ""
      }
    };
  }, [session]);

  if (!session) {
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
        h("button", { type: "button", onClick: generatePair, disabled: busy }, "Random Pair"),
        h("button", { className: "primary", type: "button", onClick: startSession, disabled: busy }, "Start Session")
      ),
      error ? h("p", { className: "danger" }, error) : null
    );
  }

  return h(
    "div",
    { className: "main-stack" },
    h(NounPair, { pair: [session.noun1, session.noun2] }),
    h(
      "section",
      { className: "panel" },
      h("p", { className: "muted" }, "Session code"),
      h("div", { className: "session-code" }, session.code),
      h("p", { className: "muted" }, "Students join with this code. Solo Practice stays private; to appear here, students use Join Session."),
      h(
        "div",
        { className: "field", style: { marginTop: "1rem", maxWidth: "26rem" } },
        h("label", null, "Class poem angle"),
        h(
          "select",
          { value: variationFocus, onChange: (event) => setVariationFocus(event.target.value) },
          h("option", { value: "balanced" }, "Balanced collective poem"),
          h("option", { value: "mostly student words" }, "Closest to student words"),
          h("option", { value: "more lyrical" }, "More poetic / lyrical"),
          h("option", { value: "more discussion variations" }, "More variation choices")
        )
      ),
      h("div", { className: "button-row", style: { justifyContent: "flex-start", marginTop: "1rem" } },
        h("button", { type: "button", onClick: refresh }, "Refresh"),
        h("button", { className: "primary", type: "button", onClick: () => createClassPoem(), disabled: busy || !(session.students || []).length }, "Create Class Poem"),
        h("button", { type: "button", onClick: () => createClassPoem("new variation for live class discussion"), disabled: busy || !(session.students || []).length }, "Try Another Version")
      )
    ),
    h(
      "section",
      { className: "panel table-wrap" },
      h("table", null,
        h("thead", null, h("tr", null, ["Name", "Responses", "Nudges", "Final Piece"].map((head) => h("th", { key: head }, head)))),
        h("tbody", null,
          (session.students || []).length
            ? session.students.map((student) => h("tr", { key: student.id },
              h("td", null, student.name),
              h("td", null, (student.thoughts || []).map((thought, index) => h("p", { className: "mini", key: index }, `${["First", "Twist", "Strong"][index] || index + 1}: ${thought}`))),
              h("td", null, student.nudgeCount || 0),
              h("td", { className: "mini" }, student.finalPiece || "")
            ))
            : h("tr", null, h("td", { colSpan: 4, className: "muted" }, "Students will appear here after they join."))
        )
      )
    ),
    session.classPoem
      ? h("section", { className: "panel" }, h("p", { className: "muted" }, "Class poem, variations, and teacher source notes"), h("div", { className: "final-piece" }, session.classPoem))
      : null,
    h(ExportPanel, { kind: "teacher", payload: exportPayload }),
    error ? h("p", { className: "danger" }, error) : null,
    h(
      "article",
      { className: "print-sheet" },
      h("h1", null, "Class Thinking Lab"),
      h("h2", null, `${session.noun1} and ${session.noun2}`),
      h("h2", null, "Student Responses"),
      (session.students || []).map((student) => h("section", { key: student.id }, h("h3", null, student.name), (student.thoughts || []).map((thought, index) => h("p", { key: index }, `${index + 1}. ${thought}`)), h("pre", null, student.finalPiece || ""))),
      h("h2", null, "Class Poem"),
      h("pre", null, session.classPoem || "")
    )
  );
}
