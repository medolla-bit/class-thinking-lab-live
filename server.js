import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = process.cwd();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const AI_TEST_MODE = process.env.AI_TEST_MODE === "1";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const sessions = new Map();

function loadDotEnv() {
  try {
    const contents = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equals = trimmed.indexOf("=");
      if (equals === -1) continue;
      const key = trimmed.slice(0, equals).trim();
      const value = trimmed.slice(equals + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env is optional. Production hosts should use real environment variables.
  }
}

const nounPairs = {
  "Upper Elementary": [
    ["Bridge", "Voice"],
    ["Button", "Storm"],
    ["Spoon", "Thunder"],
    ["Blanket", "Map"],
    ["Crayon", "Echo"],
    ["Shoelace", "River"],
    ["Mailbox", "Dream"],
    ["Window", "Heartbeat"],
    ["Lantern", "Mistake"],
    ["Pocket", "Moon"],
    ["Mirror", "Sand"],
    ["Kite", "Memory"],
    ["Pencil", "Cave"],
    ["Backpack", "Cloud"],
    ["Sock", "Secret"],
    ["Umbrella", "Memory"],
    ["Fence", "Song"],
    ["Staircase", "Wish"],
    ["Marble", "Promise"]
  ],
  "High School": [
    ["Bridge", "Voice"],
    ["Clock", "Ocean"],
    ["Mask", "Weather"],
    ["Cage", "Lullaby"],
    ["Archive", "Lightning"],
    ["Gravity", "Apology"],
    ["Blueprint", "Grief"],
    ["Compass", "Guilt"],
    ["Static", "Truth"],
    ["Border", "Promise"],
    ["Thread", "Argument"],
    ["Key", "Silence"],
    ["Map", "Lie"],
    ["Pillow", "War"],
    ["Language", "Currency"],
    ["Anchor", "Dream"],
    ["Threshold", "Hunger"],
    ["Rust", "Memory"],
    ["Mirror", "Weather"],
    ["River", "Mouth"]
  ]
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function sanitizeText(value, max = 2400) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitizeMultiline(value, max = 6000) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, max);
}

function sanitizeThoughts(thoughts) {
  return Array.isArray(thoughts) ? thoughts.map((item) => sanitizeText(item, 700)).filter(Boolean).slice(0, 3) : [];
}

function roundNumber(value, previousThoughts) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 3) return parsed;
  return Math.min(3, previousThoughts.length + 1);
}

function levelInstruction(level) {
  if (level === "High School") {
    return "Write for high school students: thoughtful, precise, and layered, while avoiding mature, sensitive, violent, sexual, or disturbing content.";
  }
  return "Write for upper elementary students: warm, clear, concrete, and age-appropriate. Avoid mature, sensitive, violent, sexual, or disturbing content.";
}

