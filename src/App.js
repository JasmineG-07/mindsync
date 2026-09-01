import { useState, useEffect, useRef } from "react";
import {
  auth, signInWithGoogle, signOutUser, saveDeck, getUserDecks, deleteDeck,
  createClass, joinClassByCode, getUserClasses, leaveClass, deleteClass,
  shareDeckToClass, getClassDecks, deleteClassDeck,
} from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import JSZip from "jszip";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const globalStyles = `
  @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(99,140,255,0.4); } 50% { box-shadow: 0 0 0 8px rgba(99,140,255,0); } }
  @keyframes cardEntrance { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes glow { 0%,100% { opacity:0.5; } 50% { opacity:0.8; } }
  @keyframes streakPop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
  @keyframes typing { 0%,60%,100% { opacity: 0.3; } 30% { opacity: 1; } }
  * { box-sizing: border-box; }
  .mini-card-hover:hover { transform: translateY(-2px); border-color: rgba(99,140,255,0.4) !important; }
  .mini-card-hover { transition: transform 0.2s ease, border-color 0.2s ease; }
  .generate-btn-loading { animation: pulse 1.2s ease-in-out infinite; }
  .upload-zone:hover { border-color: rgba(99,140,255,0.5) !important; background: rgba(99,140,255,0.05) !important; }
  .upload-zone.dragging { border-color: #638cff !important; background: rgba(99,140,255,0.08) !important; }
  .nav-link:hover { color: #e8e8ff !important; }
  .feature-card { transition: all 0.25s ease; }
  .feature-card:hover { transform: translateY(-4px); border-color: rgba(99,140,255,0.3) !important; background: rgba(99,140,255,0.05) !important; }
  .deck-card { transition: all 0.2s ease; }
  .deck-card:hover { border-color: rgba(99,140,255,0.3) !important; transform: translateY(-2px); }
  .icon-btn:hover { background: rgba(255,255,255,0.08) !important; }
  .icon-btn { transition: background 0.15s ease; }
  textarea:focus { outline: none; border-color: rgba(99,140,255,0.4) !important; }
  input:focus { outline: none; border-color: rgba(99,140,255,0.4) !important; }
  .public-card:hover { border-color: rgba(99,140,255,0.3) !important; transform: translateY(-2px); }
  .public-card { transition: all 0.2s ease; }
  .cta-btn:hover { background: #7a9fff !important; }
  .cta-btn { transition: background 0.2s ease; }
  .quiz-opt { transition: all 0.15s ease; }
  .quiz-opt:hover { border-color: rgba(99,140,255,0.5) !important; background: rgba(99,140,255,0.06) !important; }
  .dot1 { animation: typing 1.2s infinite 0s; }
  .dot2 { animation: typing 1.2s infinite 0.2s; }
  .dot3 { animation: typing 1.2s infinite 0.4s; }
`;

const C = {
  bg: "#080c14", bgCard: "rgba(255,255,255,0.03)", bgInput: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.08)", accent: "#638cff", accentDim: "rgba(99,140,255,0.12)",
  accentBorder: "rgba(99,140,255,0.3)", textPrimary: "#e8e8ff", textSecondary: "#7a8faa",
  textDim: "#3a4a6a", navBg: "rgba(8,12,20,0.85)", footerBg: "#050810",
  green: "rgba(100,200,100,0.15)", greenBorder: "rgba(100,200,100,0.35)", greenText: "#90d090",
  red: "rgba(200,80,80,0.15)", redBorder: "rgba(200,80,80,0.35)", redText: "#e08080",
  amber: "rgba(255,180,60,0.12)", amberBorder: "rgba(255,180,60,0.3)", amberText: "#ffb43c",
  modalBg: "#111827",
};

const PUBLIC_DECKS = [
  { id: "p1", name: "Biology 101", topic: "Science", author: "jasmine_g", saves: 142, cards: [{q:"What is mitosis?",a:"Cell division producing two identical daughter cells"},{q:"What is DNA?",a:"Deoxyribonucleic acid, the molecule carrying genetic information"},{q:"What is photosynthesis?",a:"Process by which plants convert sunlight into chemical energy"}] },
  { id: "p2", name: "World War II", topic: "History", author: "history_buff", saves: 89, cards: [{q:"When did WWII start?",a:"September 1, 1939"},{q:"What was D-Day?",a:"The Allied invasion of Normandy on June 6, 1944"},{q:"Who led the US for most of WWII?",a:"Franklin D. Roosevelt"}] },
  { id: "p3", name: "Python Basics", topic: "Computer Science", author: "coder_pro", saves: 203, cards: [{q:"What is a list in Python?",a:"An ordered, mutable collection of items"},{q:"What does len() do?",a:"Returns the number of items in an object"},{q:"What is a dictionary?",a:"An unordered collection of key-value pairs"}] },
  { id: "p4", name: "Calculus Fundamentals", topic: "Math", author: "math_nerd", saves: 176, cards: [{q:"What is a derivative?",a:"The rate of change of a function at a given point"},{q:"What is an integral?",a:"The area under a curve, or the antiderivative of a function"},{q:"What is a limit?",a:"The value a function approaches as the input approaches some value"}] },
  { id: "p5", name: "Spanish Vocabulary", topic: "Languages", author: "lingua_pro", saves: 95, cards: [{q:"How do you say hello in Spanish?",a:"Hola"},{q:"How do you say thank you?",a:"Gracias"},{q:"How do you say goodbye?",a:"Adios"}] },
  { id: "p6", name: "Economics 101", topic: "Economics", author: "econ_fan", saves: 118, cards: [{q:"What is GDP?",a:"Gross Domestic Product, the total value of goods and services produced"},{q:"What is inflation?",a:"The rate at which the general price level rises over time"},{q:"What is supply and demand?",a:"The relationship between product availability and consumer desire"}] },
];

const TOPICS = ["All", "Science", "History", "Computer Science", "Math", "Languages", "Economics"];
const DIFFICULTIES = [
  { key: "beginner", label: "Beginner", desc: "Definitions and basic recall" },
  { key: "intermediate", label: "Intermediate", desc: "Recall plus understanding" },
  { key: "advanced", label: "Advanced", desc: "Application and reasoning" },
];

function parseJSON(text) {
  const clean = String(text).replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

class ApiError extends Error {
  constructor(message, status, retryable) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

function messageForStatus(status, detail) {
  if (detail) return detail;
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (status === 402) return "The AI account is out of credits.";
  if (status === 503) return "The AI service is unavailable right now.";
  if (status === 504) return "The request timed out. Try again.";
  if (status === 502) return "The AI returned an unexpected response. Try again.";
  if (status >= 500) return "Server error. Try again in a moment.";
  if (status === 400) return "That request was not valid. Check your input.";
  return `Request failed (${status}).`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postJSON(path, body, { retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      lastError = new ApiError("Could not reach the server. Is the backend running?", 0, true);
      if (attempt < retries) { await sleep(600 * (attempt + 1)); continue; }
      throw lastError;
    }

    if (res.ok) return await res.json();

    let detail = null;
    try { const j = await res.json(); detail = j.detail || null; } catch { /* body not json */ }

    const retryable = res.status === 429 || res.status === 502 || res.status === 504 || res.status >= 500;
    lastError = new ApiError(messageForStatus(res.status, detail), res.status, retryable);

    if (retryable && attempt < retries) {
      await sleep(res.status === 429 ? 2000 * (attempt + 1) : 600 * (attempt + 1));
      continue;
    }
    throw lastError;
  }
  throw lastError;
}

async function extractTextFromFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "txt") return await file.text();
  if (ext === "pdf") {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((x) => x.str).join(" ") + "\n";
    }
    return text;
  }
  if (ext === "docx") { const ab = await file.arrayBuffer(); const r = await mammoth.extractRawText({ arrayBuffer: ab }); return r.value; }
  if (ext === "pptx") {
    const ab = await file.arrayBuffer(); const zip = await JSZip.loadAsync(ab); let text = "";
    const slides = Object.keys(zip.files).filter((n) => n.startsWith("ppt/slides/slide") && n.endsWith(".xml"));
    for (const s of slides) { const xml = await zip.files[s].async("text"); const m = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || []; text += m.map((x) => x.replace(/<[^>]+>/g, "")).join(" ") + "\n"; }
    return text;
  }
  if (["png","jpg","jpeg","webp"].includes(ext)) return null;
  throw new Error("Unsupported");
}

function fileToBase64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
}

function exportCSV(cards, name = "mindsync-deck") {
  const rows = [["Question","Answer"], ...cards.map((c) => [`"${c.q.replace(/"/g,'""')}"`,`"${c.a.replace(/"/g,'""')}"`])];
  const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(url);
}

