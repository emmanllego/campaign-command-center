import "./styles.css";
import Chart from "chart.js/auto";
import { jsPDF } from "jspdf";
import * as runtime from "./runtime.js";
// The original Artifact loaded these from a CDN as globals; keep the same globals so the app code is unchanged.
window.Chart = Chart;
window.jspdf = { jsPDF };
/* ============ utilities ============ */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Math.random().toString(36).slice(2,10);
const iso=d=>{const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")};
const addDays=(s,n)=>{const d=new Date(s+"T12:00:00");d.setDate(d.getDate()+n);return iso(d)};
const TODAY=iso(new Date());
const fmtD=s=>s?new Date(s+"T12:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}):"—";
const num=(n,d=0)=>n==null||isNaN(n)?"—":Number(n).toLocaleString("en-PH",{maximumFractionDigits:d,minimumFractionDigits:d});
const php=n=>n==null||isNaN(n)?"—":"₱"+Number(n).toLocaleString("en-PH",{maximumFractionDigits:0});
const pct=n=>n==null||isNaN(n)?"—":(n*100).toFixed(1)+"%";
const xr=n=>n==null||isNaN(n)?"—":n.toFixed(2)+"×";
const toast=m=>{const t=document.createElement("div");t.className="toast";t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2600)};
const STATUSES=["Draft","Pending Approval","Scheduled","Active","Paused","Completed"];
const pillc=s=>s==="Pending Approval"?"Pending":s;
const PLATFORMS=["Meta Ads","Google Ads","TikTok Ads","Email","SMS","Organic Social"];
const CTYPES=["Video","Image","Carousel","Story","Text"];
const CPLAT=["Facebook","Instagram","TikTok","LinkedIn","YouTube","X"];

/* ============ state + persistence ============ */
const KEYS=["campaigns","content","tasks","team","comments","activity","notifs","metrics","integrations","settings","recs"];
let S={}, db=null, mode="local";
const saveT={}, savedStr={};
function persist(...keys){
  (keys.length?keys:KEYS).forEach(k=>{
    clearTimeout(saveT[k]);
    saveT[k]=setTimeout(()=>writeKey(k),500);
  });
}
async function writeKey(k){
  const json=JSON.stringify(S[k]);
  if(json===savedStr[k])return;
  try{
    if(db){await db.doc("ws/"+k).set({json}); mode="db"}
    else localStorage.setItem("ccc_"+k,json);
    savedStr[k]=json; setPersist();
  }catch(e){
    try{localStorage.setItem("ccc_"+k,json)}catch(_){}
    mode="err"; setPersist(); if(e&&e.code==="quota_exceeded")toast("Storage full — delete some data.");
  }
}
function setPersist(){$("#persist").textContent=mode==="db"?"● Saved to workspace database":mode==="err"?"● Save issue – check connection":"● Saved in this browser only"}
async function loadAll(){
  try{db=await Promise.race([runtime.openDb(),new Promise(r=>setTimeout(()=>r(null),6000))])}catch(e){db=null}
  let found=false;
  for(const k of KEYS){
    let json=null;
    try{
      if(db){const s=await db.doc("ws/"+k).get(); if(s.exists)json=s.data().json}
      else json=localStorage.getItem("ccc_"+k);
    }catch(e){}
    if(json!=null){try{S[k]=JSON.parse(json);savedStr[k]=json;found=true}catch(_){}}
  }
  if(db)mode="db";
  if(!found){seed();persist()}
  KEYS.forEach(k=>{if(S[k]==null)S[k]=(k==="settings"||k==="integrations")?{}:[]});
  S.settings={theme:"light",targetRoas:3,targetCpl:150,currency:"PHP",demo:false,me:null,...S.settings};
  if(!S.integrations||Array.isArray(S.integrations))S.integrations={};
}

/* ============ seed (clearly labelled demo data) ============ */
function seed(){
  const team=[
    {id:"u1",name:"Alex Rivera",email:"alex@demo.example",role:"Admin"},
    {id:"u2",name:"Mika Santos",email:"mika@demo.example",role:"Manager"},
    {id:"u3",name:"Jon Reyes",email:"jon@demo.example",role:"Editor"},
    {id:"u4",name:"Bea Cruz",email:"bea@demo.example",role:"Viewer"}];
  const C=(id,name,brand,obj,plats,budget,off1,off2,status,owner)=>({id,name,brand,objective:obj,platforms:plats,budget,start:addDays(TODAY,off1),end:addDays(TODAY,off2),status,owner,assets:[],history:[{ts:Date.now(),user:"Demo",text:"Created (demo data)"}],ai:null,audience:"",notes:""});
  const campaigns=[
    C("c1","Q4 Glow Facial Promo","Demo Aesthetics Clinic","Lead generation",["Meta Ads"],60000,-44,16,"Active","u2"),
    C("c2","Brake & PMS Season","Demo Auto Care","Lead generation",["Meta Ads","Google Ads"],45000,-44,10,"Active","u3"),
    C("c3","Review Center Early Bird","Demo Review Center","Conversions",["TikTok Ads","Meta Ads"],38000,-44,-1,"Completed","u2"),
    C("c4","Holiday Retargeting","Demo Aesthetics Clinic","Conversions",["Meta Ads","Email"],25000,-30,25,"Paused","u3"),
    C("c5","New Year Launch","Demo Auto Care","Awareness",["TikTok Ads"],30000,12,42,"Draft","u3")];
  // deterministic demo metrics
  let seedv=7;const rnd=()=>{seedv=(seedv*9301+49297)%233280;return seedv/233280};
  const prof={c1:{cpm:95,ctr:.019,lr:.07,cr:.22,aov:3200,sp:1300},c2:{cpm:80,ctr:.014,lr:.05,cr:.16,aov:2600,sp:950},c3:{cpm:110,ctr:.011,lr:.04,cr:.1,aov:5000,sp:850},c4:{cpm:70,ctr:.007,lr:.03,cr:.08,aov:1800,sp:700}};
  const metrics=[];
  Object.keys(prof).forEach(cid=>{const p=prof[cid];const c=campaigns.find(x=>x.id===cid);
    for(let i=-44;i<=0;i++){const d=addDays(TODAY,i);if(d<c.start||d>c.end)continue;
      if(cid==="c4"&&i<-30+0)continue;
      const j=.8+rnd()*.4, fade=cid==="c4"?(1-(i+30)/-40*0):1;
      const spend=Math.round(p.sp*j*(cid==="c2"&&i>-8?1.25:1));
      const imp=Math.round(spend/p.cpm*1000), reach=Math.round(imp*.72), clicks=Math.round(imp*p.ctr*(cid==="c1"&&i>-10?.8:1)*(.85+rnd()*.3));
      const leads=Math.round(clicks*p.lr*(.8+rnd()*.4)), conv=Math.round(leads*p.cr*(.8+rnd()*.4));
      metrics.push({id:uid(),c:cid,d,spend,imp,reach,clicks,eng:Math.round(imp*.03*(.8+rnd()*.4)),leads,conv,rev:Math.round(conv*p.aov*(.9+rnd()*.2))});}});
  const content=[];
  const T=(t,type,pl,off,cat,asg,ap,pub)=>content.push({id:uid(),title:t,type,platform:pl,date:addDays(TODAY,off),time:"10:00",category:cat,assignee:asg,approval:ap,publish:pub,body:"Demo draft copy — replace with your own.",campaignId:"c1"});
  T("Before/after carousel","Carousel","Instagram",1,"Social proof","u3","Approved","Scheduled");
  T("Promo reel: 3 facial tips","Video","TikTok",3,"Educational","u3","Pending","Draft");
  T("Story poll: skin goals","Story","Instagram",4,"Engagement","u3","Approved","Scheduled");
  T("Holiday offer announcement","Image","Facebook",6,"Promotion","u2","Pending","Draft");
  T("Behind the clinic","Video","Facebook",-2,"Brand","u3","Approved","Published");
  const tasks=[
    {id:uid(),campaignId:"c1",title:"Approve final ad creatives",assignee:"u2",due:addDays(TODAY,2),status:"doing"},
    {id:uid(),campaignId:"c2",title:"Update landing page offer",assignee:"u3",due:addDays(TODAY,4),status:"todo"},
    {id:uid(),campaignId:"c5",title:"Draft New Year campaign brief",assignee:"u3",due:addDays(TODAY,7),status:"todo"},
    {id:uid(),campaignId:"c3",title:"Compile results report",assignee:"u2",due:addDays(TODAY,-1),status:"done"}];
  S={campaigns,content,tasks,team,comments:[],activity:[{id:uid(),ts:Date.now(),user:"System",text:"Demo workspace loaded"}],notifs:[{id:uid(),ts:Date.now(),text:"Welcome! This workspace starts with demo data.",read:false}],metrics,integrations:{},settings:{demo:true,theme:"light",targetRoas:3,targetCpl:150,me:"u1"},recs:[]};
}

/* ============ roles ============ */
const me=()=>S.team.find(u=>u.id===S.settings.me)||S.team[0]||{id:"u0",name:"You",role:"Admin"};
const PERM={Admin:["edit","create","delete","approve","team","settings","integrations","budget"],Manager:["edit","create","approve","budget","delete"],Editor:["edit","create"],Viewer:[]};
const can=a=>(PERM[me().role]||[]).includes(a);
const uname=id=>(S.team.find(u=>u.id===id)||{name:"Unassigned"}).name;
function log(text){S.activity.unshift({id:uid(),ts:Date.now(),user:me().name,text});S.activity=S.activity.slice(0,200);persist("activity")}
function notify(text){S.notifs.unshift({id:uid(),ts:Date.now(),text,read:false});S.notifs=S.notifs.slice(0,60);persist("notifs");bellUpdate()}
function hist(c,text){c.history.unshift({ts:Date.now(),user:me().name,text})}
function guard(a){if(!can(a)){toast("Your role ("+me().role+") can't do that.");return false}return true}

/* ============ metrics math ============ */
function agg(rows){
  const t={spend:0,imp:0,reach:0,clicks:0,eng:0,leads:0,conv:0,rev:0};
  rows.forEach(r=>{for(const k in t)t[k]+=+r[k]||0});
  t.ctr=t.imp?t.clicks/t.imp:null;t.cr=t.leads?t.conv/t.leads:null;
  t.cpl=t.leads?t.spend/t.leads:null;t.cpa=t.conv?t.spend/t.conv:null;t.roas=t.spend?t.rev/t.spend:null;t.n=rows.length;
  return t;
}
const rowsFor=(cids,from,to)=>S.metrics.filter(m=>(!cids||cids.includes(m.c))&&(!from||m.d>=from)&&(!to||m.d<=to));
const cspend=id=>agg(rowsFor([id])).spend;
const byDay=rows=>{const m={};rows.forEach(r=>{(m[r.d]=m[r.d]||[]).push(r)});return Object.keys(m).sort().map(d=>({d,...agg(m[d])}))};

/* ============ AI ============ */
// Claude runs server-side through /api/ai (see api/ai.js); the API key never reaches the browser.
async function aiJSON(prompt){return await runtime.ai(prompt,"json")}
async function aiText(prompt){return await runtime.ai(prompt,"text")}
const errmsg=e=>e&&e.message?e.message:"Something went wrong. Please try again.";

/* ============ UI helpers ============ */
function modal(title,body,{onSubmit,submit="Save",wide}={}){
  closeModal();
  const bg=document.createElement("div");bg.className="modalbg";bg.id="mbg";
  bg.innerHTML=`<div class="modal" role="dialog" aria-label="${esc(title)}" ${wide?'style="max-width:980px"':""}><div class="row sp" style="margin-bottom:12px"><h2>${esc(title)}</h2><button class="btn o sm" data-close>✕</button></div><form id="mform">${body}<div class="row" style="margin-top:16px;justify-content:flex-end"><button type="button" class="btn o" data-close>Cancel</button>${onSubmit?`<button class="btn y" type="submit">${esc(submit)}</button>`:""}</div></form></div>`;
  document.body.appendChild(bg);
  bg.addEventListener("click",e=>{if(e.target===bg||e.target.closest("[data-close]"))closeModal()});
  $("#mform").addEventListener("submit",async e=>{e.preventDefault();if(onSubmit){const fd=Object.fromEntries(new FormData(e.target));fd._multi=k=>new FormData(e.target).getAll(k);const r=await onSubmit(fd);if(r!==false)closeModal()}});
  return bg;
}
const closeModal=()=>{const m=$("#mbg");if(m)m.remove()};
const opts=(arr,sel)=>arr.map(a=>{const v=Array.isArray(a)?a[0]:a,l=Array.isArray(a)?a[1]:a;return `<option value="${esc(v)}" ${v==sel?"selected":""}>${esc(l)}</option>`}).join("");
const copts=sel=>opts(S.campaigns.map(c=>[c.id,c.name]),sel);
const uopts=sel=>opts(S.team.map(u=>[u.id,u.name]),sel);
let charts=[];
function chart(id,cfg){const el=document.getElementById(id);if(!el||!window.Chart)return;const dark=document.documentElement.dataset.theme==="dark";
  Chart.defaults.color=dark?"#A9B9E3":"#5C6C95";Chart.defaults.font.family="Poppins";
  cfg.options={responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{position:"bottom",labels:{boxWidth:10,usePointStyle:true}}},...cfg.options};
  charts.push(new Chart(el,cfg))}
