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


def test_grid_curve_remains_one_zero_thickness_editing_reference():
    output = _run_blender(
        "import bl_ext.user_default.webim; "
        "from webim.domain.project import NativeBimProject; "
        "from webim.blender.tools.grid.renderer import create_grid_axis_object; "
        "p=NativeBimProject.create('Demo','Site','Building','Level'); "
        "a=p.add_grid_axis((0,0,0),(5,0,0),line_pattern='DASHED',line_weight_mm=0.7); "
        "o=create_grid_axis_object(a,view_scale=100); "
        "assert len(o.data.splines)==1, len(o.data.splines); "
        "assert o.data.bevel_depth==0.0, o.data.bevel_depth; "
        "assert len(o.data.splines[0].points)==2; "
        "assert o['webim_graphics_backend']=='GPU'; "
        "print('WEBIM_GRID_GPU_REFERENCE_OK')"
    )
    assert "WEBIM_GRID_GPU_REFERENCE_OK" in output


def test_gpu_overlay_builds_dashes_without_creating_curve_geometry():
    output = _run_blender(
        "import bl_ext.user_default.webim; "
        "from webim.domain.project import NativeBimProject; "
        "from webim.blender.tools.grid.overlay import grid_overlay_segments,lineweight_pixels; "
        "p=NativeBimProject.create('Demo','Site','Building','Level'); "
        "a=p.add_grid_axis((0,0,0),(2,0,0),line_pattern='DASHED',line_weight_mm=0.35); "
        "segments=grid_overlay_segments(a,100); "
        "assert len(segments)==4, len(segments); "
        "assert segments[0]==((0.0,0.0,0.0),(0.3,0.0,0.0)),segments[0]; "
        "assert lineweight_pixels(0.35)>1.0; "
        "print('WEBIM_GRID_GPU_SEGMENTS_OK')"
    )
    assert "WEBIM_GRID_GPU_SEGMENTS_OK" in output


def test_grid_gpu_draw_handler_is_registered_with_extension():
    output = _run_blender(
        "import bl_ext.user_default.webim; "
        "import webim.blender.tools.grid.overlay as overlay; "
        "assert overlay.is_registered(); "
        "print('WEBIM_GRID_GPU_HANDLER_OK')"
    )
    assert "WEBIM_GRID_GPU_HANDLER_OK" in output
