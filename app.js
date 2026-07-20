"use strict";

const app = document.querySelector("#app");
const toastElement = document.querySelector("#toast");
const confettiElement = document.querySelector("#confetti");
const config = window.APP_CONFIG || {};

const state = {
  view: "home",
  theme: "",
  sourceUrl: "",
  restaurants: [],
  manualRows: [],
  roundNumber: 0,
  roundEntrants: [],
  matches: [],
  matchIndex: 0,
  winners: [],
  bye: null,
  priorityRestaurantId: null,
};

const sampleRestaurants = [
  restaurant("sample-1", "라메종 한남", "한남", 4.8, 428, "차분한 분위기에서 즐기는 컨템퍼러리 프렌치 코스", "https://app.catchtable.co.kr"),
  restaurant("sample-2", "오르토 청담", "청담", 4.7, 315, "제철 재료를 섬세하게 풀어낸 이탈리안 다이닝", "https://app.catchtable.co.kr"),
  restaurant("sample-3", "테이블 용산", "용산", 4.6, 207, "그릴 요리와 와인을 편안하게 즐기는 모던 비스트로", "https://app.catchtable.co.kr"),
  restaurant("sample-4", "스튜디오 이태원", "이태원", 4.9, 186, "창의적인 한 접시와 야경이 어우러진 기념일 레스토랑", "https://app.catchtable.co.kr"),
  restaurant("sample-5", "코너 성수", "성수", 4.5, 522, "캐주얼한 공간에서 즐기는 숯불 요리와 내추럴 와인", "https://app.catchtable.co.kr"),
];

initialize();

function initialize() {
  const shared = readSharedWorldcup();
  if (shared) {
    state.theme = shared.theme;
    state.sourceUrl = shared.sourceUrl;
    state.restaurants = shared.restaurants.map(normalizeRestaurant).filter(Boolean);
    state.view = "review";
  } else {
    const draft = readDraft();
    if (draft) {
      state.theme = draft.theme || "";
      state.sourceUrl = draft.sourceUrl || "";
    }
  }

  render();
  registerServiceWorker();
}

