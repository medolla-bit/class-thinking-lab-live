import React from "react";
import { downloadText } from "./api.js";

const h = React.createElement;

function csvEscape(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

export function ExportPanel({ kind, payload }) {
  const copy = async () => {
    await navigator.clipboard.writeText(payload.copyText);
  };

  const printPdf = () => {
    window.print();
  };

  const exportCsv = () => {
    if (!payload.csv) return;
    downloadText(payload.csvName || "class-thinking-lab.csv", payload.csv, "text/csv");
  };

  const exportJson = () => {
    if (!payload.json) return;
    downloadText(payload.jsonName || "class-thinking-lab-evidence.json", JSON.stringify(payload.json, null, 2), "application/json");
  };

  return h(
    "section",
    { className: "panel" },
    h("p", { className: "muted" }, kind === "teacher" ? "Export" : "Keep this thinking"),
    h(
      "div",
      { className: "button-row" },
      h("button", { type: "button", onClick: copy, disabled: !payload.copyText }, "Copy"),
      h("button", { type: "button", onClick: printPdf, disabled: !payload.copyText }, "Light PDF"),
      kind === "teacher" ? h("button", { type: "button", onClick: exportCsv, disabled: !payload.csv }, "CSV") : null,
      kind === "teacher" ? h("button", { type: "button", onClick: exportJson, disabled: !payload.json }, "Save Evidence") : null
    )
  );
}

export function teacherCsv(session) {
  const rows = [["Name", "Thought 1", "Thought 2", "Thought 3", "Nudges Used", "Final Piece"]];
  for (const student of session.students || []) {
    rows.push([
      student.name,
      student.thoughts?.[0] || "",
      student.thoughts?.[1] || "",
      student.thoughts?.[2] || "",
      student.nudgeCount || 0,
      student.finalPiece || ""
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}
