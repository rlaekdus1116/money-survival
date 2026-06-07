import React, { useState, useEffect, useRef } from "react";
import { sGet, sSet, sList, sDel } from "./storage";

const FONT = `
@import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Gothic+A1:wght@400;500;700;900&display=swap');
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: #c9a24baa; border-radius: 8px; }
@keyframes flipIn { from{transform:rotateY(90deg);opacity:0} to{transform:rotateY(0);opacity:1} }
@keyframes pop { 0%{transform:scale(.85);opacity:0} 60%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
@keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes slideDown { from{transform:translateY(-20px);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes pulseRed { 0%,100%{box-shadow:0 0 0 0 #ef444466} 50%{box-shadow:0 0 0 8px #ef444400} }
@keyframes letterFly { 0%{transform:translateY(-100px) rotate(-6deg);opacity:0} 70%{transform:translateY(8px) rotate(1deg);opacity:1} 100%{transform:translateY(0) rotate(0);opacity:1} }
@keyframes fanfare { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
`;

const C = {
  bg: "linear-gradient(170deg,#fff5e8 0%,#fdeef4 48%,#edf2ff 100%)",
  panel: "#ffffff", panel2: "#f5f1fb",
  gold: "#bb7d10", goldDim: "#8a5b08",
  green: "#0f9d6e", red: "#df3b3b", text: "#232a3a",
  sub: "#79839a", line: "#ebe6f3", ink: "#2a1d04",
};
const UNIT = 10;
const TOTAL_ROUNDS = 9;

function getRoundMeta(round) {
  if (round <= 5) return { label: `20대 ${round}달차`, decade: 20 };
  if (round === 6) return { label: "30대", decade: 30 };
  if (round === 7) return { label: "40대", decade: 40 };
  if (round === 8) return { label: "50대", decade: 50 };
  return { label: "60대", decade: 60 };
}

/* ====== 효과음 (AudioContext 재사용) ====== */
let _audioCtx = null;
function unlockAudio() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === "suspended") _audioCtx.resume();
  } catch(e) {}
}
function playSound(type) {
  try {
    unlockAudio();
    const ctx = _audioCtx;
    if (!ctx) return;
    if (type === "news") {
      [[880,0],[660,0.13],[880,0.26]].forEach(([f,t]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = f; o.type = "square";
        g.gain.setValueAtTime(0.18, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.11);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.13);
      });
    } else if (type === "fanfare") {
      [523,659,784,1047].forEach((f,i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = f; o.type = "triangle";
        const t = ctx.currentTime + i * 0.18;
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.start(t); o.stop(t + 0.35);
      });
    } else if (type === "bill") {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 330; o.type = "sine";
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5);
    }
  } catch(e) {}
}

/* ====== 직업 (연대별 월급 + 생활비) ====== */
const JOBS = [
  { name:"의사", emoji:"🩺", color:"#ef4444", tag:"고소득·안정",
    salary:{20:40,30:85,40:120,50:130,60:110}, living:{20:25,30:35,40:42,50:40,60:28} },
  { name:"사업가", emoji:"💼", color:"#f59e0b", tag:"수입 변동 큼",
    salary:{20:[15,60],30:[20,100],40:[0,130],50:[0,120],60:[0,80]}, living:{20:18,30:25,40:30,50:28,60:20} },
  { name:"약사", emoji:"💊", color:"#10b981", tag:"탄탄한 전문직",
    salary:{20:45,30:60,40:75,50:80,60:65}, living:{20:20,30:28,40:32,50:30,60:22} },
  { name:"대기업", emoji:"🏢", color:"#3b82f6", tag:"안정적 직장인",
    salary:{20:35,30:50,40:65,50:70,60:55}, living:{20:18,30:25,40:30,50:28,60:20} },
  { name:"유튜버", emoji:"🎥", color:"#ec4899", tag:"대박 아니면 쪽박",
    salary:{20:[3,65],30:[5,80],40:[2,90],50:[0,80],60:[0,50]}, living:{20:15,30:20,40:22,50:20,60:15} },
  { name:"공무원", emoji:"🏛️", color:"#6366f1", tag:"박봉이지만 철밥통",
    salary:{20:22,30:30,40:38,50:42,60:38}, living:{20:14,30:20,40:23,50:22,60:16} },
  { name:"중소기업", emoji:"🏭", color:"#64748b", tag:"성실한 직장인",
    salary:{20:20,30:26,40:32,50:34,60:28}, living:{20:14,30:19,40:22,50:21,60:15} },
  { name:"프리랜서", emoji:"🎨", color:"#14b8a6", tag:"자유롭지만 불안정",
    salary:{20:[10,40],30:[12,55],40:[8,60],50:[5,50],60:[3,35]}, living:{20:15,30:20,40:24,50:22,60:15} },
];
const jobByName = (n) => JOBS.find(j => j.name === n);
const rollSalary = (job, decade) => {
  const s = job.salary[decade] || job.salary[20];
  return Array.isArray(s) ? s[0] + Math.floor(Math.random()*(s[1]-s[0]+1)) : s;
};
const getLiving = (job, decade) => job.living[decade] || job.living[20];

/* ====== 생활비 내역 생성 ====== */
function getLivingBreakdown(decade, total) {
  const templates = {
    20: [{icon:"🏠",name:"월세·관리비",r:0.42},{icon:"🍚",name:"식비",r:0.28},{icon:"🚌",name:"교통비",r:0.16},{icon:"📱",name:"통신·구독료",r:0.14}],
    30: [{icon:"🏠",name:"주거비",r:0.36},{icon:"🍚",name:"식비·외식",r:0.24},{icon:"🚗",name:"교통·차량",r:0.2},{icon:"👨‍👩‍👧",name:"가족 생활비",r:0.2}],
    40: [{icon:"🏠",name:"주거비",r:0.3},{icon:"🍚",name:"식비·외식",r:0.2},{icon:"🚗",name:"교통·차량",r:0.18},{icon:"👨‍👩‍👧",name:"가족 생활비",r:0.2},{icon:"🏥",name:"건강관리",r:0.12}],
    50: [{icon:"🏠",name:"주거비",r:0.28},{icon:"🍚",name:"식비",r:0.2},{icon:"🚗",name:"교통·차량",r:0.16},{icon:"👨‍👩‍👧",name:"가족 생활비",r:0.18},{icon:"🏥",name:"건강관리",r:0.18}],
    60: [{icon:"🏠",name:"주거비",r:0.3},{icon:"🍚",name:"식비",r:0.25},{icon:"🚗",name:"교통비",r:0.15},{icon:"🏥",name:"의료·건강",r:0.3}],
  };
  const items = templates[decade] || templates[20];
  let rem = total;
  return items.map((item, i) => {
    const amt = i === items.length-1 ? rem : Math.max(1, Math.round(total*item.r));
    rem -= amt;
    return {icon:item.icon, name:item.name, amt};
  });
}

/* ====== 인생 이벤트 ====== */
const LIFE_EVENTS = {
  30: [
    {id:"marriage",icon:"💍",title:"결혼을 했어요!",body:"행복한 결혼! 하지만 결혼식·신혼여행 비용이 빠져나갔어요.",cost:30,insurance:false},
    {id:"baby",icon:"🍼",title:"아이가 태어났어요!",body:"기쁜 소식! 출산·육아 비용이 발생했어요.",cost:20,insurance:false},
    {id:"jeonse",icon:"🏠",title:"전셋값이 3천만원 올랐어요!",body:"집주인이 전세를 올려달라고 해요. 이사 비용도 생겼어요.",cost:30,insurance:false},
    {id:"promotion30",icon:"🎉",title:"승진 성공! 보너스 지급!",body:"열심히 일한 보람이 있어요. 특별 보너스가 들어왔어요!",cost:-20,insurance:false},
    {id:"sidejob",icon:"💻",title:"부업으로 수익이 났어요!",body:"퇴근 후 열심히 한 부업에서 수익이 났어요!",cost:-15,insurance:false},
  ],
  40: [
    {id:"tuition",icon:"📚",title:"자녀 학원비 폭탄!",body:"영어·수학·과학 학원비가 월 100만원을 넘었어요.",cost:20,insurance:false},
    {id:"parent_hospital",icon:"🏥",title:"부모님이 입원하셨어요",body:"갑작스러운 부모님 병원비가 발생했어요. 보험이 있으면 절반만 내요!",cost:40,insurance:true},
    {id:"accident",icon:"🚨",title:"갑작스러운 사고 발생!",body:"예상치 못한 사고로 치료비·수리비가 생겼어요. 보험이 있으면 절반만 내요!",cost:35,insurance:true},
    {id:"lucky40",icon:"💰",title:"재테크 성공!",body:"꾸준히 모은 덕분에 추가 수익이 생겼어요!",cost:-20,insurance:false},
    {id:"remodel",icon:"🏡",title:"집 수리비가 나왔어요",body:"살던 집을 고쳐야 했어요. 생각보다 비용이 많이 들었네요.",cost:25,insurance:false},
  ],
  50: [
    {id:"tuition50",icon:"🎓",title:"자녀 대학 등록금 폭탄!",body:"자녀가 대학에 입학했어요. 4년치 등록금이 부담이에요.",cost:30,insurance:false},
    {id:"health50",icon:"💊",title:"건강검진에서 이상이 발견됐어요",body:"정기 검진에서 이상 소견이 나왔어요. 치료비가 필요해요. 보험이 있으면 절반만 내요.",cost:35,insurance:true},
    {id:"inheritance",icon:"🏠",title:"부모님 유산을 받았어요",body:"부모님께서 남겨주신 재산이 생겼어요.",cost:-25,insurance:false},
    {id:"bonus50",icon:"🏆",title:"성과급이 나왔어요!",body:"수십 년 근속의 결실! 큰 성과급이 들어왔어요.",cost:-20,insurance:false},
    {id:"travel50",icon:"✈️",title:"해외여행을 다녀왔어요!",body:"오랫동안 꿈꿔온 여행을 떠났어요. 행복했지만 비용이 들었네요.",cost:15,insurance:false},
  ],
  60: [
    {id:"medical60",icon:"🏥",title:"큰 병이 찾아왔어요",body:"건강에 이상이 생겼어요. 큰 치료비가 필요해요. 보험이 있으면 절반만 내요.",cost:50,insurance:true},
    {id:"grandchild",icon:"👶",title:"손자·손녀가 태어났어요!",body:"기쁜 소식이에요! 용돈을 챙겨줬어요.",cost:10,insurance:false},
    {id:"hobby60",icon:"🎨",title:"새 취미를 시작했어요",body:"그림·골프·텃밭… 즐거운 은퇴 생활이에요.",cost:8,insurance:false},
    {id:"windfall60",icon:"💰",title:"오랜 투자의 결실!",body:"젊을 때부터 꾸준히 모은 덕분에 큰 수익이 생겼어요!",cost:-30,insurance:false},
    {id:"pension60",icon:"🏛️",title:"연금 수령 시작!",body:"드디어 연금이 나오기 시작했어요. 생활이 안정됐어요.",cost:-15,insurance:false},
  ],
};

