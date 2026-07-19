// ============================================================
// 明治大学 Oh-o! Meiji 公開シラバス クローラー
// 로드맵 Phase 1c. 출력은 src/types/course.ts의 Course 타입을 따름.
//
// 사용법:
//   node crawl-syllabus.mjs --category 12 --nendo 2026 --semester 10 [--max-pages N] [--details]
//
//   --details : 각 과목의 시라버스 상세페이지(/syllabus/syllabusView)를 방문해
//               credits(単位数)를 채운다. 과목당 1회 요청이 추가되므로 오래 걸림.
//               (sourceUrl은 상세 방문 없이 리스트에서 추출됨)
//
// 출력: scripts/output/courses-{category}-{nendo}-{semester}.json  (Course[])
//
// ⚠️ 서버 예의: 요청 간 딜레이 + 재시도 백오프 준수. 대량 실행은 저속으로.
// ⚠️ 이 스크립트는 로컬 JSON까지만 생성. Firestore 적재는 후속(load-firestore.mjs).
// ============================================================

import { parse } from "node-html-parser";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 설정 ─────────────────────────────────────────────────
const BASE = "https://www.oh-o.meiji.ac.jp";
const SEARCH_PAGE = `${BASE}/syllabus/search?langCd=ja`;
const EXECUTE = `${BASE}/syllabus/search/execute`;
const PER_PAGE = 50;         // 페이지당 과목 수(사이트 고정)
const DELAY_MS = 1500;       // 요청 간 딜레이(예의)
const MAX_RETRY = 3;         // 실패 시 재시도 횟수
const USER_AGENT =
  "ichi-syllabus-crawler/1.0 (Meiji student community app; contact: ddongpig123@gmail.com)";

// Course 타입에 맞춘 값들
const VALID_DAYS = ["月", "火", "水", "木", "金", "土"];   // Day
const VALID_PERIODS = [1, 2, 3, 4, 5, 6, 7];               // Period

// 학부 코드(category) 참고표 — README에도 있음
const FACULTY_LABELS = {
  "11": "法学部", "12": "商学部", "13": "政治経済学部", "14": "文学部",
  "15": "理工学部", "16": "農学部", "17": "経営学部", "18": "情報コミュニケーション学部",
  "19": "国際日本学部", "26": "総合数理学部",
};

// ── 유틸 ─────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 전각공백·연속공백 정규화
function clean(s) {
  return (s ?? "").replace(/　/g, " ").replace(/\s+/g, " ").trim();
}

// "月 1" → { day: "月", period: 1 } / 파싱 불가(집중강의 등)면 null
function parseDayPeriod(raw) {
  const t = clean(raw);
  const m = t.match(/([月火水木金土])\s*([1-7])/);
  if (!m) return null;
  const day = m[1];
  const period = Number(m[2]);
  if (!VALID_DAYS.includes(day) || !VALID_PERIODS.includes(period)) return null;
  return { day, period };
}

// section 값 → Course.Semester[] (복수 반환)
// 실제 사이트 값 예: "春" / "秋" / "春後"(春학기 후반) / "通年集中" / "通年"
// 通年(1년 내내)은 Course.Semester("春"|"秋")로 표현 불가 → 春·秋 양쪽에 등록한다.
// (2026-07 결정 B안. 실제로 通年 수업은 두 학기 모두 나가므로 시간표상으로도 맞음)
function parseSemesters(raw) {
  const t = clean(raw);
  if (t.includes("通年")) return ["春", "秋"];
  const out = [];
  if (t.includes("春")) out.push("春");
  if (t.includes("秋")) out.push("秋");
  return out.length ? out : null;
}

// 총건수 파싱 → 페이지 수.
// 주의: HTML에 "検索結果が1000件を超えるため…" 안내문이 먼저 나오므로
// 단순 "N件" 매칭은 안 됨. "N件 が該当" / "N件 中" 표기를 총건수로 사용.
function parseTotalPages(html) {
  const m = html.match(/([\d,]+)\s*件\s*(?:が該当|中)/);
  if (!m) return null;
  const total = Number(m[1].replace(/,/g, ""));
  // "1000건 초과" 안내문이 뜨지만 실측 결과 페이지네이션은 전건 접근 가능
  // (2026-07 검증: 商学部 1376건, page 21·28 정상 반환). 안내용으로만 표시.
  const capped = /検索結果が\s*1000\s*件を超える/.test(html);
  return { total, pages: Math.max(1, Math.ceil(total / PER_PAGE)), capped };
}