async function openAIText(prompt, level) {
  if (AI_TEST_MODE) return testModeText(prompt);
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 1.05,
      top_p: 0.9,
      frequency_penalty: 0.45,
      presence_penalty: 0.3,
      messages: [
        {
          role: "system",
          content: `You are ChatGPT thinking with a student in real time. ${levelInstruction(level)} Never include mature, sensitive, violent, sexual, or disturbing content.`
        },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${details}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned empty text");
  return text;
}

function between(text, start, end) {
  const from = text.indexOf(start);
  if (from === -1) return "";
  const afterStart = from + start.length;
  const to = text.indexOf(end, afterStart);
  return text.slice(afterStart, to === -1 ? undefined : to).trim();
}

function testModeText(prompt) {
  if (prompt.includes("Say one small thing")) {
    const pair = parsePair(between(prompt, "connect these two things:", "Here is what they have said so far:"));
    const thoughts = between(prompt, "Here is what they have said so far:", "Student level:");
    return testNudge(pair.noun1, pair.noun2, thoughts);
  }

  if (prompt.includes("Turn this student's thinking into a short reflective piece.")) {
    const thoughts = between(prompt, "Student's exact thoughts:", "Student level:")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const lines = thoughts.length ? thoughts : ["a beginning", "a connection", "something becoming clearer"];
    return [
      ...lines.slice(0, 3),
      "one thought leans toward another",
      "the two things start to answer",
      "and the idea becomes clearer"
    ].join("\n");
  }

  if (prompt.includes("Create a collaborative class poem")) {
    return `CLASS POEM:
The class gathered small connections.
One thought held the door open.
Another made the pair feel closer.
The poem is waiting for the strongest exact phrases.

TEACHER CREDIT NOTES:
Student credit notes will appear here after real AI is connected.`;
  }

  const currentThought = between(prompt, "Here is what the student just said:", "Here are their thoughts so far:");
  const pair = parsePair(between(prompt, "Noun pair:", "Here is what the student just said:"));
  const previousThoughts = between(prompt, "Here are their thoughts so far:", "Student level:")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const roundMatch = prompt.match(/#([123]) of 3/);
  const round = roundMatch?.[1] || "1";
  return testCoach(pair.noun1, pair.noun2, currentThought, previousThoughts, round);
}

const nounLayers = {
  apology: "tries to repair what happened without erasing it",
  archive: "keeps what might otherwise disappear",
  anchor: "holds something steady when it wants to drift",
  backpack: "carries what someone thinks they might need",
  blanket: "covers, warms, or hides something vulnerable",
  blueprint: "imagines a structure before it exists",
  border: "decides where one thing ends and another begins",
  bridge: "holds a crossing over distance",
  button: "turns a small touch into a larger change",
  cage: "protects and traps at the same time",
  cave: "hides depth inside darkness",
  clock: "turns passing time into something measurable",
  cloud: "changes shape while still feeling present",
  compass: "points toward direction without making the journey",
  crayon: "turns pressure into color",
  currency: "carries value because people agree it does",
  dream: "lets a hidden wish or fear take shape",
  echo: "returns something changed by distance",
  fence: "separates while still showing what is on the other side",
  grief: "keeps love present after a loss",
  gravity: "pulls quietly even when no one sees it",
  guilt: "keeps pulling a person back toward what happened",
  heartbeat: "proves something is alive through repetition",
  hunger: "makes absence feel active",
  key: "opens something only if it meets the right lock",
  kite: "needs both freedom and tension to rise",
  language: "turns thought into something others can enter",
  lantern: "makes a small circle of clarity",
  lie: "changes what people think they can trust",
  lullaby: "softens the world without removing it",
  mailbox: "waits for a message to arrive",
  map: "turns a place into a possible path",
  marble: "looks small but carries weight and direction",
  mask: "shows one face while hiding another",
  memory: "keeps the past active inside the present",
  mirror: "returns an image that may or may not tell the whole truth",
  mistake: "reveals where thinking changed direction",
  moon: "reflects light from somewhere else",
  ocean: "keeps moving beyond what can be controlled",
  pencil: "lets a thought become visible and revisable",
  pillow: "holds the private weight of rest and worry",
  pocket: "keeps something close and partly hidden",
  promise: "stretches a moment into the future",
  river: "keeps moving while shaping what contains it",
  rust: "shows what time and exposure have done",
  sand: "slips, gathers, and changes form under pressure",
  secret: "has power because it is withheld",
  shoelace: "holds movement together through small knots",
  silence: "can protect, hide, or make meaning louder",
  sock: "takes the shape of what it covers",
  song: "carries feeling through pattern",
  spoon: "holds a small amount and brings it close",
  staircase: "turns distance into steps",
  static: "interferes with a signal that is trying to arrive",
  storm: "makes pressure visible",
  thread: "connects small parts into something that can hold",
  threshold: "marks the charged place before change",
  thunder: "arrives as sound after force",
  truth: "asks to be faced even when it is difficult",
  umbrella: "makes temporary shelter inside weather",
  voice: "carries a person across silence",
  war: "turns conflict into something that damages whole worlds",
  weather: "changes the feeling of everything around it",
  window: "lets someone see through a boundary",
  wish: "reaches toward what is not here yet"
};

function parsePair(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/\s+and\s+/i);
  return { noun1: parts[0] || "one noun", noun2: parts[1] || "the other noun" };
}

function layerFor(noun) {
  return nounLayers[String(noun || "").toLowerCase()] || "carries more meaning than it first seems to";
}

function lensForThought(thought) {
  const lower = thought.toLowerCase();
  if (/(destroy|destructive|break|collapse|damage|hurt|danger|wrong)/.test(lower)) {
    return {
      name: "consequence",
      sentence: "You are noticing that connection is not automatically gentle; if it is made badly, it can harm the very thing it was supposed to help."
    };
  }
  if (/(strong|power|hold|holds|force|control)/.test(lower)) {
    return {
      name: "power",
      sentence: "You are already feeling the power inside the metaphor: something can hold, carry, or shape another thing without looking dramatic."
    };
  }
  if (/(start|begin|end|finish|path|journey|move|moving)/.test(lower)) {
    return {
      name: "movement",
      sentence: "You are giving the metaphor a path, which helps it feel alive instead of frozen."
    };
  }
  if (/(hide|secret|quiet|silence|inside|under)/.test(lower)) {
    return {
      name: "hiddenness",
      sentence: "You are paying attention to what is hidden or held back, and that gives the idea a quieter kind of depth."
    };
  }
  if (/(same|both|similar|like|connect|connection|together)/.test(lower)) {
    return {
      name: "connection",
      sentence: "You are starting with connection, which is a good doorway; now the interesting part is what kind of connection it is."
    };
  }
  return {
    name: "possibility",
    sentence: "You are treating the pair as if something can happen between them, and that is where metaphor starts to get interesting."
  };
}

function actionFor(noun) {
  const actions = {
    bridge: "guides a crossing by giving people one path through a gap",
    voice: "guides attention by carrying feeling, meaning, or pressure through silence",
    button: "turns a small touch into a larger change",
    storm: "pushes everything around it into motion",
    clock: "organizes life by making time feel counted",
    ocean: "pulls, carries, and overwhelms what enters it",
    mask: "directs what others are allowed to see",
    weather: "changes the mood around everything without asking",
    cage: "sets a boundary around movement",
    lullaby: "guides someone toward calm",
    archive: "gathers memory and decides what stays",
    lightning: "changes the sky in one sudden flash",
    gravity: "pulls things without speaking",
    apology: "tries to guide hurt toward repair",
    blueprint: "guides what can be built before it exists",
    grief: "pulls the present toward what is missing",
    compass: "points a direction without walking it",
    guilt: "corrals attention back to what happened",
    static: "interrupts a message trying to arrive",
    truth: "pushes things toward being faced",
    border: "guides where movement is allowed or stopped",
    promise: "pulls the present toward a future",
    thread: "holds separate pieces in relation",
    argument: "pushes ideas against each other",
    key: "changes a boundary into an opening",
    silence: "shapes what can be heard by holding sound back",
    map: "guides movement by shrinking a place into choices",
    lie: "guides belief in the wrong direction",
    pillow: "holds private weight close to rest",
    war: "forces conflict onto whole lives",
    language: "guides thought into shared form",
    currency: "guides value through exchange",
    anchor: "holds movement in place",
    dream: "guides hidden feeling into image",
    threshold: "holds someone at the edge of change",
    hunger: "pulls attention toward what is missing",
    rust: "shows how time changes a surface",
    memory: "guides the present with what remains",
    river: "carries movement while shaping its banks",
    mouth: "turns inner life into expression",
    blanket: "covers or shelters what is vulnerable",
    crayon: "turns pressure into visible color",
    echo: "sends a sound back changed by distance",
    shoelace: "holds movement together with a small knot",
    mailbox: "waits for a message to arrive",
    window: "guides sight through a boundary",
    heartbeat: "keeps life moving by repeating",
    lantern: "guides sight with a small circle of light",
    mistake: "redirects thinking by revealing a turn",
    pocket: "keeps something close and partly hidden",
    moon: "guides the dark with borrowed light",
    mirror: "returns an image for someone to face",
    sand: "shifts shape under pressure",
    kite: "rises because tension and freedom work together",
    pencil: "makes thought visible and changeable",
    cave: "holds depth inside darkness",
    backpack: "carries what someone chooses to bring",
    cloud: "changes shape while still moving",
    sock: "takes the shape of what it covers",
    secret: "guides behavior by what is not said",
    umbrella: "creates temporary shelter inside weather",
    fence: "guides movement by separating spaces",
    song: "moves feeling through pattern",
    staircase: "turns height into possible steps",
    wish: "pulls thought toward what is not here"
  };
  return actions[String(noun || "").toLowerCase()] || "shapes what can happen around it";
}

function coreVerb(thought) {
  const lower = thought.toLowerCase();
  const match = lower.match(/\b(corral|corrals|guide|guides|carry|carries|hold|holds|trap|traps|protect|protects|push|pushes|pull|pulls|change|changes|hide|hides|reveal|reveals|move|moves|connect|connects|lead|leads)\b/);
  return match?.[1] || "";
}

function nextMoveForThought(noun1, noun2, thought, round) {
  const n1 = sanitizeText(noun1, 80);
  const n2 = sanitizeText(noun2, 80);
  const lower = thought.toLowerCase();

  if (/(corral|corrals|guide|guides|lead|leads|direct|directs)/.test(lower)) {
    return `For your next thought, stay with that guidance: when does being guided by ${n1.toLowerCase()} and ${n2.toLowerCase()} help someone move, and when does it start to limit where they can go?`;
  }

  if (/(destroy|destructive|break|collapse|damage|hurt|danger|wrong)/.test(lower)) {
    return `For your next thought, stay with that danger: write one sentence about what gets damaged when the ${n1.toLowerCase()}-${n2.toLowerCase()} connection is built badly, and what might become possible when it is built with care.`;
  }

  if (/(strong|power|hold|holds|force|control)/.test(lower)) {
    return `For your next thought, follow the power: write about who or what is being held by this connection, and whether that holding feels supportive, controlling, or both.`;
  }

  if (/(start|begin|end|finish|path|journey|move|moving|somewhere)/.test(lower)) {
    return `For your next thought, make the movement more specific: where does the ${n1.toLowerCase()} help the ${n2.toLowerCase()} go, and what changes by the time it arrives?`;
  }

  if (/(hide|secret|quiet|silence|inside|under)/.test(lower)) {
    return `For your next thought, look at what is hidden: what does the ${n1.toLowerCase()} let the ${n2.toLowerCase()} keep private, and what would happen if that hidden thing came out?`;
  }

  if (/(same|both|similar|like|connect|connection|together)/.test(lower)) {
    return `For your next thought, name the kind of connection more sharply: are ${n1} and ${n2} connected by carrying, protecting, revealing, crossing, changing, or something stranger?`;
  }

  if (round === "1") {
    return `For your next thought, choose one part of your idea and zoom in: what does the ${n1.toLowerCase()} do to the ${n2.toLowerCase()}, or what does the ${n2.toLowerCase()} reveal about the ${n1.toLowerCase()}?`;
  }

  return `For your next thought, try a shift in perspective: write it once as if the ${n1.toLowerCase()} is speaking, or once as if the ${n2.toLowerCase()} is resisting.`;
}

function elaborationForThought(noun1, noun2, thought) {
  const n1 = sanitizeText(noun1, 80);
  const n2 = sanitizeText(noun2, 80);
  const lower = thought.toLowerCase();
  const verb = coreVerb(thought);

  if (/(corral|corrals|guide|guides|lead|leads|direct|directs)/.test(lower)) {
    return `That word gives the metaphor force. A ${n1.toLowerCase()} can corral us because it does not just offer movement; it narrows movement into a chosen path. A ${n2.toLowerCase()} can corral us too, because words can gather attention, shape choices, and make people move together without anyone physically pushing them. So your thought has tension in it: being corralled can mean being protected and guided, but it can also mean being controlled.`;
  }

  if (/(destroy|destructive|break|collapse|damage|hurt|danger|wrong)/.test(lower)) {
    return `That is deeper than it first sounds because it treats the metaphor as something with responsibility. A ${n1.toLowerCase()} is supposed to make a crossing possible, and a ${n2.toLowerCase()} is supposed to carry meaning; if the connection is careless, the crossing can distort the meaning instead of helping it arrive.`;
  }

  if (/(strong|power|hold|holds|force|control)/.test(lower)) {
    return `That opens up a layer about power. The strength of a ${n1.toLowerCase()} is not only that it stands there; it decides what can pass. A ${n2.toLowerCase()} can also hold power because it can reach people, change a room, or make something hidden become heard.`;
  }

  if (/(start|begin|end|finish|path|journey|move|moving|somewhere)/.test(lower)) {
    return `That gives the metaphor motion, which is useful. A ${n1.toLowerCase()} is not just an object in one place; it exists because there is a gap to cross. A ${n2.toLowerCase()} also travels, but through listening, feeling, and meaning, so your thought makes the connection feel active.`;
  }

  if (/(hide|secret|quiet|silence|inside|under)/.test(lower)) {
    return `That creates a quiet layer. A ${n1.toLowerCase()} can make a passage without revealing everything beneath it, and a ${n2.toLowerCase()} can carry meaning while still leaving some things unsaid. Your thought starts to notice that a connection can reveal and conceal at the same time.`;
  }

  if (/(same|both|similar|like|connect|connection|together)/.test(lower)) {
    return `That is a useful beginning because connection is not one simple thing. A ${n1.toLowerCase()} connects spaces, but a ${n2.toLowerCase()} connects minds or feelings. The richer question is what kind of distance each one is crossing.`;
  }

  if (verb) {
    return `The verb "${verb}" is doing real work here. A ${n1.toLowerCase()} ${actionFor(n1)}, and a ${n2.toLowerCase()} ${actionFor(n2)}, so your thought is not just saying they are alike; it is imagining a shared action. That makes the metaphor feel alive because both nouns are doing something to us, to each other, or to the space between them.`;
  }

  return `That thought gives the nouns a way to interact. A ${n1.toLowerCase()} ${actionFor(n1)}, and a ${n2.toLowerCase()} ${actionFor(n2)}, so when you put them together, the metaphor can become about more than similarity; it can become about cause, pressure, change, or possibility.`;
}

function testCoach(noun1, noun2, thought, previousThoughts, round) {
  const cleanThought = sanitizeMultiline(thought || "that idea", 700);
  const lens = lensForThought(cleanThought);
  const n1 = sanitizeText(noun1, 80);
  const n2 = sanitizeText(noun2, 80);
  const n1Layer = layerFor(n1);
  const n2Layer = layerFor(n2);
  const continuity = previousThoughts.length
    ? `That matters because it grows out of your earlier thought, "${previousThoughts.at(-1)}," instead of starting over.`
    : "";
  const nextMove = nextMoveForThought(n1, n2, cleanThought, round);
  const elaboration = elaborationForThought(n1, n2, cleanThought);

  if (round === "1") {
    return `That phrase is really strong: "${cleanThought}" gives the connection an action, not just a comparison. ${elaboration} You could branch from here in a few ways: what they gather, what they limit, what they protect, or what they make possible. #1 of 3 — keep connecting`;
  }

  if (round === "2") {
    return `"${cleanThought}" adds something valuable because it gives the metaphor another angle, not just another example. ${continuity} ${elaboration} Now you have more than one possible connection: action, feeling, pressure, direction, maybe even contradiction. #2 of 3 — keep connecting`;
  }

  return `This third thought, "${cleanThought}," gives the metaphor another useful direction. It is strong because you are no longer just saying ${n1} and ${n2} are alike; you have generated a small field of connections around how they affect each other. ${elaboration} You have enough now because your three thoughts give the final piece several of your own phrases to work with. #3 of 3 — keep connecting`;
}

function testNudge(noun1, noun2, thoughts) {
  const n1 = sanitizeText(noun1, 80);
  const n2 = sanitizeText(noun2, 80);
  const last = thoughts
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);

  if (last) {
    return `Wait... "${last}" is already usable. For the next thought, do not replace it; sharpen it by asking what the ${n1.toLowerCase()} changes about the ${n2.toLowerCase()}, or what the ${n2.toLowerCase()} makes the ${n1.toLowerCase()} able to do.`;
  }

  return `Wait... there is no wrong way in. Maybe start with what a ${n1.toLowerCase()} changes, then what a ${n2.toLowerCase()} changes, and let the overlap be strange for a second.`;
}

