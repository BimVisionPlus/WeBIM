import os
import subprocess

BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"


def test_n_panel_only_shows_properties_for_the_selected_object_category():
    assert os.path.exists(BLENDER), f"Blender executable not found: {BLENDER}"

    expression = (
        "import bl_ext.user_default.webim; "
        "import bpy; "
        "from types import SimpleNamespace; "
        "from webim.blender.panel import WEBIM_PT_authoring; "
        "from webim.blender.tools.grid.panel import WEBIM_PT_grid; "
        "wall=bpy.data.objects.new('Wall', None); wall['ifc_class']='IfcWall'; "
        "grid=bpy.data.objects.new('Grid', None); grid['webim_class']='GridDatum'; "
        "other=bpy.data.objects.new('Other', None); "
        "wall_context=SimpleNamespace(active_object=wall); "
        "grid_context=SimpleNamespace(active_object=grid); "
        "other_context=SimpleNamespace(active_object=other); "
        "empty_context=SimpleNamespace(active_object=None); "
        "assert WEBIM_PT_authoring.poll(wall_context); "
        "assert not WEBIM_PT_grid.poll(wall_context); "
        "assert WEBIM_PT_grid.poll(grid_context); "
        "assert not WEBIM_PT_authoring.poll(grid_context); "
        "assert not WEBIM_PT_authoring.poll(other_context); "
        "assert not WEBIM_PT_grid.poll(other_context); "
        "assert not WEBIM_PT_authoring.poll(empty_context); "
        "assert not WEBIM_PT_grid.poll(empty_context); "
        "assert not hasattr(WEBIM_PT_grid, 'bl_parent_id'); "
        "print('WeBIM_CONTEXTUAL_N_PANEL_OK')"
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
    assert "WeBIM_CONTEXTUAL_N_PANEL_OK" in output, output
    assert "Traceback" not in output, output