// ── HTTP ─────────────────────────────────────────────────
function buildUrl(category, nendo, semester, page) {
  const params = new URLSearchParams({
    page: String(page),
    unloginFlag: "1",
    langCd: "ja",
    category,
    nendo: String(nendo),
    semester: String(semester),
    yobiType: "", jigenCd: "", campus: "", kogiName: "", teacherName: "",
    freeWord: "", shusai: "", gbndai: "", level: "", jukei: "", kLang: "",
    searchFlag: "1", clickSearchBtn: "1",
  });
  return `${EXECUTE}?${params.toString()}`;
}

async function fetchText(url, cookie) {
  const headers = { "User-Agent": USER_AGENT, "Accept-Language": "ja" };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return { html: await res.text(), setCookie: res.headers.get("set-cookie") };
}

async function fetchWithRetry(url, cookie) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      return await fetchText(url, cookie);
    } catch (e) {
      lastErr = e;
      const backoff = DELAY_MS * attempt * attempt; // 지수 백오프
      console.warn(`  ⚠️ 시도 ${attempt}/${MAX_RETRY} 실패: ${e.message} → ${backoff}ms 후 재시도`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

// ── 파싱 ─────────────────────────────────────────────────
// idCount는 페이지 간 유지되어야 하므로(전역 유니크 id) 호출자가 넘겨준다
function parseCourses(html, { nendo, idCount }) {
  const root = parse(html);
  const items = root.querySelectorAll(".result-list");
  const courses = [];
  const skipped = [];

  for (const el of items) {
    const name = clean(el.querySelector(".syllabus-search-result-course-name")?.text);
    const teacher = clean(el.querySelector(".syllabus-search-result-teacher-name")?.text);
    const dayRaw = el.querySelector(".syllabus-search-result-day-of-week")?.text;
    const campus = clean(el.querySelector(".syllabus-search-result-campus")?.text) || null;
    const courseNumber = clean(el.querySelector(".syllabus-search-result-kamokunum")?.text) || null;
    const semesters = parseSemesters(el.querySelector(".syllabus-search-result-section")?.text);
    // 상세 URL: <a data="/syllabus/syllabusView?syllabusYear=...&kougicd=..."> 속성에서 추출
    const detailPath = el.querySelector("a.link-txt")?.getAttribute("data") ?? null;
    const sourceUrl = detailPath ? BASE + detailPath.replace(/&amp;/g, "&") : null;

    const dp = parseDayPeriod(dayRaw);
    if (!name || !dp || !semesters) {
      skipped.push({ name, dayRaw: clean(dayRaw), reason: !dp ? "요일/교시 파싱불가" : !semesters ? "학기 파싱불가" : "이름 없음" });
      continue;
    }

    // 通年이면 春·秋 두 건으로 등록된다
    for (const semester of semesters) {
      // id에 semester 포함 — 春/秋를 같은 Firestore 컬렉션에 적재해도 충돌하지 않도록
      const baseId = `${courseNumber ?? name}-${semester}-${dp.day}${dp.period}`
        .replace(/[^\w가-힣ぁ-んァ-ヶ一-龯]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const seen = (idCount.get(baseId) ?? 0) + 1;
      idCount.set(baseId, seen);
      const id = seen === 1 ? baseId : `${baseId}-${seen}`;

      // Course 타입 (src/types/course.ts)
      courses.push({
        id,
        name,
        teacher,
        day: dp.day,
        period: dp.period,
        semester,
        year: Number(nendo),
        campus,
        courseNumber,
        credits: null,      // --details 옵션 시 상세페이지에서 채움
        sourceUrl,          // 시라버스 상세페이지 URL (리스트에서 추출)
        addedBy: "official",
        verified: true,
        confirmCount: 0,
        createdAt: Date.now(),
      });
    }
  }

  return { courses, skipped };
}

// 상세페이지 HTML에서 単位数 파싱.
// 구조: <span>単位数</span> 라벨 컬럼 → 다음 값 컬럼 <div>2</div>
function parseCredits(html) {
  const m = html.match(/単位数<\/span>[\s\S]{0,400}?<div>\s*([\d.]+)\s*<\/div>/);
  return m ? Number(m[1]) : null;
}

// --details: 상세페이지 방문해 credits 채우기.
// 通年 과목은 春·秋 두 건으로 복제되어 sourceUrl이 같으므로 URL 단위로 1회만 요청한다.
async function fillCredits(courses, cookie) {
  const byUrl = new Map(); // sourceUrl → 같은 URL을 쓰는 과목들
  for (const c of courses) {
    if (!c.sourceUrl) continue;
    if (!byUrl.has(c.sourceUrl)) byUrl.set(c.sourceUrl, []);
    byUrl.get(c.sourceUrl).push(c);
  }
  const urls = [...byUrl.keys()];
  console.log(`\n📄 상세 크롤 시작: ${urls.length}건 (${courses.length}과목, 예상 ${Math.round((urls.length * DELAY_MS) / 60000)}분)`);
  let filled = 0, failed = 0;
  for (let i = 0; i < urls.length; i++) {
    await sleep(DELAY_MS);
    try {
      const { html } = await fetchWithRetry(urls[i], cookie);
      const credits = parseCredits(html);
      if (credits !== null) {
        for (const c of byUrl.get(urls[i])) c.credits = credits;
        filled++;
      } else failed++;
    } catch {
      failed++;
    }
    if ((i + 1) % 25 === 0 || i + 1 === urls.length) {
      console.log(`   상세 ${i + 1}/${urls.length} (credits 채움 ${filled}, 실패 ${failed})`);
    }
  }
  return { filled, failed };
}

// ── CLI 파싱 ─────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    // 값이 없는 플래그(--details 등)는 true
    args[key] = next && !next.startsWith("--") ? next : true;
  }
  return args;
}

// ── 메인 ─────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const category = args.category ?? "12";
  const nendo = args.nendo ?? "2026";
  const semester = args.semester ?? "10"; // 10=春 20=秋 00=전체
  const maxPages = args["max-pages"] ? Number(args["max-pages"]) : Infinity;

  const semLabel = { "10": "春", "20": "秋", "00": "全" }[semester] ?? semester;
  console.log(`\n📚 크롤 시작: ${FACULTY_LABELS[category] ?? category} / ${nendo}년 / ${semLabel}학기`);

  // 세션 쿠키가 필요할 수 있으므로 검색 페이지 1회 선방문(fallback 대비)
  let cookie = null;
  try {
    const seed = await fetchText(SEARCH_PAGE);
    if (seed.setCookie) cookie = seed.setCookie.split(";")[0];
  } catch { /* 쿠키 없어도 대부분 동작 */ }
  await sleep(DELAY_MS);

  // 1페이지로 총 페이지 수 파악
  const first = await fetchWithRetry(buildUrl(category, nendo, semester, 1), cookie);
  const totalInfo = parseTotalPages(first.html);
  const lastPage = Math.min(totalInfo?.pages ?? 1, maxPages);
  console.log(`   총 ${totalInfo?.total ?? "?"}건 → ${totalInfo?.pages ?? "?"}페이지 (이번 실행: ${lastPage}페이지)`);
  if (totalInfo?.capped) {
    console.log(`   ℹ️ "1000건 초과" 안내문 있음 — 실측상 전 페이지 접근 가능 (표시 제한 없음)`);
  }

  const all = [];
  const allSkipped = [];
  const idCount = new Map(); // 전 페이지 공유 → id 전역 유니크 보장

  // 1페이지는 이미 받았으니 재사용
  for (let page = 1; page <= lastPage; page++) {
    let html;
    if (page === 1) {
      html = first.html;
    } else {
      await sleep(DELAY_MS);
      const res = await fetchWithRetry(buildUrl(category, nendo, semester, page), cookie);
      html = res.html;
    }
    const { courses, skipped } = parseCourses(html, { nendo, idCount });
    all.push(...courses);
    allSkipped.push(...skipped);
    console.log(`   page ${page}/${lastPage}: ${courses.length}과목 수집${skipped.length ? ` (${skipped.length} 스킵)` : ""}`);
  }

  // 저장 (상세 크롤 전에 1차 저장 — 중간 실패해도 리스트 데이터는 보존)
  const outDir = join(__dirname, "output");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `courses-${category}-${nendo}-${semester}.json`);
  await writeFile(outPath, JSON.stringify(all, null, 2), "utf-8");

  // --details: 상세페이지에서 credits 채우고 재저장
  if (args.details) {
    const { filled, failed } = await fillCredits(all, cookie);
    await writeFile(outPath, JSON.stringify(all, null, 2), "utf-8");
    console.log(`   credits: ${filled} 채움 / ${failed} 실패`);
  }

  console.log(`\n✅ 완료: ${all.length}과목 → ${outPath}`);
  if (allSkipped.length) {
    console.log(`⏭️  스킵 ${allSkipped.length}건 (요일/교시·학기 없는 집중강의 등):`);
    for (const s of allSkipped.slice(0, 10)) console.log(`   - "${s.name}" [${s.dayRaw}] ${s.reason}`);
    if (allSkipped.length > 10) console.log(`   ... 외 ${allSkipped.length - 10}건`);
  }
}

main().catch((e) => {
  console.error("❌ 크롤 실패:", e);
  process.exit(1);
});
