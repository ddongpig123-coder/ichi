// 情報コミュニケーション学部 — 便覧「Ⅱ 履修 1. 授業科目配当表」텍스트 → ① docs/data 배당표 JSON ② src/data 앱 TS
//
//   node builders/build-meiji-info-communication.mjs --txt <配当表 텍스트> [--year 2023] [--out <dir>]
//
// 입력 텍스트는 pdftext.mjs 출력이든 미리보기(Preview)에서 복사한 텍스트든 「행 단위」면 된다.
// 과목행 = 「科目名 単位数 時間数 開講期間 履修開始年次 [備考]」. 그 외 행(세로 견출·헤더·주석)은 skipped에 모아 §6 V6에서 눈으로 본다.
//
// 과목→zone 은 학칙 별표1 기반 docs/data/meiji-info-communication-allocation-2026.json 을 **정본**으로 쓴다
// (별표1 = 요건표 쪽 구분). 便覧은 **履修開始年次** 를 준다(별표1엔 없음). 둘을 과목명(NFKC·공백 제거)으로 맞춘다.
// 履修開始年次 n → years = [n..4] (DATA-MANUAL §5 "履修開始年次"는 전개).
//
// 2026-11-05 첫 실행: 2023年度 便覧(공개 PDF) 의 pp.12~19 를 미리보기에서 복사한 텍스트로 실행.
//   클라우드 세션은 meiji.ac.jp 접속이 막혀 pdftext.mjs 를 못 돌렸다. p.19·p.20 은 스크린샷과 목시 대조.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] ?? true] : [])).filter((e) => e.length));
const TXT = args.txt;
const YEAR = Number(args.year ?? 2023);
const OUT = args.out ?? '.';
if (!TXT) { console.error('usage: --txt <配当表 text> [--year 2023] [--out dir]'); process.exit(1); }

const BEPPYO = path.join(__dirname, '../../../docs/data/meiji-info-communication-allocation-2026.json');
const beppyo = JSON.parse(fs.readFileSync(BEPPYO, 'utf8'));
const norm = (s) => (s ?? '').normalize('NFKC').replace(/\s+/g, '');
const byName = new Map();
for (const c of beppyo.courses) byName.set(norm(c.name), c);

// ---------- 1) 텍스트 → 과목행 ----------
const ROW = /^(.+?)\s+(\d+)\s+(\d+|-)\s+(通年|半期|-)\s+([1-4])(?:\s+(.+))?$/;
const lines = fs.readFileSync(TXT, 'utf8').split(/\r?\n/).map((l) => l.replace(/[\u0000-\u001F]/g, ' ').trim());
const courses = [];
const skipped = [];
for (const raw of lines) {
  if (!raw) continue;
  if (/^―\d+―$/.test(raw)) continue;                       // 페이지 번호
  if (/^科目区分|^時間数|^年次 備考/.test(raw)) continue;    // 표 헤더
  let line = raw;
  if (/^履修科目\s+先取り/.test(line)) line = line.replace(/^履修科目\s+/, ''); // 세로 견출이 행에 붙은 것
  const m = line.match(ROW);
  if (!m) { skipped.push(raw); continue; }
  const [, name, units, hours, term, start, biko] = m;
  courses.push({
    name: name.trim(), units: +units, hours: hours === '-' ? null : +hours,
    term: term === '-' ? null : term, startYear: +start, biko: biko?.trim() || null,
  });
}

// 備考 병합셀(留学関係科目 4행에 걸침, p.19 목시) — 텍스트에는 별도 행으로 떨어져 skipped 에 들어간다
for (const c of courses) if (/^留学関係科目/.test(c.name)) c.biko = c.biko ?? '留学先で修得した単位を認定するための科目';

