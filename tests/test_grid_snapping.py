from webim.application import grid_snapping


def test_grid_snap_prefers_existing_endpoint():
    result = grid_snapping.snap_grid_point(
        raw=(4.94, 5.03, 0.0),
        endpoint=(5.0, 5.0, 0.0),
        increment=0.1,
    )

    assert result.point == (5.0, 5.0, 0.0)
    assert result.kind == "ENDPOINT"


def test_grid_snap_locks_to_horizontal_axis_from_start_point():
    result = grid_snapping.snap_grid_point(
        raw=(8.0, 0.25, 0.0),
        start=(0.0, 0.0, 0.0),
        increment=0.1,
        axis_angle_degrees=5.0,
    )

    assert result.point == (8.0, 0.0, 0.0)
    assert result.kind == "AXIS_X"


def test_grid_snap_locks_to_vertical_axis_from_start_point():
    result = grid_snapping.snap_grid_point(
        raw=(2.2, 9.0, 0.0),
        start=(2.0, 0.0, 0.0),
        increment=0.1,
        axis_angle_degrees=5.0,
    )

    assert result.point == (2.0, 9.0, 0.0)
    assert result.kind == "AXIS_Y"


def test_grid_snap_uses_increment_without_endpoint_or_axis_lock():
    result = grid_snapping.snap_grid_point(
        raw=(2.24, 3.37, 1.5),
        increment=0.1,
    )

    assert result.point == (2.2, 3.4, 1.5)
    assert result.kind == "INCREMENT"
