# qc_extract.py  (run once)
import csv, json, pathlib, re, itertools

SRC = pathlib.Path("Joulin-Full-QC-Checklist.csv")
OUT = pathlib.Path("qc_lib")
OUT.mkdir(exist_ok=True)


def slug(s):
    return re.sub(r"\W+", "_", s).lower()


with SRC.open(newline="", encoding="utf-8") as f:
    rows = list(csv.reader(f))

header_idx = next(i for i, r in enumerate(rows) if r[0] == "Category")
header = rows[header_idx]
data = rows[header_idx + 1 :]

# number categories in the order they appear: first=1, second=2, ...
for order_idx, (cat, group) in enumerate(
    itertools.groupby(data, key=lambda r: r[0]), start=1
):
    items = []
    for r in group:
        items.append({"no": r[1], "item": r[2], "spec": r[3], "tool": r[4]})

    with (OUT / f"{slug(cat)}.json").open("w", encoding="utf-8") as out:
        json.dump(
            {"category": cat, "in_order": order_idx, "items": items},
            out,
            indent=2,
            ensure_ascii=False,
        )

print("wrote", len(list(OUT.iterdir())), "templates")