function render() {
  document.body.dataset.view = state.view;
  if (state.view === "home") renderHome();
  if (state.view === "loading") renderLoading();
  if (state.view === "manual") renderManual();
  if (state.view === "review") renderReview();
  if (state.view === "tournament") renderTournament();
  if (state.view === "result") renderResult();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function shell(content, extraClass = "") {
  return `<main class="app-shell ${extraClass}">${content}</main>`;
}

function topbar(step = "") {
  return `
    <header class="topbar">
      <div class="brand"><span class="brand-mark">W</span><span>뭐먹지 월드컵</span></div>
      ${step ? `<span class="step-chip">${escapeHtml(step)}</span>` : ""}
    </header>`;
}

function renderHome() {
  app.innerHTML = shell(`
    <section class="screen home-screen">
      ${topbar("MAKE")}
      <div class="hero">
        <p class="eyebrow">오늘의 한 곳을 고르는 가장 재밌는 방법</p>
        <h1>고민은 짧게,<br />선택은 월드컵으로.</h1>
        <p class="hero-copy">주제와 캐치테이블 ‘함께 고르기’ 링크를 넣으면 후보 음식점이 토너먼트로 펼쳐져요.</p>
      </div>

      <form id="start-form" class="form-stack" novalidate>
        <label>
          <span class="field-label">월드컵 주제</span>
          <span class="input-shell">
            <span class="title-bracket">[</span>
            <input id="theme-input" name="theme" maxlength="24" autocomplete="off" placeholder="기념일 또는 00의 생일" value="${escapeAttribute(state.theme)}" />
            <span class="title-bracket">]</span>
            <span class="title-suffix">뭐먹지 월드컵</span>
          </span>
        </label>

        <label>
          <span class="field-label">캐치테이블 ‘함께 고르기’ 링크</span>
          <span class="input-shell">
            <input id="url-input" name="url" type="url" inputmode="url" autocomplete="url" placeholder="https://app.catchtable.co.kr/ct/shop/list/vote/..." value="${escapeAttribute(state.sourceUrl)}" />
          </span>
          <span class="field-hint">링크 읽기가 제한되면 음식점을 직접 확인·보완할 수 있는 화면으로 이어져요.</span>
        </label>

        <div class="home-actions">
          <button class="primary-button" type="submit">입력 완료 <span aria-hidden="true">→</span></button>
          <button id="sample-button" class="link-button" type="button">샘플로 먼저 체험하기</button>
        </div>
      </form>

      <p class="privacy-note">입력한 월드컵 정보는 별도 서버에 저장하지 않아요. 공유할 때만 후보 정보가 공유 링크 안에 담깁니다.</p>
    </section>`);

  document.querySelector("#start-form").addEventListener("submit", handleStartSubmit);
  document.querySelector("#sample-button").addEventListener("click", () => {
    state.theme = "기념일";
    state.sourceUrl = "https://app.catchtable.co.kr";
    state.restaurants = sampleRestaurants.map((item) => ({ ...item }));
    state.view = "review";
    render();
  });
}

async function handleStartSubmit(event) {
  event.preventDefault();
  const theme = document.querySelector("#theme-input").value.trim();
  const sourceUrl = document.querySelector("#url-input").value.trim();

  if (!theme) {
    showToast("월드컵 주제를 먼저 입력해 주세요.");
    document.querySelector("#theme-input").focus();
    return;
  }
  if (!isCatchtableVoteUrl(sourceUrl)) {
    showToast("캐치테이블 ‘함께 고르기’ 링크를 확인해 주세요.");
    document.querySelector("#url-input").focus();
    return;
  }

  state.theme = theme;
  state.sourceUrl = sourceUrl;
  writeDraft();
  state.view = "loading";
  render();

  const imported = await importRestaurants(sourceUrl);
  if (imported.length >= 2) {
    state.restaurants = imported;
    state.view = "review";
    render();
    showToast(`${imported.length}곳을 불러왔어요.`);
  } else {
    state.manualRows = [blankRestaurant(), blankRestaurant(), blankRestaurant(), blankRestaurant()];
    state.view = "manual";
    render();
  }
}

function renderLoading() {
  app.innerHTML = shell(`
    <section class="screen loading-screen">
      ${topbar("IMPORT")}
      <div class="loading-center">
        <div>
          <div class="loader" aria-hidden="true">⌁</div>
          <h1>후보 음식점을 확인하고 있어요</h1>
          <p>캐치테이블 링크에서 이름과 위치를<br />차곡차곡 가져오는 중입니다.</p>
        </div>
      </div>
    </section>`);
}

function renderManual() {
  if (state.manualRows.length < 2) {
    state.manualRows = [blankRestaurant(), blankRestaurant()];
  }

  app.innerHTML = shell(`
    <section class="screen manual-screen">
      ${topbar("CHECK")}
      <div class="manual-heading">
        <h1>후보를 한 번만<br />확인해 주세요.</h1>
        <p>캐치테이블이 외부 페이지의 자동 읽기를 제한했어요. 이름과 위치만 입력해도 진행할 수 있고, 나머지는 선택 사항이에요.</p>
      </div>

      <div class="notice-card">
        <strong>왜 이런 화면이 나오나요?</strong><br />GitHub Pages는 보안을 위해 다른 서비스의 내용을 마음대로 읽을 수 없어요. 입력한 내용은 이 기기에만 머뭅니다.
      </div>

      <details class="bulk-panel">
        <summary>여러 음식점을 한 번에 붙여넣기</summary>
        <textarea id="bulk-input" class="bulk-textarea" placeholder="한 줄에 한 곳씩 입력하세요.\n예: 레스토랑 이름 | 한남 | 4.8 | 120 | 간단한 설명 | 링크"></textarea>
        <button id="bulk-apply" class="ghost-button" type="button">붙여넣은 목록 적용</button>
      </details>

      <div id="editor-list" class="restaurant-editor-list">
        ${state.manualRows.map(editorTemplate).join("")}
      </div>
      <button id="add-row" class="ghost-button" type="button">＋ 음식점 추가</button>

      <div class="manual-bottom">
        <button id="manual-complete" class="primary-button" type="button">후보 확인 완료 <span aria-hidden="true">→</span></button>
      </div>
    </section>`);

  bindManualEditors();
}

function editorTemplate(item, index) {
  return `
    <article class="restaurant-editor" data-index="${index}">
      <div class="editor-number">RESTAURANT ${String(index + 1).padStart(2, "0")}</div>
      ${state.manualRows.length > 2 ? `<button class="remove-editor" type="button" aria-label="${index + 1}번 음식점 삭제">×</button>` : ""}
      <div class="editor-grid">
        <input class="manual-input" data-field="name" placeholder="음식점 이름 *" value="${escapeAttribute(item.name)}" />
        <input class="manual-input" data-field="location" placeholder="위치 *" value="${escapeAttribute(item.location)}" />
        <input class="manual-input" data-field="rating" inputmode="decimal" placeholder="별점 (예: 4.7)" value="${escapeAttribute(item.rating || "")}" />
        <input class="manual-input" data-field="reviewCount" inputmode="numeric" placeholder="리뷰 수" value="${escapeAttribute(item.reviewCount || "")}" />
        <input class="manual-input wide" data-field="summary" placeholder="간단한 요약" value="${escapeAttribute(item.summary)}" />
        <input class="manual-input wide" data-field="url" inputmode="url" placeholder="개별 캐치테이블 링크 (선택)" value="${escapeAttribute(item.url)}" />
      </div>
    </article>`;
}

function bindManualEditors() {
  document.querySelectorAll(".manual-input").forEach((input) => {
    input.addEventListener("input", (event) => {
      const card = event.target.closest(".restaurant-editor");
      const index = Number(card.dataset.index);
      state.manualRows[index][event.target.dataset.field] = event.target.value;
    });
  });

  document.querySelectorAll(".remove-editor").forEach((button) => {
    button.addEventListener("click", (event) => {
      const index = Number(event.currentTarget.closest(".restaurant-editor").dataset.index);
      state.manualRows.splice(index, 1);
      renderManual();
    });
  });

  document.querySelector("#add-row").addEventListener("click", () => {
    state.manualRows.push(blankRestaurant());
    renderManual();
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });

  document.querySelector("#bulk-apply").addEventListener("click", () => {
    const parsed = parseBulkRestaurants(document.querySelector("#bulk-input").value);
    if (parsed.length < 2) {
      showToast("두 곳 이상을 한 줄에 한 곳씩 붙여넣어 주세요.");
      return;
    }
    state.manualRows = parsed;
    renderManual();
    showToast(`${parsed.length}곳을 입력했어요.`);
  });

  document.querySelector("#manual-complete").addEventListener("click", completeManualInput);
}

function completeManualInput() {
  const completed = state.manualRows
    .map((item, index) => normalizeRestaurant({ ...item, id: item.id || `manual-${Date.now()}-${index}` }))
    .filter((item) => item && item.name && item.location);

  if (completed.length < 2) {
    showToast("이름과 위치가 입력된 음식점이 두 곳 이상 필요해요.");
    return;
  }

  state.restaurants = completed;
  state.view = "review";
  render();
}

function renderReview() {
  const title = `[${state.theme}] 뭐먹지 월드컵`;
  app.innerHTML = shell(`
    <section class="screen review-screen">
      ${topbar(`${state.restaurants.length} PLACES`)}
      <div class="review-heading">
        <p class="eyebrow">READY TO CHOOSE</p>
        <h1>${escapeHtml(title)}</h1>
        <p>후보가 잘 들어왔는지 확인해 주세요.</p>
      </div>

      <div class="restaurant-list">
        ${state.restaurants
          .map(
            (item, index) => `
              <article class="restaurant-row">
                <div class="restaurant-index">${String(index + 1).padStart(2, "0")}</div>
                <div>
                  <h2>${escapeHtml(item.name)}</h2>
                  <p>${escapeHtml(item.location || "위치 정보 없음")}</p>
                </div>
              </article>`
          )
          .join("")}
      </div>

      <div id="swipe-up-zone" class="swipe-up-zone" role="button" tabindex="0" aria-label="위로 스와이프하여 토너먼트 시작">
        <div class="swipe-up-inner">
          <span class="up-arrow" aria-hidden="true">↑</span>
          진행하려면 위로 스와이프
          <br /><button id="start-fallback" class="start-fallback" type="button">또는 여기를 눌러 시작</button>
        </div>
      </div>
      <button id="share-worldcup" class="share-fab" type="button" aria-label="이 월드컵 공유">↗</button>
    </section>`);

  bindReviewGestures();
  document.querySelector("#share-worldcup").addEventListener("click", shareCurrentWorldcup);
}

function bindReviewGestures() {
  const zone = document.querySelector("#swipe-up-zone");
  let startY = null;
  let currentY = null;

  zone.addEventListener("pointerdown", (event) => {
    startY = event.clientY;
    currentY = event.clientY;
    zone.setPointerCapture?.(event.pointerId);
  });
  zone.addEventListener("pointermove", (event) => {
    if (startY === null) return;
    currentY = event.clientY;
    const distance = Math.max(0, startY - currentY);
    zone.style.transform = `translateY(${-Math.min(distance * 0.22, 18)}px)`;
  });
  zone.addEventListener("pointerup", () => {
    const distance = startY === null ? 0 : startY - currentY;
    startY = null;
    currentY = null;
    zone.style.transform = "";
    if (distance > 55) startTournament();
  });
  zone.addEventListener("pointercancel", () => {
    startY = null;
    currentY = null;
    zone.style.transform = "";
  });
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startTournament();
    }
  });
  const fallbackButton = document.querySelector("#start-fallback");
  fallbackButton.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  fallbackButton.addEventListener("pointerup", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startTournament();
  });
  fallbackButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startTournament();
  });
}

