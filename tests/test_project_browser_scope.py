import os
import subprocess

BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"


def test_project_browser_only_owns_revit_document_categories():
    assert os.path.exists(BLENDER), f"Blender executable not found: {BLENDER}"
    expression = (
        "import bl_ext.user_default.webim; "
        "from webim.blender.project_browser import ("
        "WEBIMProjectBrowserProperties, WEBIM_PT_project_browser, "
        "PROJECT_BROWSER_BRANCHES); "
        "assert PROJECT_BROWSER_BRANCHES == ('VIEWS', 'SCHEDULES', 'SHEETS', 'FAMILY_TYPES'); "
        "assert not hasattr(WEBIM_PT_project_browser, '_draw_model'); "
        "annotations=set(WEBIMProjectBrowserProperties.__annotations__); "
        "assert 'show_model' not in annotations; "
        "assert 'show_grids' not in annotations; "
        "assert {'show_views','show_schedules','show_sheets','show_family_types'} <= annotations; "
        "print('WeBIM_PROJECT_BROWSER_SCOPE_OK')"
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
    assert "WeBIM_PROJECT_BROWSER_SCOPE_OK" in output, output
    assert "Traceback" not in output, output


def test_project_browser_does_not_register_model_element_operators():
    assert os.path.exists(BLENDER), f"Blender executable not found: {BLENDER}"
    expression = (
        "import bl_ext.user_default.webim; "
        "import webim.blender.project_browser as browser; "
        "class_names={cls.__name__ for cls in browser._CLASSES}; "
        "assert 'WEBIM_OT_browser_select_grid' not in class_names; "
        "assert 'WEBIM_OT_browser_delete_grid' not in class_names; "
        "print('WeBIM_PROJECT_BROWSER_NO_MODEL_OPERATORS_OK')"
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
    assert "WeBIM_PROJECT_BROWSER_NO_MODEL_OPERATORS_OK" in output, output
    assert "Traceback" not in output, output
