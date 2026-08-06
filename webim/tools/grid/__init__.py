import math
from dataclasses import dataclass

import ifcopenshell
import ifcopenshell.api.context
import ifcopenshell.api.geometry
import ifcopenshell.api.pset
import ifcopenshell.api.root
import ifcopenshell.api.spatial
import ifcopenshell.util.element
import ifcopenshell.util.unit

from webim.tools.base import ToolDefinition

DEFINITION = ToolDefinition("grid", "Grid", "IfcGrid", "active", __name__)
Point3D = tuple[float, float, float]


@dataclass(frozen=True, slots=True)
class GridInput:
    name: str
    origin: tuple[float, float]
    u_count: int
    v_count: int
    u_spacing: float
    v_spacing: float
    overhang: float = 1.0
    elevation: float = 0.0


@dataclass(frozen=True, slots=True)
class DrawnGridInput:
    name: str
    axes: tuple[tuple[Point3D, Point3D], ...]


@dataclass(frozen=True, slots=True)
class GridAxisAnnotationInput:
    start: Point3D
    end: Point3D
    tag: str | None = None
    system_name: str = "Default Grid"
    native_id: str | None = None


@dataclass(frozen=True, slots=True)
class GridLine:
    tag: str
    start: Point3D
    end: Point3D


@dataclass(frozen=True, slots=True)
class GridAxisAnnotationResult:
    annotation: ifcopenshell.entity_instance
    line: GridLine


@dataclass(frozen=True, slots=True)
class GridResult:
    grid: ifcopenshell.entity_instance
    u_lines: tuple[GridLine, ...]
    v_lines: tuple[GridLine, ...]


def create_grid_axis_annotation(
    model: ifcopenshell.file,
    storey: ifcopenshell.entity_instance,
    data: GridAxisAnnotationInput,
) -> GridAxisAnnotationResult:
    """Create one Revit-style standalone grid datum as a valid IFC annotation."""
    if data.start == data.end:
        raise ValueError("A grid axis requires two different points")

    existing = [
        annotation
        for annotation in model.by_type("IfcAnnotation")
        if annotation.ObjectType == "WEBIM_GRID_AXIS"
    ]
    tag = data.tag or _letter_label(len(existing))
    line = GridLine(tag, data.start, data.end)
    scale = ifcopenshell.util.unit.calculate_unit_scale(model)
    curve = _create_ifc_curve(model, line, scale)
    context = _get_or_create_annotation_context(model)
    representation = model.create_entity(
        "IfcShapeRepresentation",
        ContextOfItems=context,
        RepresentationIdentifier="Annotation",
        RepresentationType="Curve3D",
        Items=(curve,),
    )
    annotation = ifcopenshell.api.root.create_entity(
        model, ifc_class="IfcAnnotation", name=tag
    )
    annotation.ObjectType = "WEBIM_GRID_AXIS"
    annotation.Description = "Standalone grid datum; group into IfcGrid for exchange"
    ifcopenshell.api.geometry.assign_representation(
        model, product=annotation, representation=representation
    )
    pset = ifcopenshell.api.pset.add_pset(
        model, product=annotation, name="Pset_WeBIMGridAxis"
    )
    properties = {"SystemName": data.system_name}
    if data.native_id is not None:
        properties["NativeId"] = data.native_id
    ifcopenshell.api.pset.edit_pset(model, pset=pset, properties=properties)
    ifcopenshell.api.spatial.assign_container(
        model, products=[annotation], relating_structure=storey
    )
    return GridAxisAnnotationResult(annotation=annotation, line=line)


def finalize_grid_axis_annotations(model: ifcopenshell.file) -> int:
    """Promote valid standalone axis families into IfcGrid entities for export."""
    grouped: dict[
        tuple[int, str], list[ifcopenshell.entity_instance]
    ] = {}
    for annotation in model.by_type("IfcAnnotation"):
        if annotation.ObjectType != "WEBIM_GRID_AXIS":
            continue
        metadata = (
            ifcopenshell.util.element.get_pset(
                annotation, "Pset_WeBIMGridAxis"
            )
            or {}
        )
        system_name = metadata.get("SystemName", "Default Grid")
        storey = annotation.ContainedInStructure[0].RelatingStructure
        grouped.setdefault((storey.id(), system_name), []).append(annotation)

    return sum(
        _finalize_grid_group(model, annotations, system_name)
        for (_, system_name), annotations in grouped.items()
    )