const killCharts=()=>{charts.forEach(c=>c.destroy());charts=[]};
const PAL=["#004AAD","#FFB400","#1B7CFF","#002686","#12805C","#C23B3B"];
function kpi(l,v,s=""){return `<div class="card kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`}
function noData(){return `<div class="empty">No performance data yet. Add metrics in <a href="#analytics">Analytics</a> (manual entry or CSV import) or connect an integration.</div>`}

/* ============ recommendations (rule-based, data-grounded) ============ */
function rulesRecs(){
  const out=[];const tr=S.settings.targetRoas||3, tc=S.settings.targetCpl||150;
  S.campaigns.filter(c=>["Active","Paused"].includes(c.status)).forEach(c=>{
    const rows=rowsFor([c.id]);const t=agg(rows);
    if(rows.length<7){out.push({id:"r-"+c.id+"-nd",cid:c.id,tone:"",title:`${c.name}: not enough data`,detail:`Only ${rows.length} day(s) of metrics recorded. At least 7 days are needed before changes are suggested.`});return}
    if(c.status==="Active"){
      if(t.roas!=null&&t.roas<1)out.push({id:"r-"+c.id+"-pause",cid:c.id,tone:"lo",title:`Pause or rework ${c.name}`,detail:`ROAS is ${xr(t.roas)} on ${php(t.spend)} spend (${php(t.rev)} revenue) — below break-even. Review creative and audience before spending more.`,action:{type:"status",value:"Paused"}});
      else if(t.roas>=tr&&t.conv>=5)out.push({id:"r-"+c.id+"-scale",cid:c.id,tone:"hi",title:`Scale ${c.name} by 20%`,detail:`ROAS ${xr(t.roas)} (target ${xr(tr)}) with ${t.conv} conversions. Raising the budget from ${php(c.budget)} to ${php(Math.round(c.budget*1.2))} is a measured step.`,action:{type:"budget",value:Math.round(c.budget*1.2)}});
      if(t.cpl!=null&&t.cpl>tc)out.push({id:"r-"+c.id+"-cpl",cid:c.id,tone:"",title:`${c.name}: CPL above target`,detail:`CPL is ${php(t.cpl)} vs your target of ${php(tc)}. Test new hooks or tighten the audience.`});
      const last=agg(rowsFor([c.id],addDays(TODAY,-6),TODAY)),prev=agg(rowsFor([c.id],addDays(TODAY,-13),addDays(TODAY,-7)));
      if(last.cpl&&prev.cpl&&last.cpl>prev.cpl*1.25&&last.leads>=5)out.push({id:"r-"+c.id+"-trend",cid:c.id,tone:"lo",title:`${c.name}: CPL rising`,detail:`CPL rose from ${php(prev.cpl)} (prior 7 days) to ${php(last.cpl)} (last 7 days). Possible creative fatigue — refresh the ads.`});
      if(t.ctr!=null&&t.imp>5000&&t.ctr<.01)out.push({id:"r-"+c.id+"-ctr",cid:c.id,tone:"",title:`${c.name}: low click-through`,detail:`CTR is ${pct(t.ctr)} over ${num(t.imp)} impressions. Try new angles or thumbnails.`});
      if(t.cr!=null&&t.leads>50&&t.cr<.05)out.push({id:"r-"+c.id+"-cr",cid:c.id,tone:"",title:`${c.name}: leads aren't converting`,detail:`Only ${pct(t.cr)} of ${t.leads} leads converted. Review follow-up speed and offer.`});
    }
  });
  if(!out.length)out.push({id:"r-none",tone:"",title:"No rule-based flags right now",detail:"Add more performance data or run the AI analysis for deeper suggestions."});
  return out;
}
function applyAction(c,a){
  if(a.type==="budget"){hist(c,`Budget ${php(c.budget)} → ${php(a.value)} (approved recommendation)`);c.budget=a.value}
  if(a.type==="status"){hist(c,`Status ${c.status} → ${a.value} (approved recommendation)`);c.status=a.value}
  persist("campaigns");log(`Approved change on ${c.name}`);
}
function recHtml(r,allowApply){
  const c=r.cid&&S.campaigns.find(x=>x.id===r.cid);
  return `<div class="rec ${r.tone||""}"><b>${esc(r.title)}</b><div class="mut">${esc(r.detail)}</div>${r.action&&c&&allowApply?`<div class="row" style="margin-top:6px"><button class="btn sm y" data-act="applyrec" data-id="${esc(r.id)}">Approve change</button><span class="mut" style="font-size:12px">Nothing changes until you approve.</span></div>`:""}</div>`}
