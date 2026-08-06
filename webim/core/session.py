import json
from pathlib import Path

import ifcopenshell

from webim.domain.project import GridDatum, NativeBimProject, Point3D
from webim.tools.grid import (
    DrawnGridInput,
    GridAxisAnnotationInput,
    GridInput,
    GridResult,
    create_drawn_grid,
    create_grid,
    create_grid_axis_annotation,
    finalize_grid_axis_annotations,
)

from .project import ProjectSettings, SpatialHierarchy, create_project
from .wall import WallInput, create_wall


class IfcSession:
    """Own one IFC model and its persistence state."""

    def __init__(self) -> None:
        self.model: ifcopenshell.file | None = None
        self.hierarchy: SpatialHierarchy | None = None
        self.native_project: NativeBimProject | None = None
        self.filepath: Path | None = None
        self.is_dirty = False

    def new_project(self, settings: ProjectSettings) -> SpatialHierarchy:
        self.model, self.hierarchy = create_project(settings)
        self.native_project = NativeBimProject.create(
            settings.project_name,
            settings.site_name,
            settings.building_name,
            settings.storey_name,
        )
        self.filepath = None
        self.is_dirty = True
        return self.hierarchy

    def ensure_project(
        self, settings: ProjectSettings | None = None
    ) -> SpatialHierarchy:
        if self.hierarchy is not None and self.native_project is not None:
            return self.hierarchy
        return self.new_project(
            settings
            or ProjectSettings(
                "WeBIM Project",
                "Default Site",
                "Main Building",
                "Ground Floor",
            )
        )

    def serialize_native_project(self) -> str:
        if self.native_project is None:
            raise RuntimeError("No native BIM project is loaded")
        return json.dumps(self.native_project.to_dict(), separators=(",", ":"))

    def restore_native_project(self, payload: str) -> SpatialHierarchy:
        native_project = NativeBimProject.from_json(payload)
        self.model, self.hierarchy = create_project(
            ProjectSettings(
                native_project.name,
                native_project.site_name,
                native_project.building_name,
                native_project.storey_name,
            )
        )
        self.native_project = native_project
        self.filepath = None
        self.is_dirty = False
        return self.hierarchy

    def add_wall(self, data: WallInput) -> ifcopenshell.entity_instance:
        if self.model is None or self.hierarchy is None:
            raise RuntimeError("Create or open an IFC project first")
        wall = create_wall(self.model, self.hierarchy.storey, data)
        self.is_dirty = True
        return wall

    def add_grid(self, data: GridInput) -> GridResult:
        if self.model is None or self.hierarchy is None:
            raise RuntimeError("Create or open an IFC project first")
        result = create_grid(self.model, self.hierarchy.storey, data)
        self.is_dirty = True
        return result

    def add_drawn_grid(self, data: DrawnGridInput) -> GridResult:
        if self.model is None or self.hierarchy is None:
            raise RuntimeError("Create or open an IFC project first")
        result = create_drawn_grid(self.model, self.hierarchy.storey, data)
        self.is_dirty = True
        return result

    def add_grid_axis(
        self,
        start: Point3D,
        end: Point3D,
        system_name: str = "Default Grid",
        head_type: str = "CIRCLE",
        head_scale: float = 1.0,
        line_pattern: str = "CENTER",
        line_weight_mm: float = 0.25,
    ) -> GridDatum:
        if self.native_project is None:
            raise RuntimeError("Create or open a BIM project first")
        result = self.native_project.add_grid_axis(
            start,
            end,
            system_name=system_name,
            head_type=head_type,
            head_scale=head_scale,
            line_pattern=line_pattern,
            line_weight_mm=line_weight_mm,
        )
        self.is_dirty = True
        return result

    def export_ifc(self, filepath: str | Path) -> Path:
        if self.model is None:
            raise RuntimeError("No BIM project is loaded")
        target = Path(filepath)
        target.parent.mkdir(parents=True, exist_ok=True)
        export_model = ifcopenshell.file.from_string(self.model.to_string())
        if self.native_project is not None and self.hierarchy is not None:
            export_storey = export_model.by_id(self.hierarchy.storey.id())
            for axis in self.native_project.grid_axes:
                create_grid_axis_annotation(
                    export_model,
                    export_storey,
                    GridAxisAnnotationInput(
                        axis.start,
                        axis.end,
                        tag=axis.name,
                        system_name=axis.system_name,
                        native_id=axis.id,
                    ),
                )
        finalize_grid_axis_annotations(export_model)
        export_model.write(str(target))
        return target

    def save(self, filepath: str | Path | None = None) -> Path:
        target = Path(filepath) if filepath is not None else self.filepath
        if target is None:
            raise ValueError("A filepath is required for the first save")
        self.export_ifc(target)
        self.filepath = target
        self.is_dirty = False
        return target
