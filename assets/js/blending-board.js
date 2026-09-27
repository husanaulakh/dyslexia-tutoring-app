import { cleanWord as clean, autoChunkWord as autoChunk, parseSoundSplit as parse, tokenizeBulkWords, normalizeStoredWord } from './learning-logic.mjs';
const INITIAL_WORDS=[
["cat",["c","a","t"]],["bat",["b","a","t"]],["hat",["h","a","t"]],["mat",["m","a","t"]],["sat",["s","a","t"]],["rat",["r","a","t"]],["pat",["p","a","t"]],["fat",["f","a","t"]],
["cab",["c","a","b"]],["cap",["c","a","p"]],["can",["c","a","n"]],["cot",["c","o","t"]],["cut",["c","u","t"]],["cup",["c","u","p"]],["dog",["d","o","g"]],["dig",["d","i","g"]],
["dip",["d","i","p"]],["hid",["h","i","d"]],["him",["h","i","m"]],["hit",["h","i","t"]],["dug",["d","u","g"]],["sun",["s","u","n"]],["map",["m","a","p"]],["pig",["p","i","g"]],["pit",["p","i","t"]],
["fan",["f","a","n"]],["hop",["h","o","p"]],["ship",["sh","i","p"]],["shop",["sh","o","p"]],["chip",["ch","i","p"]],["chat",["ch","a","t"]],["thin",["th","i","n"]],["that",["th","a","t"]],
["fish",["f","i","sh"]],["cash",["c","a","sh"]],["stop",["s","t","o","p"]],["frog",["f","r","o","g"]],["clip",["c","l","i","p"]],["flag",["f","l","a","g"]],["drip",["d","r","i","p"]],
["plug",["p","l","u","g"]],["milk",["m","i","l","k"]],["jump",["j","u","m","p"]],["hand",["h","a","n","d"]],["desk",["d","e","s","k"]],["tent",["t","e","n","t"]],["tim",["t","i","m"]],
["belt",["b","e","l","t"]],["pond",["p","o","n","d"]],["lamp",["l","a","m","p"]],["nest",["n","e","s","t"]],["soft",["s","o","f","t"]]
].map(([word,chunks])=>({word,chunks,lessonTag:"current"}));

const $=s=>document.querySelector(s), vowels=new Set(["a","e","i","o","u"]), digraphs=["ch","sh","th","ck","wh","ph","ng"];
let state={words:loadWords(),soundMode:"3",lessonMode:"current",currentChunks:["f","a","n"],lastClicked:null,showPrompt:false,showTools:true,showDictionary:true,singleTag:"current",bulkTag:"current"};

function loadWords(){
 try {
  const raw=localStorage.getItem("blending-board-words-standalone");
  if(raw===null)return INITIAL_WORDS.map(x=>({...x,chunks:[...x.chunks]}));
  const stored=JSON.parse(raw);
  if(!Array.isArray(stored))return INITIAL_WORDS.map(x=>({...x,chunks:[...x.chunks]}));
  const valid=stored.map(normalizeStoredWord).filter(Boolean);
  return stored.length>0&&valid.length===0?INITIAL_WORDS.map(x=>({...x,chunks:[...x.chunks]})):valid;
 } catch { return INITIAL_WORDS.map(x=>({...x,chunks:[...x.chunks]})); }
}
function save(){try{localStorage.setItem("blending-board-words-standalone",JSON.stringify(state.words));return true}catch{return false}}
function lessonLabel(t){return t==="previous"?"Review":"This lesson"} function key(c){return c.join("|")} function word(){return state.currentChunks.join("")}
function valid(){return state.words.filter(i=>{const s=state.soundMode==="both"?[3,4].includes(i.chunks.length):i.chunks.length===Number(state.soundMode);const l=state.lessonMode==="both"||i.lessonTag===state.lessonMode;return s&&l})}
function same(a,b,j){return a.length===b.length&&a.every((x,i)=>i===j||x===b[i])}
function feedback(m){const e=$("#feedback");e.textContent=m;e.style.display=m?"block":"none"}
function chunkBg(ch){const ls=ch.replace(/[^a-z]/g,"").split(""),v=ls.some(x=>vowels.has(x)),c=ls.some(x=>!vowels.has(x));if(v&&c){const fv=vowels.has(ls[0]||"");const l=fv?"#fb923c":"#fff",r=fv?"#fff":"#fb923c";return`linear-gradient(90deg,${l} 0%,${l} 50%,${r} 50%,${r} 100%)`}return v?"#fb923c":"#fff"}