function startTournament() {
  if (state.view === "tournament") return;
  if (state.restaurants.length < 2) {
    showToast("후보 음식점이 두 곳 이상 필요해요.");
    return;
  }
  state.roundNumber = 0;
  state.priorityRestaurantId = null;
  prepareRound(state.restaurants.map((item) => ({ ...item })));
}

function prepareRound(entrants) {
  state.roundNumber += 1;
  let ordered;
  if (state.priorityRestaurantId) {
    const priority = entrants.find((item) => item.id === state.priorityRestaurantId);
    const others = shuffle(entrants.filter((item) => item.id !== state.priorityRestaurantId));
    ordered = priority ? [priority, ...others] : shuffle(entrants);
  } else {
    ordered = shuffle(entrants);
  }

  state.roundEntrants = ordered;
  state.bye = ordered.length % 2 === 1 ? ordered[ordered.length - 1] : null;
  const matchedEntrants = state.bye ? ordered.slice(0, -1) : ordered;
  state.matches = [];
  for (let index = 0; index < matchedEntrants.length; index += 2) {
    state.matches.push([matchedEntrants[index], matchedEntrants[index + 1]]);
  }
  state.matchIndex = 0;
  state.winners = [];
  state.view = "tournament";
  render();

  if (state.bye) {
    state.priorityRestaurantId = state.bye.id;
  } else {
    state.priorityRestaurantId = null;
  }
}

