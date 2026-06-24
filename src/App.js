import { useState, useEffect } from "react";

const API_KEY = process.env.REACT_APP_API_KEY;

const globalStyles = `
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(74,124,74,0.5); }
    50% { box-shadow: 0 0 0 8px rgba(74,124,74,0); }
  }
  @keyframes cardEntrance {
    from { opacity: 0; transform: scale(0.95) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .mini-card-hover:hover {
    transform: translateY(-2px);
    border-color: rgba(74,124,74,0.6) !important;
    transition: transform 0.2s ease, border-color 0.2s ease !important;
  }
  .mini-card-hover {
    transition: transform 0.2s ease, border-color 0.2s ease;
  }
  .generate-btn-loading {
    animation: pulse 1.2s ease-in-out infinite;
  }
`;

export default function App() {
  const [notes, setNotes] = useState("");
  const [cardCount, setCardCount] = useState(8);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [deckVisible, setDeckVisible] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = globalStyles;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  async function generateCards() {
    if (!notes.trim()) { setStatus("Paste some notes first."); return; }
    setLoading(true);
    setDeckVisible(false);
    setStatus("Generating flashcards...");
    setCards([]);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: `You are a study assistant. Generate exactly ${cardCount} flashcards from the provided notes. Return ONLY a valid JSON array, no markdown, no explanation. Format: [{"q": "question text", "a": "answer text"}, ...]. Keep questions concise and answers clear.`,
          messages: [{ role: "user", content: `Generate ${cardCount} flashcards from these notes:\n\n${notes}` }],
        }),
      });

      const data = await response.json();
      let text = data.content.map((i) => i.text || "").join("");
      text = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("No cards returned");

      setCards(parsed.map((c, i) => ({ id: i, q: c.q, a: c.a })));
      setCurrentIndex(0);
      setIsFlipped(false);
      setStatus(`${parsed.length} cards ready`);
      setTimeout(() => setDeckVisible(true), 50);
    } catch (err) {
      setStatus("Something went wrong. Try again.");
      console.error(err);
    }

    setLoading(false);
  }

  function navigate(dir) {
    const next = currentIndex + dir;
    if (next < 0 || next >= cards.length) return;
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(next), 150);
  }

  function jumpTo(index) {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex(index), 150);
  }

  function deleteCard(e) {
    e.stopPropagation();
    const updated = cards.filter((_, i) => i !== currentIndex);
    setCards(updated);
    setCurrentIndex(Math.min(currentIndex, updated.length - 1));
    setIsFlipped(false);
    setStatus(`${updated.length} cards remaining`);
  }

  const card = cards[currentIndex];
  const progress = cards.length ? Math.round(((currentIndex + 1) / cards.length) * 100) : 0;

  const s = {
    app: { minHeight: "100vh", background: "#1a1f1a", padding: "2rem 1rem", fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden" },
    circle1: { position: "fixed", width: 320, height: 320, borderRadius: "50%", background: "#2d4a2d", top: -80, right: -80, opacity: 0.6, pointerEvents: "none" },
    circle2: { position: "fixed", width: 200, height: 200, borderRadius: "50%", background: "#1e3a1e", bottom: 60, left: -60, opacity: 0.5, pointerEvents: "none" },
    circle3: { position: "fixed", width: 120, height: 120, borderRadius: "50%", background: "#3d5e3d", bottom: 180, right: 80, opacity: 0.3, pointerEvents: "none" },
    content: { position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto" },
    nav: { display: "flex", alignItems: "center", gap: 10, marginBottom: "2rem", animation: "fadeSlideIn 0.5s ease both" },
    logo: { width: 34, height: 34, borderRadius: 8, background: "#4a7c4a", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8e6c8", fontSize: 16, fontWeight: 500 },
    brand: { fontSize: 17, fontWeight: 500, color: "#e8f0e8" },
    tagline: { fontSize: 12, color: "#6b8f6b", marginLeft: "auto" },
    inputCard: { background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "1.25rem", marginBottom: "1rem", animation: "fadeSlideIn 0.5s ease 0.1s both" },
    label: { fontSize: 11, fontWeight: 500, color: "#6b8f6b", marginBottom: 8, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" },
    textarea: { width: "100%", minHeight: 110, resize: "vertical", fontFamily: "system-ui, sans-serif", fontSize: 14, padding: "10px 12px", borderRadius: 8, border: "0.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#e8f0e8", lineHeight: 1.6 },
    row: { display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" },
    pill: (active) => ({ padding: "5px 14px", borderRadius: 20, border: active ? "0.5px solid #4a7c4a" : "0.5px solid rgba(255,255,255,0.1)", background: active ? "rgba(100,180,100,0.15)" : "rgba(255,255,255,0.04)", fontSize: 13, color: active ? "#c8e6c8" : "#8aaa8a", cursor: "pointer", transition: "all 0.2s ease" }),
    btn: (disabled) => ({ marginLeft: "auto", padding: "8px 22px", borderRadius: 20, border: "none", background: "#4a7c4a", color: "#c8e6c8", fontSize: 14, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.7 : 1, transition: "background 0.2s ease" }),
    status: { fontSize: 13, color: "#6b8f6b", marginBottom: "1rem", minHeight: 18, animation: "fadeSlideIn 0.3s ease both" },
    deck: (visible) => ({ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)", transition: "opacity 0.4s ease, transform 0.4s ease" }),
    deckBar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    deckLabel: { fontSize: 12, fontWeight: 500, color: "#6b8f6b" },
    progressWrap: { flex: 1, height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 2, margin: "0 12px" },
    progressFill: { height: "100%", background: "#4a7c4a", borderRadius: 2, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)", width: `${progress}%` },
    navBtns: { display: "flex", alignItems: "center", gap: 6 },
    navBtn: { width: 28, height: 28, borderRadius: 8, border: "0.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#8aaa8a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, transition: "background 0.15s ease" },
    navCount: { fontSize: 12, color: "#6b8f6b", minWidth: 36, textAlign: "center" },
    cardScene: { width: "100%", perspective: 1200, marginBottom: "1rem", cursor: "pointer", position: "relative", animation: "cardEntrance 0.5s ease both" },
    cardInner: { position: "relative", width: "100%", height: 220, transformStyle: "preserve-3d", transition: "transform 0.45s cubic-bezier(0.4,0,0.2,1)", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" },
    cardBase: { position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" },
    cardFront: { background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.1)" },
    cardBack: { transform: "rotateY(180deg)", background: "rgba(74,124,74,0.2)", border: "0.5px solid rgba(100,180,100,0.3)" },
    tagFront: { fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,0.06)", color: "#6b8f6b" },
    tagBack: { fontSize: 11, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14, padding: "3px 10px", borderRadius: 20, background: "rgba(100,180,100,0.15)", color: "#90c090" },
    textFront: { fontSize: 17, textAlign: "center", lineHeight: 1.6, color: "#d8ead8", maxWidth: 480 },
    textBack: { fontSize: 17, textAlign: "center", lineHeight: 1.6, color: "#c8e6c8", maxWidth: 480 },
    hintFront: { fontSize: 12, color: "#4a6b4a", marginTop: 16 },
    hintBack: { fontSize: 12, color: "#5a8f5a", marginTop: 16 },
    deleteBtn: { position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: 8, border: "0.5px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#6b8f6b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, transition: "all 0.2s ease" },
    divider: { border: "none", borderTop: "0.5px solid rgba(255,255,255,0.07)", margin: "1.25rem 0" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 },
    miniCard: (active) => ({ border: active ? "0.5px solid #4a7c4a" : "0.5px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px", background: active ? "rgba(74,124,74,0.12)" : "rgba(255,255,255,0.03)", cursor: "pointer" }),
    miniQ: { fontSize: 12, fontWeight: 500, color: "#c8dac8", marginBottom: 4, lineHeight: 1.4 },
    miniA: { fontSize: 11, color: "#6b8f6b", lineHeight: 1.4 },
    empty: { textAlign: "center", padding: "3rem 1rem", border: "0.5px dashed rgba(255,255,255,0.08)", borderRadius: 12, color: "#4a6b4a", fontSize: 14, lineHeight: 2 },
  };

  return (
    <div style={s.app}>
      <div style={s.circle1} />
      <div style={s.circle2} />
      <div style={s.circle3} />

      <div style={s.content}>
        <div style={s.nav}>
          <div style={s.logo}>M</div>
          <span style={s.brand}>MindSync</span>
          <span style={s.tagline}>powered by Claude AI</span>
        </div>

        <div style={s.inputCard}>
          <label style={s.label}>Your notes</label>
          <textarea
            style={s.textarea}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste lecture notes, textbook excerpts, or any study material..."
          />
          <div style={s.row}>
            <div style={{ display: "flex", gap: 6 }}>
              {[5, 8, 12, 15].map((n) => (
                <button key={n} style={s.pill(cardCount === n)} onClick={() => setCardCount(n)}>{n}</button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: "#4a6b4a" }}>cards</span>
            <button
              className={loading ? "generate-btn-loading" : ""}
              style={s.btn(loading)}
              onClick={generateCards}
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>

        <div style={s.status}>{status}</div>

        {cards.length > 0 && (
          <div style={s.deck(deckVisible)}>
            <div style={s.deckBar}>
              <span style={s.deckLabel}>Deck · {cards.length} cards</span>
              <div style={s.progressWrap}><div style={s.progressFill} /></div>
              <div style={s.navBtns}>
                <button style={s.navBtn} onClick={() => navigate(-1)} disabled={currentIndex === 0}>‹</button>
                <span style={s.navCount}>{currentIndex + 1} / {cards.length}</span>
                <button style={s.navBtn} onClick={() => navigate(1)} disabled={currentIndex === cards.length - 1}>›</button>
              </div>
            </div>

            <div style={s.cardScene} onClick={() => setIsFlipped((f) => !f)}>
              <div style={s.cardInner}>
                <div style={{ ...s.cardBase, ...s.cardFront }}>
                  <div style={s.tagFront}>Question</div>
                  <div style={s.textFront}>{card.q}</div>
                  <div style={s.hintFront}>tap to reveal</div>
                </div>
                <div style={{ ...s.cardBase, ...s.cardBack }}>
                  <div style={s.tagBack}>Answer</div>
                  <div style={s.textBack}>{card.a}</div>
                  <div style={s.hintBack}>tap to flip back</div>
                </div>
              </div>
              <button style={s.deleteBtn} onClick={deleteCard}>🗑</button>
            </div>

            <hr style={s.divider} />

            <div style={s.grid}>
              {cards.map((c, i) => (
                <div
                  key={c.id}
                  className="mini-card-hover"
                  style={{
                    ...s.miniCard(i === currentIndex),
                    animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both`,
                  }}
                  onClick={() => jumpTo(i)}
                >
                  <div style={s.miniQ}>{c.q}</div>
                  <div style={s.miniA}>{c.a}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {cards.length === 0 && status && !loading && (
          <div style={s.empty}>No cards yet.<br />Paste your notes above and hit generate.</div>
        )}
      </div>
    </div>
  );
}