let recCache={};
/* ============ views ============ */
const VIEWS={};
const ICON={dashboard:'<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',campaigns:'<path d="M3 11l18-8v18L3 13zM7 13v6h3v-4"/>',builder:'<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',studio:'<path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3"/>',analytics:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',reports:'<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"/>',team:'<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6M17 5a3.5 3.5 0 010 7M22 20c0-3-2-5-4-5.5"/>',integrations:'<path d="M9 3v6M15 3v6M6 9h12v4a6 6 0 01-12 0zM12 19v3"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'};
const PAGES=[["dashboard","Dashboard"],["campaigns","Campaigns"],["builder","AI Campaign Builder"],["calendar","Content Calendar"],["studio","AI Content Studio"],["analytics","Analytics"],["reports","Reports"],["team","Team Management"],["integrations","Integrations"],["settings","Settings"]];
function nav(){const cur=route();$("#nav").innerHTML=PAGES.map(([k,l])=>`<a href="#${k}" class="${cur===k?"on":""}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>${l}</a>`).join("");$("#side").classList.remove("open")}
const route=()=>{const h=location.hash.slice(1);return PAGES.some(p=>p[0]===h)?h:"dashboard"};
function render(){killCharts();nav();const v=route();const el=$("#view");el.innerHTML=VIEWS[v]();(VIEWS[v+"_after"]||(()=>{}))();demoBar();bellUpdate();$("#who").innerHTML=opts(S.team.map(u=>[u.id,`${u.name} · ${u.role}`]),S.settings.me)}
function demoBar(){$("#demobar").innerHTML=S.settings.demo?`<div class="demo">DEMO DATA — campaigns, metrics and team shown are sample data, not real results. <button data-act="cleardemo">Clear demo data &amp; start fresh</button></div>`:""}
function bellUpdate(){const n=S.notifs.filter(x=>!x.read).length;$("#bellc").textContent=n||""}

/* ---- Dashboard ---- */
let dash={cid:"all",range:30};
VIEWS.dashboard=()=>{
  const cids=dash.cid==="all"?null:[dash.cid];const from=dash.range?addDays(TODAY,-dash.range+1):null;
  const rows=rowsFor(cids,from,TODAY),t=agg(rows);
  const cs=S.campaigns;const active=cs.filter(c=>c.status==="Active").length,done=cs.filter(c=>c.status==="Completed").length;
  const totBudget=cs.reduce((a,c)=>a+(+c.budget||0),0);
  const deadlines=[...cs.filter(c=>c.end>=TODAY&&["Active","Scheduled","Paused"].includes(c.status)).map(c=>({d:c.end,t:`${c.name} ends`})),...S.tasks.filter(x=>x.status!=="done").map(x=>({d:x.due,t:x.title}))].filter(x=>x.d).sort((a,b)=>a.d.localeCompare(b.d)).slice(0,6);
  recCache={};const recs=rulesRecs().slice(0,4);recs.forEach(r=>recCache[r.id]=r);
  return `<div class="pagehead"><div><div class="eyebrow">Overview</div><h1>Dashboard</h1><p>Performance across your campaigns.</p></div>
  <div class="row"><select id="dcid" style="width:auto"><option value="all">All campaigns</option>${copts(dash.cid)}</select><select id="drange" style="width:auto">${opts([[7,"Last 7 days"],[30,"Last 30 days"],[90,"Last 90 days"],[0,"All time"]],dash.range)}</select></div></div>
  <div class="grid g4">${kpi("Total campaigns",cs.length,`${active} active · ${done} completed`)}${kpi("Budget allocated",php(totBudget),`Spend in range ${php(t.spend)}`)}${kpi("Leads",num(t.leads),`${num(t.conv)} conversions`)}${kpi("CPL",php(t.cpl),"Cost per lead")}${kpi("CPA",php(t.cpa),"Cost per acquisition")}${kpi("ROAS",xr(t.roas),`Revenue ${php(t.rev)}`)}</div>
  <div class="grid g2" style="margin-top:14px">
   <div class="card"><h3>Spend vs revenue</h3>${rows.length?`<div class="chart"><canvas id="ch1"></canvas></div>`:noData()}</div>
   <div class="card"><h3>ROAS by campaign</h3>${rows.length?`<div class="chart"><canvas id="ch2"></canvas></div>`:noData()}</div></div>
  <div class="grid g2" style="margin-top:14px">
   <div class="card"><h3>Upcoming deadlines</h3>${deadlines.length?deadlines.map(x=>`<div class="row sp" style="padding:7px 0;border-bottom:1px solid var(--line)"><span>${esc(x.t)}</span><span class="${x.d<TODAY?"neg":"mut"}">${fmtD(x.d)}</span></div>`).join(""):`<div class="empty">Nothing due.</div>`}</div>
   <div class="card"><div class="row sp"><h3>Recommendations</h3><a href="#analytics" style="font-size:12px">Run AI analysis →</a></div><p class="mut" style="margin:4px 0 10px;font-size:12px">Rule-based, calculated from recorded data only.</p>${recs.map(r=>recHtml(r,can("approve"))).join("")}</div></div>`;
};
VIEWS.dashboard_after=()=>{
  $("#dcid").onchange=e=>{dash.cid=e.target.value;render()};$("#drange").onchange=e=>{dash.range=+e.target.value;render()};
  const cids=dash.cid==="all"?null:[dash.cid];const from=dash.range?addDays(TODAY,-dash.range+1):null;const rows=rowsFor(cids,from,TODAY);if(!rows.length)return;
  const d=byDay(rows);
  chart("ch1",{type:"line",data:{labels:d.map(x=>x.d.slice(5)),datasets:[{label:"Spend",data:d.map(x=>x.spend),borderColor:"#004AAD",backgroundColor:"#004AAD22",fill:true,tension:.3,pointRadius:0},{label:"Revenue",data:d.map(x=>x.rev),borderColor:"#FFB400",tension:.3,pointRadius:0}]}});
  const cs=S.campaigns.filter(c=>rows.some(r=>r.c===c.id));
  chart("ch2",{type:"bar",data:{labels:cs.map(c=>c.name),datasets:[{label:"ROAS",data:cs.map(c=>agg(rows.filter(r=>r.c===c.id)).roas||0),backgroundColor:"#004AAD",borderRadius:6}]},options:{plugins:{legend:{display:false}}}});
};

/* ---- Campaigns ---- */
let cf={q:"",st:"all"};
VIEWS.campaigns=()=>{
  const q=(cf.q||"").toLowerCase();
  const list=S.campaigns.filter(c=>(cf.st==="all"||c.status===cf.st)&&(!q||(c.name+c.brand+c.objective).toLowerCase().includes(q)));
  return `<div class="pagehead"><div><div class="eyebrow">Manage</div><h1>Campaigns</h1><p>Create, track and approve campaigns.</p></div><button class="btn y" data-act="newcampaign" ${can("create")?"":"disabled"}>+ New campaign</button></div>
  <div class="row" style="margin-bottom:12px"><input id="cq" placeholder="Search campaigns…" value="${esc(cf.q)}" style="max-width:280px"><select id="cst" style="width:auto"><option value="all">All statuses</option>${opts(STATUSES,cf.st)}</select></div>
  <div class="card tw">${list.length?`<table><thead><tr><th>Campaign</th><th>Status</th><th>Platforms</th><th>Budget</th><th>Spend</th><th>Dates</th><th>Owner</th><th></th></tr></thead><tbody>${list.map(c=>`<tr><td><b>${esc(c.name)}</b><div class="mut" style="font-size:12px">${esc(c.brand)} · ${esc(c.objective)}</div></td><td><span class="pill ${pillc(c.status)}">${c.status}</span></td><td>${c.platforms.map(p=>`<span class="tag">${esc(p)}</span>`).join("")}</td><td>${php(c.budget)}</td><td>${php(cspend(c.id))}</td><td class="mut">${fmtD(c.start)} → ${fmtD(c.end)}</td><td>${esc(uname(c.owner))}</td><td><button class="btn sm o" data-act="opencampaign" data-id="${c.id}">Open</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No campaigns match. ${can("create")?"Create your first one above.":""}</div>`}</div>`;
};
VIEWS.campaigns_after=()=>{$("#cq").oninput=e=>{cf.q=e.target.value;const p=e.target.selectionStart;render();const i=$("#cq");i.focus();i.setSelectionRange(p,p)};$("#cst").onchange=e=>{cf.st=e.target.value;render()}};
function campaignForm(c={}){
  return `<div class="form"><label class="full">Campaign name<input name="name" required value="${esc(c.name)}"></label><label>Brand / business<input name="brand" required value="${esc(c.brand)}"></label><label>Objective<select name="objective">${opts(["Awareness","Lead generation","Conversions","Traffic","Engagement","Sales"],c.objective)}</select></label>
  <label>Budget (₱)<input type="number" min="0" name="budget" required value="${c.budget??""}" ${c.id&&!can("budget")?"readonly":""}></label><label>Owner<select name="owner">${uopts(c.owner)}</select></label>
  <label>Start date<input type="date" name="start" required value="${c.start||TODAY}"></label><label>End date<input type="date" name="end" required value="${c.end||addDays(TODAY,30)}"></label>
  <label class="full">Platforms<span class="row" style="font-weight:400;color:var(--text)">${PLATFORMS.map(p=>`<label style="display:flex;grid-template:none;gap:4px;align-items:center;font-weight:400"><input type="checkbox" style="width:auto" name="platforms" value="${p}" ${(c.platforms||[]).includes(p)?"checked":""}>${p}</label>`).join("")}</span></label>
  <label class="full">Notes<textarea name="notes">${esc(c.notes)}</textarea></label></div>`}
function saveCampaignForm(c,fd){
  if(fd.end<fd.start){toast("End date must be after start date.");return false}
  const pl=fd._multi("platforms");
  Object.assign(c,{name:fd.name.trim(),brand:fd.brand.trim(),objective:fd.objective,budget:Math.max(0,+fd.budget||0),owner:fd.owner,start:fd.start,end:fd.end,platforms:pl,notes:fd.notes});
}
function openCampaign(id){
  const c=S.campaigns.find(x=>x.id===id);if(!c)return;
  const m=me();const rows=rowsFor([id]),t=agg(rows);
  const tasks=S.tasks.filter(x=>x.campaignId===id),cm=S.comments.filter(x=>x.campaignId===id);
  const nextBtns=[];
  if(c.status==="Draft"&&can("edit"))nextBtns.push(`<button type="button" class="btn y sm" data-st="Pending Approval">Request approval</button>`);
  if(c.status==="Pending Approval"&&can("approve"))nextBtns.push(`<button type="button" class="btn y sm" data-st="Scheduled">Approve → Scheduled</button><button type="button" class="btn y sm" data-st="Active">Approve → Active</button><button type="button" class="btn d sm" data-st="Draft">Reject</button>`);
  if(c.status==="Scheduled"&&can("approve"))nextBtns.push(`<button type="button" class="btn sm" data-st="Active">Launch</button>`);
  if(c.status==="Active"&&can("edit"))nextBtns.push(`<button type="button" class="btn o sm" data-st="Paused">Pause</button><button type="button" class="btn o sm" data-st="Completed">Mark completed</button>`);
  if(c.status==="Paused"&&can("edit"))nextBtns.push(`<button type="button" class="btn sm" data-st="Active">Resume</button>`);
  const b=modal(c.name,`<div class="row sp"><span class="pill ${pillc(c.status)}">${c.status}</span><div class="row">${nextBtns.join("")}</div></div>
   <div class="grid g4" style="margin:12px 0">${kpi("Budget",php(c.budget))}${kpi("Spend",php(t.spend))}${kpi("Leads",num(t.leads),`CPL ${php(t.cpl)}`)}${kpi("ROAS",xr(t.roas))}</div>
   <div class="tabs" id="ctabs">${["Details","Tasks","Assets","AI Plan","Comments","History"].map((x,i)=>`<button type="button" class="${i?"":"on"}" data-t="${x}">${x}</button>`).join("")}</div><div id="cbody" style="margin-top:12px"></div>`,{wide:true});
  const tabs={
    Details:()=>`<div id="dform">${campaignForm(c)}</div><div class="row" style="margin-top:12px;justify-content:space-between"><button type="button" class="btn y" id="csave" ${can("edit")?"":"disabled"}>Save changes</button><button type="button" class="btn d" id="cdel" ${can("delete")?"":"disabled"}>Delete campaign</button></div>`,
    Tasks:()=>`<div>${tasks.map(x=>`<div class="task row sp"><div>${esc(x.title)}<div class="mut" style="font-size:12px">${esc(uname(x.assignee))} · due ${fmtD(x.due)} · ${x.status}</div></div></div>`).join("")||'<div class="empty">No tasks yet.</div>'}</div><button type="button" class="btn sm o" id="addtask" style="margin-top:10px" ${can("create")?"":"disabled"}>+ Add task</button>`,
    Assets:()=>`<div>${c.assets.map((a,i)=>`<div class="task row sp"><div><b>${esc(a.name)}</b> <span class="tag">${esc(a.kind)}</span><div class="mut" style="font-size:12px">${esc(a.note||"")} ${a.url?`· <a href="${esc(a.url)}" target="_blank" rel="noopener">link</a>`:""}</div></div><button type="button" class="btn sm d" data-delasset="${i}" ${can("edit")?"":"disabled"}>Remove</button></div>`).join("")||'<div class="empty">No creative assets recorded. Add file names or links (e.g. Drive, Canva).</div>'}</div><div class="form" style="margin-top:10px"><label>Asset name<input id="an"></label><label>Type<select id="ak">${opts(["Image","Video","Copy","Landing page","Other"])}</select></label><label class="full">Link (optional)<input id="au" placeholder="https://"></label><button type="button" class="btn sm" id="aadd" ${can("edit")?"":"disabled"}>Add asset</button></div>`,
    "AI Plan":()=>c.ai?Object.entries(c.ai).map(([k,v])=>`<div class="aisec"><b>${esc(SEC[k]||k)}</b><textarea data-ai="${k}" ${can("edit")?"":"readonly"}>${esc(v)}</textarea></div>`).join("")+`<button type="button" class="btn y" id="aisave" ${can("edit")?"":"disabled"}>Save edits</button>`:`<div class="empty">No AI plan attached. Generate one in the <a href="#builder" data-close>AI Campaign Builder</a>.</div>`,
    Comments:()=>`<div>${cm.map(x=>`<div class="task"><b>${esc(x.author)}</b> <span class="mut" style="font-size:12px">${new Date(x.ts).toLocaleString()}</span><div>${esc(x.text)}</div></div>`).join("")||'<div class="empty">No comments yet.</div>'}</div><div class="row" style="margin-top:10px"><input id="cmt" placeholder="Write a comment…"><button type="button" class="btn sm" id="cmtbtn">Post</button></div>`,
    History:()=>c.history.map(h=>`<div style="padding:6px 0;border-bottom:1px solid var(--line)">${esc(h.text)} <span class="mut" style="font-size:12px">— ${esc(h.user)}, ${new Date(h.ts).toLocaleString()}</span></div>`).join("")};
  const show=t=>{$$("#ctabs button",b).forEach(x=>x.classList.toggle("on",x.dataset.t===t));$("#cbody",b).innerHTML=tabs[t]();wire(t)};
  const reopen=t=>{openCampaign(id);if(t)$$("#ctabs button").find(x=>x.dataset.t===t)?.click()};
  function wire(t){
    if(t==="Details"){
      if(!can("edit"))$$("#dform input,#dform select,#dform textarea",b).forEach(x=>x.disabled=true);
      $("#csave",b).onclick=()=>{const fd=Object.fromEntries($$("#dform [name]",b).filter(x=>x.type!=="checkbox").map(x=>[x.name,x.value]));fd._multi=()=>$$('#dform [name=platforms]:checked',b).map(x=>x.value);
        const old=c.budget;if(saveCampaignForm(c,fd)===false)return;if(old!==c.budget)hist(c,`Budget ${php(old)} → ${php(c.budget)}`);hist(c,"Details edited");persist("campaigns");log("Edited "+c.name);toast("Saved");render();reopen()};
      $("#cdel",b).onclick=()=>{if(!guard("delete"))return;modal("Delete campaign?",`<p>This permanently deletes <b>${esc(c.name)}</b>, its tasks, comments and metrics. This can't be undone.</p>`,{submit:"Delete permanently",onSubmit:()=>{S.campaigns=S.campaigns.filter(x=>x.id!==id);S.tasks=S.tasks.filter(x=>x.campaignId!==id);S.comments=S.comments.filter(x=>x.campaignId!==id);S.metrics=S.metrics.filter(x=>x.c!==id);persist();log("Deleted "+c.name);render();toast("Deleted")}})};
    }
    if(t==="Tasks")$("#addtask",b).onclick=()=>taskModal(null,id);
    if(t==="Assets"){$("#aadd",b).onclick=()=>{const n=$("#an",b).value.trim();if(!n)return toast("Name the asset.");c.assets.push({name:n,kind:$("#ak",b).value,url:$("#au",b).value.trim()});hist(c,"Asset added: "+n);persist("campaigns");reopen("Assets")};$$("[data-delasset]",b).forEach(x=>x.onclick=()=>{c.assets.splice(+x.dataset.delasset,1);persist("campaigns");reopen("Assets")})}
    if(t==="AI Plan"&&c.ai&&$("#aisave",b))$("#aisave",b).onclick=()=>{$$("[data-ai]",b).forEach(x=>c.ai[x.dataset.ai]=x.value);hist(c,"AI plan edited");persist("campaigns");toast("AI plan saved")};
    if(t==="Comments")$("#cmtbtn",b).onclick=()=>{const v=$("#cmt",b).value.trim();if(!v)return;S.comments.push({id:uid(),campaignId:id,author:m.name,text:v,ts:Date.now()});persist("comments");log(`Commented on ${c.name}`);reopen("Comments")};
  }
  $$("[data-st]",b).forEach(x=>x.onclick=()=>{const st=x.dataset.st;hist(c,`Status ${c.status} → ${st}`);log(`${c.name}: ${c.status} → ${st}`);if(st==="Pending Approval")notify(`${c.name} is waiting for approval`);c.status=st;persist("campaigns");render();reopen()});
  show("Details");$$("#ctabs button",b).forEach(x=>x.onclick=()=>show(x.dataset.t));
}
function taskModal(t,cid){
  t=t||{};modal(t.id?"Edit task":"New task",`<div class="form"><label class="full">Title<input name="title" required value="${esc(t.title)}"></label><label>Campaign<select name="campaignId"><option value="">— none —</option>${copts(t.campaignId||cid)}</select></label><label>Assignee<select name="assignee">${uopts(t.assignee)}</select></label><label>Due date<input type="date" name="due" value="${t.due||addDays(TODAY,7)}"></label><label>Status<select name="status">${opts([["todo","To do"],["doing","In progress"],["done","Done"]],t.status||"todo")}</select></label></div>`,{onSubmit:fd=>{
    if(!guard("create"))return false;
    const o={title:fd.title.trim(),campaignId:fd.campaignId,assignee:fd.assignee,due:fd.due,status:fd.status};
    if(t.id)Object.assign(t,o);else S.tasks.push({id:uid(),...o});
    if(o.assignee!==me().id)notify(`Task assigned to ${uname(o.assignee)}: ${o.title}`);
    persist("tasks");log("Task: "+o.title);render()}});
}