function renderTournament() {
  const match = state.matches[state.matchIndex];
  if (!match) {
    advanceRound();
    return;
  }
  const [top, bottom] = match;
  const progress = ((state.matchIndex + 1) / state.matches.length) * 100;
  const label = roundLabel(state.roundEntrants.length);

  app.innerHTML = shell(`
    <section class="screen tournament-screen">
      <div>
        ${topbar(escapeHtml(label))}
        <div class="progress-track"><div class="progress-value" style="width:${progress}%"></div></div>
      </div>
      <p class="match-instruction">마음이 가는 쪽으로 밀거나 선택 버튼을 눌러주세요</p>
      <div id="match-stage" class="match-stage">
        ${choiceCard(top, "top", state.matchIndex * 2 + 1)}
        <div class="versus-badge" aria-hidden="true">VS</div>
        ${choiceCard(bottom, "bottom", state.matchIndex * 2 + 2)}
      </div>
      <div class="swipe-hints" aria-hidden="true"><span>← 위 음식점</span><span>아래 음식점 →</span></div>
      ${state.bye && state.matchIndex === 0 ? `<div class="bye-banner">${escapeHtml(state.bye.name)}은(는) 부전승! 다음 라운드 첫 매치로 갑니다.</div>` : ""}
    </section>`, "tournament-shell");

  bindMatchGestures(top, bottom);
}

function choiceCard(item, position, number) {
  const direction = position === "top" ? "왼쪽으로 밀어 선택" : "오른쪽으로 밀어 선택";
  const rating = item.rating ? Number(item.rating).toFixed(1) : "—";
  const reviews = item.reviewCount ? `리뷰 ${Number(item.reviewCount).toLocaleString("ko-KR")}` : "리뷰 정보 없음";
  return `
    <article class="choice-card ${position}-card" data-position="${position}">
      <span class="choice-number">NO.${String(number).padStart(2, "0")}</span>
      <div>
        <div class="choice-direction">${position === "top" ? "←" : "→"} ${direction}</div>
        <h2>${escapeHtml(item.name)}</h2>
        <div class="restaurant-meta">
          <span>${escapeHtml(item.location || "위치 정보 없음")}</span>
          <span class="meta-dot"></span>
          <span><span class="rating-star">★</span> ${escapeHtml(rating)}</span>
          <span class="meta-dot"></span>
          <span>${escapeHtml(reviews)}</span>
        </div>
        <p class="restaurant-summary">${escapeHtml(item.summary || "캐치테이블에서 메뉴와 상세 정보를 확인해 보세요.")}</p>
      </div>
      <div class="choice-footer">
        <a class="catchtable-link" href="${escapeAttribute(item.url || state.sourceUrl)}" target="_blank" rel="noopener noreferrer">캐치테이블 보기 ↗</a>
        <button class="select-card-button" type="button" data-select="${position}">이곳 선택</button>
      </div>
    </article>`;
}

