import json

import pytest

from webim.domain.project import NativeBimProject


def test_native_project_creates_standalone_grid_datums_with_revit_style_names():
    project = NativeBimProject.create(
        name="Demo",
        site_name="Site",
        building_name="Building",
        storey_name="Ground Floor",
    )

    axis_a = project.add_grid_axis((0.0, 0.0, 0.0), (0.0, 8.0, 0.0))
    axis_b = project.add_grid_axis((5.0, 0.0, 0.0), (5.0, 8.0, 0.0))
    axis_c = project.add_grid_axis((0.0, 2.0, 0.0), (8.0, 2.0, 0.0))

    assert [axis.name for axis in project.grid_axes] == ["A", "B", "C"]
    assert axis_a.id != axis_b.id != axis_c.id
    assert axis_a.start == (0.0, 0.0, 0.0)
    assert axis_a.end == (0.0, 8.0, 0.0)
    assert axis_a.system_name == "Default Grid"


def test_native_project_rejects_zero_length_grid_axis():
    project = NativeBimProject.create("Demo", "Site", "Building", "Ground Floor")

    with pytest.raises(ValueError, match="two different points"):
        project.add_grid_axis((1.0, 2.0, 0.0), (1.0, 2.0, 0.0))


def test_native_project_json_round_trip_preserves_ids_and_geometry():
    project = NativeBimProject.create("Demo", "Site", "Building", "Ground Floor")
    axis = project.add_grid_axis(
        (1.0, 2.0, 0.0),
        (7.0, 2.0, 0.0),
        system_name="Podium Grid",
    )

    restored = NativeBimProject.from_json(json.dumps(project.to_dict()))

    assert restored.to_dict() == project.to_dict()
    assert restored.grid_axes[0].id == axis.id
    assert restored.grid_axes[0].system_name == "Podium Grid"


def test_grid_datum_persists_and_updates_revit_style_line_graphics():
    project = NativeBimProject.create("Demo", "Site", "Building", "Ground Floor")
    axis = project.add_grid_axis(
        (0.0, 0.0, 0.0),
        (10.0, 0.0, 0.0),
        line_pattern="DASH_DOT",
        line_weight_mm=0.35,
    )

    assert axis.line_pattern == "DASH_DOT"
    assert axis.line_weight_mm == 0.35

    updated = project.update_grid_axis(
        axis.id,
        line_pattern="CENTER",
        line_weight_mm=0.5,
    )
    restored = NativeBimProject.from_json(json.dumps(project.to_dict()))

    assert updated.line_pattern == "CENTER"
    assert updated.line_weight_mm == 0.5
    assert restored.grid_axes[0] == updated


def test_grid_datum_rejects_unknown_patterns_and_weights():
    project = NativeBimProject.create("Demo", "Site", "Building", "Ground Floor")

    with pytest.raises(ValueError, match="Unknown line pattern"):
        project.add_grid_axis((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), line_pattern="INVALID")
    with pytest.raises(ValueError, match="Unsupported line weight"):
        project.add_grid_axis((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), line_weight_mm=0.3)
