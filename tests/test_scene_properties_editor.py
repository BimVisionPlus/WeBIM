import os
import subprocess

BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"


def _run_blender(expression: str) -> str:
    assert os.path.exists(BLENDER), f"Blender executable not found: {BLENDER}"
    result = subprocess.run(
        [BLENDER, "--background", "--python-expr", expression],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    output = result.stdout + result.stderr
    assert result.returncode == 0, output
    assert "Traceback" not in output, output
    return output


def test_scene_properties_editor_exposes_revit_style_browser_and_properties_tabs():
    output = _run_blender(
        "import bl_ext.user_default.webim; "
        "from webim.blender.editor_host import ("
        "WEBIM_PT_scene_root, SCENE_PANEL_IDS); "
        "from webim.blender.project_browser import WEBIM_PT_project_browser; "
        "from webim.blender.element_properties import WEBIM_PT_properties; "
        "assert WEBIM_PT_scene_root.bl_space_type == 'PROPERTIES'; "
        "assert WEBIM_PT_scene_root.bl_context == 'scene'; "
        "assert WEBIM_PT_scene_root.bl_options == {'HIDE_HEADER'}; "
        "assert WEBIM_PT_project_browser.bl_parent_id == WEBIM_PT_scene_root.bl_idname; "
        "assert WEBIM_PT_properties.bl_parent_id == WEBIM_PT_scene_root.bl_idname; "
        "assert SCENE_PANEL_IDS == ('BLENDER_SCENE', 'PROJECT_BROWSER', 'PROPERTIES'); "
        "print('WeBIM_SCENE_PROPERTIES_TABS_OK')"
    )
    assert "WeBIM_SCENE_PROPERTIES_TABS_OK" in output


def test_scene_properties_editor_routes_browser_and_properties_by_active_panel():
    output = _run_blender(
        "import bl_ext.user_default.webim; "
        "from types import SimpleNamespace; "
        "from webim.blender.project_browser import WEBIM_PT_project_browser; "
        "from webim.blender.element_properties import WEBIM_PT_properties; "
        "browser=SimpleNamespace(scene=SimpleNamespace("
        "webim_scene_workspace=SimpleNamespace(active_panel='PROJECT_BROWSER'))); "
        "properties=SimpleNamespace(scene=SimpleNamespace("
        "webim_scene_workspace=SimpleNamespace(active_panel='PROPERTIES'))); "
        "assert WEBIM_PT_project_browser.poll(browser); "
        "assert not WEBIM_PT_properties.poll(browser); "
        "assert WEBIM_PT_properties.poll(properties); "
        "assert not WEBIM_PT_project_browser.poll(properties); "
        "print('WeBIM_SCENE_PROPERTIES_ROUTING_OK')"
    )
    assert "WeBIM_SCENE_PROPERTIES_ROUTING_OK" in output


def test_scene_properties_editor_separates_default_blender_scene_panels():
    output = _run_blender(
        "import bl_ext.user_default.webim; "
        "import bpy; "
        "from types import SimpleNamespace; "
        "from webim.blender.editor_host import ("
        "blender_scene_panel_visible, install_blender_scene_panel_filter); "
        "install_blender_scene_panel_filter(); "
        "scene=SimpleNamespace(webim_scene_workspace=SimpleNamespace("
        "active_panel='BLENDER_SCENE')); "
        "browser=SimpleNamespace(webim_scene_workspace=SimpleNamespace("
        "active_panel='PROJECT_BROWSER')); "
        "properties=SimpleNamespace(webim_scene_workspace=SimpleNamespace("
        "active_panel='PROPERTIES')); "
        "scene_context=SimpleNamespace(scene=scene); "
        "browser_context=SimpleNamespace(scene=browser); "
        "properties_context=SimpleNamespace(scene=properties); "
        "assert blender_scene_panel_visible(scene_context); "
        "assert not blender_scene_panel_visible(browser_context); "
        "assert not blender_scene_panel_visible(properties_context); "
        "panels=list(__import__('webim.blender.editor_host', "
        "fromlist=['x'])._PATCHED_SCENE_PANELS); "
        "assert panels; "
        "assert all(panel.poll(browser_context) is False for panel in panels); "
        "assert len(__import__('webim.blender.editor_host', fromlist=['x'])._PATCHED_SCENE_PANELS) > 0; "
        "print('WeBIM_BLENDER_SCENE_SEPARATION_OK')"
    )
    assert "WeBIM_BLENDER_SCENE_SEPARATION_OK" in output


def test_scene_properties_editor_registers_an_extensible_panel_registry():
    output = _run_blender(
        "import bl_ext.user_default.webim; "
        "from webim.blender.editor_host import SCENE_PANEL_REGISTRY; "
        "assert SCENE_PANEL_REGISTRY['PROJECT_BROWSER'] == 'WEBIM_PT_project_browser'; "
        "assert SCENE_PANEL_REGISTRY['PROPERTIES'] == 'WEBIM_PT_properties'; "
        "assert tuple(SCENE_PANEL_REGISTRY) == ('BLENDER_SCENE', 'PROJECT_BROWSER', 'PROPERTIES'); "
        "print('WeBIM_SCENE_PANEL_REGISTRY_OK')"
    )
    assert "WeBIM_SCENE_PANEL_REGISTRY_OK" in output