function coachPrompt({ noun1, noun2, level, currentThought, previousThoughts, round }) {
  return `A student is trying to make a connection between two unlike things.

Noun pair:
${noun1} and ${noun2}

Here is what the student just said:
${currentThought}

Here are their thoughts so far:
${previousThoughts.join("\n")}

Student level:
${level}

Be ChatGPT acting as a natural Thinking Coach.

Before anything else, find something specific in the student's response that is worth continuing.
Assume the student's thought has value, even if it is rough, literal, brief, misspelled, or uncertain.
The main goal is creative fluency: help the student generate many possible connections between the noun pair, not just dig one idea deeper.

Do not follow a script.
Do not label sections.
Do not sound like a worksheet, rubric, or teacher comment.
Do not use repeated stock phrases.
Do not correct the student unless something is truly confusing.
Do not praise vaguely. Avoid lines like "great job," "nice thinking," or "that's interesting" unless followed by a precise reason.
Do not make the student feel there is a single correct answer.
Do not sound like you are assigning work.

Start from the student's idea.
If the student uses a vivid verb or phrase, make that phrase the center of the response.
Quote or echo a small exact phrase from the student when it helps the response feel grounded.
Help them see what they may already be getting at.
Use a confidence-building tone early in the response: the student should feel their thought is usable and worth developing.
Make the student feel strong about the specific thought they just submitted.
Point out what EACH submitted thought contributes to the growing field of ideas.
If the idea is simple, treat it as a real beginning.
If the idea is strong, react honestly and let that moment stand out.
Validate the move they made, then briefly show 2 or 3 other possible directions it opens.
Encourage free association: quick possible links, surprising angles, opposites, shifts in perspective, emotional connections, physical connections, and strange-but-usable ideas.
Use this natural response shape, without labeling the parts:
1. React briefly to the student's exact phrase as valuable.
2. Explain how noun1 can connect to the phrase.
3. Explain how noun2 can connect to the phrase.
4. Name one tension, surprise, or ambiguity inside the connection.
5. Offer a few possible next associations, lightly, so the student feels free to choose or invent another.
Possible layers include tension, consequence, hidden purpose, change over time, reversal, power, fragility, misunderstanding, protection, risk, memory, or what one noun makes possible for the other.
Use creativity-building moves inspired by Torrance-style thinking: invite fluency, flexibility, originality, elaboration, ambiguity, incongruity, twisting the idea, and seeing through multiple perspectives.
Do this naturally, not by naming those categories to the student.
Offer several different directions when it grows from their words, and make them feel like openings rather than instructions.
Take the idea deeper into nuance, ambiguity, metaphor, or layered complexity.
Only add ideas that grow naturally from what the student already said.
Keep the student feeling capable.
Keep it appropriate for the selected level.
Write like a thoughtful person thinking beside the student in the moment.
Vary the rhythm and wording from response to response.
Keep it compact: usually 4 to 7 sentences.
For round 1, especially emphasize that the thought is a valid beginning and can branch in many directions.
For round 2, connect the second thought to the first and show how the student's range is growing.
For round 3, help them see the range/pattern of connections they have generated.
For rounds 1 and 2, do not give step-by-step directions. Instead, leave them with a small cluster of possible association paths they might try next.
Do not end with a generic question like "What do you think?" or "Can you go deeper?"

End with one thoughtful question only if it feels natural.
Include "#${round} of 3 — keep connecting".

The student should feel:
"My thought has value, and now I can make more connections."`;
}

