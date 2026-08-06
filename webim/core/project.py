from dataclasses import dataclass

import ifcopenshell
import ifcopenshell.api.aggregate
import ifcopenshell.api.root
import ifcopenshell.api.unit


@dataclass(frozen=True, slots=True)
class ProjectSettings:
    project_name: str
    site_name: str
    building_name: str
    storey_name: str
    storey_elevation: float = 0.0
    schema: str = "IFC4"


@dataclass(frozen=True, slots=True)
class SpatialHierarchy:
    project: ifcopenshell.entity_instance
    site: ifcopenshell.entity_instance
    building: ifcopenshell.entity_instance
    storey: ifcopenshell.entity_instance


def create_project(
    settings: ProjectSettings,
) -> tuple[ifcopenshell.file, SpatialHierarchy]:
    """Create the minimum editable IFC spatial hierarchy."""
    model = ifcopenshell.file(schema=settings.schema)

    project = ifcopenshell.api.root.create_entity(
        model, ifc_class="IfcProject", name=settings.project_name
    )
    site = ifcopenshell.api.root.create_entity(
        model, ifc_class="IfcSite", name=settings.site_name
    )
    building = ifcopenshell.api.root.create_entity(
        model, ifc_class="IfcBuilding", name=settings.building_name
    )
    storey = ifcopenshell.api.root.create_entity(
        model, ifc_class="IfcBuildingStorey", name=settings.storey_name
    )
    storey.Elevation = settings.storey_elevation

    ifcopenshell.api.unit.assign_unit(model)
    ifcopenshell.api.aggregate.assign_object(
        model, products=[site], relating_object=project
    )
    ifcopenshell.api.aggregate.assign_object(
        model, products=[building], relating_object=site
    )
    ifcopenshell.api.aggregate.assign_object(
        model, products=[storey], relating_object=building
    )

    return model, SpatialHierarchy(project, site, building, storey)
