"""
compiler.py

Single entry point: raw_dir -> extract -> graph -> compiled markdown -> lint.
This is the "compile" step referenced throughout the project.
"""

import argparse
import os

from extractor import extract_all
from graph import build_graph
from rewriter import write_all
from linter import lint, print_report


def compile_wiki(raw_dir: str, output_dir: str, run_lint: bool = True) -> dict:
    entities = extract_all(raw_dir)
    graph = build_graph(entities)
    written = write_all(entities, graph, output_dir)

    report = None
    if run_lint:
        report = lint(output_dir)

    return {
        "entities": entities,
        "graph": graph,
        "written_paths": written,
        "lint_report": report,
    }


def main():
    parser = argparse.ArgumentParser(description="Compile raw notes into a linked markdown wiki.")
    parser.add_argument("raw_dir", help="Directory of raw .txt source files")
    parser.add_argument("output_dir", help="Directory to write compiled .md pages into")
    parser.add_argument("--no-lint", action="store_true", help="Skip the lint pass")
    args = parser.parse_args()

    result = compile_wiki(args.raw_dir, args.output_dir, run_lint=not args.no_lint)
    print(f"Compiled {len(result['written_paths'])} pages from {args.raw_dir} -> {args.output_dir}")
    if result["lint_report"]:
        print_report(result["lint_report"])


if __name__ == "__main__":
    main()
