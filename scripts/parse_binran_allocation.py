#!/usr/bin/env python3
# 明治 便覧「科目配当表」PDF → 構造化JSON（科目→科目区分・配当年次・必修/選択必修）。
# ローカル解析専用。アプリ束には含めない（AGENTS.md: scripts/）。
# 列はPDFの罫線/座標で安定。科目区分(縦書き)はラベル群の中点で境界を推定。
#   使い方: python3 scripts/parse_binran_allocation.py <pdf> <dept_id> <dept_name_ja> [--out file.json]
import sys, json, re

import pymupdf  # type: ignore

# 配当年次セル境界（現象数理統計で罫線確認: 1年329.7-360.4 / 2年360.4-391.1 / 3年391.1-421.8 / 4年421.8-452.6）
YEAR_BINS = [(329.7, 360.4, 1), (360.4, 391.1, 2), (391.1, 421.8, 3), (421.8, 452.6, 4)]
NAME_X = (105.0, 259.4)      # 科目名
UNITS_X = (259.4, 294.5)     # 単位数
KUBUN_X = (50.0, 78.2)       # 科目区分(縦書きトップレベル)
SUB_X = (78.2, 106.0)        # サブ区分(英語/日本語/教養 等)
BIKO_X = (452.6, 545.0)      # 備考

# 便覧の科目区分ラベル → アプリの zone id
ZONE_MAP = {
    "総合教育科目": "sogo-kyoiku",
    "基礎教育科目": "kiso-kyoiku",
    "専門教育科目": "senmon-kyoiku",
}


def year_of(cx):
    for a, b, y in YEAR_BINS:
        if a <= cx < b:
            return y
    return None


def cluster_rows(words, x_lo, x_hi, tol=4.0):
    """x範囲内の語を y でクラスタ化し、(y_center, [語...]) を返す。"""
    items = sorted([(w[1], w[0], w[4]) for w in words if x_lo <= w[0] < x_hi], key=lambda r: (r[0], r[1]))
    rows = []
    for y0, x0, t in items:
        if rows and abs(rows[-1][0] - y0) <= tol:
            rows[-1][1].append((x0, t))
        else:
            rows.append([y0, [(x0, t)]])
    out = []
    for y, parts in rows:
        parts.sort()
        out.append((y, "".join(p[1] for p in parts)))
    return out


def kubun_groups(words):
    """縦書き科目区分ラベル群を (label, y_min, y_max) で返す。"""
    chars = sorted([(w[1], w[4]) for w in words if KUBUN_X[0] <= w[0] < KUBUN_X[1]], key=lambda r: r[0])
    groups = []
    for y, t in chars:
        if groups and (y - groups[-1][2]) <= 20:
            groups[-1][0] += t
            groups[-1][2] = y
        else:
            groups.append([t, y, y])
    # ヘッダ「科目区分」等を除去
    return [(g[0], g[1], g[2]) for g in groups if g[0] not in ("科目区分",) and "配当表" not in g[0]]


def kubun_col_rules(pg):
    """科目区分列(x<80)を横切る薄い横罫線のyを返す（＝セクション境界候補）。"""
    ys = set()
    for dr in pg.get_drawings():
        for it in dr["items"]:
            if it[0] == "re":
                r = it[1]
                if r.height < 2 and r.width > 12 and r.x0 < 80:
                    ys.add(round(r.y0))
            elif it[0] == "l":
                p1, p2 = it[1], it[2]
                if abs(p1.y - p2.y) < 0.6 and abs(p1.x - p2.x) > 12 and min(p1.x, p2.x) < 80:
                    ys.add(round((p1.y + p2.y) / 2))
    return sorted(ys)


