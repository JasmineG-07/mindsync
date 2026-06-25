import { useState, useEffect, useRef } from "react";
import { auth, signInWithGoogle, signOutUser } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import JSZip from "jszip";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const globalStyles = `
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(200,184,154,0.4); }
    50% { box-shadow: 0 0 0 8px rgba(200,184,154,0); }
  }
  @keyframes cardEntrance {
    from { opacity: 0; transform: scale(0.95) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  * { box-sizing: border-box; }
  .mini-card-hover:hover { transform: translateY(-2px); border-color: rgba(200,184,154,0.4) !important; }
  .mini-card-hover { transition: transform 0.2s ease, border-color 0.2s ease; }
  .generate-btn-loading { animation: pulse 1.2s ease-in-out infinite; }
  .upload-zone:hover { border-color: rgba(200,184,154,0.4) !important; background: rgba(200,184,154,0.05) !important; }
  .upload-zone.dragging { border-color: #c8b89a !important; background: rgba(200,184,154,0.08) !important; }
  .nav-link { transition: color 0.2s ease; }
  .nav-link:hover { color: #e8e0d4 !important; }
  .feature-card:hover { border-color: rgba(200,184,154,0.2) !important; background: rgba(200,184,154,0.04) !important; transform: translateY(-2px); }
  .feature-card { transition: all 0.2s ease; }
  .sign-in-btn:hover { background: #d4c4aa !important; }
  .sign-in-btn { transition: background 0.2s ease; }
`;

async function extractTextFromFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "txt") return await file.text();
  if (ext === "pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(" ") + "\n";
    }
    return text;
  }
  if (ext === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }
  if (ext === "pptx") {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    let text = "";
    const slideFiles = Object.keys(zip.files).filter((name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"));
    for (const slideFile of slideFiles) {
      const xml = await zip.files[slideFile].async("text");
      const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
      text += matches.map((m) => m.replace(/<[^>]+>/g, "")).join(" ") + "\n";
    }
    return text;
  }
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return null;
  throw new Error("Unsupported file type");
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const colors = {
  bg: "#0f1520",
  bgCard: "rgba(255,255,255,0.03)",
  bgInput: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.07)",
  borderHover: "rgba(200,184,154,0.3)",
  beige: "#c8b89a",
  beigeLight: "#e8e0d4",
  beigeDim: "rgba(200,184,154,0.1)",
  textPrimary: "#e8e0d4",
  textSecondary: "#7a8faa",
  textDim: "#4a5a7a",
  navyLight: "#1a2540",
  navyMid: "#141e35",
};

// LANDING PAGE
function LandingPage({ onSignIn }) {
  return (
    <div style={{ minHeight: "100vh", background: colors.bg, fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", width: 400, height: 400, borderRadius: "50%", background: colors.navyLight, top: -100, right: -100, opacity: 0.6, pointerEvents: "none" }} />
      <div style={{ position: "fixed", width: 250, height: 250, borderRadius: "50%", background: colors.navyMid, bottom: 50, left: -80, opacity: 0.5, pointerEvents: "none" }} />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem", position: "relative", zIndex: 1 }}>
        <nav style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "5rem", animation: "fadeSlideIn 0.5s ease both" }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: colors.beige, display: "flex", alignItems: "center", justifyContent: "center", color: colors.bg, fontSize: 16, fontWeight: 600 }}>M</div>
          <span style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary }}>MindSync</span>
          <button className="sign-in-btn" onClick={onSignIn} style={{ marginLeft: "auto", fontSize: 13, color: colors.bg, background: colors.beige, border: "none", borderRadius: 20, padding: "7px 18px", cursor: "pointer", fontWeight: 500 }}>Sign in</button>
        </nav>

        <div style={{ textAlign: "center", marginBottom: "4rem", animation: "fadeSlideIn 0.6s ease 0.1s both" }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: colors.beige, display: "flex", alignItems: "center", justifyContent: "center", color: colors.bg, fontSize: 32, fontWeight: 700, margin: "0 auto 1.5rem", animation: "float 3s ease-in-out infinite" }}>M</div>
          <h1 style={{ fontSize: 42, fontWeight: 600, color: colors.textPrimary, marginBottom: "1rem", lineHeight: 1.2 }}>
            Study smarter,<br />
            <span style={{ color: colors.beige }}>not harder</span>
          </h1>
          <p style={{ fontSize: 17, color: colors.textSecondary, lineHeight: 1.7, maxWidth: 480, margin: "0 auto 2rem" }}>
            MindSync turns your notes, PDFs, and documents into flashcards instantly using AI. Upload anything and start studying in seconds.
          </p>
          <button className="sign-in-btn" onClick={onSignIn} style={{ fontSize: 15, color: colors.bg, background: colors.beige, border: "none", borderRadius: 24, padding: "12px 32px", cursor: "pointer", fontWeight: 500 }}>
            Get started with Google
          </button>
          <div style={{ fontSize: 12, color: colors.textDim, marginTop: 12 }}>Free to use · No credit card required</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, animation: "fadeSlideIn 0.6s ease 0.2s both" }}>
          {[
            { icon: "📄", title: "Any document", desc: "Upload PDF, DOCX, PPTX, TXT, or images and get flashcards instantly" },
            { icon: "🤖", title: "AI powered", desc: "Claude AI reads your content and generates smart, concise Q&A pairs" },
            { icon: "🃏", title: "Interactive cards", desc: "Flip cards, navigate your deck, and track your progress as you study" },
            { icon: "☁️", title: "Saved decks", desc: "Sign in to save your decks and access them anytime, anywhere" },
          ].map((f) => (
            <div key={f.title} className="feature-card" style={{ background: colors.bgCard, border: `0.5px solid ${colors.border}`, borderRadius: 12, padding: "1.25rem" }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: colors.textPrimary, marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "4rem", fontSize: 13, color: colors.textDim, animation: "fadeIn 0.6s ease 0.3s both" }}>
          © 2026 MindSync
        </div>
      </div>
    </div>
  );
}

