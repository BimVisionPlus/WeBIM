from webim.core.wall import WallInput, create_wall
from webim.tools.base import ToolDefinition

DEFINITION = ToolDefinition("wall", "Wall", "IfcWall", "active", __name__)

__all__ = ["DEFINITION", "WallInput", "create_wall"]