/* ---- AI Campaign Builder ---- */
const SEC={strategy:"Campaign strategy",personas:"Target audience personas",painPoints:"Customer pain-point analysis",funnel:"Marketing funnel",messaging:"Messaging angles",adCopy:"Advertising copy",creative:"Creative content concepts",videoScripts:"Video ad scripts",ctas:"Calls to action",budget:"Recommended budget allocation"};
let gen=null;
VIEWS.builder=()=>`<div class="pagehead"><div><div class="eyebrow">AI</div><h1>AI Campaign Builder</h1><p>Describe the campaign. Claude drafts the plan — every section stays editable.</p></div></div>
 <div class="card"><form id="bform" class="form">
 <label>Campaign name<input name="name" required placeholder="e.g. Summer Glow Promo"></label><label>Business / brand<input name="brand" required></label>
 <label>Product or service<input name="product" required></label><label>Objective<select name="objective">${opts(["Awareness","Lead generation","Conversions","Traffic","Engagement","Sales"],"Lead generation")}</select></label>
 <label>Target audience<input name="audience" required></label><label>Location<input name="location" placeholder="e.g. Metro Manila"></label>
 <label class="full">Customer pain points<textarea name="pain" style="min-height:60px"></textarea></label><label class="full">Unique selling proposition<textarea name="usp" style="min-height:60px"></textarea></label>
 <label class="full">Platforms<span class="row" style="font-weight:400;color:var(--text)">${PLATFORMS.map(p=>`<label style="display:flex;gap:4px;align-items:center;font-weight:400"><input type="checkbox" style="width:auto" name="platforms" value="${p}" ${p==="Meta Ads"?"checked":""}>${p}</label>`).join("")}</span></label>
 <label>Budget (₱)<input type="number" min="0" name="budget" required></label><label>Duration (days)<input type="number" min="1" name="days" value="30" required></label>
 <label class="full">KPIs<input name="kpis" placeholder="e.g. 100 leads, CPL under ₱150, ROAS 3×"></label>
 <div class="full row"><button class="btn y" id="bgo" ${can("create")?"":"disabled"}>✦ Generate campaign plan</button><span class="mut" id="bstat"></span></div></form></div>
 <div id="bout" style="margin-top:16px"></div>`;
VIEWS.builder_after=()=>{
  const out=$("#bout");
  const showGen=()=>{if(!gen)return;out.innerHTML=`<div class="card"><div class="row sp" style="margin-bottom:10px"><h2>Generated plan — edit freely</h2><div class="row"><button class="btn o sm" id="bregen">Regenerate</button><button class="btn y" id="bsave" ${can("create")?"":"disabled"}>Save as campaign</button></div></div>${Object.keys(SEC).map(k=>`<div class="aisec"><b>${SEC[k]}</b><textarea data-k="${k}">${esc(gen.plan[k]||"")}</textarea></div>`).join("")}</div>`;
    $("#bsave").onclick=()=>{$$("[data-k]").forEach(x=>gen.plan[x.dataset.k]=x.value);const f=gen.form;
      const c={id:uid(),name:f.name,brand:f.brand,objective:f.objective,platforms:f.platforms,budget:+f.budget||0,start:TODAY,end:addDays(TODAY,(+f.days||30)),status:"Draft",owner:me().id,assets:[],history:[{ts:Date.now(),user:me().name,text:"Created from AI Campaign Builder"}],ai:gen.plan,audience:f.audience,notes:`KPIs: ${f.kpis||"—"}`};
      S.campaigns.push(c);persist("campaigns");log("Created campaign "+c.name+" from AI plan");gen=null;toast("Saved as Draft campaign");location.hash="campaigns";render();};
    $("#bregen").onclick=()=>run(gen.form)};
  async function run(f){
    const btn=$("#bgo");btn.disabled=true;$("#bstat").innerHTML='<span class="spin"></span> Claude is writing your plan…';
    const prompt=`You are a senior performance marketer. Create a campaign plan for this brief. Be specific and practical for the stated market. Do not invent statistics or guaranteed results; where you estimate, label it an assumption.
BRIEF: ${JSON.stringify(f)}
Return JSON only, with exactly these string keys (plain text, use line breaks and "-" bullets inside strings): strategy, personas (3 personas), painPoints, funnel (awareness/consideration/conversion/retention), messaging (5 angles), adCopy (3 variants each with headline, primary text, description), creative (6 content concepts), videoScripts (2 scripts of about 30 seconds with hook, body, CTA), ctas (8 options), budget (split of the total budget across the given platforms and funnel stages, in PHP, summing to the total).`;
    try{const r=await aiJSON(prompt);gen={form:f,plan:Object.fromEntries(Object.keys(SEC).map(k=>[k,typeof r[k]==="string"?r[k]:JSON.stringify(r[k]??"",null,1)]))};showGen();$("#bstat").textContent=""}
    catch(e){$("#bstat").textContent="";out.innerHTML=`<div class="card neg">Couldn't generate: ${esc(errmsg(e))} <button class="btn sm o" id="retry">Try again</button></div>`;$("#retry").onclick=()=>run(f)}
    btn.disabled=!can("create")}
  $("#bform").onsubmit=e=>{e.preventDefault();if(!guard("create"))return;const fd=Object.fromEntries(new FormData(e.target));fd.platforms=new FormData(e.target).getAll("platforms");if(!fd.platforms.length){toast("Pick at least one platform.");return}run(fd)};
  showGen();
};

