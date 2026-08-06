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


@dataclass(slots=True)
class NativeBimProject:
    id: str
    name: str
    site_name: str
    building_name: str
    storey_name: str
    grid_axes: list[GridDatum] = field(default_factory=list)
    views: list[TechnicalView] = field(default_factory=list)

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
                }
                for view in self.views
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
                )
                for view in data.get("views", [])
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
