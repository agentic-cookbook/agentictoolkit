#!/usr/bin/env python3
"""Launch AgenticToolkitApp under lldb with the env Xcode uses at Run time.

Xcode's Run action injects Main Thread Checker (on by default for Debug),
sets OS_ACTIVITY_DT_MODE / NSUnbufferedIO, and attaches debugserver before
dyld_start. `open -n` does none of that, and SIP strips DYLD_INSERT_LIBRARIES
from `open` for code-signed apps. This script replicates Xcode's launch env
so launch-time crashes can be reproduced from the terminal.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from shutil import which

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent
SCHEME_PATH = (
    PROJECT_ROOT
    / "AgenticToolkitApp.xcodeproj/xcshareddata/xcschemes/AgenticToolkitApp.xcscheme"
)

XCODE_DEVELOPER = "/Applications/Xcode.app/Contents/Developer"
MAIN_THREAD_CHECKER_DYLIB = f"{XCODE_DEVELOPER}/usr/lib/libMainThreadChecker.dylib"

# Xcode scheme defaults (an absent attribute = this value). Debug schemes
# enable Main Thread Checker by default; everything else is off.
LAUNCH_ACTION_DEFAULTS = {
    "enableMainThreadChecker": "YES",
    "enableAddressSanitizer": "NO",
    "enableThreadSanitizer": "NO",
    "enableUBSanitizer": "NO",
    "enableGPUValidationMode": "NO",
    "stopOnEveryMainThreadCheckerIssue": "NO",
    "enableZombieObjects": "NO",
    "enableGuardMalloc": "NO",
    "enableMallocScribble": "NO",
    "enableMallocStackLogging": "NO",
}


def parse_scheme() -> tuple[dict[str, str], dict[str, str], list[str]]:
    tree = ET.parse(SCHEME_PATH)
    root = tree.getroot()
    launch = root.find("LaunchAction")
    if launch is None:
        sys.exit(f"No LaunchAction in {SCHEME_PATH}")

    toggles = dict(LAUNCH_ACTION_DEFAULTS)
    for key in list(toggles):
        if key in launch.attrib:
            toggles[key] = launch.attrib[key]

    env: dict[str, str] = {}
    envs_node = launch.find("EnvironmentVariables")
    if envs_node is not None:
        for var in envs_node.findall("EnvironmentVariable"):
            if var.attrib.get("isEnabled", "YES") == "YES":
                env[var.attrib["key"]] = var.attrib.get("value", "")

    cli_args: list[str] = []
    args_node = launch.find("CommandLineArguments")
    if args_node is not None:
        for arg in args_node.findall("CommandLineArgument"):
            if arg.attrib.get("isEnabled", "YES") == "YES":
                cli_args.append(arg.attrib["argument"])

    return toggles, env, cli_args


def resolve_app_path(override: str | None) -> Path:
    if override:
        return Path(override).resolve()
    result = subprocess.run(
        ["cc-app-path", "AgenticToolkitApp"],
        capture_output=True,
        text=True,
        check=True,
    )
    for token in result.stdout.split():
        if token.endswith(".app"):
            return Path(token)
    sys.exit(f"Could not parse cc-app-path output: {result.stdout!r}")


def build_env(
    toggles: dict[str, str],
    scheme_env: dict[str, str],
    *,
    use_main_thread_checker: bool,
) -> dict[str, str]:
    env: dict[str, str] = {
        "OS_ACTIVITY_DT_MODE": "disable",
        "NSUnbufferedIO": "YES",
    }

    inserts: list[str] = []
    if use_main_thread_checker and toggles["enableMainThreadChecker"] == "YES":
        inserts.append(MAIN_THREAD_CHECKER_DYLIB)

    if inserts:
        env["DYLD_INSERT_LIBRARIES"] = ":".join(inserts)

    env.update(scheme_env)
    return env


def launch(
    binary: Path,
    env: dict[str, str],
    cli_args: list[str],
    *,
    run_seconds: float,
) -> int:
    env_pairs = " ".join(f"{k}={v}" for k, v in env.items())
    quoted_args = " ".join('"' + a + '"' for a in cli_args)

    # Breakpoints catch crashes that abort via objc_fatal / assertion_fail /
    # abort_with_payload without raising an ObjC exception. Without these,
    # lldb only stops on signals.
    commands = [
        f"settings set target.env-vars {env_pairs}",
        "breakpoint set -n objc_exception_throw",
        "breakpoint set -n __cxa_throw",
        "breakpoint set -n _objc_fatal",
        "breakpoint set -n __assert_rtn",
        "breakpoint set -n abort_with_payload",
        "breakpoint set -n __abort_with_payload",
        f"process launch -- {quoted_args}",
        # Give the app `run_seconds` seconds to either crash or stabilize.
        # `process continue` blocks until the process stops (crash, exit, or
        # breakpoint hit). We wrap lldb in a shell-level timeout outside.
        "bt all",
        "thread list",
        "image list -b -f",
        "quit",
    ]

    with tempfile.NamedTemporaryFile(
        "w", suffix=".lldb", delete=False
    ) as f:
        f.write("\n".join(commands) + "\n")
        script_path = f.name

    try:
        print(f"=== Launching {binary} under lldb (timeout {run_seconds}s) ===", file=sys.stderr)
        print("Environment:", file=sys.stderr)
        for k, v in env.items():
            print(f"  {k}={v}", file=sys.stderr)
        if cli_args:
            print(f"Args: {cli_args}", file=sys.stderr)
        print("", file=sys.stderr)

        lldb = which("lldb") or "/usr/bin/lldb"
        try:
            return subprocess.run(
                [lldb, "--batch", "-s", script_path, str(binary)],
                timeout=run_seconds,
            ).returncode
        except subprocess.TimeoutExpired:
            print(
                f"\n=== TIMEOUT ({run_seconds}s): process did not crash — "
                f"MTC/env alone is not the trigger ===",
                file=sys.stderr,
            )
            subprocess.run(
                ["pkill", "-9", "-f", str(binary)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return 124
    finally:
        os.unlink(script_path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--app", help="Path to .app bundle (default: resolved via cc-app-path)"
    )
    parser.add_argument(
        "--no-main-thread-checker",
        action="store_true",
        help="Do not inject libMainThreadChecker.dylib (falsify the MTC hypothesis)",
    )
    parser.add_argument(
        "--extra-env",
        action="append",
        default=[],
        metavar="KEY=VALUE",
        help="Additional environment variable (repeatable)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=20.0,
        help="Seconds to wait for a crash before giving up (default: 20)",
    )
    args = parser.parse_args()

    toggles, scheme_env, cli_args = parse_scheme()

    for item in args.extra_env:
        if "=" not in item:
            sys.exit(f"--extra-env must be KEY=VALUE, got: {item!r}")
        key, value = item.split("=", 1)
        scheme_env[key] = value

    app = resolve_app_path(args.app)
    binary = app / "Contents/MacOS" / app.stem
    if not binary.exists():
        sys.exit(f"Binary not found: {binary}")

    env = build_env(
        toggles,
        scheme_env,
        use_main_thread_checker=not args.no_main_thread_checker,
    )

    return launch(binary, env, cli_args, run_seconds=args.timeout)


if __name__ == "__main__":
    sys.exit(main() or 0)