/* ---- Calendar ---- */
let cal={view:"month",date:TODAY,plat:"all"};
const cstat=x=>x.publish==="Published"?"Published":x.approval==="Pending"?"Pending":"";
VIEWS.calendar=()=>{
  const d=new Date(cal.date+"T12:00:00");let days=[],title="";
  if(cal.view==="month"){const f=new Date(d.getFullYear(),d.getMonth(),1,12),s=new Date(f);s.setDate(1-f.getDay());for(let i=0;i<42;i++){const x=new Date(s);x.setDate(s.getDate()+i);days.push(iso(x))}title=d.toLocaleDateString("en-PH",{month:"long",year:"numeric"})}
  else if(cal.view==="week"){const s=new Date(d);s.setDate(d.getDate()-d.getDay());for(let i=0;i<7;i++){const x=new Date(s);x.setDate(s.getDate()+i);days.push(iso(x))}title="Week of "+fmtD(days[0])}
  else{days=[cal.date];title=d.toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
  const items=S.content.filter(x=>cal.plat==="all"||x.platform===cal.plat);
  const cell=ds=>{const its=items.filter(x=>x.date===ds).sort((a,b)=>(a.time||"").localeCompare(b.time||""));return `<div class="d ${cal.view==="month"&&ds.slice(0,7)!==cal.date.slice(0,7)?"out":""} ${ds===TODAY?"today":""}" data-date="${ds}"><span class="n">${+ds.slice(8)}</span>${its.map(x=>`<div class="chip ${cstat(x)}" draggable="true" data-cid="${x.id}" title="${esc(x.title)}">${esc(x.time||"")} ${esc(x.title)}</div>`).join("")}${cal.view==="day"?`<button class="btn sm o" data-newdate="${ds}" ${can("create")?"":"disabled"}>+ Add post</button>`:""}</div>`};
  return `<div class="pagehead"><div><div class="eyebrow">Plan</div><h1>Content Calendar</h1><p>Drag posts to reschedule. Click a post to edit or preview.</p></div><button class="btn y" data-newdate="${TODAY}" ${can("create")?"":"disabled"}>+ New post</button></div>
  <div class="row sp" style="margin-bottom:12px"><div class="row"><button class="btn o sm" data-cal="-1">‹</button><button class="btn o sm" data-cal="0">Today</button><button class="btn o sm" data-cal="1">›</button><h3 style="margin-left:6px">${esc(title)}</h3></div><div class="row"><select id="cplat" style="width:auto"><option value="all">All platforms</option>${opts(CPLAT,cal.plat)}</select><div class="tabs">${["month","week","day"].map(v=>`<button class="${cal.view===v?"on":""}" data-cv="${v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join("")}</div></div></div>
  <div class="cal ${cal.view}" ${cal.view==="day"?'style="grid-template-columns:1fr"':""}>${cal.view==="day"?"":["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>`<div class="h">${x}</div>`).join("")}${days.map(cell).join("")}</div>`;
};
VIEWS.calendar_after=()=>{
  $$("[data-cv]").forEach(b=>b.onclick=()=>{cal.view=b.dataset.cv;render()});
  $$("[data-cal]").forEach(b=>b.onclick=()=>{const n=+b.dataset.cal;if(!n)cal.date=TODAY;else{const d=new Date(cal.date+"T12:00:00");if(cal.view==="month")d.setMonth(d.getMonth()+n);else d.setDate(d.getDate()+n*(cal.view==="week"?7:1));cal.date=iso(d)}render()});
  $("#cplat").onchange=e=>{cal.plat=e.target.value;render()};
  $$("[data-newdate]").forEach(b=>b.onclick=()=>contentModal(null,b.dataset.newdate));
  $$(".chip").forEach(c=>{c.onclick=()=>contentModal(S.content.find(x=>x.id===c.dataset.cid));c.ondragstart=e=>{if(!can("edit")){e.preventDefault();return}e.dataTransfer.setData("text/plain",c.dataset.cid)}});
  $$(".cal .d").forEach(d=>{d.ondragover=e=>{e.preventDefault();d.classList.add("over")};d.ondragleave=()=>d.classList.remove("over");d.ondrop=e=>{e.preventDefault();d.classList.remove("over");const it=S.content.find(x=>x.id===e.dataTransfer.getData("text/plain"));if(it&&it.date!==d.dataset.date){it.date=d.dataset.date;persist("content");log(`Rescheduled "${it.title}" to ${d.dataset.date}`);render();toast("Rescheduled")}}});
};
function contentModal(x,date){
  x=x||{};const isNew=!x.id;
  modal(isNew?"New post":"Edit post",`<div class="form"><label class="full">Title<input name="title" required value="${esc(x.title)}"></label>
  <label>Content type<select name="type">${opts(CTYPES,x.type)}</select></label><label>Platform<select name="platform">${opts(CPLAT,x.platform)}</select></label>
  <label>Date<input type="date" name="date" required value="${x.date||date||TODAY}"></label><label>Time<input type="time" name="time" value="${x.time||"10:00"}"></label>
  <label>Category<input name="category" value="${esc(x.category)}" placeholder="e.g. Educational, Promotion"></label><label>Assigned to<select name="assignee">${uopts(x.assignee)}</select></label>
  <label>Campaign<select name="campaignId"><option value="">— none —</option>${copts(x.campaignId)}</select></label>
  <label>Approval<select name="approval" ${can("approve")?"":"disabled"}>${opts(["Draft","Pending","Approved","Rejected"],x.approval||"Draft")}</select></label>
  <label>Publishing status<select name="publish">${opts(["Draft","Scheduled","Published"],x.publish||"Draft")}</select></label>
  <label class="full">Post copy<textarea name="body" id="cbodyf">${esc(x.body)}</textarea></label>
  <div class="full"><div class="eyebrow" style="margin-bottom:4px">Preview</div><div class="preview" id="cprev"></div></div></div>
  ${isNew?"":`<div class="row" style="margin-top:8px"><button type="button" class="btn d sm" id="cdelp" ${can("delete")?"":"disabled"}>Delete post</button></div>`}`,{onSubmit:fd=>{
    if(!guard(isNew?"create":"edit"))return false;
    const o={title:fd.title.trim(),type:fd.type,platform:fd.platform,date:fd.date,time:fd.time,category:fd.category,assignee:fd.assignee,campaignId:fd.campaignId,body:fd.body,publish:fd.publish,approval:can("approve")?fd.approval:(x.approval||"Draft")};
    if(isNew)S.content.push({id:uid(),...o});else Object.assign(x,o);
    persist("content");log((isNew?"Scheduled ":"Edited ")+o.title);render();toast("Saved")}});
  const prev=()=>{const f=$("#mform").elements;$("#cprev").textContent=`${f.platform.value} · ${f.type.value}\n\n${f.title.value}\n\n${f.body.value||"(no copy yet)"}`};prev();["title","body","platform","type"].forEach(n=>$("#mform").elements[n].addEventListener("input",prev));
  if(!isNew&&$("#cdelp"))$("#cdelp").onclick=()=>{if(!guard("delete"))return;S.content=S.content.filter(c=>c.id!==x.id);persist("content");log("Deleted post "+x.title);closeModal();render()};
}

/* ---- AI Content Studio ---- */
const CT=["Social media captions","Facebook / Instagram ads","Google Ads copy","TikTok ad script","Video hooks","Email campaign","SMS messages","Landing page copy","Promotional content","Educational content","Retargeting campaign"];
let studio={out:"",last:null};
VIEWS.studio=()=>`<div class="pagehead"><div><div class="eyebrow">AI</div><h1>AI Content Studio</h1><p>Generate copy, then edit it and send it to the calendar.</p></div></div>
 <div class="grid g2"><div class="card"><form id="sform" class="form"><label class="full">Content type<select name="type">${opts(CT,studio.last?.type)}</select></label>
 <label class="full">Brief — what is this about?<textarea name="brief" required placeholder="Product, offer, key message…">${esc(studio.last?.brief||"")}</textarea></label>
 <label>Tone<select name="tone">${opts(["Friendly","Professional","Bold & direct","Playful","Empathetic","Luxury"],studio.last?.tone)}</select></label>
 <label>Language<select name="lang">${opts(["English","Taglish","Filipino","Cebuano","Spanish"],studio.last?.lang)}</select></label>
 <label>Target audience<input name="audience" value="${esc(studio.last?.audience||"")}"></label><label>Length<select name="len">${opts(["Short","Medium","Long"],studio.last?.len||"Medium")}</select></label>
 <label class="full">Marketing objective<select name="obj">${opts(["Awareness","Leads","Sales","Engagement","Retargeting"],studio.last?.obj)}</select></label>
 <div class="full row"><button class="btn y" id="sgo">✦ Generate</button><span class="mut" id="sstat"></span></div></form></div>
 <div class="card"><div class="row sp"><h3>Result (editable)</h3><div class="row"><button class="btn o sm" id="scopy">Copy</button><button class="btn o sm" id="scal" ${can("create")?"":"disabled"}>Send to calendar</button></div></div><textarea id="sout" style="min-height:380px;margin-top:10px" placeholder="Your generated content appears here.">${esc(studio.out)}</textarea></div></div>`;
VIEWS.studio_after=()=>{
  $("#sout").oninput=e=>studio.out=e.target.value;
  $("#scopy").onclick=async()=>{try{await navigator.clipboard.writeText($("#sout").value);toast("Copied")}catch(e){$("#sout").select();toast("Press Ctrl/Cmd+C to copy")}};
  $("#scal").onclick=()=>{if(!$("#sout").value.trim())return toast("Nothing to send yet.");contentModal({title:studio.last?.type||"New post",body:$("#sout").value,platform:"Facebook",type:"Text"},addDays(TODAY,1));$("#mform").elements.title.value=studio.last?.type||""};
  $("#sform").onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));studio.last=f;const b=$("#sgo");b.disabled=true;$("#sstat").innerHTML='<span class="spin"></span> Writing…';
    const prompt=`Write marketing content. Type: ${f.type}. Brief: ${f.brief}. Tone: ${f.tone}. Language: ${f.lang}. Audience: ${f.audience||"general"}. Length: ${f.len}. Objective: ${f.obj}.
Rules: no invented statistics, testimonials, or guaranteed results. Give 3 variations where it makes sense (e.g. captions, hooks, ads). Output ready-to-use text only, no preamble.`;
    try{studio.out=await aiText(prompt);$("#sout").value=studio.out;$("#sstat").textContent=""}catch(er){$("#sstat").innerHTML=`<span class="neg">${esc(errmsg(er))}</span>`}b.disabled=false};
};