/* ====== 자산 / 배분 ====== */
const ASSETS = [
  {key:"bitcoin",name:"비트코인",color:"#f7931a"},
  {key:"stock",name:"주식",color:"#34d399"},
  {key:"savings",name:"적금",color:"#60a5fa"},
  {key:"realestate",name:"부동산",color:"#fb923c"},
  {key:"luxury",name:"명품",color:"#c084fc"},
  {key:"checking",name:"입출금통장",color:"#94a3b8"},
];
const assetName = (k) => k==="parents"?"부모님 효도":k==="insurance"?"보험":ASSETS.find(a=>a.key===k)?.name||k;

const ALLOC = [
  {key:"bitcoin",name:"비트코인",emoji:"₿",color:"#f7931a",hint:"고위험 고수익"},
  {key:"stock",name:"주식",emoji:"📈",color:"#34d399",hint:"중위험"},
  {key:"savings",name:"적금",emoji:"🏦",color:"#60a5fa",hint:"안전·소폭이익"},
  {key:"realestate",name:"부동산",emoji:"🏠",color:"#fb923c",hint:"집값 오르면 큰 수익 · 경기침체엔 하락"},
  {key:"luxury",name:"명품",emoji:"👜",color:"#c084fc",hint:"감가 위험"},
  {key:"insurance",name:"보험",emoji:"🛡️",color:"#f43f5e",hint:"사고·질병 발생 시 손실 절반 보장"},
  {key:"parents",name:"부모님 용돈",emoji:"🎁",color:"#fb7185",hint:"효도지수↑ (가끔 보답)"},
  {key:"checking",name:"입출금통장",emoji:"💳",color:"#94a3b8",hint:"그냥 보관 (변동 없음)"},
];

const CAT = {경제:"#e8c14d",국제:"#60a5fa",IT:"#34d399",부동산:"#fb923c",사회:"#c084fc"};

/* ====== 속보 이벤트 (쉬운 버전) ====== */
const EVENTS = [
  {id:"btc_etf",cat:"경제",icon:"🚀",title:"코인 열풍! 전 세계가 비트코인을 사들이고 있어요",
    body:"대형 투자회사들이 앞다투어 비트코인을 사고 있어요. '디지털 금'이라는 말이 나올 정도예요.",
    ticker:"비트코인 +60% · 역대급 거래량 · 투자 열기 최고조",
    returns:{bitcoin:0.6,stock:0.05,savings:0.004}},
  {id:"ai_boom",cat:"IT",icon:"🤖",title:"AI 열풍! 기술 관련 주식이 폭등하고 있어요",
    body:"인공지능 기술이 발전하면서 관련 기업들의 주가가 크게 올랐어요.",
    ticker:"기술주 +42% · AI 열풍 · 관련 기업 실적 대박",
    returns:{stock:0.42,bitcoin:0.06,savings:0.004}},
  {id:"luxury_resell",cat:"사회",icon:"👜",title:"한정판 가방, 사자마자 두 배! 명품 오픈런 대란",
    body:"인기 명품 브랜드 가방이 품귀 현상을 빚으면서 중고 거래 가격이 2배가 됐어요.",
    ticker:"명품 +28% · 오픈런 대란 · 리셀 시장 폭주",
    returns:{luxury:0.28,stock:0.03,savings:0.004}},
  {id:"savings_gift",cat:"사회",icon:"🏦",title:"정부가 적금 이자를 두 배로 올려준다고?!",
    body:"청년 자산 형성을 돕겠다며 정부가 적금 우대 금리를 발표했어요.",
    ticker:"적금 우대금리 지급 · 가입 문의 폭주",
    returns:{savings:0.04}},
  {id:"rate_up",cat:"경제",icon:"📉",title:"정부가 이자율을 올렸어요 — 코인·주식 동시 하락",
    body:"이자율이 오르면 위험한 투자에서 돈이 빠져나가요. 비트코인이 직격탄을 맞았어요.",
    ticker:"비트코인 -45% · 주식 약세 · 적금 금리는 상승",
    returns:{bitcoin:-0.45,stock:-0.12,savings:0.012,luxury:-0.03}},
  {id:"inflation",cat:"경제",icon:"🔥",title:"물가가 너무 올랐어요! 통장에 돈만 있으면 손해예요",
    body:"물가가 오르면 같은 돈으로 살 수 있는 게 줄어들어요. 현금은 가만 있어도 손해예요.",
    ticker:"물가 6%대 · 현금 가치 하락 · 실물자산 주목",
    returns:{bitcoin:0.18,stock:-0.04,luxury:0.06,savings:-0.005,checking:-0.05}},
  {id:"crisis",cat:"국제",icon:"🌪️",title:"전 세계 경제가 흔들려요! 모든 자산이 동시에 떨어지고 있어요",
    body:"큰 경제 위기가 오면 코인도, 주식도, 명품도 다 같이 떨어져요. 현금만 안전해요.",
    ticker:"주식 -38% · 비트코인 -35% · 명품 급랭",
    returns:{bitcoin:-0.35,stock:-0.38,savings:0.0,luxury:-0.18,realestate:-0.15}},
  {id:"filial",cat:"사회",icon:"🎁",title:"부모님이 목돈으로 화답! 효도가 재테크예요",
    body:"꾸준히 용돈을 드린 자녀들에게 부모님이 목돈을 돌려주는 사례가 화제예요.",
    ticker:"효도 누적액의 80% 보답 · 따뜻한 미담",
    returns:{savings:0.004},parentsReturn:0.8},
  {id:"realestate",cat:"부동산",icon:"🏠",title:"집값이 다시 오르고 있어요!",
    body:"도심 아파트를 중심으로 부동산 가격이 상승세예요. 부동산에 투자한 사람은 큰 수익이 났어요!",
    ticker:"부동산 +30% · 전세 품귀 · 아파트 매수 문의 급증",
    returns:{realestate:0.3,bitcoin:0.05}},
  {id:"realestate_drop",cat:"부동산",icon:"🏚️",title:"집값이 떨어지고 있어요!",
    body:"금리 인상과 경기 둔화로 아파트 값이 내려가고 있어요. 부동산 투자자는 주의하세요.",
    ticker:"부동산 -20% · 거래 절벽 · 역전세 우려",
    returns:{realestate:-0.2,stock:-0.05}},
  {id:"recession",cat:"경제",icon:"😰",title:"경기가 나빠지고 있어요 — 주머니가 얇아지는 중",
    body:"경기가 나빠지면 회사 실적이 떨어지고 주가도 내려가요.",
    ticker:"주식 -20% · 소비 위축 · 경기 둔화",
    returns:{stock:-0.2,bitcoin:-0.1,luxury:-0.08,realestate:-0.1,savings:0.005}},
];
const eventById = (id) => EVENTS.find(e => e.id === id);

/* ====== 반(room) 코드 시스템 ====== */
const ROOMS = ["1반","2반","3반","4반","5반","6반","7반"];
const mkGKey = (room) => `mg:room:${room}:game`;
const mkPKey = (room, id) => `mg:room:${room}:p:${id}`;
const mkPPfx = (room) => `mg:room:${room}:p:`;

/* ====== 유틸 ====== */
const fmt = (units) => {
  const man = Math.round(units)*UNIT;
  if (man===0) return "0원";
  const s=man<0?"-":"", a=Math.abs(man);
  if (a>=10000){const e=Math.floor(a/10000),r=a%10000;return `${s}${e}억${r?" "+r.toLocaleString()+"만":""}원`;}
  return `${s}${a.toLocaleString()}만원`;
};
const netWorth = (p) => (p.bitcoin||0)+(p.stock||0)+(p.savings||0)+(p.realestate||0)+(p.luxury||0)+(p.checking||0);
const uid = () => Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);

/* ====== 은퇴 시뮬레이션 ====== */
function calcRetirement(assets) {
  const monthly = 15, retireAge = 60, lifeExpect = 83;
  const canMonths = Math.floor(assets/monthly);
  const actualAge = Math.min(99, retireAge+Math.floor(canMonths/12));
  return {monthly,retireAge,lifeExpect,actualAge};
}

