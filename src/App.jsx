import React, { useState, useEffect, useRef } from "react";
import { sGet, sSet, sList, sDel } from "./storage";

/* =========================================================
   머니 서바이벌 — 직업 / 월급 / 분산투자 / 뉴스속보
   · 혼자 연습: 한 화면에서 완결 (저장 불필요)
   · 수업 참여: 다연쌤이 '속보 띄우기'를 누르면 전원 동시에 속보 (공유 저장 필요)
   · 다연쌤: 라운드/속보 제어 + 실시간 현황판
   1 단위 = 10만원
   ========================================================= */

const FONT = `
@import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Gothic+A1:wght@400;500;700;900&display=swap');
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: #c9a24baa; border-radius: 8px; }
@keyframes flipIn { from { transform: rotateY(90deg); opacity:0 } to { transform: rotateY(0); opacity:1 } }
@keyframes pop { 0%{transform:scale(.85);opacity:0} 60%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
@keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes slideDown { from{transform:translateY(-20px);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes pulseRed { 0%,100%{box-shadow:0 0 0 0 #ef444466} 50%{box-shadow:0 0 0 8px #ef444400} }
`;

const C = {
  bg: "linear-gradient(170deg,#fff5e8 0%,#fdeef4 48%,#edf2ff 100%)",
  panel: "#ffffff", panel2: "#f5f1fb",
  gold: "#bb7d10", goldDim: "#8a5b08",
  green: "#0f9d6e", red: "#df3b3b", text: "#232a3a",
  sub: "#79839a", line: "#ebe6f3", ink: "#2a1d04",
};
const UNIT = 10;

const JOBS = [
  { name: "의사", emoji: "🩺", salary: 65, color: "#ef4444", tag: "고소득·안정" },
  { name: "사업가", emoji: "💼", salary: [30, 65], color: "#f59e0b", tag: "수입 변동 큼" },
  { name: "약사", emoji: "💊", salary: 50, color: "#10b981", tag: "탄탄한 전문직" },
  { name: "대기업", emoji: "🏢", salary: 40, color: "#3b82f6", tag: "안정적 직장인" },
  { name: "유튜버", emoji: "🎥", salary: [5, 68], color: "#ec4899", tag: "대박 아니면 쪽박" },
  { name: "공무원", emoji: "🏛️", salary: 25, color: "#6366f1", tag: "박봉이지만 철밥통" },
  { name: "중소기업", emoji: "🏭", salary: 22, color: "#64748b", tag: "성실한 직장인" },
  { name: "프리랜서", emoji: "🎨", salary: [15, 45], color: "#14b8a6", tag: "자유롭지만 불안정" },
];
const jobByName = (n) => JOBS.find((j) => j.name === n);
const rollSalary = (job) =>
  Array.isArray(job.salary) ? job.salary[0] + Math.floor(Math.random() * (job.salary[1] - job.salary[0] + 1)) : job.salary;

const ASSETS = [
  { key: "bitcoin", name: "비트코인", color: "#f7931a" },
  { key: "stock", name: "주식", color: "#34d399" },
  { key: "savings", name: "적금", color: "#60a5fa" },
  { key: "luxury", name: "명품", color: "#c084fc" },
  { key: "checking", name: "입출금통장", color: "#94a3b8" },
];
const assetName = (k) => (k === "parents" ? "부모님 효도" : ASSETS.find((a) => a.key === k)?.name || k);

const ALLOC = [
  { key: "bitcoin", name: "비트코인", emoji: "₿", color: "#f7931a", hint: "고위험 고수익" },
  { key: "stock", name: "주식", emoji: "📈", color: "#34d399", hint: "중위험" },
  { key: "savings", name: "적금", emoji: "🏦", color: "#60a5fa", hint: "안전·소폭이익" },
  { key: "luxury", name: "명품", emoji: "👜", color: "#c084fc", hint: "감가 위험" },
  { key: "parents", name: "부모님 용돈", emoji: "🎁", color: "#fb7185", hint: "효도지수↑ (가끔 보답)" },
  { key: "checking", name: "입출금통장", emoji: "💳", color: "#94a3b8", hint: "그냥 보관 (변동 없음)" },
];

const CAT = {
  경제: "#e8c14d", 국제: "#60a5fa", IT: "#34d399", 부동산: "#fb923c", 사회: "#c084fc",
};

