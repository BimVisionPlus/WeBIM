import ifcopenshell

from webim.core.project import ProjectSettings
from webim.core.session import IfcSession


def _new_session() -> IfcSession:
    session = IfcSession()
    session.new_project(ProjectSettings("Demo", "Site", "Building", "Ground Floor"))
    return session


def test_save_promotes_two_direction_axis_system_to_ifc_grid(tmp_path):
    session = _new_session()
    session.add_grid_axis((0.0, 0.0, 0.0), (0.0, 8.0, 0.0))
    session.add_grid_axis((5.0, 0.0, 0.0), (5.0, 8.0, 0.0))
    session.add_grid_axis((0.0, 2.0, 0.0), (8.0, 2.0, 0.0))

    assert session.model.by_type("IfcAnnotation") == []
    assert len(session.native_project.grid_axes) == 3

    target = session.save(tmp_path / "valid-grid.ifc")
    exported = ifcopenshell.open(target)

    grids = exported.by_type("IfcGrid")
    assert len(grids) == 1
    assert [axis.AxisTag for axis in grids[0].UAxes] == ["A", "B"]
    assert [axis.AxisTag for axis in grids[0].VAxes] == ["C"]
    assert exported.by_type("IfcAnnotation") == []

    assert len(session.native_project.grid_axes) == 3
    assert session.model.by_type("IfcAnnotation") == []
    assert session.model.by_type("IfcGrid") == []


def test_save_keeps_one_direction_axes_as_ifc_annotations(tmp_path):
    session = _new_session()
    session.add_grid_axis((0.0, 0.0, 0.0), (0.0, 8.0, 0.0))
    session.add_grid_axis((5.0, 0.0, 0.0), (5.0, 8.0, 0.0))

    target = session.save(tmp_path / "orphan-grid.ifc")
    exported = ifcopenshell.open(target)

    assert exported.by_type("IfcGrid") == []
    annotations = exported.by_type("IfcAnnotation")
    assert [annotation.Name for annotation in annotations] == ["A", "B"]
    assert all(annotation.ObjectType == "WEBIM_GRID_AXIS" for annotation in annotations)


def test_save_promotes_three_direction_system_to_u_v_w_grid(tmp_path):
    session = _new_session()
    session.add_grid_axis((0.0, 0.0, 0.0), (0.0, 8.0, 0.0))
    session.add_grid_axis((0.0, 0.0, 0.0), (8.0, 0.0, 0.0))
    session.add_grid_axis((0.0, 0.0, 0.0), (8.0, 8.0, 0.0))

    target = session.save(tmp_path / "triangular-grid.ifc")
    exported = ifcopenshell.open(target)

    grid = exported.by_type("IfcGrid")[0]
    assert [axis.AxisTag for axis in grid.UAxes] == ["A"]
    assert [axis.AxisTag for axis in grid.VAxes] == ["B"]
    assert [axis.AxisTag for axis in grid.WAxes] == ["C"]
    assert grid.PredefinedType == "TRIANGULAR"
    assert exported.by_type("IfcAnnotation") == []


def test_save_exports_multiple_named_grid_systems_independently(tmp_path):
    session = _new_session()
    session.add_grid_axis(
        (0.0, 0.0, 0.0), (0.0, 8.0, 0.0), system_name="North Wing"
    )
    session.add_grid_axis(
        (0.0, 0.0, 0.0), (8.0, 0.0, 0.0), system_name="North Wing"
    )
    session.add_grid_axis(
        (20.0, 0.0, 0.0), (26.0, 3.0, 0.0), system_name="South Wing"
    )
    session.add_grid_axis(
        (20.0, 0.0, 0.0), (17.0, 6.0, 0.0), system_name="South Wing"
    )

    target = session.save(tmp_path / "multiple-grids.ifc")
    exported = ifcopenshell.open(target)

    grids = exported.by_type("IfcGrid")
    assert {grid.Name for grid in grids} == {"North Wing", "South Wing"}
    assert sorted(len(grid.UAxes) + len(grid.VAxes) for grid in grids) == [2, 2]
    assert exported.by_type("IfcAnnotation") == []


def test_export_ifc_does_not_mark_native_project_as_saved(tmp_path):
    session = _new_session()
    session.add_grid_axis((0.0, 0.0, 0.0), (0.0, 8.0, 0.0))
    assert session.is_dirty is True

    session.export_ifc(tmp_path / "exchange.ifc")

    assert session.is_dirty is True