/* ====== 뉴스 적용 ====== */
function applyNews(rec, event, round) {
  const r = event.returns||{};
  const lines=[]; let total=0;
  ["bitcoin","stock","savings","realestate","luxury","checking"].forEach(k => {
    const before=rec[k]||0, rate=r[k]||0;
    if (before<=0&&rate===0) return;
    // 소액일 때 반올림으로 변동이 0이 되는 걸 방지 — 최소 1칸은 변동
    let after=Math.max(0,Math.round(before*(1+rate)));
    if (rate>0 && before>0 && after<=before) after=before+1;
    if (rate<0 && before>0 && after>=before) after=Math.max(0,before-1);
    const diff=after-before; rec[k]=after; total+=diff;
    if (before>0||rate!==0) lines.push({key:k,before,after,diff,rate});
  });
  if (event.parentsReturn&&(rec.parents||0)>0) {
    const bonus=Math.round(rec.parents*event.parentsReturn);
    rec.checking+=bonus; total+=bonus;
    lines.push({key:"parents",before:0,after:bonus,diff:bonus,rate:event.parentsReturn,isParents:true});
  }
  return {round,eventId:event.id,title:event.title,total,lines};
}

/* ====== 인생 이벤트 적용 ====== */
function applyLifeEvent(rec, ev) {
  const hasIns = (rec.insurance||0) >= 5;
  let cost = ev.cost;
  if (ev.insurance && hasIns) cost = Math.ceil(cost/2);
  if (cost > 0) {
    const fromCheck = Math.min(rec.checking||0, cost);
    rec.checking = (rec.checking||0)-fromCheck;
    const rem = cost-fromCheck;
    if (rem>0) rec.savings = Math.max(0,(rec.savings||0)-rem);
  } else {
    rec.checking = (rec.checking||0)+Math.abs(cost);
  }
}

/* ================================================================= */
export default function App() {
  const [room,setRoom] = useState(null);
  const [mode,setMode] = useState(null);
  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Gothic A1', sans-serif"}}>
      <style>{FONT}</style>
      {!room ? <RoomSelect onPick={setRoom}/>
        : !mode ? <ModeSelect onPick={setMode} room={room} onChangeRoom={()=>{setRoom(null);setMode(null);}}/>
        : mode==="admin" ? <AdminView onBack={()=>setMode(null)} room={room}/>
        : <PlayGame onBack={()=>setMode(null)} room={room}/>}
    </div>
  );
}

function RoomSelect({onPick}) {
  return (
    <Centered>
      <div style={{textAlign:"center",animation:"pop .4s"}}>
        <div style={{fontSize:54}}>🏫</div>
        <Title size={38}>종암 투자왕</Title>
        <p style={{color:C.sub,marginTop:8}}>우리 반을 선택하세요</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:20,maxWidth:320,marginInline:"auto"}}>
          {ROOMS.map(r=>(
            <button key={r} onClick={()=>onPick(r)}
              style={{padding:"14px 0",borderRadius:14,border:`2px solid ${C.gold}`,background:"transparent",
                color:C.gold,fontFamily:"'Black Han Sans'",fontSize:18,cursor:"pointer",boxShadow:"0 2px 0 "+C.goldDim}}>{r}</button>
          ))}
        </div>
        <p style={{color:C.sub,fontSize:12,marginTop:16}}>반마다 데이터가 분리됩니다</p>
      </div>
    </Centered>
  );
}

