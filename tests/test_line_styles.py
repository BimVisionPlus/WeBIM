import pytest

from webim.domain.graphics.line_styles import (
    LINE_PATTERNS,
    LINE_WEIGHTS_MM,
    LineStyle,
    dash_spans,
    lineweight_radius_model_units,
    paper_mm_to_model_units,
)


def test_revit_style_library_exposes_reusable_patterns_and_lineweights():
    assert tuple(LINE_PATTERNS) == (
        "CONTINUOUS",
        "DASHED",
        "DOTTED",
        "DASH_DOT",
        "CENTER",
        "HIDDEN",
    )
    assert LINE_PATTERNS["DASHED"].segments_mm == (3.0, 2.0)
    assert LINE_PATTERNS["CENTER"].segments_mm == (12.5, 3.0, 3.0, 3.0)
    assert LINE_WEIGHTS_MM == (0.13, 0.18, 0.25, 0.35, 0.5, 0.7)


def test_paper_lineweight_and_pattern_convert_using_view_scale():
    assert paper_mm_to_model_units(3.0, 100) == pytest.approx(0.3)
    assert paper_mm_to_model_units(3.0, 50) == pytest.approx(0.15)
    assert lineweight_radius_model_units(0.25, 100) == pytest.approx(0.0125)

    spans = dash_spans(1.0, LINE_PATTERNS["DASHED"], view_scale=100)
    assert len(spans) == 2
    assert spans[0] == pytest.approx((0.0, 0.3))
    assert spans[1] == pytest.approx((0.5, 0.8))


def test_continuous_pattern_returns_one_span_and_styles_validate_values():
    assert dash_spans(5.0, LINE_PATTERNS["CONTINUOUS"], 100) == ((0.0, 5.0),)
    style = LineStyle("Grid", "CENTER", 0.25)
    assert style.pattern is LINE_PATTERNS["CENTER"]

    with pytest.raises(ValueError, match="Unknown line pattern"):
        LineStyle("Invalid", "MISSING", 0.25)
    with pytest.raises(ValueError, match="Unsupported line weight"):
        LineStyle("Invalid", "CONTINUOUS", 0.3)
    with pytest.raises(ValueError, match="greater than zero"):
        dash_spans(0.0, LINE_PATTERNS["DASHED"], 100)
