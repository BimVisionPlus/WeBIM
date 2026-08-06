import os
import subprocess

BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"


def test_extension_registers_under_bl_ext_namespace():
    assert os.path.exists(BLENDER), f"Blender executable not found: {BLENDER}"

    command = [
        BLENDER,
        "--background",
        "--python-expr",
        (
            "import bl_ext.user_default.webim; "
            "import webim; "
            "assert webim.__name__ == 'bl_ext.user_default.webim'; "
            "print('WeBIM_EXTENSION_REGISTER_OK')"
        ),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=120, check=False)
    output = result.stdout + result.stderr

    assert result.returncode == 0, output
    assert "WeBIM_EXTENSION_REGISTER_OK" in output, output
    assert "ModuleNotFoundError" not in output, output
    assert "Traceback" not in output, output
