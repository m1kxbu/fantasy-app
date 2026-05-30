import React, { useState, useMemo, useRef, useEffect } from "react";
import * as d3 from "d3";
import { Search, X, TrendingUp, TrendingDown, ChevronDown, Grid2x2, Circle, ExternalLink, Filter, Minus } from "lucide-react";

/* ============================================================
   GRIDIRON EXCHANGE — Fantasy Football ADP, traded like stock
   ------------------------------------------------------------
   ADP / team / bye / Best Ball numbers: REAL, pulled from
   FantasyPros (2026 consensus). Movement deltas (1D/7D/14D/30D)
   are deterministically SIMULATED for this v1 demo — see footer.
   ============================================================ */

/* ---------- team colors (all 32, primary) ---------- */
const TEAM = {
  ARI:"#97233F",ATL:"#A71930",BAL:"#241773",BUF:"#00338D",CAR:"#0085CA",CHI:"#0B162A",
  CIN:"#FB4F14",CLE:"#552E0E",DAL:"#0b2a5b",DEN:"#FB4F14",DET:"#0076B6",GB:"#203731",
  HOU:"#0c2c41",IND:"#013369",JAC:"#107c91",KC:"#E31837",LV:"#3a3a3a",LAC:"#0080C6",
  LAR:"#1f4eb5",MIA:"#008E97",MIN:"#4F2683",NE:"#0a2a55",NO:"#9a8557",NYG:"#0B2265",
  NYJ:"#1f7a4d",PHI:"#006b5b",PIT:"#d4a017",SF:"#AA0000",SEA:"#0a3a6b",TB:"#D50A0A",
  TEN:"#2f6fb0",WAS:"#5A1414"
};

/* ---------- position colors ---------- */
const POS = {
  QB:{c:"#ef4444",bg:"rgba(239,68,68,.16)"},
  RB:{c:"#22c55e",bg:"rgba(34,197,94,.16)"},
  WR:{c:"#3b9bff",bg:"rgba(59,155,255,.16)"},
  TE:{c:"#f59e0b",bg:"rgba(245,158,11,.16)"},
};