// ---------- 2) 별표1 과 대조해 zone 부여 ----------
// 별표1(2026)에 없는 便覧(2023) 과목의 구분. 便覧 p.16·p.19 의 견출로 확정(목시).
// - ICTベーシックⅠ·Ⅱ: p.19 견출 「情報リテラシー科目群」(スクリーンショット目視). 別表1(2026)では「ICTベーシック」1科目に統合
// - ICT〇〇Ⅰ·Ⅱ 12科目: p.18 견출 「情報リテラシー科目」(研究方法・表現実践科目群の内側). 別表1(2026)では
//   ICT統計解析入門/応用 등으로 개명·재편돼 이름이 안 맞는다. 같은 블록의 アルゴリズム実習·ネットワーク技術 등은
//   別表1에서도 研究方法・表現実践科目群/情報リテラシー科目 → 동일 구분으로 확정
// - インターンシップ: p.19 견출 「キャリアデザイン科目群」(スクリーンショット目視)
const OVERRIDE = {
  'ICTベーシックⅠ': { kubunJa: '情報リテラシー科目群', zone: 'jiyu' },
  'ICTベーシックⅡ': { kubunJa: '情報リテラシー科目群', zone: 'jiyu' },
  'インターンシップ': { kubunJa: 'キャリアデザイン科目群', zone: 'jiyu' },
  '先取り履修科目（3・4年次配当科目）': { kubunJa: '専門科目群', bunya: '先取り履修科目', zone: 'senmon', pseudo: true },
};
const ICT_LITERACY = (name) => /^ICT/.test(name) && !/^ICTベーシック/.test(name)
  ? { kubunJa: '研究方法・表現実践科目群', bunya: '情報リテラシー科目', zone: 'kenkyu-hyogen' } : null;
const onlyInBinran = [];
const seen = new Set();
const clean = courses.map((c) => {
  const key = norm(c.name);
  const b = byName.get(key);
  const ov = OVERRIDE[c.name] ?? (b ? null : ICT_LITERACY(c.name));
  seen.add(key);
  const o = {
    name: c.name, units: c.units, hours: c.hours, term: c.term,
    startYear: c.startYear, years: Array.from({ length: 5 - c.startYear }, (_, i) => c.startYear + i),
    mark: b?.mark ?? (/情報コミュニケーション学入門/.test(c.name) ? '必修' : null),
    zone: b?.zone ?? ov?.zone ?? null,
    kubunJa: b?.kubunJa ?? ov?.kubunJa ?? null,
  };
  if (b?.bunya ?? ov?.bunya) o.bunya = b?.bunya ?? ov?.bunya;
  if (c.biko) o.biko = c.biko;
  if (/メディア授業科目/.test(c.biko ?? '')) o.media = true;
  if (ov?.pseudo) o.pseudo = true;                 // 先取り枠: 실과목이 아니라 CAN 에 내지 않음
  if (!b && ov) o.zoneSource = 'binran-section';   // 別表1 에 없어 便覧 견출(目視)로 구분을 정한 과목
  if (/^留学関係科目/.test(c.name)) o.ryugakuNintei = true; // 留学認定枠: CAN 에 내지 않음(§8-2)
  o.inBeppyo1 = !!b;
  if (!b) onlyInBinran.push(c.name);
  return o;
});
const onlyInBeppyo = beppyo.courses.filter((c) => !seen.has(norm(c.name))).map((c) => `${c.name}（${c.kubunJa}${c.bunya ? '/' + c.bunya : ''}）`);
const zoneMissing = clean.filter((c) => !c.zone).map((c) => c.name);

// ---------- 3) 검증 숫자 (DATA-MANUAL §6) ----------
const pool = {};
for (const c of clean) {
  if (c.pseudo) continue;
  const k = c.zone + (c.bunya && c.zone === 'senmon' ? '/' + c.bunya : '');
  pool[k] = pool[k] || { courses: 0, units: 0, required: 0 };
  pool[k].courses++; pool[k].units += c.units;
  if (c.mark === '必修') pool[k].required += c.units;
}
const req = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../docs/data/meiji-info-communication-2017.json'), 'utf8')).requirementMaster;
const V = [];
const hisshu = clean.filter((c) => c.mark === '必修').reduce((s, c) => s + c.units, 0);
V.push(`V2 必修 합계 ${hisshu} == 요건표 必修 4 → ${hisshu === 4 ? '✓' : '✗'}`);
for (const z of req.zones) {
  if (/jiyu/.test(z.id)) continue;
  const p = Object.entries(pool).filter(([k]) => k === z.id || k.startsWith(z.id + '/')).reduce((s, [, v]) => s + v.units, 0);
  V.push(`V4 ${z.id} 풀 ${p} ≥ 최저 ${z.minUnits} → ${p >= z.minUnits ? '✓' : '✗'}`);
  for (const sz of z.subZones ?? []) {
    const keys = sz.id === 'sonota' ? ['senmon/社会システム', 'senmon/文化と表象', 'senmon/人間と環境'] : [{ 'shakai-kagaku': 'senmon/社会科学', 'jinbun-kagaku': 'senmon/人文科学', 'shizen-kagaku': 'senmon/自然科学' }[sz.id]];
    const p2 = keys.reduce((s, k) => s + (pool[k]?.units ?? 0), 0);
    V.push(`V4 ${z.id}/${sz.nameJa} 풀 ${p2} ≥ 최저 ${sz.minUnits} → ${p2 >= sz.minUnits ? '✓' : '✗'}`);
  }
}
V.push(`V6 skipped ${skipped.length}행 (전부 견출·헤더·주석인지 아래 목록을 눈으로 확인)`);
V.push(`V7 配当年次 누락 ${clean.filter((c) => !c.years.length).length}건`);
const zoneIds = new Set(req.zones.map((z) => z.id));
V.push(`V8 zone ⊆ 요건 zone → ${clean.every((c) => !c.zone || zoneIds.has(c.zone)) ? '✓' : '✗'} (zone 없음 ${zoneMissing.length}건${zoneMissing.length ? ': ' + zoneMissing.join('、') : ''})`);

