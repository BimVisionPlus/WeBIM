import importlib.util
import tomllib
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / "scripts" / "build_addon.py"
SPEC = importlib.util.spec_from_file_location("build_addon", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
build_addon = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build_addon)


def test_build_creates_blender_extension_archive(tmp_path, monkeypatch):
    output = tmp_path / "webim.zip"
    monkeypatch.setattr(build_addon, "OUTPUT", output)

    build_addon.main()

    with zipfile.ZipFile(output) as archive:
        names = set(archive.namelist())
        manifest = tomllib.loads(archive.read("blender_manifest.toml").decode())

    assert "__init__.py" in names
    assert "webim/__init__.py" not in names
    assert manifest["schema_version"] == "1.0.0"
    assert manifest["id"] == "webim"
    assert manifest["version"] == "0.1.0"
    assert manifest["type"] == "add-on"
    assert manifest["blender_version_min"] == "4.2.0"