function ensureCurrent(){const v=valid();if(!v.length){state.currentChunks=[];return}if(!v.some(x=>key(x.chunks)===key(state.currentChunks)))state.currentChunks=[...v[0].chunks]}
function renderFilters(){
 const s=[["3","3 sounds"],["4","4 sounds"],["both","3 + 4 sounds"]];$("#soundFilters").innerHTML=s.map(([k,l])=>`<button class="pill ${state.soundMode===k?"active":""}" data-s="${k}">${l}</button>`).join("");document.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{state.soundMode=b.dataset.s;ensureCurrent();render()});
 const l=[["current","This lesson"],["previous","Review"],["both","All words"]];$("#lessonFilters").innerHTML=l.map(([k,t])=>`<button class="pill secondary ${state.lessonMode===k?"active":""}" data-l="${k}">${t}</button>`).join("");document.querySelectorAll("[data-l]").forEach(b=>b.onclick=()=>{state.lessonMode=b.dataset.l;ensureCurrent();render()})
}
function renderBoard(){
 $("#currentWord").textContent=word()||"—";$("#modeBadge").textContent=`Practice set: ${state.lessonMode==="both"?"All words":state.lessonMode==="previous"?"Review":"This lesson"} • ${state.soundMode==="both"?"3 + 4 sounds":state.soundMode+" sounds"}`;
 const st=$("#stage");if(!state.currentChunks.length)st.innerHTML='<div class="empty">No words in this practice set yet. Add words in Tutor tools, change the filters, or reset the starter list.</div>';else{st.innerHTML=`<div class="cards ${state.currentChunks.length===3?"three":"four"}">${state.currentChunks.map((c,i)=>`<button class="card ${state.lastClicked===i?"clicked":""}" data-p="${i}" style="background:${chunkBg(c)}">${c}</button>`).join("")}</div>`;st.querySelectorAll(".card").forEach(b=>b.onclick=()=>cycle(Number(b.dataset.p)))}
 $("#prompt").style.display=state.showPrompt?"block":"none";$("#promptText").textContent=state.currentChunks.length?` ${state.currentChunks.join(" ")} → ${word()}`:""
}
function cycle(p){const v=valid();if(!v.length||!state.currentChunks.length)return;const m=v.filter(x=>same(x.chunks,state.currentChunks,p)).sort((a,b)=>(a.chunks[p]||"").localeCompare(b.chunks[p]||""));if(m.length>1){const i=m.findIndex(x=>key(x.chunks)===key(state.currentChunks)),nx=m[(i+1+m.length)%m.length];state.currentChunks=[...nx.chunks];feedback(`Changed sound ${p+1}: ${nx.chunks.join(" • ")} = ${nx.word}`)}else{feedback("No word in this list changes only this sound. Add a matching word or choose another sound.")}state.lastClicked=p;renderBoard()}
function nextWord(){const v=valid();if(!v.length)return;const i=v.findIndex(x=>key(x.chunks)===key(state.currentChunks));state.currentChunks=[...v[(i+1+v.length)%v.length].chunks];state.lastClicked=null;renderBoard()}
function randomWord(){const v=valid();if(!v.length)return;state.currentChunks=[...v[Math.floor(Math.random()*v.length)].chunks];state.lastClicked=null;renderBoard()}
function startList(){const v=valid();if(!v.length)return;state.currentChunks=[...v[0].chunks];state.lastClicked=null;renderBoard()}
function choose(i){const x=state.words[i];if(!x)return;if(state.soundMode!=="both")state.soundMode=String(x.chunks.length);if(state.lessonMode!=="both")state.lessonMode=x.lessonTag;state.currentChunks=[...x.chunks];state.lastClicked=null;render()}
function removeWord(i){state.words.splice(i,1);save();ensureCurrent();feedback("Removed word.");render()}