/* ====== 공용 UI ====== */
function Centered({children}){return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:20}}>{children}</div>;}
function Btn({children,onClick,color=C.gold,fill,small,disabled,full}){
  return(
    <button onClick={onClick} disabled={disabled}
      style={{cursor:disabled?"not-allowed":"pointer",border:`2px solid ${color}`,
        background:fill?color:"transparent",color:fill?C.ink:color,
        fontFamily:"'Black Han Sans'",letterSpacing:0.5,padding:small?"8px 14px":"13px 20px",
        fontSize:small?14:17,borderRadius:12,opacity:disabled?0.4:1,width:full?"100%":"auto",
        boxShadow:fill&&!disabled?`0 4px 0 ${C.goldDim}`:"none"}}>{children}</button>
  );
}
const Title=({children,size=30})=>(
  <h1 style={{fontFamily:"'Black Han Sans'",fontSize:size,margin:0,letterSpacing:1,
    background:`linear-gradient(95deg,#e07b2e,${C.gold})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{children}</h1>
);
const SectionLabel=({children})=><div style={{fontFamily:"'Black Han Sans'",color:C.gold,fontSize:15}}>{children}</div>;
const Badge=({children,color=C.gold})=><span style={{border:`1px solid ${color}`,color,borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>{children}</span>;
const Empty=({children})=><div style={{background:C.panel,border:`1px dashed ${C.line}`,borderRadius:14,padding:24,textAlign:"center",color:C.sub,marginTop:8}}>{children}</div>;

function ModeSelect({onPick,room,onChangeRoom}){
  return(
    <Centered>
      <div style={{textAlign:"center",animation:"pop .4s"}}>
        <div style={{fontSize:54}}>💰</div>
        <Title size={44}>종암 투자왕</Title>
        <div style={{marginTop:8,display:"flex",justifyContent:"center",alignItems:"center",gap:8}}>
          <Badge color={C.gold}>2학년 {room}</Badge>
          <button onClick={onChangeRoom} style={{color:C.sub,background:"none",border:"none",cursor:"pointer",fontSize:12,textDecoration:"underline"}}>반 변경</button>
        </div>
        <p style={{color:C.sub,marginTop:8}}>내 월급, 어디에 넣을까? 선택이 미래를 바꾼다!</p>
        <div style={{display:"grid",gap:12,marginTop:30,width:280,marginInline:"auto"}}>
          <Btn fill onClick={()=>onPick("class")} full>🎓 수업 참여 (학생)</Btn>
          <Btn color={C.sub} onClick={()=>onPick("admin")} full>🖥️ 다연쌤 화면</Btn>
        </div>
        <p style={{color:C.sub,fontSize:12,marginTop:22,lineHeight:1.6,maxWidth:320}}>
          학생은 '수업 참여'로 입장하고,<br/>선생님은 '다연쌤 화면'을 엽니다.
        </p>
      </div>
    </Centered>
  );
}

/* ====== 연대 전환 화면 ====== */
const AGE_MSGS = {
  30:{emoji:"👨",color:"#3b82f6",title:"어느새 30대!",
    joke:"🚨 급속 노화 진행 완료! +10살",
    lines:["결혼도 해야 하고, 집도 사야 하고…","지출이 확 늘어나는 시기예요!","분산 투자가 더욱 중요해집니다 💪"]},
  40:{emoji:"🧑‍🦳",color:"#8b5cf6",title:"벌써 40대!",
    joke:"⏩ 또 10년 순삭! 허리 조심하세요 🏥",
    lines:["자녀 학원비에 부모님 병원비까지…","지갑이 사방에서 털리는 중 😰","보험이 있으면 조금은 버텨요!"]},
  50:{emoji:"👴",color:"#f59e0b",title:"50대 입성!",
    joke:"⏩ 급속 노화 +10년! 은퇴가 보인다! 🏖️",
    lines:["드디어 은퇴 카운트다운 시작!","지금까지 모은 자산이 노후를 결정해요","건강도 챙기고, 돈도 챙기세요 🤔"]},
  60:{emoji:"🏖️",color:"#10b981",title:"드디어 60대!",
    joke:"🎉 최종 보스 해금 완료! 은퇴 타임!",
    lines:["마지막 챕터가 시작됩니다!","그동안 어디에 투자하셨나요?","행복한 노후를 보낼 수 있을까요? 😊"]},
};
function AgeTransitionScreen({info,onContinue}){
  const msg=AGE_MSGS[info.to]||{emoji:"🎂",color:C.gold,title:`${info.to}대!`,joke:"",lines:[]};
  return(
    <Centered>
      <div style={{textAlign:"center",maxWidth:340,animation:"pop .5s"}}>
        <div style={{fontSize:60,animation:"blink 0.4s 4"}}>⏩</div>
        <div style={{fontSize:70,marginTop:-4,animation:"pop 0.5s 0.4s both"}}>{msg.emoji}</div>
        <div style={{fontFamily:"'Black Han Sans'",fontSize:26,color:msg.color,marginTop:10}}>{msg.title}</div>
        <div style={{background:`${msg.color}22`,border:`2px solid ${msg.color}`,borderRadius:12,padding:"8px 14px",marginTop:10,
          fontFamily:"'Black Han Sans'",color:msg.color,fontSize:15}}>{msg.joke}</div>
        <div style={{background:C.panel,borderRadius:14,padding:"12px 16px",marginTop:12,display:"grid",gap:4}}>
          {msg.lines.map((l,i)=><div key={i} style={{color:C.sub,fontSize:14}}>{l}</div>)}
        </div>
        <div style={{marginTop:8,color:C.sub,fontSize:13}}>{info.from}대 → <b style={{color:msg.color}}>{info.to}대</b>로 이동!</div>
        <div style={{marginTop:16}}><Btn fill full color={msg.color} onClick={onContinue}>다음 →</Btn></div>
      </div>
    </Centered>
  );
}

/* ====== 중간 순위 화면 ====== */
function MidRankingScreen({room,round,onContinue}){
  const [players,setPlayers]=useState([]);
  const ppfx=mkPPfx(room);
  useEffect(()=>{
    const fetch=async()=>{
      const keys=await sList(ppfx);
      const list=(await Promise.all(keys.map(k=>sGet(k)))).filter(Boolean).sort((a,b)=>netWorth(b)-netWorth(a));
      setPlayers(list);
    };
    fetch(); const iv=setInterval(fetch,3000); return()=>clearInterval(iv);
  },[]);
  const medals=["🥇","🥈","🥉"];
  const meta=getRoundMeta(round);
  return(
    <div style={{maxWidth:480,margin:"0 auto",padding:16,animation:"pop .4s"}}>
      <div style={{textAlign:"center",marginBottom:14}}>
        <div style={{fontSize:44}}>🏅</div>
        <Title size={24}>중간 순위 발표!</Title>
        <div style={{color:C.sub,marginTop:4,fontSize:13}}>{meta.label} 시작 전 현재 순위예요</div>
      </div>
      <div style={{display:"grid",gap:6}}>
        {players.map((p,i)=>{
          const job=jobByName(p.job),net=netWorth(p);
          return(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,background:C.panel,
              border:`2px solid ${i<3?C.gold:C.line}`,borderRadius:12,padding:"10px 14px",
              animation:`pop ${0.1+i*0.05}s`}}>
              <span style={{fontFamily:"'Black Han Sans'",width:28,fontSize:i<3?22:16,
                color:i===0?"#e8c14d":i===1?"#cbd5e1":i===2?"#cd7f32":C.sub}}>
                {i<3?medals[i]:i+1}
              </span>
              <span style={{fontSize:22}}>{job?.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700}}>{p.name}</div>
                <div style={{fontSize:11,color:C.sub}}>{p.job}</div>
              </div>
              <div style={{fontFamily:"'Black Han Sans'",color:C.gold,fontSize:16}}>{fmt(net)}</div>
            </div>
          );
        })}
        {players.length===0&&<div style={{color:C.sub,textAlign:"center",padding:20}}>불러오는 중…</div>}
      </div>
      <div style={{marginTop:16}}><Btn fill full onClick={onContinue}>투자 계속하기 →</Btn></div>
    </div>
  );
}

/* ====== 생활비 청구서 (편지 애니메이션) ====== */
function LivingBill({round,livingAmt,salaryAmt,onConfirm}){
  const [opened,setOpened]=useState(false);
  const [canConfirm,setCanConfirm]=useState(false);
  const meta=getRoundMeta(round);
  const decade=meta.decade;
  const breakdown=getLivingBreakdown(decade,livingAmt);
  const investable=salaryAmt-livingAmt;

  useEffect(()=>{
    playSound("bill");
    const t1=setTimeout(()=>setOpened(true),700);
    const t2=setTimeout(()=>setCanConfirm(true),5000);
    return()=>{clearTimeout(t1);clearTimeout(t2);};
  },[]);

  return(
    <Centered>
      <div style={{width:"100%",maxWidth:380,animation:"letterFly 0.7s cubic-bezier(.22,.61,.36,1) both"}}>
        {!opened?(
          <div style={{background:"#fffbf0",border:"3px solid #d4a017",borderRadius:16,padding:40,textAlign:"center",boxShadow:"0 8px 32px #0003"}}>
            <div style={{fontSize:64}}>✉️</div>
            <div style={{fontFamily:"'Black Han Sans'",fontSize:18,color:C.gold,marginTop:12}}>생활비 청구서 도착!</div>
          </div>
        ):(
          <div style={{background:"#fffbf0",border:"3px solid #d4a017",borderRadius:16,padding:20,boxShadow:"0 8px 32px #0003",animation:"pop .4s"}}>
            <div style={{textAlign:"center",borderBottom:"2px dashed #d4a017",paddingBottom:12,marginBottom:14}}>
              <div style={{fontSize:28}}>📋</div>
              <div style={{fontFamily:"'Black Han Sans'",fontSize:20,color:C.gold}}>{meta.label} 생활비 청구서</div>
              <div style={{color:C.sub,fontSize:12,marginTop:4}}>이번 달 월급: <b style={{color:C.text}}>{fmt(salaryAmt)}</b></div>
            </div>
            <div style={{display:"grid",gap:8}}>
              {breakdown.map((item,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff8e8",borderRadius:10,padding:"9px 12px"}}>
                  <span>{item.icon} {item.name}</span>
                  <b style={{color:C.red}}>- {fmt(item.amt)}</b>
                </div>
              ))}
            </div>
            <div style={{borderTop:"2px dashed #d4a017",marginTop:14,paddingTop:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <b style={{fontFamily:"'Black Han Sans'"}}>투자 가능 금액</b>
              <b style={{fontFamily:"'Black Han Sans'",fontSize:22,color:investable>=0?C.green:C.red}}>{fmt(Math.max(0,investable))}</b>
            </div>
            {investable<0&&(
              <div style={{background:"#fef2f2",border:`1px solid ${C.red}`,borderRadius:8,padding:"8px 12px",marginTop:8,color:C.red,fontSize:13,textAlign:"center"}}>
                ⚠️ 생활비가 월급보다 많아요! 이번 달은 적자예요.
              </div>
            )}
            <div style={{marginTop:14}}>
              {canConfirm
                ? <Btn fill full onClick={()=>{unlockAudio();onConfirm();}}>확인했어요 →</Btn>
                : <div style={{textAlign:"center",color:C.sub,fontSize:13,padding:"12px 0",animation:"blink 1.4s infinite"}}>⏳ 청구서를 확인하는 중… 잠시만요</div>}
            </div>
          </div>
        )}
      </div>
    </Centered>
  );
}

/* ====== 인생 이벤트 카드 ====== */
function LifeEventCard({lifeEvent,hasInsurance,onConfirm}){
  const isBonus=lifeEvent.cost<0;
  const actualCost=lifeEvent.insurance&&hasInsurance?Math.ceil(lifeEvent.cost/2):lifeEvent.cost;
  return(
    <Centered>
      <div style={{width:"100%",maxWidth:380,animation:"pop .5s"}}>
        <div style={{background:isBonus?"#f0fdf4":"#fff8f8",border:`3px solid ${isBonus?C.green:C.red}`,borderRadius:20,padding:24,textAlign:"center",boxShadow:"0 8px 32px #0003"}}>
          <div style={{color:C.sub,fontSize:13,fontWeight:700,marginBottom:8}}>🎴 인생 이벤트 발생!</div>
          <div style={{fontSize:56}}>{lifeEvent.icon}</div>
          <div style={{fontFamily:"'Black Han Sans'",fontSize:20,marginTop:10,color:C.text}}>{lifeEvent.title}</div>
          <p style={{color:C.sub,marginTop:8,lineHeight:1.6,fontSize:14}}>{lifeEvent.body}</p>
          {lifeEvent.insurance&&(
            <div style={{marginTop:10,padding:"7px 12px",borderRadius:8,
              background:hasInsurance?"#e0f2fe":"#fee2e2",
              color:hasInsurance?"#0369a1":C.red,fontSize:13,fontWeight:700}}>
              {hasInsurance?"🛡️ 보험 적용! 절반만 내요":"😰 보험이 없어서 전액 납부"}
            </div>
          )}
          <div style={{marginTop:14,padding:"12px 20px",borderRadius:12,
            background:isBonus?"#dcfce7":"#fef2f2",
            fontFamily:"'Black Han Sans'",fontSize:22,color:isBonus?C.green:C.red}}>
            {isBonus?`+ ${fmt(Math.abs(actualCost))} 수입!`:`- ${fmt(Math.abs(actualCost))} 지출`}
          </div>
          <div style={{marginTop:14}}><Btn fill full color={isBonus?C.green:C.red} onClick={onConfirm}>확인 →</Btn></div>
        </div>
      </div>
    </Centered>
  );
}

/* ===================== 게임 (수업 모드 전용) ===================== */
function PlayGame({onBack,room}){
  const GKEY=mkGKey(room);
  const pkey=(id)=>mkPKey(room,id);
  const ppfx=mkPPfx(room);

  const [step,setStep]=useState("name");
  const [name,setName]=useState("");
  const [rec,setRec]=useState(null);
  const [round,setRound]=useState(1);
  const [event,setEvent]=useState(null);
  const [finalList,setFinalList]=useState([]);
  const [pendingLifeEv,setPendingLifeEv]=useState(null);
  const [ageInfo,setAgeInfo]=useState(null);
  const idRef=useRef(uid());
  const recRef=useRef(null),roundRef=useRef(1),stepRef=useRef("name");
  recRef.current=rec; roundRef.current=round; stepRef.current=step;

  const write=(r,rnd)=>sSet(pkey(idRef.current),{...r,id:idRef.current,name,round:rnd??roundRef.current});

  const RANK_ROUNDS=[3,6,8]; // 순위 보여주는 라운드

  const beginRound=(r,rnd)=>{
    const job=jobByName(r.job);
    const decade=getRoundMeta(rnd).decade;
    const sal=rollSalary(job,decade);
    const living=getLiving(job,decade);
    const investable=Math.max(0,sal-living);
    const nr={...r,checking:investable,lastSalaryAmt:sal,lastLivingAmt:living,lastSalaryRound:rnd,ready:false,lastResult:null};
    let lifeEv=null;
    const prevDecade=getRoundMeta(Math.max(1,rnd-1)).decade;
    const isNewDecade=decade!==prevDecade&&rnd>1;
    if (isNewDecade&&LIFE_EVENTS[decade]) {
      const arr=LIFE_EVENTS[decade];
      lifeEv=arr[Math.floor(Math.random()*arr.length)];
    }
    setRec(nr); recRef.current=nr;
    setRound(rnd); roundRef.current=rnd;
    setPendingLifeEv(lifeEv);
    setEvent(null);
    write(nr,rnd);
    // 단계 결정: 연대전환 → 중간순위 → 청구서
    const showRank=RANK_ROUNDS.includes(rnd);
    if (isNewDecade) {
      setAgeInfo({from:prevDecade,to:decade,rankNext:showRank});
      setStep("ageTransition");
    } else if (showRank) {
      setAgeInfo(null);
      setStep("ranking");
    } else {
      setAgeInfo(null);
      setStep("bill");
    }
  };

  useEffect(()=>{
    let active=true;
    const poll=async()=>{
      const g=(await sGet(GKEY))||{round:1,phase:"invest"};
      if (!active) return;
      setRound(g.round);
      if (g.phase==="end"){
        const keys=await sList(ppfx);
        const list=(await Promise.all(keys.map(k=>sGet(k)))).filter(Boolean).sort((a,b)=>netWorth(b)-netWorth(a));
        if (active){setFinalList(list);setStep("end");playSound("fanfare");}
        return;
      }
      const r=recRef.current;
      if (!r) return;
      if (g.phase==="invest"&&(r.lastSalaryRound||0)<g.round) {
        beginRound(r,g.round);
      } else if (g.phase==="news"&&g.newsId&&stepRef.current==="waiting") {
        // 투자를 마친(waiting) 학생만 속보로 이동 — 청구서/투자중인 학생은 영향 없음
        setEvent(eventById(g.newsId)); setStep("news"); playSound("news");
      }
    };
    poll(); const iv=setInterval(poll,1500);
    return()=>{active=false;clearInterval(iv);};
  },[]);

  const startJob=(job)=>{
    const rnd=roundRef.current;
    const decade=getRoundMeta(rnd).decade;
    const sal=rollSalary(job,decade);
    const living=getLiving(job,decade);
    const investable=Math.max(0,sal-living);
    const r={id:idRef.current,name,job:job.name,bitcoin:0,stock:0,savings:0,luxury:0,checking:investable,
      insurance:0,parents:0,lastSalaryAmt:sal,lastLivingAmt:living,lastSalaryRound:rnd,ready:false,lastResult:null,jobChanged:false};
    setRec(r); recRef.current=r;
    setPendingLifeEv(null);
    write(r,rnd);
    setStep("bill");
  };

  const changeJob=(job)=>{
    const decade=getRoundMeta(roundRef.current).decade;
    const living=getLiving(job,decade);
    const r={...rec,job:job.name,jobChanged:true,checking:0,lastSalaryAmt:0,lastLivingAmt:living,ready:true};
    setRec(r); recRef.current=r; write(r);
    setStep("jobchanged");
  };

  const confirmBill=()=>{
    if (pendingLifeEv) setStep("lifeEvent");
    else setStep("invest");
  };

  const confirmLifeEvent=()=>{
    const r={...rec};
    applyLifeEvent(r,pendingLifeEv);
    setRec(r); recRef.current=r; write(r);
    setPendingLifeEv(null);
    setStep("invest");
  };

  const confirmInvest=(alloc)=>{
    if (ALLOC.reduce((s,a)=>s+(alloc[a.key]||0),0)!==rec.checking) return;
    const r={...rec};
    r.bitcoin+=(alloc.bitcoin||0); r.stock+=(alloc.stock||0);
    r.savings+=(alloc.savings||0); r.realestate=(r.realestate||0)+(alloc.realestate||0);
    r.luxury+=(alloc.luxury||0); r.insurance=(r.insurance||0)+(alloc.insurance||0);
    r.parents+=(alloc.parents||0); r.checking=(alloc.checking||0);
    r.ready=true;
    setRec(r); recRef.current=r;
    write(r);
    setStep("waiting");
  };

  const reveal=()=>{
    const r={...rec};
    const res=applyNews(r,event,round);
    r.lastResult=res;
    setRec(r); recRef.current=r;
    write(r);
  };

  if (step==="name") return <JoinScreen name={name} setName={setName} onJoin={()=>setStep("job")} onBack={onBack}/>;
  if (step==="job") return <JobPick name={name} onPickJob={startJob} onBack={()=>setStep("name")}/>;
  if (step==="rejob") return <JobPick name={name} onPickJob={changeJob} onBack={()=>setStep("invest")} rejob/>;
  if (step==="ageTransition"&&ageInfo) return <AgeTransitionScreen info={ageInfo} onContinue={()=>setStep(ageInfo.rankNext?"ranking":"bill")}/>;
  if (step==="ranking") return <MidRankingScreen room={room} round={round} onContinue={()=>setStep("bill")}/>;
  if (step==="jobchanged") {
    const newJob=jobByName(rec?.job);
    return (
      <Centered>
        <div style={{width:"100%",maxWidth:360,background:C.panel,border:`2px solid #fb923c`,borderRadius:20,padding:28,textAlign:"center",animation:"pop .4s"}}>
          <div style={{fontSize:48}}>{newJob?.emoji}</div>
          <div style={{fontFamily:"'Black Han Sans'",fontSize:22,color:"#fb923c",marginTop:8}}>🔄 이직 완료!</div>
          <div style={{color:C.text,fontWeight:700,fontSize:16,marginTop:12}}>{newJob?.name}으로 이직했어요</div>
          <div style={{background:"#fff8f0",border:"1px solid #fb923c",borderRadius:12,padding:"12px 16px",marginTop:16,color:"#92400e",fontSize:14,lineHeight:1.6}}>
            ⚠️ 이직한 달에는 <b>월급이 없어요</b>.<br/>
            이번 달은 투자를 할 수 없고,<br/>
            <b>다음 달부터</b> 새 직업으로 월급을 받아요!
          </div>
          <div style={{marginTop:18}}><Btn fill full color="#fb923c" onClick={()=>setStep("waiting")}>알겠어요 →</Btn></div>
        </div>
      </Centered>
    );
  }
  if (step==="end") return <FinalRanking list={finalList} meId={idRef.current} onBack={onBack}/>;
  if (step==="bill"&&rec) return <LivingBill round={round} livingAmt={rec.lastLivingAmt||0} salaryAmt={rec.lastSalaryAmt||0} onConfirm={confirmBill}/>;
  if (step==="lifeEvent"&&pendingLifeEv) return <LifeEventCard lifeEvent={pendingLifeEv} hasInsurance={(rec?.insurance||0)>=5} onConfirm={confirmLifeEvent}/>;
  if (!rec) return null;

  const job=jobByName(rec.job);
  const revealed=rec.lastResult&&rec.lastResult.round===round;
  const meta=getRoundMeta(round);

  return(
    <div style={{maxWidth:560,margin:"0 auto",padding:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:26}}>{job?.emoji}</span>
          <div>
            <div style={{fontWeight:900}}>{name}</div>
            <div style={{color:C.sub,fontSize:12}}>{rec.job} · {meta.label} <Badge color="#60a5fa">수업</Badge></div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:C.sub,fontSize:11}}>총자산</div>
          <div style={{fontFamily:"'Black Han Sans'",color:C.gold,fontSize:18}}>{fmt(netWorth(rec))}</div>
        </div>
      </div>
      <Portfolio rec={rec}/>
      {step==="invest"&&<InvestScreen rec={rec} onSubmit={confirmInvest} onChangeJob={!rec.jobChanged?()=>setStep("rejob"):null}/>}
      {step==="waiting"&&(
        <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:16,padding:26,marginTop:14,textAlign:"center"}}>
          <div style={{fontSize:40,animation:"blink 1.6s infinite"}}>📡</div>
          <div style={{fontWeight:900,marginTop:8}}>투자 완료! 속보 대기 중…</div>
          <div style={{color:C.sub,fontSize:13,marginTop:6}}>모두 투자를 마치면 다연쌤이 속보를 띄웁니다.</div>
        </div>
      )}
      {step==="news"&&(
        <>
          <NewsBanner event={event}/>
          {!revealed?(
            <div style={{textAlign:"center",marginTop:18}}>
              <p style={{color:C.sub,marginBottom:12}}>내 투자는 어떻게 됐을까?</p>
              <Btn fill onClick={reveal}>💥 투자 결과 확인</Btn>
            </div>
          ):(
            <ResultBreakdown result={rec.lastResult} onNext={null} isLast={round>=TOTAL_ROUNDS}/>
          )}
        </>
      )}
      <div style={{textAlign:"center",marginTop:18}}>
        <Btn small color={C.sub} onClick={()=>{if(confirm("처음 화면으로 돌아갈까요?")){try{sDel(pkey(idRef.current));}catch(e){}onBack();}}}>나가기</Btn>
      </div>
    </div>
  );
}

