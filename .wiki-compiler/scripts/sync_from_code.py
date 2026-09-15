#!/usr/bin/env python3
"""Generate wiki-compiler raw_notes from the live repository tree (code only)."""
from __future__ import annotations
import json, os, re, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WIKI_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = WIKI_ROOT / "raw_notes"
SKIP = {"node_modules", "dist", "build", ".git", "coverage", "__pycache__", ".wiki-compiler"}
IMPORT_RE = re.compile(r"""(?:from\s+|require\s*\(\s*)['\"]([^'\"]+)['\"]""")
EXPORT_RE = re.compile(r"export\s+(?:async\s+)?(?:function|class|const|type|interface)\s+(\w+)")

def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "entity"

def title_from_id(eid: str) -> str:
    return " ".join(p.capitalize() for p in eid.replace("-", "_").split("_"))

def read_text(path: Path, limit: int = 100_000) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")[:limit]
    except OSError:
        return ""

def iter_files(base: Path):
    if not base.exists():
        return
    for dp, dns, fns in os.walk(base):
        dns[:] = [d for d in dns if d not in SKIP and not d.startswith(".")]
        for fn in fns:
            if fn.endswith((".ts", ".tsx", ".js", ".md", ".yml", ".yaml", ".json")) and fn not in ("package-lock.json", "tsconfig.json"):
                yield Path(dp) / fn

def package_display_name(pkg_dir: Path) -> str:
    pj = pkg_dir / "package.json"
    if pj.exists():
        try:
            name = json.loads(read_text(pj)).get("name") or pkg_dir.name
            if isinstance(name, str) and "/" in name:
                name = name.split("/")[-1]
            return title_from_id(str(name).replace("@", ""))
        except json.JSONDecodeError:
            pass
    return title_from_id(pkg_dir.name)

def collect_imports(src: Path, package_names: dict) -> list[str]:
    refs = set()
    for m in IMPORT_RE.finditer(read_text(src)):
        spec = m.group(1)
        if not spec.startswith("."):
            continue
        try:
            resolved = (src.parent / spec).resolve()
        except OSError:
            continue
        parts = resolved.parts
        if "packages" in parts:
            i = parts.index("packages")
            if i + 1 < len(parts) and parts[i + 1] in package_names:
                refs.add(package_names[parts[i + 1]])
    return sorted(refs)

def parse_services(compose: Path) -> list[str]:
    if not compose.exists():
        return []
    services, in_s = [], False
    for line in read_text(compose).splitlines():
        if re.match(r"^services:\s*$", line):
            in_s = True
            continue
        if in_s:
            if re.match(r"^[A-Za-z]", line) and not line.startswith(" "):
                break
            m = re.match(r"^  ([a-zA-Z0-9_-]+):\s*$", line)
            if m:
                services.append(m.group(1))
    return services

def block(name: str, aliases: list[str], body: list[str]) -> str:
    lines = [f"# {name}", f"created: {date.today().isoformat()}"]
    if aliases:
        lines.append("aliases: " + ", ".join(a for a in aliases if a))
    lines.append("")
    lines.extend(body)
    lines.append("")
    return "\n".join(lines)

