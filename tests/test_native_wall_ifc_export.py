"""The add-on's IFC export voids native wall openings (real ifcopenshell)."""

import json

import ifcopenshell
import pytest

from webim.core.session import IfcSession

PAYLOAD = {
    "schema_version": 4,
    "id": "p1",
    "name": "WeBIM Project",
    "site_name": "Default Site",
    "building_name": "Main Building",
    "storey_name": "Ground Floor",
    "grid_axes": [],
    "views": [],
    "levels": [{"id": "l1", "name": "Level 1", "elevation": 0.0}],
    "walls": [
        {
            "id": "w1",
            "name": "W1",
            "start": [0.0, 0.0, 0.0],
            "end": [8.0, 0.0, 0.0],
            "thickness": 0.2,
            "height": 3.0,
            "level_id": "l1",
            "openings": [
                {
                    "id": "o1",
                    "name": "D1",
                    "kind": "DOOR",
                    "offset": 2.0,
                    "width": 0.9,
                    "height": 2.1,
                    "sill_height": 0.0,
                },
                {
                    "id": "o2",
                    "name": "WN1",
                    "kind": "WINDOW",
                    "offset": 5.0,
                    "width": 1.2,
                    "height": 1.2,
                    "sill_height": 0.9,
                },
            ],
        }
    ],
}


@pytest.fixture
def exported_model(tmp_path):
    session = IfcSession()
    session.restore_native_project(json.dumps(PAYLOAD))
    target = tmp_path / "export.ifc"
    session.export_ifc(target)
    return ifcopenshell.open(str(target))

def test_native_wall_exports_with_voids(exported_model):
    walls = exported_model.by_type("IfcWall")
    assert len(walls) == 1
    openings = exported_model.by_type("IfcOpeningElement")
    assert len(openings) == 2
    voids = exported_model.by_type("IfcRelVoidsElement")
    assert len(voids) == 2
    assert all(v.RelatingBuildingElement == walls[0] for v in voids)


def test_fillings_are_doors_and_windows(exported_model):
    doors = exported_model.by_type("IfcDoor")
    windows = exported_model.by_type("IfcWindow")
    assert len(doors) == 1
    assert len(windows) == 1
    assert doors[0].OverallWidth == pytest.approx(0.9)
    assert windows[0].OverallHeight == pytest.approx(1.2)
    fills = exported_model.by_type("IfcRelFillsElement")
    assert len(fills) == 2
    filled = {fill.RelatedBuildingElement.is_a() for fill in fills}
    assert filled == {"IfcDoor", "IfcWindow"}


def test_fillings_contained_in_storey(exported_model):
    contained = set()
    for rel in exported_model.by_type("IfcRelContainedInSpatialStructure"):
        for element in rel.RelatedElements:
            contained.add(element.is_a())
    assert "IfcDoor" in contained
    assert "IfcWindow" in contained
