import json
from dataclasses import dataclass, field
from uuid import uuid4

from .graphics.line_styles import LineStyle

Point3D = tuple[float, float, float]


@dataclass(frozen=True, slots=True)
class GridDatum:
    id: str
    name: str
    start: Point3D
    end: Point3D
    system_name: str
    head_type: str = "CIRCLE"
    head_scale: float = 1.0
    line_pattern: str = "CENTER"
    line_weight_mm: float = 0.25

    def __post_init__(self) -> None:
        LineStyle("Grid", self.line_pattern, self.line_weight_mm)


@dataclass(frozen=True, slots=True)
class TechnicalView:
    id: str
    name: str
    view_type: str
    scale: int = 100
    ortho_scale: float = 20.0
    level_id: str | None = None


@dataclass(frozen=True, slots=True)
class WallOpening:
    """Door/window opening hosted by a native wall (authored in WeBIM Web)."""

    id: str
    name: str
    kind: str
    offset: float
    width: float
    height: float
    sill_height: float = 0.0
    hinge_end: str = "START"
    swing_side: str = "LEFT"


@dataclass(frozen=True, slots=True)
class NativeWall:
    """Native wall element authored in WeBIM Web.

    The Blender adapter does not render these yet; the domain parses and
    preserves them so web-authored projects survive a Blender round-trip,
    and export_ifc includes them as IfcWall bodies.
    """

    id: str
    name: str
    start: Point3D
    end: Point3D
    thickness: float = 0.2
    height: float = 3.0
    join_start: str = "MITER"
    join_end: str = "MITER"
    level_id: str | None = None
    openings: tuple[WallOpening, ...] = ()
    type_id: str | None = None


@dataclass(frozen=True, slots=True)
class LevelDatum:
    id: str
    name: str
    elevation: float = 0.0


@dataclass(frozen=True, slots=True)
class SlabDatum:
    """Floor/roof slab authored in WeBIM Web (top face at level + z_offset)."""

    id: str
    name: str
    kind: str
    outline: tuple[tuple[float, float], ...]
    thickness: float = 0.2
    level_id: str | None = None
    z_offset: float = 0.0


@dataclass(frozen=True, slots=True)
class SheetPlacement:
    id: str
    view_id: str
    x: float
    y: float


@dataclass(frozen=True, slots=True)
class SheetDatum:
    id: str
    name: str
    title: str = ""
    placements: tuple[SheetPlacement, ...] = ()


@dataclass(frozen=True, slots=True)
class WallLayer:
    name: str
    material: str
    thickness: float


@dataclass(frozen=True, slots=True)
class WallTypeDatum:
    """Layered wall assembly authored in WeBIM Web."""

    id: str
    name: str
    layers: tuple[WallLayer, ...] = ()


@dataclass(frozen=True, slots=True)
class DimensionDatum:
    """Linear dimension annotation bound to one floor plan view."""

    id: str
    view_id: str
    start: tuple[float, float]
    end: tuple[float, float]
    offset: float = 1.0


@dataclass(frozen=True, slots=True)
class DocumentRevision:
    id: str
    rev: str
    note: str = ""
    file_key: str | None = None
    file_name: str | None = None
    uploaded_at: str = ""


@dataclass(frozen=True, slots=True)
class DocumentNote:
    id: str
    text: str
    author: str = ""
    at: str = ""


@dataclass(frozen=True, slots=True)
class DocumentDatum:
    """CDE document container (ISO 19650 metadata) authored in WeBIM Web."""

    id: str
    code: str
    title: str = ""
    status: str = "WIP"
    revisions: tuple[DocumentRevision, ...] = ()
    notes: tuple[DocumentNote, ...] = ()


@dataclass(frozen=True, slots=True)
class TaskDatum:
    """Construction work item (hạng mục) authored in WeBIM Web."""

    id: str
    name: str
    category: str = ""
    assignee: str = ""
    status: str = "NOT_STARTED"
    start: str = ""
    end: str = ""
    progress: float = 0.0
    depends_on: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class ScheduleDatum:
    """Derived element table authored in WeBIM Web (name + kind only)."""

    id: str
    name: str
    kind: str = "WALL"