def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for old in RAW_DIR.glob("*.txt"):
        old.unlink()
    packages = sorted(p for p in (ROOT / "packages").iterdir() if p.is_dir() and not p.name.startswith(".")) if (ROOT / "packages").exists() else []
    plugins = sorted(p for p in (ROOT / "plugins").iterdir() if p.is_dir() and not p.name.startswith(".") and not p.name.startswith("_")) if (ROOT / "plugins").exists() else []
    docs = sorted((ROOT / "docs").glob("*.md")) if (ROOT / "docs").exists() else []
    services = parse_services(ROOT / "docker-compose.yml")
    package_names = {p.name: package_display_name(p) for p in packages}
    entities = {}

    body = [
        f"Repository: {ROOT.name}.",
        "Gaon Platform monorepo: packages, plugins, docs, Docker Compose.",
        "Packages: " + ", ".join(f"{package_names[p.name]} (packages/{p.name})" for p in packages) + ".",
    ]
    if plugins:
        body.append("Plugins: " + ", ".join(f"{title_from_id(p.name)} Plugin" for p in plugins) + ".")
    if services:
        body.append("Docker Compose services: " + ", ".join(services) + ".")
    body.append("Related packages: " + ", ".join(package_names.values()) + ".")
    if docs:
        body.append("Docs: " + ", ".join(d.stem for d in docs[:15]) + ".")
    entities["00_gaon_platform.txt"] = block("Gaon Platform", ["Gaon", "MCP SSE Platform", ROOT.name], body)

    for p in packages:
        display = package_names[p.name]
        src = p / "src" if (p / "src").exists() else p
        files = [f for f in iter_files(src) if f.suffix in {".ts", ".tsx", ".js"}]
        imports = set()
        for f in files[:80]:
            imports.update(collect_imports(f, package_names))
        exports = []
        for f in files[:40]:
            for m in EXPORT_RE.finditer(read_text(f, 30_000)):
                if m.group(1) not in exports and not m.group(1).startswith("_"):
                    exports.append(m.group(1))
                if len(exports) >= 20:
                    break
            if len(exports) >= 20:
                break
        pj = {}
        if (p / "package.json").exists():
            try:
                pj = json.loads(read_text(p / "package.json"))
            except json.JSONDecodeError:
                pass
        lines = [
            f"Code location: packages/{p.name}.",
            f"npm name: {pj.get('name', 'unknown')}.",
            f"Source files scanned: {len(files)}.",
            f"{display} is part of Gaon Platform.",
        ]
        if pj.get("description"):
            lines.append(str(pj["description"]))
        if exports:
            lines.append("Notable exports: " + ", ".join(exports[:20]) + ".")
        if (p / "src").exists():
            top = sorted(x.name for x in (p / "src").iterdir() if x.suffix in {".ts", ".tsx"} or x.is_dir())[:15]
            if top:
                lines.append("Top-level src: " + ", ".join(top) + ".")
        if imports:
            lines.append("Code couples to: " + ", ".join(sorted(imports)) + ".")
        others = [v for k, v in package_names.items() if k != p.name]
        if others:
            lines.append("Sibling packages: " + ", ".join(others) + ".")
        if services:
            lines.append("Docker Compose services: " + ", ".join(services) + ".")
        lines.append("CI under GitHub Actions.")
        entities[f"10_package_{slugify(p.name)}.txt"] = block(display, [p.name, f"packages/{p.name}", str(pj.get("name", ""))], lines)

    for p in plugins:
        display = f"{title_from_id(p.name)} Plugin"
        lines = [
            f"Code location: plugins/{p.name}.",
            f"{display} is an in-repo plugin under Gaon Platform.",
            f"Files scanned: {len(list(iter_files(p)))}.",
        ]
        for key in ("core", "control-plane", "install-worker"):
            if key in package_names:
                lines.append(f"Loaded via {package_names[key]}.")
        lines.append("See Plugin Development Guide for extension standards.")
        entities[f"20_plugin_{slugify(p.name)}.txt"] = block(display, [p.name, f"plugins/{p.name}"], lines)

    for d in docs:
        text = read_text(d, 5000)
        mentions = [n for n in package_names.values() if n.lower() in text.lower()]
        lines = [f"Documentation file: docs/{d.name}.", f"{title_from_id(d.stem)} documents Gaon Platform."]
        if mentions:
            lines.append("References packages: " + ", ".join(sorted(set(mentions))) + ".")
        excerpt = [ln.strip() for ln in text.splitlines() if ln.strip() and not ln.startswith("#")][:6]
        if excerpt:
            lines.append("Excerpt: " + " ".join(excerpt)[:400])
        entities[f"30_doc_{slugify(d.stem)}.txt"] = block(title_from_id(d.stem), [d.stem, f"docs/{d.name}"], lines)

    if services:
        entities["40_docker_compose.txt"] = block(
            "Docker Compose",
            ["compose", "docker-compose.yml"],
            [
                "File: docker-compose.yml.",
                "Docker Compose topology for Gaon Platform.",
                "Services: " + ", ".join(services) + ".",
                "Packages: " + ", ".join(package_names.values()) + ".",
            ],
        )

    wf = ROOT / ".github" / "workflows"
    if wf.exists():
        wfs = list(wf.glob("*.yml")) + list(wf.glob("*.yaml"))
        entities["50_github_actions.txt"] = block(
            "GitHub Actions",
            ["CI", "workflows"],
            [
                "Workflows under .github/workflows for Gaon Platform.",
                "Files: " + ", ".join(w.name for w in wfs) + ".",
                "Packages: " + ", ".join(package_names.values()) + ".",
            ],
        )

    for fname, content in sorted(entities.items()):
        (RAW_DIR / fname).write_text(content, encoding="utf-8")
    print(f"Wrote {len(entities)} raw notes (packages={len(packages)} plugins={len(plugins)} docs={len(docs)})")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
