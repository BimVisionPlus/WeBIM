import math

import bpy
from mathutils import Vector

from webim.domain.project import GridDatum
from webim.tools.grid import GridResult

GRID_HEAD_RADIUS = 0.35
GRID_HEAD_GAP = 0.08


def _annotation_view_factor() -> float:
    from ...views import annotation_view_factor

    return annotation_view_factor(bpy.context.scene)


def _effective_head_scale(axis: GridDatum) -> float:
    return axis.head_scale * _annotation_view_factor()


def _write_grid_reference(curve, axis: GridDatum) -> None:
    curve.splines.clear()
    spline = curve.splines.new("POLY")
    spline.points.add(1)
    spline.points[0].co = (axis.start[0], axis.start[1], 0.0, 1.0)
    spline.points[1].co = (axis.end[0], axis.end[1], 0.0, 1.0)
    curve.bevel_depth = 0.0


def _store_grid_line_style(obj, axis: GridDatum, view_scale: int) -> None:
    obj["webim_line_pattern"] = axis.line_pattern
    obj["webim_line_weight_mm"] = axis.line_weight_mm
    obj["webim_line_view_scale"] = view_scale
    obj["webim_graphics_backend"] = "GPU"


def _grid_head_location(axis: GridDatum, endpoint: str):
    """Place a bubble outside its endpoint, away from the Grid segment."""
    if endpoint == "END":
        base = axis.end
        opposite = axis.start
    else:
        base = axis.start
        opposite = axis.end
    dx = base[0] - opposite[0]
    dy = base[1] - opposite[1]
    length = math.hypot(dx, dy)
    if length == 0.0:
        return base
    offset = GRID_HEAD_RADIUS * _effective_head_scale(axis) + GRID_HEAD_GAP
    return (
        base[0] + dx / length * offset,
        base[1] + dy / length * offset,
        base[2],
    )


def _place_grid_head(annotation, grid_obj, axis: GridDatum, endpoint: str) -> None:
    """Place a Grid head independently at its endpoint in world space."""
    annotation.parent = None
    annotation.location = Vector(_grid_head_location(axis, endpoint))
    effective_scale = _effective_head_scale(axis)
    annotation.scale = (effective_scale,) * 3
    annotation["webim_effective_annotation_scale"] = effective_scale


def create_grid_axis_object(axis: GridDatum, view_scale: int | None = None):
    """Render one native GridDatum as planar 2D linework."""
    collection = _get_or_create_collection("Native BIM/Grid Axes")
    curve = bpy.data.curves.new(f"Grid {axis.name}", type="CURVE")
    curve.dimensions = "2D"
    curve.fill_mode = "NONE"
    curve.resolution_u = 1
    effective_view_scale = 100 if view_scale is None else view_scale
    _write_grid_reference(curve, axis)

    obj = bpy.data.objects.new(f"Grid {axis.name}", curve)
    obj.location.z = axis.start[2]
    obj["webim_id"] = axis.id
    obj["webim_class"] = "GridDatum"
    obj["grid_name"] = axis.name
    obj["grid_system"] = axis.system_name
    obj["grid_head_type"] = axis.head_type
    obj["grid_head_scale"] = axis.head_scale
    _store_grid_line_style(obj, axis, effective_view_scale)
    collection.objects.link(obj)
    _create_grid_head_annotations(collection, obj, axis)
    return obj


def update_grid_axis_object(
    obj,
    axis: GridDatum,
    view_scale: int | None = None,
) -> None:
    """Synchronize native Grid geometry as planar 2D linework."""
    obj.data.dimensions = "2D"
    obj.data.fill_mode = "NONE"
    effective_view_scale = 100 if view_scale is None else view_scale
    obj.location = (0.0, 0.0, axis.start[2])
    _write_grid_reference(obj.data, axis)
    _store_grid_line_style(obj, axis, effective_view_scale)
    obj.data.update_tag()

    update_grid_head_positions(axis)


