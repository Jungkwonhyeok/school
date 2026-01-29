/* eslint-disable no-alert */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, getFirestore, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase (사용자 제공)
const firebaseConfig = {
  apiKey: "AIzaSyBJnizFw6Mo3cdF0UbGlSBKvUGVGiBwiuA",
  authDomain: "school-login-ee53f.firebaseapp.com",
  projectId: "school-login-ee53f",
  storageBucket: "school-login-ee53f.firebasestorage.app",
  messagingSenderId: "929713035415",
  appId: "1:929713035415:web:26bde7996c65221ec171d2",
  measurementId: "G-F9TPWK78RL",
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
// NEIS Open API keys (사용자 제공)
const API_KEYS = {
  meal: "7c40956280fc45f1afdd53b5bac315da",
  timetable: {
    elementary: "61541542ff534d9db83045d1f2363453",
    middle: "246b28a67d3e4836b6c83a853be1dbc3",
    high: "d0cd5027daa74361a0f59f70d250667a",
  },
  // schoolInfo는 별도 키를 제공받지 않았으므로 meal 키를 재사용 (NEIS는 서비스별 분리키가 아니어도 동작하는 경우가 많음)
  schoolInfo: "7c40956280fc45f1afdd53b5bac315da",
};

const NEIS_HUB = "https://open.neis.go.kr/hub";

const REGION_OPTIONS = [
  { code: "B10", label: "서울특별시교육청" },
  { code: "C10", label: "부산광역시교육청" },
  { code: "D10", label: "대구광역시교육청" },
  { code: "E10", label: "인천광역시교육청" },
  { code: "F10", label: "광주광역시교육청" },
  { code: "G10", label: "대전광역시교육청" },
  { code: "H10", label: "울산광역시교육청" },
  { code: "I10", label: "세종특별자치시교육청" },
  { code: "J10", label: "경기도교육청" },
  { code: "K10", label: "강원특별자치도교육청" },
  { code: "M10", label: "충청북도교육청" },
  { code: "N10", label: "충청남도교육청" },
  { code: "P10", label: "전북특별자치도교육청" },
  { code: "Q10", label: "전라남도교육청" },
  { code: "R10", label: "경상북도교육청" },
  { code: "S10", label: "경상남도교육청" },
  { code: "T10", label: "제주특별자치도교육청" },
];

const SCHOOL_TYPE_META = {
  elementary: { label: "초등학교", grades: 6, service: "elsTimetable" },
  middle: { label: "중학교", grades: 3, service: "misTimetable" },
  high: { label: "고등학교", grades: 3, service: "hisTimetable" },
};

const STORAGE_KEYS = {
  theme: "schoolapp.theme",
  lastLoginId: "schoolapp.lastLoginId",
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const regionSelect = $("regionSelect");
const schoolTypeSelect = $("schoolTypeSelect");
const schoolNameInput = $("schoolNameInput");
const btnSearchSchool = $("btnSearchSchool");
const schoolResultSelect = $("schoolResultSelect");
const gradeSelect = $("gradeSelect");
const classInput = $("classInput");
const classList = $("classList");
const dateInput = $("dateInput");
const btnLoad = $("btnLoad");
const btnFavorite = $("btnFavorite");
const favoriteList = $("favoriteList");
const btnClearFavorites = $("btnClearFavorites");
const btnToday = $("btnToday");
const btnTheme = $("btnTheme");

// auth UI
const authPill = $("authPill");
const authPillText = $("authPillText");
const btnAuthOpen = $("btnAuthOpen");
const btnLogout = $("btnLogout");
const authModal = $("authModal");
const btnAuthClose = $("btnAuthClose");
const tabLogin = $("tabLogin");
const tabSignup = $("tabSignup");
const formLogin = $("formLogin");
const formSignup = $("formSignup");
const loginId = $("loginId");
const loginPw = $("loginPw");
const signupId = $("signupId");
const signupPw = $("signupPw");
const authMessage = $("authMessage");

const statusEl = $("status");
const resultMeta = $("resultMeta");
const timetableEl = $("timetable");
const mealEl = $("meal");
const mealDetails = $("mealDetails");

// ---------- State ----------
let selectedSchool = null; // { ATPT_OFCDC_SC_CODE, SD_SCHUL_CODE, SCHUL_NM, SCHUL_KND_SC_NM }
let currentUser = null; // firebase user
let favoritesCache = [];
let currentUserIdLabel = ""; // 사용자가 입력한 아이디(이메일이 아닌 형태 포함)

// ---------- Utils ----------
function setStatus(message, { type = "info", show = true } = {}) {
  if (!show) {
    statusEl.hidden = true;
    statusEl.textContent = "";
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

function ymdFromDateInput(value) {
  // value: "YYYY-MM-DD" -> "YYYYMMDD"
  if (!value) return "";
  return value.replaceAll("-", "");
}

function todayISO() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeMealHtml(ddish) {
  // NEIS는 줄바꿈이 <br/>로 오고, 알레르기 숫자 등이 포함될 수 있음.
  // XSS 방지를 위해 일단 escape하고, <br/> 계열만 다시 줄바꿈으로 변환.
  const escaped = escapeHtml(ddish ?? "");
  return escaped.replaceAll("&lt;br/&gt;", "<br/>").replaceAll("&lt;br&gt;", "<br/>");
}

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function normalizeLoginId(id) {
  const raw = String(id ?? "").trim();
  if (!raw) return { email: "", label: "" };
  // 이메일 형태면 그대로 사용하고, 아니면 내부적으로 pseudo email로 변환합니다.
  if (raw.includes("@")) return { email: raw, label: raw.split("@")[0] || raw };
  return { email: `${raw}@school-login.local`, label: raw };
}

function setAuthMessage(msg) {
  authMessage.textContent = msg || "";
}

function openAuthModal() {
  authModal.hidden = false;
  setAuthMessage("");
  const last = localStorage.getItem(STORAGE_KEYS.lastLoginId) || "";
  if (last && !loginId.value) loginId.value = last;
  if (last && !signupId.value) signupId.value = last;
}

function closeAuthModal() {
  authModal.hidden = true;
  setAuthMessage("");
  loginPw.value = "";
  signupPw.value = "";
}

function setAuthUiState() {
  if (currentUser) {
    authPill.hidden = false;
    authPillText.textContent = `${currentUserIdLabel || "로그인됨"}`;
    btnAuthOpen.hidden = true;
    btnLogout.hidden = false;
    btnFavorite.disabled = false;
    btnClearFavorites.disabled = false;
  } else {
    authPill.hidden = true;
    btnAuthOpen.hidden = false;
    btnLogout.hidden = true;
    btnFavorite.disabled = false; // 클릭 시 로그인 유도
    btnClearFavorites.disabled = false;
  }
}

async function loadFavoritesForUser(user) {
  if (!user) {
    favoritesCache = [];
    renderFavorites();
    return;
  }
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    favoritesCache = Array.isArray(data.favorites) ? data.favorites : [];
  } catch (e) {
    favoritesCache = [];
    setStatus(`즐겨찾기 불러오기 실패: ${e.message}`, { type: "error", show: true });
  }
  renderFavorites();
}

async function saveFavoritesForUser() {
  if (!currentUser) return;
  const ref = doc(db, "users", currentUser.uid);
  await setDoc(
    ref,
    {
      userId: currentUserIdLabel || "",
      favorites: favoritesCache,
    },
    { merge: true },
  );
}

// ---------- API ----------
async function neisFetch(serviceName, params) {
  const url = new URL(`${NEIS_HUB}/${serviceName}`);
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", "200");
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  // 에러 응답 형태: { RESULT: { CODE, MESSAGE } } 또는 { serviceName: [ { head: [ { RESULT } ] } ] }
  // INFO-200(데이터 없음)은 실패가 아니라 "빈 결과"로 처리
  if (data?.RESULT?.CODE) {
    if (data.RESULT.CODE === "INFO-000") {
      // ok
    } else if (data.RESULT.CODE === "INFO-200") {
      return { rows: [], raw: data };
    } else {
      throw new Error(`${data.RESULT.CODE}: ${data.RESULT.MESSAGE}`);
    }
  }

  const table = data?.[serviceName];
  if (!Array.isArray(table)) return { rows: [], raw: data };

  const head = table?.[0]?.head;
  const headResult = head?.find?.((x) => x?.RESULT)?.RESULT;
  if (headResult?.CODE) {
    if (headResult.CODE === "INFO-000") {
      // ok
    } else if (headResult.CODE === "INFO-200") {
      return { rows: [], raw: data };
    } else {
      throw new Error(`${headResult.CODE}: ${headResult.MESSAGE}`);
    }
  }

  const rows = table?.[1]?.row ?? [];
  return { rows, raw: data };
}

async function searchSchools({ regionCode, query }) {
  // schoolInfo: 학교 기본정보로 SD_SCHUL_CODE를 얻기 위해 사용
  // 문서상 주요 파라미터: ATPT_OFCDC_SC_CODE, SCHUL_NM
  const { rows } = await neisFetch("schoolInfo", {
    KEY: API_KEYS.schoolInfo,
    ATPT_OFCDC_SC_CODE: regionCode,
    SCHUL_NM: query,
  });
  return rows;
}

async function fetchTimetable({ type, regionCode, schoolCode, ymd, grade, classNm }) {
  const meta = SCHOOL_TYPE_META[type];
  const service = meta.service;
  const key = API_KEYS.timetable[type];
  const { rows } = await neisFetch(service, {
    KEY: key,
    ATPT_OFCDC_SC_CODE: regionCode,
    SD_SCHUL_CODE: schoolCode,
    ALL_TI_YMD: ymd,
    GRADE: grade,
    CLASS_NM: classNm,
  });
  return rows;
}

async function fetchMeal({ regionCode, schoolCode, ymd }) {
  const { rows } = await neisFetch("mealServiceDietInfo", {
    KEY: API_KEYS.meal,
    ATPT_OFCDC_SC_CODE: regionCode,
    SD_SCHUL_CODE: schoolCode,
    MLSV_YMD: ymd,
  });
  return rows;
}

// ---------- Rendering ----------
function setOptions(selectEl, options, { placeholder } = {}) {
  selectEl.innerHTML = "";
  if (placeholder) {
    const op = document.createElement("option");
    op.value = "";
    op.textContent = placeholder;
    selectEl.appendChild(op);
  }
  for (const opt of options) {
    const op = document.createElement("option");
    op.value = opt.value;
    op.textContent = opt.label;
    selectEl.appendChild(op);
  }
}

function renderGradesAndClasses() {
  const type = schoolTypeSelect.value;
  const meta = SCHOOL_TYPE_META[type];
  const grades = Array.from({ length: meta.grades }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}학년`,
  }));
  setOptions(gradeSelect, grades);

  // 반(학급)은 학교별 데이터를 안정적으로 얻기 어려워 입력형으로 제공합니다.
  // 다만 사용성 향상을 위해 1~20까지 추천 목록을 제공합니다.
  classList.innerHTML = "";
  for (let i = 1; i <= 20; i += 1) {
    const opt = document.createElement("option");
    opt.value = String(i);
    classList.appendChild(opt);
  }
  if (!classInput.value) classInput.value = "1";
}

function renderTimetable(rows) {
  if (!rows || rows.length === 0) {
    timetableEl.innerHTML = `<div class="muted">해당 날짜/학년/반 시간표 데이터가 없습니다.</div>`;
    return;
  }

  // PERIO(교시), ITRT_CNTNT(수업내용/과목)가 일반적으로 존재
  const items = rows
    .map((r) => ({
      perio: r.PERIO ?? r.PERIO?.toString?.() ?? "",
      subject: r.ITRT_CNTNT ?? r.SUBJECT ?? r.LESSON_NM ?? "",
      raw: r,
    }))
    .sort((a, b) => Number(a.perio) - Number(b.perio));

  const html = `
    <div class="table">
      ${items
        .map(
          (it) => `
            <div class="row">
              <div class="cell-key">${escapeHtml(it.perio)}교시</div>
              <div class="cell-val">${escapeHtml(it.subject || "—")}</div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
  timetableEl.innerHTML = html;
}

function renderMeal(rows) {
  if (!rows || rows.length === 0) {
    mealEl.innerHTML = `<div class="muted">해당 날짜 급식 데이터가 없습니다.</div>`;
    return;
  }

  // 한 날짜에 보통 1행(중식 등) 이지만, 조식/중식/석식이 있을 수 있어 전부 표시
  const items = rows.map((r) => ({
    name: r.MMEAL_SC_NM ?? "급식",
    dishes: r.DDISH_NM ?? "",
    cal: r.CAL_INFO ?? "",
    ntr: r.NTR_INFO ?? "",
    origin: r.ORPLC_INFO ?? "",
  }));

  const html = `
    <div class="table">
      ${items
        .map(
          (it) => `
          <div class="row">
            <div class="cell-key">${escapeHtml(it.name)}</div>
            <div class="cell-val">
              <div>${safeMealHtml(it.dishes) || "—"}</div>
              ${
                it.cal || it.ntr
                  ? `<div class="muted" style="margin-top:8px">
                      ${escapeHtml(it.cal)}
                    </div>`
                  : ""
              }
            </div>
          </div>
        `,
        )
        .join("")}
    </div>
  `;
  mealEl.innerHTML = html;
}

function setResultMeta() {
  const type = schoolTypeSelect.value;
  const meta = SCHOOL_TYPE_META[type];
  const date = dateInput.value;
  const grade = gradeSelect.value;
  const cls = classInput.value || "—";
  const schoolName = selectedSchool?.SCHUL_NM ?? "(학교 미선택)";
  const region = REGION_OPTIONS.find((r) => r.code === regionSelect.value)?.label ?? "";

  resultMeta.textContent = `${region} · ${meta.label} · ${schoolName} · ${grade}학년 ${cls}반 · ${date || "날짜 미선택"}`;
}

// ---------- Favorites ----------
function favoriteKey(fav) {
  return `${fav.regionCode}|${fav.schoolCode}|${fav.type}|${fav.grade}|${fav.classNm}`;
}

function renderFavorites() {
  const favs = favoritesCache;
  if (!currentUser) {
    favoriteList.classList.add("empty");
    favoriteList.innerHTML = `<div class="muted">즐겨찾기는 로그인 후 이용하실 수 있습니다.</div>`;
    return;
  }
  if (!favs.length) {
    favoriteList.classList.add("empty");
    favoriteList.innerHTML = `<div class="muted">아직 저장된 즐겨찾기가 없습니다.</div>`;
    return;
  }
  favoriteList.classList.remove("empty");

  favoriteList.innerHTML = favs
    .map((f, idx) => {
      const regionLabel = REGION_OPTIONS.find((r) => r.code === f.regionCode)?.label ?? f.regionCode;
      const typeLabel = SCHOOL_TYPE_META[f.type]?.label ?? f.type;
      return `
        <div class="fav">
          <div class="fav__title">${escapeHtml(f.schoolName)}</div>
          <div class="fav__meta">${escapeHtml(regionLabel)} · ${escapeHtml(typeLabel)} · ${escapeHtml(
            `${f.grade}학년 ${f.classNm}반`,
          )}</div>
          <div class="fav__actions">
            <button class="btn btn--primary" type="button" data-action="apply" data-idx="${idx}">불러오기</button>
            <button class="btn btn--danger" type="button" data-action="remove" data-idx="${idx}">삭제</button>
          </div>
        </div>
      `;
    })
    .join("");
}

async function addFavorite() {
  if (!currentUser) {
    alert("즐겨찾기는 로그인 후 이용해주세요.");
    openAuthModal();
    return;
  }
  if (!selectedSchool) {
    alert("먼저 학교를 선택해주세요.");
    return;
  }
  const classNm = String(classInput.value || "").trim();
  if (!/^\d+$/.test(classNm)) {
    alert("반은 숫자로 입력해주세요. (예: 1)");
    return;
  }
  const fav = {
    regionCode: regionSelect.value,
    type: schoolTypeSelect.value,
    schoolCode: selectedSchool.SD_SCHUL_CODE,
    schoolName: selectedSchool.SCHUL_NM,
    grade: gradeSelect.value,
    classNm,
  };
  favoritesCache = uniqBy([fav, ...favoritesCache], favoriteKey).slice(0, 20);
  await saveFavoritesForUser();
  renderFavorites();
  setStatus("즐겨찾기에 저장했습니다.", { type: "info", show: true });
}

function applyFavorite(fav) {
  regionSelect.value = fav.regionCode;
  schoolTypeSelect.value = fav.type;
  renderGradesAndClasses();
  gradeSelect.value = fav.grade;
  classInput.value = fav.classNm;

  // 선택된 학교 세팅 (검색 없이 바로)
  selectedSchool = {
    ATPT_OFCDC_SC_CODE: fav.regionCode,
    SD_SCHUL_CODE: fav.schoolCode,
    SCHUL_NM: fav.schoolName,
    SCHUL_KND_SC_NM: SCHOOL_TYPE_META[fav.type]?.label ?? "",
  };

  // 결과 셀렉트에도 표시(임시 1개 옵션)
  setOptions(
    schoolResultSelect,
    [{ value: fav.schoolCode, label: `${fav.schoolName} (즐겨찾기)` }],
    { placeholder: "선택됨" },
  );
  schoolResultSelect.value = fav.schoolCode;

  setResultMeta();
  setStatus("즐겨찾기를 불러왔습니다. 날짜를 선택한 뒤 '불러오기'를 눌러주세요.", { type: "info", show: true });
}

async function removeFavorite(idx) {
  if (!currentUser) return;
  favoritesCache.splice(idx, 1);
  await saveFavoritesForUser();
  renderFavorites();
}

async function clearFavorites() {
  if (!currentUser) return;
  favoritesCache = [];
  await saveFavoritesForUser();
  renderFavorites();
}

// ---------- Theme ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  btnTheme.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  btnTheme.textContent = theme === "dark" ? "라이트모드" : "다크모드";
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
    return;
  }
  // 기본은 OS 선호를 따름
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function toggleTheme() {
  const cur = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const next = cur === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(STORAGE_KEYS.theme, next);
}

// ---------- School search / selection ----------
function filterSchoolsByType(rows, type) {
  const targetLabel = SCHOOL_TYPE_META[type]?.label;
  if (!targetLabel) return rows;

  // SCHUL_KND_SC_NM은 "초등학교/중학교/고등학교"로 오는 경우가 많음
  return rows.filter((r) => {
    const k = String(r.SCHUL_KND_SC_NM ?? "");
    return k.includes(targetLabel);
  });
}

async function handleSchoolSearch() {
  const regionCode = regionSelect.value;
  const q = schoolNameInput.value.trim();
  if (!q) {
    alert("학교명을 입력해주세요.");
    return;
  }

  setStatus("학교를 검색 중입니다...", { show: true });
  setOptions(schoolResultSelect, [], { placeholder: "검색 중..." });
  selectedSchool = null;
  setResultMeta();

  try {
    const rows = await searchSchools({ regionCode, query: q });
    const filtered = filterSchoolsByType(rows, schoolTypeSelect.value);

    if (!filtered.length) {
      setOptions(schoolResultSelect, [], { placeholder: "검색 결과 없음" });
      setStatus("검색 결과가 없습니다. 지역/학교명을 다시 확인해주세요.", { type: "info", show: true });
      return;
    }

    // 같은 이름 다수 학교 대비: 주소/설립/분교 등 표시(가능한 필드가 있으면)
    const opts = filtered.slice(0, 80).map((r) => {
      const addr = r.ORG_RDNMA ?? r.ORG_RDNDA ?? r.ORG_TELNO ?? "";
      const label = addr ? `${r.SCHUL_NM} · ${addr}` : `${r.SCHUL_NM}`;
      return { value: r.SD_SCHUL_CODE, label };
    });
    setOptions(schoolResultSelect, opts, { placeholder: "학교를 선택해주세요." });
    setStatus(`검색 완료: ${filtered.length}개`, { type: "info", show: true });
  } catch (e) {
    setOptions(schoolResultSelect, [], { placeholder: "검색 실패" });
    setStatus(`학교 검색 실패: ${e.message}`, { type: "error", show: true });
  }
}

function handleSchoolSelect() {
  const code = schoolResultSelect.value;
  if (!code) {
    selectedSchool = null;
    setResultMeta();
    return;
  }

  const label = schoolResultSelect.options[schoolResultSelect.selectedIndex]?.textContent ?? "";
  selectedSchool = {
    ATPT_OFCDC_SC_CODE: regionSelect.value,
    SD_SCHUL_CODE: code,
    SCHUL_NM: (label.split(" · ")[0] || label).trim(),
    SCHUL_KND_SC_NM: SCHOOL_TYPE_META[schoolTypeSelect.value]?.label ?? "",
  };
  setResultMeta();
}

// ---------- Load results ----------
async function loadAll() {
  if (!selectedSchool) {
    alert("학교를 먼저 선택해주세요.");
    return;
  }
  if (!dateInput.value) {
    alert("날짜를 선택해주세요.");
    return;
  }

  const type = schoolTypeSelect.value;
  const regionCode = regionSelect.value;
  const schoolCode = selectedSchool.SD_SCHUL_CODE;
  const ymd = ymdFromDateInput(dateInput.value);
  const grade = gradeSelect.value;
  const classNm = String(classInput.value || "").trim();
  if (!/^\d+$/.test(classNm)) {
    alert("반은 숫자로 입력해주세요. (예: 1)");
    return;
  }

  setResultMeta();
  setStatus("시간표/급식을 불러오는 중입니다...", { show: true });
  timetableEl.innerHTML = `<div class="muted">불러오는 중...</div>`;
  mealEl.innerHTML = `<div class="muted">불러오는 중...</div>`;
  mealDetails.open = false;

  try {
    const [tRows, mRows] = await Promise.all([
      fetchTimetable({ type, regionCode, schoolCode, ymd, grade, classNm }),
      fetchMeal({ regionCode, schoolCode, ymd }),
    ]);

    renderTimetable(tRows);
    renderMeal(mRows);

    setStatus("완료되었습니다. 시간표가 먼저 표시되고, 급식은 아래에서 펼쳐 확인할 수 있습니다.", {
      type: "info",
      show: true,
    });
  } catch (e) {
    timetableEl.innerHTML = `<div class="muted">불러오기 실패</div>`;
    mealEl.innerHTML = `<div class="muted">불러오기 실패</div>`;
    setStatus(`불러오기 실패: ${e.message}`, { type: "error", show: true });
  }
}

// ---------- Init ----------
function initRegionOptions() {
  setOptions(
    regionSelect,
    REGION_OPTIONS.map((r) => ({ value: r.code, label: r.label })),
  );
  regionSelect.value = "B10";
}

function initDate() {
  dateInput.value = todayISO();
}

function wireEvents() {
  schoolTypeSelect.addEventListener("change", () => {
    renderGradesAndClasses();
    selectedSchool = null;
    setOptions(schoolResultSelect, [], { placeholder: "학교를 다시 검색/선택해주세요." });
    setResultMeta();
  });

  btnSearchSchool.addEventListener("click", handleSchoolSearch);
  schoolNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSchoolSearch();
  });

  schoolResultSelect.addEventListener("change", handleSchoolSelect);
  gradeSelect.addEventListener("change", setResultMeta);
  classInput.addEventListener("input", setResultMeta);
  dateInput.addEventListener("change", setResultMeta);
  regionSelect.addEventListener("change", () => {
    selectedSchool = null;
    setOptions(schoolResultSelect, [], { placeholder: "지역이 변경되었습니다. 학교를 다시 검색해주세요." });
    setResultMeta();
  });

  btnLoad.addEventListener("click", loadAll);
  btnFavorite.addEventListener("click", addFavorite);
  btnClearFavorites.addEventListener("click", () => {
    if (!currentUser) {
      alert("즐겨찾기는 로그인 후 이용해주세요.");
      openAuthModal();
      return;
    }
    if (confirm("즐겨찾기를 모두 삭제하시겠습니까?")) clearFavorites();
  });

  favoriteList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = Number(btn.dataset.idx);
    const fav = favoritesCache[idx];
    if (!fav) return;

    if (action === "apply") applyFavorite(fav);
    if (action === "remove") removeFavorite(idx);
  });

  btnToday.addEventListener("click", () => {
    dateInput.value = todayISO();
    setResultMeta();
  });
  btnTheme.addEventListener("click", toggleTheme);

  // auth modal open/close
  btnAuthOpen.addEventListener("click", openAuthModal);
  btnAuthClose.addEventListener("click", closeAuthModal);
  authModal.addEventListener("click", (e) => {
    const close = e.target?.closest?.("[data-close]");
    if (close) closeAuthModal();
  });

  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("tab--active");
    tabSignup.classList.remove("tab--active");
    formLogin.hidden = false;
    formSignup.hidden = true;
    setAuthMessage("");
  });
  tabSignup.addEventListener("click", () => {
    tabSignup.classList.add("tab--active");
    tabLogin.classList.remove("tab--active");
    formLogin.hidden = true;
    formSignup.hidden = false;
    setAuthMessage("");
  });

  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAuthMessage("로그인 중입니다...");
    const { email, label } = normalizeLoginId(loginId.value);
    const pw = String(loginPw.value || "");
    if (!email || !pw) {
      setAuthMessage("아이디/비밀번호를 입력해주세요.");
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      currentUserIdLabel = label;
      localStorage.setItem(STORAGE_KEYS.lastLoginId, loginId.value.trim());
      setAuthMessage("로그인되었습니다.");
      closeAuthModal();
    } catch (err) {
      setAuthMessage(`로그인 실패: ${err?.message || err}`);
    }
  });

  formSignup.addEventListener("submit", async (e) => {
    e.preventDefault();
    setAuthMessage("회원가입 중입니다...");
    const { email, label } = normalizeLoginId(signupId.value);
    const pw = String(signupPw.value || "");
    if (!email || !pw) {
      setAuthMessage("아이디/비밀번호를 입력해주세요.");
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, pw);
      currentUserIdLabel = label;
      localStorage.setItem(STORAGE_KEYS.lastLoginId, signupId.value.trim());
      setAuthMessage("회원가입이 완료되었습니다.");
      closeAuthModal();
    } catch (err) {
      setAuthMessage(`회원가입 실패: ${err?.message || err}`);
    }
  });

  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
  });
}

function boot() {
  initTheme();
  initRegionOptions();
  renderGradesAndClasses();
  initDate();
  setResultMeta();
  wireEvents();
  setStatus("준비되었습니다. 지역/유형/학교명으로 검색한 뒤 날짜를 선택해주세요.", { show: true });

  setAuthUiState();
  onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    // 로그인 표시는 사용자가 입력한 아이디(label) 우선, 없으면 uid 일부
    if (currentUser && !currentUserIdLabel) currentUserIdLabel = `사용자(${currentUser.uid.slice(0, 6)})`;
    if (!currentUser) currentUserIdLabel = "";
    setAuthUiState();
    await loadFavoritesForUser(currentUser);
  });
}

boot();