function bindMatchGestures(top, bottom) {
  const stage = document.querySelector("#match-stage");
  const topCard = document.querySelector(".top-card");
  const bottomCard = document.querySelector(".bottom-card");
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dy = 0;
  let dragging = false;

  stage.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a, button")) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dx = 0;
    dy = 0;
    dragging = true;
    stage.setPointerCapture?.(pointerId);
    topCard.classList.add("swipe-active");
    bottomCard.classList.add("swipe-active");
  });

  stage.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    dx = event.clientX - startX;
    dy = event.clientY - startY;
    if (Math.abs(dx) <= Math.abs(dy)) return;
    event.preventDefault();
    const limited = Math.max(-170, Math.min(170, dx));
    if (limited < 0) {
      topCard.style.transform = `translateX(${limited}px) rotate(${limited * 0.045 - 1.3}deg)`;
      topCard.style.opacity = String(1 - Math.min(Math.abs(limited) / 350, 0.28));
      bottomCard.style.transform = `translateX(3px) rotate(1.3deg) scale(${1 - Math.min(Math.abs(limited) / 1800, 0.04)})`;
      topCard.classList.add("is-selected");
      bottomCard.classList.remove("is-selected");
    } else {
      bottomCard.style.transform = `translateX(${limited}px) rotate(${limited * 0.045 + 1.3}deg)`;
      bottomCard.style.opacity = String(1 - Math.min(Math.abs(limited) / 350, 0.28));
      topCard.style.transform = `translateX(-3px) rotate(-1.3deg) scale(${1 - Math.min(Math.abs(limited) / 1800, 0.04)})`;
      bottomCard.classList.add("is-selected");
      topCard.classList.remove("is-selected");
    }
  });

  const finish = (event) => {
    if (!dragging || (event.pointerId !== undefined && event.pointerId !== pointerId)) return;
    dragging = false;
    topCard.classList.remove("swipe-active", "is-selected");
    bottomCard.classList.remove("swipe-active", "is-selected");
    if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      chooseRestaurant(dx < 0 ? top : bottom, dx < 0 ? "left" : "right");
      return;
    }
    topCard.style.transform = "";
    topCard.style.opacity = "";
    bottomCard.style.transform = "";
    bottomCard.style.opacity = "";
  };

  stage.addEventListener("pointerup", finish);
  stage.addEventListener("pointercancel", finish);

  document.querySelectorAll("[data-select]").forEach((button) => {
    button.addEventListener("click", () => {
      chooseRestaurant(button.dataset.select === "top" ? top : bottom, button.dataset.select === "top" ? "left" : "right");
    });
  });

  document.querySelectorAll(".catchtable-link").forEach((link) => {
    link.addEventListener("pointerdown", (event) => event.stopPropagation());
  });
}

let choiceLocked = false;
function chooseRestaurant(winner, direction) {
  if (choiceLocked) return;
  choiceLocked = true;
  const selectedCard = document.querySelector(direction === "left" ? ".top-card" : ".bottom-card");
  const otherCard = document.querySelector(direction === "left" ? ".bottom-card" : ".top-card");
  selectedCard.style.transform = `translateX(${direction === "left" ? -620 : 620}px) rotate(${direction === "left" ? -18 : 18}deg)`;
  selectedCard.style.opacity = "0";
  otherCard.style.opacity = "0.35";
  otherCard.style.transform = "scale(0.95)";

  window.setTimeout(() => {
    state.winners.push(winner);
    state.matchIndex += 1;
    choiceLocked = false;
    if (state.matchIndex >= state.matches.length) advanceRound();
    else renderTournament();
  }, 230);
}

function advanceRound() {
  const nextEntrants = state.bye ? [state.bye, ...state.winners] : [...state.winners];
  if (nextEntrants.length === 1) {
    state.restaurants = state.restaurants;
    state.winner = nextEntrants[0];
    state.view = "result";
    render();
    launchConfetti();
    return;
  }
  prepareRound(nextEntrants);
}