def update_grid_head_positions(axis: GridDatum) -> None:
    """Move both persisted head annotations without rebuilding their type geometry."""
    grid_obj = next(
        (
            candidate
            for candidate in bpy.data.objects
            if candidate.get("webim_id") == axis.id
            and candidate.get("webim_class") == "GridDatum"
        ),
        None,
    )
    if grid_obj is None:
        return
    for candidate in bpy.data.objects:
        if (
            candidate.get("webim_grid_id") == axis.id
            and candidate.get("webim_class") == "GridHeadAnnotation"
        ):
            endpoint = candidate.get("webim_grid_head", "START")
            _place_grid_head(candidate, grid_obj, axis, endpoint)


def update_grid_head_annotation(obj, axis: GridDatum) -> None:
    """Rebuild a Grid head when its Revit-like annotation type changes."""
    _remove_grid_head_annotation(axis.id)
    obj["grid_head_type"] = axis.head_type
    obj["grid_head_scale"] = axis.head_scale
    if axis.head_type == "NONE":
        return
    collection = obj.users_collection[0]
    _create_grid_head_annotations(collection, obj, axis)


def ensure_grid_head_annotation(obj, axis: GridDatum) -> None:
    """Ensure both endpoints have planar Grid head annotation instances."""
    existing = {
        candidate.get("webim_grid_head", "START"): candidate
        for candidate in bpy.data.objects
        if candidate.get("webim_grid_id") == axis.id
        and candidate.get("webim_class") == "GridHeadAnnotation"
    }
    if set(existing) == {"START", "END"}:
        for endpoint, annotation in existing.items():
            _place_grid_head(annotation, obj, axis, endpoint)
            for child in annotation.children:
                if child.type not in {"CURVE", "FONT"}:
                    continue
                child.data.dimensions = "2D"
                child.data.bevel_depth = 0.0
                if child.type == "FONT":
                    child.data.fill_mode = "FRONT"
                    child.data.extrude = 0.0
                else:
                    child.data.fill_mode = "NONE"
        return
    _remove_grid_head_annotation(axis.id)
    if axis.head_type != "NONE":
        collection = obj.users_collection[0]
        _create_grid_head_annotations(collection, obj, axis)


def _create_grid_head_annotations(collection, grid_obj, axis: GridDatum) -> None:
    for endpoint in ("START", "END"):
        _create_grid_head_annotation(collection, grid_obj, axis, endpoint)


def _create_grid_head_annotation(collection, grid_obj, axis: GridDatum, endpoint: str):
    if axis.head_type == "NONE":
        return None

    annotation = bpy.data.objects.new(
        f"Grid Head {axis.name} {endpoint.title()}", None
    )
    annotation.location = _grid_head_location(axis, endpoint)
    annotation.scale = (axis.head_scale,) * 3
    annotation.empty_display_type = "PLAIN_AXES"
    annotation.empty_display_size = 0.0
    annotation.hide_render = True
    annotation.hide_select = True
    annotation["webim_class"] = "GridHeadAnnotation"
    annotation["webim_grid_id"] = axis.id
    annotation["webim_grid_head"] = endpoint
    annotation["webim_annotation_type"] = axis.head_type
    annotation["webim_annotation_scale"] = axis.head_scale
    collection.objects.link(annotation)
    _place_grid_head(annotation, grid_obj, axis, endpoint)

    point_count = 6 if axis.head_type == "HEXAGON" else 48
    outline_curve = bpy.data.curves.new(
        f"Grid Head Outline {axis.name} {endpoint.title()}", type="CURVE"
    )
    outline_curve.dimensions = "2D"
    outline_curve.fill_mode = "NONE"
    outline_curve.resolution_u = 1
    outline_curve.bevel_depth = 0.0
    outline_curve.bevel_resolution = 0
    outline = outline_curve.splines.new("POLY")
    outline.points.add(point_count - 1)
    radius = GRID_HEAD_RADIUS
    for index, point in enumerate(outline.points):
        angle = math.tau * index / point_count
        point.co = (radius * math.cos(angle), radius * math.sin(angle), 0.0, 1.0)
    outline.use_cyclic_u = True

    outline_obj = bpy.data.objects.new(
        f"Grid Head Outline {axis.name} {endpoint.title()}", outline_curve
    )
    outline_obj.parent = annotation
    outline_obj.hide_select = True
    outline_obj.show_in_front = True
    outline_obj["webim_class"] = "GridHeadOutline"
    collection.objects.link(outline_obj)

    text_curve = bpy.data.curves.new(
        f"Grid Head Text {axis.name} {endpoint.title()}", type="FONT"
    )
    text_curve.body = axis.name
    text_curve.dimensions = "2D"
    text_curve.fill_mode = "FRONT"
    text_curve.extrude = 0.0
    text_curve.bevel_depth = 0.0
    text_curve.align_x = "CENTER"
    text_curve.align_y = "CENTER"
    text_curve.size = 0.35
    text_obj = bpy.data.objects.new(
        f"Grid Head Text {axis.name} {endpoint.title()}", text_curve
    )
    text_obj.parent = annotation
    text_obj.hide_select = True
    text_obj.show_in_front = True
    text_obj["webim_class"] = "GridHeadText"
    collection.objects.link(text_obj)
    return annotation


