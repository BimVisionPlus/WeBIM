import os
import subprocess

BLENDER = r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"


def test_grid_heads_are_world_space_objects_without_parent_relationship_lines():
    assert os.path.exists(BLENDER), f"Blender executable not found: {BLENDER}"

    expression = (
        "import bl_ext.user_default.webim; "
        "from webim.domain.project import NativeBimProject; "
        "from webim.blender.tools.grid.renderer import create_grid_axis_object; "
        "project=NativeBimProject.create('Demo','Site','Building','Level 1'); "
        "axis=project.add_grid_axis((2.0,3.0,0.0),(8.0,3.0,0.0)); "
        "grid=create_grid_axis_object(axis); "
        "heads=[obj for obj in __import__('bpy').data.objects "
        "if obj.get('webim_grid_id') == axis.id "
        "and obj.get('webim_class') == 'GridHeadAnnotation']; "
        "assert len(heads) == 2, len(heads); "
        "assert all(head.parent is None for head in heads), "
        "[(head.name, head.parent.name if head.parent else None) for head in heads]; "
        "print('WeBIM_GRID_HEAD_RELATIONSHIPS_OK')"
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
    assert "WeBIM_GRID_HEAD_RELATIONSHIPS_OK" in output, output
    assert "Traceback" not in output, output