@dataclass(slots=True)
class NativeBimProject:
    id: str
    name: str
    site_name: str
    building_name: str
    storey_name: str
    grid_axes: list[GridDatum] = field(default_factory=list)
    views: list[TechnicalView] = field(default_factory=list)
    walls: list[NativeWall] = field(default_factory=list)
    levels: list[LevelDatum] = field(default_factory=list)
    sheets: list[SheetDatum] = field(default_factory=list)
    slabs: list[SlabDatum] = field(default_factory=list)
    schedules: list[ScheduleDatum] = field(default_factory=list)
    wall_types: list[WallTypeDatum] = field(default_factory=list)
    dimensions: list[DimensionDatum] = field(default_factory=list)
    documents: list[DocumentDatum] = field(default_factory=list)
    tasks: list[TaskDatum] = field(default_factory=list)

    @classmethod
    def create(
        cls,
        name: str,
        site_name: str,
        building_name: str,
        storey_name: str,
    ) -> "NativeBimProject":
        return cls(
            id=uuid4().hex,
            name=name,
            site_name=site_name,
            building_name=building_name,
            storey_name=storey_name,
        )

    def to_dict(self) -> dict:
        return {
            "schema_version": 4,
            "id": self.id,
            "name": self.name,
            "site_name": self.site_name,
            "building_name": self.building_name,
            "storey_name": self.storey_name,
            "grid_axes": [
                {
                    "id": axis.id,
                    "name": axis.name,
                    "start": list(axis.start),
                    "end": list(axis.end),
                    "system_name": axis.system_name,
                    "head_type": axis.head_type,
                    "head_scale": axis.head_scale,
                    "line_pattern": axis.line_pattern,
                    "line_weight_mm": axis.line_weight_mm,
                }
                for axis in self.grid_axes
            ],
            "views": [
                {
                    "id": view.id,
                    "name": view.name,
                    "view_type": view.view_type,
                    "scale": view.scale,
                    "ortho_scale": view.ortho_scale,
                    **(
                        {"level_id": view.level_id}
                        if view.level_id is not None
                        else {}
                    ),
                }
                for view in self.views
            ],
            "walls": [
                {
                    "id": wall.id,
                    "name": wall.name,
                    "start": list(wall.start),
                    "end": list(wall.end),
                    "thickness": wall.thickness,
                    "height": wall.height,
                    "join_start": wall.join_start,
                    "join_end": wall.join_end,
                    **(
                        {"level_id": wall.level_id}
                        if wall.level_id is not None
                        else {}
                    ),
                    **(
                        {"type_id": wall.type_id}
                        if wall.type_id is not None
                        else {}
                    ),
                    "openings": [
                        {
                            "id": opening.id,
                            "name": opening.name,
                            "kind": opening.kind,
                            "offset": opening.offset,
                            "width": opening.width,
                            "height": opening.height,
                            "sill_height": opening.sill_height,
                            "hinge_end": opening.hinge_end,
                            "swing_side": opening.swing_side,
                        }
                        for opening in wall.openings
                    ],
                }
                for wall in self.walls
            ],
            "levels": [
                {
                    "id": level.id,
                    "name": level.name,
                    "elevation": level.elevation,
                }
                for level in self.levels
            ],
            "slabs": [
                {
                    "id": slab.id,
                    "name": slab.name,
                    "kind": slab.kind,
                    "outline": [list(point) for point in slab.outline],
                    "thickness": slab.thickness,
                    **(
                        {"level_id": slab.level_id}
                        if slab.level_id is not None
                        else {}
                    ),
                    "z_offset": slab.z_offset,
                }
                for slab in self.slabs
            ],
            "schedules": [
                {
                    "id": schedule.id,
                    "name": schedule.name,
                    "kind": schedule.kind,
                }
                for schedule in self.schedules
            ],
            "documents": [
                {
                    "id": document.id,
                    "code": document.code,
                    "title": document.title,
                    "status": document.status,
                    "revisions": [
                        {
                            "id": revision.id,
                            "rev": revision.rev,
                            "note": revision.note,
                            "file_key": revision.file_key,
                            "file_name": revision.file_name,
                            "uploaded_at": revision.uploaded_at,
                        }
                        for revision in document.revisions
                    ],
                    "notes": [
                        {
                            "id": note.id,
                            "text": note.text,
                            "author": note.author,
                            "at": note.at,
                        }
                        for note in document.notes
                    ],
                }
                for document in self.documents
            ],
            "tasks": [
                {
                    "id": task.id,
                    "name": task.name,
                    "category": task.category,
                    "assignee": task.assignee,
                    "status": task.status,
                    "start": task.start,
                    "end": task.end,
                    "progress": task.progress,
                    "depends_on": list(task.depends_on),
                }
                for task in self.tasks
            ],
            "wall_types": [
                {
                    "id": wall_type.id,
                    "name": wall_type.name,
                    "layers": [
                        {
                            "name": layer.name,
                            "material": layer.material,
                            "thickness": layer.thickness,
                        }
                        for layer in wall_type.layers
                    ],
                }
                for wall_type in self.wall_types
            ],
            "dimensions": [
                {
                    "id": dimension.id,
                    "view_id": dimension.view_id,
                    "start": list(dimension.start),
                    "end": list(dimension.end),
                    "offset": dimension.offset,
                }
                for dimension in self.dimensions
            ],
            "sheets": [
                {
                    "id": sheet.id,
                    "name": sheet.name,
                    "title": sheet.title,
                    "placements": [
                        {
                            "id": placement.id,
                            "view_id": placement.view_id,
                            "x": placement.x,
                            "y": placement.y,
                        }
                        for placement in sheet.placements
                    ],
                }
                for sheet in self.sheets
            ],
        }

    @classmethod
    def from_json(cls, value: str) -> "NativeBimProject":
        data = json.loads(value)
        return cls(
            id=data["id"],
            name=data["name"],
            site_name=data["site_name"],
            building_name=data["building_name"],
            storey_name=data["storey_name"],
            grid_axes=[
                GridDatum(
                    id=axis["id"],
                    name=axis["name"],
                    start=tuple(axis["start"]),
                    end=tuple(axis["end"]),
                    system_name=axis["system_name"],
                    head_type=axis.get("head_type", "CIRCLE"),
                    head_scale=axis.get("head_scale", 1.0),
                    line_pattern=axis.get("line_pattern", "CENTER"),
                    line_weight_mm=axis.get("line_weight_mm", 0.25),
                )
                for axis in data["grid_axes"]
            ],
            views=[
                TechnicalView(
                    id=view["id"],
                    name=view["name"],
                    view_type=view["view_type"],
                    scale=view.get("scale", 100),
                    ortho_scale=view.get("ortho_scale", 20.0),
                    level_id=view.get("level_id"),
                )
                for view in data.get("views", [])
            ],
            walls=[
                NativeWall(
                    id=wall["id"],
                    name=wall["name"],
                    start=tuple(wall["start"]),
                    end=tuple(wall["end"]),
                    thickness=wall.get("thickness", 0.2),
                    height=wall.get("height", 3.0),
                    join_start=wall.get("join_start", "MITER"),
                    join_end=wall.get("join_end", "MITER"),
                    level_id=wall.get("level_id"),
                    type_id=wall.get("type_id"),
                    openings=tuple(
                        WallOpening(
                            id=opening["id"],
                            name=opening["name"],
                            kind=opening["kind"],
                            offset=opening["offset"],
                            width=opening["width"],
                            height=opening["height"],
                            sill_height=opening.get("sill_height", 0.0),
                            hinge_end=opening.get("hinge_end", "START"),
                            swing_side=opening.get("swing_side", "LEFT"),
                        )
                        for opening in wall.get("openings", [])
                    ),
                )
                for wall in data.get("walls", [])
            ],
            levels=[
                LevelDatum(
                    id=level["id"],
                    name=level["name"],
                    elevation=level.get("elevation", 0.0),
                )
                for level in data.get("levels", [])
            ],
            slabs=[
                SlabDatum(
                    id=slab["id"],
                    name=slab["name"],
                    kind=slab["kind"],
                    outline=tuple(tuple(point) for point in slab["outline"]),
                    thickness=slab.get("thickness", 0.2),
                    level_id=slab.get("level_id"),
                    z_offset=slab.get("z_offset", 0.0),
                )
                for slab in data.get("slabs", [])
            ],
            schedules=[
                ScheduleDatum(
                    id=schedule["id"],
                    name=schedule["name"],
                    kind=schedule.get("kind", "WALL"),
                )
                for schedule in data.get("schedules", [])
            ],
            wall_types=[
                WallTypeDatum(
                    id=wall_type["id"],
                    name=wall_type["name"],
                    layers=tuple(
                        WallLayer(
                            name=layer["name"],
                            material=layer["material"],
                            thickness=layer["thickness"],
                        )
                        for layer in wall_type.get("layers", [])
                    ),
                )
                for wall_type in data.get("wall_types", [])
            ],
            dimensions=[
                DimensionDatum(
                    id=dimension["id"],
                    view_id=dimension["view_id"],
                    start=tuple(dimension["start"]),
                    end=tuple(dimension["end"]),
                    offset=dimension.get("offset", 1.0),
                )
                for dimension in data.get("dimensions", [])
            ],
            documents=[
                DocumentDatum(
                    id=document["id"],
                    code=document["code"],
                    title=document.get("title", ""),
                    status=document.get("status", "WIP"),
                    revisions=tuple(
                        DocumentRevision(
                            id=revision["id"],
                            rev=revision["rev"],
                            note=revision.get("note", ""),
                            file_key=revision.get("file_key"),
                            file_name=revision.get("file_name"),
                            uploaded_at=revision.get("uploaded_at", ""),
                        )
                        for revision in document.get("revisions", [])
                    ),
                    notes=tuple(
                        DocumentNote(
                            id=note["id"],
                            text=note["text"],
                            author=note.get("author", ""),
                            at=note.get("at", ""),
                        )
                        for note in document.get("notes", [])
                    ),
                )
                for document in data.get("documents", [])
            ],
            tasks=[
                TaskDatum(
                    id=task["id"],
                    name=task["name"],
                    category=task.get("category", ""),
                    assignee=task.get("assignee", ""),
                    status=task.get("status", "NOT_STARTED"),
                    start=task.get("start", ""),
                    end=task.get("end", ""),
                    progress=task.get("progress", 0.0),
                    depends_on=tuple(task.get("depends_on", [])),
                )
                for task in data.get("tasks", [])
            ],
            sheets=[
                SheetDatum(
                    id=sheet["id"],
                    name=sheet["name"],
                    title=sheet.get("title", ""),
                    placements=tuple(
                        SheetPlacement(
                            id=placement["id"],
                            view_id=placement["view_id"],
                            x=placement["x"],
                            y=placement["y"],
                        )
                        for placement in sheet.get("placements", [])
                    ),
                )
                for sheet in data.get("sheets", [])
            ],
        )

    def add_view(
        self,
        name: str,
        view_type: str,
        scale: int = 100,
        ortho_scale: float = 20.0,
    ) -> TechnicalView:
        normalized_type = view_type.upper()
        if normalized_type not in {"FLOOR_PLAN", "SECTION", "ELEVATION"}:
            raise ValueError(f"Unsupported technical view type: {view_type}")
        if scale <= 0:
            raise ValueError("View scale denominator must be greater than zero")
        if ortho_scale <= 0.0:
            raise ValueError("Camera ortho scale must be greater than zero")
        view = TechnicalView(
            id=uuid4().hex,
            name=name,
            view_type=normalized_type,
            scale=scale,
            ortho_scale=ortho_scale,
        )
        self.views.append(view)
        return view

    def update_view(
        self,
        view_id: str,
        *,
        name: str | None = None,
        scale: int | None = None,
        ortho_scale: float | None = None,
    ) -> TechnicalView:
        for index, view in enumerate(self.views):
            if view.id != view_id:
                continue
            updated = TechnicalView(
                id=view.id,
                name=view.name if name is None else name,
                view_type=view.view_type,
                scale=view.scale if scale is None else scale,
                ortho_scale=view.ortho_scale if ortho_scale is None else ortho_scale,
            )
            if updated.scale <= 0:
                raise ValueError("View scale denominator must be greater than zero")
            if updated.ortho_scale <= 0.0:
                raise ValueError("Camera ortho scale must be greater than zero")
            self.views[index] = updated
            return updated
        raise KeyError(f"Unknown TechnicalView: {view_id}")

    def remove_view(self, view_id: str) -> TechnicalView:
        for index, view in enumerate(self.views):
            if view.id == view_id:
                return self.views.pop(index)
        raise KeyError(f"Unknown TechnicalView: {view_id}")

    def translate_wall(self, wall_id: str, dx: float, dy: float) -> NativeWall:
        """Move a native wall in plan (z stays bound to its level).

        Blender edits write back through this: dragging a NativeWall mesh
        translates the wall's axis; openings ride along since offsets are
        relative to the wall start.
        """
        from dataclasses import replace

        for index, wall in enumerate(self.walls):
            if wall.id != wall_id:
                continue
            moved = replace(
                wall,
                start=(wall.start[0] + dx, wall.start[1] + dy, wall.start[2]),
                end=(wall.end[0] + dx, wall.end[1] + dy, wall.end[2]),
            )
            self.walls[index] = moved
            return moved
        raise KeyError(f"Unknown NativeWall: {wall_id}")

    def set_wall_axis(self, wall_id: str, start, end) -> NativeWall:
        """Update a native wall's plan axis from Blender endpoint edits.

        Only x/y are taken from the edited curve; z stays bound to the
        wall's level. Openings keep their start-relative offsets.
        """
        from dataclasses import replace

        for index, wall in enumerate(self.walls):
            if wall.id != wall_id:
                continue
            new_start = (float(start[0]), float(start[1]), wall.start[2])
            new_end = (float(end[0]), float(end[1]), wall.end[2])
            if new_start[:2] == new_end[:2]:
                raise ValueError("Wall endpoints must be different")
            moved = replace(wall, start=new_start, end=new_end)
            self.walls[index] = moved
            return moved
        raise KeyError(f"Unknown NativeWall: {wall_id}")

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
        if start == end:
            raise ValueError("A grid axis requires two different points")
        if head_scale <= 0.0:
            raise ValueError("Grid head scale must be greater than zero")
        axis = GridDatum(
            id=uuid4().hex,
            name=_letter_label(len(self.grid_axes)),
            start=start,
            end=end,
            system_name=system_name,
            head_type=head_type,
            head_scale=head_scale,
            line_pattern=line_pattern,
            line_weight_mm=line_weight_mm,
        )
        self.grid_axes.append(axis)
        return axis

    def update_grid_axis(
        self,
        axis_id: str,
        *,
        start: Point3D | None = None,
        end: Point3D | None = None,
        head_type: str | None = None,
        head_scale: float | None = None,
        line_pattern: str | None = None,
        line_weight_mm: float | None = None,
    ) -> GridDatum:
        for index, axis in enumerate(self.grid_axes):
            if axis.id != axis_id:
                continue
            updated = GridDatum(
                id=axis.id,
                name=axis.name,
                start=axis.start if start is None else start,
                end=axis.end if end is None else end,
                system_name=axis.system_name,
                head_type=axis.head_type if head_type is None else head_type,
                head_scale=axis.head_scale if head_scale is None else head_scale,
                line_pattern=axis.line_pattern if line_pattern is None else line_pattern,
                line_weight_mm=(
                    axis.line_weight_mm if line_weight_mm is None else line_weight_mm
                ),
            )
            if updated.start == updated.end:
                raise ValueError("A grid axis requires two different points")
            if updated.head_scale <= 0.0:
                raise ValueError("Grid head scale must be greater than zero")
            self.grid_axes[index] = updated
            return updated
        raise KeyError(f"Unknown GridDatum: {axis_id}")

    def remove_grid_axis(self, axis_id: str) -> GridDatum:
        for index, axis in enumerate(self.grid_axes):
            if axis.id == axis_id:
                return self.grid_axes.pop(index)
        raise KeyError(f"Unknown GridDatum: {axis_id}")


def _letter_label(index: int) -> str:
    label = ""
    value = index + 1
    while value:
        value, remainder = divmod(value - 1, 26)
        label = chr(65 + remainder) + label
    return label