function tagSeg(sel,val,set){const r=$(sel);r.innerHTML=[["current","This lesson"],["previous","Review"]].map(([k,l])=>`<button class="${val===k?"active":""}" data-tag="${k}">${l}</button>`).join("");r.querySelectorAll("[data-tag]").forEach(b=>b.onclick=()=>set(b.dataset.tag))}
function renderTools(){$("#toolsBody").style.display=state.showTools?"flex":"none";$("#toolsToggle").textContent=state.showTools?"Hide":"Show";$("#promptToggle").textContent=state.showPrompt?"Hide":"Show";tagSeg("#singleTagSeg",state.singleTag,k=>{state.singleTag=k;renderTools()});tagSeg("#bulkTagSeg",state.bulkTag,k=>{state.bulkTag=k;renderTools()});preview()}
function preview(){const w=clean($("#singleWord").value),e=$("#preview");if(!w){e.style.display="none";return}const c=parse($("#soundSplit").value,w);e.style.display="block";e.innerHTML=`<div class="label" style="color:#c2410c">Preview</div><div style="margin-top:5px;font-size:18px;font-weight:900">${w}: ${c.join(" • ")}</div>`}
function addSingle(){const w=clean($("#singleWord").value);if(w.length<3||w.length>12){feedback("Add a word with 3 to 12 letters.");return}const c=parse($("#soundSplit").value,w);if(c.length<3||c.length>4){feedback("Split the word into 3 or 4 sounds/letters.");return}const k=w+"|"+key(c),i=state.words.findIndex(x=>x.word+"|"+key(x.chunks)===k),it={word:w,chunks:c,lessonTag:state.singleTag};if(i>=0)state.words[i]=it;else state.words.push(it);save();state.currentChunks=[...c];state.soundMode=String(c.length);state.lessonMode=state.singleTag;$("#singleWord").value="";$("#soundSplit").value="";feedback(`${i>=0?"Updated":"Added"} ${w} (${lessonLabel(state.singleTag)}).`);render()}
function addBulk(){const d=tokenizeBulkWords($("#bulkWords").value);let a=0,u=0;d.forEach(w=>{const c=autoChunk(w);if(c.length<3||c.length>4)return;const k=w+"|"+key(c),i=state.words.findIndex(x=>x.word+"|"+key(x.chunks)===k),it={word:w,chunks:c,lessonTag:state.bulkTag};if(i>=0){state.words[i]=it;u++}else{state.words.push(it);a++}});save();$("#bulkWords").value="";feedback(`${a?"Added "+a+" ":""}${u?(a?"and ":"")+"updated "+u+" ":""}${a+u===1?"word":"words"} as ${lessonLabel(state.bulkTag)}.`);ensureCurrent();render()}
function renderDict(){$("#dictionary").style.display=state.showDictionary?"block":"none";$("#dictToggle").textContent=state.showDictionary?"Hide":"Show";$("#clearAll").style.display=state.words.length?"inline-block":"none";if(!state.showDictionary)return;const g={3:[],4:[]};state.words.forEach((it,i)=>{if(g[it.chunks.length])g[it.chunks.length].push({it,i})});$("#dictionary").innerHTML=[3,4].map(n=>{const r=g[n];if(!r.length)return"";return`<div class="dict-group"><div class="dict-group-head"><div class="label">${n} sounds</div><div class="count">${r.length}</div></div>${r.map(({it,i})=>`<div class="word-row"><button class="word-main" data-c="${i}"><div class="wordline"><div><div class="word">${it.word}</div><div class="chunks">${it.chunks.join(" • ")}</div></div><span class="tag ${it.lessonTag}">${lessonLabel(it.lessonTag)}</span></div></button><button class="delete" data-r="${i}">×</button></div>`).join("")}</div>`}).join("");document.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>choose(Number(b.dataset.c)));document.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>removeWord(Number(b.dataset.r)))}
function clearAll(){state.words=[];state.currentChunks=[];state.lastClicked=null;save();feedback("Cleared all words from the dictionary.");render()}
function resetAll(){state.words=INITIAL_WORDS.map(x=>({...x,chunks:[...x.chunks]}));state.soundMode="3";state.lessonMode="current";state.currentChunks=["f","a","n"];state.singleTag="current";state.bulkTag="current";state.lastClicked=null;save();feedback("Dictionary reset to the starter word list.");render()}
function render(){renderFilters();renderBoard();renderTools();renderDict()}

$("#nextBtn").onclick=nextWord;$("#randomBtn").onclick=randomWord;$("#startBtn").onclick=startList;$("#resetBtn").onclick=resetAll;$("#clearAll").onclick=clearAll;
$("#toolsToggle").onclick=()=>{state.showTools=!state.showTools;renderTools()};$("#dictToggle").onclick=()=>{state.showDictionary=!state.showDictionary;renderDict()};$("#promptToggle").onclick=()=>{state.showPrompt=!state.showPrompt;renderTools();renderBoard()};
$("#addSingle").onclick=addSingle;$("#addBulk").onclick=addBulk;$("#singleWord").addEventListener("input",e=>{e.target.value=clean(e.target.value).slice(0,12);preview()});$("#soundSplit").addEventListener("input",preview);$("#singleWord").addEventListener("keydown",e=>{if(e.key==="Enter")addSingle()});
ensureCurrent();render();