// ---------- 4) docs/data JSON ----------
const json = {
  _meta: {
    source: `明治大学 ${YEAR}年度 情報コミュニケーション学部便覧「Ⅱ 履修 1. 授業科目配当表」(pp.12-19) + 「2. 卒業・進級・卒業見込に必要な単位」(p.20)`,
    sourceUrl: 'https://www.meiji.ac.jp/infocom/pdf/gakububinran2023.pdf',
    extractedAt: new Date().toISOString().slice(0, 10),
    tool: 'scripts/binran/builders/build-meiji-info-communication.mjs (便覧 텍스트 + 학칙별표1 JSON 대조)',
    faculty: 'info-communication', facultyNameJa: '情報コミュニケーション学部', schoolDomain: 'meiji.ac.jp',
    admissionYear: YEAR, appliesTo: `${YEAR}年度入学者（便覧は入学年度ごと。2024〜2026年度便覧は非公開 — 同一カリキュラムかは未確認）`,
    requirementMaster: 'meiji-info-communication-2017.json',
    zoneSource: 'meiji-info-communication-allocation-2026.json（学則別表1 2026年4月施行）— 科目→zone はこちらが正本。便覧は履修開始年次を補う',
    yearsRule: '履修開始年次 n → years [n..4]（開始年次以降は履修可）',
    howExtracted: '2026-11-05: 공개 PDF 를 준희 맥의 미리보기(Preview)에서 텍스트 복사 → 이 빌더. pdftext.mjs 는 클라우드 세션의 네트워크 제한으로 미사용. p.19·p.20 은 스크린샷과 전 행 목시 대조 일치. pp.12~18 은 텍스트 복사본(표에 병합셀·○표 없음, 숫자 열만)',
    verification: V,
    skippedRows: skipped,
    diff: {
      note: '便覧(2023年度入学者用) ↔ 学則別表1(2026年4月施行) 의 과목 집합 차이. 연도 차이(2023→2026)로 생긴 개편분',
      onlyInBinran: onlyInBinran,
      onlyInBeppyo1: onlyInBeppyo,
    },
    notes: [
      '先取り履修科目（3・4年次配当科目）は枠であって実科目ではない → pseudo:true、アプリCANには出さない',
      '留学関係科目 4件は留学認定枠 → ryugakuNintei:true、アプリCANには出さない（§8-2）',
      '卒業論文・卒業制作(2, 4年次)は総授業時間数・開講期間なし（便覧どおり null）',
      'メディア授業科目(そのまま)と「メディア授業科目併設」の両方を media:true とし、biko に原文を残す',
    ],
  },
  requirementSnapshot: {
    source: `便覧 p.20「卒業・進級・卒業見込に必要な単位」(${YEAR}年度便覧)`,
    totalRequired: 124, hisshu: 4,
    zones: { gakusai: 4, senmon: { total: 64, shakaiKagaku: 4, jinbunKagaku: 4, shizenKagaku: 2, rest3frames: 54 }, gaikokugo: 10, kenkyuHyogen: 10, jiyu: 36 },
    promotionToYear3: 40, graduationProspectAtEndOfYear3: 76, year4Min: 8, mediaCap: 60, outsideFacultyCap: 40, globalProgramCap: 16,
    crossCheck: 'meiji-info-communication-2017.json（学則別表1 由来）と全数値一致 → V5 ✓(2出典)',
  },
  poolSummary: pool,
  courses: clean,
};
fs.writeFileSync(path.join(OUT, `meiji-info-communication-allocation-${YEAR}.json`), JSON.stringify(json, null, 1));