function JoinScreen({name,setName,onJoin,onBack}){
  return(
    <Centered>
      <div style={{textAlign:"center",width:300,animation:"pop .3s",position:"relative"}}>
        <span style={{cursor:"pointer",color:C.sub,position:"absolute",left:-4,top:-8}} onClick={onBack}>←</span>
        <div style={{fontSize:44}}>🙋</div>
        <Title size={28}>이름을 입력하세요</Title>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="닉네임"
          onKeyDown={e=>e.key==="Enter"&&name.trim()&&onJoin()}
          style={{marginTop:16,width:"100%",padding:14,borderRadius:12,border:`2px solid ${C.line}`,background:C.panel,color:C.text,fontSize:16,textAlign:"center",outline:"none"}}/>
        <div style={{marginTop:14}}><Btn fill full disabled={!name.trim()} onClick={onJoin}>입장하기 →</Btn></div>
      </div>
    </Centered>
  );
}

function JobPick({name,onPickJob,onBack,rejob}){
  const [deck]=useState(()=>[...JOBS].sort(()=>Math.random()-.5));
  const [picked,setPicked]=useState(null);
  const [rerollUsed,setRerollUsed]=useState(false);
  return(
    <div style={{maxWidth:520,margin:"0 auto",padding:16}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{cursor:"pointer",color:C.sub}} onClick={onBack}>←</span>
        <Title size={24}>{rejob?"🔄 이직: 새 직업 고르기":"직업 카드를 1장 고르세요"}</Title>
      </div>
      <p style={{color:C.sub,marginTop:6}}>{rejob?"주의: 이직하면 이번 달 월급은 받지 못해요. (게임당 1회)":
        `${name}님, 카드를 뒤집어 보세요. 고른 카드가 당신의 직업이 됩니다.`}</p>
      {!picked?(
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginTop:18}}>
          {deck.map((job,i)=>(
            <button key={i} onClick={()=>setPicked(job)}
              style={{aspectRatio:"3/4",borderRadius:14,border:`2px solid ${C.gold}`,cursor:"pointer",
                background:"linear-gradient(135deg,#fff6e0,#ffe7b8)",color:C.gold,
                display:"grid",placeItems:"center",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(110deg,transparent 30%,#ffffffcc 50%,transparent 70%)",backgroundSize:"200% 100%",animation:`shimmer ${2+(i%3)}s linear infinite`}}/>
              <span style={{fontSize:30,position:"relative"}}>❓</span>
              <span style={{position:"absolute",bottom:6,fontSize:10,color:C.sub}}>#{i+1}</span>
            </button>
          ))}
        </div>
      ):(
        <div style={{marginTop:24,animation:"flipIn .5s",textAlign:"center"}}>
          <div style={{maxWidth:240,margin:"0 auto",aspectRatio:"3/4",borderRadius:18,
            border:`3px solid ${picked.color}`,background:`linear-gradient(160deg,${picked.color}33,${C.panel})`,
            display:"grid",placeContent:"center",gap:6,padding:16}}>
            <div style={{fontSize:56}}>{picked.emoji}</div>
            <div style={{fontFamily:"'Black Han Sans'",fontSize:30,color:picked.color}}>{picked.name}</div>
            <div style={{color:C.sub,fontSize:13}}>{picked.tag}</div>
            <div style={{marginTop:8,fontFamily:"'Black Han Sans'",color:C.gold,fontSize:16}}>
              20대 월급 {Array.isArray(picked.salary[20])?`${fmt(picked.salary[20][0])}~${fmt(picked.salary[20][1])}`:fmt(picked.salary[20])}
            </div>
            <div style={{color:C.sub,fontSize:12}}>생활비 {fmt(picked.living[20])} 자동 차감</div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:20}}>
            {!rerollUsed && <Btn color={C.sub} onClick={()=>{setPicked(null);setRerollUsed(true);}}>다시 고르기 (1회)</Btn>}
            <Btn fill onClick={()=>onPickJob(picked)}>{rejob?"이 직업으로 이직! →":"이 직업으로 시작! →"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function InvestScreen({rec,onSubmit,onChangeJob}){
  const available=rec.checking;
  const [a,setA]=useState(()=>Object.fromEntries(ALLOC.map(x=>[x.key,0])));
  const used=ALLOC.reduce((s,x)=>s+(a[x.key]||0),0);
  const diff=available-used, matched=diff===0;
  const maxFor=(k)=>available-(used-(a[k]||0));
  const set=(k,v)=>setA(prev=>({...prev,[k]:Math.min(maxFor(k),Math.max(0,v))}));
  const totalNet=netWorth(rec);

  return(
    <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:16,padding:16,marginTop:14}}>

      {/* 누적 총자산 요약 */}
      <div style={{background:"linear-gradient(90deg,#fff8e8,#fdf4ff)",border:`1px solid ${C.gold}`,borderRadius:12,padding:"10px 14px",marginBottom:14}}>
        <div style={{fontSize:12,color:C.sub,marginBottom:4}}>💰 지금까지 모은 총자산</div>
        <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
          <span style={{fontFamily:"'Black Han Sans'",fontSize:22,color:C.gold}}>{fmt(totalNet)}</span>
          {ALLOC.filter(it=>it.key!=="insurance"&&it.key!=="parents").map(it=>{
            const v=rec[it.key]||0;
            return v>0?(
              <span key={it.key} style={{fontSize:12,color:C.sub}}>
                <span style={{color:it.color}}>{it.emoji}</span> {fmt(v)}
              </span>
            ):null;
          })}
          {(rec.insurance||0)>0&&<span style={{fontSize:12,color:C.sub}}>🛡️ {fmt(rec.insurance)}</span>}
          {(rec.parents||0)>0&&<span style={{fontSize:12,color:C.sub}}>🎁 {fmt(rec.parents)}</span>}
        </div>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
        <SectionLabel>💸 이번 달 투자금 배분</SectionLabel>
        <span style={{fontSize:12,color:C.sub}}>배분 가능 {fmt(available)}</span>
      </div>
      <div style={{textAlign:"center",margin:"6px 0 10px"}}>
        <span style={{fontFamily:"'Black Han Sans'",color:C.gold,fontSize:20}}>{fmt(available)}</span>
        <span style={{color:diff>0?C.red:C.green,fontSize:13,fontWeight:700,marginLeft:10}}>
          {diff>0?`(${fmt(diff)} 남음)`:"✅ 완료"}
        </span>
      </div>

      <div style={{display:"grid",gap:10}}>
        {ALLOC.map(item=>{
          const maxV=maxFor(item.key);
          const existing=rec[item.key]||0;
          const adding=a[item.key]||0;
          const afterTotal=existing+adding;
          return(
            <div key={item.key} style={{background:C.panel2,borderRadius:12,padding:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:20}}>{item.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:900,color:item.color}}>{item.name}</div>
                  <div style={{fontSize:11,color:C.sub}}>{item.hint}</div>
                </div>
                {/* 기존 보유 + 이번 추가 = 합계 */}
                <div style={{textAlign:"right",fontSize:12,lineHeight:1.5}}>
                  {existing>0&&<div style={{color:C.sub}}>기존 {fmt(existing)}</div>}
                  {adding>0&&<div style={{color:item.color,fontWeight:700}}>+{fmt(adding)}</div>}
                  <div style={{fontFamily:"'Black Han Sans'",color:C.gold,fontSize:15}}>
                    {afterTotal>0?`= ${fmt(afterTotal)}`:fmt(adding)}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:8}}>
                <Stepper onClick={()=>set(item.key,adding-5)}>-5</Stepper>
                <Stepper onClick={()=>set(item.key,adding-1)}>-1</Stepper>
                <input type="range" min={0} max={maxV} value={adding}
                  onChange={e=>set(item.key,+e.target.value)} style={{flex:1,accentColor:item.color}}/>
                <Stepper onClick={()=>set(item.key,adding+1)}>+1</Stepper>
                <Stepper onClick={()=>set(item.key,adding+5)}>+5</Stepper>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{marginTop:14}}>
        <Btn fill full disabled={!matched} onClick={()=>onSubmit(a)}>{matched?"투자 확정 →":`아직 ${fmt(diff)} 남았어요`}</Btn>
      </div>
      {onChangeJob&&(
        <div style={{marginTop:10,textAlign:"center"}}>
          <Btn small color="#fb923c" onClick={()=>{if(confirm("이직하면 이번 달 월급을 받지 못합니다. (게임당 1회) 진행할까요?")) onChangeJob();}}>🔄 이직하기 (1회 · 이번 달 월급 없음)</Btn>
        </div>
      )}
      {!onChangeJob&&rec.jobChanged&&<p style={{color:C.sub,fontSize:11,textAlign:"center",marginTop:8}}>이직 기회는 모두 사용했어요.</p>}
      <p style={{color:C.sub,fontSize:11,textAlign:"center",marginTop:8}}>단위: 1칸 = 10만원 · 남길 돈은 💳입출금통장에</p>
    </div>
  );
}
const Stepper=({children,onClick})=><button onClick={onClick} style={{background:C.panel2,color:C.sub,border:`1px solid ${C.line}`,borderRadius:8,padding:"4px 7px",fontSize:12,cursor:"pointer",fontWeight:700}}>{children}</button>;

function ResultBreakdown({result,onNext,isLast}){
  return(
    <div style={{marginTop:12,animation:"pop .35s"}}>
      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:16,padding:16}}>
        <SectionLabel>📑 나의 투자 결과</SectionLabel>
        <div style={{display:"grid",gap:6,marginTop:8}}>
          {result.lines.length===0&&<div style={{color:C.sub}}>이번엔 영향받은 자산이 없어요.</div>}
          {result.lines.map((l,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:C.panel2,borderRadius:10,padding:"8px 10px"}}>
              <span style={{flex:1,fontWeight:700}}>{l.isParents?"🎁 부모님 보답":assetName(l.key)}
                {!l.isParents&&<span style={{color:C.sub,fontSize:11,marginLeft:6}}>{(l.rate*100).toFixed(1)}%</span>}</span>
              {!l.isParents&&<span style={{color:C.sub,fontSize:12}}>{fmt(l.before)} →</span>}
              <span style={{fontWeight:900,color:l.diff>=0?C.green:C.red,minWidth:90,textAlign:"right"}}>{l.diff>=0?"+":"-"}{fmt(Math.abs(l.diff))}</span>
            </div>
          ))}
        </div>
        <div style={{borderTop:`1px solid ${C.line}`,marginTop:10,paddingTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <b>이번 손익</b>
          <span style={{fontFamily:"'Black Han Sans'",fontSize:22,color:result.total>=0?C.green:C.red}}>{result.total>=0?"▲ +":"▼ -"}{fmt(Math.abs(result.total))}</span>
        </div>
      </div>
      {onNext?(
        <div style={{marginTop:14}}><Btn fill full onClick={onNext}>{isLast?"🏆 최종 결과 보기":"⏭ 다음으로"}</Btn></div>
      ):(
        <p style={{textAlign:"center",color:C.sub,fontSize:13,marginTop:12,animation:"blink 1.6s infinite"}}>다연쌤이 다음 단계를 시작하길 기다리는 중…</p>
      )}
    </div>
  );
}