function nudgePrompt({ noun1, noun2, level, thoughts }) {
  return `A student is stuck trying to connect these two things:

${noun1} and ${noun2}

Here is what they have said so far:
${thoughts.join("\n")}

Student level:
${level}

Say one small thing that might help them see it differently.

Keep it natural, short, and specific to the nouns.
Do not use a sentence frame.
Do not sound like a lesson.
If they already wrote something, build from it.
If they wrote little or "I don't know," give one small way in.
Always move toward connection, not just difference.
Encourage free association and idea fluency: one quick surprising connection or a small cluster of 2-3 possible angles is okay.
Keep it appropriate for the selected level.

It should feel like a quick "wait... what if..." thought.`;
}

function studentPoemPrompt({ noun1, noun2, level, thoughts }) {
  return `Turn this student's thinking into a short reflective piece.

Noun pair:
${noun1} and ${noun2}

Student's exact thoughts:
${thoughts.join("\n")}

Student level:
${level}

Use the student's actual words and phrases as much as possible.
The final piece should be about 90 percent the student's language and 10 percent light poetic shaping from you.
Preserve the student's exact phrases whenever possible, including unusual wording.
Do not introduce unrelated imagery.
Do not make it sound like a generic AI poem.
Stay grounded in the noun pair and the student's own thinking.
Make it feel like their idea became clearer, not replaced.
Keep it appropriate for the selected level.

Write 5 to 9 short lines.
No title.
No explanation before or after.
Less is more. Let the student's words lead.`;
}

