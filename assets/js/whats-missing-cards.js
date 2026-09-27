import { buildLetterTriplets, chooseMissingIndex } from './learning-logic.mjs';
(() => {
  const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
  const state = {
    cardCount: 10,
    missingMode: "middle",
    deck: [],
    phase: "setup",
    completed: 0,
    wrongCount: 0,
    lastResult: null,
    showAnswer: false,
  };

  const app = document.getElementById("app");

  function shuffle(arr){
    const copy=[...arr];
    for(let i=copy.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  }

  const buildTriplets=()=>buildLetterTriplets(ALPHABET);
  const getMissingIndex=mode=>chooseMissingIndex(mode);

  function makeDeck(){
    const count=Math.max(1,Math.min(24,Number(state.cardCount)||10));
    return shuffle(buildTriplets()).slice(0,count).map((letters,i)=>({
      id:letters.join("")+"-"+i,
      letters,
      missingIndex:getMissingIndex(state.missingMode)
    }));
  }

  function resetProgress(nextPhase){
    state.deck=makeDeck();
    state.completed=0;
    state.wrongCount=0;
    state.lastResult=null;
    state.showAnswer=false;
    state.phase=nextPhase;
    render();
  }

  function btn(label, action, primary=false, extra=""){
    return `<button class="btn ${primary?"primary":""} ${extra}" data-action="${action}">${label}</button>`;
  }

  function header(title, subtitle, actions=""){
    return `
      <div class="header">
        <div>
          <div class="eyebrow">What's Missing Cards</div>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        <div class="buttons">${actions}</div>
      </div>`;
  }

  function renderSetup(){
    const total=Math.max(1,Math.min(24,Number(state.cardCount)||10));
    app.innerHTML = `
      <main class="page">
        <div class="wrap">
          ${header("Find the missing letter","Choose the settings, review the alphabet, then begin the exercise.",btn("Start Over","start-over"))}
          <div class="setup-grid">
            <section class="panel">
              <h2 style="font-size:26px;margin-bottom:24px">Settings</h2>

              <div class="field">
                <label for="cardCount">Number of cards</label>
                <input id="cardCount" type="number" min="1" max="24" value="${state.cardCount}">
                <p class="hint">Default = 10</p>
              </div>

              <div class="field">
                <label>Missing letter position</label>
                <div class="segments">
                  ${["first","middle","last","random"].map(x=>`
                    <button class="segment ${state.missingMode===x?"active":""}" data-mode="${x}">
                      ${x[0].toUpperCase()+x.slice(1)}
                    </button>`).join("")}
                </div>
              </div>

              ${btn("Go to Letter Review","go-review",true,"full")}

              <div class="stats-list">
                <div class="stat-row"><span>Completed</span><b>${state.completed}</b></div>
                <div class="stat-row"><span>Remaining</span><b>${state.deck.length || total}</b></div>
                <div class="stat-row"><span>Wrong</span><b>${state.wrongCount}</b></div>
                <div class="stat-row"><span>Progress</span><b>0%</b></div>
              </div>
            </section>

            <section class="panel intro">
              <div>
                <div class="step-pill">Step 1 of 3</div>
                <h2>Set up the exercise</h2>
                <p>Choose your settings on the left, then move through the review screen and into the cards.</p>

                <div class="cards3">
                  <div class="mini"><div class="mini-num">1</div><h3>Choose settings</h3><p>Pick the number of cards and where the missing letter will go.</p></div>
                  <div class="mini"><div class="mini-num">2</div><h3>Review letters</h3><p>Look over the alphabet together before starting the exercise.</p></div>
                  <div class="mini"><div class="mini-num">3</div><h3>Play the cards</h3><p>Mark each one right or wrong and keep going until the set is done.</p></div>
                </div>

                <div class="preview-row">
                  <div class="tile preview">a</div>
                  <div class="tile preview blank">?</div>
                  <div class="tile preview">c</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>`;
  }

  function renderReview(){
    app.innerHTML = `
      <main class="page">
        <div class="wrap">
          ${header("Review the alphabet","Look through the letters first, then start the exercise when you're ready.",
            btn("Back to Settings","back-settings")+btn("Start Over","start-over"))}
          <section class="review-box">
            <div>
              <div class="step-pill">Step 2 of 3</div>
              <h2>Letter review</h2>
              <p>Say the alphabet together once. When you're ready, move into the card exercise.</p>

              <div class="review-grid">
                ${ALPHABET.map(l=>`<div class="tile review">${l}</div>`).join("")}
              </div>

              <div class="buttons">
                ${btn("Back","back-settings")}
                ${btn("Start Exercise","start-exercise",true)}
              </div>
            </div>
          </section>
        </div>
      </main>`;
  }

  function tile(letter,index,current,feedback=false){
    const hidden=index===current.missingIndex;
    if(!hidden) return `<div class="tile exercise">${letter}</div>`;
    if(!feedback) return `<div class="tile exercise blank">?</div>`;
    const wrong=state.lastResult==="wrong";
    return `<div class="tile exercise ${wrong?"reveal-wrong":"reveal-good"}">${letter}</div>`;
  }

  function renderPractice(){
    const current=state.deck[0];
    if(!current){ state.phase="done"; render(); return; }

    const feedback=state.phase==="feedback";
    app.innerHTML = `
      <main class="page">
        <div class="wrap narrow">
          <div class="practice-top">
            <div class="chips">
              <span class="chip">${state.completed} done</span>
              <span class="chip">${state.deck.length} left</span>
              <span class="chip">${state.wrongCount} wrong</span>
            </div>
            <div class="buttons">
              ${btn("Review","review")}
              ${btn("Exit","start-over")}
            </div>
          </div>

          <section class="practice-box">
            <div>
              ${feedback
                ? `<div class="status-pill ${state.lastResult==="wrong"?"wrong":""}">${state.lastResult==="right"?"Nice work!":"Almost, let's fix that one"}</div>`
                : `<div class="status-pill" style="background:#f1f3f6;color:#68758a">Say the missing letter out loud</div>`
              }

              ${feedback ? "" : `<h2>What's missing?</h2><p class="practice-sub">Take a look, say it, then mark how it went.</p>`}

              <div class="exercise-row">
                ${current.letters.map((l,i)=>tile(l,i,current,feedback)).join("")}
              </div>

              ${!feedback ? `
                <div class="buttons">
                  ${btn("Right","right",true,"large")}
                  ${btn("Wrong","wrong",false,"large")}
                </div>
              ` : `
                <div class="feedback-answer">
                  The missing letter is
                  <strong class="${state.lastResult==="wrong"?"wrong":"right"}">
                    ${current.letters[current.missingIndex]}
                  </strong>
                </div>
                <p class="feedback-note">
                  ${state.lastResult==="right"
                    ? "Great. You got it, and now you can move on."
                    : "This card has been placed back into the deck 3 cards later."}
                </p>
                <div class="buttons">
                  ${btn("Next Card",state.lastResult==="right"?"next-right":"next-wrong",true,"large")}
                  ${state.lastResult==="wrong"?btn("Review Letters","review"):""}
                </div>
              `}
            </div>
          </section>
        </div>
      </main>`;
  }

  function renderDone(){
    const total=Math.max(1,Math.min(24,Number(state.cardCount)||10));
    const score=Math.max(0,Math.round((total/(total+state.wrongCount))*100));
    app.innerHTML = `
      <main class="page">
        <div class="wrap">
          ${header("Final stats","You've finished the exercise. Here's how it went.",btn("Start Over","start-over"))}
          <section class="done-box">
            <div>
              <div class="step-pill">Step 3 of 3</div>
              <div style="font-size:62px;margin-bottom:10px">🎉</div>
              <h2>All done!</h2>
              <p>You finished all ${total} cards.</p>

              <div class="done-stats">
                <div class="done-stat"><span>Completed</span><strong>${state.completed}</strong></div>
                <div class="done-stat"><span>Wrong</span><strong>${state.wrongCount}</strong></div>
                <div class="done-stat"><span>Score</span><strong>${score}%</strong></div>
              </div>

              <div class="buttons">
                ${btn("Play Again","go-review",true)}
                ${btn("Review Letters","review")}
              </div>
            </div>
          </section>
        </div>
      </main>`;
  }

  function render(){
    if(state.phase==="setup") renderSetup();
    else if(state.phase==="review") renderReview();
    else if(state.phase==="play" || state.phase==="feedback") renderPractice();
    else renderDone();
  }

  document.addEventListener("click",(e)=>{
    const modeBtn=e.target.closest("[data-mode]");
    if(modeBtn){
      state.missingMode=modeBtn.dataset.mode;
      render();
      return;
    }

    const actionBtn=e.target.closest("[data-action]");
    if(!actionBtn) return;
    const action=actionBtn.dataset.action;

    if(action==="start-over") resetProgress("setup");
    if(action==="go-review") resetProgress("review");
    if(action==="back-settings"){state.phase="setup";render();}
    if(action==="start-exercise"){state.phase="play";render();}
    if(action==="review"){state.phase="review";render();}
    if(action==="right"){state.lastResult="right";state.showAnswer=true;state.phase="feedback";render();}
    if(action==="wrong"){state.lastResult="wrong";state.wrongCount+=1;state.showAnswer=true;state.phase="feedback";render();}
    if(action==="next-right"){
      state.deck=state.deck.slice(1);
      state.completed+=1;
      state.lastResult=null;
      state.showAnswer=false;
      state.phase=state.deck.length===0?"done":"play";
      render();
    }
    if(action==="next-wrong"){
      const retry={...state.deck[0]};
      const rest=state.deck.slice(1);
      const at=Math.min(3,rest.length);
      state.deck=[...rest.slice(0,at),retry,...rest.slice(at)];
      state.lastResult=null;
      state.showAnswer=false;
      state.phase="play";
      render();
    }
  });

  document.addEventListener("input",(e)=>{
    if(e.target.id==="cardCount"){
      state.cardCount=e.target.value;
    }
  });

  render();
})();