function Portfolio({rec}){
  const net=netWorth(rec);
  return(
    <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:16,padding:12}}>
      <div style={{display:"flex",height:10,borderRadius:6,overflow:"hidden",background:"#eceaf3"}}>
        {ASSETS.map(a=>{const v=rec[a.key]||0;return v>0?<div key={a.key} style={{width:`${(v/Math.max(1,net))*100}%`,background:a.color}}/>:null;})}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginTop:10}}>
        {ASSETS.map(a=>(
          <div key={a.key} style={{fontSize:12}}><span style={{color:a.color}}>● </span><span style={{color:C.sub}}>{a.name}</span><br/><b>{fmt(rec[a.key]||0)}</b></div>
        ))}
        {(rec.parents||0)>0&&<div style={{fontSize:12}}><span style={{color:"#fb7185"}}>🎁 </span><span style={{color:C.sub}}>효도</span><br/><b>{fmt(rec.parents)}</b></div>}
        {(rec.insurance||0)>0&&<div style={{fontSize:12}}><span style={{color:"#f43f5e"}}>🛡️ </span><span style={{color:C.sub}}>보험</span><br/><b>{fmt(rec.insurance)}</b></div>}
      </div>
    </div>
  );
}

/* ====== 은퇴 카드 ====== */
function RetirementCard({assets}){
  const {actualAge,lifeExpect,monthly}=calcRetirement(assets);
  const pct=Math.min(100,(actualAge/lifeExpect)*100);
  const color=actualAge>=lifeExpect?C.green:actualAge>=75?C.gold:C.red;
  return(
    <div style={{background:C.panel2,borderRadius:12,padding:12,marginTop:10,textAlign:"left"}}>
      <div style={{fontFamily:"'Black Han Sans'",color:C.gold,fontSize:12,marginBottom:8}}>🏖️ 은퇴 시뮬레이션 (60세 은퇴, 월 {fmt(monthly)} 생활 기준)</div>
      <div style={{height:14,background:"#eceaf3",borderRadius:7,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:7,transition:"width 1.2s ease"}}/>
      </div>
      <div style={{marginTop:8,fontFamily:"'Black Han Sans'",color,fontSize:20,textAlign:"center"}}>
        {actualAge>=lifeExpect?`😊 ${lifeExpect}세까지 여유롭게!`:`😰 ${actualAge}세까지만 버텨요`}
      </div>
      {actualAge<lifeExpect&&<div style={{color:C.sub,fontSize:11,textAlign:"center",marginTop:2}}>평균 수명 {lifeExpect}세 기준 · 은퇴 후 자금이 부족해요</div>}
    </div>
  );
}

