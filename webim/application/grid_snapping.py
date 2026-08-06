import math
from dataclasses import dataclass

Point3D = tuple[float, float, float]


@dataclass(frozen=True, slots=True)
class SnapResult:
    point: Point3D
    kind: str


def snap_grid_point(
    raw: Point3D,
    *,
    start: Point3D | None = None,
    endpoint: Point3D | None = None,
    increment: float = 0.1,
    axis_angle_degrees: float = 5.0,
) -> SnapResult:
    if endpoint is not None:
        return SnapResult(endpoint, "ENDPOINT")
    if increment <= 0.0:
        raise ValueError("Snap increment must be greater than zero")
    increment_point = (
        round(round(raw[0] / increment) * increment, 10),
        round(round(raw[1] / increment) * increment, 10),
        raw[2],
    )
    if start is not None:
        dx = raw[0] - start[0]
        dy = raw[1] - start[1]
        angle = math.atan2(abs(dy), abs(dx))
        tolerance = math.radians(axis_angle_degrees)
        if angle <= tolerance:
            return SnapResult(
                (increment_point[0], start[1], raw[2]), "AXIS_X"
            )
        if abs(math.pi / 2.0 - angle) <= tolerance:
            return SnapResult(
                (start[0], increment_point[1], raw[2]), "AXIS_Y"
            )
    return SnapResult(increment_point, "INCREMENT")
