#!/usr/bin/env python3
"""Post-process xcodegen output: link local Swift package product deps.

xcodegen (2.45.x) emits `XCSwiftPackageProductDependency` entries for local
packages without the `package = <id>` field that points at the corresponding
`XCLocalSwiftPackageReference`. Xcode's GUI then reports
"Missing package product 'X'" even though command-line builds work.

This script walks each pbxproj under the given dirs, finds local package
refs, reads the referenced Package.swift to learn which products it
exposes, and patches any orphan `XCSwiftPackageProductDependency` whose
`productName` matches one of those products.

Run after `xcodegen`.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


LOCAL_PKG_RE = re.compile(
    r'(?P<id>[A-F0-9]{24}) /\* XCLocalSwiftPackageReference "(?P<path>[^"]+)" \*/ = \{\s*'
    r'isa = XCLocalSwiftPackageReference;\s*'
    r'relativePath = (?P<rel>[^;]+);\s*'
    r'\};',
    re.DOTALL,
)

ORPHAN_DEP_RE = re.compile(
    r'(?P<block>(?P<id>[A-F0-9]{24}) /\* (?P<name>[^ ]+) \*/ = \{\s*'
    r'isa = XCSwiftPackageProductDependency;\s*'
    r'productName = (?P<product>[^;]+);\s*'
    r'\};)',
    re.DOTALL,
)

PRODUCT_NAME_RE = re.compile(r'\.library\s*\(\s*name:\s*"([^"]+)"', re.DOTALL)


def products_for_package(package_dir: Path) -> set[str]:
    manifest = package_dir / "Package.swift"
    if not manifest.is_file():
        return set()
    return set(PRODUCT_NAME_RE.findall(manifest.read_text()))


def patch_pbxproj(pbxproj: Path) -> bool:
    src = pbxproj.read_text()
    project_dir = pbxproj.parent.parent  # .xcodeproj -> project dir

    local_refs: list[tuple[str, str, set[str]]] = []
    for m in LOCAL_PKG_RE.finditer(src):
        rel = m.group("rel").strip()
        abs_path = (project_dir / rel).resolve()
        products = products_for_package(abs_path)
        if products:
            local_refs.append((m.group("id"), m.group("path"), products))

    if not local_refs:
        return False

    changed = False
    def repl(m: re.Match[str]) -> str:
        nonlocal changed
        product = m.group("product").strip()
        for ref_id, ref_path, products in local_refs:
            if product in products:
                changed = True
                return (
                    f'{m.group("id")} /* {m.group("name")} */ = {{\n'
                    f'\t\t\tisa = XCSwiftPackageProductDependency;\n'
                    f'\t\t\tpackage = {ref_id} /* XCLocalSwiftPackageReference "{ref_path}" */;\n'
                    f'\t\t\tproductName = {product};\n'
                    f'\t\t}};'
                )
        return m.group(0)

    patched = ORPHAN_DEP_RE.sub(repl, src)
    if changed:
        pbxproj.write_text(patched)
    return changed


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: link_local_package_deps.py <xcodeproj-dir-or-pbxproj> ...", file=sys.stderr)
        return 2
    any_changed = False
    for arg in argv[1:]:
        p = Path(arg)
        pbxprojs = [p] if p.name == "project.pbxproj" else list(p.glob("**/project.pbxproj"))
        for pbxproj in pbxprojs:
            if patch_pbxproj(pbxproj):
                print(f"linked: {pbxproj}")
                any_changed = True
    return 0 if any_changed or True else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