// NAVBAR
function Navbar({ page, setPage, user }) {
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "2rem", animation: "fadeSlideIn 0.5s ease both" }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: colors.beige, display: "flex", alignItems: "center", justifyContent: "center", color: colors.bg, fontSize: 16, fontWeight: 600 }}>M</div>
      <span style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, marginRight: 8 }}>MindSync</span>
      {["Home", "My Decks", "Settings"].map((p) => (
        <button key={p} className="nav-link" onClick={() => setPage(p)} style={{ fontSize: 13, color: page === p ? colors.beigeLight : colors.textDim, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6, background: page === p ? "rgba(200,184,154,0.08)" : "transparent" }}>
          {p}
        </button>
      ))}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, color: colors.textDim }}>{user?.displayName}</span>
        <button onClick={signOutUser} style={{ fontSize: 12, color: colors.textDim, background: "none", border: `0.5px solid ${colors.border}`, borderRadius: 20, padding: "4px 12px", cursor: "pointer" }}>Sign out</button>
      </div>
    </nav>
  );
}

// HOME PAGE
function HomePage({ cardCount, setCardCount }) {
  const [notes, setNotes] = useState("");
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [deckVisible, setDeckVisible] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  async function handleFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const supported = ["pdf", "docx", "txt", "pptx", "png", "jpg", "jpeg", "webp"];
    if (!supported.includes(ext)) { setStatus("Unsupported file type."); return; }
    setUploadedFile(file);
    setStatus(`File loaded: ${file.name}`);
    if (!["png", "jpg", "jpeg", "webp"].includes(ext)) {
      try {
        const text = await extractTextFromFile(file);
        setNotes(text);
      } catch (e) { setStatus("Could not read file. Try a different one."); }
    }
  }

  async function generateCards() {
    if (!notes.trim() && !uploadedFile) { setStatus("Paste some notes or upload a file first."); return; }
    setLoading(true); setDeckVisible(false); setStatus("Generating flashcards..."); setCards([]);
    try {
      const ext = uploadedFile?.name.split(".").pop().toLowerCase();
      const isImage = uploadedFile && ["png", "jpg", "jpeg", "webp"].includes(ext);
      let response;
      if (isImage) {
        const base64 = await fileToBase64(uploadedFile);
        const mediaType = `image/${ext === "jpg" ? "jpeg" : ext}`;
        response = await fetch("http://127.0.0.1:8000/generate-from-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: base64, media_type: mediaType, count: cardCount }) });
      } else {
        response = await fetch("http://127.0.0.1:8000/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes, count: cardCount }) });
      }
      const data = await response.json();
      let text = data.flashcards;
      text = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("No cards");
      setCards(parsed.map((c, i) => ({ id: i, q: c.q, a: c.a })));
      setCurrentIndex(0); setIsFlipped(false);
      setStatus(`${parsed.length} cards ready`);
      setTimeout(() => setDeckVisible(true), 50);
    } catch (err) { setStatus("Something went wrong. Try again."); console.error(err); }
    setLoading(false);
  }

  function navigate(dir) {
    const next = currentIndex + dir;
    if (next < 0 || next >= cards.length) return;
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(next), 150);
  }

  function jumpTo(index) { setIsFlipped(false); setTimeout(() => setCurrentIndex(index), 150); }

  function deleteCard(e) {
    e.stopPropagation();
    const updated = cards.filter((_, i) => i !== currentIndex);
    setCards(updated); setCurrentIndex(Math.min(currentIndex, updated.length - 1));
    setIsFlipped(false); setStatus(`${updated.length} cards remaining`);
  }

  const card = cards[currentIndex];
  const progress = cards.length ? Math.round(((currentIndex + 1) / cards.length) * 100) : 0;

  return (
    <div>
      <div style={{ background: colors.bgCard, border: `0.5px solid ${colors.border}`, borderRadius: 12, padding: "1.25rem", marginBottom: "1rem", overflow: "hidden", animation: "fadeSlideIn 0.5s ease 0.1s both" }}>
        <label style={{ fontSize: 11, fontWeight: 500, color: colors.textSecondary, marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" }}>Upload a file</label>
        <div className={`upload-zone${dragging ? " dragging" : ""}`} style={{ width: "100%", boxSizing: "border-box", padding: "1rem", borderRadius: 8, border: `0.5px dashed rgba(200,184,154,0.25)`, background: "rgba(200,184,154,0.02)", cursor: "pointer", textAlign: "center", marginBottom: 10 }}
          onClick={() => fileInputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>Click to upload or drag and drop</div>
          <div style={{ fontSize: 11, color: colors.textDim, marginTop: 4 }}>PDF, DOCX, PPTX, TXT, PNG, JPG</div>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.webp" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        {uploadedFile && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: colors.beigeDim, border: `0.5px solid ${colors.beige}`, fontSize: 12, color: colors.beige, marginBottom: 10 }}>
            {uploadedFile.name}
            <span onClick={() => { setUploadedFile(null); setNotes(""); }} style={{ cursor: "pointer", opacity: 0.6 }}>✕</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0" }}>
          <div style={{ flex: 1, height: 1, background: colors.border }} />
          <span style={{ fontSize: 11, color: colors.textDim }}>or paste notes</span>
          <div style={{ flex: 1, height: 1, background: colors.border }} />
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste lecture notes, textbook excerpts, or any study material..."
          style={{ width: "100%", boxSizing: "border-box", minHeight: 100, resize: "vertical", fontFamily: "system-ui, sans-serif", fontSize: 14, padding: "10px 12px", borderRadius: 8, border: `0.5px solid ${colors.border}`, background: colors.bgInput, color: colors.textPrimary, lineHeight: 1.6 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[5, 8, 12, 15].map((n) => (
              <button key={n} onClick={() => setCardCount(n)} style={{ padding: "5px 14px", borderRadius: 20, border: cardCount === n ? `0.5px solid ${colors.beige}` : `0.5px solid ${colors.border}`, background: cardCount === n ? colors.beigeDim : "rgba(255,255,255,0.03)", fontSize: 13, color: cardCount === n ? colors.beigeLight : colors.textSecondary, cursor: "pointer", transition: "all 0.2s ease" }}>{n}</button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: colors.textDim }}>cards</span>
          <button className={loading ? "generate-btn-loading" : ""} onClick={generateCards} disabled={loading}
            style={{ marginLeft: "auto", padding: "8px 22px", borderRadius: 20, border: "none", background: colors.beige, color: colors.bg, fontSize: 14, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 13, color: colors.textDim, marginBottom: "1rem", minHeight: 18 }}>{status}</div>

      {cards.length > 0 && (
        <div style={{ opacity: deckVisible ? 1 : 0, transform: deckVisible ? "translateY(0)" : "translateY(12px)", transition: "opacity 0.4s ease, transform 0.4s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: colors.textSecondary }}>Deck · {cards.length} cards</span>
            <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 2, margin: "0 12px" }}>
              <div style={{ height: "100%", background: colors.beige, borderRadius: 2, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)", width: `${progress}%` }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => navigate(-1)} disabled={currentIndex === 0} style={{ width: 28, height: 28, borderRadius: 8, border: `0.5px solid ${colors.border}`, background: colors.bgInput, color: colors.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>‹</button>
              <span style={{ fontSize: 12, color: colors.textDim, minWidth: 36, textAlign: "center" }}>{currentIndex + 1} / {cards.length}</span>
              <button onClick={() => navigate(1)} disabled={currentIndex === cards.length - 1} style={{ width: 28, height: 28, borderRadius: 8, border: `0.5px solid ${colors.border}`, background: colors.bgInput, color: colors.textSecondary, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>›</button>
            </div>
          </div>

          <div style={{ width: "100%", perspective: 1200, marginBottom: "1rem", cursor: "pointer", position: "relative", animation: "cardEntrance 0.5s ease both" }} onClick={() => setIsFlipped((f) => !f)}>
            <div style={{ position: "relative", width: "100%", height: 220, transformStyle: "preserve-3d", transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1)", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
              <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", borderRadius: 12, border: `0.5px solid ${colors.border}`, background: colors.bgInput, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
                <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,0.05)", color: colors.textDim }}>Question</div>
                <div style={{ fontSize: 17, textAlign: "center", lineHeight: 1.6, color: "#d8d0c4", maxWidth: 480 }}>{card.q}</div>
                <div style={{ fontSize: 12, color: colors.textDim, marginTop: 16 }}>tap to reveal</div>
              </div>
              <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", borderRadius: 12, border: `0.5px solid rgba(200,184,154,0.25)`, background: "rgba(200,184,154,0.07)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
                <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14, padding: "3px 10px", borderRadius: 20, background: colors.beigeDim, color: colors.beige }}>Answer</div>
                <div style={{ fontSize: 17, textAlign: "center", lineHeight: 1.6, color: colors.beigeLight, maxWidth: 480 }}>{card.a}</div>
                <div style={{ fontSize: 12, color: "rgba(200,184,154,0.4)", marginTop: 16 }}>tap to flip back</div>
              </div>
            </div>
            <button onClick={deleteCard} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: 8, border: `0.5px solid ${colors.border}`, background: colors.bgInput, color: colors.textDim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🗑</button>
          </div>

          <hr style={{ border: "none", borderTop: `0.5px solid ${colors.border}`, margin: "1.25rem 0" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
            {cards.map((c, i) => (
              <div key={c.id} className="mini-card-hover" onClick={() => jumpTo(i)}
                style={{ border: i === currentIndex ? `0.5px solid ${colors.beige}` : `0.5px solid ${colors.border}`, borderRadius: 8, padding: "10px 12px", background: i === currentIndex ? colors.beigeDim : "rgba(255,255,255,0.02)", cursor: "pointer", animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both` }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#c8c0b4", marginBottom: 4, lineHeight: 1.4 }}>{c.q}</div>
                <div style={{ fontSize: 11, color: colors.textDim, lineHeight: 1.4 }}>{c.a}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// MY DECKS PAGE
function MyDecksPage() {
  return (
    <div style={{ animation: "fadeSlideIn 0.5s ease both" }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, color: colors.textPrimary, marginBottom: 8 }}>My Decks</h2>
      <p style={{ fontSize: 14, color: colors.textSecondary, marginBottom: "2rem" }}>Your saved flashcard decks will appear here.</p>
      <div style={{ textAlign: "center", padding: "4rem 1rem", border: `0.5px dashed ${colors.border}`, borderRadius: 12, color: colors.textDim, fontSize: 14, lineHeight: 2 }}>
        No decks saved yet.<br />Generate some flashcards and save your deck!
      </div>
    </div>
  );
}

// SETTINGS PAGE
function SettingsPage({ cardCount, setCardCount }) {
  return (
    <div style={{ animation: "fadeSlideIn 0.5s ease both" }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, color: colors.textPrimary, marginBottom: 8 }}>Settings</h2>
      <p style={{ fontSize: 14, color: colors.textSecondary, marginBottom: "2rem" }}>Customize your MindSync experience.</p>

      <div style={{ background: colors.bgCard, border: `0.5px solid ${colors.border}`, borderRadius: 12, padding: "1.25rem", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary, marginBottom: 4 }}>Default card count</div>
        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>How many flashcards to generate by default</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[5, 8, 12, 15].map((n) => (
            <button key={n} onClick={() => setCardCount(n)} style={{ padding: "6px 16px", borderRadius: 20, border: cardCount === n ? `0.5px solid ${colors.beige}` : `0.5px solid ${colors.border}`, background: cardCount === n ? colors.beigeDim : "rgba(255,255,255,0.03)", fontSize: 13, color: cardCount === n ? colors.beigeLight : colors.textSecondary, cursor: "pointer", transition: "all 0.2s ease" }}>{n}</button>
          ))}
        </div>
      </div>

      <div style={{ background: colors.bgCard, border: `0.5px solid ${colors.border}`, borderRadius: 12, padding: "1.25rem" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary, marginBottom: 4 }}>About MindSync</div>
        <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.8 }}>
          Built with React, FastAPI, and Claude AI.<br />
          Version 1.0.0
        </div>
      </div>
    </div>
  );
}

// MAIN APP
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("Home");
  const [cardCount, setCardCount] = useState(8);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = globalStyles;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14, color: colors.textDim }}>Loading...</div>
    </div>
  );

  if (!user) return <LandingPage onSignIn={signInWithGoogle} />;

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "2rem 1rem", fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", width: 320, height: 320, borderRadius: "50%", background: colors.navyLight, top: -80, right: -80, opacity: 0.6, pointerEvents: "none" }} />
      <div style={{ position: "fixed", width: 200, height: 200, borderRadius: "50%", background: colors.navyMid, bottom: 60, left: -60, opacity: 0.5, pointerEvents: "none" }} />

      <div style={{ maxWidth: 680, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Navbar page={page} setPage={setPage} user={user} />
        {page === "Home" && <HomePage cardCount={cardCount} setCardCount={setCardCount} />}
        {page === "My Decks" && <MyDecksPage />}
        {page === "Settings" && <SettingsPage cardCount={cardCount} setCardCount={setCardCount} />}
      </div>
    </div>
  );
}