/* ---- Analytics ---- */
let an={from:addDays(TODAY,-29),to:TODAY,sel:null,metric:"spend",ai:null};
VIEWS.analytics=()=>{
  if(!an.sel)an.sel=S.campaigns.map(c=>c.id);
  const rows=rowsFor(an.sel,an.from,an.to),t=agg(rows);
  recCache={};const recs=rulesRecs();recs.forEach(r=>recCache[r.id]=r);
  (S.recs||[]).filter(r=>r.status==="pending").forEach(r=>recCache[r.id]=r);
  return `<div class="pagehead"><div><div class="eyebrow">Measure</div><h1>Analytics</h1><p>Centralized results from recorded data.</p></div><div class="row"><button class="btn o" data-act="addmetric" ${can("create")?"":"disabled"}>+ Add metrics</button><button class="btn o" data-act="importcsv" ${can("create")?"":"disabled"}>Import CSV</button></div></div>
  <div class="card" style="margin-bottom:14px"><div class="row"><label>From<input type="date" id="afrom" value="${an.from}"></label><label>To<input type="date" id="ato" value="${an.to}"></label><div class="row" style="align-self:end">${S.campaigns.map(c=>`<label style="display:flex;gap:4px;align-items:center;font-weight:500;color:var(--text)"><input type="checkbox" style="width:auto" data-sel="${c.id}" ${an.sel.includes(c.id)?"checked":""}>${esc(c.name)}</label>`).join("")}</div></div></div>
  ${rows.length?`<div class="grid g4">${kpi("Spend",php(t.spend))}${kpi("Impressions",num(t.imp),`Reach ${num(t.reach)}`)}${kpi("Clicks",num(t.clicks),`CTR ${pct(t.ctr)}`)}${kpi("Engagement",num(t.eng))}${kpi("Leads",num(t.leads),`CPL ${php(t.cpl)}`)}${kpi("Conversions",num(t.conv),`Rate ${pct(t.cr)} · CPA ${php(t.cpa)}`)}${kpi("Revenue",php(t.rev))}${kpi("ROAS",xr(t.roas))}</div>
  <div class="grid g2" style="margin-top:14px"><div class="card"><div class="row sp"><h3>Trend by campaign</h3><select id="amet" style="width:auto">${opts([["spend","Spend"],["leads","Leads"],["conv","Conversions"],["rev","Revenue"],["clicks","Clicks"],["imp","Impressions"]],an.metric)}</select></div><div class="chart"><canvas id="ach1"></canvas></div></div>
  <div class="card"><h3>Campaign comparison (ROAS · CPL)</h3><div class="chart"><canvas id="ach2"></canvas></div></div></div>
  <div class="card tw" style="margin-top:14px"><h3 style="margin-bottom:8px">By campaign</h3><table><thead><tr><th>Campaign</th><th>Spend</th><th>Impr.</th><th>Clicks</th><th>CTR</th><th>Leads</th><th>Conv.</th><th>CPL</th><th>CPA</th><th>Revenue</th><th>ROAS</th></tr></thead><tbody>${S.campaigns.filter(c=>an.sel.includes(c.id)&&rows.some(r=>r.c===c.id)).map(c=>{const a=agg(rows.filter(r=>r.c===c.id));return `<tr><td><b>${esc(c.name)}</b></td><td>${php(a.spend)}</td><td>${num(a.imp)}</td><td>${num(a.clicks)}</td><td>${pct(a.ctr)}</td><td>${num(a.leads)}</td><td>${num(a.conv)}</td><td>${php(a.cpl)}</td><td>${php(a.cpa)}</td><td>${php(a.rev)}</td><td>${xr(a.roas)}</td></tr>`}).join("")}</tbody></table></div>`:`<div class="card">${noData()}</div>`}
  <div class="card" style="margin-top:14px"><div class="row sp"><h3>AI optimization</h3><button class="btn y" id="aorun" ${S.metrics.length?"":"disabled"}>✦ Analyze with Claude</button></div>
  <p class="mut" style="font-size:12.5px">Claude only sees the figures recorded above and is told not to invent data. Changes apply only when you approve them.</p><div id="aoout">${recs.map(r=>recHtml(r,can("approve"))).join("")}${(S.recs||[]).filter(r=>r.status==="pending").map(r=>recHtml(r,can("approve"))).join("")}</div></div>`;
};
VIEWS.analytics_after=()=>{
  const re=()=>render();
  $("#afrom").onchange=e=>{an.from=e.target.value;re()};$("#ato").onchange=e=>{an.to=e.target.value;re()};
  $$("[data-sel]").forEach(x=>x.onchange=()=>{an.sel=$$("[data-sel]:checked").map(i=>i.dataset.sel);re()});
  const rows=rowsFor(an.sel,an.from,an.to);
  if(rows.length){
    const m=$("#amet");m.onchange=()=>{an.metric=m.value;re()};
    const days=[...new Set(rows.map(r=>r.d))].sort();const cs=S.campaigns.filter(c=>an.sel.includes(c.id)&&rows.some(r=>r.c===c.id));
    chart("ach1",{type:"line",data:{labels:days.map(d=>d.slice(5)),datasets:cs.map((c,i)=>({label:c.name,borderColor:PAL[i%6],backgroundColor:PAL[i%6],tension:.3,pointRadius:0,data:days.map(d=>rows.filter(r=>r.c===c.id&&r.d===d).reduce((a,r)=>a+(+r[an.metric]||0),0))}))}});
    chart("ach2",{type:"bar",data:{labels:cs.map(c=>c.name),datasets:[{label:"ROAS (×)",yAxisID:"y",backgroundColor:"#004AAD",borderRadius:6,data:cs.map(c=>agg(rows.filter(r=>r.c===c.id)).roas||0)},{label:"CPL (₱)",yAxisID:"y1",backgroundColor:"#FFB400",borderRadius:6,data:cs.map(c=>agg(rows.filter(r=>r.c===c.id)).cpl||0)}]},options:{scales:{y:{position:"left"},y1:{position:"right",grid:{drawOnChartArea:false}}}}});
  }
  const b=$("#aorun");if(b)b.onclick=runAIOpt;
};
async function runAIOpt(){
  if(!guard("create"))return;
  const b=$("#aorun");b.disabled=true;b.innerHTML='<span class="spin"></span> Analyzing…';
  const from=addDays(TODAY,-29);
  const data=S.campaigns.filter(c=>S.metrics.some(m=>m.c===c.id)).map(c=>{const a=agg(rowsFor([c.id],from,TODAY));return{id:c.id,name:c.name,status:c.status,objective:c.objective,platforms:c.platforms,budget:c.budget,daysOfData:a.n,spend:Math.round(a.spend),impressions:a.imp,clicks:a.clicks,ctr:a.ctr,leads:a.leads,conversions:a.conv,revenue:Math.round(a.rev),cpl:a.cpl&&Math.round(a.cpl),cpa:a.cpa&&Math.round(a.cpa),roas:a.roas}});
  const prompt=`You are a paid-media analyst. Below is REAL recorded data for the last 30 days. Base every recommendation only on these numbers; quote the numbers you rely on; never invent metrics or benchmarks. If data is too thin (under 7 days or very few leads), say so instead of recommending changes. Targets: ROAS ${S.settings.targetRoas}×, CPL ₱${S.settings.targetCpl}.
DATA: ${JSON.stringify(data)}
Return JSON: {"recommendations":[{"campaignId":string,"title":string,"detail":string (cite figures),"category":"budget"|"creative"|"audience"|"scaling"|"fix"|"angle"|"conversion","action":null | {"type":"budget","value":number} | {"type":"status","value":"Paused"|"Active"}}]} with 3-7 items.`;
  try{const r=await aiJSON(prompt);const ids=new Set(S.campaigns.map(c=>c.id));
    S.recs=(S.recs||[]).filter(x=>x.status!=="pending");
    (r.recommendations||[]).forEach(x=>{const act=x.action&&["budget","status"].includes(x.action.type)&&ids.has(x.campaignId)?x.action:null;
      S.recs.push({id:"ai-"+uid(),cid:ids.has(x.campaignId)?x.campaignId:null,tone:"",title:`[AI] ${x.title}`,detail:x.detail,action:act,status:"pending"})});
    persist("recs");log("Ran AI optimization");render();toast("AI recommendations ready")}
  catch(e){toast(errmsg(e));b.disabled=false;b.innerHTML="✦ Analyze with Claude"}
}
function metricModal(){
  modal("Add daily metrics",`<div class="form"><label>Campaign<select name="c">${copts()}</select></label><label>Date<input type="date" name="d" value="${TODAY}" required></label>${[["spend","Spend (₱)"],["imp","Impressions"],["reach","Reach"],["clicks","Clicks"],["eng","Engagement"],["leads","Leads"],["conv","Conversions"],["rev","Revenue (₱)"]].map(([k,l])=>`<label>${l}<input type="number" min="0" step="any" name="${k}" value="0"></label>`).join("")}</div><p class="mut" style="font-size:12px">Enter figures from your ad platform or CRM. Only real numbers belong here.</p>`,{onSubmit:fd=>{
    if(!guard("create"))return false;if(!S.campaigns.length){toast("Create a campaign first.");return false}
    const r={id:uid(),c:fd.c,d:fd.d};["spend","imp","reach","clicks","eng","leads","conv","rev"].forEach(k=>r[k]=Math.max(0,+fd[k]||0));
    S.metrics=S.metrics.filter(m=>!(m.c===r.c&&m.d===r.d)).concat(r);persist("metrics");log("Added metrics");render();toast("Metrics saved")}});
}
function csvModal(){
  modal("Import metrics from CSV",`<p>Columns (header row required): <code>campaign,date,spend,impressions,reach,clicks,engagement,leads,conversions,revenue</code>. Campaign must match an existing campaign name. Dates as YYYY-MM-DD. Rows for the same campaign + date replace existing ones.</p><input type="file" accept=".csv,text/csv" id="csvf"><div id="csvr" class="mut" style="margin-top:8px"></div>`,{submit:"Import",onSubmit:async()=>{
    const f=$("#csvf").files[0];if(!f){toast("Choose a CSV file.");return false}
    const lines=(await f.text()).split(/\r?\n/).filter(l=>l.trim());const hd=lines.shift().split(",").map(x=>x.trim().toLowerCase());
    const idx=n=>hd.indexOf(n);if(idx("campaign")<0||idx("date")<0){toast("Missing campaign/date columns.");return false}
    let ok=0,bad=0;lines.forEach(l=>{const p=l.split(",").map(x=>x.trim());const c=S.campaigns.find(x=>x.name.toLowerCase()===(p[idx("campaign")]||"").toLowerCase());const d=p[idx("date")];
      if(!c||!/^\d{4}-\d{2}-\d{2}$/.test(d)){bad++;return}
      const g=n=>Math.max(0,+p[idx(n)]||0);const r={id:uid(),c:c.id,d,spend:g("spend"),imp:g("impressions"),reach:g("reach"),clicks:g("clicks"),eng:g("engagement"),leads:g("leads"),conv:g("conversions"),rev:g("revenue")};
      S.metrics=S.metrics.filter(m=>!(m.c===r.c&&m.d===r.d)).concat(r);ok++});
    persist("metrics");log(`Imported ${ok} metric rows`);render();toast(`Imported ${ok} rows${bad?`, skipped ${bad}`:""}`)}});
}