def synchronize_grid_representations(project) -> None:
    """Migrate saved Grid viewport representations to planar 2D geometry."""
    axes = {axis.id: axis for axis in project.grid_axes}
    grid_objects = [
        obj
        for obj in bpy.data.objects
        if obj.get("webim_class") == "GridDatum"
    ]
    for obj in grid_objects:
        axis = axes.get(obj.get("webim_id", ""))
        if axis is None:
            continue
        update_grid_axis_object(obj, axis)
        update_grid_head_annotation(obj, axis)

    rendered_ids = {
        obj.get("webim_id", "")
        for obj in grid_objects
    }
    for axis in project.grid_axes:
        if axis.id not in rendered_ids:
            create_grid_axis_object(axis)


def _remove_grid_head_annotation(axis_id: str) -> None:
    roots = [
        obj for obj in bpy.data.objects if obj.get("webim_grid_id") == axis_id
    ]
    for root in roots:
        for child in list(root.children):
            data = child.data
            bpy.data.objects.remove(child, do_unlink=True)
            if data is not None and data.users == 0:
                bpy.data.curves.remove(data)
        data = root.data
        bpy.data.objects.remove(root, do_unlink=True)
        if data is not None and data.users == 0:
            bpy.data.curves.remove(data)


def create_grid_objects(result: GridResult):
    """Render legacy IFC grid axes and labels as native Blender curves/text."""
    collection = bpy.data.collections.new(f"IfcGrid/{result.grid.Name}")
    bpy.context.scene.collection.children.link(collection)

    curve = bpy.data.curves.new(result.grid.Name or "IfcGrid", type="CURVE")
    curve.dimensions = "2D"
    curve.fill_mode = "NONE"
    curve.resolution_u = 1
    curve.bevel_depth = 0.0

    lines = (*result.u_lines, *result.v_lines)
    elevation = lines[0].start[2] if lines else 0.0
    for line in lines:
        spline = curve.splines.new("POLY")
        spline.points.add(1)
        spline.points[0].co = (line.start[0], line.start[1], 0.0, 1.0)
        spline.points[1].co = (line.end[0], line.end[1], 0.0, 1.0)

    obj = bpy.data.objects.new(result.grid.Name or "IfcGrid", curve)
    obj.location.z = elevation
    obj["ifc_entity_id"] = result.grid.id()
    obj["ifc_global_id"] = result.grid.GlobalId
    obj["ifc_class"] = result.grid.is_a()
    collection.objects.link(obj)

    for line in (*result.u_lines, *result.v_lines):
        _create_label(collection, line.tag, line.start)

    return obj


def _get_or_create_collection(name: str):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(collection)
    return collection


def _create_label(collection, text: str, location):
    text_curve = bpy.data.curves.new(f"Grid label {text}", type="FONT")
    text_curve.body = text
    text_curve.dimensions = "2D"
    text_curve.fill_mode = "FRONT"
    text_curve.extrude = 0.0
    text_curve.bevel_depth = 0.0
    text_curve.align_x = "CENTER"
    text_curve.align_y = "CENTER"
    text_curve.size = 0.35
    label = bpy.data.objects.new(f"Grid/{text}", text_curve)
    label.location = location
    label["webim_class"] = "GridLabel"
    collection.objects.link(label)
    return label
