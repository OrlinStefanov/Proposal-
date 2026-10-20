"use strict";

/* ==========================================================================
   НАСТРОЙКИ — всичко, което се вижда на екрана, се променя тук.
   ========================================================================== */
const CONFIG = {
  name: "Ива",
  pageTitle: "Специално за Ива",

  gift: {
    kicker: "Специално за",
    button: "Отвори подаръка си",
    alt: "Кутия за подарък със златна панделка",
  },

  trip: {
    from: "София",
    to: "Рим",
    outbound: { date: "30 март 2027", depart: "18:55", arrive: "20:00" },
    back: { depart: "20:40", arrive: "23:35" },

    mapAlt: "Карта: полет от София до Рим",
    outboundLabel: "Полет за Рим",
    boarding: "Качваме се на борда",
    dayCounter: "Ден {n} от {total}",
    continueButton: "Продължи",

    days: [
      {
        num: "30",
        month: "март",
        title: "Кацане и Трастевере",
        text: "Кацаме в 20:00. Оставяме багажа и вечеряме в Трастевере, сред калдъръмени улички и светлини.",
      },
      {
        num: "31",
        month: "март",
        title: "Колизеум и Форум",
        text: "Сутрин в арената на гладиаторите, после из Римския форум и Палатинския хълм. Залез от високото.",
      },
      {
        num: "1",
        month: "април",
        title: "Ватикан и центърът",
        text: "Базиликата „Свети Петър“, а след това пеша до Пантеона, Пиаца Навона и Фонтана ди Треви. Хвърляме монета.",
      },
      {
        num: "2",
        month: "април",
        title: "Последно утро",
        text: "Бавно кафе, Испанските стъпала и последното джелато. Вечерта летим към дома.",
        showReturnFlight: true,
      },
    ],
  },

  ask: {
    kicker: "Покана за пътуване",
    question: "Идваш ли с мен в Рим?",
    yes: "Да",
    no: "Не",
    onlyYes: "Остава само един отговор.",
    celebrate: "Заминаваме!",
    celebrateSub: "Рим, 30 март – 2 април 2027",
  },

  // милисекунди
  timing: {
    giftOpen: 3000,     // колко стои отворената кутия преди картата
    intro: 900,         // пауза преди първия полет
    passRead: 1000,     // колко се чете часът на тръгване
    walk: 1700,         // вървене до стълбата
    climb: 1000,        // качване по стълбата
    takeoff: 1600,      // рулиране и излитане
    flight: 4500,       // продължителност на полета по картата (3000–5000)
    day: 3600,          // колко стои всеки ден
    beforeReturn: 1800, // пауза преди обратния полет
    end: 1500,          // пауза след кацането в София
  },

  noButton: {
    maxAttempts: 6,     // след толкова опита "Не" изчезва
    fleeRadius: 100,    // на какво разстояние (px) бяга от курсора
  },
};

/* ==========================================================================
   Помощни функции
   ========================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const isReduced = () => reducedQuery.matches;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SVG_NS = "http://www.w3.org/2000/svg";

const lookup = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function planeIcon(className) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", "#i-plane");
  svg.append(use);
  return svg;
}

function applyConfig() {
  document.title = CONFIG.pageTitle;
  document.querySelectorAll("[data-text]").forEach((node) => {
    node.textContent = lookup(CONFIG, node.dataset.text);
  });
  document.querySelectorAll("[data-aria]").forEach((node) => {
    node.setAttribute("aria-label", lookup(CONFIG, node.dataset.aria));
  });
}

function showScene(id) {
  document.querySelectorAll(".scene").forEach((s) => s.classList.toggle("active", s.id === id));
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function tween(ms, onFrame) {
  return new Promise((resolve) => {
    const start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / ms);
      onFrame(p);
      if (p < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

/* ==========================================================================
   1. Подаръкът
   ========================================================================== */
function initGift() {
  const button = $("#openBtn");
  button.addEventListener("click", async () => {
    button.disabled = true;
    $("#gift").classList.add("opened");
    await sleep(isReduced() ? 1200 : CONFIG.timing.giftOpen);
    showScene("scene-trip");
    runTrip();
  });
}

/* ==========================================================================
   2. Пътуването
   ========================================================================== */
const map = {
  route: null,
  length: 0,
  plane: null,
  shadow: null,
  mask: null,
  bright: null,
};