/* ====== 최종 순위 ====== */
function FinalRanking({list,meId,onBack}){
  const top3=list.slice(0,3),rest=list.slice(3);
  const myRank=list.findIndex(p=>p.id===meId);
  const me=myRank>=0?list[myRank]:null;
  const filial=[...list].sort((a,b)=>(b.parents||0)-(a.parents||0))[0];
  const medals=["🥇","🥈","🥉"],pColor=["#e8c14d","#cbd5e1","#cd7f32"],pHeight=[140,105,88];

  return(
    <div style={{maxWidth:560,margin:"0 auto",padding:16,animation:"pop .4s"}}>
      <div style={{textAlign:"center",marginTop:6}}>
        <div style={{fontSize:52,animation:"fanfare .6s"}}>🏆</div>
        <Title size={34}>종암 투자왕 최종 순위</Title>
      </div>
      {me&&(
        <div style={{textAlign:"center",margin:"14px 0",background:C.panel,border:`2px solid ${C.gold}`,borderRadius:14,padding:14,animation:"pop .5s"}}>
          <div style={{color:C.sub,fontSize:13}}>{me.name}님은</div>
          <div style={{fontFamily:"'Black Han Sans'",fontSize:30,color:C.gold}}>{myRank+1}등 🎉</div>
          <div style={{marginTop:2}}>총자산 <b style={{color:C.gold}}>{fmt(netWorth(me))}</b></div>
          <RetirementCard assets={netWorth(me)}/>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,alignItems:"end",marginTop:8}}>
        {[1,0,2].map(idx=>{
          const p=top3[idx]; if(!p) return <div key={idx}/>;
          const job=jobByName(p.job),isMe=p.id===meId;
          return(
            <div key={p.id} style={{textAlign:"center"}}>
              <div style={{fontSize:28}}>{medals[idx]}</div>
              <div style={{fontSize:22}}>{job?.emoji}</div>
              <div style={{fontWeight:900,fontSize:13,color:isMe?C.gold:C.text}}>{p.name}{isMe?" (나)":""}</div>
              <div style={{fontFamily:"'Black Han Sans'",fontSize:12,color:C.gold}}>{fmt(netWorth(p))}</div>
              <div style={{height:pHeight[idx],marginTop:6,borderRadius:"10px 10px 0 0",
                background:`linear-gradient(180deg,${pColor[idx]},${pColor[idx]}33)`,border:`1px solid ${pColor[idx]}`,
                display:"grid",placeItems:"start center",paddingTop:6,fontFamily:"'Black Han Sans'",color:C.ink,fontSize:18}}>{idx+1}</div>
            </div>
          );
        })}
      </div>
      <div style={{marginTop:16}}>
        <SectionLabel>📊 전체 순위 & 은퇴 분석</SectionLabel>
        <div style={{display:"grid",gap:6,marginTop:8}}>
          {list.map((p,i)=>{
            const isMe=p.id===meId,job=jobByName(p.job);
            const {actualAge}=calcRetirement(netWorth(p));
            return(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,background:C.panel,
                border:`1px solid ${isMe?C.gold:C.line}`,borderRadius:10,padding:"8px 12px"}}>
                <span style={{fontFamily:"'Black Han Sans'",color:isMe?C.gold:C.sub,width:24}}>{i+1}</span>
                <span style={{fontSize:18}}>{job?.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:isMe?C.gold:C.text}}>{p.name}{isMe?" (나)":""}</div>
                  <div style={{fontSize:11,color:actualAge>=83?C.green:actualAge>=75?C.gold:C.red}}>
                    은퇴 후 {actualAge}세까지 생활 가능
                  </div>
                </div>
                <b style={{color:C.gold}}>{fmt(netWorth(p))}</b>
              </div>
            );
          })}
        </div>
      </div>
      {filial&&(filial.parents||0)>0&&(
        <div style={{textAlign:"center",marginTop:14,color:C.sub,fontSize:13}}>🎁 효도왕: <b style={{color:"#fb7185"}}>{filial.name}</b> (누적 {fmt(filial.parents)})</div>
      )}
      {list.length===0&&<Empty>참가자 데이터가 없어요.</Empty>}
      <div style={{textAlign:"center",marginTop:18}}><Btn small color={C.sub} onClick={onBack}>처음으로</Btn></div>
    </div>
  );
}

/* ====== 속보 배너 ====== */
function NewsBanner({event}){
  const cc=CAT[event.cat]||C.gold;
  const now=new Date();
  const hh=String(now.getHours()).padStart(2,"0"),mm=String(now.getMinutes()).padStart(2,"0");
  const tick=` 📢 속보  ·  ${event.ticker}  ·  ${event.title}  · `;
  return(
    <div style={{marginTop:12,borderRadius:14,overflow:"hidden",border:`2px solid #ef4444`,animation:"slideDown .4s",boxShadow:"0 10px 30px #0008"}}>
      <div style={{background:"linear-gradient(90deg,#b91c1c,#ef4444)",color:"#fff",padding:"7px 12px",display:"flex",alignItems:"center",gap:8}}>
        <span style={{background:"#fff",color:"#b91c1c",fontFamily:"'Black Han Sans'",fontSize:12,padding:"1px 7px",borderRadius:4}}>LIVE</span>
        <span style={{fontFamily:"'Black Han Sans'",letterSpacing:1}}>📺 종암뉴스 24</span>
        <span style={{marginLeft:"auto",fontSize:12,opacity:0.9}}>속보 · {hh}:{mm}</span>
      </div>
      <div style={{background:"linear-gradient(160deg,#1a1014,#15171f)",padding:16}}>
        <span style={{display:"inline-block",background:`${cc}22`,color:cc,border:`1px solid ${cc}`,borderRadius:6,fontSize:11,fontWeight:800,padding:"2px 8px",marginBottom:10}}>
          {event.icon} {event.cat}
        </span>
        <div style={{fontFamily:"'Black Han Sans'",fontSize:21,lineHeight:1.3,color:"#fff"}}>{event.title}</div>
        <p style={{color:"#c9ced8",marginTop:8,fontSize:14,lineHeight:1.55}}>{event.body}</p>
      </div>
      <div style={{overflow:"hidden",background:"#000",borderTop:"2px solid #b91c1c",display:"flex",alignItems:"center"}}>
        <span style={{background:"#b91c1c",color:"#fff",fontFamily:"'Black Han Sans'",fontSize:12,padding:"6px 10px",whiteSpace:"nowrap",flexShrink:0}}>속보</span>
        <div style={{display:"inline-flex",whiteSpace:"nowrap",animation:"ticker 18s linear infinite",color:"#ffd9d9",fontSize:13,padding:"6px 0"}}>
          <span>{tick}{tick}</span><span>{tick}{tick}</span>
        </div>
      </div>
    </div>
  );
}