function exportJSON(cards, name = "mindsync-deck") {
  const blob = new Blob([JSON.stringify(cards, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${name}.json`; a.click(); URL.revokeObjectURL(url);
}

function getStreak() {
  try { const s = localStorage.getItem("ms_streak"); return s ? JSON.parse(s) : { count: 0, lastDate: null }; }
  catch { return { count: 0, lastDate: null }; }
}

function updateStreak() {
  const today = new Date().toDateString();
  const streak = getStreak();
  if (streak.lastDate === today) return streak.count;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const newCount = streak.lastDate === yesterday ? streak.count + 1 : 1;
  localStorage.setItem("ms_streak", JSON.stringify({ count: newCount, lastDate: today }));
  return newCount;
}

function Spinner({ label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: C.textSecondary }}>
      {label}
      <span className="dot1">.</span><span className="dot2">.</span><span className="dot3">.</span>
    </span>
  );
}

function Footer() {
  return (
    <footer style={{ background: C.footerBg, borderTop: `0.5px solid ${C.border}`, padding: "3rem 2rem 2rem", marginTop: "4rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "2rem", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: C.bg, fontSize: 13, fontWeight: 700 }}>M</div>
            <span style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary }}>MindSync</span>
          </div>
          <p style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7, margin: 0 }}>AI-powered flashcard generator for students and lifelong learners.</p>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Product</div>
          {["Home","Explore","My Decks","Classes","Settings"].map((l) => <div key={l} style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>{l}</div>)}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>AI features</div>
          {["Quiz mode","AI tutor","Weak spot analysis","Adaptive difficulty"].map((l) => <div key={l} style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>{l}</div>)}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Built with</div>
          {["React","FastAPI","Claude AI","Firebase"].map((l) => <div key={l} style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>{l}</div>)}
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", borderTop: `0.5px solid ${C.border}`, paddingTop: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 12, color: C.textDim }}>© 2026 MindSync. All rights reserved.</span>
        <span style={{ fontSize: 12, color: C.textDim }}>Built by Jasmine</span>
      </div>
    </footer>
  );
}

function Navbar({ page, setPage, user, streak }) {
  return (
    <nav style={{ background: C.navBg, backdropFilter: "blur(12px)", borderBottom: `0.5px solid ${C.border}`, padding: "0 2rem", position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", height: 60, gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginRight: 14 }} onClick={() => setPage("Home")}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: C.bg, fontSize: 14, fontWeight: 700 }}>M</div>
          <span style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary }}>MindSync</span>
        </div>
        {["Home","Explore","My Decks","Classes","Settings"].map((p) => (
          <button key={p} className="nav-link" onClick={() => setPage(p)}
            style={{ fontSize: 13, color: page === p ? C.textPrimary : C.textSecondary, background: page === p ? C.accentDim : "transparent", border: "none", cursor: "pointer", padding: "6px 12px", borderRadius: 8, transition: "all 0.2s" }}>{p}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {streak > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: C.amber, border: `0.5px solid ${C.amberBorder}`, borderRadius: 20, padding: "4px 10px", animation: "streakPop 0.3s ease" }}>
              <span style={{ fontSize: 13 }}>🔥</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: C.amberText }}>{streak} day streak</span>
            </div>
          )}
          {user && <span style={{ fontSize: 13, color: C.textSecondary }}>{user.displayName?.split(" ")[0]}</span>}
          {user && <button onClick={signOutUser} style={{ fontSize: 12, color: C.textDim, background: "none", border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "5px 14px", cursor: "pointer" }}>Sign out</button>}
        </div>
      </div>
    </nav>
  );
}

function LandingPage({ onSignIn }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,140,255,0.12) 0%, transparent 70%)", top: "8%", left: "50%", transform: "translateX(-50%)", pointerEvents: "none", animation: "glow 4s ease-in-out infinite" }} />
      <div style={{ position: "fixed", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,140,255,0.08) 0%, transparent 70%)", bottom: "18%", right: "8%", pointerEvents: "none" }} />

      <nav style={{ background: "rgba(8,12,20,0.7)", backdropFilter: "blur(12px)", borderBottom: `0.5px solid ${C.border}`, padding: "0 2rem", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", height: 60, gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: C.bg, fontSize: 14, fontWeight: 700 }}>M</div>
          <span style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary }}>MindSync</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={onSignIn} style={{ fontSize: 13, color: C.textSecondary, background: "none", border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "6px 16px", cursor: "pointer" }}>Sign in</button>
            <button onClick={onSignIn} className="cta-btn" style={{ fontSize: 13, color: C.bg, background: C.accent, border: "none", borderRadius: 20, padding: "6px 18px", cursor: "pointer", fontWeight: 500 }}>Get started</button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 2rem", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", padding: "7rem 0 5rem" }}>
          <div style={{ display: "inline-block", background: C.accentDim, border: `0.5px solid ${C.accentBorder}`, borderRadius: 20, padding: "5px 16px", fontSize: 12, color: C.accent, marginBottom: "1.5rem", fontWeight: 500 }}>Powered by Claude AI</div>
          <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 700, color: C.textPrimary, lineHeight: 1.1, marginBottom: "1.5rem" }}>
            Turn any notes into<br /><span style={{ color: C.accent }}>flashcards instantly</span>
          </h1>
          <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: C.textSecondary, lineHeight: 1.8, maxWidth: 580, margin: "0 auto 2.5rem" }}>
            Upload PDFs, Word docs, slides, or paste your notes. MindSync generates flashcards, quizzes you, explains what you miss, and builds targeted practice for your weak spots.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
            <button onClick={onSignIn} className="cta-btn" style={{ fontSize: 15, color: C.bg, background: C.accent, border: "none", borderRadius: 24, padding: "14px 36px", cursor: "pointer", fontWeight: 600 }}>Get started free</button>
            <button onClick={onSignIn} style={{ fontSize: 15, color: C.textPrimary, background: "none", border: `0.5px solid ${C.border}`, borderRadius: 24, padding: "14px 36px", cursor: "pointer" }}>Browse public decks</button>
          </div>
          <div style={{ fontSize: 12, color: C.textDim }}>No credit card required · Free to use</div>
        </div>

        <div style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "2rem", marginBottom: "5rem", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)` }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1.5rem" }}>
            {[{n:"7",l:"AI features"},{n:"7",l:"File formats"},{n:"< 10s",l:"Generation time"},{n:"Free",l:"Always"}].map((s) => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.accent, marginBottom: 4 }}>{s.n}</div>
                <div style={{ fontSize: 13, color: C.textSecondary }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: 32, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>Seven AI features that actually help</h2>
            <p style={{ fontSize: 16, color: C.textSecondary, margin: 0 }}>Not just card generation. A full study system.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
            {[
              { icon: "\u{1F9E0}", title: "Generate from anything", desc: "Upload a PDF, Word doc, slide deck, text file, or a photo of your notes. The text gets pulled out and turned into cards." },
              { icon: "\u{1F3AF}", title: "Difficulty control", desc: "Choose beginner, intermediate, or advanced. The AI changes how it writes questions to match." },
              { icon: "\u{1F3F7}\uFE0F", title: "Auto naming and tagging", desc: "AI reads your deck and suggests a name and subject tag so you never stare at a blank field." },
              { icon: "\u{1F4AC}", title: "AI tutor per card", desc: "Stuck on a card? Ask follow-up questions and get plain-language explanations with examples." },
              { icon: "\u{1F4DD}", title: "Quiz mode with grading", desc: "Turn any deck into a quiz. Type your answers and get graded with real feedback, not just right or wrong." },
              { icon: "\u{1F4CA}", title: "Weak spot detection", desc: "AI analyzes what you got wrong, names the concept gap, and generates targeted practice cards." },
              { icon: "\u26A1", title: "Adaptive difficulty", desc: "Too easy or too hard? One click rewrites the card at a different level, same concept." },
              { icon: "\u{1F465}", title: "Class groups", desc: "Create a class, share the join code, and everyone studies from the same set of decks." },
            ].map((f) => (
              <div key={f.title} className="feature-card" style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.5rem" }}>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: 32, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>How it works</h2>
            <p style={{ fontSize: 16, color: C.textSecondary, margin: 0 }}>From notes to mastery in five steps</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
            {[
              { n: "1", title: "Upload or paste", desc: "Drop in a file or paste your notes, pick a difficulty, and choose how many cards you want." },
              { n: "2", title: "Review before saving", desc: "Every card lands in a review screen first. Approve, rewrite, delete, or ask for an easier version." },
              { n: "3", title: "Study the deck", desc: "Flip through full-size cards, jump around the grid, and open the tutor on anything confusing." },
              { n: "4", title: "Quiz yourself", desc: "Multiple choice or written answers. Written answers get graded with a score and feedback." },
              { n: "5", title: "Fix the gaps", desc: "After a quiz, the AI names what you are struggling with and builds targeted practice cards." },
            ].map((s) => (
              <div key={s.n} style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.5rem" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.accentDim, border: `0.5px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: C.accent, marginBottom: 14 }}>{s.n}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: 32, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>Study together</h2>
            <p style={{ fontSize: 16, color: C.textSecondary, margin: 0 }}>Classes let a whole study group share one set of decks</p>
          </div>
          <div style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "2.5rem 2rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2rem", alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 20, marginBottom: 10 }}>{"\u{1F511}"}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, marginBottom: 8 }}>Create with a code</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>Name your class and get a short join code like CIS-4X7K. Send it to your classmates.</div>
              </div>
              <div>
                <div style={{ fontSize: 20, marginBottom: 10 }}>{"\u{1F4E4}"}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, marginBottom: 8 }}>Share your decks</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>Push any deck you have made to the class. Everyone can study it and copy it to their own account.</div>
              </div>
              <div>
                <div style={{ fontSize: 20, marginBottom: 10 }}>{"\u{1F525}"}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, marginBottom: 8 }}>Keep your streak</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>Generate cards on consecutive days to build a streak and stay in the habit.</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <h2 style={{ fontSize: 32, fontWeight: 600, color: C.textPrimary, marginBottom: 8 }}>Common questions</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 720, margin: "0 auto" }}>
            {[
              { q: "What files can I upload?", a: "PDF, DOCX, PPTX, TXT, and images (PNG, JPG, WEBP). Text is extracted in your browser before anything is sent, so large files stay fast." },
              { q: "Do I have to use the AI cards as-is?", a: "No. Every generated set goes through a review screen where you can rewrite any question or answer, delete cards you do not want, or ask for an easier or harder version of a card." },
              { q: "How does written-answer grading work?", a: "You type your answer and the AI compares it to the expected answer. It gives partial credit when the meaning is right but the wording differs, plus a short explanation of what was missing." },
              { q: "Can I use my decks outside MindSync?", a: "Yes. Export any deck as CSV to open in Excel or Google Sheets, or as JSON to move it into another tool." },
              { q: "Is it free?", a: "Yes. Sign in with Google and everything is available. No card required." },
            ].map((f) => (
              <div key={f.q} style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "1.25rem 1.5rem" }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, marginBottom: 6 }}>{f.q}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.7 }}>{f.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "linear-gradient(135deg, rgba(99,140,255,0.1), rgba(99,140,255,0.04))", border: `0.5px solid ${C.accentBorder}`, borderRadius: 20, padding: "4rem 2rem", textAlign: "center", marginBottom: "4rem", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)` }} />
          <h2 style={{ fontSize: 32, fontWeight: 600, color: C.textPrimary, marginBottom: 12 }}>Ready to study smarter?</h2>
          <p style={{ fontSize: 16, color: C.textSecondary, marginBottom: "2rem" }}>Free to use. Sign in with Google and start in seconds.</p>
          <button onClick={onSignIn} className="cta-btn" style={{ fontSize: 15, color: C.bg, background: C.accent, border: "none", borderRadius: 24, padding: "14px 40px", cursor: "pointer", fontWeight: 600 }}>Get started for free</button>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function ReviewScreen({ cards, onConfirm, onBack }) {
  const [reviewed, setReviewed] = useState(cards.map((c) => ({ ...c, status: "pending" })));
  const [editingId, setEditingId] = useState(null);
  const [editQ, setEditQ] = useState(""); const [editA, setEditA] = useState("");
  const [adaptingId, setAdaptingId] = useState(null);

  function setStatus(id, s) { setReviewed((p) => p.map((c) => c.id === id ? { ...c, status: s } : c)); }
  function startEdit(card) { setEditingId(card.id); setEditQ(card.q); setEditA(card.a); }
  function saveEdit(id) { setReviewed((p) => p.map((c) => c.id === id ? { ...c, q: editQ, a: editA, status: "approved" } : c)); setEditingId(null); }

  async function adapt(card, direction) {
    setAdaptingId(card.id);
    try {
      const data = await postJSON("/adapt-card", { question: card.q, answer: card.a, direction });
      const newCard = parseJSON(data.card);
      setReviewed((p) => p.map((c) => c.id === card.id ? { ...c, q: newCard.q, a: newCard.a } : c));
    } catch (e) { alert(e.message || "Could not adapt that card."); }
    setAdaptingId(null);
  }

  const approved = reviewed.filter((c) => c.status === "approved").length;
  const pending = reviewed.filter((c) => c.status === "pending").length;
  const deleted = reviewed.filter((c) => c.status === "deleted").length;
  const keeping = approved + pending;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "2.5rem 2rem", animation: "fadeSlideIn 0.4s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ fontSize: 13, color: C.textDim, background: "none", border: "none", cursor: "pointer", padding: 0 }}>← Back</button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: C.textPrimary }}>Review your cards</div>
          <div style={{ fontSize: 13, color: C.textDim, marginTop: 2 }}>
            <span style={{ color: C.greenText }}>{approved} approved</span> · {pending} pending · <span style={{ color: C.redText }}>{deleted} deleted</span>
          </div>
        </div>
        {keeping > 0 && <button onClick={() => onConfirm(reviewed.filter((c) => c.status !== "deleted"))} style={{ marginLeft: "auto", padding: "10px 24px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Save {keeping} cards →</button>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {reviewed.map((card) => {
          const bg = card.status === "approved" ? C.green : card.status === "deleted" ? C.red : C.bgCard;
          const bd = card.status === "approved" ? C.greenBorder : card.status === "deleted" ? C.redBorder : C.border;
          return (
            <div key={card.id} style={{ background: bg, border: `0.5px solid ${bd}`, borderRadius: 12, padding: "1rem", opacity: card.status === "deleted" ? 0.5 : 1, transition: "all 0.2s ease" }}>
              {editingId === card.id ? (
                <div>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Question</div>
                  <textarea value={editQ} onChange={(e) => setEditQ(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, fontFamily: "system-ui", resize: "vertical", marginBottom: 8, minHeight: 60 }} />
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Answer</div>
                  <textarea value={editA} onChange={(e) => setEditA(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, fontFamily: "system-ui", resize: "vertical", marginBottom: 10, minHeight: 60 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => saveEdit(card.id)} style={{ padding: "6px 16px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ padding: "6px 16px", borderRadius: 20, border: `0.5px solid ${C.border}`, background: "none", color: C.textSecondary, fontSize: 13, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: C.textPrimary, marginBottom: 4, lineHeight: 1.5 }}>{card.q}</div>
                      <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>{card.a}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button className="icon-btn" title="Approve" onClick={() => setStatus(card.id, card.status === "approved" ? "pending" : "approved")}
                        style={{ width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${card.status === "approved" ? C.greenBorder : C.border}`, background: card.status === "approved" ? C.green : "transparent", color: card.status === "approved" ? C.greenText : C.textDim, cursor: "pointer", fontSize: 13 }}>✓</button>
                      <button className="icon-btn" title="Edit" onClick={() => startEdit(card)}
                        style={{ width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${C.border}`, background: "transparent", color: C.textDim, cursor: "pointer", fontSize: 12 }}>✏️</button>
                      <button className="icon-btn" title="Delete" onClick={() => setStatus(card.id, card.status === "deleted" ? "pending" : "deleted")}
                        style={{ width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${card.status === "deleted" ? C.redBorder : C.border}`, background: card.status === "deleted" ? C.red : "transparent", color: card.status === "deleted" ? C.redText : C.textDim, cursor: "pointer", fontSize: 12 }}>🗑</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
                    {adaptingId === card.id ? <Spinner label="Rewriting" /> : (
                      <>
                        <button onClick={() => adapt(card, "easier")} style={{ fontSize: 11, color: C.textSecondary, background: "none", border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "3px 10px", cursor: "pointer" }}>Make easier</button>
                        <button onClick={() => adapt(card, "harder")} style={{ fontSize: 11, color: C.textSecondary, background: "none", border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "3px 10px", cursor: "pointer" }}>Make harder</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TutorPanel({ card, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    askTutor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function askTutor(userText) {
    setLoading(true);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    if (userText) setMessages((p) => [...p, { role: "user", content: userText }]);
    try {
      const data = await postJSON("/explain-card", {
        question: card.q, answer: card.a,
        user_question: userText, history,
      });
      setMessages((p) => [...p, { role: "assistant", content: data.explanation }]);
    } catch (e) {
      setMessages((p) => [...p, { role: "assistant", content: e.message || "Could not reach the tutor." }]);
    }
    setLoading(false);
  }

  function send() {
    const t = input.trim();
    if (!t || loading) return;
    setInput("");
    askTutor(t);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 120, padding: "2rem", animation: "fadeIn 0.2s ease both" }}>
      <div style={{ background: C.modalBg, border: `0.5px solid ${C.border}`, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `0.5px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>💬</span>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary }}>AI tutor</div>
            <button onClick={onClose} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 8, border: `0.5px solid ${C.border}`, background: "none", color: C.textDim, cursor: "pointer", fontSize: 13 }}>✕</button>
          </div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 8, lineHeight: 1.5 }}>{card.q}</div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "user" ? C.accentDim : C.bgCard, border: `0.5px solid ${m.role === "user" ? C.accentBorder : C.border}`, borderRadius: 12, padding: "10px 14px", fontSize: 14, color: C.textPrimary, lineHeight: 1.6 }}>
              {m.content}
            </div>
          ))}
          {loading && <div style={{ alignSelf: "flex-start", padding: "10px 14px" }}><Spinner label="Thinking" /></div>}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: "1rem 1.5rem", borderTop: `0.5px solid ${C.border}`, display: "flex", gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask a follow-up question..."
            style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, fontFamily: "system-ui" }} />
          <button onClick={send} disabled={loading || !input.trim()} style={{ padding: "10px 20px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: loading || !input.trim() ? 0.5 : 1 }}>Send</button>
        </div>
      </div>
    </div>
  );
}

function FlashcardViewer({ cards, onDelete, onAdapt, showDelete = true, showTutor = true }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [tutorCard, setTutorCard] = useState(null);
  const [adapting, setAdapting] = useState(false);

  const safeIndex = Math.min(currentIndex, Math.max(0, cards.length - 1));
  const card = cards[safeIndex];
  const progress = cards.length ? Math.round(((safeIndex + 1) / cards.length) * 100) : 0;

  function navigate(dir) { const n = safeIndex + dir; if (n < 0 || n >= cards.length) return; setIsFlipped(false); setTimeout(() => setCurrentIndex(n), 150); }
  function jumpTo(i) { setIsFlipped(false); setTimeout(() => setCurrentIndex(i), 150); }

  async function handleAdapt(direction) {
    if (!onAdapt) return;
    setAdapting(true);
    await onAdapt(safeIndex, direction);
    setAdapting(false);
  }

  if (!card) return null;

  return (
    <div>
      {tutorCard && <TutorPanel card={tutorCard} onClose={() => setTutorCard(null)} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary }}>Deck · {cards.length} cards</span>
        <div style={{ flex: 1, minWidth: 60, height: 3, background: C.bgInput, borderRadius: 2, margin: "0 16px" }}>
          <div style={{ height: "100%", background: C.accent, borderRadius: 2, transition: "width 0.5s ease", width: `${progress}%` }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => navigate(-1)} disabled={safeIndex === 0} style={{ width: 32, height: 32, borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textSecondary, cursor: "pointer", fontSize: 16 }}>‹</button>
          <span style={{ fontSize: 13, color: C.textDim, minWidth: 44, textAlign: "center" }}>{safeIndex + 1} / {cards.length}</span>
          <button onClick={() => navigate(1)} disabled={safeIndex === cards.length - 1} style={{ width: 32, height: 32, borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textSecondary, cursor: "pointer", fontSize: 16 }}>›</button>
        </div>
      </div>

      <div style={{ width: "100%", perspective: 1400, cursor: "pointer", position: "relative", marginBottom: "1rem", animation: "cardEntrance 0.5s ease both" }} onClick={() => setIsFlipped((f) => !f)}>
        <div style={{ position: "relative", width: "100%", height: 300, transformStyle: "preserve-3d", transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1)", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
          <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", borderRadius: 16, border: `0.5px solid ${C.border}`, background: C.bgCard, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2.5rem" }}>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 18, padding: "4px 12px", borderRadius: 20, background: C.bgInput, color: C.textDim }}>Question</div>
            <div style={{ fontSize: 20, textAlign: "center", lineHeight: 1.6, color: C.textPrimary, maxWidth: 580 }}>{card.q}</div>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 20 }}>tap to reveal answer</div>
          </div>
          <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", borderRadius: 16, border: `0.5px solid ${C.accentBorder}`, background: "rgba(99,140,255,0.07)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2.5rem" }}>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 18, padding: "4px 12px", borderRadius: 20, background: C.accentDim, color: C.accent }}>Answer</div>
            <div style={{ fontSize: 20, textAlign: "center", lineHeight: 1.6, color: C.textPrimary, maxWidth: 580 }}>{card.a}</div>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 20 }}>tap to flip back</div>
          </div>
        </div>
        {showDelete && onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(safeIndex); setCurrentIndex(Math.max(0, safeIndex - (safeIndex === cards.length - 1 ? 1 : 0))); }}
            style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textDim, cursor: "pointer", fontSize: 14 }}>🗑</button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
        {showTutor && <button onClick={() => setTutorCard(card)} style={{ fontSize: 12, color: C.accent, background: C.accentDim, border: `0.5px solid ${C.accentBorder}`, borderRadius: 20, padding: "6px 14px", cursor: "pointer" }}>💬 Ask the tutor</button>}
        {onAdapt && (adapting ? <Spinner label="Rewriting card" /> : (
          <>
            <button onClick={() => handleAdapt("easier")} style={{ fontSize: 12, color: C.textSecondary, background: "none", border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "6px 14px", cursor: "pointer" }}>Too hard, simplify</button>
            <button onClick={() => handleAdapt("harder")} style={{ fontSize: 12, color: C.textSecondary, background: "none", border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "6px 14px", cursor: "pointer" }}>Too easy, go deeper</button>
          </>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
        {cards.map((c, i) => (
          <div key={c.id ?? i} className="mini-card-hover" onClick={() => jumpTo(i)}
            style={{ border: i === safeIndex ? `0.5px solid ${C.accent}` : `0.5px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", background: i === safeIndex ? C.accentDim : C.bgCard, cursor: "pointer", animation: `fadeSlideIn 0.3s ease ${i * 0.04}s both` }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.textPrimary, marginBottom: 4, lineHeight: 1.4 }}>{c.q}</div>
            <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4 }}>{c.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizMode({ cards, deckName, onExit }) {
  const [mode, setMode] = useState(null);
  const [quiz, setQuiz] = useState([]);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [written, setWritten] = useState("");
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState(null);
  const [results, setResults] = useState([]);
  const [finished, setFinished] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function startMultipleChoice() {
    setLoading(true); setMode("mc");
    try {
      const data = await postJSON("/build-quiz", { cards: cards.map((c) => ({ q: c.q, a: c.a })), mode: "multiple_choice" });
      setQuiz(parseJSON(data.quiz));
    } catch (e) { alert(e.message || "Could not build the quiz."); setMode(null); }
    setLoading(false);
  }

  function startWritten() { setMode("written"); setQuiz(cards.map((c) => ({ q: c.q, a: c.a }))); }

  function answerMC(optionIdx) {
    if (selected !== null) return;
    setSelected(optionIdx);
    const correct = optionIdx === quiz[idx].correct;
    setResults((p) => [...p, { q: quiz[idx].q, a: quiz[idx].options[quiz[idx].correct], correct }]);
  }

  async function submitWritten() {
    if (!written.trim() || grading) return;
    setGrading(true);
    try {
      const data = await postJSON("/grade-answer", { question: quiz[idx].q, correct_answer: quiz[idx].a, user_answer: written });
      const g = parseJSON(data.result);
      setGrade(g);
      setResults((p) => [...p, { q: quiz[idx].q, a: quiz[idx].a, correct: g.verdict === "correct", verdict: g.verdict }]);
    } catch (e) { alert(e.message || "Could not grade that answer."); }
    setGrading(false);
  }

  function next() {
    if (idx === quiz.length - 1) { setFinished(true); return; }
    setIdx((i) => i + 1); setSelected(null); setWritten(""); setGrade(null);
  }

  async function analyzeWeakness() {
    const missed = results.filter((r) => !r.correct).map((r) => ({ q: r.q, a: r.a }));
    if (!missed.length) return;
    setAnalyzing(true);
    try {
      const data = await postJSON("/analyze-weakness", { missed_cards: missed, deck_name: deckName || "this deck" });
      setAnalysis(parseJSON(data.analysis));
    } catch (e) { alert(e.message || "Could not run the analysis."); }
    setAnalyzing(false);
  }

  const correctCount = results.filter((r) => r.correct).length;
  const scorePct = results.length ? Math.round((correctCount / results.length) * 100) : 0;

  if (!mode) return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "2.5rem 2rem", animation: "fadeSlideIn 0.4s ease both" }}>
      <button onClick={onExit} style={{ fontSize: 13, color: C.textDim, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "1.5rem" }}>← Back to deck</button>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: C.textPrimary, marginBottom: 6 }}>Quiz yourself</h1>
      <p style={{ fontSize: 14, color: C.textSecondary, marginBottom: "2rem" }}>{cards.length} cards · pick a quiz format</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <button onClick={startMultipleChoice} className="feature-card" style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.5rem", cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>🔘</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 6 }}>Multiple choice</div>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>AI writes four plausible options per card. Fast to run through.</div>
        </button>
        <button onClick={startWritten} className="feature-card" style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.5rem", cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>✍️</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 6 }}>Written answers</div>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>Type your answer and get graded with real feedback, not just right or wrong.</div>
        </button>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "5rem 2rem", textAlign: "center" }}>
      <Spinner label="Building your quiz" />
    </div>
  );

  if (finished) return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2.5rem 2rem", animation: "fadeSlideIn 0.4s ease both" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: scorePct >= 70 ? C.greenText : scorePct >= 40 ? C.amberText : C.redText, marginBottom: 4 }}>{scorePct}%</div>
        <div style={{ fontSize: 15, color: C.textSecondary }}>{correctCount} of {results.length} correct</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "2rem" }}>
        {results.map((r, i) => (
          <div key={i} style={{ background: r.correct ? C.green : C.red, border: `0.5px solid ${r.correct ? C.greenBorder : C.redBorder}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 14 }}>{r.correct ? "✓" : "✕"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: C.textPrimary, marginBottom: 3, lineHeight: 1.5 }}>{r.q}</div>
                <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>{r.a}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {results.some((r) => !r.correct) && !analysis && (
        <div style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.5rem", textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 6 }}>Find your weak spots</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16, lineHeight: 1.6 }}>AI will analyze what you missed, name the concept gaps, and build targeted practice cards.</div>
          {analyzing ? <Spinner label="Analyzing your answers" /> : (
            <button onClick={analyzeWeakness} style={{ padding: "10px 24px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Analyze my weak spots</button>
          )}
        </div>
      )}

      {analysis && (
        <div style={{ background: C.bgCard, border: `0.5px solid ${C.accentBorder}`, borderRadius: 14, padding: "1.5rem", marginBottom: "1.5rem", animation: "fadeSlideIn 0.4s ease both" }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 10 }}>Your weak spots</div>
          <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.7, marginBottom: 14 }}>{analysis.summary}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
            {(analysis.weak_topics || []).map((t) => (
              <span key={t} style={{ fontSize: 12, background: C.amber, border: `0.5px solid ${C.amberBorder}`, color: C.amberText, borderRadius: 20, padding: "4px 12px" }}>{t}</span>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, marginBottom: 10 }}>Targeted practice cards</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(analysis.practice_cards || []).map((c, i) => (
              <div key={i} style={{ background: C.bgInput, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 13, color: C.textPrimary, marginBottom: 4, lineHeight: 1.5 }}>{c.q}</div>
                <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>{c.a}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={onExit} style={{ padding: "10px 24px", borderRadius: 20, border: `0.5px solid ${C.border}`, background: "none", color: C.textSecondary, fontSize: 14, cursor: "pointer" }}>Back to deck</button>
      </div>
    </div>
  );

  const q = quiz[idx];
  if (!q) return null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2.5rem 2rem", animation: "fadeSlideIn 0.4s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: "1.5rem" }}>
        <button onClick={onExit} style={{ fontSize: 13, color: C.textDim, background: "none", border: "none", cursor: "pointer", padding: 0 }}>← Exit quiz</button>
        <div style={{ flex: 1, height: 3, background: C.bgInput, borderRadius: 2 }}>
          <div style={{ height: "100%", background: C.accent, borderRadius: 2, transition: "width 0.4s ease", width: `${Math.round(((idx + 1) / quiz.length) * 100)}%` }} />
        </div>
        <span style={{ fontSize: 13, color: C.textDim }}>{idx + 1} / {quiz.length}</span>
      </div>

      <div style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "2rem", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 19, color: C.textPrimary, lineHeight: 1.6, marginBottom: "1.5rem" }}>{q.q}</div>

        {mode === "mc" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options.map((opt, i) => {
              const isCorrect = i === q.correct;
              const chosen = selected === i;
              let bg = C.bgInput, bd = C.border, col = C.textPrimary;
              if (selected !== null) {
                if (isCorrect) { bg = C.green; bd = C.greenBorder; col = C.textPrimary; }
                else if (chosen) { bg = C.red; bd = C.redBorder; col = C.textPrimary; }
              }
              return (
                <button key={i} className={selected === null ? "quiz-opt" : ""} onClick={() => answerMC(i)} disabled={selected !== null}
                  style={{ background: bg, border: `0.5px solid ${bd}`, borderRadius: 10, padding: "14px 16px", fontSize: 14, color: col, cursor: selected === null ? "pointer" : "default", textAlign: "left", fontFamily: "system-ui", lineHeight: 1.5 }}>
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {mode === "written" && (
          <div>
            <textarea value={written} onChange={(e) => setWritten(e.target.value)} disabled={!!grade} placeholder="Type your answer..."
              style={{ width: "100%", minHeight: 100, padding: 12, borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, fontFamily: "system-ui", resize: "vertical", lineHeight: 1.6 }} />
            {!grade && (
              <button onClick={submitWritten} disabled={grading || !written.trim()} style={{ marginTop: 12, padding: "10px 24px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 14, fontWeight: 500, cursor: "pointer", opacity: grading || !written.trim() ? 0.5 : 1 }}>
                {grading ? "Grading..." : "Submit answer"}
              </button>
            )}
            {grade && (
              <div style={{ marginTop: 16, background: grade.verdict === "correct" ? C.green : grade.verdict === "partial" ? C.amber : C.red, border: `0.5px solid ${grade.verdict === "correct" ? C.greenBorder : grade.verdict === "partial" ? C.amberBorder : C.redBorder}`, borderRadius: 12, padding: "1rem", animation: "fadeSlideIn 0.3s ease both" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 600, color: grade.verdict === "correct" ? C.greenText : grade.verdict === "partial" ? C.amberText : C.redText }}>{grade.score}%</span>
                  <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textSecondary }}>{grade.verdict}</span>
                </div>
                <div style={{ fontSize: 14, color: C.textPrimary, lineHeight: 1.6, marginBottom: 10 }}>{grade.feedback}</div>
                <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}><strong style={{ fontWeight: 500 }}>Expected:</strong> {q.a}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {(selected !== null || grade) && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={next} style={{ padding: "10px 28px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
            {idx === quiz.length - 1 ? "See results →" : "Next question →"}
          </button>
        </div>
      )}
    </div>
  );
}

function ShareToClassModal({ cards, deckName, user, onClose }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState(deckName || "");
  const [sharing, setSharing] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => {
    (async () => {
      try { setClasses((await getUserClasses(user.uid)) || []); } catch { setClasses([]); }
      setLoading(false);
    })();
  }, [user]);

  async function share() {
    if (!selected || !name.trim()) return;
    setSharing(true);
    try {
      await shareDeckToClass(selected, name.trim(), cards.map((c, i) => ({ id: i, q: c.q, a: c.a })), user.uid, user.displayName);
      setDone("Shared with the class.");
      setTimeout(onClose, 1200);
    } catch { setDone("Could not share that deck."); }
    setSharing(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: "2rem", animation: "fadeIn 0.2s ease both" }}>
      <div style={{ background: C.modalBg, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "1.75rem", width: "100%", maxWidth: 400 }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary, marginBottom: 4 }}>Share to a class</div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>Everyone in the class can study and add to it</div>

        {loading && <Spinner label="Loading your classes" />}

        {!loading && classes.length === 0 && (
          <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.7, padding: "1rem", border: `0.5px dashed ${C.border}`, borderRadius: 10, textAlign: "center" }}>
            You are not in any classes yet.<br />Create or join one from the Classes tab.
          </div>
        )}

        {!loading && classes.length > 0 && (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deck name"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, fontFamily: "system-ui", marginBottom: 12 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, maxHeight: 220, overflowY: "auto" }}>
              {classes.map((cl) => (
                <button key={cl.id} onClick={() => setSelected(cl.id)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: selected === cl.id ? `0.5px solid ${C.accent}` : `0.5px solid ${C.border}`, background: selected === cl.id ? C.accentDim : C.bgInput, cursor: "pointer", textAlign: "left", fontFamily: "system-ui" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary }}>{cl.name}</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{cl.code} · {(cl.members || []).length} members</div>
                </button>
              ))}
            </div>
          </>
        )}

        {done && <div style={{ fontSize: 13, color: C.greenText, marginBottom: 12 }}>{done}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 20, border: `0.5px solid ${C.border}`, background: "none", color: C.textSecondary, fontSize: 13, cursor: "pointer" }}>Close</button>
          {classes.length > 0 && (
            <button onClick={share} disabled={sharing || !selected || !name.trim()}
              style={{ padding: "8px 18px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: sharing || !selected || !name.trim() ? 0.5 : 1 }}>
              {sharing ? "Sharing..." : "Share"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ClassesPage({ user }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeClass, setActiveClass] = useState(null);
  const [classDecks, setClassDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [activeDeck, setActiveDeck] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

  async function reload() {
    try { setClasses((await getUserClasses(user.uid)) || []); } catch (e) { console.error(e); setClasses([]); }
    setLoading(false);
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function openClass(cl) {
    setActiveClass(cl); setDecksLoading(true); setActiveDeck(null);
    try { setClassDecks((await getClassDecks(cl.id)) || []); } catch { setClassDecks([]); }
    setDecksLoading(false);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const created = await createClass(user.uid, user.displayName, newName.trim());
      setMsg(`Class created. Share code ${created.code}`);
      setNewName(""); setShowCreate(false);
      await reload();
    } catch { setMsg("Could not create that class."); }
    setBusy(false);
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      const joined = await joinClassByCode(user.uid, user.displayName, joinCode);
      setMsg(joined.alreadyMember ? `You are already in ${joined.name}.` : `Joined ${joined.name}.`);
      setJoinCode(""); setShowJoin(false);
      await reload();
    } catch (e) { setMsg(e.message || "Could not join that class."); }
    setBusy(false);
  }

  async function handleLeave(cl) {
    await leaveClass(cl.id, user.uid);
    setActiveClass(null);
    await reload();
  }

  async function handleDeleteClass(cl) {
    await deleteClass(cl.id);
    setActiveClass(null);
    await reload();
  }

  async function handleDeleteDeck(deckId) {
    await deleteClassDeck(deckId);
    setClassDecks((p) => p.filter((d) => d.id !== deckId));
    setActiveDeck(null);
  }

  function copyCode(code) {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (activeDeck && showQuiz) return <QuizMode cards={activeDeck.cards} deckName={activeDeck.name} onExit={() => setShowQuiz(false)} />;

  if (activeDeck) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2.5rem 2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button onClick={() => setActiveDeck(null)} style={{ fontSize: 13, color: C.textDim, background: "none", border: "none", cursor: "pointer", padding: 0 }}>← {activeClass.name}</button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: C.textPrimary }}>{activeDeck.name}</div>
          <div style={{ fontSize: 13, color: C.textDim }}>shared by {activeDeck.authorName} · {activeDeck.cards.length} cards</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowQuiz(true)} style={{ fontSize: 13, color: C.amberText, background: C.amber, border: `0.5px solid ${C.amberBorder}`, borderRadius: 20, padding: "8px 16px", cursor: "pointer" }}>📝 Quiz me</button>
          <button onClick={async () => { await saveDeck(user.uid, activeDeck.name, activeDeck.cards); setMsg("Copied to My Decks."); }}
            style={{ fontSize: 13, color: C.accent, background: C.accentDim, border: `0.5px solid ${C.accentBorder}`, borderRadius: 20, padding: "8px 16px", cursor: "pointer" }}>Copy to my decks</button>
        </div>
      </div>
      {msg && <div style={{ fontSize: 13, color: C.greenText, marginBottom: "1rem" }}>{msg}</div>}
      <FlashcardViewer cards={activeDeck.cards} showDelete={false} showTutor />
    </div>
  );

  if (activeClass) {
    const isOwner = activeClass.ownerId === user.uid;
    const memberNames = activeClass.memberNames || {};
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2.5rem 2rem" }}>
        <button onClick={() => { setActiveClass(null); setMsg(""); }} style={{ fontSize: 13, color: C.textDim, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "1.25rem" }}>← All classes</button>

        <div style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>{activeClass.name}</div>
              <div style={{ fontSize: 13, color: C.textDim }}>
                created by {activeClass.ownerName} · {(activeClass.members || []).length} {(activeClass.members || []).length === 1 ? "member" : "members"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Class code</div>
              <button onClick={() => copyCode(activeClass.code)}
                style={{ fontSize: 18, fontWeight: 600, letterSpacing: "0.08em", color: C.accent, background: C.accentDim, border: `0.5px solid ${C.accentBorder}`, borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontFamily: "monospace" }}>
                {activeClass.code}
              </button>
              <div style={{ fontSize: 11, color: copied ? C.greenText : C.textDim, marginTop: 6 }}>{copied ? "Copied" : "Click to copy"}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16, paddingTop: 16, borderTop: `0.5px solid ${C.border}` }}>
            {Object.values(memberNames).map((n, i) => (
              <span key={i} style={{ fontSize: 12, background: C.bgInput, border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "4px 12px", color: C.textSecondary }}>{n}</span>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {isOwner ? (
                <button onClick={() => handleDeleteClass(activeClass)} style={{ fontSize: 12, color: C.redText, background: "none", border: `0.5px solid ${C.redBorder}`, borderRadius: 20, padding: "4px 14px", cursor: "pointer" }}>Delete class</button>
              ) : (
                <button onClick={() => handleLeave(activeClass)} style={{ fontSize: 12, color: C.textSecondary, background: "none", border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "4px 14px", cursor: "pointer" }}>Leave class</button>
              )}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary, marginBottom: 4 }}>Shared decks</div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: "1.25rem" }}>Anyone in this class can study these. Share your own from the Home or My Decks tab.</div>

        {decksLoading && <div style={{ fontSize: 13, color: C.textDim }}>Loading decks...</div>}
        {!decksLoading && classDecks.length === 0 && (
          <div style={{ textAlign: "center", padding: "3.5rem", border: `0.5px dashed ${C.border}`, borderRadius: 16, color: C.textDim, fontSize: 14, lineHeight: 2 }}>
            No decks shared yet.<br />Generate or open a deck, then hit "Share to class".
          </div>
        )}
        {!decksLoading && classDecks.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
            {classDecks.map((deck) => (
              <div key={deck.id} className="deck-card" onClick={() => setActiveDeck(deck)}
                style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.25rem", cursor: "pointer" }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 6 }}>{deck.name}</div>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>{deck.cards.length} cards · by {deck.authorName}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: C.accent }}>Study →</span>
                  {(deck.authorId === user.uid || isOwner) && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteDeck(deck.id); }} style={{ fontSize: 13, color: C.textDim, background: "none", border: "none", cursor: "pointer" }}>🗑</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2.5rem 2rem" }}>
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "2rem", animation: "fadeIn 0.2s ease both" }}>
          <div style={{ background: C.modalBg, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "1.75rem", width: "100%", maxWidth: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary, marginBottom: 4 }}>Create a class</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>You will get a join code to share with classmates</div>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="e.g. CIS 1300 Fall 2026" autoFocus
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, fontFamily: "system-ui", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: "8px 18px", borderRadius: 20, border: `0.5px solid ${C.border}`, background: "none", color: C.textSecondary, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreate} disabled={busy || !newName.trim()} style={{ padding: "8px 18px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: busy || !newName.trim() ? 0.5 : 1 }}>{busy ? "Creating..." : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {showJoin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "2rem", animation: "fadeIn 0.2s ease both" }}>
          <div style={{ background: C.modalBg, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "1.75rem", width: "100%", maxWidth: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary, marginBottom: 4 }}>Join a class</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>Enter the code a classmate shared with you</div>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && handleJoin()} placeholder="ABC-1234" autoFocus
              style={{ width: "100%", padding: "12px", borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 18, fontFamily: "monospace", letterSpacing: "0.1em", textAlign: "center", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowJoin(false)} style={{ padding: "8px 18px", borderRadius: 20, border: `0.5px solid ${C.border}`, background: "none", color: C.textSecondary, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleJoin} disabled={busy || !joinCode.trim()} style={{ padding: "8px 18px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: busy || !joinCode.trim() ? 0.5 : 1 }}>{busy ? "Joining..." : "Join"}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>Classes</h1>
          <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>Study together. Share decks with your class or study group.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowJoin(true)} style={{ padding: "10px 20px", borderRadius: 20, border: `0.5px solid ${C.border}`, background: "none", color: C.textSecondary, fontSize: 13, cursor: "pointer" }}>Join with code</button>
          <button onClick={() => setShowCreate(true)} style={{ padding: "10px 20px", borderRadius: 20, border: `0.5px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>+ Create class</button>
        </div>
      </div>

      {msg && <div style={{ fontSize: 13, color: C.greenText, marginBottom: "1.25rem" }}>{msg}</div>}

      {loading && <div style={{ fontSize: 13, color: C.textDim }}>Loading classes...</div>}
      {!loading && classes.length === 0 && (
        <div style={{ textAlign: "center", padding: "4rem 2rem", border: `0.5px dashed ${C.border}`, borderRadius: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 14 }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary, marginBottom: 8 }}>No classes yet</div>
          <div style={{ fontSize: 14, color: C.textDim, lineHeight: 1.8, maxWidth: 380, margin: "0 auto" }}>
            Create a class and share the code with classmates, or join one with a code someone gave you.
          </div>
        </div>
      )}
      {!loading && classes.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {classes.map((cl) => (
            <div key={cl.id} className="deck-card" onClick={() => openClass(cl)}
              style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.25rem", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, lineHeight: 1.4 }}>{cl.name}</div>
                {cl.ownerId === user.uid && <span style={{ fontSize: 10, background: C.accentDim, border: `0.5px solid ${C.accentBorder}`, color: C.accent, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>owner</span>}
              </div>
              <div style={{ fontSize: 12, color: C.accent, fontFamily: "monospace", letterSpacing: "0.06em", marginBottom: 10 }}>{cl.code}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>{(cl.members || []).length} {(cl.members || []).length === 1 ? "member" : "members"}</div>
              <span style={{ fontSize: 13, color: C.accent }}>Open class →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HomePage({ cardCount, setCardCount, difficulty, setDifficulty, user }) {
  const [notes, setNotes] = useState("");
  const [cards, setCards] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [deckTopic, setDeckTopic] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [pendingCards, setPendingCards] = useState([]);
  const [showExport, setShowExport] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [customCount, setCustomCount] = useState(String(cardCount));
  const fileInputRef = useRef(null);

  async function handleFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf","docx","txt","pptx","png","jpg","jpeg","webp"].includes(ext)) { setStatus("Unsupported file type."); return; }
    setUploadedFile(file); setStatus(`Loaded: ${file.name}`);
    if (!["png","jpg","jpeg","webp"].includes(ext)) {
      try { const text = await extractTextFromFile(file); setNotes(text); } catch { setStatus("Could not read that file."); }
    }
  }

  async function generateCards() {
    const count = Math.max(1, Math.min(50, parseInt(customCount) || cardCount));
    if (!notes.trim() && !uploadedFile) { setStatus("Paste notes or upload a file first."); return; }
    setLoading(true); setStatus("Generating flashcards..."); setCards([]);
    try {
      const ext = uploadedFile?.name.split(".").pop().toLowerCase();
      const isImage = uploadedFile && ["png","jpg","jpeg","webp"].includes(ext);
      let data;
      if (isImage) {
        const base64 = await fileToBase64(uploadedFile);
        data = await postJSON("/generate-from-image", { image: base64, media_type: `image/${ext === "jpg" ? "jpeg" : ext}`, count, difficulty });
      } else {
        data = await postJSON("/generate", { notes, count, difficulty });
      }
      const parsed = parseJSON(data.flashcards);
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("No cards");
      setPendingCards(parsed.map((c, i) => ({ id: i, q: c.q, a: c.a })));
      setShowReview(true); setStatus("");
      updateStreak();
    } catch (e) { setStatus(e.message || "Something went wrong. Try again."); }
    setLoading(false);
  }

  function handleReviewConfirm(reviewedCards) {
    setCards(reviewedCards.map((c, i) => ({ id: i, q: c.q, a: c.a })));
    setShowReview(false);
    setStatus(`${reviewedCards.length} cards ready`);
  }

  async function openSaveModal() {
    setShowSaveModal(true);
    if (deckName) return;
    setSuggesting(true);
    try {
      const data = await postJSON("/suggest-name", { cards: cards.map((c) => ({ q: c.q, a: c.a })) });
      const s = parseJSON(data.suggestion);
      setDeckName(s.name || ""); setDeckTopic(s.topic || "");
    } catch { /* silent, user types their own */ }
    setSuggesting(false);
  }

  async function handleSaveDeck() {
    if (!deckName.trim()) return;
    setSaving(true);
    try { await saveDeck(user.uid, deckName.trim(), cards); setShowSaveModal(false); setStatus("Deck saved to My Decks."); }
    catch { setStatus("Could not save deck."); }
    setSaving(false);
  }

  async function adaptCard(index, direction) {
    const card = cards[index];
    try {
      const data = await postJSON("/adapt-card", { question: card.q, answer: card.a, direction });
      const nc = parseJSON(data.card);
      setCards((p) => p.map((c, i) => i === index ? { ...c, q: nc.q, a: nc.a } : c));
    } catch (e) { alert(e.message || "Could not rewrite that card."); }
  }

  function deleteCardAt(index) {
    setCards((p) => p.filter((_, i) => i !== index));
    setStatus("Card removed.");
  }

  if (showReview) return <ReviewScreen cards={pendingCards} onConfirm={handleReviewConfirm} onBack={() => { setShowReview(false); setStatus(""); }} />;
  if (showQuiz) return <QuizMode cards={cards} deckName={deckName} onExit={() => setShowQuiz(false)} />;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2.5rem 2rem" }}>
      {showShare && <ShareToClassModal cards={cards} deckName={deckName} user={user} onClose={() => setShowShare(false)} />}
      {showSaveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, animation: "fadeIn 0.2s ease both" }}>
          <div style={{ background: C.modalBg, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "1.75rem", width: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary, marginBottom: 4 }}>Save deck</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 14 }}>
              {suggesting ? <Spinner label="AI is naming your deck" /> : "AI suggested a name. Change it if you like."}
            </div>
            <input value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="Deck name" autoFocus
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, fontFamily: "system-ui", marginBottom: 10 }} />
            {deckTopic && <div style={{ fontSize: 12, color: C.accent, background: C.accentDim, border: `0.5px solid ${C.accentBorder}`, borderRadius: 20, padding: "3px 12px", display: "inline-block", marginBottom: 14 }}>{deckTopic}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowSaveModal(false)} style={{ padding: "8px 18px", borderRadius: 20, border: `0.5px solid ${C.border}`, background: "none", color: C.textSecondary, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSaveDeck} disabled={saving || !deckName.trim()} style={{ padding: "8px 18px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: saving || !deckName.trim() ? 0.6 : 1 }}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {showExport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, animation: "fadeIn 0.2s ease both" }}>
          <div style={{ background: C.modalBg, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "1.75rem", width: 320 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary, marginBottom: 16 }}>Export deck</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => { exportCSV(cards, deckName || "mindsync-deck"); setShowExport(false); }} style={{ padding: "12px 16px", borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontWeight: 500 }}>Export as CSV</div><div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>Open in Excel or Google Sheets</div>
              </button>
              <button onClick={() => { exportJSON(cards, deckName || "mindsync-deck"); setShowExport(false); }} style={{ padding: "12px 16px", borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontWeight: 500 }}>Export as JSON</div><div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>For developers and other apps</div>
              </button>
            </div>
            <button onClick={() => setShowExport(false)} style={{ marginTop: 12, width: "100%", padding: 8, borderRadius: 10, border: `0.5px solid ${C.border}`, background: "none", color: C.textDim, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>Generate flashcards</h1>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>Upload a file or paste your notes to get started</p>
      </div>

      <div style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "1.5rem", marginBottom: "1.5rem", overflow: "hidden" }}>
        <label style={{ fontSize: 11, fontWeight: 500, color: C.textSecondary, marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Upload a file</label>
        <div className={`upload-zone${dragging ? " dragging" : ""}`}
          style={{ width: "100%", padding: "1.25rem", borderRadius: 10, border: `0.5px dashed ${C.accentBorder}`, background: "rgba(99,140,255,0.03)", cursor: "pointer", textAlign: "center", marginBottom: 12 }}
          onClick={() => fileInputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
          <div style={{ fontSize: 14, color: C.textSecondary }}>Click to upload or drag and drop</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>PDF, DOCX, PPTX, TXT, PNG, JPG</div>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.webp" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        {uploadedFile && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20, background: C.accentDim, border: `0.5px solid ${C.accentBorder}`, fontSize: 12, color: C.accent, marginBottom: 12 }}>
            {uploadedFile.name} <span onClick={() => { setUploadedFile(null); setNotes(""); }} style={{ cursor: "pointer", opacity: 0.6, marginLeft: 2 }}>✕</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0" }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontSize: 11, color: C.textDim }}>or paste notes</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste lecture notes, textbook excerpts, or any study material..."
          style={{ width: "100%", minHeight: 120, resize: "vertical", fontFamily: "system-ui", fontSize: 14, padding: 12, borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, lineHeight: 1.6 }} />

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Difficulty</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            {DIFFICULTIES.map((d) => (
              <button key={d.key} onClick={() => setDifficulty(d.key)}
                style={{ padding: "10px 14px", borderRadius: 10, border: difficulty === d.key ? `0.5px solid ${C.accent}` : `0.5px solid ${C.border}`, background: difficulty === d.key ? C.accentDim : "rgba(255,255,255,0.02)", cursor: "pointer", textAlign: "left", transition: "all 0.2s", fontFamily: "system-ui" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: difficulty === d.key ? C.textPrimary : C.textSecondary, marginBottom: 2 }}>{d.label}</div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4 }}>{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: C.textSecondary }}>Cards:</span>
          <div style={{ display: "flex", gap: 6 }}>
            {[5, 8, 12, 15, 20].map((n) => (
              <button key={n} onClick={() => { setCardCount(n); setCustomCount(String(n)); }}
                style={{ padding: "5px 12px", borderRadius: 20, border: parseInt(customCount) === n ? `0.5px solid ${C.accent}` : `0.5px solid ${C.border}`, background: parseInt(customCount) === n ? C.accentDim : "rgba(255,255,255,0.03)", fontSize: 13, color: parseInt(customCount) === n ? C.textPrimary : C.textSecondary, cursor: "pointer", transition: "all 0.2s" }}>{n}</button>
            ))}
          </div>
          <input type="number" min="1" max="50" value={customCount} onChange={(e) => setCustomCount(e.target.value)} placeholder="#"
            style={{ width: 72, padding: "5px 10px", borderRadius: 20, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 13, textAlign: "center", fontFamily: "system-ui" }} />
          <button className={loading ? "generate-btn-loading" : ""} onClick={generateCards} disabled={loading}
            style={{ marginLeft: "auto", padding: "10px 28px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 14, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      {status && <div style={{ fontSize: 13, color: C.textDim, marginBottom: "1.5rem" }}>{status}</div>}

      {cards.length > 0 && (
        <div style={{ animation: "fadeSlideIn 0.4s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: C.textPrimary, margin: 0 }}>Your deck</h2>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setShowQuiz(true)} style={{ fontSize: 12, color: C.amberText, background: C.amber, border: `0.5px solid ${C.amberBorder}`, borderRadius: 20, padding: "6px 14px", cursor: "pointer" }}>📝 Quiz me</button>
              <button onClick={() => setShowShare(true)} style={{ fontSize: 12, color: C.textSecondary, background: "none", border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "6px 14px", cursor: "pointer" }}>👥 Share to class</button>
              <button onClick={() => setShowExport(true)} style={{ fontSize: 12, color: C.textSecondary, background: "none", border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "6px 14px", cursor: "pointer" }}>Export</button>
              <button onClick={openSaveModal} style={{ fontSize: 12, color: C.accent, background: C.accentDim, border: `0.5px solid ${C.accentBorder}`, borderRadius: 20, padding: "6px 14px", cursor: "pointer" }}>Save deck</button>
            </div>
          </div>
          <FlashcardViewer cards={cards} onDelete={deleteCardAt} onAdapt={adaptCard} showDelete showTutor />
        </div>
      )}
    </div>
  );
}

function ExplorePage({ user }) {
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("All");
  const [activeDeck, setActiveDeck] = useState(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const filtered = PUBLIC_DECKS.filter((d) =>
    (topic === "All" || d.topic === topic) &&
    (d.name.toLowerCase().includes(search.toLowerCase()) || d.topic.toLowerCase().includes(search.toLowerCase()))
  );

  async function savePublicDeck(deck) {
    try {
      await saveDeck(user.uid, deck.name, deck.cards.map((c, i) => ({ id: i, q: c.q, a: c.a })));
      setSavedMsg("Saved to My Decks.");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch { setSavedMsg("Could not save that deck."); }
  }

  if (activeDeck && showQuiz) {
    const cards = activeDeck.cards.map((c, i) => ({ id: i, q: c.q, a: c.a }));
    return <QuizMode cards={cards} deckName={activeDeck.name} onExit={() => setShowQuiz(false)} />;
  }

  if (activeDeck) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2.5rem 2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button onClick={() => setActiveDeck(null)} style={{ fontSize: 13, color: C.textDim, background: "none", border: "none", cursor: "pointer", padding: 0 }}>← Explore</button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: C.textPrimary }}>{activeDeck.name}</div>
          <div style={{ fontSize: 13, color: C.textDim }}>by {activeDeck.author} · {activeDeck.cards.length} cards</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowQuiz(true)} style={{ padding: "8px 16px", borderRadius: 20, border: `0.5px solid ${C.amberBorder}`, background: C.amber, color: C.amberText, fontSize: 13, cursor: "pointer" }}>📝 Quiz me</button>
          <button onClick={() => savePublicDeck(activeDeck)} style={{ padding: "8px 18px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Save to my decks</button>
        </div>
      </div>
      {savedMsg && <div style={{ fontSize: 13, color: C.greenText, marginBottom: "1rem" }}>{savedMsg}</div>}
      <FlashcardViewer cards={activeDeck.cards.map((c, i) => ({ id: i, q: c.q, a: c.a }))} showDelete={false} showTutor />
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2.5rem 2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>Explore decks</h1>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>Browse flashcard decks created by other students</p>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search decks by name or topic..."
        style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, fontFamily: "system-ui", marginBottom: "1.25rem" }} />

      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {TOPICS.map((t) => (
          <button key={t} onClick={() => setTopic(t)}
            style={{ padding: "5px 14px", borderRadius: 20, border: topic === t ? `0.5px solid ${C.accent}` : `0.5px solid ${C.border}`, background: topic === t ? C.accentDim : "rgba(255,255,255,0.03)", fontSize: 13, color: topic === t ? C.textPrimary : C.textSecondary, cursor: "pointer", transition: "all 0.2s" }}>{t}</button>
        ))}
      </div>

      {filtered.length === 0 && <div style={{ textAlign: "center", padding: "3rem", color: C.textDim, fontSize: 14 }}>No decks match that search.</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {filtered.map((deck) => (
          <div key={deck.id} className="public-card" onClick={() => setActiveDeck(deck)}
            style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.25rem", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, lineHeight: 1.4 }}>{deck.name}</div>
              <div style={{ fontSize: 11, background: C.accentDim, border: `0.5px solid ${C.accentBorder}`, borderRadius: 20, padding: "2px 8px", color: C.accent, whiteSpace: "nowrap" }}>{deck.topic}</div>
            </div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>{deck.cards.length} cards · by {deck.author}</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {deck.cards.slice(0, 2).map((c, i) => (
                <div key={i} style={{ flex: 1, background: C.bgInput, borderRadius: 8, padding: "6px 8px" }}>
                  <div style={{ fontSize: 11, color: C.textSecondary, lineHeight: 1.4 }}>{c.q}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.accent }}>Study this deck →</span>
              <span style={{ fontSize: 11, color: C.textDim }}>♡ {deck.saves}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MyDecksPage({ user }) {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDeck, setActiveDeck] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCards, setCustomCards] = useState([{ q: "", a: "" }]);

  async function reload() {
    try {
      const data = (await getUserDecks(user.uid)) || [];
      setDecks([...data].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (e) { console.error(e); setDecks([]); }
    setLoading(false);
  }
   useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleDelete(id) { await deleteDeck(id); setDecks((p) => p.filter((d) => d.id !== id)); if (activeDeck?.id === id) setActiveDeck(null); }

  async function saveCustomDeck() {
    if (!customName.trim()) return;
    const valid = customCards.filter((c) => c.q.trim() && c.a.trim()).map((c, i) => ({ id: i, q: c.q, a: c.a }));
    if (!valid.length) return;
    try {
      await saveDeck(user.uid, customName.trim(), valid);
      await reload();
      setShowCustom(false); setCustomName(""); setCustomCards([{ q: "", a: "" }]);
    } catch { alert("Could not save that deck."); }
  }

  if (activeDeck && showQuiz) return <QuizMode cards={activeDeck.cards} deckName={activeDeck.name} onExit={() => setShowQuiz(false)} />;

  if (activeDeck) return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2.5rem 2rem" }}>
      {showShare && <ShareToClassModal cards={activeDeck.cards} deckName={activeDeck.name} user={user} onClose={() => setShowShare(false)} />}
      {showExport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: C.modalBg, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "1.75rem", width: 320 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: C.textPrimary, marginBottom: 16 }}>Export "{activeDeck.name}"</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => { exportCSV(activeDeck.cards, activeDeck.name); setShowExport(false); }} style={{ padding: "12px 16px", borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontWeight: 500 }}>Export as CSV</div><div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>Open in Excel or Google Sheets</div>
              </button>
              <button onClick={() => { exportJSON(activeDeck.cards, activeDeck.name); setShowExport(false); }} style={{ padding: "12px 16px", borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontWeight: 500 }}>Export as JSON</div><div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>For developers and other apps</div>
              </button>
            </div>
            <button onClick={() => setShowExport(false)} style={{ marginTop: 12, width: "100%", padding: 8, borderRadius: 10, border: `0.5px solid ${C.border}`, background: "none", color: C.textDim, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button onClick={() => setActiveDeck(null)} style={{ fontSize: 13, color: C.textDim, background: "none", border: "none", cursor: "pointer", padding: 0 }}>← My decks</button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: C.textPrimary }}>{activeDeck.name}</div>
          <div style={{ fontSize: 13, color: C.textDim }}>{activeDeck.cards.length} cards</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowQuiz(true)} style={{ fontSize: 13, color: C.amberText, background: C.amber, border: `0.5px solid ${C.amberBorder}`, borderRadius: 20, padding: "8px 16px", cursor: "pointer" }}>📝 Quiz me</button>
          <button onClick={() => setShowShare(true)} style={{ fontSize: 13, color: C.textSecondary, background: "none", border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "8px 16px", cursor: "pointer" }}>👥 Share to class</button>
          <button onClick={() => setShowExport(true)} style={{ fontSize: 13, color: C.textSecondary, background: "none", border: `0.5px solid ${C.border}`, borderRadius: 20, padding: "8px 16px", cursor: "pointer" }}>Export</button>
        </div>
      </div>
      <FlashcardViewer cards={activeDeck.cards} showDelete={false} showTutor />
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2.5rem 2rem" }}>
      {showCustom && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 100, padding: "2rem", overflowY: "auto", animation: "fadeIn 0.2s ease both" }}>
          <div style={{ background: C.modalBg, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: "1.75rem", width: "100%", maxWidth: 600 }}>
            <div style={{ fontSize: 18, fontWeight: 500, color: C.textPrimary, marginBottom: 4 }}>Build custom deck</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>Write your own flashcards from scratch</div>
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Deck name"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 14, fontFamily: "system-ui", marginBottom: 16 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {customCards.map((card, i) => (
                <div key={i} style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: C.textDim }}>Card {i + 1}</span>
                    {customCards.length > 1 && <button onClick={() => setCustomCards((p) => p.filter((_, j) => j !== i))} style={{ fontSize: 12, color: C.redText, background: "none", border: "none", cursor: "pointer" }}>Remove</button>}
                  </div>
                  <input value={card.q} onChange={(e) => setCustomCards((p) => p.map((c, j) => j === i ? { ...c, q: e.target.value } : c))} placeholder="Question"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 13, fontFamily: "system-ui", marginBottom: 8 }} />
                  <input value={card.a} onChange={(e) => setCustomCards((p) => p.map((c, j) => j === i ? { ...c, a: e.target.value } : c))} placeholder="Answer"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.bgInput, color: C.textPrimary, fontSize: 13, fontFamily: "system-ui" }} />
                </div>
              ))}
            </div>
            <button onClick={() => setCustomCards((p) => [...p, { q: "", a: "" }])} style={{ width: "100%", padding: 10, borderRadius: 10, border: `0.5px dashed ${C.border}`, background: "none", color: C.textSecondary, fontSize: 13, cursor: "pointer", marginBottom: 16 }}>+ Add card</button>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowCustom(false)} style={{ padding: "8px 18px", borderRadius: 20, border: `0.5px solid ${C.border}`, background: "none", color: C.textSecondary, fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveCustomDeck} disabled={!customName.trim()} style={{ padding: "8px 18px", borderRadius: 20, border: "none", background: C.accent, color: C.bg, fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: customName.trim() ? 1 : 0.5 }}>Save deck</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>My decks</h1>
          <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>Your saved flashcard decks</p>
        </div>
        <button onClick={() => setShowCustom(true)} style={{ padding: "10px 20px", borderRadius: 20, border: `0.5px solid ${C.accentBorder}`, background: C.accentDim, color: C.accent, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>+ Build custom deck</button>
      </div>

      {loading && <div style={{ fontSize: 13, color: C.textDim }}>Loading decks...</div>}
      {!loading && decks.length === 0 && (
        <div style={{ textAlign: "center", padding: "4rem", border: `0.5px dashed ${C.border}`, borderRadius: 16, color: C.textDim, fontSize: 14, lineHeight: 2 }}>
          No decks saved yet.<br />Generate flashcards or build a custom deck.
        </div>
      )}
      {!loading && decks.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {decks.map((deck) => (
            <div key={deck.id} className="deck-card" onClick={() => setActiveDeck(deck)}
              style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.25rem", cursor: "pointer" }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 6 }}>{deck.name}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>{deck.cards.length} cards</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: C.accent }}>Study →</span>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(deck.id); }} style={{ fontSize: 13, color: C.textDim, background: "none", border: "none", cursor: "pointer" }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPage({ cardCount, setCardCount, difficulty, setDifficulty, streak }) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2.5rem 2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>Customize your MindSync experience</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.5rem" }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 4 }}>Default difficulty</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 14 }}>How the AI writes your questions</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            {DIFFICULTIES.map((d) => (
              <button key={d.key} onClick={() => setDifficulty(d.key)}
                style={{ padding: "10px 14px", borderRadius: 10, border: difficulty === d.key ? `0.5px solid ${C.accent}` : `0.5px solid ${C.border}`, background: difficulty === d.key ? C.accentDim : "rgba(255,255,255,0.02)", cursor: "pointer", textAlign: "left", fontFamily: "system-ui" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: difficulty === d.key ? C.textPrimary : C.textSecondary, marginBottom: 2 }}>{d.label}</div>
                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4 }}>{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.5rem" }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 4 }}>Default card count</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 14 }}>How many flashcards to generate by default</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[5, 8, 12, 15, 20].map((n) => (
              <button key={n} onClick={() => setCardCount(n)}
                style={{ padding: "6px 18px", borderRadius: 20, border: cardCount === n ? `0.5px solid ${C.accent}` : `0.5px solid ${C.border}`, background: cardCount === n ? C.accentDim : "rgba(255,255,255,0.03)", fontSize: 13, color: cardCount === n ? C.textPrimary : C.textSecondary, cursor: "pointer" }}>{n}</button>
            ))}
          </div>
        </div>

        <div style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.5rem" }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 4 }}>Your streak</div>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 14 }}>Generate cards on consecutive days to keep it going</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.amber, border: `0.5px solid ${C.amberBorder}`, borderRadius: 20, padding: "8px 16px" }}>
            <span style={{ fontSize: 18 }}>🔥</span>
            <span style={{ fontSize: 15, fontWeight: 500, color: C.amberText }}>{streak} {streak === 1 ? "day" : "days"}</span>
          </div>
        </div>

        <div style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.5rem" }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 10 }}>Supported file types</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["PDF","DOCX","PPTX","TXT","PNG","JPG","WEBP"].map((f) => (
              <span key={f} style={{ padding: "4px 12px", borderRadius: 20, background: C.bgInput, border: `0.5px solid ${C.border}`, fontSize: 12, color: C.textSecondary }}>{f}</span>
            ))}
          </div>
        </div>

        <div style={{ background: C.bgCard, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "1.5rem" }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, marginBottom: 4 }}>About MindSync</div>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.8 }}>
            An AI-powered flashcard generator built with React, FastAPI, Firebase, and Claude AI.<br />
            Version 2.0.0 · © 2026 MindSync
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("Home");
  const [cardCount, setCardCount] = useState(8);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = globalStyles;
    document.head.appendChild(style);
    document.body.style.background = C.bg;
    document.body.style.margin = "0";
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u); setAuthLoading(false);
      if (u) setStreak(getStreak().count);
    });
    return unsub;
  }, []);

  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
      <div style={{ fontSize: 14, color: C.textDim }}>Loading...</div>
    </div>
  );

  if (!user) return <LandingPage onSignIn={signInWithGoogle} />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "system-ui, sans-serif" }}>
      <Navbar page={page} setPage={setPage} user={user} streak={streak} />
      {page === "Home" && <HomePage cardCount={cardCount} setCardCount={setCardCount} difficulty={difficulty} setDifficulty={setDifficulty} user={user} />}
      {page === "Explore" && <ExplorePage user={user} />}
      {page === "My Decks" && <MyDecksPage user={user} />}
      {page === "Classes" && <ClassesPage user={user} />}
      {page === "Settings" && <SettingsPage cardCount={cardCount} setCardCount={setCardCount} difficulty={difficulty} setDifficulty={setDifficulty} streak={streak} />}
      <Footer />
    </div>
  );
}