/* ---- Reports ---- */
let rp={from:addDays(TODAY,-29),to:TODAY,ai:""};
function reportData(){
  const rows=rowsFor(null,rp.from,rp.to),t=agg(rows);
  const cs=S.campaigns.map(c=>({c,a:agg(rows.filter(r=>r.c===c.id))})).filter(x=>x.a.n);
  const top=[...cs].filter(x=>x.a.roas!=null).sort((a,b)=>b.a.roas-a.a.roas).slice(0,3);
  const insights=rulesRecs().filter(r=>r.id!=="r-none");
  return{rows,t,cs,top,insights};
}
VIEWS.reports=()=>{
  const{rows,t,cs,top,insights}=reportData();
  return `<div class="pagehead"><div><div class="eyebrow">Share</div><h1>Reports</h1><p>Build a performance report and export it.</p></div><div class="row"><button class="btn o" id="rcsv">Export CSV</button><button class="btn y" id="rpdf">Export PDF</button></div></div>
  <div class="card" style="margin-bottom:14px"><div class="row"><label>From<input type="date" id="rfrom" value="${rp.from}"></label><label>To<input type="date" id="rto" value="${rp.to}"></label><button class="btn o" id="rai" style="align-self:end">✦ Write AI summary</button><span class="mut" id="rstat"></span></div></div>
  ${rows.length?`<div class="card" id="rbody"><div class="eyebrow">Report · ${fmtD(rp.from)} – ${fmtD(rp.to)}</div><h2 style="margin:4px 0 12px">Campaign performance summary</h2>
  <h3>Overview</h3><p>${S.campaigns.length} campaigns (${S.campaigns.filter(c=>c.status==="Active").length} active). ${cs.length} had recorded data in this period.</p>
  <div class="grid g4" style="margin:10px 0">${kpi("Ad spend",php(t.spend))}${kpi("Leads",num(t.leads),`CPL ${php(t.cpl)}`)}${kpi("Conversions",num(t.conv),`CPA ${php(t.cpa)}`)}${kpi("ROAS",xr(t.roas),`Revenue ${php(t.rev)}`)}</div>
  <h3>KPI comparison</h3><div class="tw"><table><thead><tr><th>Campaign</th><th>Spend</th><th>Leads</th><th>Conv.</th><th>CPL</th><th>CPA</th><th>ROAS</th></tr></thead><tbody>${cs.map(x=>`<tr><td>${esc(x.c.name)}</td><td>${php(x.a.spend)}</td><td>${num(x.a.leads)}</td><td>${num(x.a.conv)}</td><td>${php(x.a.cpl)}</td><td>${php(x.a.cpa)}</td><td>${xr(x.a.roas)}</td></tr>`).join("")}</tbody></table></div>
  <h3 style="margin-top:14px">Top-performing campaigns (by ROAS)</h3><ol>${top.map(x=>`<li>${esc(x.c.name)} — ${xr(x.a.roas)} on ${php(x.a.spend)}</li>`).join("")}</ol>
  <h3>Insights &amp; recommended next steps</h3>${insights.map(r=>`<div class="rec ${r.tone||""}"><b>${esc(r.title)}</b><div class="mut">${esc(r.detail)}</div></div>`).join("")||'<p class="mut">No flags.</p>'}
  ${rp.ai?`<h3>AI summary (edit before sharing)</h3><textarea id="rainote" style="min-height:160px">${esc(rp.ai)}</textarea>`:""}</div>`:`<div class="card">${noData()}</div>`}`;
};
VIEWS.reports_after=()=>{
  $("#rfrom").onchange=e=>{rp.from=e.target.value;render()};$("#rto").onchange=e=>{rp.to=e.target.value;render()};
  const n=$("#rainote");if(n)n.oninput=()=>rp.ai=n.value;
  $("#rai").onclick=async()=>{const{t,cs}=reportData();if(!cs.length)return toast("No data in this range.");$("#rstat").innerHTML='<span class="spin"></span>';
    const d={period:[rp.from,rp.to],total:{spend:t.spend,leads:t.leads,conversions:t.conv,revenue:t.rev,cpl:t.cpl,cpa:t.cpa,roas:t.roas},campaigns:cs.map(x=>({name:x.c.name,spend:x.a.spend,leads:x.a.leads,conv:x.a.conv,revenue:x.a.rev,roas:x.a.roas,cpl:x.a.cpl}))};
    try{rp.ai=await aiText(`Write a concise client-ready performance summary (under 200 words, plain text) with key insights and 3 next steps. Use ONLY these figures; do not invent numbers or causes you can't support. Currency is Philippine peso.\n${JSON.stringify(d)}`);render()}catch(e){$("#rstat").textContent=errmsg(e)}};
  $("#rcsv").onclick=()=>{const{cs}=reportData();if(!cs.length)return toast("No data to export.");const h=["campaign","status","spend","impressions","reach","clicks","ctr","engagement","leads","conversions","conversion_rate","cpl","cpa","revenue","roas"];
    const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;const csv=[h.join(",")].concat(cs.map(x=>[x.c.name,x.c.status,x.a.spend,x.a.imp,x.a.reach,x.a.clicks,x.a.ctr?.toFixed(4),x.a.eng,x.a.leads,x.a.conv,x.a.cr?.toFixed(4),x.a.cpl?.toFixed(2),x.a.cpa?.toFixed(2),x.a.rev,x.a.roas?.toFixed(2)].map(q).join(","))).join("\n");save(`campaign-report_${rp.from}_${rp.to}.csv`,csv)};
  $("#rpdf").onclick=()=>{const{t,cs,top,insights}=reportData();if(!cs.length)return toast("No data to export.");if(!window.jspdf)return toast("PDF engine didn't load.");
    const doc=new jspdf.jsPDF();let y=18;const W=180;const line=(txt,sz=10,b=false)=>{doc.setFontSize(sz);doc.setFont("helvetica",b?"bold":"normal");doc.splitTextToSize(String(txt).replace(/₱/g,"PHP ").replace(/[×]/g,"x"),W).forEach(l=>{if(y>280){doc.addPage();y=18}doc.text(l,15,y);y+=sz*.5+2})};
    line("Campaign Performance Report",18,true);line(`${fmtD(rp.from)} - ${fmtD(rp.to)}`,10);y+=4;
    line("Overview",13,true);line(`Spend PHP ${num(t.spend)} | Leads ${num(t.leads)} | Conversions ${num(t.conv)} | Revenue PHP ${num(t.rev)}`);line(`CPL ${php(t.cpl)} | CPA ${php(t.cpa)} | ROAS ${xr(t.roas)}`);y+=3;
    line("KPI comparison",13,true);cs.forEach(x=>line(`${x.c.name}: spend ${php(x.a.spend)}, leads ${num(x.a.leads)}, conv ${num(x.a.conv)}, CPL ${php(x.a.cpl)}, CPA ${php(x.a.cpa)}, ROAS ${xr(x.a.roas)}`));y+=3;
    line("Top performers",13,true);top.forEach((x,i)=>line(`${i+1}. ${x.c.name} - ${xr(x.a.roas)}`));y+=3;
    line("Insights and next steps",13,true);insights.forEach(r=>line(`- ${r.title}: ${r.detail}`));
    if(rp.ai){y+=3;line("AI summary",13,true);line(rp.ai)}
    save(`campaign-report_${rp.from}_${rp.to}.pdf`,doc.output("blob"))};
};
async function save(name,data){try{await runtime.download(name,data);toast("Exported")}catch(e){toast("Export failed: "+errmsg(e))}}

/* ---- Team ---- */
VIEWS.team=()=>{
  const cols=[["todo","To do"],["doing","In progress"],["done","Done"]];
  return `<div class="pagehead"><div><div class="eyebrow">Collaborate</div><h1>Team Management</h1><p>Members, roles, tasks and activity.</p></div><div class="row"><button class="btn o" data-act="newtask" ${can("create")?"":"disabled"}>+ Task</button><button class="btn y" data-act="invite" ${can("team")?"":"disabled"}>+ Add member</button></div></div>
  <div class="card tw"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>${S.team.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td><select data-role="${u.id}" style="width:auto" ${can("team")?"":"disabled"}>${opts(["Admin","Manager","Editor","Viewer"],u.role)}</select></td><td>${can("team")&&S.team.length>1?`<button class="btn sm d" data-rm="${u.id}">Remove</button>`:""}</td></tr>`).join("")}</tbody></table>
  <p class="mut" style="font-size:12px;margin:10px 0 0"><b>Admin</b> everything · <b>Manager</b> approvals, budgets · <b>Editor</b> create &amp; edit · <b>Viewer</b> read-only. Sign-in is one shared workspace password (APP_PASSWORD); roles are not tied to individual logins — use "Viewing as" in the sidebar to preview each role. Per-user accounts are covered in the README.</p></div>
  <h2 style="margin:20px 0 10px">Tasks</h2><div class="kan">${cols.map(([k,l])=>`<div><b>${l}</b>${S.tasks.filter(t=>t.status===k).map(t=>`<div class="task"><div>${esc(t.title)}</div><div class="mut" style="font-size:12px">${esc(uname(t.assignee))} · ${fmtD(t.due)}${t.campaignId?" · "+esc((S.campaigns.find(c=>c.id===t.campaignId)||{}).name||""):""}</div><div class="row" style="margin-top:6px"><button class="btn sm o" data-tedit="${t.id}">Edit</button>${k!=="done"?`<button class="btn sm o" data-tnext="${t.id}">→</button>`:""}<button class="btn sm d" data-tdel="${t.id}">✕</button></div></div>`).join("")||'<div class="mut" style="padding:10px;font-size:12px">Empty</div>'}</div>`).join("")}</div>
  <h2 style="margin:20px 0 10px">Activity log</h2><div class="card">${S.activity.slice(0,25).map(a=>`<div style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${esc(a.user)}</b> ${esc(a.text)} <span class="mut" style="font-size:12px">· ${new Date(a.ts).toLocaleString()}</span></div>`).join("")||'<div class="empty">No activity yet.</div>'}</div>`;
};
VIEWS.team_after=()=>{
  $$("[data-role]").forEach(s=>s.onchange=()=>{if(!guard("team"))return;const u=S.team.find(x=>x.id===s.dataset.role);if(u.role==="Admin"&&s.value!=="Admin"&&S.team.filter(x=>x.role==="Admin").length<2){toast("Keep at least one Admin.");render();return}log(`Changed ${u.name} to ${s.value}`);u.role=s.value;persist("team");render()});
  $$("[data-rm]").forEach(b=>b.onclick=()=>{if(!guard("team"))return;const u=S.team.find(x=>x.id===b.dataset.rm);if(u.role==="Admin"&&S.team.filter(x=>x.role==="Admin").length<2){toast("Keep at least one Admin.");return}S.team=S.team.filter(x=>x.id!==u.id);S.tasks.forEach(t=>{if(t.assignee===u.id)t.assignee=""});if(S.settings.me===u.id)S.settings.me=S.team[0].id;persist("team","tasks","settings");log("Removed "+u.name);render()});
  $$("[data-tedit]").forEach(b=>b.onclick=()=>taskModal(S.tasks.find(t=>t.id===b.dataset.tedit)));
  $$("[data-tnext]").forEach(b=>b.onclick=()=>{if(!guard("edit"))return;const t=S.tasks.find(x=>x.id===b.dataset.tnext);t.status=t.status==="todo"?"doing":"done";persist("tasks");log(`Task "${t.title}" → ${t.status}`);render()});
  $$("[data-tdel]").forEach(b=>b.onclick=()=>{if(!guard("delete"))return;S.tasks=S.tasks.filter(x=>x.id!==b.dataset.tdel);persist("tasks");render()});
};

/* ---- Integrations ---- */
const INTEG=[["meta","Meta Ads","Ad spend, reach, leads","oauth"],["gads","Google Ads","Campaign metrics","oauth"],["tiktok","TikTok Ads","Campaign metrics","oauth"],["ga","Google Analytics","Traffic & conversions","oauth"],["sheets","Google Sheets","Import / export rows","oauth"],["crm","CRM (HubSpot, etc.)","Leads & revenue","key"],["email","Email marketing","Campaign sends","key"],["ai","AI APIs","Claude is built in to this app","builtin"],["hooks","Webhooks & automation (n8n, Zapier)","Outbound events","webhook"]];
VIEWS.integrations=()=>`<div class="pagehead"><div><div class="eyebrow">Connect</div><h1>Integrations</h1><p>Extensible connector architecture. No live connection is claimed here.</p></div></div>
 <div class="card" style="margin-bottom:14px;background:var(--soft)"><b>How this works:</b> each connector below implements one interface — <code>connect()</code>, <code>pull(metrics, dateRange)</code>, <code>push(event)</code> — in the backend. The ad-platform connectors are not implemented yet, so none of them are actually connected. Until they are, bring real numbers in with <a href="#analytics">CSV import</a>. See the README for where a connector plugs in (<code>api/</code> serverless routes).</div>
 <div class="grid g3">${INTEG.map(([k,n,d,t])=>{const st=S.integrations[k]||{};return `<div class="card"><div class="row sp"><h3>${n}</h3><span class="pill ${st.demo?"Scheduled":"Draft"}">${t==="builtin"?"Built in":st.demo?"Demo mode":"Not connected"}</span></div><p class="mut" style="margin:6px 0 12px">${d}</p>${t==="builtin"?'<span class="mut" style="font-size:12px">AI features call the Claude API from the server route (<code>/api/ai</code>); the API key stays on the server.</span>':t==="webhook"?`<label>Webhook URL (saved, not called)<input data-hook value="${esc(st.url||"")}" placeholder="https://your-n8n-host/webhook/…" ${can("integrations")?"":"disabled"}></label>`:`<div class="row"><button class="btn sm o" data-int="${k}" ${can("integrations")?"":"disabled"}>${st.demo?"Disable demo mode":"Enable demo mode"}</button><button class="btn sm" data-live="${k}">Connect live</button></div>`}</div>`}).join("")}</div>`;
VIEWS.integrations_after=()=>{
  $$("[data-int]").forEach(b=>b.onclick=()=>{if(!guard("integrations"))return;const k=b.dataset.int;S.integrations[k]={...(S.integrations[k]||{}),demo:!(S.integrations[k]||{}).demo};persist("integrations");render()});
  $$("[data-live]").forEach(b=>b.onclick=()=>modal("Live connection needs a backend",`<p>Connecting <b>${esc(INTEG.find(i=>i[0]===b.dataset.live)[1])}</b> requires an OAuth app registration with the provider, approved scopes, and a server to hold tokens securely. That isn't built yet, and tokens must never be stored in frontend code.</p><p>See the integrations section of the README, or import your exported report as CSV from Analytics in the meantime.</p>`));
  const h=$("[data-hook]");if(h)h.onchange=()=>{if(!guard("integrations"))return;S.integrations.hooks={...(S.integrations.hooks||{}),url:h.value.trim()};persist("integrations");toast("Saved (not called from this preview)")};
};

