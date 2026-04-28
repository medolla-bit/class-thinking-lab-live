import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { nounPairs } from "./data.js";
import { Home } from "./Home.js";
import { SoloMode } from "./SoloMode.js";
import { StudentSession } from "./StudentSession.js";
import { TeacherDashboard } from "./TeacherDashboard.js";

const h = React.createElement;

function App() {
  const [view, setView] = useState("home");
  const [level, setLevel] = useState("Upper Elementary");
  const [pairIndex, setPairIndex] = useState(0);
  const [customPairs, setCustomPairs] = useState({ "Upper Elementary": [], "High School": [] });

  const options = useMemo(() => [...nounPairs[level], ...(customPairs[level] || [])], [customPairs, level]);
  const pair = useMemo(() => options[pairIndex] || options[0], [options, pairIndex]);
  const addCustomPair = (newPair) => {
    setCustomPairs((items) => {
      const nextItems = [...(items[level] || []), newPair];
      setPairIndex(nounPairs[level].length + nextItems.length - 1);
      return { ...items, [level]: nextItems };
    });
  };

  return h(
    "div",
    { className: "app-shell" },
    h(
      "header",
      { className: "topbar" },
      h("div", { className: "brand" }, h("h1", null, "Class Thinking Lab"), h("span", null, "metaphor in motion")),
      view === "home" ? null : h("button", { className: "ghost", type: "button", onClick: () => setView("home") }, "Home")
    ),
    view === "home"
      ? h(Home, {
        level,
        setLevel,
        pairIndex,
        setPairIndex,
        pair,
        options,
        addCustomPair,
        goSolo: () => setView("solo"),
        goTeacher: () => setView("teacher"),
        goJoin: () => setView("student")
      })
      : null,
    view === "solo" ? h(SoloMode, { level, pair }) : null,
    view === "teacher" ? h(TeacherDashboard, { initialLevel: level, initialPairIndex: pairIndex }) : null,
    view === "student" ? h(StudentSession) : null
  );
}

createRoot(document.getElementById("root")).render(h(App));