/* ---------- REAL data (FantasyPros 2026): ppr ADP, bestball ADP, rookie ---------- */
const RAW = [
 ["Jahmyr Gibbs","DET",6,"RB",1.5,1.8],["Bijan Robinson","ATL",11,"RB",1.5,1.2],
 ["Ja'Marr Chase","CIN",6,"WR",3.0,3.0],["Puka Nacua","LAR",11,"WR",4.0,4.0],
 ["Jaxon Smith-Njigba","SEA",11,"WR",5.0,5.2],["Christian McCaffrey","SF",8,"RB",6.0,6.0],
 ["Jonathan Taylor","IND",13,"RB",7.5,7.0],["Amon-Ra St. Brown","DET",6,"WR",7.5,7.8],
 ["Ashton Jeanty","LV",13,"RB",10.0,13.0],["CeeDee Lamb","DAL",14,"WR",10.5,10.8],
 ["Justin Jefferson","MIN",6,"WR",11.0,10.4],["James Cook III","BUF",7,"RB",11.0,10.4],
 ["De'Von Achane","MIA",6,"RB",12.5,12.4],["Saquon Barkley","PHI",10,"RB",15.5,15.0],
 ["Kenneth Walker III","KC",5,"RB",15.5,18.4],["Chase Brown","CIN",6,"RB",15.5,18.6],
 ["Omarion Hampton","LAC",7,"RB",16.0,18.2],["Drake London","ATL",11,"WR",18.0,19.6],
 ["Trey McBride","ARI",14,"TE",20.0,17.4],["Brock Bowers","LV",13,"TE",21.0,20.2],
 ["Derrick Henry","BAL",13,"RB",21.0,20.6],["Jeremiyah Love","ARI",14,"RB",22.0,22.4,1],
 ["Nico Collins","HOU",8,"WR",23.0,25.4],["Rashee Rice","KC",5,"WR",25.0,19.6],
 ["George Pickens","DAL",14,"WR",25.5,25.6],["A.J. Brown","PHI",10,"WR",27.0,29.4],
 ["Josh Jacobs","GB",11,"RB",27.0,28.4],["Malik Nabers","NYG",8,"WR",28.0,22.8],
 ["Chris Olave","NO",8,"WR",28.5,30.0],["Josh Allen","BUF",7,"QB",30.0,24.4],
 ["Breece Hall","NYJ",13,"RB",30.0,33.8],["Kyren Williams","LAR",11,"RB",31.5,31.8],
 ["Travis Etienne Jr.","NO",8,"RB",32.5,35.2],["DeVonta Smith","PHI",10,"WR",34.5,37.4],
 ["Javonte Williams","DAL",14,"RB",36.5,36.8],["Garrett Wilson","NYJ",13,"WR",36.5,40.0],
 ["Tee Higgins","CIN",6,"WR",36.5,36.8],["Zay Flowers","BAL",13,"WR",36.5,40.0],
 ["Tetairoa McMillan","CAR",5,"WR",37.0,36.4],["Ladd McConkey","LAC",7,"WR",40.5,44.4],
 ["Emeka Egbuka","TB",10,"WR",42.5,41.8],["Cam Skattebo","NYG",8,"RB",42.5,44.2],
 ["Colston Loveland","CHI",10,"TE",44.0,39.6],["Bucky Irving","TB",10,"RB",44.5,43.4],
 ["Luther Burden III","CHI",10,"WR",46.0,48.2],["Davante Adams","LAR",11,"WR",47.0,49.6],
 ["TreVeyon Henderson","NE",11,"RB",49.0,50.6],["David Montgomery","HOU",8,"RB",50.0,50.4],
 ["Jaylen Waddle","DEN",10,"WR",50.0,53.8],["Terry McLaurin","WAS",7,"WR",50.5,56.2],
 ["Lamar Jackson","BAL",13,"QB",50.5,44.4],["Jameson Williams","DET",6,"WR",51.0,54.4],
 ["D'Andre Swift","CHI",10,"RB",51.5,56.4],["DJ Moore","BUF",7,"WR",52.0,49.6],
 ["Quinshon Judkins","CLE",11,"RB",54.0,51.6],["Christian Watson","GB",11,"WR",56.0,66.0],
 ["Mike Evans","SF",8,"WR",56.0,55.0],["Rome Odunze","CHI",10,"WR",57.5,61.4],
 ["Joe Burrow","CIN",6,"QB",60.0,52.4],["Bhayshul Tuten","JAC",7,"RB",60.5,63.8],
 ["Drake Maye","NE",11,"QB",62.0,56.4],["Jadarian Price","SEA",11,"RB",62.5,59.2,1],
 ["Carnell Tate","TEN",9,"WR",63.5,69.4,1],["Tyler Warren","IND",13,"TE",64.0,56.8],
 ["Jayden Daniels","WAS",7,"QB",64.0,60.0],["Chuba Hubbard","CAR",5,"RB",65.0,68.4],
 ["Marvin Harrison Jr.","ARI",14,"WR",67.5,70.2],["Caleb Williams","CHI",10,"QB",69.0,66.8],
 ["Jalen Hurts","PHI",10,"QB",71.0,67.8],["Jordyn Tyson","NO",8,"WR",72.0,null,1],
 ["Jaylen Warren","PIT",9,"RB",72.5,null],["Brian Thomas Jr.","JAC",7,"WR",74.0,73.8],
 ["DK Metcalf","PIT",9,"WR",74.0,null],["Alec Pierce","IND",13,"WR",75.5,null],
 ["Parker Washington","JAC",7,"WR",76.0,null],["Rhamondre Stevenson","NE",11,"RB",76.5,null],
 ["RJ Harvey","DEN",10,"RB",77.0,null],["Justin Herbert","LAC",7,"QB",78.0,null],
 ["Courtland Sutton","DEN",10,"WR",79.0,null],["Tony Pollard","TEN",9,"RB",79.5,null],
 ["Dak Prescott","DAL",14,"QB",79.5,73.8],["Trevor Lawrence","JAC",7,"QB",80.0,null],
 ["Jaxson Dart","NYG",8,"QB",82.0,null],["Harold Fannin Jr.","CLE",11,"TE",83.5,74.0],
 ["Makai Lemon","PHI",10,"WR",84.0,null,1],["Tucker Kraft","GB",11,"TE",85.0,null],
 ["Michael Wilson","ARI",14,"WR",88.5,null],["Rico Dowdle","PIT",9,"RB",89.5,null],
 ["Chris Godwin Jr.","TB",10,"WR",91.0,null],["Kyle Monangai","CHI",10,"RB",91.5,null],
 ["Patrick Mahomes II","KC",5,"QB",93.5,null],["Brock Purdy","SF",8,"QB",94.0,null],
 ["Matthew Stafford","LAR",11,"QB",94.5,null],["Sam LaPorta","DET",6,"TE",94.5,null],
 ["Kyle Pitts Sr.","ATL",11,"TE",95.0,null],["Jakobi Meyers","JAC",7,"WR",96.0,null],
 ["Jayden Reed","GB",11,"WR",97.0,null],["Quentin Johnston","LAC",7,"WR",97.0,null],
 ["Ricky Pearsall","SF",8,"WR",97.0,null],["Jordan Addison","MIN",6,"WR",100.5,null],
 ["Blake Corum","LAR",11,"RB",100.5,null],["Michael Pittman Jr.","PIT",9,"WR",100.5,null],
 ["Bo Nix","DEN",10,"QB",101.5,null],["Kenneth Gainwell","TB",10,"RB",101.5,null],
 ["Jared Goff","DET",6,"QB",102.5,null],["Josh Downs","IND",13,"WR",105.5,null],
 ["J.K. Dobbins","DEN",10,"RB",106.0,null],["Tyler Shough","NO",8,"QB",106.5,null],
 ["Kyler Murray","MIN",6,"QB",108.0,null],["Jordan Love","GB",11,"QB",109.0,null],
];

/* ---------- deterministic pseudo-random movement (demo) ---------- */
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const r1=n=>Math.round(n*10)/10;

function buildPlayers(){
  return RAW.map((row)=>{
    const [n,t,by,p,ppr,bb,rk]=row;
    const rnd=mulberry32(hash(n));
    // momentum: bias a chunk toward flat
    let mom=(rnd()*2-1); if(rnd()<0.18) mom*=0.15;
    const vol=4+ppr*0.13;                       // deeper players swing more
    const d30=r1(mom*vol*(0.8+rnd()*0.6));
    const d14=r1(d30*(0.5+rnd()*0.22)+(rnd()*2-1)*0.6);
    const d7 =r1(d30*(0.28+rnd()*0.2)+(rnd()*2-1)*0.5);
    const d1 =rnd()<0.5?0:r1(d30*(0.05+rnd()*0.12)+(rnd()*2-1)*0.3);
    // 30-day ADP trend (positive delta = rose = adp decreased over time)
    const start=ppr+d30; const trend=[];
    for(let i=0;i<=29;i++){const f=i/29; let v=start+(ppr-start)*f+(rnd()*2-1)*0.7; trend.push(r1(Math.max(0.6,v)));}
    trend[29]=ppr;
    return {n,t,by,p,ppr,bb:bb??null,rk:!!rk,d:{ "1D":d1,"7D":d7,"14D":d14,"30D":d30 },trend};
  });
}
const PLAYERS=buildPlayers();

const WINDOWS=["1D","7D","14D","30D"];
const DOMAIN={ "1D":5,"7D":11,"14D":18,"30D":28 };