function initMap() {
  map.route = $("#route");
  map.length = map.route.getTotalLength();
  map.plane = $("#plane");
  map.shadow = $("#planeShadow");
  map.mask = $("#trailMask");
  map.bright = $("#routeBright");
  // самолетът започва в София
  placePlane(0, 1);
  setTrail(0, 1);
}

// t: 0 = София, 1 = Рим; dir: 1 към Рим, -1 обратно към София
function placePlane(t, dir) {
  const at = (u) => map.route.getPointAtLength(map.length * Math.min(1, Math.max(0, u)));
  const p = at(t);
  const a = at(t - 0.01);
  const b = at(t + 0.01);
  let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (dir < 0) angle += 180;

  const lift = Math.sin(Math.PI * t); // най-високо по средата на пътя
  const scale = 0.62 + 0.5 * lift;
  const sx = p.x + 7 * lift;
  const sy = p.y + 12 * lift;

  map.plane.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${angle}) scale(${scale})`);
  map.shadow.setAttribute("transform", `translate(${sx} ${sy}) rotate(${angle}) scale(${scale * 0.92})`);
  map.shadow.setAttribute("opacity", (0.34 - 0.16 * lift).toFixed(2));
}

// показва пътеката, която самолетът вече е изминал
function setTrail(t, dir) {
  const L = map.length;
  const d = L * t;
  map.mask.setAttribute(
    "stroke-dasharray",
    dir > 0 ? `${d} ${L * 2}` : `0 ${d} ${L - d} ${L}`
  );
}

const bd = {};

function initBoarding() {
  ["boarding", "bPlane", "bStairs", "bPerson", "bLegL", "bLegR", "bDoor", "bLine"].forEach((id) => {
    bd[id] = $("#" + id);
  });
}

function setPerson(x, y, phase) {
  const swing = Math.sin(phase) * 5.5;
  const bob = Math.abs(Math.sin(phase)) * 1.3;
  bd.bPerson.setAttribute("transform", `translate(${x} ${y - bob})`);
  bd.bLegL.setAttribute("d", `M0-11L${swing} 0`);
  bd.bLegR.setAttribute("d", `M0-11L${-swing} 0`);
}

async function boardPlane() {
  const T = CONFIG.timing;
  bd.bPlane.removeAttribute("transform");
  bd.bStairs.removeAttribute("transform");
  bd.bStairs.style.opacity = 1;
  bd.bPerson.style.opacity = 1;
  bd.bDoor.setAttribute("opacity", 0);
  setPerson(-16, 171, 0);
  bd.boarding.classList.add("show");
  await sleep(500);

  // пътникът върви до стълбата
  await tween(T.walk, (p) => setPerson(-16 + p * 219, 171, p * 219 / 6));
  // и се качва по нея
  await tween(T.climb, (p) => setPerson(203 + p * 41, 171 - p * 25, (219 + p * 48) / 6));
  // влиза през вратата
  await tween(300, (p) => {
    bd.bPerson.style.opacity = 1 - p;
    bd.bDoor.setAttribute("opacity", p);
  });
  await sleep(250);
  // стълбата се отдръпва
  await tween(600, (p) => {
    bd.bStairs.setAttribute("transform", `translate(${-70 * p} 0)`);
    bd.bStairs.style.opacity = 1 - p;
  });
  bd.bDoor.setAttribute("opacity", 0);
  await sleep(250);
  // рулиране и излитане
  let line = 0;
  await tween(T.takeoff, (p) => {
    const k = p * p;
    const lift = Math.max(0, (p - 0.55) / 0.45);
    const tx = k * 330;
    const ty = -lift * lift * 70;
    const rot = -lift * 16;
    bd.bPlane.setAttribute("transform", `translate(${tx} ${ty}) rotate(${rot} 312 166)`);
    line -= 2 + p * 30;
    bd.bLine.setAttribute("stroke-dashoffset", line);
  });
  bd.boarding.classList.remove("show");
  await sleep(500);
}

async function fly(dir) {
  const ms = CONFIG.timing.flight;
  if (dir < 0) {
    map.bright.style.opacity = 0;
    await sleep(520);
    setTrail(1, -1);
    map.bright.style.opacity = 1;
  }
  await tween(ms, (p) => {
    const t = dir > 0 ? easeInOut(p) : 1 - easeInOut(p);
    placePlane(t, dir);
    setTrail(t, dir);
  });
}

function pulse(cityId) {
  const city = $(cityId);
  city.classList.remove("pulse");
  void city.getBoundingClientRect(); // рестарт на анимацията
  city.classList.add("pulse");
}

function flightText(f, a, b, withDate) {
  return `${withDate ? f.date + ", " : ""}${f.depart} ${a} → ${f.arrive} ${b}`;
}

function addPass(list) {
  const { from, to, outbound, outboundLabel } = CONFIG.trip;
  const li = el("li", "pass");
  li.append(planeIcon("pass-icon"));

  const text = el("div");
  text.append(el("p", "pass-label", outboundLabel));

  const line = el("p", "pass-line");
  line.append(
    `${outbound.date}, `,
    el("b", null, outbound.depart),
    ` ${from} → `,
    el("b", null, outbound.arrive),
    ` ${to}`
  );
  text.append(line);
  li.append(text);
  list.append(li);
  return li;
}

function addDay(list, day) {
  const { from, to, back } = CONFIG.trip;
  const li = el("li", "day");
  const inner = el("div", "day-in");

  const date = el("div", "day-date");
  date.append(el("span", "day-num", day.num), el("span", "day-mon", day.month));

  const body = el("div", "day-body");
  body.append(el("h3", "day-title", day.title), el("p", "day-text", day.text));

  if (day.showReturnFlight) {
    const flight = el("p", "day-flight");
    flight.append(planeIcon(""), flightText(back, to, from, false));
    body.append(flight);
  }

  inner.append(date, body);
  li.append(inner);
  list.append(li);
  return li;
}

function renderCounter(counter, n) {
  const total = CONFIG.trip.days.length;
  counter.textContent = "";
  CONFIG.trip.dayCounter.split(/(\{n\})/).forEach((part) => {
    if (part === "{n}") counter.append(el("b", null, n));
    else counter.append(part.replace("{total}", total));
  });
  counter.hidden = false;
}

function scrollToEnd(list) {
  list.scrollTo({ top: list.scrollHeight, behavior: isReduced() ? "auto" : "smooth" });
}

async function runTrip() {
  const T = CONFIG.timing;
  const list = $("#timeline");
  const counter = $("#dayCount");

  if (isReduced()) {
    // без движение: всичко е на екрана наведнъж
    addPass(list);
    CONFIG.trip.days.forEach((d) => addDay(list, d));
    renderCounter(counter, CONFIG.trip.days.length);
    placePlane(1, 1);
    setTrail(1, 1);
    const next = $("#continueBtn");
    next.hidden = false;
    next.addEventListener("click", () => showScene("scene-ask"), { once: true });
    return;
  }

  await sleep(T.intro);
  addPass(list);
  await sleep(T.passRead);

  await boardPlane();
  await fly(1);
  pulse("#cityRome");

  for (let i = 0; i < CONFIG.trip.days.length; i++) {
    renderCounter(counter, i + 1);
    addDay(list, CONFIG.trip.days[i]);
    scrollToEnd(list);
    await sleep(T.day);
  }

  await sleep(T.beforeReturn);
  await boardPlane();
  await fly(-1);
  pulse("#citySofia");

  await sleep(T.end);
  showScene("scene-ask");
}

/* ==========================================================================
   3. Въпросът
   ========================================================================== */
function initAsk() {
  const yes = $("#yesBtn");
  const no = $("#noBtn");
  const note = $("#askNote");
  const { maxAttempts, fleeRadius } = CONFIG.noButton;

  let attempts = 0;
  let lastDodge = 0;
  let tx = 0;
  let ty = 0;
  let gone = false;
  let base = null; // център на бутона без трансформации

  const centerNow = () => {
    const r = no.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  function resetPosition() {
    tx = 0;
    ty = 0;
    base = null;
    no.style.transform = "";
  }

  function dodge(px, py) {
    if (gone) return;
    const now = performance.now();
    if (now - lastDodge < 250) return; // един допир = един опит
    lastDodge = now;
    if (!base) base = centerNow();
    attempts += 1;

    if (attempts >= maxAttempts) {
      gone = true;
      no.style.transform = `translate(${tx}px, ${ty}px) scale(0)`;
      no.classList.add("gone");
      no.disabled = true;
      note.textContent = CONFIG.ask.onlyYes;
      yes.classList.add("solo");
      setTimeout(() => no.remove(), 700);
      return;
    }

    const scale = Math.max(0.28, 1 - attempts * 0.13);
    const w = no.offsetWidth * scale;
    const h = no.offsetHeight * scale;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 14;
    const yr = yes.getBoundingClientRect();

    let best = null;
    let bestDist = -1;
    for (let i = 0; i < 48; i++) {
      const cx = pad + w / 2 + Math.random() * Math.max(1, vw - 2 * pad - w);
      const cy = pad + h / 2 + Math.random() * Math.max(1, vh - 2 * pad - h);
      const hitsYes =
        cx + w / 2 > yr.left - 18 && cx - w / 2 < yr.right + 18 &&
        cy + h / 2 > yr.top - 18 && cy - h / 2 < yr.bottom + 18;
      if (hitsYes) continue;
      const dist = Math.hypot(cx - px, cy - py);
      if (dist > bestDist) {
        bestDist = dist;
        best = { x: cx, y: cy };
      }
    }
    if (!best) best = { x: base.x, y: base.y - 90 };

    tx = best.x - base.x;
    ty = best.y - base.y;
    no.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  // мишка: бяга, когато курсорът се приближи
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || gone) return;
    if (!$("#scene-ask").classList.contains("active")) return;
    if (performance.now() - lastDodge < 300) return;
    const c = centerNow();
    const reach = fleeRadius + (no.offsetWidth * 0.5);
    if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < reach) dodge(e.clientX, e.clientY);
  });

  // допир (и всякакъв друг натиск): смалява се и отскача
  no.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dodge(e.clientX, e.clientY);
  });

  // клавиатура: Enter/Space също не работят
  no.addEventListener("click", (e) => {
    e.preventDefault();
    if (e.detail === 0) {
      const c = centerNow();
      dodge(c.x, c.y);
    }
  });

  window.addEventListener("resize", () => {
    if (!gone) resetPosition();
  });

  yes.addEventListener("click", () => {
    const main = $("#askMain");
    const r = yes.getBoundingClientRect();
    const origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    main.classList.add("leaving");
    setTimeout(() => {
      main.hidden = true;
      main.style.display = "none";
      $("#celebrate").hidden = false;
    }, isReduced() ? 0 : 420);
    launchConfetti(origin);
  });
}

/* ==========================================================================
   Конфети
   ========================================================================== */
function launchConfetti(origin) {
  if (isReduced()) return;

  const canvas = $("#confetti");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0;
  let h = 0;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  const colors = ["#c4583a", "#e2b25a", "#f3d58d", "#f6e8cb", "#dd7a52", "#5b84c4", "#ffffff"];
  const pieces = [];

  function spawn(x, y, vx, vy) {
    pieces.push({
      x, y, vx, vy,
      size: 6 + Math.random() * 7,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      flip: Math.random() * Math.PI * 2,
      vf: 0.08 + Math.random() * 0.12,
      round: Math.random() < 0.22,
    });
  }

  // взрив от бутона
  for (let i = 0; i < 150; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15;
    const s = 7 + Math.random() * 11;
    spawn(origin.x, origin.y, Math.cos(a) * s, Math.sin(a) * s);
  }

  const start = performance.now();
  let last = start;

  function frame(now) {
    const dt = Math.min(2.2, (now - last) / 16.67);
    last = now;
    const elapsed = now - start;

    // дъжд отгоре първите ~3 секунди
    if (elapsed < 3200) {
      for (let i = 0; i < 2; i++) spawn(Math.random() * w, -12, (Math.random() - 0.5) * 2, 2 + Math.random() * 2);
    }

    ctx.clearRect(0, 0, w, h);
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      p.vy += 0.26 * dt;
      p.vx *= Math.pow(0.985, dt);
      p.vy *= Math.pow(0.992, dt);
      p.x += p.vx * dt + Math.sin(p.flip) * 0.6;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;

      if (p.y > h + 30) {
        pieces.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.flip));
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }

    if (pieces.length || elapsed < 3200) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, w, h);
      window.removeEventListener("resize", resize);
    }
  }
  requestAnimationFrame(frame);
}

/* ==========================================================================
   Старт
   ========================================================================== */
applyConfig();
initMap();
initBoarding();
initGift();
initAsk();
