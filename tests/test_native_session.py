from webim.core.project import ProjectSettings
from webim.core.session import IfcSession


def test_session_automatically_creates_default_project_for_first_tool():
    session = IfcSession()

    hierarchy = session.ensure_project()

    assert session.native_project.name == "WeBIM Project"
    assert hierarchy.site.Name == "Default Site"
    assert hierarchy.building.Name == "Main Building"
    assert hierarchy.storey.Name == "Ground Floor"


def test_session_restores_native_project_from_blend_payload():
    source = IfcSession()
    source.new_project(ProjectSettings("Demo", "Site", "Building", "Ground Floor"))
    axis = source.add_grid_axis((1.0, 2.0, 0.0), (8.0, 2.0, 0.0))

    payload = source.serialize_native_project()
    restored = IfcSession()
    restored.restore_native_project(payload)

    assert restored.native_project.id == source.native_project.id
    assert restored.native_project.grid_axes[0].id == axis.id
    assert restored.model.by_type("IfcProject")[0].Name == "Demo"
    assert restored.hierarchy.storey.Name == "Ground Floor"
    assert restored.is_dirty is False


def test_session_forwards_grid_line_style_to_native_project():
    session = IfcSession()
    session.ensure_project()

    axis = session.add_grid_axis(
        (0.0, 0.0, 0.0),
        (5.0, 0.0, 0.0),
        line_pattern="DASHED",
        line_weight_mm=0.35,
    )

    assert axis.line_pattern == "DASHED"
    assert axis.line_weight_mm == 0.35
    assert session.native_project.grid_axes[0] == axis
    assert session.is_dirty is True