/* ===================== 다연쌤 ===================== */
function AdminView({onBack,room}){
  const GKEY=mkGKey(room);
  const ppfx=mkPPfx(room);
  const [players,setPlayers]=useState([]);
  const [game,setGame]=useState(null);
  const [pickNews,setPickNews]=useState(false);

  useEffect(()=>{
    let active=true;
    const tick=async()=>{
      const g=await sGet(GKEY);
      const keys=await sList(ppfx);
      const list=(await Promise.all(keys.map(k=>sGet(k)))).filter(Boolean);
      if (!active) return;
      setGame(g); setPlayers(list.sort((a,b)=>netWorth(b)-netWorth(a)));
    };
    tick(); const iv=setInterval(tick,2000);
    return()=>{active=false;clearInterval(iv);};
  },[]);

  const round=game?.round||1,phase=game?.phase||"invest";
  const meta=getRoundMeta(round);
  const maxNet=Math.max(1,...players.map(netWorth));
  const classPlayers=players.filter(p=>(p.round||1)===round);
  const readyCount=classPlayers.filter(p=>p.ready).length;
  const notReady=classPlayers.filter(p=>!p.ready);

  const start=()=>sSet(GKEY,{round:1,phase:"invest",newsId:null});
  const release=(id)=>sSet(GKEY,{...(game||{round:1}),phase:"news",newsId:id||EVENTS[Math.floor(Math.random()*EVENTS.length)].id});
  const next=()=>{
    const nr=(game?.round||1)+1;
    if (nr>TOTAL_ROUNDS) sSet(GKEY,{...(game||{round:1}),phase:"end"});
    else sSet(GKEY,{round:nr,phase:"invest",newsId:null});
  };
  const endGame=()=>sSet(GKEY,{...(game||{round:1}),phase:"end"});
  const reset=async()=>{const keys=await sList(ppfx);await Promise.all(keys.map(sDel));await sDel(GKEY);setPlayers([]);setGame(null);};

  return(
    <div style={{maxWidth:1000,margin:"0 auto",padding:16}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{cursor:"pointer",color:C.sub}} onClick={onBack}>←</span>
          <Title size={24}>🖥️ 다연쌤</Title>
          <Badge color="#60a5fa">2학년 {room}</Badge>
          <Badge>{players.length}명</Badge>
          <span style={{fontFamily:"'Black Han Sans'",color:C.gold}}>{meta.label}</span>
          <Badge color={phase==="news"?C.red:phase==="end"?C.gold:C.green}>
            {phase==="news"?"속보 발생":phase==="end"?"게임 종료":"투자 시간"}
          </Badge>
        </div>
        <Btn small color={C.sub} onClick={()=>{if(confirm("전체 초기화할까요?")) reset();}}>전체 초기화</Btn>
      </div>

      <div style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:16,padding:14,marginTop:14,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        {!game?(
          <Btn fill onClick={start}>▶ 게임 시작 (20대 1달차)</Btn>
        ):phase==="end"?(
          <>
            <span style={{fontFamily:"'Black Han Sans'",color:C.gold}}>🏆 최종 순위 발표 중</span>
            <Btn fill onClick={()=>{if(confirm("새 게임?")) reset();}}>🔄 새 게임</Btn>
          </>
        ):phase==="invest"?(
          <>
            <div style={{animation:readyCount===classPlayers.length&&classPlayers.length?"pulseRed 1.4s infinite":"none",borderRadius:12}}>
              <Btn fill color={C.red} onClick={()=>setPickNews(true)}>📰 속보 띄우기</Btn>
            </div>
            <span style={{color:C.sub,fontSize:14}}>투자 완료 <b style={{color:C.gold}}>{readyCount}</b> / {classPlayers.length}명</span>
            {classPlayers.length>0&&readyCount===classPlayers.length&&<Badge color={C.green}>전원 완료!</Badge>}
          </>
        ):(
          <Btn fill onClick={next}>
            {(game?.round||1)>=TOTAL_ROUNDS?"🏁 최종 순위 발표":`⏭ 다음 단계 (${getRoundMeta((game?.round||1)+1).label})`}
          </Btn>
        )}
        {game&&phase!=="end"&&(
          <Btn color={C.gold} onClick={()=>{if(confirm("게임을 종료하고 최종 순위를 발표할까요?")) endGame();}}>🏁 게임 종료</Btn>
        )}
      </div>

      {phase==="news"&&game?.newsId&&<NewsBanner event={eventById(game.newsId)}/>}

      {phase==="invest"&&notReady.length>0&&(
        <div style={{background:"#fff8e1",border:`1px solid #f59e0b`,borderRadius:12,padding:"10px 14px",marginTop:10}}>
          <span style={{fontWeight:900,color:"#b45309"}}>⏳ 아직 투자 안 한 학생: </span>
          <span style={{color:"#92400e"}}>{notReady.map(p=>p.name).join(", ")}</span>
        </div>
      )}

      {phase==="end"?(
        <FinalRanking list={players} meId={null} onBack={onBack}/>
      ):(
        <div style={{marginTop:16}}>
          <SectionLabel>📊 실시간 순위 (총자산)</SectionLabel>
          {players.length===0?<Empty>아직 참가자가 없어요. 학생들에게 '수업 참여'로 입장하라고 안내하세요.</Empty>:(
            <div style={{display:"grid",gap:8,marginTop:8}}>
              {players.map((p,i)=>{
                const net=netWorth(p),job=jobByName(p.job);
                const isReady=p.ready&&(p.round||1)===round&&phase==="invest";
                const notYet=!p.ready&&(p.round||1)===round&&phase==="invest";
                return(
                  <div key={p.id} style={{background:C.panel,border:`2px solid ${isReady?C.green:notYet?"#f59e0b":C.line}`,borderRadius:12,padding:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontFamily:"'Black Han Sans'",width:28,color:i===0?C.gold:C.sub,fontSize:18}}>{i===0?"👑":i+1}</span>
                      <span style={{fontSize:22}}>{job?.emoji}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:900}}>{p.name}
                          <span style={{color:C.sub,fontSize:12,fontWeight:500}}> {p.job} · {getRoundMeta(p.round||1).label}</span>
                          {isReady&&<span style={{marginLeft:6}}><Badge color={C.green}>✅ 완료</Badge></span>}
                          {notYet&&<span style={{marginLeft:6}}><Badge color="#f59e0b">⏳ 투자중</Badge></span>}
                        </div>
                        <div style={{height:6,background:"#eceaf3",borderRadius:6,marginTop:6,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${(net/maxNet)*100}%`,background:`linear-gradient(90deg,${C.goldDim},${C.gold})`,borderRadius:6}}/>
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontFamily:"'Black Han Sans'",color:C.gold,fontSize:16}}>{fmt(net)}</div>
                        {p.lastResult&&<div style={{fontSize:12,color:p.lastResult.total>=0?C.green:C.red}}>{p.lastResult.total>=0?"▲":"▼"} {fmt(Math.abs(p.lastResult.total))}</div>}
                      </div>
                    </div>
                    <div style={{display:"flex",height:8,borderRadius:6,overflow:"hidden",marginTop:10,background:"#eceaf3"}}>
                      {ASSETS.map(a=>{const v=p[a.key]||0;return v>0?<div key={a.key} style={{width:`${(v/Math.max(1,net))*100}%`,background:a.color}}/>:null;})}
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"4px 10px",marginTop:8}}>
                      {ALLOC.filter(a=>a.key!=="parents"&&a.key!=="insurance").map(a=>{
                        const v=p[a.key]||0;
                        return v>0?(<span key={a.key} style={{fontSize:12,color:C.sub}}><span style={{color:a.color}}>{a.emoji}</span> {a.name} <b style={{color:C.text}}>{fmt(v)}</b></span>):null;
                      })}
                      {(p.insurance||0)>0&&<span style={{fontSize:12,color:C.sub}}>🛡️ 보험 <b style={{color:C.text}}>{fmt(p.insurance)}</b></span>}
                      {(p.parents||0)>0&&<span style={{fontSize:12,color:C.sub}}>🎁 효도 <b style={{color:C.text}}>{fmt(p.parents)}</b></span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {pickNews&&(
        <div onClick={()=>setPickNews(false)} style={{position:"fixed",inset:0,background:"#000a",display:"grid",placeItems:"center",padding:16,zIndex:50}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.panel,border:`1px solid ${C.line}`,borderRadius:18,padding:18,width:"100%",maxWidth:480}}>
            <Title size={22}>📰 어떤 속보를 띄울까요?</Title>
            <div style={{marginTop:10}}><Btn fill color={C.red} full onClick={()=>{release();setPickNews(false);}}>🎲 랜덤 속보!</Btn></div>
            <div style={{maxHeight:340,overflow:"auto",marginTop:12,display:"grid",gap:6}}>
              {EVENTS.map(e=>(
                <button key={e.id} onClick={()=>{release(e.id);setPickNews(false);}} style={{textAlign:"left",background:C.panel2,border:`1px solid ${C.line}`,borderRadius:10,padding:10,color:C.text,cursor:"pointer"}}>
                  <span style={{color:CAT[e.cat],fontSize:11,fontWeight:800}}>{e.icon} {e.cat}</span>
                  <div style={{fontWeight:800,fontSize:13,marginTop:2}}>{e.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
