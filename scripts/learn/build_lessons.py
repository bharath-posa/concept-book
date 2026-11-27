#!/usr/bin/env python3
"""Check the Learn app's lessons and build the JSON the app loads.

    python scripts/learn/build_lessons.py                 # every learn/content/<domain>/<level>.<lang>/
    python scripts/learn/build_lessons.py --check-only    # validate, write nothing

For each lesson folder it checks that:
  * there is a lesson for every concept in the domain's graph.yaml, and the starter lesson teaches every primitive;
  * every card has the fields its type needs; each multiple-choice question has exactly one right answer and
    feedback on every wrong one (so learners always learn *why*);
  * every numeric answer matches its formula, recomputed here (formulas use + - * / ** and sqrt, sin, cos, tan,
    radians, pi);
  * diagrams are well-formed SVG with no scripts, event handlers or links.
Then it writes public/learn/<domain>.<level>.<lang>.json with the graph and the lessons.
"""
from __future__ import annotations

import argparse
import ast
import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "learn" / "content"
OUT = ROOT / "public" / "learn"

GRADED = {"choice", "number", "order", "build"}
TYPES = GRADED | {"hook", "idea", "steps", "predict"}
MATH = {"sqrt": math.sqrt, "sin": math.sin, "cos": math.cos, "tan": math.tan,
        "radians": math.radians, "pi": math.pi}


def safe_eval(expr: str) -> float:
    """Evaluate a small arithmetic formula without eval()."""
    def ev(node):
        if isinstance(node, ast.Expression):
            return ev(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow)):
            a, b = ev(node.left), ev(node.right)
            return {ast.Add: a + b, ast.Sub: a - b, ast.Mult: a * b,
                    ast.Div: a / b if b else math.inf, ast.Pow: a ** b}[type(node.op)]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            v = ev(node.operand)
            return -v if isinstance(node.op, ast.USub) else v
        if isinstance(node, ast.Name) and node.id == "pi":
            return math.pi
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in MATH and len(node.args) == 1:
            return MATH[node.func.id](ev(node.args[0]))
        raise ValueError(f"not allowed in a formula: {ast.dump(node)[:60]}")
    return float(ev(ast.parse(str(expr), mode="eval")))


def check_svg(svg: str, where: str, errors: list[str]) -> None:
    try:
        root = ET.fromstring(svg.strip())
    except ET.ParseError as e:
        errors.append(f"{where}: diagram is not valid SVG ({e})")
        return
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        if tag in ("script", "foreignObject", "a", "image", "use"):
            errors.append(f"{where}: diagram may not contain <{tag}>")
        for attr in el.attrib:
            if attr.lower().startswith("on") or "href" in attr.lower():
                errors.append(f"{where}: diagram may not use the attribute {attr}")


def check_card(card: dict, where: str, errors: list[str]) -> None:
    t = card.get("type")
    if t not in TYPES:
        errors.append(f"{where}: unknown card type {t!r}")
        return
    need = {"hook": ["text", "reveal"], "idea": ["text"], "steps": ["steps"], "predict": ["q", "options", "reveal"],
            "choice": ["q", "options"], "number": ["q", "answer", "formula", "explain"], "order": ["q", "items", "explain"],
            "build": []}[t]
    for field in need:
        if card.get(field) in (None, "", []):
            errors.append(f"{where}: {t} card needs '{field}'")
    if card.get("svg"):
        check_svg(card["svg"], where, errors)
    if t == "choice":
        opts = card.get("options") or []
        right = [o for o in opts if o.get("correct")]
        if len(right) != 1:
            errors.append(f"{where}: needs exactly one correct option (has {len(right)})")
        for o in opts:
            if not o.get("text"):
                errors.append(f"{where}: an option has no text")
            if not o.get("correct") and not o.get("feedback"):
                errors.append(f"{where}: wrong option {o.get('text')!r} needs feedback explaining why")
        if len(opts) < 2:
            errors.append(f"{where}: needs at least two options")
    if t == "number":
        try:
            value = safe_eval(card["formula"])
            tol = float(card.get("tolerance", 1e-9))
            if abs(value - float(card["answer"])) > tol:
                errors.append(f"{where}: answer {card['answer']} doesn't match formula {card['formula']} = {value:.6g}")
        except (KeyError, ValueError, TypeError, ZeroDivisionError) as e:
            errors.append(f"{where}: formula can't be checked ({e})")
    if t == "order" and len(card.get("items") or []) < 3:
        errors.append(f"{where}: order cards need at least 3 items")
    if t == "steps" and len(card.get("steps") or []) < 2:
        errors.append(f"{where}: steps cards need at least 2 steps")
    if t == "predict" and len(card.get("options") or []) < 2:
        errors.append(f"{where}: predict cards need at least 2 options")


