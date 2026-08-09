"""Plan-space wall footprints with joins and opening pieces.

Direct port of web/src/application/wallGeometry.ts so the Blender adapter
renders exactly the same solids as WeBIM Web: mitered corner joins, butt
joins (older wall runs through), T-joins trimmed to the crossed wall's
near face, and walls decomposed into pieces around their openings.

Pure Python — no bpy, no ifcopenshell.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .project import NativeWall

Point2 = tuple[float, float]

JOIN_TOLERANCE = 1e-4
PARALLEL_EPS = 1e-9
MITER_LIMIT_FACTOR = 4


@dataclass(frozen=True, slots=True)
class WallPiece:
    """One solid fragment: a plan polygon spanning [z_bottom, z_top]."""

    corners: tuple[Point2, ...]
    z_bottom: float
    z_top: float


def _join_type_at(wall: NativeWall, endpoint: str) -> str:
    return wall.join_start if endpoint == "start" else wall.join_end


def _point_of(wall: NativeWall, endpoint: str):
    return wall.start if endpoint == "start" else wall.end


def _same_point(a, b) -> bool:
    return all(abs(x - y) <= JOIN_TOLERANCE for x, y in zip(a, b))


def _intersect(p1: Point2, d1: Point2, p2: Point2, d2: Point2) -> Point2 | None:
    cross = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(cross) < PARALLEL_EPS:
        return None
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    t = (dx * d2[1] - dy * d2[0]) / cross
    return (p1[0] + t * d1[0], p1[1] + t * d1[1])


def _axis_frame(wall: NativeWall):
    ax = wall.end[0] - wall.start[0]
    ay = wall.end[1] - wall.start[1]
    length = math.hypot(ax, ay)
    if length == 0:
        return None
    direction = (ax / length, ay / length)
    return direction, (-direction[1], direction[0]), length


def _outgoing(wall: NativeWall, endpoint: str):
    sign = 1.0 if endpoint == "start" else -1.0
    frame = _axis_frame(wall)
    direction = frame[0]
    o = (sign * direction[0], sign * direction[1])
    return o, (-o[1], o[0])


def _side_lines(wall: NativeWall, endpoint: str):
    joint = _point_of(wall, endpoint)
    o, nl = _outgoing(wall, endpoint)
    half = wall.thickness / 2
    left = ((joint[0] + nl[0] * half, joint[1] + nl[1] * half), o)
    right = ((joint[0] - nl[0] * half, joint[1] - nl[1] * half), o)
    return left, right


def _end_partners(wall: NativeWall, endpoint: str, walls):
    joint = _point_of(wall, endpoint)
    partners = []
    for candidate in walls:
        if candidate.id == wall.id:
            continue
        for candidate_end in ("start", "end"):
            if _same_point(_point_of(candidate, candidate_end), joint):
                partners.append((candidate, candidate_end))
    return partners


def _cut_end_at_face(wall, endpoint, face_point, face_dir, other_thickness):
    (left_p, left_d), (right_p, right_d) = _side_lines(wall, endpoint)
    corner_left = _intersect(left_p, left_d, face_point, face_dir)
    corner_right = _intersect(right_p, right_d, face_point, face_dir)
    if corner_left is None or corner_right is None:
        return None
    joint = _point_of(wall, endpoint)
    limit = MITER_LIMIT_FACTOR * max(wall.thickness, other_thickness)
    reach = max(
        math.hypot(corner_left[0] - joint[0], corner_left[1] - joint[1]),
        math.hypot(corner_right[0] - joint[0], corner_right[1] - joint[1]),
    )
    if reach > limit:
        return None
    return corner_left, corner_right


def _miter_corners(wall, endpoint, partner):
    partner_wall, partner_end = partner
    own_left, own_right = _side_lines(wall, endpoint)
    other_left, other_right = _side_lines(partner_wall, partner_end)
    corner_left = _intersect(own_left[0], own_left[1], other_right[0], other_right[1])
    corner_right = _intersect(own_right[0], own_right[1], other_left[0], other_left[1])
    if corner_left is None or corner_right is None:
        return None
    joint = _point_of(wall, endpoint)
    limit = MITER_LIMIT_FACTOR * max(wall.thickness, partner_wall.thickness)
    reach = max(
        math.hypot(corner_left[0] - joint[0], corner_left[1] - joint[1]),
        math.hypot(corner_right[0] - joint[0], corner_right[1] - joint[1]),
    )
    if reach > limit:
        return None
    return corner_left, corner_right


def _butt_corner_corners(wall, endpoint, partner, walls):
    partner_wall, _ = partner
    frame = _axis_frame(partner_wall)
    if frame is None:
        return None
    direction, normal, _ = frame
    o, _ = _outgoing(wall, endpoint)
    side = o[0] * normal[0] + o[1] * normal[1]
    if abs(side) < 1e-6:
        return None
    sign = 1.0 if side > 0 else -1.0
    ids = [candidate.id for candidate in walls]
    runs_through = ids.index(wall.id) < ids.index(partner_wall.id)
    face_sign = -sign if runs_through else sign
    half = partner_wall.thickness / 2
    face_point = (
        partner_wall.start[0] + normal[0] * face_sign * half,
        partner_wall.start[1] + normal[1] * face_sign * half,
    )
    return _cut_end_at_face(wall, endpoint, face_point, direction, partner_wall.thickness)


def _t_join_target(wall, endpoint, walls):
    joint = _point_of(wall, endpoint)
    o, _ = _outgoing(wall, endpoint)
    best = None
    best_distance = None
    for candidate in walls:
        if candidate.id == wall.id:
            continue
        if abs(candidate.start[2] - wall.start[2]) > JOIN_TOLERANCE:
            continue
        frame = _axis_frame(candidate)
        if frame is None:
            continue
        direction, normal, length = frame
        half = candidate.thickness / 2
        rel_x = joint[0] - candidate.start[0]
        rel_y = joint[1] - candidate.start[1]
        along = rel_x * direction[0] + rel_y * direction[1]
        if along < half or along > length - half:
            continue
        offset = rel_x * normal[0] + rel_y * normal[1]
        if abs(offset) > half + JOIN_TOLERANCE:
            continue
        side = o[0] * normal[0] + o[1] * normal[1]
        if abs(side) < 1e-6:
            continue
        if best is None or abs(offset) < best_distance:
            best = candidate
            best_distance = abs(offset)
    return best


def _t_butt_corners(wall, endpoint, walls):
    target = _t_join_target(wall, endpoint, walls)
    if target is None:
        return None
    direction, normal, _ = _axis_frame(target)
    o, _ = _outgoing(wall, endpoint)
    side = o[0] * normal[0] + o[1] * normal[1]
    sign = 1.0 if side > 0 else -1.0
    half = target.thickness / 2
    face_point = (
        target.start[0] + normal[0] * sign * half,
        target.start[1] + normal[1] * sign * half,
    )
    return _cut_end_at_face(wall, endpoint, face_point, direction, target.thickness)


def _end_join_corners(wall, endpoint, walls):
    own_type = _join_type_at(wall, endpoint)
    if own_type == "SQUARE":
        return None
    partners = _end_partners(wall, endpoint, walls)
    if len(partners) == 1:
        partner = partners[0]
        other_type = _join_type_at(partner[0], partner[1])
        if other_type == "SQUARE":
            return None
        if own_type == "BUTT" or other_type == "BUTT":
            return _butt_corner_corners(wall, endpoint, partner, walls)
        return _miter_corners(wall, endpoint, partner)
    if len(partners) > 1:
        return None
    return _t_butt_corners(wall, endpoint, walls)


def wall_footprint(wall: NativeWall, walls) -> tuple[Point2, ...]:
    """Plan polygon [start_left, end_left, end_right, start_right]."""
    frame = _axis_frame(wall)
    if frame is None:
        return ()
    _, n, _ = frame
    half = wall.thickness / 2
    start_left = (wall.start[0] + n[0] * half, wall.start[1] + n[1] * half)
    start_right = (wall.start[0] - n[0] * half, wall.start[1] - n[1] * half)
    end_left = (wall.end[0] + n[0] * half, wall.end[1] + n[1] * half)
    end_right = (wall.end[0] - n[0] * half, wall.end[1] - n[1] * half)

    start_join = _end_join_corners(wall, "start", walls)
    if start_join is not None:
        start_left, start_right = start_join
    end_join = _end_join_corners(wall, "end", walls)
    if end_join is not None:
        end_right, end_left = end_join
    return (start_left, end_left, end_right, start_right)


def wall_pieces(wall: NativeWall, walls) -> tuple[WallPiece, ...]:
    """Extrudable fragments around openings, mitered ends preserved."""
    footprint = wall_footprint(wall, walls)
    frame = _axis_frame(wall)
    if frame is None or not footprint:
        return ()
    direction, normal, length = frame
    half = wall.thickness / 2

    def cut_pair(t: float):
        return (
            (
                wall.start[0] + direction[0] * t + normal[0] * half,
                wall.start[1] + direction[1] * t + normal[1] * half,
            ),
            (
                wall.start[0] + direction[0] * t - normal[0] * half,
                wall.start[1] + direction[1] * t - normal[1] * half,
            ),
        )

    def pair_at(t: float):
        if t <= 0:
            return footprint[0], footprint[3]
        if t >= length:
            return footprint[1], footprint[2]
        return cut_pair(t)

    def polygon(a: float, b: float):
        a_left, a_right = pair_at(a)
        b_left, b_right = pair_at(b)
        return (a_left, b_left, b_right, a_right)

    spans = sorted(
        (
            (
                max(0.0, opening.offset - opening.width / 2),
                min(length, opening.offset + opening.width / 2),
                opening,
            )
            for opening in wall.openings
            if opening.offset + opening.width / 2
            > max(0.0, opening.offset - opening.width / 2)
        ),
        key=lambda item: item[0],
    )

    pieces: list[WallPiece] = []
    cursor = 0.0
    for start, end, opening in spans:
        if start > cursor:
            pieces.append(WallPiece(polygon(cursor, start), 0.0, wall.height))
        if opening.sill_height > 0:
            pieces.append(WallPiece(polygon(start, end), 0.0, opening.sill_height))
        head = opening.sill_height + opening.height
        if head < wall.height:
            pieces.append(WallPiece(polygon(start, end), head, wall.height))
        cursor = max(cursor, end)
    if cursor < length:
        pieces.append(WallPiece(polygon(cursor, length), 0.0, wall.height))
    return tuple(pieces)
