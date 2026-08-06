import bpy

from .gizmo import (
    WEBIM_GGT_grid_endpoints,
    WEBIM_OT_drag_grid_endpoint,
)
from .operator import WEBIM_OT_create_grid
from .overlay import register as register_overlay
from .overlay import unregister as unregister_overlay
from .panel import WEBIM_PT_grid as WEBIM_PT_grid
from .properties import WEBIMGridProperties

_CLASSES = (
    WEBIMGridProperties,
    WEBIM_OT_create_grid,
    WEBIM_OT_drag_grid_endpoint,
    WEBIM_GGT_grid_endpoints,
)


def register() -> None:
    for cls in _CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.webim_grid = bpy.props.PointerProperty(
        type=WEBIMGridProperties
    )
    register_overlay()


def unregister() -> None:
    unregister_overlay()
    del bpy.types.Scene.webim_grid
    for cls in reversed(_CLASSES):
        bpy.utils.unregister_class(cls)
