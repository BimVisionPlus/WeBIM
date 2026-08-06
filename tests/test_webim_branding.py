import os
import subprocess
from pathlib import Path

BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
ROOT = Path(__file__).parents[1]
TEXT_SUFFIXES = {".py", ".md", ".toml", ".txt", ".json", ".yml", ".yaml"}


def test_source_tree_uses_webim_package_and_contains_no_legacy_branding():
    assert (ROOT / "webim" / "__init__.py").is_file()
    assert not (ROOT / ("hd" + "314_bim")).exists()

    offenders = []
    for path in ROOT.rglob("*"):
        if any(part in {".git", ".venv", "dist", "build", "__pycache__"} for part in path.parts):
            continue
        if ("hd" + "314") in path.name.lower():
            offenders.append(str(path.relative_to(ROOT)))
            continue
        if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES:
            content = path.read_text(encoding="utf-8", errors="ignore")
            if ("hd" + "314") in content.lower():
                offenders.append(str(path.relative_to(ROOT)))

    assert offenders == []


def test_blender_extension_registers_with_webim_identity():
    assert os.path.exists(BLENDER), f"Blender executable not found: {BLENDER}"
    expression = (
        "import bl_ext.user_default.webim; "
        "import webim; "
        "assert webim.__name__ == 'bl_ext.user_default.webim'; "
        "assert webim.__version__ == '0.1.0'; "
        "print('WEBIM_BRANDING_OK')"
    )
    result = subprocess.run(
        [BLENDER, "--background", "--python-expr", expression],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    output = result.stdout + result.stderr

    assert result.returncode == 0, output
    assert "WEBIM_BRANDING_OK" in output, output
    assert "Traceback" not in output, output
