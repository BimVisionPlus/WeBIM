import subprocess

BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"


def test_grid_properties_expose_line_pattern_and_lineweight_and_update_domain():
    expression = (
        "import bl_ext.user_default.webim; "
        "import bpy; "
        "from types import SimpleNamespace; "
        "from webim.domain.project import NativeBimProject; "
        "from webim.blender.state import SESSION; "
        "from webim.blender.tools.grid.renderer import create_grid_axis_object; "
        "from webim.blender.tools.grid.properties import ("
        "WEBIMGridProperties,_update_selected_grid_style); "
        "annotations=set(WEBIMGridProperties.__annotations__); "
        "assert {'line_pattern','line_weight'} <= annotations; "
        "project=NativeBimProject.create('Demo','Site','Building','Level 1'); "
        "axis=project.add_grid_axis((0,0,0),(5,0,0)); SESSION.native_project=project; "
        "obj=create_grid_axis_object(axis,view_scale=100); "
        "props=SimpleNamespace(line_pattern='DASHED',line_weight='0.35'); "
        "context=SimpleNamespace(active_object=obj,scene=bpy.context.scene); "
        "_update_selected_grid_style(props,context); "
        "updated=project.grid_axes[0]; "
        "assert updated.line_pattern=='DASHED'; "
        "assert abs(updated.line_weight_mm-0.35)<1e-9; "
        "assert obj['webim_line_pattern']=='DASHED'; "
        "assert obj.data.bevel_depth==0.0; "
        "assert obj['webim_graphics_backend']=='GPU'; "
        "print('WEBIM_GRID_STYLE_PROPERTIES_OK')"
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
    assert "WEBIM_GRID_STYLE_PROPERTIES_OK" in output, output
    assert "Traceback" not in output, output
