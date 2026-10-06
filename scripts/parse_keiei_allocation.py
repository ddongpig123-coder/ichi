#!/usr/bin/env python3
# 明治 経営学部「授業科目一覧」(2026便覧, 2021年度以降入学者) PDF → 構造化JSON。
# 科目区分=縦書きラベル(罫線で区切り) / 単位・履修開始年次=テキスト数値。配当年次マークは無く「履修開始年次」の単一数値。
# ローカル解析専用（AGENTS.md: scripts/）。 使い方: python3 scripts/parse_keiei_allocation.py <pdf> [--out f.json]
import sys, json, re
import pymupdf  # type: ignore

PAGES = range(0, 6)
NAME_X = (46.0, 190.0)
UNITS_X = (360.0, 378.0)
YEAR_X = (378.0, 392.0)

# 便覧 科目区分 → (zone id, 学科タグ)。縦書き文字が乱れるため、乱れに強い部分文字列で判定。
# 具体的な区分を先に（公共経営を経営学科より先、体育を先）。
ZONE_RULES = [
    (("体育",), "taiiku", None),
    (("学部必修",), "gakubu-hisshu", None),
    (("教養",), "kyoyo", None),
    (("外国語",), "gaikokugo", None),
    (("基礎専門",), "kiso-senmon", None),
    (("公共経営",), "gakka-senmon", "公共経営学科"),
    (("会計",), "gakka-senmon", "会計学科"),
    (("経営学科",), "gakka-senmon", "経営学科"),
    (("実習関連",), "freezone", None),
    (("リテラシー",), "freezone", None),  # ICTリテラシー
    (("講座",), "freezone", None),        # 全学共通総合講座
    (("演習",), "freezone", None),
    (("教職",), None, None),              # 卒業要件外
]


def zone_of(label):
    for keys, z, tag in ZONE_RULES:
        if all(k in label for k in keys):
            return z, tag, label
    return None, None, label


def kubun_sections(pg):
    """(label, y_lo, y_hi) を罫線区切りで返す。ラベルは区間内の縦書き文字を連結。"""
    chars = sorted([(x[1], x[4]) for x in pg.get_text("words") if x[0] < 46 and x[4].strip()])
    # 科目区分列の横罫線
    hr = set()
    for dr in pg.get_drawings():
        for it in dr["items"]:
            if it[0] == "re" and it[1].height < 2 and it[1].width > 10 and it[1].x0 < 46:
                hr.add(round(it[1].y0))
            elif it[0] == "l":
                p1, p2 = it[1], it[2]
                if abs(p1.y - p2.y) < 0.6 and min(p1.x, p2.x) < 46 and abs(p1.x - p2.x) > 10:
                    hr.add(round(p1.y))
    hr = sorted(y for y in hr if y > 80)  # ヘッダ(48,82)の下から
    bounds = []
    for i in range(len(hr) - 1):
        lo, hi = hr[i], hr[i + 1]
        lab = "".join(t for y, t in chars if lo <= y < hi and t not in ("科", "目", "区", "分") or (lo <= y < hi and False))
        # 「科目区分」ヘッダ文字を除外して連結
        lab = "".join(t for y, t in chars if lo <= y < hi)
        lab = lab.replace("科目区分", "")
        if lab:
            bounds.append((lab, lo, hi))
    return bounds


def parse():
    pdf = sys.argv[1]
    out_file = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
    d = pymupdf.open(pdf)
    courses = []
    for pi in PAGES:
        pg = d[pi]
        sections = kubun_sections(pg)

        def zone_at(y):
            for lab, lo, hi in sections:
                if lo <= y < hi:
                    return zone_of(lab)
            return (None, None, None)

        words = [w for w in pg.get_text("words") if w[1] > 80]
        nm = {}
        for x0, y0, x1, y1, t, *_ in words:
            if NAME_X[0] <= x0 < NAME_X[1]:
                nm.setdefault(round(y0), []).append((x0, t))
        un = {}
        yr = {}
        for x0, y0, x1, y1, t, *_ in words:
            if UNITS_X[0] <= x0 < UNITS_X[1] and re.fullmatch(r"\d+", t):
                un[round(y0)] = int(t)
            if YEAR_X[0] <= x0 < YEAR_X[1] and re.fullmatch(r"\d", t):
                yr[round(y0)] = int(t)
        for y, parts in sorted(nm.items()):
            name = "".join(t for _, t in sorted(parts)).strip()
            if not name or "科目名" in name:
                continue
            u = next((un[k] for k in un if abs(k - y) <= 4), None)
            startyr = next((yr[k] for k in yr if abs(k - y) <= 4), None)
            z, tag, klabel = zone_at(y)
            rec = {"name": name, "units": u, "startYear": startyr, "zone": z, "kubunJa": klabel}
            if tag:
                rec["gakka"] = tag
            if z is None and klabel and "教職" in klabel:
                rec["external"] = True
            courses.append(rec)

    result = {"faculty": "management", "facultyNameJa": "経営学部", "schoolDomain": "meiji.ac.jp",
              "band": "2021年度以降入学者", "courses": courses}
    js = json.dumps(result, ensure_ascii=False, indent=1)
    if out_file:
        open(out_file, "w").write(js)
    from collections import Counter
    print(f"[keiei] 科目数={len(courses)}", file=sys.stderr)
    print("  zone별:", dict(Counter(c["zone"] for c in courses)), file=sys.stderr)
    print("  kubun별:", dict(Counter(c["kubunJa"] for c in courses)), file=sys.stderr)
    print(f"  단위없음={sum(1 for c in courses if c['units'] is None)} 년차없음={sum(1 for c in courses if c['startYear'] is None)}", file=sys.stderr)
    if not out_file:
        print(js)


if __name__ == "__main__":
    parse()
