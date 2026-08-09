"""The Python wall-geometry port matches the WeBIM Web reference values."""

import pytest

from webim.domain.project import NativeWall, WallOpening
from webim.domain.wall_geometry import wall_footprint, wall_pieces


def make_wall(wall_id, start, end, thickness=0.2, height=3.0, **kwargs):
    return NativeWall(
        id=wall_id,
        name=wall_id.upper(),
        start=start,
        end=end,
        thickness=thickness,
        height=height,
        **kwargs,
    )


def assert_point(actual, expected):
    assert actual[0] == pytest.approx(expected[0], abs=1e-9)
    assert actual[1] == pytest.approx(expected[1], abs=1e-9)


def test_isolated_wall_is_rectangular():
    wall = make_wall("a", (0, 0, 0), (4, 0, 0))
    sl, el, er, sr = wall_footprint(wall, [wall])
    assert_point(sl, (0, 0.1))
    assert_point(el, (4, 0.1))
    assert_point(er, (4, -0.1))
    assert_point(sr, (0, -0.1))


def test_l_corner_miters_shared_points():
    wall_a = make_wall("a", (0, 0, 0), (4, 0, 0))
    wall_b = make_wall("b", (4, 0, 0), (4, 3, 0))
    walls = [wall_a, wall_b]
    footprint_a = wall_footprint(wall_a, walls)
    footprint_b = wall_footprint(wall_b, walls)
    assert_point(footprint_a[1], (3.9, 0.1))
    assert_point(footprint_a[2], (4.1, -0.1))
    assert_point(footprint_b[0], (3.9, 0.1))
    assert_point(footprint_b[3], (4.1, -0.1))


def test_t_join_trims_to_near_face():
    wall_a = make_wall("a", (0, 0, 0), (8, 0, 0))
    wall_b = make_wall("b", (4, -3, 0), (4, 0, 0))
    walls = [wall_a, wall_b]
    footprint_b = wall_footprint(wall_b, walls)
    assert_point(footprint_b[1], (3.9, -0.1))
    assert_point(footprint_b[2], (4.1, -0.1))
    # Continuous wall stays rectangular.
    footprint_a = wall_footprint(wall_a, walls)
    assert_point(footprint_a[1], (8, 0.1))


def test_butt_corner_runs_older_wall_through():
    wall_a = make_wall("a", (0, 0, 0), (4, 0, 0), join_end="BUTT")
    wall_b = make_wall("b", (4, 0, 0), (4, 3, 0))
    walls = [wall_a, wall_b]
    footprint_a = wall_footprint(wall_a, walls)
    assert_point(footprint_a[1], (4.1, 0.1))
    assert_point(footprint_a[2], (4.1, -0.1))
    footprint_b = wall_footprint(wall_b, walls)
    assert_point(footprint_b[0], (3.9, 0.1))
    assert_point(footprint_b[3], (4.1, 0.1))


def test_wall_pieces_split_around_door():
    door = WallOpening(
        id="o1", name="D1", kind="DOOR", offset=4.0, width=1.0, height=2.1
    )
    wall = make_wall("a", (0, 0, 0), (8, 0, 0), openings=(door,))
    pieces = wall_pieces(wall, [wall])
    assert len(pieces) == 3
    lintel = next(piece for piece in pieces if piece.z_bottom > 0)
    assert lintel.z_bottom == pytest.approx(2.1)
    assert lintel.z_top == pytest.approx(3.0)
    assert_point(lintel.corners[0], (3.5, 0.1))
    assert_point(lintel.corners[1], (4.5, 0.1))


def test_wall_pieces_window_has_sill():
    window = WallOpening(
        id="o1",
        name="WN1",
        kind="WINDOW",
        offset=4.0,
        width=1.2,
        height=1.2,
        sill_height=0.9,
    )
    wall = make_wall("a", (0, 0, 0), (8, 0, 0), openings=(window,))
    pieces = wall_pieces(wall, [wall])
    assert len(pieces) == 4
    sill = next(p for p in pieces if p.z_bottom == 0 and p.z_top < 3)
    assert sill.z_top == pytest.approx(0.9)


def test_door_swing_matches_web_reference():
    from webim.domain.wall_geometry import door_swing

    door = WallOpening(
        id="o1", name="D1", kind="DOOR", offset=4.0, width=1.0, height=2.1
    )
    wall = make_wall("a", (0, 0, 0), (8, 0, 0), openings=(door,))
    swing = door_swing(wall, door)
    assert_point(swing.hinge, (3.5, 0.1))
    assert_point(swing.leaf_end, (3.5, 1.1))
    assert_point(swing.arc[0], (4.5, 0.1))
    assert_point(swing.arc[-1], (3.5, 1.1))


def test_door_swing_none_for_windows():
    from webim.domain.wall_geometry import door_swing

    window = WallOpening(
        id="o1", name="WN1", kind="WINDOW", offset=4.0, width=1.2, height=1.2
    )
    wall = make_wall("a", (0, 0, 0), (8, 0, 0), openings=(window,))
    assert door_swing(wall, window) is None
