"""Development-only frontmatter checks using the pinned upstream skills-ref."""

import json
import re
import sys
from importlib.metadata import PackageNotFoundError, distribution
from pathlib import Path
from subprocess import run

ROOT = Path(__file__).resolve().parent.parent
VALIDATOR_REPOSITORY = "https://github.com/agentskills/agentskills.git"
INSTALL_HINT = "python -m pip install -r requirements-skills.txt"


def validator_is_pinned() -> bool:
    requirement = (ROOT / "requirements-skills.txt").read_text(encoding="utf-8")
    pin = re.search(r"agentskills\.git@([0-9a-f]{40})#subdirectory=skills-ref", requirement)
    if pin is None:
        raise ValueError("requirements-skills.txt must pin a reference-validator commit")
    try:
        source = distribution("skills-ref").read_text("direct_url.json")
        origin = json.loads(source) if source else {}
    except (PackageNotFoundError, json.JSONDecodeError):
        return False
    if not isinstance(origin, dict):
        return False
    vcs = origin.get("vcs_info", {})
    return (
        origin.get("url") == VALIDATOR_REPOSITORY
        and origin.get("subdirectory") == "skills-ref"
        and isinstance(vcs, dict)
        and vcs.get("commit_id") == pin.group(1)
    )


def canonical_skills() -> list[Path]:
    roots = [
        ROOT / "skills",
        ROOT / "packages/developer/skills",
        ROOT / "packages/learning/skills",
    ]
    return [
        child for root in roots for child in sorted(root.iterdir()) if child.is_dir()
    ]


def main() -> int:
    if not validator_is_pinned():
        print(
            "Installed skills-ref does not match the pinned upstream source. "
            f"Activate the authoring environment and run: {INSTALL_HINT}",
            file=sys.stderr,
        )
        return 1
    paths = [Path(argument).resolve() for argument in sys.argv[1:]] or canonical_skills()
    failed = False
    for path in paths:
        result = run(
            [sys.executable, "-m", "skills_ref.cli", "validate", str(path)],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            failed = True
            print(result.stderr or result.stdout, file=sys.stderr, end="")
    if failed:
        return 1
    print(f"skills-ref: {len(paths)} Skill directories passed frontmatter validation")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
