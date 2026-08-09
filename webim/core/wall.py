from dataclasses import dataclass

import ifcopenshell
import ifcopenshell.api.context
import ifcopenshell.api.geometry
import ifcopenshell.api.root
import ifcopenshell.api.spatial


@dataclass(frozen=True, slots=True)
class WallInput:
    name: str
    start: tuple[float, float]
    end: tuple[float, float]
    elevation: float
    height: float
    thickness: float


def create_wall(
    model: ifcopenshell.file,
    storey: ifcopenshell.entity_instance,
    data: WallInput,
) -> ifcopenshell.entity_instance:
    """Create an IFC wall from two plan points, dimensions expressed in metres."""
    if data.start == data.end:
        raise ValueError("Wall endpoints must be different")

    body_context = _get_or_create_body_context(model)
    wall = ifcopenshell.api.root.create_entity(
        model, ifc_class="IfcWall", name=data.name
    )
    representation = ifcopenshell.api.geometry.create_2pt_wall(
        model,
        element=wall,
        context=body_context,
        p1=data.start,
        p2=data.end,
        elevation=data.elevation,
        height=data.height,
        thickness=data.thickness,
        is_si=True,
    )
    ifcopenshell.api.geometry.assign_representation(
        model, product=wall, representation=representation
    )
    ifcopenshell.api.spatial.assign_container(
        model, products=[wall], relating_structure=storey
    )
    return wall


def _get_or_create_body_context(
    model: ifcopenshell.file,
) -> ifcopenshell.entity_instance:
    for context in model.by_type("IfcGeometricRepresentationSubContext"):
        if context.ContextIdentifier == "Body":
            return context

    model_context = ifcopenshell.api.context.add_context(
        model, context_type="Model"
    )
    return ifcopenshell.api.context.add_context(
        model,
        context_type="Model",
        context_identifier="Body",
        target_view="MODEL_VIEW",
        parent=model_context,
    )


def add_native_wall_openings(
    model: ifcopenshell.file,
    storey: ifcopenshell.entity_instance,
    wall_entity: ifcopenshell.entity_instance,
    native_wall,
) -> list[ifcopenshell.entity_instance]:
    """Void a native wall's openings and fill them with doors/windows.

    Mirrors the WeBIM Web exporter: the wall body stays full, each opening
    becomes an IfcOpeningElement voiding it via IfcRelVoidsElement, and an
    IfcDoor/IfcWindow filling is related through IfcRelFillsElement and
    contained in the storey.
    """
    import math

    import ifcopenshell.guid

    dx = native_wall.end[0] - native_wall.start[0]
    dy = native_wall.end[1] - native_wall.start[1]
    length = math.hypot(dx, dy)
    if length == 0:
        return []
    ux, uy = dx / length, dy / length
    body_context = _get_or_create_body_context(model)
    openings = []
    for opening in native_wall.openings:
        p1 = (
            native_wall.start[0] + ux * (opening.offset - opening.width / 2),
            native_wall.start[1] + uy * (opening.offset - opening.width / 2),
        )
        p2 = (
            native_wall.start[0] + ux * (opening.offset + opening.width / 2),
            native_wall.start[1] + uy * (opening.offset + opening.width / 2),
        )
        elevation = native_wall.start[2] + opening.sill_height

        opening_entity = ifcopenshell.api.root.create_entity(
            model, ifc_class="IfcOpeningElement", name=opening.name
        )
        opening_entity.PredefinedType = "OPENING"
        representation = ifcopenshell.api.geometry.create_2pt_wall(
            model,
            element=opening_entity,
            context=body_context,
            p1=p1,
            p2=p2,
            elevation=elevation,
            height=opening.height,
            thickness=native_wall.thickness,
            is_si=True,
        )
        ifcopenshell.api.geometry.assign_representation(
            model, product=opening_entity, representation=representation
        )
        model.create_entity(
            "IfcRelVoidsElement",
            GlobalId=ifcopenshell.guid.new(),
            RelatingBuildingElement=wall_entity,
            RelatedOpeningElement=opening_entity,
        )

        filling_class = "IfcDoor" if opening.kind == "DOOR" else "IfcWindow"
        filling = ifcopenshell.api.root.create_entity(
            model, ifc_class=filling_class, name=opening.name
        )
        filling.OverallHeight = opening.height
        filling.OverallWidth = opening.width
        filling_representation = ifcopenshell.api.geometry.create_2pt_wall(
            model,
            element=filling,
            context=body_context,
            p1=p1,
            p2=p2,
            elevation=elevation,
            height=opening.height,
            thickness=0.06,
            is_si=True,
        )
        ifcopenshell.api.geometry.assign_representation(
            model, product=filling, representation=filling_representation
        )
        model.create_entity(
            "IfcRelFillsElement",
            GlobalId=ifcopenshell.guid.new(),
            RelatingOpeningElement=opening_entity,
            RelatedBuildingElement=filling,
        )
        ifcopenshell.api.spatial.assign_container(
            model, products=[filling], relating_structure=storey
        )
        openings.append(opening_entity)
    return openings
