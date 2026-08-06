import ifcopenshell

from webim.core.project import ProjectSettings
from webim.core.session import IfcSession


def test_session_creates_and_saves_a_reopenable_ifc_file(tmp_path):
    session = IfcSession()
    hierarchy = session.new_project(
        ProjectSettings("WeBIM Demo", "Site", "Building", "Ground Floor")
    )
    output = tmp_path / "webim-demo.ifc"

    session.save(output)

    reopened = ifcopenshell.open(output)
    assert reopened.by_guid(hierarchy.project.GlobalId).Name == "WeBIM Demo"
    assert session.filepath == output
    assert session.is_dirty is False
