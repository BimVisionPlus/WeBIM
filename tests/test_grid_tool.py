import pytest

from webim.core.project import ProjectSettings, create_project
from webim.core.session import IfcSession
from webim.tools.grid import (
    DrawnGridInput,
    GridAxisAnnotationInput,
    GridInput,
    create_drawn_grid,
    create_grid,
    create_grid_axis_annotation,
)


def test_create_grid_builds_labeled_ifc_axes_and_line_geometry():
    model, hierarchy = create_project(
        ProjectSettings("Demo", "Site", "Building", "Ground Floor")
    )

    result = create_grid(
        model,
        hierarchy.storey,
        GridInput(
            name="Structural Grid",
            origin=(10.0, 20.0),
            u_count=3,
            v_count=2,
            u_spacing=6.0,
            v_spacing=5.0,
            overhang=1.0,
            elevation=0.0,
        ),
    )

    assert result.grid.is_a("IfcGrid")
    assert [axis.AxisTag for axis in result.grid.UAxes] == ["A", "B", "C"]
    assert [axis.AxisTag for axis in result.grid.VAxes] == ["1", "2"]
    assert result.u_lines[0].start == (10.0, 19.0, 0.0)
    assert result.u_lines[0].end == (10.0, 26.0, 0.0)
    assert result.v_lines[1].start == (9.0, 25.0, 0.0)
    assert result.v_lines[1].end == (23.0, 25.0, 0.0)
    assert result.grid.ContainedInStructure[0].RelatingStructure == hierarchy.storey


def test_session_add_grid_marks_model_dirty():
    session = IfcSession()
    session.new_project(ProjectSettings("Demo", "Site", "Building", "Ground Floor"))
    session.is_dirty = False

    result = session.add_grid(
        GridInput("Grid", (0.0, 0.0), 2, 2, 6.0, 5.0)
    )

    assert result.grid.is_a("IfcGrid")
    assert session.is_dirty is True


def test_create_grid_requires_at_least_two_axes_in_each_direction():
    model, hierarchy = create_project(
        ProjectSettings("Demo", "Site", "Building", "Ground Floor")
    )

    with pytest.raises(ValueError, match="at least two U and two V axes"):
        create_grid(
            model,
            hierarchy.storey,
            GridInput("Invalid", (0.0, 0.0), 1, 2, 6.0, 5.0),
        )


def test_create_grid_requires_positive_spacing():
    model, hierarchy = create_project(
        ProjectSettings("Demo", "Site", "Building", "Ground Floor")
    )

    with pytest.raises(ValueError, match="spacing must be positive"):
        create_grid(
            model,
            hierarchy.storey,
            GridInput("Invalid", (0.0, 0.0), 2, 2, 0.0, 5.0),
        )


def test_create_drawn_grid_preserves_clicked_lines_and_assigns_letter_labels():
    model, hierarchy = create_project(
        ProjectSettings("Demo", "Site", "Building", "Ground Floor")
    )

    result = create_drawn_grid(
        model,
        hierarchy.storey,
        DrawnGridInput(
            name="Drawn Grid",
            axes=(
                ((1.0, 2.0, 0.0), (2.0, 8.0, 0.0)),
                ((5.0, 1.0, 0.0), (7.0, 9.0, 0.0)),
                ((0.0, 1.0, 1.5), (6.0, 2.0, 1.5)),
            ),
        ),
    )

    assert [line.tag for line in result.u_lines] == ["A", "B"]
    assert [line.tag for line in result.v_lines] == ["1"]
    assert result.u_lines[1].start == (5.0, 1.0, 0.0)
    assert result.v_lines[0].end == (6.0, 2.0, 1.5)
    assert [axis.AxisTag for axis in result.grid.UAxes] == ["A", "B"]
    assert [axis.AxisTag for axis in result.grid.VAxes] == ["1"]
    assert result.grid.ContainedInStructure[0].RelatingStructure == hierarchy.storey


def test_session_add_drawn_grid_marks_model_dirty():
    session = IfcSession()
    session.new_project(ProjectSettings("Demo", "Site", "Building", "Ground Floor"))
    session.is_dirty = False

    result = session.add_drawn_grid(
        DrawnGridInput(
            "Drawn Grid",
            (
                ((0.0, 0.0, 0.0), (0.0, 5.0, 0.0)),
                ((0.0, 0.0, 0.0), (5.0, 0.0, 0.0)),
            ),
        )
    )

    assert result.grid.is_a("IfcGrid")
    assert session.is_dirty is True


def test_create_single_grid_axis_annotation_is_valid_and_auto_labeled():
    model, hierarchy = create_project(
        ProjectSettings("Demo", "Site", "Building", "Ground Floor")
    )

    axis_a = create_grid_axis_annotation(
        model,
        hierarchy.storey,
        GridAxisAnnotationInput((0.0, 0.0, 0.0), (0.0, 8.0, 0.0)),
    )
    axis_b = create_grid_axis_annotation(
        model,
        hierarchy.storey,
        GridAxisAnnotationInput((5.0, 0.0, 0.0), (5.0, 8.0, 0.0)),
    )
    axis_1 = create_grid_axis_annotation(
        model,
        hierarchy.storey,
        GridAxisAnnotationInput((0.0, 2.0, 0.0), (8.0, 2.0, 0.0)),
    )

    assert axis_a.annotation.is_a("IfcAnnotation")
    assert axis_a.line.tag == "A"
    assert axis_b.line.tag == "B"
    assert axis_1.line.tag == "C"
    assert axis_a.annotation.ObjectType == "WEBIM_GRID_AXIS"
    assert axis_1.annotation.ObjectType == "WEBIM_GRID_AXIS"
    assert axis_a.annotation.Representation.Representations[0].RepresentationType == "Curve3D"
    assert axis_a.annotation.ContainedInStructure[0].RelatingStructure == hierarchy.storey