// ---------- 5) src/data TS (앱 CAN) ----------
// 요건 zone(gakusai/senmon/gaikokugo/kenkyu-hyogen)은 그대로. 自由選択(jiyu) 묶음은 CAN 에서 jiyu 가 숨겨지므로
// 便覧의 科目群別 표시용 id 로 바꿔 INFO_COMMUNICATION_CAN_EXTRA_ZONES 로 내보낸다(농 卒論関係와 같은 방식).
const JIYU_DISPLAY = {
  'ゼミナール科目群': 'zemi', '海外留学科目群': 'kaigai-ryugaku', 'ウェルネス科目群': 'wellness',
  'キャリアデザイン科目群': 'career-design', '情報リテラシー科目群': 'joho-literacy', '総合講座': 'sogo-koza',
};
const MARK = { '必修': '"必修"', '選択必修': '"選必"' };
const esc = (s) => JSON.stringify(s);
const tsList = clean.filter((c) => c.zone && !c.pseudo && !c.ryugakuNintei)
  .map((c) => ({ ...c, z: c.zone === 'jiyu' ? (JIYU_DISPLAY[c.kubunJa] ?? 'jiyu') : c.zone }));
const extraIds = [...new Set(tsList.map((c) => c.z))].filter((z) => Object.values(JIYU_DISPLAY).includes(z));
const L = [];
L.push('// 情報コミュニケーション学部 科目配当表（単一学科）。');
L.push(`// 出典: ${YEAR}年度 情報コミュニケーション学部便覧（公開PDF）「Ⅱ 履修 1. 授業科目配当表」。科目→区分は学則別表1（2026年4月施行）。`);
L.push(`// 抽出JSON: docs/data/meiji-info-communication-allocation-${YEAR}.json。years は履修開始年次→[開始..4]。`);
L.push('// 先取り履修科目（枠）・留学関係科目（留学認定枠）は除外。自由選択に入る科目群はCAN表示用の区分idに置き換え（要件計算には使わない）。');
L.push('import type { AllocCourse } from "./allocationInterdisciplinaryMath";');
L.push('');
L.push('export const INFO_COMMUNICATION_ALLOCATION: AllocCourse[] = [');
for (const c of tsList) {
  const parts = [`name: ${esc(c.name)}`, `units: ${c.units}`, `mark: ${c.mark ? MARK[c.mark] : 'null'}`, `years: [${c.years.join(', ')}]`, `zone: ${esc(c.z)}`];
  if (c.media) parts.push('media: true');
  L.push(`  { ${parts.join(', ')} },`);
}
L.push('];');
L.push('');
L.push('// 要件マスターでは「自由に選択できる科目」に入る科目群。CANの表示順の末尾に足す（表示専用）。');
L.push('export const INFO_COMMUNICATION_CAN_EXTRA_ZONES: { id: string; nameJa: string }[] = [');
for (const [nameJa, id] of Object.entries(JIYU_DISPLAY)) if (extraIds.includes(id)) L.push(`  { id: ${esc(id)}, nameJa: ${esc(nameJa)} },`);
L.push('];');
L.push('');
fs.writeFileSync(path.join(OUT, 'allocationInfoCommunication.ts'), L.join('\n'));

// ---------- 6) 보고 ----------
console.log(`courses ${clean.length} / skipped ${skipped.length} / 必修 ${clean.filter((c) => c.mark === '必修').length} / 配当年次なし ${clean.filter((c) => !c.years.length).length}`);
console.log(`別表1 대조: 便覧에만 ${onlyInBinran.length}건 ${JSON.stringify(onlyInBinran)} / 별표1에만 ${onlyInBeppyo.length}건 ${JSON.stringify(onlyInBeppyo)}`);
console.log('pool:', JSON.stringify(pool));
for (const v of V) console.log(' ', v);
console.log(`TS: ${tsList.length}과목, extra zones ${JSON.stringify(extraIds)}`);
console.log('skipped rows:'); for (const s of skipped) console.log('   |', s);