def _finalize_grid_group(
    model: ifcopenshell.file,
    annotations: list[ifcopenshell.entity_instance],
    system_name: str,
) -> int:
    families: list[list[tuple[ifcopenshell.entity_instance, GridLine]]] = []
    family_angles: list[float] = []
    for annotation in annotations:
        line = _line_from_annotation(model, annotation)
        angle = _axis_angle(line)
        family_index = next(
            (
                index
                for index, family_angle in enumerate(family_angles)
                if _angles_are_parallel(angle, family_angle)
            ),
            None,
        )
        if family_index is None:
            family_angles.append(angle)
            families.append([])
            family_index = len(families) - 1
        families[family_index].append((annotation, line))

    if len(families) not in {2, 3}:
        return 0

    storey = annotations[0].ContainedInStructure[0].RelatingStructure
    scale = ifcopenshell.util.unit.calculate_unit_scale(model)
    predefined_type = "TRIANGULAR" if len(families) == 3 else "RECTANGULAR"
    grid = ifcopenshell.api.root.create_entity(
        model,
        ifc_class="IfcGrid",
        name=system_name,
        predefined_type=predefined_type,
    )
    grid.UAxes = tuple(
        _create_ifc_axis(model, line, scale) for _, line in families[0]
    )
    grid.VAxes = tuple(
        _create_ifc_axis(model, line, scale) for _, line in families[1]
    )
    if len(families) == 3:
        grid.WAxes = tuple(
            _create_ifc_axis(model, line, scale) for _, line in families[2]
        )
    ifcopenshell.api.spatial.assign_container(
        model, products=[grid], relating_structure=storey
    )
    for annotation in annotations:
        ifcopenshell.api.root.remove_product(model, product=annotation)
    return 1


def create_grid(
    model: ifcopenshell.file,
    storey: ifcopenshell.entity_instance,
    data: GridInput,
) -> GridResult:
    """Create an orthogonal IfcGrid from dimensions expressed in metres."""
    if data.u_count < 2 or data.v_count < 2:
        raise ValueError("Grid requires at least two U and two V axes")
    if data.u_spacing <= 0 or data.v_spacing <= 0:
        raise ValueError("Grid spacing must be positive")

    u_lines = tuple(_build_u_lines(data))
    v_lines = tuple(_build_v_lines(data))
    scale = ifcopenshell.util.unit.calculate_unit_scale(model)

    grid = ifcopenshell.api.root.create_entity(
        model, ifc_class="IfcGrid", name=data.name
    )
    grid.UAxes = tuple(_create_ifc_axis(model, line, scale) for line in u_lines)
    grid.VAxes = tuple(_create_ifc_axis(model, line, scale) for line in v_lines)
    ifcopenshell.api.spatial.assign_container(
        model, products=[grid], relating_structure=storey
    )
    return GridResult(grid=grid, u_lines=u_lines, v_lines=v_lines)


def create_drawn_grid(
    model: ifcopenshell.file,
    storey: ifcopenshell.entity_instance,
    data: DrawnGridInput,
) -> GridResult:
    """Create an IfcGrid from viewport-drawn line segments expressed in metres."""
    u_lines: list[GridLine] = []
    v_lines: list[GridLine] = []
    for start, end in data.axes:
        if start == end:
            raise ValueError("A grid axis requires two different points")
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        if abs(dy) >= abs(dx):
            u_lines.append(GridLine(_letter_label(len(u_lines)), start, end))
        else:
            v_lines.append(GridLine(str(len(v_lines) + 1), start, end))

    if not u_lines or not v_lines:
        raise ValueError("Draw at least one U axis and one V axis")

    scale = ifcopenshell.util.unit.calculate_unit_scale(model)
    grid = ifcopenshell.api.root.create_entity(
        model, ifc_class="IfcGrid", name=data.name, predefined_type="IRREGULAR"
    )
    grid.UAxes = tuple(_create_ifc_axis(model, line, scale) for line in u_lines)
    grid.VAxes = tuple(_create_ifc_axis(model, line, scale) for line in v_lines)
    ifcopenshell.api.spatial.assign_container(
        model, products=[grid], relating_structure=storey
    )
    return GridResult(grid=grid, u_lines=tuple(u_lines), v_lines=tuple(v_lines))


