"""View-independent graphics styles for technical drawings."""

from .line_styles import (
    LINE_PATTERNS,
    LINE_WEIGHTS_MM,
    LinePattern,
    LineStyle,
    dash_spans,
    lineweight_radius_model_units,
    paper_mm_to_model_units,
)

__all__ = (
    "LINE_PATTERNS",
    "LINE_WEIGHTS_MM",
    "LinePattern",
    "LineStyle",
    "dash_spans",
    "lineweight_radius_model_units",
    "paper_mm_to_model_units",
)