function classPoemPrompt({ noun1, noun2, level, responses, variationFocus }) {
  return `Create a collaborative class poem from student thinking.

Noun pair:
${noun1} and ${noun2}

Student level:
${level}

Student responses with names for teacher credit only:
${responses}

Purpose:
This is a Thinking Lab artifact. It should show how individual perspectives help the class write with more depth, surprise, and appreciation for each other's thinking.

Variation focus:
${variationFocus || "balanced class poem with a few alternate possibilities"}

Write four parts.

CLASS POEM:
Use the strongest student phrases and ideas.
Do not include student names in the poem.
Keep it grounded in their actual words.
Use about 90 percent student language and 10 percent light poetic shaping.
Do not introduce unrelated imagery.
Make it thoughtful, clear, and slightly poetic.
Keep it appropriate for the selected level.

VARIATION POSSIBILITIES:
Give 2 short alternate versions or alternate line choices the teacher could discuss in front of the class.
These variations should help students see that writing can shift depending on emphasis, order, sound, or perspective.

TEACHER SOURCE NOTES:
Use names here.
Quote exact student words and explain where their thinking appears in the poem or variations.
Make it easy for the teacher to see who wrote what and how it shaped the collective piece.

COLLECTIVE THINKING NOTES:
Briefly name how hearing multiple perspectives helped the class grow the writing.
Focus on fluency, flexibility, deeper connection, and appreciation of other viewpoints.

Format exactly:
CLASS POEM:
...

VARIATION POSSIBILITIES:
...

TEACHER SOURCE NOTES:
...

COLLECTIVE THINKING NOTES:
...`;
}