def _build_u_lines(data: GridInput):
    x0, y0 = data.origin
    y1 = y0 - data.overhang
    y2 = y0 + (data.v_count - 1) * data.v_spacing + data.overhang
    for index in range(data.u_count):
        x = x0 + index * data.u_spacing
        yield GridLine(_letter_label(index), (x, y1, data.elevation), (x, y2, data.elevation))


def _build_v_lines(data: GridInput):
    x0, y0 = data.origin
    x1 = x0 - data.overhang
    x2 = x0 + (data.u_count - 1) * data.u_spacing + data.overhang
    for index in range(data.v_count):
        y = y0 + index * data.v_spacing
        yield GridLine(str(index + 1), (x1, y, data.elevation), (x2, y, data.elevation))


def _line_from_annotation(
    model: ifcopenshell.file, annotation: ifcopenshell.entity_instance
) -> GridLine:
    representation = annotation.Representation.Representations[0]
    curve = representation.Items[0]
    if not curve.is_a("IfcPolyline") or len(curve.Points) != 2:
        raise ValueError(f"Grid axis {annotation.Name!r} is not a two-point polyline")
    scale = ifcopenshell.util.unit.calculate_unit_scale(model)
    coordinates = [
        tuple(float(value) * scale for value in point.Coordinates)
        for point in curve.Points
    ]
    return GridLine(annotation.Name, coordinates[0], coordinates[1])


def _axis_angle(line: GridLine) -> float:
    return math.atan2(line.end[1] - line.start[1], line.end[0] - line.start[0]) % math.pi


def _angles_are_parallel(first: float, second: float, tolerance: float = 1.0) -> bool:
    difference = abs(first - second)
    smallest = min(difference, math.pi - difference)
    return smallest <= math.radians(tolerance)


def _letter_label(index: int) -> str:
    label = ""
    value = index + 1
    while value:
        value, remainder = divmod(value - 1, 26)
        label = chr(65 + remainder) + label
    return label


def _create_ifc_curve(
    model: ifcopenshell.file, line: GridLine, unit_scale: float
) -> ifcopenshell.entity_instance:
    points = [
        model.create_entity(
            "IfcCartesianPoint", Coordinates=tuple(value / unit_scale for value in point)
        )
        for point in (line.start, line.end)
    ]
    return model.create_entity("IfcPolyline", Points=points)


def _get_or_create_annotation_context(
    model: ifcopenshell.file,
) -> ifcopenshell.entity_instance:
    for context in model.by_type("IfcGeometricRepresentationSubContext"):
        if context.ContextIdentifier == "Annotation":
            return context

    parent = next(
        (
            context
            for context in model.by_type("IfcGeometricRepresentationContext")
            if context.ContextType == "Model"
        ),
        None,
    )
    if parent is None:
        parent = ifcopenshell.api.context.add_context(model, context_type="Model")
    return ifcopenshell.api.context.add_context(
        model,
        context_type="Model",
        context_identifier="Annotation",
        target_view="MODEL_VIEW",
        parent=parent,
    )


def _create_ifc_axis(
    model: ifcopenshell.file, line: GridLine, unit_scale: float
) -> ifcopenshell.entity_instance:
    curve = _create_ifc_curve(model, line, unit_scale)
    return model.create_entity(
        "IfcGridAxis", AxisTag=line.tag, AxisCurve=curve, SameSense=True
    )


__all__ = [
    "DEFINITION",
    "DrawnGridInput",
    "GridAxisAnnotationInput",
    "GridAxisAnnotationResult",
    "GridInput",
    "GridLine",
    "GridResult",
    "create_drawn_grid",
    "create_grid",
    "create_grid_axis_annotation",
    "finalize_grid_axis_annotations",
]
