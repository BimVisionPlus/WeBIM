from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass

LINE_WEIGHTS_MM = (0.13, 0.18, 0.25, 0.35, 0.5, 0.7)


@dataclass(frozen=True, slots=True)
class LinePattern:
    name: str
    segments_mm: tuple[float, ...] = ()

    def __post_init__(self) -> None:
        if any(segment <= 0.0 for segment in self.segments_mm):
            raise ValueError("Line pattern segments must be greater than zero")
        if self.segments_mm and len(self.segments_mm) % 2:
            raise ValueError("Line pattern segments must alternate draw and gap lengths")


LINE_PATTERNS = OrderedDict(
    (
        ("CONTINUOUS", LinePattern("Continuous")),
        ("DASHED", LinePattern("Dashed", (3.0, 2.0))),
        ("DOTTED", LinePattern("Dotted", (0.5, 1.5))),
        ("DASH_DOT", LinePattern("Dash Dot", (6.0, 2.0, 0.5, 2.0))),
        ("CENTER", LinePattern("Center", (12.5, 3.0, 3.0, 3.0))),
        ("HIDDEN", LinePattern("Hidden", (4.0, 2.0))),
    )
)


@dataclass(frozen=True, slots=True)
class LineStyle:
    name: str
    pattern_id: str = "CONTINUOUS"
    weight_mm: float = 0.25
    color: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 1.0)

    def __post_init__(self) -> None:
        if self.pattern_id not in LINE_PATTERNS:
            raise ValueError(f"Unknown line pattern: {self.pattern_id}")
        if self.weight_mm not in LINE_WEIGHTS_MM:
            raise ValueError(f"Unsupported line weight: {self.weight_mm} mm")
        if len(self.color) != 4 or any(channel < 0.0 or channel > 1.0 for channel in self.color):
            raise ValueError("Line style color must contain four channels between zero and one")

    @property
    def pattern(self) -> LinePattern:
        return LINE_PATTERNS[self.pattern_id]


def paper_mm_to_model_units(paper_mm: float, view_scale: int) -> float:
    """Convert millimetres on paper to metres in model space."""
    if paper_mm < 0.0:
        raise ValueError("Paper length cannot be negative")
    if view_scale <= 0:
        raise ValueError("View scale denominator must be greater than zero")
    return paper_mm * view_scale / 1000.0


def lineweight_radius_model_units(weight_mm: float, view_scale: int) -> float:
    """Curve bevel radius for a requested full printed line width."""
    return paper_mm_to_model_units(weight_mm, view_scale) / 2.0


def dash_spans(
    length: float,
    pattern: LinePattern,
    view_scale: int,
) -> tuple[tuple[float, float], ...]:
    """Return visible distances along a line for a paper-space pattern."""
    if length <= 0.0:
        raise ValueError("Line length must be greater than zero")
    if not pattern.segments_mm:
        return ((0.0, length),)

    cycle = tuple(paper_mm_to_model_units(value, view_scale) for value in pattern.segments_mm)
    spans: list[tuple[float, float]] = []
    distance = 0.0
    index = 0
    while distance < length:
        segment_end = min(distance + cycle[index], length)
        if index % 2 == 0 and segment_end > distance:
            spans.append((distance, segment_end))
        distance = segment_end
        index = (index + 1) % len(cycle)
    return tuple(spans)