/* ---- Settings ---- */
VIEWS.settings=()=>`<div class="pagehead"><div><div class="eyebrow">Configure</div><h1>Settings</h1></div></div>
 <div class="grid g2"><div class="card"><h3>Workspace</h3><div class="form" style="margin-top:10px"><label>Target ROAS (×)<input type="number" step="0.1" id="sroas" value="${S.settings.targetRoas}" ${can("settings")?"":"disabled"}></label><label>Target CPL (₱)<input type="number" id="scpl" value="${S.settings.targetCpl}" ${can("settings")?"":"disabled"}></label></div><p class="mut" style="font-size:12px">Used by the rule-based recommendations.</p><button class="btn y" id="ssave" ${can("settings")?"":"disabled"}>Save</button></div>
 <div class="card"><h3>Appearance</h3><p class="mut">Light or dark.</p><button class="btn o" id="stheme">Toggle theme</button></div>
 <div class="card"><h3>Data</h3><p class="mut">Everything is saved ${mode==="db"?"in this app's workspace database":"in this browser"}.</p><div class="row"><button class="btn o" id="sexp">Export all data (JSON)</button><button class="btn d" id="sreset" ${can("settings")?"":"disabled"}>Reset workspace…</button></div></div>
 <div class="card"><h3>Security notes</h3><ul style="margin:6px 0 0 16px;padding:0"><li>No API keys or credentials live in this page; Claude is called from the server.</li><li>All user input is escaped before display.</li><li>Workspace access is protected by a password and an HttpOnly session cookie. Roles are enforced in the interface only; per-user, server-enforced roles need per-user accounts (see the README).</li></ul></div></div>`;
VIEWS.settings_after=()=>{
  $("#ssave").onclick=()=>{S.settings.targetRoas=+$("#sroas").value||3;S.settings.targetCpl=+$("#scpl").value||150;persist("settings");toast("Saved")};
  $("#stheme").onclick=toggleTheme;
  $("#sexp").onclick=()=>save("campaign-command-center-export.json",JSON.stringify(S,null,2));
  $("#sreset").onclick=()=>modal("Reset workspace?",`<p>This erases every campaign, post, task, metric and setting and cannot be undone.</p>`,{submit:"Erase everything",onSubmit:async()=>{const keep=S.team,me0=S.settings.me;S={};KEYS.forEach(k=>S[k]=(k==="settings"||k==="integrations")?{}:[]);S.team=keep;S.settings={theme:document.documentElement.dataset.theme,targetRoas:3,targetCpl:150,demo:false,me:me0};persist();log("Workspace reset");render()}});
};

/* ---- global actions ---- */
function toggleTheme(){S.settings.theme=S.settings.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=S.settings.theme;persist("settings");render()}
document.addEventListener("click",e=>{
  const a=e.target.closest("[data-act]");if(!a)return;const act=a.dataset.act;
  if(act==="newcampaign"){if(!guard("create"))return;modal("New campaign",campaignForm(),{onSubmit:fd=>{const c={id:uid(),assets:[],history:[],ai:null,status:"Draft",audience:""};if(saveCampaignForm(c,fd)===false)return false;hist(c,"Created");S.campaigns.push(c);persist("campaigns");log("Created campaign "+c.name);render()}})}
  if(act==="opencampaign")openCampaign(a.dataset.id);
  if(act==="addmetric")metricModal();if(act==="importcsv")csvModal();
  if(act==="newtask")taskModal();
  if(act==="invite"){if(!guard("team"))return;modal("Add team member",`<div class="form"><label>Name<input name="name" required></label><label>Email<input type="email" name="email" required></label><label>Role<select name="role">${opts(["Editor","Manager","Viewer","Admin"],"Editor")}</select></label></div><p class="mut" style="font-size:12px">This adds the person to the workspace roster. Email invites and per-user sign-in are not built yet (see the README).</p>`,{onSubmit:fd=>{S.team.push({id:uid(),name:fd.name.trim(),email:fd.email.trim(),role:fd.role});persist("team");log("Added "+fd.name);render()}})}
  if(act==="cleardemo")modal("Clear demo data?",`<p>Removes all sample campaigns, posts, tasks and metrics so you can start with your own. Team members are kept.</p>`,{submit:"Clear demo data",onSubmit:()=>{S.campaigns=[];S.content=[];S.tasks=[];S.metrics=[];S.comments=[];S.recs=[];S.activity=[];S.notifs=[];S.settings.demo=false;persist();log("Cleared demo data");render()}});
  if(act==="applyrec"){if(!guard("approve"))return;const r=recCache[a.dataset.id]||(S.recs||[]).find(x=>x.id===a.dataset.id);if(!r||!r.action)return;const c=S.campaigns.find(x=>x.id===r.cid);if(!c)return;
    const d=r.action.type==="budget"?`Change budget of <b>${esc(c.name)}</b> from ${php(c.budget)} to <b>${php(r.action.value)}</b>?`:`Change status of <b>${esc(c.name)}</b> to <b>${esc(r.action.value)}</b>?`;
    modal("Approve this change?",`<p>${d}</p><p class="mut">${esc(r.detail)}</p>`,{submit:"Approve & apply",onSubmit:()=>{applyAction(c,r.action);const x=(S.recs||[]).find(z=>z.id===r.id);if(x)x.status="applied";persist("recs");render();toast("Change applied")}})}
});
$("#who").onchange=e=>{S.settings.me=e.target.value;persist("settings");render()};
$("#theme").onclick=toggleTheme;$("#menu").onclick=()=>$("#side").classList.toggle("open");
$("#bell").onclick=()=>{modal("Notifications",S.notifs.map(n=>`<div style="padding:7px 0;border-bottom:1px solid var(--line);${n.read?"opacity:.6":""}">${esc(n.text)} <span class="mut" style="font-size:12px">${new Date(n.ts).toLocaleString()}</span></div>`).join("")||'<div class="empty">All caught up.</div>');S.notifs.forEach(n=>n.read=true);persist("notifs");bellUpdate()};
$("#gsearch").addEventListener("keydown",e=>{if(e.key!=="Enter")return;const q=e.target.value.trim().toLowerCase();if(!q)return;
  const r=[...S.campaigns.filter(c=>(c.name+c.brand).toLowerCase().includes(q)).map(c=>`<div class="task"><b>Campaign</b> · <a href="#" data-oc="${c.id}">${esc(c.name)}</a></div>`),...S.content.filter(c=>c.title.toLowerCase().includes(q)).map(c=>`<div class="task"><b>Post</b> · ${esc(c.title)} <span class="mut">${fmtD(c.date)}</span></div>`),...S.tasks.filter(c=>c.title.toLowerCase().includes(q)).map(c=>`<div class="task"><b>Task</b> · ${esc(c.title)}</div>`)];
  modal(`Results for "${q}"`,r.join("")||'<div class="empty">Nothing found.</div>');$$("[data-oc]").forEach(a=>a.onclick=ev=>{ev.preventDefault();openCampaign(a.dataset.oc)})});
window.addEventListener("hashchange",render);
window.addEventListener("error",e=>{console.error(e.message)});

$("#signout").onclick=()=>runtime.signOut();
(async()=>{
  await runtime.boot();
  if(runtime.session.authRequired)$("#signout").style.display="";
  try{await loadAll()}catch(e){console.error(e);S={};KEYS.forEach(k=>S[k]=(k==="settings"||k==="integrations")?{}:[]);S.settings={theme:"light",targetRoas:3,targetCpl:150,me:null,demo:false}}
  if(!S.team.length)S.team=[{id:"u1",name:"You",email:"",role:"Admin"}];
  if(!S.settings.me||!S.team.find(u=>u.id===S.settings.me))S.settings.me=S.team[0].id;
  document.documentElement.dataset.theme=S.settings.theme||"light";
  setPersist();render();
})();