function nounPairPrompt(level) {
  return `Generate one fresh noun pair for a metaphorical thinking activity.

Student level:
${level}

Rules:
Return exactly two concrete or abstract nouns separated by " and ".
The nouns should be unlike each other but connectable through metaphor.
Keep it appropriate for the selected level.
Avoid mature, sensitive, violent, sexual, or disturbing content.
Do not include explanation, numbering, punctuation beyond the word "and", or extra text.

Examples of the format:
Bridge and Voice
Clock and Ocean`;
}

function parseGeneratedPair(text, level) {
  const cleaned = sanitizeText(text, 120).replace(/[.!,;:]+$/g, "");
  const parts = cleaned.split(/\s+and\s+/i).map((part) => sanitizeText(part, 40)).filter(Boolean);
  if (parts.length === 2 && parts[0] && parts[1]) return [titleCase(parts[0]), titleCase(parts[1])];
  const options = nounPairs[level] || nounPairs["Upper Elementary"];
  return options[Math.floor(Math.random() * options.length)];
}

function titleCase(value) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function memorySessionSummary(session) {
  return {
    code: session.code,
    noun1: session.noun1,
    noun2: session.noun2,
    level: session.level,
    createdAt: session.createdAt,
    classPoem: session.classPoem,
    students: Array.from(session.students.values()).map((student) => ({
      id: student.id,
      name: student.name,
      thoughts: student.thoughts,
      coachResponses: student.coachResponses,
      nudgeCount: student.nudgeCount,
      finalPiece: student.finalPiece
    }))
  };
}

