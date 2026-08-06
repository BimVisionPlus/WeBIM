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


def test_grid_renderer_uses_zero_thickness_reference_for_gpu_line_style():
    output = _run_blender(
        "import bl_ext.user_default.webim; "
        "from webim.domain.project import NativeBimProject; "
        "from webim.blender.tools.grid.renderer import create_grid_axis_object; "
        "project=NativeBimProject.create('Demo','Site','Building','Level 1'); "
        "axis=project.add_grid_axis((0.0,0.0,0.0),(2.0,0.0,0.0),"
        "line_pattern='DASHED',line_weight_mm=0.25); "
        "obj=create_grid_axis_object(axis, view_scale=100); "
        "assert len(obj.data.splines)==1, len(obj.data.splines); "
        "assert obj.data.bevel_depth==0.0, obj.data.bevel_depth; "
        "assert obj['webim_line_pattern']=='DASHED'; "
        "assert abs(obj['webim_line_weight_mm']-0.25)<1e-9; "
        "assert obj['webim_line_view_scale']==100; "
        "print('WEBIM_GRID_LINE_STYLE_VIEWPORT_OK')"
    )
    assert "WEBIM_GRID_LINE_STYLE_VIEWPORT_OK" in output


def test_grid_renderer_updates_gpu_style_metadata_without_rebuilding_geometry():
    output = _run_blender(
        "import bl_ext.user_default.webim; "
        "from webim.domain.project import NativeBimProject; "
        "from webim.blender.tools.grid.renderer import ("
        "create_grid_axis_object,update_grid_axis_object); "
        "project=NativeBimProject.create('Demo','Site','Building','Level 1'); "
        "axis=project.add_grid_axis((0.0,0.0,0.0),(2.0,0.0,0.0),"
        "line_pattern='DASHED',line_weight_mm=0.25); "
        "obj=create_grid_axis_object(axis, view_scale=100); "
        "updated=project.update_grid_axis(axis.id,line_pattern='DOTTED',line_weight_mm=0.5); "
        "update_grid_axis_object(obj,updated,view_scale=50); "
        "assert len(obj.data.splines)==1, len(obj.data.splines); "
        "assert obj.data.bevel_depth==0.0; "
        "assert obj['webim_line_pattern']=='DOTTED'; "
        "assert obj['webim_line_view_scale']==50; "
        "print('WEBIM_GRID_LINE_STYLE_UPDATE_OK')"
    )
    assert "WEBIM_GRID_LINE_STYLE_UPDATE_OK" in output


def test_active_view_scale_refreshes_grid_pattern_and_lineweight():
    output = _run_blender(
        "import bl_ext.user_default.webim; "
        "import bpy; "
        "from webim.domain.project import NativeBimProject; "
        "from webim.blender.state import SESSION; "
        "from webim.blender.tools.grid.renderer import create_grid_axis_object; "
        "from webim.blender.views import refresh_view_annotations; "
        "project=NativeBimProject.create('Demo','Site','Building','Level 1'); "
        "axis=project.add_grid_axis((0,0,0),(2,0,0),"
        "line_pattern='DASHED',line_weight_mm=0.25); SESSION.native_project=project; "
        "obj=create_grid_axis_object(axis,view_scale=100); "
        "camera_data=bpy.data.cameras.new('Scale 50 Camera'); "
        "camera=bpy.data.objects.new('Scale 50',camera_data); "
        "bpy.context.scene.collection.objects.link(camera); "
        "camera['webim_class']='TechnicalView'; camera['webim_view_scale']=50; "
        "bpy.context.scene.camera=camera; refresh_view_annotations(bpy.context.scene); "
        "assert obj['webim_line_view_scale']==50; "
        "assert len(obj.data.splines)==1, len(obj.data.splines); "
        "assert obj.data.bevel_depth==0.0; "
        "print('WEBIM_GRID_VIEW_SCALE_REFRESH_OK')"
    )
    assert "WEBIM_GRID_VIEW_SCALE_REFRESH_OK" in output
