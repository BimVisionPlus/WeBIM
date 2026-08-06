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