def parse_page(pg):
    words = pg.get_text("words")
    # ヘッダ下の表領域のみ（y>104）
    words = [w for w in words if w[1] > 104]
    dots = [((w[0] + w[2]) / 2, w[1]) for w in words if w[4] == "●"]
    groups = kubun_groups(words)
    rules = kubun_col_rules(pg)
    # セクションは既知のトップレベル区分(ZONE_MAP)のみで構成。
    # それ以外のラベル(大学院 等)はセクションを分断しない＝直前の正規区分が継続。
    mapped = [(lab, ymin, ymax) for (lab, ymin, ymax) in groups if lab in ZONE_MAP]
    bounds = []
    for i, (lab, ymin, ymax) in enumerate(mapped):
        if i == 0:
            lo = 104.0
        else:
            prev_ymax = mapped[i - 1][2]
            # 前ラベルと当ラベルの間にある科目区分列の罫線＝実際の境界（複数なら当ラベル直近=最大）
            between = [r for r in rules if prev_ymax < r < ymin]
            lo = max(between) if between else (prev_ymax + ymin) / 2
        hi = 1000.0 if i == len(mapped) - 1 else None  # 次ループで lo として確定
        bounds.append([lab, lo, hi])
    for i in range(len(bounds) - 1):
        bounds[i][2] = bounds[i + 1][1]
    if bounds:
        bounds[-1][2] = 1000.0

    def zone_at(y):
        for lab, lo, hi in bounds:
            if lo <= y < hi:
                return lab
        return mapped[0][0] if mapped else None

    biko_rows = cluster_rows(words, *BIKO_X)

    def biko_at(y):
        # 備考セルは複数行に折り返すため広めに拾う
        return " ".join(t for by, t in biko_rows if abs(by - y) <= 12)

    # 行付近の左側(科目区分+サブ区分)テキスト。大学院設置科目などの検出用。
    left_rows = cluster_rows(words, KUBUN_X[0], SUB_X[1])

    def left_at(y):
        return " ".join(t for ly, t in left_rows if abs(ly - y) <= 10)

    name_rows = cluster_rows(words, *NAME_X)
    out = []
    for y, name in name_rows:
        if not name or name in ("科目名",):
            continue
        mark = None
        if name[0] in "○△▲":
            mark, name = name[0], name[1:]
        units = None
        for uy, ut in cluster_rows(words, *UNITS_X):
            if abs(uy - y) <= 5 and re.fullmatch(r"\d+", ut):
                units = int(ut)
                break
        years = sorted({yr for cx, dy in dots if abs(dy - y) <= 7 and (yr := year_of(cx))})
        biko = biko_at(y)
        external = "卒業要件外" in biko or "大学院" in name or "大学院" in left_at(y)
        media = "メディア授業科目" in biko
        rec = {"name": name, "units": units, "mark": mark, "years": years, "kubunJa": zone_at(y)}
        if media:
            rec["media"] = True
        if external:
            rec["external"] = True
        out.append(rec)
    return out


def main():
    pdf, dept_id, dept_name = sys.argv[1], sys.argv[2], sys.argv[3]
    out_file = None
    if "--out" in sys.argv:
        out_file = sys.argv[sys.argv.index("--out") + 1]
    d = pymupdf.open(pdf)
    courses = []
    for pi in range(d.page_count):
        courses.extend(parse_page(d[pi]))
    # zone id 付与（卒業要件外は zone=None）
    for c in courses:
        c["zone"] = None if c.get("external") else ZONE_MAP.get(c["kubunJa"] or "", None)
    result = {"dept": dept_id, "deptNameJa": dept_name, "courses": courses}
    js = json.dumps(result, ensure_ascii=False, indent=1)
    if out_file:
        open(out_file, "w").write(js)
    # 検証サマリ（stderr）
    from collections import Counter
    byzone = Counter(c["zone"] for c in courses)
    hisshu = [c for c in courses if c["mark"] == "○"]
    sankaku = [c for c in courses if c["mark"] == "△"]
    kuro = [c for c in courses if c["mark"] == "▲"]
    nou = lambda L: sum(c["units"] or 0 for c in L)
    print(f"[{dept_id}] 科目数={len(courses)} zone別={dict(byzone)}", file=sys.stderr)
    print(f"  ○必修 {len(hisshu)}科目/{nou(hisshu)}単位 · △ {len(sankaku)}/{nou(sankaku)} · ▲ {len(kuro)}/{nou(kuro)}", file=sys.stderr)
    noyear = [c for c in courses if not c["years"]]
    nounits = [c for c in courses if c["units"] is None]
    print(f"  年次なし={len(noyear)} 単位なし={len(nounits)} 区分なし={sum(1 for c in courses if not c['zone'])}", file=sys.stderr)
    if not out_file:
        print(js)


if __name__ == "__main__":
    main()