function renderResult() {
  const winner = state.winner;
  const rating = winner.rating ? Number(winner.rating).toFixed(1) : "—";
  const reviews = winner.reviewCount ? `리뷰 ${Number(winner.reviewCount).toLocaleString("ko-KR")}` : "리뷰 정보 없음";

  app.innerHTML = shell(`
    <section class="screen result-screen">
      ${topbar("WINNER")}
      <div class="result-heading">
        <div class="winner-crown" aria-hidden="true">♛</div>
        <p class="eyebrow">팡팡! 오늘의 최종 선택</p>
        <h1>${escapeHtml(winner.name)}</h1>
        <p>[${escapeHtml(state.theme)}] 뭐먹지 월드컵 우승</p>
      </div>

      <article class="winner-card">
        <div class="winner-location">${escapeHtml(winner.location || "위치 정보 없음")}</div>
        <h2>${escapeHtml(winner.name)}</h2>
        <div class="restaurant-meta">
          <span><span class="rating-star">★</span> ${escapeHtml(rating)}</span>
          <span class="meta-dot"></span>
          <span>${escapeHtml(reviews)}</span>
        </div>
        <p class="restaurant-summary">${escapeHtml(winner.summary || "캐치테이블에서 메뉴, 가격과 예약 가능 시간을 확인해 보세요.")}</p>
        <a class="primary-button" href="${escapeAttribute(winner.url || state.sourceUrl)}" target="_blank" rel="noopener noreferrer">캐치테이블에서 확인하기 ↗</a>
      </article>

      <div class="result-actions">
        <button id="replay-button" class="secondary-button" type="button">같은 후보로 다시 하기</button>
        <button id="share-result" class="ghost-button" type="button">결과 공유하기 ↗</button>
      </div>

      <div class="new-worldcup-card">
        <p>이번에는 다른 주제로 골라볼까요?</p>
        <a id="new-worldcup" class="new-worldcup-link" href="${escapeAttribute(baseUrl())}">다른 주제 음식점 월드컵 만들어보기</a>
      </div>
    </section>`);

  document.querySelector("#replay-button").addEventListener("click", startTournament);
  document.querySelector("#share-result").addEventListener("click", () => shareResult(winner));
  document.querySelector("#new-worldcup").addEventListener("click", (event) => {
    event.preventDefault();
    resetToHome();
  });
}

