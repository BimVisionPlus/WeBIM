from collections.abc import Iterator

from .base import ToolDefinition
from .beam import DEFINITION as BEAM
from .column import DEFINITION as COLUMN
from .door import DEFINITION as DOOR
from .grid import DEFINITION as GRID
from .opening import DEFINITION as OPENING
from .slab import DEFINITION as SLAB
from .wall import DEFINITION as WALL
from .window import DEFINITION as WINDOW

_TOOLS = (GRID, WALL, SLAB, COLUMN, BEAM, DOOR, WINDOW, OPENING)


def iter_tools() -> Iterator[ToolDefinition]:
    return iter(_TOOLS)


def get_tool(key: str) -> ToolDefinition:
    for tool in _TOOLS:
        if tool.key == key:
            return tool
    raise KeyError(key)
