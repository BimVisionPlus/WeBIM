"""Native walls/openings/levels/sheets authored in WeBIM Web survive the
Python domain round-trip (parse -> serialize) without loss."""

import json

from webim.domain.project import NativeBimProject

WEB_PAYLOAD = {
    "schema_version": 4,
    "id": "p1",
    "name": "WeBIM Project",
    "site_name": "Default Site",
    "building_name": "Main Building",
    "storey_name": "Ground Floor",
    "grid_axes": [
        {
            "id": "g1",
            "name": "A",
            "start": [0.0, 0.0, 0.0],
            "end": [0.0, 10.0, 0.0],
            "system_name": "Default Grid",
            "head_type": "CIRCLE",
            "head_scale": 1.0,
            "line_pattern": "CENTER",
            "line_weight_mm": 0.25,
        }
    ],
    "views": [
        {
            "id": "v1",
            "name": "Level 1",
            "view_type": "FLOOR_PLAN",
            "scale": 100,
            "ortho_scale": 40.0,
            "level_id": "l1",
        }
    ],
    "walls": [
        {
            "id": "w1",
            "name": "W1",
            "start": [0.0, 0.0, 0.0],
            "end": [8.0, 0.0, 0.0],
            "thickness": 0.2,
            "height": 3.0,
            "join_start": "MITER",
            "join_end": "BUTT",
            "level_id": "l1",
            "openings": [
                {
                    "id": "o1",
                    "name": "D1",
                    "kind": "DOOR",
                    "offset": 4.0,
                    "width": 0.9,
                    "height": 2.1,
                    "sill_height": 0.0,
                    "hinge_end": "END",
                    "swing_side": "RIGHT",
                }
            ],
        }
    ],
    "levels": [{"id": "l1", "name": "Level 1", "elevation": 0.0}],
    "slabs": [
        {
            "id": "sl1",
            "name": "F1",
            "kind": "FLOOR",
            "outline": [[0.0, 0.0], [8.0, 0.0], [8.0, 5.0], [0.0, 5.0]],
            "thickness": 0.2,
            "level_id": "l1",
            "z_offset": 0.0,
        }
    ],
    "schedules": [{"id": "sc1", "name": "Wall Schedule", "kind": "WALL"}],
    "wall_types": [
        {
            "id": "wt1",
            "name": "Brick 220",
            "layers": [
                {"name": "Finish", "material": "Plaster", "thickness": 0.01},
                {"name": "Core", "material": "Brick", "thickness": 0.2},
            ],
        }
    ],
    "dimensions": [
        {
            "id": "dim1",
            "view_id": "v1",
            "start": [0.0, 0.0],
            "end": [8.0, 0.0],
            "offset": 1.5,
        }
    ],
    "sheets": [
        {
            "id": "s1",
            "name": "A101",
            "title": "Plans",
            "placements": [{"id": "pl1", "view_id": "v1", "x": 60.0, "y": 320.0}],
        }
    ],
}


def test_parses_web_authored_walls_levels_sheets():
    project = NativeBimProject.from_json(json.dumps(WEB_PAYLOAD))
    assert len(project.walls) == 1
    wall = project.walls[0]
    assert wall.name == "W1"
    assert wall.join_end == "BUTT"
    assert wall.level_id == "l1"
    assert wall.openings[0].kind == "DOOR"
    assert wall.openings[0].hinge_end == "END"
    assert project.levels[0].elevation == 0.0
    assert project.sheets[0].placements[0].view_id == "v1"
    assert project.views[0].level_id == "l1"
    assert project.slabs[0].kind == "FLOOR"
    assert project.slabs[0].outline[2] == (8.0, 5.0)
    assert project.schedules[0].kind == "WALL"
    assert project.wall_types[0].layers[1].material == "Brick"
    assert project.dimensions[0].offset == 1.5


def test_round_trip_preserves_web_data():
    project = NativeBimProject.from_json(json.dumps(WEB_PAYLOAD))
    restored = NativeBimProject.from_json(json.dumps(project.to_dict()))
    assert restored.to_dict() == project.to_dict()
    assert restored.walls[0].openings[0].swing_side == "RIGHT"
    assert restored.sheets[0].title == "Plans"


def test_legacy_payload_without_new_keys_still_loads():
    payload = {
        key: value
        for key, value in WEB_PAYLOAD.items()
        if key not in {"walls", "levels", "sheets", "slabs", "schedules", "wall_types", "dimensions"}
    }
    payload["views"] = [
        {k: v for k, v in view.items() if k != "level_id"}
        for view in payload["views"]
    ]
    project = NativeBimProject.from_json(json.dumps(payload))
    assert project.walls == []
    assert project.levels == []
    assert project.sheets == []
    assert project.slabs == []
    assert project.schedules == []
    assert project.wall_types == []
    assert project.dimensions == []
    assert project.views[0].level_id is None


def test_translate_wall_moves_axis_and_keeps_level_z():
    project = NativeBimProject.from_json(json.dumps(WEB_PAYLOAD))
    moved = project.translate_wall("w1", 1.5, -2.0)
    assert moved.start == (1.5, -2.0, 0.0)
    assert moved.end == (9.5, -2.0, 0.0)
    # Openings ride along: offsets are relative to the wall start.
    assert moved.openings[0].offset == 4.0
    assert project.walls[0] is moved
    import pytest as _pytest

    with _pytest.raises(KeyError):
        project.translate_wall("missing", 1.0, 0.0)


def test_set_wall_axis_updates_plan_and_keeps_level_z():
    project = NativeBimProject.from_json(json.dumps(WEB_PAYLOAD))
    moved = project.set_wall_axis("w1", (1.0, 2.0, 99.0), (9.0, 2.0, 99.0))
    # x/y come from the edited curve, z stays level-bound.
    assert moved.start == (1.0, 2.0, 0.0)
    assert moved.end == (9.0, 2.0, 0.0)
    import pytest as _pytest

    with _pytest.raises(ValueError):
        project.set_wall_axis("w1", (1.0, 2.0, 0.0), (1.0, 2.0, 5.0))
    with _pytest.raises(KeyError):
        project.set_wall_axis("missing", (0, 0, 0), (1, 0, 0))