async function generateUniqueCode() {
  const code = generateCode();
  const existing = await storage.getSession(code);
  return existing ? generateUniqueCode() : code;
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const response = await fetch(url, {
    ...options,
    headers: supabaseHeaders(options.headers || {})
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${details}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function dbSessionSummary(sessionRow, studentRows, thoughtRows) {
  const thoughtsByStudent = new Map();
  for (const thought of thoughtRows) {
    const items = thoughtsByStudent.get(thought.student_id) || [];
    items.push(thought);
    thoughtsByStudent.set(thought.student_id, items);
  }

  return {
    code: sessionRow.code,
    noun1: sessionRow.noun1,
    noun2: sessionRow.noun2,
    level: sessionRow.level,
    createdAt: sessionRow.created_at,
    classPoem: sessionRow.class_poem || "",
    students: studentRows.map((student) => {
      const thoughts = (thoughtsByStudent.get(student.id) || []).sort((a, b) => a.round - b.round);
      return {
        id: student.id,
        name: student.name,
        thoughts: thoughts.map((item) => item.text),
        coachResponses: thoughts.map((item) => item.coach_response).filter(Boolean),
        nudgeCount: student.nudge_count || 0,
        finalPiece: student.final_piece || ""
      };
    })
  };
}

const memoryStorage = {
  async getSession(code) {
    const session = sessions.get(code);
    return session ? memorySessionSummary(session) : null;
  },
  async createSession({ code, level, noun1, noun2 }) {
    const session = {
      id: randomUUID(),
      code,
      level,
      noun1,
      noun2,
      createdAt: new Date().toISOString(),
      classPoem: "",
      students: new Map()
    };
    sessions.set(code, session);
    return memorySessionSummary(session);
  },
  async joinSession({ code, name }) {
    const session = sessions.get(code);
    if (!session || !name) return null;
    const id = randomUUID();
    const student = { id, name, thoughts: [], coachResponses: [], nudgeCount: 0, finalPiece: "" };
    session.students.set(id, student);
    return { studentId: id, session: memorySessionSummary(session) };
  },
  async addThought({ code, studentId, thought, coach }) {
    const session = sessions.get(code);
    const student = session?.students.get(studentId);
    if (!session || !student || !thought) return null;
    if (student.thoughts.length < 3) student.thoughts.push(thought);
    if (coach) student.coachResponses.push(coach);
    return student;
  },
  async incrementNudge({ code, studentId }) {
    const session = sessions.get(code);
    const student = session?.students.get(studentId);
    if (!session || !student) return null;
    student.nudgeCount += 1;
    return student.nudgeCount;
  },
  async saveFinal({ code, studentId, finalPiece }) {
    const session = sessions.get(code);
    const student = session?.students.get(studentId);
    if (!session || !student || !finalPiece) return null;
    student.finalPiece = finalPiece;
    return student;
  },
  async saveClassPoem({ code, classPoem }) {
    const session = sessions.get(code);
    if (!session || !classPoem) return null;
    session.classPoem = classPoem;
    return memorySessionSummary(session);
  }
};

async function dbSessionByCode(code) {
  const sessionsFound = await supabaseRequest(`class_sessions?code=eq.${encodeURIComponent(code)}&select=*`);
  const session = sessionsFound[0];
  if (!session) return null;
  const students = await supabaseRequest(`session_students?session_id=eq.${session.id}&select=*&order=created_at.asc`);
  const studentIds = students.map((student) => student.id);
  const thoughts = studentIds.length
    ? await supabaseRequest(`student_thoughts?student_id=in.(${studentIds.join(",")})&select=*&order=round.asc`)
    : [];
  return dbSessionSummary(session, students, thoughts);
}

const supabaseStorage = {
  async getSession(code) {
    return dbSessionByCode(code);
  },
  async createSession({ code, level, noun1, noun2 }) {
    const rows = await supabaseRequest("class_sessions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([{ code, level, noun1, noun2 }])
    });
    return dbSessionSummary(rows[0], [], []);
  },
  async joinSession({ code, name }) {
    const sessionRows = await supabaseRequest(`class_sessions?code=eq.${encodeURIComponent(code)}&select=id`);
    const session = sessionRows[0];
    if (!session || !name) return null;
    const rows = await supabaseRequest("session_students", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([{ session_id: session.id, name }])
    });
    return { studentId: rows[0].id, session: await dbSessionByCode(code) };
  },
  async addThought({ code, studentId, thought, coach }) {
    const current = await supabaseRequest(`student_thoughts?student_id=eq.${encodeURIComponent(studentId)}&select=round&order=round.desc`);
    if (current.length >= 3) return null;
    const nextRound = Math.min(3, Number(current[0]?.round || 0) + 1);
    const rows = await supabaseRequest("student_thoughts", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([{ student_id: studentId, round: nextRound, text: thought, coach_response: coach || "" }])
    });
    return rows[0] ? (await dbSessionByCode(code))?.students.find((student) => student.id === studentId) : null;
  },
  async incrementNudge({ code, studentId }) {
    const rows = await supabaseRequest(`session_students?id=eq.${encodeURIComponent(studentId)}&select=nudge_count`);
    if (!rows[0]) return null;
    const next = Number(rows[0].nudge_count || 0) + 1;
    await supabaseRequest(`session_students?id=eq.${encodeURIComponent(studentId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ nudge_count: next })
    });
    return next;
  },
  async saveFinal({ code, studentId, finalPiece }) {
    await supabaseRequest(`session_students?id=eq.${encodeURIComponent(studentId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ final_piece: finalPiece })
    });
    return (await dbSessionByCode(code))?.students.find((student) => student.id === studentId) || null;
  },
  async saveClassPoem({ code, classPoem }) {
    await supabaseRequest(`class_sessions?code=eq.${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ class_poem: classPoem })
    });
    return dbSessionByCode(code);
  }
};

const storage = USE_SUPABASE ? supabaseStorage : memoryStorage;

async function api(req, res) {
  try {
    const body = await readJson(req);

    if (req.url === "/api/coach" && req.method === "POST") {
      const noun1 = sanitizeText(body.noun1, 80);
      const noun2 = sanitizeText(body.noun2, 80);
      const level = body.level === "High School" ? "High School" : "Upper Elementary";
      const currentThought = sanitizeText(body.currentThought, 700);
      const previousThoughts = sanitizeThoughts(body.previousThoughts);
      const round = roundNumber(body.round, previousThoughts);
      const text = await openAIText(coachPrompt({ noun1, noun2, level, currentThought, previousThoughts, round }), level);
      return json(res, 200, { text });
    }

    if (req.url === "/api/nudge" && req.method === "POST") {
      const noun1 = sanitizeText(body.noun1, 80);
      const noun2 = sanitizeText(body.noun2, 80);
      const level = body.level === "High School" ? "High School" : "Upper Elementary";
      const thoughts = sanitizeThoughts(body.thoughts);
      const text = await openAIText(nudgePrompt({ noun1, noun2, level, thoughts }), level);
      return json(res, 200, { text });
    }

    if (req.url === "/api/student-poem" && req.method === "POST") {
      const noun1 = sanitizeText(body.noun1, 80);
      const noun2 = sanitizeText(body.noun2, 80);
      const level = body.level === "High School" ? "High School" : "Upper Elementary";
      const thoughts = sanitizeThoughts(body.thoughts);
      const text = await openAIText(studentPoemPrompt({ noun1, noun2, level, thoughts }), level);
      return json(res, 200, { text });
    }

    if (req.url === "/api/class-poem" && req.method === "POST") {
      const noun1 = sanitizeText(body.noun1, 80);
      const noun2 = sanitizeText(body.noun2, 80);
      const level = body.level === "High School" ? "High School" : "Upper Elementary";
      const responses = sanitizeMultiline(body.responses, 12000);
      const variationFocus = sanitizeText(body.variationFocus, 220);
      const text = await openAIText(classPoemPrompt({ noun1, noun2, level, responses, variationFocus }), level);
      return json(res, 200, { text });
    }

    if (req.url === "/api/noun-pair" && req.method === "POST") {
      const level = body.level === "High School" ? "High School" : "Upper Elementary";
      const text = await openAIText(nounPairPrompt(level), level);
      return json(res, 200, { pair: parseGeneratedPair(text, level) });
    }

    if (req.url === "/api/sessions" && req.method === "POST") {
      const level = body.level === "High School" ? "High School" : "Upper Elementary";
      const code = await generateUniqueCode();
      const pair = Array.isArray(body.pair) ? body.pair : nounPairs[level][0];
      const session = await storage.createSession({
        code,
        level,
        noun1: sanitizeText(pair[0], 80),
        noun2: sanitizeText(pair[1], 80)
      });
      return json(res, 200, session);
    }

    if (req.url?.startsWith("/api/sessions/") && req.method === "GET") {
      const code = decodeURIComponent(req.url.split("/").pop() || "").toUpperCase();
      const session = await storage.getSession(code);
      if (!session) return json(res, 404, { error: "Session not found" });
      return json(res, 200, session);
    }

    if (req.url === "/api/join" && req.method === "POST") {
      const code = sanitizeText(body.code, 12).toUpperCase();
      const name = sanitizeText(body.name, 80);
      const joined = await storage.joinSession({ code, name });
      if (!joined) return json(res, 404, { error: "Session not found" });
      return json(res, 200, joined);
    }

    if (req.url === "/api/session-thought" && req.method === "POST") {
      const code = sanitizeText(body.code, 12).toUpperCase();
      const studentId = String(body.studentId || "");
      const thought = sanitizeText(body.thought, 700);
      const coach = sanitizeMultiline(body.coach, 1600);
      const student = await storage.addThought({ code, studentId, thought, coach });
      if (!student) return json(res, 404, { error: "Session not found" });
      return json(res, 200, { student });
    }

    if (req.url === "/api/session-nudge" && req.method === "POST") {
      const code = sanitizeText(body.code, 12).toUpperCase();
      const studentId = String(body.studentId || "");
      const nudgeCount = await storage.incrementNudge({ code, studentId });
      if (nudgeCount === null) return json(res, 404, { error: "Session not found" });
      return json(res, 200, { nudgeCount });
    }

    if (req.url === "/api/session-final" && req.method === "POST") {
      const code = sanitizeText(body.code, 12).toUpperCase();
      const studentId = String(body.studentId || "");
      const finalPiece = sanitizeMultiline(body.finalPiece, 2200);
      const student = await storage.saveFinal({ code, studentId, finalPiece });
      if (!student) return json(res, 404, { error: "Session not found" });
      return json(res, 200, { student });
    }

    if (req.url === "/api/session-class-poem" && req.method === "POST") {
      const code = sanitizeText(body.code, 12).toUpperCase();
      const classPoem = sanitizeMultiline(body.classPoem, 6000);
      const session = await storage.saveClassPoem({ code, classPoem });
      if (!session) return json(res, 404, { error: "Session not found" });
      return json(res, 200, session);
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: "Something went wrong. Try again." });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const rawPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, safePath);
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(content);
  } catch {
    const content = await readFile(join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(content);
  }
}

createServer((req, res) => {
  if (req.url?.startsWith("/api/")) return api(req, res);
  return serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`Class Thinking Lab running at http://localhost:${PORT}`);
  if (AI_TEST_MODE) {
    console.log("AI_TEST_MODE is on. Responses are local placeholders.");
  } else if (OPENAI_API_KEY) {
    console.log(`Live AI is on using ${OPENAI_MODEL}.`);
  } else {
    console.log("Live AI needs OPENAI_API_KEY. Add it to .env or your environment.");
  }
  console.log(USE_SUPABASE ? "Database storage is on using Supabase." : "Database storage is off. Using temporary in-memory sessions.");
});