/* ====== 속보 이벤트 (리치 버전) ====== */
const EVENTS = [
  { id: "btc_etf", cat: "경제", icon: "🚀", title: "비트코인 현물 ETF에 기관 자금 폭발… 코인시장 환호",
    body: "글로벌 대형 운용사들이 일제히 코인 매수에 나섰습니다. '디지털 금' 내러티브가 부활하며 시장이 들썩이고 있습니다.",
    ticker: "비트코인 +60%·역대급 거래량·공포탐욕지수 '극도의 탐욕'",
    returns: { bitcoin: 0.6, stock: 0.05, savings: 0.004 } },
  { id: "ai_boom", cat: "IT", icon: "🤖", title: "AI 반도체 슈퍼사이클… 기술주 폭등",
    body: "AI 수요 폭발로 관련 기업 실적 전망이 상향됐습니다. 기술주를 중심으로 매수세가 몰렸습니다.",
    ticker: "기술주 +42%·AI 반도체 품귀·실적 어닝 서프라이즈",
    returns: { stock: 0.42, bitcoin: 0.06, savings: 0.004 } },
  { id: "luxury_resell", cat: "사회", icon: "👜", title: "한정판 명품 리셀가 폭등… 매장마다 '오픈런'",
    body: "인기 브랜드의 가격 인상과 품귀가 맞물리며 중고 명품 시세가 치솟았습니다. 되팔이 수익률이 주식을 앞질렀다는 분석도 나옵니다.",
    ticker: "명품 +28%·오픈런 대란·리셀 플랫폼 거래 폭주",
    returns: { luxury: 0.28, stock: 0.03, savings: 0.004 } },
  { id: "savings_gift", cat: "사회", icon: "🏦", title: "정부, 청년 적금 이자 두 배 우대 정책 발표",
    body: "안정적 자산 형성을 돕기 위한 파격 정책이 나왔습니다. 적금 가입자에게 추가 이자가 지급됩니다.",
    ticker: "적금 우대금리 지급·가입 문의 폭주",
    returns: { savings: 0.04 } },
  { id: "rate_up", cat: "경제", icon: "📉", title: "기준금리 0.5%p 깜짝 인상… 코인·증시 동반 급락",
    body: "중앙은행이 시장 예상을 깨고 금리를 큰 폭으로 올렸습니다. 위험자산에서 자금이 빠르게 이탈하며 비트코인이 직격탄을 맞았습니다.",
    ticker: "비트코인 -45%·코스피 약세·예·적금 금리는 상승",
    returns: { bitcoin: -0.45, stock: -0.12, savings: 0.012, luxury: -0.03 } },
  { id: "inflation", cat: "경제", icon: "🔥", title: "물가 고공행진… 현금 가치 '눈 녹듯'",
    body: "고물가가 이어지며 통장에 묶인 현금의 실질가치가 하락했습니다. 실물·코인이 인플레이션 방어수단으로 주목받습니다.",
    ticker: "물가 6%대·현금가치 하락·코인은 헤지 수단으로",
    returns: { bitcoin: 0.18, stock: -0.04, luxury: 0.06, savings: -0.005, checking: -0.05 } },
  { id: "crisis", cat: "국제", icon: "🌪️", title: "글로벌 금융위기 공포 확산… 자산시장 패닉",
    body: "대형 금융기관 부실 우려가 번지며 전 세계 증시가 동반 폭락했습니다. 투자자들이 일제히 현금 확보에 나섰습니다.",
    ticker: "코스피 -38%·비트코인 -35%·명품시장 급랭",
    returns: { bitcoin: -0.35, stock: -0.38, savings: 0.0, luxury: -0.18 } },
  { id: "filial", cat: "사회", icon: "🎁", title: "'효도 보답' 훈훈… 부모님이 목돈으로 화답",
    body: "그동안 꾸준히 용돈을 드린 자녀들에게 부모님이 목돈을 돌려주는 사례가 화제입니다. 효도가 곧 재테크라는 말이 나옵니다.",
    ticker: "효도 누적액의 80% 보답·따뜻한 미담 확산",
    returns: { savings: 0.004 }, parentsReturn: 0.8 },
];
const eventById = (id) => EVENTS.find((e) => e.id === id);

/* ====== 반(room) 코드 시스템 ====== */
const ROOMS = ["1반", "2반", "3반", "4반", "5반", "6반", "7반"];
const mkGKey  = (room) => `mg:room:${room}:game`;
const mkPKey  = (room, id) => `mg:room:${room}:p:${id}`;
const mkPPfx  = (room) => `mg:room:${room}:p:`;

/* ====== 유틸 ====== */
const fmt = (units) => {
  const man = Math.round(units) * UNIT;
  if (man === 0) return "0원";
  const s = man < 0 ? "-" : "", a = Math.abs(man);
  if (a >= 10000) { const e = Math.floor(a / 10000), r = a % 10000; return `${s}${e}억${r ? " " + r.toLocaleString() + "만" : ""}원`; }
  return `${s}${a.toLocaleString()}만원`;
};
const netWorth = (p) => (p.bitcoin || 0) + (p.stock || 0) + (p.savings || 0) + (p.luxury || 0) + (p.checking || 0);
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

function applyNews(rec, event, round) {
  const r = event.returns || {};
  const lines = []; let total = 0;
  ["bitcoin", "stock", "savings", "luxury", "checking"].forEach((k) => {
    const before = rec[k] || 0, rate = r[k] || 0;
    if (before <= 0 && rate === 0) return;
    const after = Math.max(0, Math.round(before * (1 + rate)));
    const diff = after - before; rec[k] = after; total += diff;
    if (before > 0 || rate !== 0) lines.push({ key: k, before, after, diff, rate });
  });
  if (event.parentsReturn && (rec.parents || 0) > 0) {
    const bonus = Math.round(rec.parents * event.parentsReturn);
    rec.checking += bonus; total += bonus;
    lines.push({ key: "parents", before: 0, after: bonus, diff: bonus, rate: event.parentsReturn, isParents: true });
  }
  return { round, eventId: event.id, title: event.title, total, lines };
}

/* ===================================================================== */
export default function App() {
  const [room, setRoom] = useState(null);
  const [mode, setMode] = useState(null);
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Gothic A1', sans-serif" }}>
      <style>{FONT}</style>
      {!room  ? <RoomSelect onPick={setRoom} />
        : !mode ? <ModeSelect onPick={setMode} room={room} onChangeRoom={() => { setRoom(null); setMode(null); }} />
        : mode === "admin" ? <AdminView onBack={() => setMode(null)} room={room} />
        : <PlayGame mode={mode} onBack={() => setMode(null)} room={room} />}
    </div>
  );
}