def label_of(node_id: str) -> str:
    return node_id.replace("_", " ").capitalize()


def build_folder(folder: Path, errors: list[str]) -> dict | None:
    meta = yaml.safe_load((folder / "_domain.yaml").read_text())
    graph = yaml.safe_load((ROOT / meta["graph"]).read_text())
    primitives = graph.get("primitives") or {}
    concepts = graph.get("concepts") or {}
    apps = graph.get("applications") or {}

    lessons, starter = {}, None
    for f in sorted(folder.glob("*.yaml")):
        if f.name == "_domain.yaml":
            continue
        where = f"{folder.relative_to(ROOT)}/{f.name}"
        try:
            data = yaml.safe_load(f.read_text()) or {}
        except yaml.YAMLError as e:
            errors.append(f"{where}: not valid YAML ({str(e).splitlines()[0]} at {getattr(e, 'problem_mark', '')})")
            continue
        if f.stem == "_start":
            starter = data
            missing = set(primitives) - set(data.get("teaches") or [])
            if missing:
                errors.append(f"{where}: starter doesn't teach primitives {sorted(missing)}")
        elif f.stem not in concepts:
            errors.append(f"{where}: '{f.stem}' is not a concept in {meta['graph']}")
            continue
        else:
            lessons[f.stem] = data
        cards = data.get("cards") or []
        if not data.get("title"):
            errors.append(f"{where}: needs a title")
        if f.stem != "_start" and not data.get("summary"):
            errors.append(f"{where}: needs a one-sentence summary (shown on the map)")
        if not any(c.get("type") in GRADED for c in cards):
            errors.append(f"{where}: needs at least one question")
        for i, card in enumerate(cards, 1):
            check_card(card, f"{where} card {i}", errors)
        for i, card in enumerate(data.get("review") or [], 1):
            if card.get("type") not in GRADED - {"build"}:
                errors.append(f"{where} review {i}: reviews must be choice, number or order questions")
            check_card(card, f"{where} review {i}", errors)
    if starter is None:
        errors.append(f"{folder.relative_to(ROOT)}: missing _start.yaml (the starter lesson)")
    for c in sorted(set(concepts) - set(lessons)):
        errors.append(f"{folder.relative_to(ROOT)}: no lesson for concept '{c}'")

    nodes = []
    for pid, p in primitives.items():
        nodes.append({"id": pid, "label": label_of(pid), "kind": "primitive", "tier": p.get("tier", 0),
                      "defines": p.get("defines", ""), "summary": ((starter or {}).get("summaries") or {}).get(pid, ""),
                      "parents": []})
    for cid, c in concepts.items():
        nodes.append({"id": cid, "label": (lessons.get(cid) or {}).get("title") or label_of(cid), "kind": "concept",
                      "tier": c.get("tier", 1), "defines": c.get("defines", ""),
                      "summary": (lessons.get(cid) or {}).get("summary", ""), "parents": c.get("composed_of") or []})
    known = {n["id"] for n in nodes}
    for n in nodes:
        for p in n["parents"]:
            if p not in known:
                errors.append(f"{meta['graph']}: '{n['id']}' is built from unknown '{p}'")
    applications = [{"id": aid, "label": (meta.get("applications") or {}).get(aid) or label_of(aid),
                     "needs": a.get("needs") or [], "defines": a.get("defines", "")} for aid, a in apps.items()]
    return {"domain": meta["domain"], "level": meta["level"], "language": meta["language"], "title": meta["title"],
            "tagline": meta.get("tagline", ""), "nodes": nodes, "applications": applications,
            "starter": starter, "lessons": lessons}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check-only", action="store_true")
    args = ap.parse_args()
    folders = sorted(p for p in CONTENT.glob("*/*") if (p / "_domain.yaml").exists())
    errors: list[str] = []
    built = []
    for folder in folders:
        data = build_folder(folder, errors)
        if data:
            built.append((folder, data))
    if errors:
        print(f"{len(errors)} problem(s):", file=sys.stderr)
        for e in errors:
            print("  - " + e, file=sys.stderr)
        return 1
    index = []
    for folder, data in built:
        name = f"{data['domain']}.{data['level']}.{data['language']}.json"
        n_q = sum(1 for l in [data["starter"], *data["lessons"].values()] for c in l["cards"] + l.get("review", [])
                  if c["type"] in GRADED)
        print(f"ok  {folder.relative_to(ROOT)}: {len(data['lessons'])} lessons + starter, {n_q} questions → public/learn/{name}")
        index.append({"file": name, "domain": data["domain"], "title": data["title"], "tagline": data["tagline"],
                      "level": data["level"], "language": data["language"], "lessons": len(data["lessons"]) + 1})
        if not args.check_only:
            OUT.mkdir(parents=True, exist_ok=True)
            (OUT / name).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    if not args.check_only:
        (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