async function importRestaurants(sourceUrl) {
  const attempts = [];
  if (config.importProxy) {
    const separator = config.importProxy.includes("?") ? "&" : "?";
    attempts.push(`${config.importProxy}${separator}url=${encodeURIComponent(sourceUrl)}`);
  }
  attempts.push(sourceUrl);

  for (const url of attempts) {
    try {
      const response = await fetchWithTimeout(url, 9000);
      if (!response.ok) continue;
      const body = await response.text();
      const restaurants = extractRestaurants(body, response.headers.get("content-type") || "", sourceUrl);
      if (restaurants.length >= 2) return restaurants;
    } catch {
      // 다음 안전한 방법 또는 수동 입력으로 이어집니다.
    }
  }
  return [];
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: { Accept: "text/html,application/json" },
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function extractRestaurants(body, contentType, sourceUrl) {
  const candidates = [];
  const trimmed = body.trim();

  if (contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      collectRestaurantObjects(JSON.parse(trimmed), candidates, sourceUrl);
    } catch {
      // HTML 파싱도 시도합니다.
    }
  }

  try {
    const documentNode = new DOMParser().parseFromString(body, "text/html");
    documentNode.querySelectorAll("script").forEach((script) => {
      const text = script.textContent.trim();
      if (!text || (!text.startsWith("{") && !text.startsWith("["))) return;
      try {
        collectRestaurantObjects(JSON.parse(text), candidates, sourceUrl);
      } catch {
        // 실행용 스크립트는 건너뜁니다.
      }
    });

    documentNode.querySelectorAll("a[href]").forEach((anchor) => {
      const href = anchor.getAttribute("href") || "";
      const name = cleanText(anchor.textContent);
      if (!/\/ct\/shop\//.test(href) || name.length < 2 || name.length > 60) return;
      const container = anchor.closest("li, article, [class*='card'], [class*='shop']") || anchor.parentElement;
      const text = cleanText(container?.textContent || "");
      candidates.push(
        restaurant(
          `anchor-${hashString(`${name}-${href}`)}`,
          name,
          inferLocation(text),
          inferRating(text),
          inferReviewCount(text),
          "",
          absoluteUrl(href, sourceUrl)
        )
      );
    });
  } catch {
    // 파싱이 불가능하면 수동 확인 화면으로 이어집니다.
  }

  return dedupeRestaurants(candidates).filter((item) => item.name.length >= 2).slice(0, 32);
}

function collectRestaurantObjects(root, output, sourceUrl) {
  const seen = new WeakSet();
  const nameKeys = ["shopName", "restaurantName", "storeName", "shop_name", "restaurant_name", "name"];
  const locationKeys = ["regionName", "location", "district", "areaName", "address", "addressName", "roadAddress", "region"];
  const ratingKeys = ["rating", "starRating", "avgRating", "reviewScore", "score"];
  const reviewKeys = ["reviewCount", "reviewsCount", "review_count", "totalReviewCount"];
  const summaryKeys = ["summary", "description", "shortDescription", "intro", "catchphrase", "subTitle"];
  const urlKeys = ["url", "shopUrl", "restaurantUrl", "webUrl", "shareUrl"];
  const idKeys = ["shopId", "restaurantId", "storeId", "shopSeq", "id"];

  function visit(value, depth) {
    if (depth > 18 || value === null || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (!Array.isArray(value)) {
      const rawName = firstValue(value, nameKeys);
      const name = cleanText(rawName);
      const keys = Object.keys(value).join(" ").toLowerCase();
      const hasShopSignal = /(shop|restaurant|store|place|dining)/.test(keys);
      const location = cleanText(firstValue(value, locationKeys));
      const rating = numberValue(firstValue(value, ratingKeys));
      const reviewCount = integerValue(firstValue(value, reviewKeys));
      const objectUrl = cleanText(firstValue(value, urlKeys));
      const objectId = cleanText(firstValue(value, idKeys));

      if (
        name.length >= 2 &&
        name.length <= 70 &&
        !looksLikePageTitle(name) &&
        (hasShopSignal || location || rating || reviewCount || /\/ct\/shop\//.test(objectUrl))
      ) {
        output.push(
          restaurant(
            objectId || `object-${hashString(`${name}-${location}-${objectUrl}`)}`,
            name,
            location || inferLocation(JSON.stringify(value).slice(0, 1000)),
            rating,
            reviewCount,
            cleanText(firstValue(value, summaryKeys)),
            absoluteUrl(objectUrl, sourceUrl) || sourceUrl
          )
        );
      }
    }

    Object.values(value).forEach((child) => visit(child, depth + 1));
  }

  visit(root, 0);
}

function renderSharedPayload() {
  return {
    version: 1,
    theme: state.theme,
    sourceUrl: state.sourceUrl,
    restaurants: state.restaurants.map(({ id, name, location, rating, reviewCount, summary, url }) => ({
      id,
      name,
      location,
      rating,
      reviewCount,
      summary,
      url,
    })),
  };
}

function sharedUrl() {
  return `${baseUrl()}#worldcup=${encodePayload(renderSharedPayload())}`;
}

async function shareCurrentWorldcup() {
  const url = sharedUrl();
  const title = `[${state.theme}] 뭐먹지 월드컵`;
  const text = `${state.restaurants.length}곳 중 오늘의 음식점을 골라주세요.`;
  await shareOrCopy({ title, text, url }, "월드컵 링크를 복사했어요.");
}

async function shareResult(winner) {
  const url = sharedUrl();
  const title = `${winner.name} 우승!`;
  const text = `[${state.theme}] 뭐먹지 월드컵의 최종 선택은 ${winner.name}입니다.`;
  await shareOrCopy({ title, text, url }, "결과와 다시 하기 링크를 복사했어요.");
}

async function shareOrCopy(data, copyMessage) {
  try {
    if (navigator.share) {
      await navigator.share(data);
      return;
    }
    await navigator.clipboard.writeText(data.url);
    showToast(copyMessage);
  } catch (error) {
    if (error?.name === "AbortError") return;
    try {
      await navigator.clipboard.writeText(data.url);
      showToast(copyMessage);
    } catch {
      window.prompt("아래 링크를 복사해 주세요.", data.url);
    }
  }
}

function readSharedWorldcup() {
  const match = window.location.hash.match(/^#worldcup=(.+)$/);
  if (!match) return null;
  try {
    const data = decodePayload(match[1]);
    if (!data || typeof data.theme !== "string" || !Array.isArray(data.restaurants) || data.restaurants.length < 2) return null;
    return data;
  } catch {
    history.replaceState(null, "", baseUrl());
    showToast("공유 링크가 손상되어 새 월드컵 화면을 열었어요.");
    return null;
  }
}

function encodePayload(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodePayload(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function resetToHome() {
  state.view = "home";
  state.theme = "";
  state.sourceUrl = "";
  state.restaurants = [];
  state.winner = null;
  state.roundNumber = 0;
  state.priorityRestaurantId = null;
  localStorage.removeItem("food-worldcup-draft");
  history.replaceState(null, "", baseUrl());
  render();
}

function launchConfetti() {
  confettiElement.replaceChildren();
  const colors = ["#ff4358", "#ffb11b", "#171717", "#65b5a6", "#7c6ee6", "#ff8f67"];
  for (let index = 0; index < 90; index += 1) {
    const piece = document.createElement("i");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty("--duration", `${2.5 + Math.random() * 2.2}s`);
    piece.style.setProperty("--delay", `${Math.random() * 0.8}s`);
    piece.style.setProperty("--drift", `${-140 + Math.random() * 280}px`);
    piece.style.setProperty("--spin", `${360 + Math.random() * 900}deg`);
    piece.style.width = `${6 + Math.random() * 8}px`;
    piece.style.height = `${8 + Math.random() * 13}px`;
    confettiElement.append(piece);
  }
  window.setTimeout(() => confettiElement.replaceChildren(), 5200);
}

let toastTimer;
function showToast(message) {
  window.clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.classList.add("show");
  toastTimer = window.setTimeout(() => toastElement.classList.remove("show"), 2600);
}

function parseBulkRestaurants(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name = "", location = "", rating = "", reviewCount = "", summary = "", url = ""] = line.split("|").map((part) => part.trim());
      return {
        id: `bulk-${Date.now()}-${index}`,
        name,
        location,
        rating,
        reviewCount,
        summary,
        url,
      };
    });
}

function restaurant(id, name, location, rating, reviewCount, summary, url) {
  return { id, name, location, rating, reviewCount, summary, url };
}

function blankRestaurant() {
  return restaurant(`blank-${Math.random().toString(36).slice(2)}`, "", "", "", "", "", "");
}

function normalizeRestaurant(item) {
  if (!item || typeof item !== "object") return null;
  const name = cleanText(item.name);
  if (!name) return null;
  return restaurant(
    cleanText(item.id) || `restaurant-${hashString(`${name}-${item.location || ""}`)}`,
    name.slice(0, 80),
    cleanText(item.location).slice(0, 80),
    clamp(numberValue(item.rating), 0, 5),
    Math.max(0, integerValue(item.reviewCount)),
    cleanText(item.summary).slice(0, 240),
    safeHttpUrl(item.url) || state.sourceUrl
  );
}

function dedupeRestaurants(items) {
  const map = new Map();
  items.forEach((candidate) => {
    const item = normalizeRestaurant(candidate);
    if (!item) return;
    const key = `${item.name.toLowerCase()}|${item.location.toLowerCase()}`;
    const previous = map.get(key);
    if (!previous || restaurantCompleteness(item) > restaurantCompleteness(previous)) map.set(key, item);
  });
  return [...map.values()];
}

function restaurantCompleteness(item) {
  return [item.location, item.rating, item.reviewCount, item.summary, item.url].filter(Boolean).length;
}

function firstValue(object, keys) {
  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null) return object[key];
  }
  return "";
}

function inferLocation(text) {
  const locations = ["한남", "이태원", "용산", "청담", "성수", "압구정", "신사", "강남", "서초", "잠실", "삼청", "종로", "을지로", "여의도", "마포", "연남", "합정", "서촌", "해방촌", "광화문"];
  return locations.find((location) => text.includes(location)) || "";
}

function inferRating(text) {
  const match = text.match(/(?:평점|별점|rating|score|★)\s*[:：]?\s*([0-5](?:\.\d)?)/i);
  return match ? Number(match[1]) : 0;
}

function inferReviewCount(text) {
  const match = text.match(/(?:리뷰|review)[^0-9]{0,8}([0-9,]+)/i);
  return match ? Number(match[1].replaceAll(",", "")) : 0;
}

function looksLikePageTitle(name) {
  return /(캐치테이블|catchtable|함께\s*고르기|로그인|예약|월드컵)/i.test(name);
}

function isCatchtableVoteUrl(value) {
  try {
    const url = new URL(value);
    const hostOk = url.hostname === "catchtable.co.kr" || url.hostname.endsWith(".catchtable.co.kr");
    return url.protocol === "https:" && hostOk && url.pathname.includes("/ct/shop/list/vote/");
  } catch {
    return false;
  }
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function absoluteUrl(value, base) {
  if (!value) return "";
  try {
    const url = new URL(String(value), base);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function cleanText(value) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function numberValue(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function integerValue(value) {
  const number = Number(String(value ?? "").replace(/[^0-9\-]/g, ""));
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function roundLabel(count) {
  if (count === 2) return "FINAL";
  if (count === 4) return "SEMI FINAL";
  return `ROUND ${state.roundNumber} · ${count}강`;
}

function baseUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function writeDraft() {
  try {
    localStorage.setItem("food-worldcup-draft", JSON.stringify({ theme: state.theme, sourceUrl: state.sourceUrl }));
  } catch {
    // 사생활 보호 모드에서는 저장이 제한될 수 있습니다.
  }
}

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem("food-worldcup-draft") || "null");
  } catch {
    return null;
  }
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }
}
