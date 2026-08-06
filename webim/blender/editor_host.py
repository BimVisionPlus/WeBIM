from __future__ import annotations

from collections import OrderedDict
from typing import ClassVar

import bpy
from bpy.props import EnumProperty, PointerProperty

SCENE_PANEL_REGISTRY = OrderedDict(
    (
        ("BLENDER_SCENE", "BLENDER_DEFAULT_SCENE_PANELS"),
        ("PROJECT_BROWSER", "WEBIM_PT_project_browser"),
        ("PROPERTIES", "WEBIM_PT_properties"),
    )
)
SCENE_PANEL_IDS = tuple(SCENE_PANEL_REGISTRY)

_PANEL_ITEMS = (
    (
        "BLENDER_SCENE",
        "Blender Scene",
        "Show Blender's standard Scene properties",
        "SCENE_DATA",
        0,
    ),
    (
        "PROJECT_BROWSER",
        "Project Browser",
        "Browse views, model elements, sheets, and schedules",
        "OUTLINER",
        1,
    ),
    (
        "PROPERTIES",
        "Properties",
        "Edit the selected BIM element or active technical view",
        "PROPERTIES",
        2,
    ),
)

_PATCHED_SCENE_PANELS: dict[type, object | None] = {}


def _update_active_panel(_self, _context) -> None:
    # Blender registers some built-in Scene panels after extensions. Re-scan
    # when the user changes mode so every currently registered panel is gated.
    install_blender_scene_panel_filter()


class WEBIMSceneWorkspaceProperties(bpy.types.PropertyGroup):
    """Scene-level state for the separated WeBIM Properties Editor workspace."""

    active_panel: EnumProperty(
        name="Scene workspace",
        items=_PANEL_ITEMS,
        default="BLENDER_SCENE",
        update=_update_active_panel,
    )


def active_scene_panel(context) -> str:
    scene = getattr(context, "scene", None)
    props = getattr(scene, "webim_scene_workspace", None)
    return props.active_panel if props is not None else "BLENDER_SCENE"


def blender_scene_panel_visible(context) -> bool:
    return active_scene_panel(context) == "BLENDER_SCENE"


def _is_default_blender_scene_panel(panel) -> bool:
    return (
        panel.__module__.startswith("bl_ui.")
        and getattr(panel, "bl_space_type", "") == "PROPERTIES"
        and getattr(panel, "bl_context", "") == "scene"
    )


def _combined_scene_poll(original_poll):
    def poll(panel_cls, context):
        if not blender_scene_panel_visible(context):
            return False
        if original_poll is None:
            return True
        return original_poll.__get__(None, panel_cls)(context)

    return classmethod(poll)


def install_blender_scene_panel_filter() -> None:
    """Gate Blender's registered native Scene panels behind Blender Scene mode."""
    for type_name in dir(bpy.types):
        panel = getattr(bpy.types, type_name)
        if (
            not hasattr(panel, "bl_rna")
            or not issubclass(panel, bpy.types.Panel)
            or not _is_default_blender_scene_panel(panel)
            or panel in _PATCHED_SCENE_PANELS
        ):
            continue
        original_poll = panel.__dict__.get("poll")
        _PATCHED_SCENE_PANELS[panel] = original_poll
        panel.poll = _combined_scene_poll(original_poll)
        bpy.utils.unregister_class(panel)
        bpy.utils.register_class(panel)


def install_blender_scene_panel_filter_deferred():
    """Re-scan after Blender finishes registering its built-in UI panels."""
    install_blender_scene_panel_filter()


def restore_blender_scene_panel_filter() -> None:
    """Restore Blender's panel classes exactly as they were before registration."""
    for panel, original_poll in tuple(_PATCHED_SCENE_PANELS.items()):
        bpy.utils.unregister_class(panel)
        if original_poll is None:
            if "poll" in panel.__dict__:
                del panel.poll
        else:
            panel.poll = original_poll
        bpy.utils.register_class(panel)
    _PATCHED_SCENE_PANELS.clear()


class WEBIM_PT_scene_root(bpy.types.Panel):
    """Three-way host for Blender Scene, Project Browser, and Properties."""

    bl_label = "WeBIM"
    bl_idname = "WEBIM_PT_scene_root"
    bl_space_type = "PROPERTIES"
    bl_region_type = "WINDOW"
    bl_context = "scene"
    bl_order = 0
    bl_options: ClassVar[set[str]] = {"HIDE_HEADER"}

    def draw(self, context):
        layout = self.layout
        props = context.scene.webim_scene_workspace

        title = layout.row(align=True)
        title.alignment = "CENTER"
        title.label(text="Scene Workspace", icon="SCENE_DATA")

        tabs = layout.row(align=True)
        tabs.alignment = "CENTER"
        tabs.prop(props, "active_panel", expand=True)


_CLASSES = (
    WEBIMSceneWorkspaceProperties,
    WEBIM_PT_scene_root,
)


def register() -> None:
    for cls in _CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.webim_scene_workspace = PointerProperty(
        type=WEBIMSceneWorkspaceProperties
    )
    install_blender_scene_panel_filter()
    if not bpy.app.timers.is_registered(install_blender_scene_panel_filter_deferred):
        bpy.app.timers.register(
            install_blender_scene_panel_filter_deferred,
            first_interval=0.5,
        )


def unregister() -> None:
    if bpy.app.timers.is_registered(install_blender_scene_panel_filter_deferred):
        bpy.app.timers.unregister(install_blender_scene_panel_filter_deferred)
    restore_blender_scene_panel_filter()
    del bpy.types.Scene.webim_scene_workspace
    for cls in reversed(_CLASSES):
        bpy.utils.unregister_class(cls)
