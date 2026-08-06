from webim.tools.registry import get_tool, iter_tools


def test_tool_registry_exposes_one_module_per_authoring_tool():
    definitions = list(iter_tools())

    assert [tool.key for tool in definitions] == [
        "grid",
        "wall",
        "slab",
        "column",
        "beam",
        "door",
        "window",
        "opening",
    ]
    assert get_tool("grid").status == "active"
    assert get_tool("slab").module == "webim.tools.slab"
