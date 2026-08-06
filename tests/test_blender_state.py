from types import SimpleNamespace

from webim.blender import state
from webim.core.session import IfcSession


def test_blender_tool_ensures_project_from_scene_defaults():
    scene = SimpleNamespace(
        webim=SimpleNamespace(
            project_name="Automatic Project",
            site_name="Site",
            building_name="Building",
            storey_name="Level 01",
            storey_elevation=3.0,
        )
    )
    session = IfcSession()

    hierarchy = state.ensure_project(scene, session)

    assert session.native_project.name == "Automatic Project"
    assert hierarchy.storey.Name == "Level 01"
    assert hierarchy.storey.Elevation == 3.0