/* ====== 반 선택 ====== */
function RoomSelect({ onPick }) {
  return (
    <Centered>
      <div style={{ textAlign: "center", animation: "pop .4s" }}>
        <div style={{ fontSize: 54 }}>🏫</div>
        <Title size={38}>머니 서바이벌</Title>
        <p style={{ color: C.sub, marginTop: 8 }}>우리 반을 선택하세요</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 20, maxWidth: 320, marginInline: "auto" }}>
          {ROOMS.map((r) => (
            <button key={r} onClick={() => onPick(r)}
              style={{ padding: "14px 0", borderRadius: 14, border: `2px solid ${C.gold}`, background: "transparent",
                color: C.gold, fontFamily: "'Black Han Sans'", fontSize: 18, cursor: "pointer",
                boxShadow: "0 2px 0 " + C.goldDim }}>
              {r}
            </button>
          ))}
        </div>
        <p style={{ color: C.sub, fontSize: 12, marginTop: 16 }}>반마다 데이터가 분리됩니다</p>
      </div>
    </Centered>
  );
}

/* ====== 공용 UI ====== */
function Centered({ children }) { return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>{children}</div>; }
function Btn({ children, onClick, color = C.gold, fill, small, disabled, full }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ cursor: disabled ? "not-allowed" : "pointer", border: `2px solid ${color}`,
        background: fill ? color : "transparent", color: fill ? C.ink : color,
        fontFamily: "'Black Han Sans'", letterSpacing: 0.5, padding: small ? "8px 14px" : "13px 20px",
        fontSize: small ? 14 : 17, borderRadius: 12, opacity: disabled ? 0.4 : 1, width: full ? "100%" : "auto",
        boxShadow: fill && !disabled ? `0 4px 0 ${C.goldDim}` : "none" }}>{children}</button>
  );
}
const Title = ({ children, size = 30 }) => (
  <h1 style={{ fontFamily: "'Black Han Sans'", fontSize: size, margin: 0, letterSpacing: 1,
    background: `linear-gradient(95deg,#e07b2e,${C.gold})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{children}</h1>
);
const SectionLabel = ({ children }) => <div style={{ fontFamily: "'Black Han Sans'", color: C.gold, fontSize: 15 }}>{children}</div>;
const Badge = ({ children, color = C.gold }) => <span style={{ border: `1px solid ${color}`, color, borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{children}</span>;
const Empty = ({ children }) => <div style={{ background: C.panel, border: `1px dashed ${C.line}`, borderRadius: 14, padding: 24, textAlign: "center", color: C.sub, marginTop: 8 }}>{children}</div>;

/* ====== 모드 선택 ====== */
function ModeSelect({ onPick, room, onChangeRoom }) {
  return (
    <Centered>
      <div style={{ textAlign: "center", animation: "pop .4s" }}>
        <div style={{ fontSize: 54 }}>💰</div>
        <Title size={44}>머니 서바이벌</Title>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
          <Badge color={C.gold}>2학년 {room}</Badge>
          <button onClick={onChangeRoom} style={{ color: C.sub, background: "none", border: "none", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>반 변경</button>
        </div>
        <p style={{ color: C.sub, marginTop: 8 }}>직업을 뽑고, 월급을 굴리고, 뉴스 속보에서 살아남아라</p>
        <div style={{ display: "grid", gap: 12, marginTop: 30, width: 280, marginInline: "auto" }}>
          <Btn fill onClick={() => onPick("class")} full>🎓 수업 참여 (학생)</Btn>
          <Btn color={C.sub} onClick={() => onPick("admin")} full>🖥️ 다연쌤 화면</Btn>
        </div>
        <p style={{ color: C.sub, fontSize: 12, marginTop: 22, lineHeight: 1.6, maxWidth: 320 }}>
          학생은 '수업 참여'로 입장하고, 선생님은 '다연쌤 화면'을 엽니다.<br />
          모두 투자를 마치면 다연쌤이 속보를 띄워 전원 동시에 결과가 나와요.
        </p>
      </div>
    </Centered>
  );
}

/* ===================== 게임 (혼자/수업 공용) ===================== */
function PlayGame({ mode, onBack, room }) {
  const isClass = mode === "class";
  const GKEY = mkGKey(room);
  const pkey  = (id) => mkPKey(room, id);
  const ppfx  = mkPPfx(room);

  const [step, setStep] = useState("name"); // name|job|invest|waiting|news
  const [name, setName] = useState("");
  const [rec, setRec] = useState(null);
  const [round, setRound] = useState(1);
  const [event, setEvent] = useState(null);
  const [phase, setPhase] = useState("invest");
  const [finalList, setFinalList] = useState([]);
  const idRef = useRef(uid());
  const recRef = useRef(null), roundRef = useRef(1), stepRef = useRef("name");
  recRef.current = rec; roundRef.current = round; stepRef.current = step;

  const write = (r, rnd) => sSet(pkey(idRef.current), { ...r, id: idRef.current, name, round: rnd ?? roundRef.current });

  /* 수업 모드: 다연쌤 상태 폴링 */
  useEffect(() => {
    if (!isClass) return;
    let active = true;
    const poll = async () => {
      const g = (await sGet(GKEY)) || { round: 1, phase: "invest" };
      if (!active) return;
      setRound(g.round); setPhase(g.phase);
      if (g.phase === "end") {
        const keys = await sList(ppfx);
        const list = (await Promise.all(keys.map((k) => sGet(k)))).filter(Boolean).sort((a, b) => netWorth(b) - netWorth(a));
        if (active) { setFinalList(list); setStep("end"); }
        return;
      }
      const r = recRef.current;
      if (!r) return;
      if (g.phase === "invest" && (r.lastSalaryRound || 0) < g.round) {
        const sal = rollSalary(jobByName(r.job));
        const nr = { ...r, checking: r.checking + sal, lastSalaryAmt: sal, lastSalaryRound: g.round, ready: false };
        setRec(nr); recRef.current = nr; setEvent(null); setStep("invest"); write(nr, g.round);
      } else if (g.phase === "news" && g.newsId && stepRef.current !== "news") {
        setEvent(eventById(g.newsId)); setStep("news");
      }
    };
    poll(); const iv = setInterval(poll, 1500);
    return () => { active = false; clearInterval(iv); };
  }, [isClass]);

  const startJob = (job) => {
    const sal = rollSalary(job);
    const rnd = isClass ? roundRef.current : 1;
    const r = { id: idRef.current, name, job: job.name, bitcoin: 0, stock: 0, savings: 0, luxury: 0, checking: sal, parents: 0,
      lastSalaryAmt: sal, lastSalaryRound: rnd, ready: false, lastResult: null, jobChanged: false };
    setRec(r); recRef.current = r; setStep("invest");
    write(r, rnd);
  };

  const confirmInvest = (alloc) => {
    if (ALLOC.reduce((s, a) => s + (alloc[a.key] || 0), 0) !== rec.checking) return;
    const r = { ...rec };
    r.bitcoin += alloc.bitcoin || 0; r.stock += alloc.stock || 0; r.savings += alloc.savings || 0;
    r.luxury += alloc.luxury || 0; r.parents += alloc.parents || 0; r.checking = alloc.checking || 0;
    if (isClass) { r.ready = true; setRec(r); recRef.current = r; setStep("waiting"); write(r); }
    else { const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)]; setRec(r); recRef.current = r; setEvent(ev); setStep("news"); }
  };

  const reveal = () => {
    const r = { ...rec };
    const res = applyNews(r, event, round); r.lastResult = res;
    setRec(r); recRef.current = r; if (isClass) write(r);
  };

  const changeJob = (job) => {
    const r = { ...rec, job: job.name, jobChanged: true };
    r.checking = Math.max(0, r.checking - (r.lastSalaryAmt || 0)); // 이번 달 월급 반납
    r.lastSalaryAmt = 0;
    setRec(r); recRef.current = r; setStep("invest"); write(r);
  };

  const nextMonthSolo = () => {
    const sal = rollSalary(jobByName(rec.job));
    const r = { ...rec, checking: rec.checking + sal, lastSalaryAmt: sal };
    setRound((x) => x + 1); roundRef.current = round + 1;
    setRec(r); recRef.current = r; setEvent(null); setStep("invest");
  };

  if (step === "name") return <JoinScreen name={name} setName={setName} onJoin={() => setStep("job")} onBack={onBack} sub={isClass ? "수업 참여" : "혼자 연습"} />;
  if (step === "job") return <JobPick name={name} onPickJob={startJob} onBack={() => setStep("name")} />;
  if (step === "rejob") return <JobPick name={name} onPickJob={changeJob} onBack={() => setStep("invest")} rejob />;
  if (step === "end") return <FinalRanking list={finalList} meId={idRef.current} onBack={onBack} />;

  const job = jobByName(rec.job);
  const revealed = rec.lastResult && rec.lastResult.round === round;
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 26 }}>{job?.emoji}</span>
          <div>
            <div style={{ fontWeight: 900 }}>{name}</div>
            <div style={{ color: C.sub, fontSize: 12 }}>{rec.job} · {round}월차 {isClass && <Badge color="#60a5fa">수업</Badge>}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.sub, fontSize: 11 }}>총자산</div>
          <div style={{ fontFamily: "'Black Han Sans'", color: C.gold, fontSize: 18 }}>{fmt(netWorth(rec))}</div>
        </div>
      </div>

      <Portfolio rec={rec} />

      {step === "invest" && <InvestScreen rec={rec} onSubmit={confirmInvest} onChangeJob={() => setStep("rejob")} />}

      {step === "waiting" && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 26, marginTop: 14, textAlign: "center" }}>
          <div style={{ fontSize: 40, animation: "blink 1.6s infinite" }}>📡</div>
          <div style={{ fontWeight: 900, marginTop: 8 }}>투자 완료! 속보 대기 중…</div>
          <div style={{ color: C.sub, fontSize: 13, marginTop: 6 }}>모두 투자를 마치면 다연쌤이 속보를 띄웁니다.</div>
        </div>
      )}

      {step === "news" && (
        <>
          <NewsBanner event={event} />
          {!revealed ? (
            <div style={{ textAlign: "center", marginTop: 18 }}>
              <p style={{ color: C.sub, marginBottom: 12 }}>내 투자는 어떻게 됐을까?</p>
              <Btn fill onClick={reveal}>💥 투자 결과 확인</Btn>
            </div>
          ) : (
            <ResultBreakdown result={rec.lastResult} onNext={isClass ? null : nextMonthSolo} />
          )}
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 18 }}>
        <Btn small color={C.sub} onClick={() => { if (confirm("처음 화면으로 돌아갈까요?")) { try { sDel(pkey(idRef.current)); } catch(e) {} onBack(); } }}>나가기</Btn>
      </div>
    </div>
  );
}

function JoinScreen({ name, setName, onJoin, onBack, sub }) {
  return (
    <Centered>
      <div style={{ textAlign: "center", width: 300, animation: "pop .3s", position: "relative" }}>
        <span style={{ cursor: "pointer", color: C.sub, position: "absolute", left: -4, top: -8 }} onClick={onBack}>←</span>
        <div style={{ fontSize: 44 }}>🙋</div>
        <Title size={28}>이름을 입력하세요</Title>
        {sub && <div style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>{sub}</div>}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="닉네임"
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onJoin()}
          style={{ marginTop: 16, width: "100%", padding: 14, borderRadius: 12, border: `2px solid ${C.line}`, background: C.panel, color: C.text, fontSize: 16, textAlign: "center", outline: "none" }} />
        <div style={{ marginTop: 14 }}><Btn fill full disabled={!name.trim()} onClick={onJoin}>입장하기 →</Btn></div>
      </div>
    </Centered>
  );
}

function JobPick({ name, onPickJob, onBack, rejob }) {
  const [deck] = useState(() => [...JOBS].sort(() => Math.random() - 0.5));
  const [picked, setPicked] = useState(null);
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ cursor: "pointer", color: C.sub }} onClick={onBack}>←</span>
        <Title size={24}>{rejob ? "🔄 이직: 새 직업 고르기" : "직업 카드를 1장 고르세요"}</Title>
      </div>
      <p style={{ color: C.sub, marginTop: 6 }}>
        {rejob ? "주의: 이직하면 이번 달 월급은 받지 못해요. (게임당 1회)" : `${name}님, 카드를 뒤집어 보세요. 고른 카드가 당신의 직업이 됩니다.`}
      </p>
      {!picked ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 18 }}>
          {deck.map((job, i) => (
            <button key={i} onClick={() => setPicked(job)}
              style={{ aspectRatio: "3/4", borderRadius: 14, border: `2px solid ${C.gold}`, cursor: "pointer",
                background: "linear-gradient(135deg,#fff6e0,#ffe7b8)", color: C.gold, display: "grid", placeItems: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg,transparent 30%,#ffffffcc 50%,transparent 70%)", backgroundSize: "200% 100%", animation: `shimmer ${2 + (i % 3)}s linear infinite` }} />
              <span style={{ fontSize: 30, position: "relative" }}>❓</span>
              <span style={{ position: "absolute", bottom: 6, fontSize: 10, color: C.sub }}>#{i + 1}</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 24, animation: "flipIn .5s", textAlign: "center" }}>
          <div style={{ maxWidth: 240, margin: "0 auto", aspectRatio: "3/4", borderRadius: 18, border: `3px solid ${picked.color}`,
            background: `linear-gradient(160deg,${picked.color}33,${C.panel})`, display: "grid", placeContent: "center", gap: 6, padding: 16 }}>
            <div style={{ fontSize: 56 }}>{picked.emoji}</div>
            <div style={{ fontFamily: "'Black Han Sans'", fontSize: 30, color: picked.color }}>{picked.name}</div>
            <div style={{ color: C.sub, fontSize: 13 }}>{picked.tag}</div>
            <div style={{ marginTop: 8, fontFamily: "'Black Han Sans'", color: C.gold, fontSize: 18 }}>
              월급 {Array.isArray(picked.salary) ? `${fmt(picked.salary[0])}~${fmt(picked.salary[1])}` : fmt(picked.salary)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
            <Btn color={C.sub} onClick={() => setPicked(null)}>다시 고르기</Btn>
            <Btn fill onClick={() => onPickJob(picked)}>{rejob ? "이 직업으로 이직! →" : "이 직업으로 시작! →"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function InvestScreen({ rec, onSubmit, onChangeJob }) {
  const available = rec.checking;
  const [a, setA] = useState(() => Object.fromEntries(ALLOC.map((x) => [x.key, 0])));
  const used = ALLOC.reduce((s, x) => s + (a[x.key] || 0), 0);
  const diff = available - used, matched = diff === 0;
  const set = (k, v) => setA((p) => ({ ...p, [k]: Math.min(available, Math.max(0, v)) }));
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <SectionLabel>💸 월급을 전부 배분하세요</SectionLabel>
        <span style={{ fontSize: 12, color: C.sub }}>이번 달 월급 {fmt(rec.lastSalaryAmt || 0)}</span>
      </div>
      <div style={{ textAlign: "center", margin: "6px 0 10px" }}>
        <span style={{ color: C.sub, fontSize: 12 }}>배분할 총액 </span>
        <span style={{ fontFamily: "'Black Han Sans'", color: C.gold, fontSize: 20 }}>{fmt(available)}</span>
      </div>
      <div style={{ textAlign: "center", padding: "10px 12px", borderRadius: 12, marginBottom: 12, fontWeight: 700,
        border: `2px solid ${matched ? C.green : C.red}`, background: matched ? "#e8f8f1" : "#fdeceb",
        color: matched ? C.green : C.red, animation: diff < 0 ? "shake .35s" : "none" }}>
        {diff < 0 && `⚠️ ${fmt(-diff)} 초과했습니다! 줄여주세요`}
        {diff > 0 && `🔸 아직 ${fmt(diff)} 남았습니다 (전부 배분해야 진행돼요)`}
        {matched && "✅ 딱 맞췄습니다! 진행할 수 있어요"}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {ALLOC.map((item) => (
          <div key={item.key} style={{ background: C.panel2, borderRadius: 12, padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>{item.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, color: item.color }}>{item.name}</div>
                <div style={{ fontSize: 11, color: C.sub }}>{item.hint}</div>
              </div>
              <div style={{ fontFamily: "'Black Han Sans'", color: C.gold, minWidth: 80, textAlign: "right" }}>{fmt(a[item.key])}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <Stepper onClick={() => set(item.key, a[item.key] - 5)}>-5</Stepper>
              <Stepper onClick={() => set(item.key, a[item.key] - 1)}>-1</Stepper>
              <input type="range" min={0} max={available} value={a[item.key]} onChange={(e) => set(item.key, +e.target.value)} style={{ flex: 1, accentColor: item.color }} />
              <Stepper onClick={() => set(item.key, a[item.key] + 1)}>+1</Stepper>
              <Stepper onClick={() => set(item.key, a[item.key] + 5)}>+5</Stepper>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <Btn fill full disabled={!matched} onClick={() => onSubmit(a)}>{matched ? "투자 확정 →" : "금액을 딱 맞춰주세요"}</Btn>
      </div>
      {onChangeJob && !rec.jobChanged && (
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <Btn small color="#fb923c" onClick={() => { if (confirm("이직하면 이번 달 월급을 받지 못합니다. (게임당 1회) 진행할까요?")) onChangeJob(); }}>🔄 이직하기 (1회 · 이번 달 월급 없음)</Btn>
        </div>
      )}
      {rec.jobChanged && <p style={{ color: C.sub, fontSize: 11, textAlign: "center", marginTop: 8 }}>이직 기회는 모두 사용했어요.</p>}
      <p style={{ color: C.sub, fontSize: 11, textAlign: "center", marginTop: 8 }}>단위: 1칸 = 10만원 · 남길 돈은 💳입출금통장에</p>
    </div>
  );
}
const Stepper = ({ children, onClick }) => <button onClick={onClick} style={{ background: C.panel2, color: C.sub, border: `1px solid ${C.line}`, borderRadius: 8, padding: "4px 7px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>{children}</button>;

function ResultBreakdown({ result, onNext }) {
  return (
    <div style={{ marginTop: 12, animation: "pop .35s" }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
        <SectionLabel>📑 나의 투자 결과</SectionLabel>
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {result.lines.length === 0 && <div style={{ color: C.sub }}>이번엔 영향받은 자산이 없어요.</div>}
          {result.lines.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel2, borderRadius: 10, padding: "8px 10px" }}>
              <span style={{ flex: 1, fontWeight: 700 }}>{l.isParents ? "🎁 부모님 보답" : assetName(l.key)}
                {!l.isParents && <span style={{ color: C.sub, fontSize: 11, marginLeft: 6 }}>{(l.rate * 100).toFixed(1)}%</span>}</span>
              {!l.isParents && <span style={{ color: C.sub, fontSize: 12 }}>{fmt(l.before)} →</span>}
              <span style={{ fontWeight: 900, color: l.diff >= 0 ? C.green : C.red, minWidth: 90, textAlign: "right" }}>{l.diff >= 0 ? "+" : "-"}{fmt(Math.abs(l.diff))}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>이번 달 손익</b>
          <span style={{ fontFamily: "'Black Han Sans'", fontSize: 22, color: result.total >= 0 ? C.green : C.red }}>{result.total >= 0 ? "▲ +" : "▼ -"}{fmt(Math.abs(result.total))}</span>
        </div>
      </div>
      {onNext ? (
        <div style={{ marginTop: 14 }}><Btn fill full onClick={onNext}>⏭ 다음 달로 (월급 받기)</Btn></div>
      ) : (
        <p style={{ textAlign: "center", color: C.sub, fontSize: 13, marginTop: 12, animation: "blink 1.6s infinite" }}>다연쌤이 다음 달을 시작하길 기다리는 중…</p>
      )}
    </div>
  );
}

function Portfolio({ rec }) {
  const net = netWorth(rec);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 12 }}>
      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: "#eceaf3" }}>
        {ASSETS.map((a) => { const v = rec[a.key] || 0; return v > 0 ? <div key={a.key} style={{ width: `${(v / Math.max(1, net)) * 100}%`, background: a.color }} /> : null; })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 10 }}>
        {ASSETS.map((a) => (
          <div key={a.key} style={{ fontSize: 12 }}><span style={{ color: a.color }}>● </span><span style={{ color: C.sub }}>{a.name}</span><br /><b>{fmt(rec[a.key] || 0)}</b></div>
        ))}
        {(rec.parents || 0) > 0 && <div style={{ fontSize: 12 }}><span style={{ color: "#fb7185" }}>🎁 </span><span style={{ color: C.sub }}>누적 효도</span><br /><b>{fmt(rec.parents)}</b></div>}
      </div>
    </div>
  );
}

/* ====== 최종 순위 / 시상대 ====== */
function FinalRanking({ list, meId, onBack }) {
  const top3 = list.slice(0, 3), rest = list.slice(3);
  const myRank = list.findIndex((p) => p.id === meId);
  const me = myRank >= 0 ? list[myRank] : null;
  const filial = [...list].sort((a, b) => (b.parents || 0) - (a.parents || 0))[0];
  const medals = ["🥇", "🥈", "🥉"], pColor = ["#e8c14d", "#cbd5e1", "#cd7f32"], pHeight = [140, 105, 88];
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 16, animation: "pop .4s" }}>
      <div style={{ textAlign: "center", marginTop: 6 }}>
        <div style={{ fontSize: 46 }}>🏆</div>
        <Title size={34}>최종 순위</Title>
      </div>
      {me && (
        <div style={{ textAlign: "center", margin: "14px 0", background: C.panel, border: `2px solid ${C.gold}`, borderRadius: 14, padding: 14, animation: "pop .5s" }}>
          <div style={{ color: C.sub, fontSize: 13 }}>{me.name}님은</div>
          <div style={{ fontFamily: "'Black Han Sans'", fontSize: 30, color: C.gold }}>{myRank + 1}등 🎉</div>
          <div style={{ marginTop: 2 }}>총자산 <b style={{ color: C.gold }}>{fmt(netWorth(me))}</b></div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "end", marginTop: 8 }}>
        {[1, 0, 2].map((idx) => {
          const p = top3[idx];
          if (!p) return <div key={idx} />;
          const job = jobByName(p.job), isMe = p.id === meId;
          return (
            <div key={p.id} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28 }}>{medals[idx]}</div>
              <div style={{ fontSize: 22 }}>{job?.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: 13, color: isMe ? C.gold : C.text }}>{p.name}{isMe ? " (나)" : ""}</div>
              <div style={{ fontFamily: "'Black Han Sans'", fontSize: 12, color: C.gold }}>{fmt(netWorth(p))}</div>
              <div style={{ height: pHeight[idx], marginTop: 6, borderRadius: "10px 10px 0 0",
                background: `linear-gradient(180deg,${pColor[idx]},${pColor[idx]}33)`, border: `1px solid ${pColor[idx]}`,
                display: "grid", placeItems: "start center", paddingTop: 6, fontFamily: "'Black Han Sans'", color: C.ink, fontSize: 18 }}>{idx + 1}</div>
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginTop: 14 }}>
          {rest.map((p, i) => {
            const isMe = p.id === meId, job = jobByName(p.job);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel, border: `1px solid ${isMe ? C.gold : C.line}`, borderRadius: 10, padding: "8px 12px" }}>
                <span style={{ fontFamily: "'Black Han Sans'", color: C.sub, width: 24 }}>{i + 4}</span>
                <span style={{ fontSize: 18 }}>{job?.emoji}</span>
                <span style={{ flex: 1, fontWeight: 700, color: isMe ? C.gold : C.text }}>{p.name}{isMe ? " (나)" : ""} <span style={{ color: C.sub, fontSize: 11, fontWeight: 400 }}>{p.job}</span></span>
                <b style={{ color: C.gold }}>{fmt(netWorth(p))}</b>
              </div>
            );
          })}
        </div>
      )}
      {filial && (filial.parents || 0) > 0 && (
        <div style={{ textAlign: "center", marginTop: 14, color: C.sub, fontSize: 13 }}>🎁 효도왕: <b style={{ color: "#fb7185" }}>{filial.name}</b> (누적 {fmt(filial.parents)})</div>
      )}
      {list.length === 0 && <Empty>참가자 데이터가 없어요.</Empty>}
      <div style={{ textAlign: "center", marginTop: 18 }}><Btn small color={C.sub} onClick={onBack}>처음으로</Btn></div>
    </div>
  );
}

/* ====== 리치 속보 배너 ====== */
function NewsBanner({ event }) {
  const cc = CAT[event.cat] || C.gold;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0"), mm = String(now.getMinutes()).padStart(2, "0");
  const tick = ` 📢 속보  ·  ${event.ticker}  ·  ${event.title}  · `;
  return (
    <div style={{ marginTop: 12, borderRadius: 14, overflow: "hidden", border: `2px solid #ef4444`, animation: "slideDown .4s", boxShadow: "0 10px 30px #0008" }}>
      <div style={{ background: "linear-gradient(90deg,#b91c1c,#ef4444)", color: "#fff", padding: "7px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ background: "#fff", color: "#b91c1c", fontFamily: "'Black Han Sans'", fontSize: 12, padding: "1px 7px", borderRadius: 4 }}>LIVE</span>
        <span style={{ fontFamily: "'Black Han Sans'", letterSpacing: 1 }}>📺 머니뉴스 24</span>
        <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.9 }}>속보 · {hh}:{mm}</span>
      </div>
      <div style={{ background: "linear-gradient(160deg,#1a1014,#15171f)", padding: 16 }}>
        <span style={{ display: "inline-block", background: `${cc}22`, color: cc, border: `1px solid ${cc}`, borderRadius: 6, fontSize: 11, fontWeight: 800, padding: "2px 8px", marginBottom: 10 }}>
          {event.icon} {event.cat}
        </span>
        <div style={{ fontFamily: "'Black Han Sans'", fontSize: 21, lineHeight: 1.3, color: "#fff" }}>{event.title}</div>
        <p style={{ color: "#c9ced8", marginTop: 8, fontSize: 14, lineHeight: 1.55 }}>{event.body}</p>
      </div>
      <div style={{ overflow: "hidden", background: "#000", borderTop: "2px solid #b91c1c", display: "flex", alignItems: "center" }}>
        <span style={{ background: "#b91c1c", color: "#fff", fontFamily: "'Black Han Sans'", fontSize: 12, padding: "6px 10px", whiteSpace: "nowrap", flexShrink: 0 }}>속보</span>
        <div style={{ display: "inline-flex", whiteSpace: "nowrap", animation: "ticker 18s linear infinite", color: "#ffd9d9", fontSize: 13, padding: "6px 0" }}>
          <span>{tick}{tick}</span><span>{tick}{tick}</span>
        </div>
      </div>
    </div>
  );
}

/* ===================== 다연쌤 ===================== */
function AdminView({ onBack, room }) {
  const GKEY = mkGKey(room);
  const ppfx  = mkPPfx(room);

  const [players, setPlayers] = useState([]);
  const [game, setGame] = useState(null);
  const [ok, setOk] = useState(true);
  const [pickNews, setPickNews] = useState(false);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      const g = await sGet(GKEY);
      const keys = await sList(ppfx);
      const list = (await Promise.all(keys.map((k) => sGet(k)))).filter(Boolean);
      if (!active) return;
      setGame(g); setPlayers(list.sort((a, b) => netWorth(b) - netWorth(a)));
    };
    tick(); const iv = setInterval(tick, 2000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  const round = game?.round || 1, phase = game?.phase || "invest";
  const maxNet = Math.max(1, ...players.map(netWorth));
  const classPlayers = players.filter((p) => (p.round || 1) === round);
  const readyCount = classPlayers.filter((p) => p.ready).length;

  const start = () => sSet(GKEY, { round: 1, phase: "invest", newsId: null });
  const release = (id) => sSet(GKEY, { ...(game || { round: 1 }), phase: "news", newsId: id || EVENTS[Math.floor(Math.random() * EVENTS.length)].id });
  const next = () => sSet(GKEY, { round: (game?.round || 1) + 1, phase: "invest", newsId: null });
  const endGame = () => sSet(GKEY, { ...(game || { round: 1 }), phase: "end" });
  const reset = async () => { const keys = await sList(ppfx); await Promise.all(keys.map(sDel)); await sDel(GKEY); setPlayers([]); setGame(null); };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ cursor: "pointer", color: C.sub }} onClick={onBack}>←</span>
          <Title size={24}>🖥️ 다연쌤</Title>
          <Badge color="#60a5fa">2학년 {room}</Badge>
          <Badge>{players.length}명</Badge>
          <span style={{ fontFamily: "'Black Han Sans'", color: C.gold }}>{round}월차</span>
          <Badge color={phase === "news" ? C.red : phase === "end" ? C.gold : C.green}>{phase === "news" ? "속보 발생" : phase === "end" ? "게임 종료" : "투자 시간"}</Badge>
        </div>
        <Btn small color={C.sub} onClick={() => { if (confirm("전체 초기화할까요? 모든 참가자 데이터가 삭제됩니다.")) reset(); }}>전체 초기화</Btn>
      </div>

      {/* 컨트롤 */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {!game ? (
          <Btn fill onClick={start}>▶ 게임 시작 (1월차)</Btn>
        ) : phase === "end" ? (
          <>
            <span style={{ fontFamily: "'Black Han Sans'", color: C.gold }}>🏆 최종 순위 발표 중</span>
            <Btn fill onClick={() => { if (confirm("새 게임을 시작할까요? 현재 기록이 초기화됩니다.")) reset(); }}>🔄 새 게임 (초기화)</Btn>
          </>
        ) : phase === "invest" ? (
          <>
            <div style={{ animation: readyCount === classPlayers.length && classPlayers.length ? "pulseRed 1.4s infinite" : "none", borderRadius: 12 }}>
              <Btn fill color={C.red} onClick={() => setPickNews(true)}>📰 속보 띄우기 (전원 동시)</Btn>
            </div>
            <span style={{ color: C.sub, fontSize: 14 }}>투자 완료 <b style={{ color: C.gold }}>{readyCount}</b> / {classPlayers.length}명</span>
            {classPlayers.length > 0 && readyCount === classPlayers.length && <Badge color={C.green}>전원 완료!</Badge>}
          </>
        ) : (
          <Btn fill onClick={next}>⏭ 다음 달로 ({round + 1}월차)</Btn>
        )}
        {game && phase !== "end" && (
          <Btn color={C.gold} onClick={() => { if (confirm("게임을 종료하고 최종 순위를 발표할까요?")) endGame(); }}>🏁 게임 종료 · 순위 발표</Btn>
        )}
      </div>

      {phase === "news" && game?.newsId && <NewsBanner event={eventById(game.newsId)} />}

      {!ok && <Empty>이 환경에서는 실시간 공유 저장이 지원되지 않습니다. 같은 기기에서 '혼자 연습'은 정상 동작합니다.</Empty>}

      {phase === "end" ? (
        <FinalRanking list={players} meId={null} onBack={onBack} />
      ) : (
      <div style={{ marginTop: 16 }}>
        <SectionLabel>📊 실시간 순위 (총자산)</SectionLabel>
        {players.length === 0 ? <Empty>아직 참가자가 없어요. 학생들에게 '수업 참여'로 입장하라고 안내하세요.</Empty> : (
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {players.map((p, i) => {
              const net = netWorth(p), job = jobByName(p.job);
              const isReady = p.ready && (p.round || 1) === round && phase === "invest";
              return (
                <div key={p.id} style={{ background: C.panel, border: `1px solid ${isReady ? C.green : C.line}`, borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "'Black Han Sans'", width: 28, color: i === 0 ? C.gold : C.sub, fontSize: 18 }}>{i === 0 ? "👑" : i + 1}</span>
                    <span style={{ fontSize: 22 }}>{job?.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900 }}>{p.name} <span style={{ color: C.sub, fontSize: 12, fontWeight: 500 }}>{p.job} · {p.round || 1}월차</span>
                        {isReady && <span style={{ marginLeft: 6 }}><Badge color={C.green}>완료</Badge></span>}</div>
                      <div style={{ height: 6, background: "#eceaf3", borderRadius: 6, marginTop: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(net / maxNet) * 100}%`, background: `linear-gradient(90deg,${C.goldDim},${C.gold})`, borderRadius: 6 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'Black Han Sans'", color: C.gold, fontSize: 16 }}>{fmt(net)}</div>
                      {p.lastResult && <div style={{ fontSize: 12, color: p.lastResult.total >= 0 ? C.green : C.red }}>{p.lastResult.total >= 0 ? "▲" : "▼"} {fmt(Math.abs(p.lastResult.total))}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", height: 8, borderRadius: 6, overflow: "hidden", marginTop: 10, background: "#eceaf3" }}>
                    {ASSETS.map((a) => { const v = p[a.key] || 0; return v > 0 ? <div key={a.key} style={{ width: `${(v / Math.max(1, net)) * 100}%`, background: a.color }} /> : null; })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {pickNews && (
        <div onClick={() => setPickNews(false)} style={{ position: "fixed", inset: 0, background: "#000a", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 18, width: "100%", maxWidth: 480 }}>
            <Title size={22}>📰 어떤 속보를 띄울까요?</Title>
            <div style={{ marginTop: 10 }}><Btn fill color={C.red} full onClick={() => { release(); setPickNews(false); }}>🎲 랜덤 속보!</Btn></div>
            <div style={{ maxHeight: 340, overflow: "auto", marginTop: 12, display: "grid", gap: 6 }}>
              {EVENTS.map((e) => (
                <button key={e.id} onClick={() => { release(e.id); setPickNews(false); }} style={{ textAlign: "left", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, color: C.text, cursor: "pointer" }}>
                  <span style={{ color: CAT[e.cat], fontSize: 11, fontWeight: 800 }}>{e.icon} {e.cat}</span>
                  <div style={{ fontWeight: 800, fontSize: 13, marginTop: 2 }}>{e.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