/* ---------- color helpers ---------- */
function hx(h){h=h.replace("#","");return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function mix(a,b,t){const A=hx(a),B=hx(b);return`rgb(${Math.round(A[0]+(B[0]-A[0])*t)},${Math.round(A[1]+(B[1]-A[1])*t)},${Math.round(A[2]+(B[2]-A[2])*t)})`;}
const FLAT="#2a2f3a", G_MID="#1f7a44", G_HI="#11d676", R_MID="#7a2330", R_HI="#ff4d5e";
function moveFill(delta,win){
  const t=Math.max(-1,Math.min(1,delta/DOMAIN[win]));
  const a=Math.abs(t);
  if(a<0.045) return FLAT;
  return t>0 ? mix(FLAT, a<0.5?G_MID:G_HI, a<0.5?a/0.5:(a-0.5)/0.5)
             : mix(FLAT, a<0.5?R_MID:R_HI, a<0.5?a/0.5:(a-0.5)/0.5);
}
function moveText(delta){ if(Math.abs(delta)<0.05) return "#9aa3b2"; return delta>0?"#7df2b0":"#ff9aa6"; }

/* ---------- misc ---------- */
const SUFFIX=new Set(["jr.","jr","sr.","sr","ii","iii","iv"]);
function lastName(n){
  let parts=n.split(" ").filter(x=>!SUFFIX.has(x.toLowerCase()));
  let last=parts[parts.length-1];
  if(parts.length>=2 && /^(st\.|de|van|le)$/i.test(parts[parts.length-2])) last=parts[parts.length-2]+" "+last;
  return last;
}
const fmtD=d=>(d>0?"+":d<0?"−":"±")+Math.abs(d).toFixed(1);

/* ---------- error boundary so a bad layout can't white-screen ---------- */
class VizBoundary extends React.Component{
  constructor(p){super(p);this.state={err:false};}
  static getDerivedStateFromError(){return{err:true};}
  componentDidUpdate(prev){ if(prev.dep!==this.props.dep && this.state.err) this.setState({err:false}); }
  render(){ return this.state.err
    ? <div className="empty">Couldn't render this view — try another timeframe or filter.</div>
    : this.props.children; }
}

/* ============================================================ */
export default function App(){
  const [scoring,setScoring]=useState("ppr");      // ppr | bb
  const [posTab,setPosTab]=useState("ALL");        // ALL QB RB WR TE ROOKIES
  const [view,setView]=useState("bubbles");        // bubbles | heatmap
  const [win,setWin]=useState("7D");
  const [sizeBy,setSizeBy]=useState("value");      // value | move | uniform
  const [teamSel,setTeamSel]=useState([]);         // multi
  const [teamOpen,setTeamOpen]=useState(false);
  const [sizeOpen,setSizeOpen]=useState(false);
  const [q,setQ]=useState("");
  const [sortKey,setSortKey]=useState("rank");     // rank | move
  const [sel,setSel]=useState(null);               // drawer player
  const [hover,setHover]=useState(null);           // {p,x,y}

  /* scoring universe: pick adp, drop bb-nulls in bb mode, rank by adp */
  const universe=useMemo(()=>{
    let list=PLAYERS.map(p=>({...p,adp:scoring==="bb"?p.bb:p.ppr}))
                    .filter(p=>p.adp!=null)
                    .sort((a,b)=>a.adp-b.adp);
    // overall + position ranks
    const posCount={};
    list.forEach((p,i)=>{ p.rank=i+1; posCount[p.p]=(posCount[p.p]||0)+1; p.posRank=posCount[p.p]; });
    return list;
  },[scoring]);

  const teams=useMemo(()=>Array.from(new Set(universe.map(p=>p.t))).sort(),[universe]);

  /* filtered set for viz + table */
  const filtered=useMemo(()=>{
    return universe.filter(p=>{
      if(posTab==="ROOKIES"){ if(!p.rk) return false; }
      else if(posTab!=="ALL" && p.p!==posTab) return false;
      if(teamSel.length && !teamSel.includes(p.t)) return false;
      if(q && !p.n.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  },[universe,posTab,teamSel,q]);

  const tableRows=useMemo(()=>{
    const arr=[...filtered];
    if(sortKey==="move") arr.sort((a,b)=>b.d[win]-a.d[win]);
    else arr.sort((a,b)=>a.adp-b.adp);
    return arr;
  },[filtered,sortKey,win]);

  /* ticker: top movers of the scoring universe */
  const ticker=useMemo(()=>{
    const up=[...universe].sort((a,b)=>b.d[win]-a.d[win]).slice(0,8);
    const dn=[...universe].sort((a,b)=>a.d[win]-b.d[win]).slice(0,8);
    return [...up,...dn].sort((a,b)=>Math.abs(b.d[win])-Math.abs(a.d[win]));
  },[universe,win]);

  return (
    <div className="gx">
      <style>{CSS}</style>

      {/* ===== TICKER ===== */}
      <div className="ticker">
        <div className="tickInner">
          {[...ticker,...ticker].map((p,i)=>(
            <span className="tk" key={i}>
              <span className="tkn">{lastName(p.n)}</span>
              <span style={{color:moveText(p.d[win])}}>
                {p.d[win]>0?<TrendingUp size={11}/>:p.d[win]<0?<TrendingDown size={11}/>:<Minus size={11}/>} {fmtD(p.d[win])}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ===== HEADER ===== */}
      <header className="hd">
        <div className="brand">
          <div className="logo"><span/><span/><span/></div>
          <div>
            <h1>GRIDIRON <em>EXCHANGE</em></h1>
            <p>fantasy ADP · traded like stock</p>
          </div>
        </div>
        <div className="searchBox">
          <Search size={15}/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search player…"/>
          {q && <X size={14} className="clr" onClick={()=>setQ("")}/>}
        </div>
      </header>

      {/* ===== CONTROL BAR 1: scoring + position tabs ===== */}
      <div className="bar">
        <div className="seg score">
          <button className={scoring==="ppr"?"on":""} onClick={()=>setScoring("ppr")}>PPR</button>
          <button className={scoring==="bb"?"on bbon":""} onClick={()=>setScoring("bb")}>BEST BALL</button>
        </div>
        <div className="tabs">
          {["ALL","QB","RB","WR","TE","ROOKIES"].map(t=>(
            <button key={t} className={posTab===t?"tab on":"tab"} onClick={()=>setPosTab(t)}
              style={posTab===t&&POS[t]?{color:POS[t].c,borderColor:POS[t].c}:undefined}>
              {t==="ALL"?"Overall":t==="ROOKIES"?"Rookies":t}
            </button>
          ))}
        </div>
      </div>

      {/* ===== CONTROL BAR 2: view + timeframe + size + team ===== */}
      <div className="bar bar2">
        <div className="seg">
          <button className={view==="bubbles"?"on":""} onClick={()=>setView("bubbles")}><Circle size={13}/> Bubbles</button>
          <button className={view==="heatmap"?"on":""} onClick={()=>setView("heatmap")}><Grid2x2 size={13}/> Heat Map</button>
        </div>

        <div className="seg tf">
          {WINDOWS.map(w=>(
            <button key={w} className={win===w?"on":""} onClick={()=>setWin(w)}>{w}</button>
          ))}
        </div>

        <div className="dd">
          <button className="ddbtn" onClick={()=>{setSizeOpen(o=>!o);setTeamOpen(false);}}>
            Size: {sizeBy==="value"?"ADP value":sizeBy==="move"?"Movement":"Uniform"} <ChevronDown size={13}/>
          </button>
          {sizeOpen&&(
            <div className="ddmenu">
              <span className="ddhead">SIZE BY</span>
              {[["value","ADP value"],["move","Movement"],["uniform","Uniform"]].map(([k,l])=>(
                <button key={k} className={sizeBy===k?"sel":""} onClick={()=>{setSizeBy(k);setSizeOpen(false);}}>{l}</button>
              ))}
            </div>
          )}
        </div>

        <div className="dd">
          <button className="ddbtn" onClick={()=>{setTeamOpen(o=>!o);setSizeOpen(false);}}>
            <Filter size={12}/> Team{teamSel.length?` · ${teamSel.length}`:""} <ChevronDown size={13}/>
          </button>
          {teamOpen&&(
            <div className="ddmenu teamMenu">
              <div className="teamTop">
                <span className="ddhead">FILTER TEAM</span>
                {teamSel.length>0&&<button className="lnk" onClick={()=>setTeamSel([])}>clear</button>}
              </div>
              <div className="teamGrid">
                {teams.map(t=>(
                  <button key={t} className={teamSel.includes(t)?"tchip on":"tchip"}
                    style={teamSel.includes(t)?{background:TEAM[t],borderColor:TEAM[t]}:{}}
                    onClick={()=>setTeamSel(s=>s.includes(t)?s.filter(x=>x!==t):[...s,t])}>{t}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="count">{filtered.length} players</div>
      </div>

      {/* ===== VISUALIZATION ===== */}
      <div className="vizWrap" onClick={()=>{setSizeOpen(false);setTeamOpen(false);}}>
        {filtered.length===0
          ? <div className="empty">No players match these filters.</div>
          : <VizBoundary dep={`${view}|${win}|${sizeBy}|${scoring}|${posTab}|${teamSel.join(",")}|${q}`}>
              {view==="bubbles"
                ? <Bubbles data={filtered} win={win} sizeBy={sizeBy} onPick={setSel} onHover={setHover}/>
                : <Heatmap data={filtered} win={win} sizeBy={sizeBy} onPick={setSel} onHover={setHover}/>}
            </VizBoundary>}
        {view==="heatmap"&&filtered.length>0&&<Legend win={win}/>}
        {hover&&(
          <div className="tip" style={{left:hover.x,top:hover.y}}>
            <b>{hover.p.n}</b>
            <span className="tipsub">{hover.p.p}{hover.p.posRank} · {hover.p.t} · ADP {hover.p.adp.toFixed(1)}</span>
            <span style={{color:moveText(hover.p.d[win])}}>{fmtD(hover.p.d[win])} spots ({win})</span>
          </div>
        )}
      </div>

      {/* ===== LIST ===== */}
      <div className="listHead">
        <h2>{scoring==="bb"?"Best Ball":"PPR"} ADP · {posTab==="ALL"?"Overall":posTab==="ROOKIES"?"Rookies":posTab}</h2>
        <div className="sortToggle">
          <span>Sort</span>
          <button className={sortKey==="rank"?"on":""} onClick={()=>setSortKey("rank")}>ADP</button>
          <button className={sortKey==="move"?"on":""} onClick={()=>setSortKey("move")}>Movers {win}</button>
        </div>
      </div>

      <div className="tableScroll">
        <table className="tbl">
          <thead>
            <tr>
              <th className="cR">#</th><th>Player</th><th className="cP">POS</th>
              <th className="cN" onClick={()=>setSortKey("rank")}>ADP</th>
              <th className="cN" onClick={()=>setSortKey("move")}>Δ {win}</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(p=>(
              <tr key={p.n} onClick={()=>setSel(p)}>
                <td className="cR">{sortKey==="move"?p.rank:p.rank}</td>
                <td>
                  <span className="dot" style={{background:TEAM[p.t]}}/>
                  <span className="pn">{p.n}</span>
                  <span className="pmeta">{p.t} ({p.by}){p.rk&&<i className="rkTag">R</i>}</span>
                </td>
                <td className="cP">
                  <span className="posBadge" style={{color:POS[p.p].c,background:POS[p.p].bg}}>{p.p}{p.posRank}</span>
                </td>
                <td className="cN adp">{p.adp.toFixed(1)}</td>
                <td className="cN" style={{color:moveText(p.d[win])}}>
                  {p.d[win]>0?"▲":p.d[win]<0?"▼":"–"} {Math.abs(p.d[win]).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="ft">
        <span><b>ADP, teams, byes & Best Ball values are live from FantasyPros (2026).</b> Movement (1D/7D/14D/30D) is
        simulated for this v1 demo — production needs a nightly snapshot of ADP into a DB to compute real deltas.</span>
        <span>Green = rising draft stock (ADP getting earlier) · Red = falling.</span>
      </footer>

      {sel&&<Drawer p={sel} scoring={scoring} onClose={()=>setSel(null)}/>}
    </div>
  );
}

/* ============================================================
   BUBBLES (loose force layout w/ gentle float, à la cryptobubbles)
   ============================================================ */
function Bubbles({data,win,sizeBy,onPick,onHover}){
  const W=1000,H=620;
  const nodes=useMemo(()=>{
    const radius=p=>{
      if(sizeBy==="uniform")return 26;
      if(sizeBy==="move")return 12+Math.sqrt(Math.abs(p.d[win]))*9;
      return 8+Math.pow(Math.max(1,135-p.adp),0.6)*2.6;
    };
    let arr=data.map(p=>({p,r:Math.max(8,radius(p)||8)}));
    // normalize total bubble area to ~40% of canvas -> lots of gaps = loose
    const target=W*H*0.40;
    const area=arr.reduce((s,d)=>s+Math.PI*d.r*d.r,0)||1;
    const k=Math.sqrt(target/area);
    arr.forEach(d=>{ d.r=Math.max(9,Math.min(d.r*k,92)); });
    arr.forEach(d=>{ const rnd=mulberry32(hash(d.p.n)); d.x=W*(0.12+rnd()*0.76); d.y=H*(0.12+rnd()*0.76); });
    const sim=d3.forceSimulation(arr)
      .force("x",d3.forceX(W/2).strength(0.022))
      .force("y",d3.forceY(H/2).strength(0.03))
      .force("charge",d3.forceManyBody().strength(-6))
      .force("collide",d3.forceCollide(d=>d.r+8).strength(0.92).iterations(3))
      .stop();
    for(let i=0;i<300;i++) sim.tick();
    arr.forEach(d=>{
      if(!isFinite(d.x)) d.x=W/2; if(!isFinite(d.y)) d.y=H/2;
      d.x=Math.max(d.r+3,Math.min(W-d.r-3,d.x));
      d.y=Math.max(d.r+3,Math.min(H-d.r-3,d.y));
    });
    return arr;
  },[data,win,sizeBy]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="viz bub" preserveAspectRatio="xMidYMid meet">
      {nodes.map((nd,i)=>{
        const {p,r,x,y}=nd, d=p.d[win], col=moveFill(d,win), tc=moveText(d);
        const big=r>40, mid=r>22;
        const rnd=mulberry32(hash(p.n)+7);
        const dur=(7+rnd()*7).toFixed(2), dly=(-rnd()*8).toFixed(2);
        const ln=lastName(p.n), label=ln.length>12&&r<58?ln.slice(0,10)+"…":ln;
        return (
          <g key={p.n} transform={`translate(${x},${y})`} className="bubble"
             style={{animationDelay:`${Math.min(i*7,420)}ms`}}>
            <g className="float" style={{animationDuration:`${dur}s`,animationDelay:`${dly}s`}}
               onClick={()=>onPick(p)}
               onMouseMove={e=>onHover({p,x:e.clientX+12,y:e.clientY+12})}
               onMouseLeave={()=>onHover(null)}>
              <circle r={r} className="halo" fill={col} opacity={0.12}/>
              <circle r={r} fill={col} opacity={0.20}/>
              <circle r={r*0.6} fill={col} opacity={0.12}/>
              <circle r={r} fill="none" stroke={col} strokeWidth={Math.max(1.3,r*0.045)} opacity={0.95} className="ring"/>
              {mid&&<text textAnchor="middle" dy={big?-3:3} className="bubName"
                 style={{fontSize:Math.max(8.5,Math.min(r*0.4,28))}}>{label}</text>}
              {big&&<text textAnchor="middle" dy={r*0.42} className="bubPct"
                 style={{fontSize:Math.max(9,Math.min(r*0.28,18)),fill:tc}}>{fmtD(d)}</text>}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================
   HEATMAP (flat treemap, à la TradingView)
   ============================================================ */
function Heatmap({data,win,sizeBy,onPick,onHover}){
  const W=1000,H=560;
  const leaves=useMemo(()=>{
    const val=p=>{
      if(sizeBy==="uniform")return 1;
      if(sizeBy==="move")return 6+Math.abs(p.d[win])*4;
      return Math.pow(Math.max(2,150-p.adp),1.2);
    };
    const root=d3.hierarchy({children:data}).sum(d=>Math.max(0.001,val(d)||0)).sort((a,b)=>b.value-a.value);
    d3.treemap().size([W,H]).paddingInner(2).round(true)(root);
    return root.leaves().filter(l=>isFinite(l.x0)&&isFinite(l.x1)&&l.x1>l.x0&&l.y1>l.y0);
  },[data,win,sizeBy]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="viz" preserveAspectRatio="xMidYMid meet">
      {leaves.map((nd,i)=>{
        const p=nd.data, w=nd.x1-nd.x0, h=nd.y1-nd.y0, d=p.d[win];
        const area=Math.min(w,h);
        const showPct=area>34, showName=area>20;
        const fs=Math.max(8,Math.min(area*0.22,22));
        return (
          <g key={p.n} transform={`translate(${nd.x0},${nd.y0})`} className="tile"
             style={{animationDelay:`${Math.min(i*6,360)}ms`}}
             onClick={()=>onPick(p)}
             onMouseMove={e=>onHover({p,x:e.clientX+12,y:e.clientY+12})}
             onMouseLeave={()=>onHover(null)}>
            <rect width={w} height={h} fill={moveFill(d,win)} rx={2}/>
            <rect width={3} height={h} fill={TEAM[p.t]} opacity={0.9} rx={1.5}/>
            {showName&&(
              <text x={w/2} y={showPct?h/2-fs*0.35:h/2} textAnchor="middle" className="tileName"
                style={{fontSize:fs}}>
                {lastName(p.n).length*fs*0.55>w-6 ? lastName(p.n).slice(0,Math.max(2,Math.floor((w-6)/(fs*0.55))))+"…" : lastName(p.n)}
              </text>
            )}
            {showPct&&(
              <text x={w/2} y={h/2+fs*0.75} textAnchor="middle" className="tilePct" style={{fontSize:fs*0.82}}>
                {fmtD(d)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Legend({win}){
  const m=DOMAIN[win];
  const stops=[-m,-m*0.55,-m*0.18,0,m*0.18,m*0.55,m];
  return (
    <div className="legend">
      <span className="lgl">falling</span>
      {stops.map((s,i)=>(
        <div key={i} className="lgcell">
          <div className="lgsw" style={{background:moveFill(s,win)}}/>
          <span>{s>0?"+":""}{Math.round(s)}</span>
        </div>
      ))}
      <span className="lgl">rising</span>
    </div>
  );
}

/* ============================================================
   DRAWER (player detail — v2 stats stub + ADP sparkline)
   ============================================================ */
function Drawer({p,scoring,onClose}){
  const d=p.d, win30=d["30D"];
  // sparkline: trend is ADP (lower=better) -> invert for chart
  const W=300,H=80,pad=6;
  const min=Math.min(...p.trend),max=Math.max(...p.trend);
  const x=i=>pad+(i/(p.trend.length-1))*(W-pad*2);
  const y=v=>pad+((v-min)/((max-min)||1))*(H-pad*2); // higher ADP -> lower on screen
  const line=p.trend.map((v,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const lineCol=win30>0?"#11d676":win30<0?"#ff4d5e":"#9aa3b2";
  const url=scoring==="bb"?"https://www.fantasypros.com/nfl/adp/best-ball-overall.php":"https://www.fantasypros.com/nfl/adp/ppr-overall.php";

  return (
    <>
      <div className="scrim" onClick={onClose}/>
      <aside className="drawer">
        <button className="dx" onClick={onClose}><X size={18}/></button>
        <div className="dhead">
          <span className="dot lg" style={{background:TEAM[p.t]}}/>
          <div>
            <h3>{p.n}{p.rk&&<i className="rkTag big">ROOKIE</i>}</h3>
            <p><span className="posBadge" style={{color:POS[p.p].c,background:POS[p.p].bg}}>{p.p}{p.posRank}</span> {p.t} · Bye {p.by}</p>
          </div>
        </div>

        <div className="dstat">
          <div><label>PPR ADP</label><b>{p.ppr.toFixed(1)}</b></div>
          <div><label>Best Ball ADP</label><b>{p.bb!=null?p.bb.toFixed(1):"—"}</b></div>
          <div><label>Overall Rank</label><b>#{p.rank}</b></div>
        </div>

        <div className="dmove">
          <h4>Movement <span className="demo">simulated</span></h4>
          <div className="dmoveRow">
            {WINDOWS.map(w=>(
              <div key={w} className="dmoveCell">
                <label>{w}</label>
                <b style={{color:moveText(d[w])}}>{d[w]>0?"▲":d[w]<0?"▼":"–"} {Math.abs(d[w]).toFixed(1)}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="dspark">
          <h4>30-day ADP trend</h4>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%">
            <path d={line} fill="none" stroke={lineCol} strokeWidth="2" strokeLinejoin="round"/>
            <circle cx={x(p.trend.length-1)} cy={y(p.trend[p.trend.length-1])} r="3.5" fill={lineCol}/>
          </svg>
          <div className="sparkLabels"><span>{p.trend[0].toFixed(1)}</span><span>now {p.ppr.toFixed(1)}</span></div>
        </div>

        <div className="v2">
          <h4>Coming in v2</h4>
          <p>Click-through to multi-season receiving / rushing stats, injury history, and prior-season ADP comparison — pulled into this panel.</p>
        </div>

        <a className="fpLink" href={url} target="_blank" rel="noreferrer">View source ADP on FantasyPros <ExternalLink size={13}/></a>
      </aside>
    </>
  );
}

/* ============================================================ */
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@500;600;700;800&family=Saira:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
.gx{font-family:'Saira',system-ui,sans-serif;background:
  radial-gradient(1200px 600px at 80% -10%,rgba(17,214,118,.07),transparent 60%),
  radial-gradient(900px 500px at 0% 110%,rgba(59,155,255,.06),transparent 55%),#070a0e;
  color:#e6e9ef;min-height:100vh;padding-bottom:40px;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{font-family:'Saira Condensed',sans-serif;letter-spacing:.3px}
.adp,.cN,.bubPct,.tilePct,.dot{font-family:'JetBrains Mono',monospace}

/* ticker */
.ticker{overflow:hidden;border-bottom:1px solid #161b24;background:#090c11;height:30px;display:flex;align-items:center}
.tickInner{display:flex;gap:30px;white-space:nowrap;animation:scroll 55s linear infinite;padding-left:20px}
.tickInner:hover{animation-play-state:paused}
@keyframes scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.tk{display:inline-flex;gap:8px;align-items:center;font-size:12.5px;font-family:'JetBrains Mono',monospace}
.tkn{color:#8b94a3;font-family:'Saira',sans-serif;font-weight:600}
.tk span:last-child{display:inline-flex;align-items:center;gap:3px}

/* header */
.hd{display:flex;align-items:center;justify-content:space-between;padding:16px 22px;flex-wrap:wrap;gap:14px}
.brand{display:flex;align-items:center;gap:13px}
.logo{display:grid;grid-template-columns:1fr 1fr;gap:3px;width:30px;height:30px}
.logo span{border-radius:4px;background:#11d676}
.logo span:nth-child(1){background:#11d676}.logo span:nth-child(2){background:#1f2630}
.logo span:nth-child(3){background:#1f2630;grid-column:1/3;height:11px;background:#ff4d5e}
.brand h1{font-size:24px;font-weight:800;line-height:1}.brand h1 em{color:#11d676;font-style:normal}
.brand p{font-size:11.5px;color:#6b7484;letter-spacing:1.5px;text-transform:uppercase;margin-top:3px}
.searchBox{display:flex;align-items:center;gap:8px;background:#0e131a;border:1px solid #1b212c;border-radius:9px;padding:8px 12px;min-width:230px}
.searchBox input{background:none;border:none;outline:none;color:#e6e9ef;font-size:14px;width:100%;font-family:'Saira',sans-serif}
.searchBox svg{color:#6b7484}.searchBox .clr{cursor:pointer}

/* bars */
.bar{display:flex;align-items:center;gap:14px;padding:0 22px 12px;flex-wrap:wrap}
.bar2{padding-top:4px;position:relative;z-index:30}
.seg{display:inline-flex;background:#0e131a;border:1px solid #1b212c;border-radius:9px;padding:3px;gap:2px}
.seg button{background:none;border:none;color:#8b94a3;font-family:'Saira Condensed',sans-serif;font-weight:700;
  font-size:13px;letter-spacing:.5px;padding:7px 13px;border-radius:7px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-transform:uppercase}
.seg button.on{background:#1c2530;color:#fff}
.seg.score button.on{background:#11d676;color:#04140b}
.seg.score button.bbon{background:#3b9bff;color:#03101f}
.seg.tf button{padding:7px 12px;font-family:'JetBrains Mono',monospace;font-size:12px}
.tabs{display:flex;gap:4px;flex-wrap:wrap}
.tab{background:#0e131a;border:1px solid #1b212c;color:#8b94a3;font-family:'Saira Condensed',sans-serif;
  font-weight:700;font-size:13.5px;letter-spacing:.5px;padding:8px 15px;border-radius:20px;cursor:pointer;text-transform:uppercase}
.tab.on{background:#11d6761a;border-color:#11d676;color:#11d676}

/* dropdowns */
.dd{position:relative}
.ddbtn{display:inline-flex;align-items:center;gap:7px;background:#0e131a;border:1px solid #1b212c;color:#cfd5df;
  font-family:'Saira',sans-serif;font-weight:600;font-size:13px;padding:8px 13px;border-radius:9px;cursor:pointer}
.ddbtn svg{color:#6b7484}
.ddmenu{position:absolute;top:calc(100% + 6px);left:0;background:#10151d;border:1px solid #232c38;border-radius:11px;
  padding:8px;min-width:175px;z-index:50;box-shadow:0 18px 40px rgba(0,0,0,.5)}
.ddhead{display:block;font-size:10.5px;letter-spacing:1.5px;color:#6b7484;padding:4px 8px 7px;font-weight:700}
.ddmenu>button{display:block;width:100%;text-align:left;background:none;border:none;color:#cfd5df;font-family:'Saira',sans-serif;
  font-size:13.5px;padding:8px 9px;border-radius:7px;cursor:pointer}
.ddmenu>button:hover{background:#1a212c}.ddmenu>button.sel{background:#1c2530;color:#fff}
.teamMenu{min-width:300px}
.teamTop{display:flex;justify-content:space-between;align-items:center}
.lnk{background:none;border:none;color:#11d676;font-size:11.5px;cursor:pointer;padding:4px 8px;font-family:'Saira',sans-serif}
.teamGrid{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;padding:4px}
.tchip{background:#0e131a;border:1px solid #232c38;color:#9aa3b2;font-family:'JetBrains Mono',monospace;font-size:10.5px;
  padding:6px 0;border-radius:6px;cursor:pointer}
.tchip.on{color:#fff;font-weight:700}
.count{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:12px;color:#6b7484}

/* viz */
.vizWrap{margin:6px 16px 0;background:#0a0e13;border:1px solid #161c25;border-radius:14px;padding:10px;position:relative;overflow:hidden}
.viz{width:100%;display:block}
.bubble,.tile{cursor:pointer}
.bubble{animation:fadein .5s ease both}
.float{animation-name:bobble;animation-iteration-count:infinite;animation-timing-function:ease-in-out;cursor:pointer}
.tile{animation:fade .45s ease both}
.bubble:hover .halo{opacity:.32}
.bubble:hover .ring{stroke-width:3px}
.tile:hover rect:first-child{filter:brightness(1.18)}
@keyframes fadein{from{opacity:0}to{opacity:1}}
@keyframes bobble{0%{transform:translate(0,0)}25%{transform:translate(5px,-6px)}50%{transform:translate(-4px,5px)}75%{transform:translate(6px,4px)}100%{transform:translate(0,0)}}
@keyframes fade{from{opacity:0}to{opacity:1}}
.bubName{font-family:'Saira Condensed',sans-serif;font-weight:700;pointer-events:none}
.bubPct{font-weight:700;pointer-events:none}
.tileName{font-family:'Saira Condensed',sans-serif;font-weight:700;fill:#f3f6fa;pointer-events:none}
.tilePct{font-family:'JetBrains Mono',monospace;fill:#dfe5ee;pointer-events:none}
.empty{padding:90px 0;text-align:center;color:#6b7484;font-size:15px}

/* legend */
.legend{display:flex;align-items:center;gap:3px;justify-content:center;padding:10px 0 4px;flex-wrap:wrap}
.lgl{font-size:11px;color:#6b7484;text-transform:uppercase;letter-spacing:1px;margin:0 8px}
.lgcell{display:flex;flex-direction:column;align-items:center;gap:3px}
.lgsw{width:46px;height:11px;border-radius:2px}
.lgcell span{font-family:'JetBrains Mono',monospace;font-size:10px;color:#7a8492}

/* tooltip */
.tip{position:fixed;z-index:99;background:#0c1118;border:1px solid #2a3442;border-radius:9px;padding:8px 11px;
  pointer-events:none;display:flex;flex-direction:column;gap:2px;box-shadow:0 10px 30px rgba(0,0,0,.6)}
.tip b{font-family:'Saira',sans-serif;font-size:13px}
.tipsub{font-size:11px;color:#8b94a3;font-family:'JetBrains Mono',monospace}
.tip span:last-child{font-size:11.5px;font-family:'JetBrains Mono',monospace}

/* list */
.listHead{display:flex;justify-content:space-between;align-items:center;padding:22px 22px 10px}
.listHead h2{font-size:19px;font-weight:700}
.sortToggle{display:flex;align-items:center;gap:6px}
.sortToggle span{font-size:11px;color:#6b7484;text-transform:uppercase;letter-spacing:1px;margin-right:2px}
.sortToggle button{background:#0e131a;border:1px solid #1b212c;color:#8b94a3;font-family:'Saira Condensed',sans-serif;
  font-weight:700;font-size:12.5px;padding:6px 12px;border-radius:7px;cursor:pointer;letter-spacing:.4px}
.sortToggle button.on{background:#1c2530;color:#fff;border-color:#2a3442}

.tableScroll{margin:0 16px;max-height:560px;overflow:auto;border:1px solid #161c25;border-radius:12px;background:#0a0e13}
.tbl{width:100%;border-collapse:collapse;font-size:14px}
.tbl thead th{position:sticky;top:0;background:#0c1119;z-index:2;text-align:left;padding:12px 14px;
  font-family:'Saira Condensed',sans-serif;font-weight:700;color:#7a8492;font-size:11.5px;letter-spacing:1px;
  text-transform:uppercase;border-bottom:1px solid #1b212c}
.tbl thead .cN,.tbl thead .cR{cursor:pointer}
.cR{width:46px;text-align:center !important;color:#6b7484;font-family:'JetBrains Mono',monospace}
.cP{width:78px}.cN{width:92px;text-align:right !important}
.tbl tbody tr{border-bottom:1px solid #11161e;cursor:pointer;transition:background .12s}
.tbl tbody tr:hover{background:#0f151d}
.tbl td{padding:11px 14px;vertical-align:middle}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:9px;vertical-align:middle;
  border:1px solid rgba(255,255,255,.15)}
.dot.lg{width:14px;height:14px}
.pn{font-weight:600;color:#eef1f6}
.pmeta{color:#6b7484;font-size:11.5px;margin-left:9px;font-family:'JetBrains Mono',monospace}
.rkTag{font-style:normal;background:#11d6761f;color:#11d676;font-size:9px;font-weight:700;padding:1px 4px;border-radius:4px;margin-left:6px;font-family:'Saira Condensed',sans-serif;letter-spacing:.5px}
.rkTag.big{font-size:10px;padding:2px 7px;margin-left:9px}
.posBadge{font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;padding:3px 7px;border-radius:5px}
.adp{color:#eef1f6;font-weight:600}

/* footer */
.ft{display:flex;flex-direction:column;gap:5px;padding:18px 22px;color:#6b7484;font-size:12px;line-height:1.55;max-width:900px}
.ft b{color:#9aa3b2;font-weight:600}

/* drawer */
.scrim{position:fixed;inset:0;background:rgba(3,6,10,.65);z-index:80;animation:fade .2s}
.drawer{position:fixed;top:0;right:0;height:100%;width:380px;max-width:92vw;background:#0b0f15;border-left:1px solid #1c232e;
  z-index:90;padding:22px;overflow-y:auto;animation:slide .28s cubic-bezier(.2,.8,.2,1)}
@keyframes slide{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}
.dx{position:absolute;top:16px;right:16px;background:#141b24;border:1px solid #232c38;color:#9aa3b2;border-radius:8px;
  width:32px;height:32px;display:grid;place-items:center;cursor:pointer}
.dhead{display:flex;gap:13px;align-items:flex-start;margin:6px 40px 18px 0}
.dhead h3{font-size:22px;font-weight:800;display:flex;align-items:center}
.dhead p{margin-top:6px;color:#8b94a3;font-size:13px;display:flex;align-items:center;gap:8px}
.dstat{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px}
.dstat>div{background:#0e131a;border:1px solid #1b212c;border-radius:10px;padding:11px}
.dstat label{display:block;font-size:10px;color:#6b7484;text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px}
.dstat b{font-family:'JetBrains Mono',monospace;font-size:18px;color:#eef1f6}
.dmove h4,.dspark h4,.v2 h4{font-family:'Saira Condensed',sans-serif;font-size:13px;color:#9aa3b2;text-transform:uppercase;
  letter-spacing:1px;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.demo{background:#23262d;color:#7a8492;font-size:9px;padding:2px 6px;border-radius:4px;letter-spacing:.5px}
.dmoveRow{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:20px}
.dmoveCell{background:#0e131a;border:1px solid #1b212c;border-radius:9px;padding:9px 4px;text-align:center}
.dmoveCell label{display:block;font-family:'JetBrains Mono',monospace;font-size:10px;color:#6b7484;margin-bottom:5px}
.dmoveCell b{font-family:'JetBrains Mono',monospace;font-size:13.5px}
.dspark{background:#0e131a;border:1px solid #1b212c;border-radius:11px;padding:13px;margin-bottom:18px}
.sparkLabels{display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#6b7484;margin-top:4px}
.v2{background:linear-gradient(135deg,#0e1a13,#0e131a);border:1px solid #1d3326;border-radius:11px;padding:14px;margin-bottom:18px}
.v2 h4{color:#11d676}.v2 p{font-size:12.5px;color:#9aa3b2;line-height:1.55}
.fpLink{display:inline-flex;align-items:center;gap:7px;color:#3b9bff;text-decoration:none;font-size:13px;font-weight:600}
.fpLink:hover{text-decoration:underline}
`;
