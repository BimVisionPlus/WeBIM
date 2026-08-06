import bpy

from .editor_host import register as register_editor_host
from .editor_host import unregister as unregister_editor_host
from .element_properties import register as register_element_properties
from .element_properties import unregister as unregister_element_properties
from .menus import (
    WEBIM_MT_add,
    draw_webim_add_menu,
    draw_webim_export_menu,
)
from .operators import (
    WEBIM_OT_create_wall,
    WEBIM_OT_save_ifc,
)
from .persistence import register as register_persistence
from .persistence import unregister as unregister_persistence
from .project_browser import register as register_project_browser
from .project_browser import unregister as unregister_project_browser
from .properties import WEBIMProperties
from .synchronization import register as register_synchronization
from .synchronization import unregister as unregister_synchronization
from .tools.grid import register as register_grid
from .tools.grid import unregister as unregister_grid
from .views import register as register_views
from .views import unregister as unregister_views

_CLASSES = (
    WEBIMProperties,
    WEBIM_OT_create_wall,
    WEBIM_OT_save_ifc,
    WEBIM_MT_add,
)


def register() -> None:
    for cls in _CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.webim = bpy.props.PointerProperty(type=WEBIMProperties)
    register_grid()
    register_views()
    register_editor_host()
    register_project_browser()
    register_element_properties()
    register_persistence()
    register_synchronization()
    bpy.types.VIEW3D_MT_add.append(draw_webim_add_menu)
    bpy.types.TOPBAR_MT_file_export.append(draw_webim_export_menu)


def unregister() -> None:
    bpy.types.TOPBAR_MT_file_export.remove(draw_webim_export_menu)
    bpy.types.VIEW3D_MT_add.remove(draw_webim_add_menu)
    unregister_synchronization()
    unregister_persistence()
    unregister_element_properties()
    unregister_project_browser()
    unregister_editor_host()
    unregister_views()
    unregister_grid()
    del bpy.types.Scene.webim
    for cls in reversed(_CLASSES):
        bpy.utils.unregister_class(cls)
