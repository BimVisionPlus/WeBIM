from __future__ import annotations

from typing import ClassVar

import bpy
from bpy.props import BoolProperty, StringProperty

from webim.tools.registry import iter_tools

from .state import SESSION
from .views import (
    _DEFAULT_ROTATIONS,
    _configure_camera,
    _default_camera_location,
    refresh_view_annotations,
)

_VIEW_GROUPS = (
    ("FLOOR_PLAN", "Floor Plans"),
    ("SECTION", "Sections"),
    ("ELEVATION", "Elevations"),
)
PROJECT_BROWSER_BRANCHES = ("VIEWS", "SCHEDULES", "SHEETS", "FAMILY_TYPES")


def _camera_for_view(view_id: str):
    return next(
        (
            obj
            for obj in bpy.data.objects
            if obj.type == "CAMERA" and obj.get("webim_view_id") == view_id
        ),
        None,
    )


def _delete_camera(camera) -> None:
    if camera is None:
        return
    data = camera.data
    bpy.data.objects.remove(camera, do_unlink=True)
    if data is not None and data.users == 0:
        bpy.data.cameras.remove(data)


class WEBIMProjectBrowserProperties(bpy.types.PropertyGroup):
    show_views: BoolProperty(name="Views", default=True)
    show_floor_plans: BoolProperty(name="Floor Plans", default=True)
    show_sections: BoolProperty(name="Sections", default=True)
    show_elevations: BoolProperty(name="Elevations", default=True)
    show_sheets: BoolProperty(name="Sheets", default=False)
    show_schedules: BoolProperty(name="Schedules", default=False)
    show_family_types: BoolProperty(name="Family Types", default=True)


class WEBIM_OT_browser_open_view(bpy.types.Operator):
    bl_idname = "webim.browser_open_view"
    bl_label = "Open View"
    bl_options: ClassVar[set[str]] = {"REGISTER"}

    view_id: StringProperty()

    def execute(self, context):
        project = SESSION.native_project
        view = next(
            (view for view in project.views if view.id == self.view_id),
            None,
        ) if project is not None else None
        camera = _camera_for_view(self.view_id)
        if view is None or camera is None:
            self.report({"WARNING"}, "Technical view was not found")
            return {"CANCELLED"}
        context.scene.camera = camera
        _configure_camera(camera, view)
        camera.lock_rotation = (True, True, True)
        for area in context.screen.areas:
            if area.type != "VIEW_3D":
                continue
            space = area.spaces.active
            space.region_3d.view_perspective = "CAMERA"
            space.region_3d.lock_rotation = True
            space.lock_camera = False
        props = context.scene.webim_view
        props["name"] = view.name
        props["view_type"] = view.view_type
        props["scale"] = view.scale
        props["ortho_scale"] = view.ortho_scale
        refresh_view_annotations(context.scene)
        return {"FINISHED"}


class WEBIM_OT_browser_duplicate_view(bpy.types.Operator):
    bl_idname = "webim.browser_duplicate_view"
    bl_label = "Duplicate View"
    bl_options: ClassVar[set[str]] = {"REGISTER", "UNDO"}

    view_id: StringProperty()

    def execute(self, context):
        project = SESSION.native_project
        if project is None:
            return {"CANCELLED"}
        source = next((view for view in project.views if view.id == self.view_id), None)
        if source is None:
            self.report({"WARNING"}, "Native technical view was not found")
            return {"CANCELLED"}
        existing_names = {view.name for view in project.views}
        base = f"{source.name} Copy"
        name = base
        index = 2
        while name in existing_names:
            name = f"{base} {index}"
            index += 1
        duplicated = project.add_view(
            name,
            source.view_type,
            scale=source.scale,
            ortho_scale=source.ortho_scale,
        )
        source_camera = _camera_for_view(source.id)
        camera_data = (
            source_camera.data.copy()
            if source_camera is not None
            else bpy.data.cameras.new(f"{duplicated.name} Camera")
        )
        camera = bpy.data.objects.new(duplicated.name, camera_data)
        if source_camera is not None:
            camera.matrix_world = source_camera.matrix_world.copy()
        else:
            camera.location = _default_camera_location(
                duplicated.view_type, duplicated.ortho_scale
            )
            camera.rotation_euler = _DEFAULT_ROTATIONS[duplicated.view_type]
        context.scene.collection.objects.link(camera)
        _configure_camera(camera, duplicated)
        context.scene.camera = camera
        refresh_view_annotations(context.scene)
        SESSION.is_dirty = True
        self.report({"INFO"}, f"Duplicated view: {duplicated.name}")
        return {"FINISHED"}


class WEBIM_OT_browser_delete_view(bpy.types.Operator):
    bl_idname = "webim.browser_delete_view"
    bl_label = "Delete View"
    bl_options: ClassVar[set[str]] = {"REGISTER", "UNDO"}

    view_id: StringProperty()

    def invoke(self, context, event):
        return context.window_manager.invoke_confirm(self, event)

    def execute(self, context):
        project = SESSION.native_project
        if project is None:
            return {"CANCELLED"}
        try:
            removed = project.remove_view(self.view_id)
        except KeyError:
            self.report({"WARNING"}, "Native technical view was not found")
            return {"CANCELLED"}
        camera = _camera_for_view(self.view_id)
        was_active = context.scene.camera == camera
        _delete_camera(camera)
        if was_active:
            context.scene.camera = next(
                (
                    _camera_for_view(view.id)
                    for view in project.views
                    if _camera_for_view(view.id) is not None
                ),
                None,
            )
        refresh_view_annotations(context.scene)
        SESSION.is_dirty = True
        self.report({"INFO"}, f"Deleted view: {removed.name}")
        return {"FINISHED"}


class WEBIM_PT_project_browser(bpy.types.Panel):
    bl_label = "Project Browser"
    bl_idname = "WEBIM_PT_project_browser"
    bl_space_type = "PROPERTIES"
    bl_region_type = "WINDOW"
    bl_context = "scene"
    bl_parent_id = "WEBIM_PT_scene_root"
    bl_order = 10
    bl_options: ClassVar[set[str]] = {"HIDE_HEADER"}

    @classmethod
    def poll(cls, context):
        from .editor_host import active_scene_panel

        return active_scene_panel(context) == "PROJECT_BROWSER"

    def draw(self, context):
        layout = self.layout
        props = context.scene.webim_project_browser
        project = SESSION.native_project
        if project is None:
            layout.label(text="Project will be created with the first element", icon="INFO")
            return

        project_box = layout.box()
        project_box.label(text=project.name, icon="HOME")
        self._draw_views(layout, props, project)
        self._draw_empty_branch(layout, props, "show_schedules", "Schedules", "PRESET")
        self._draw_empty_branch(layout, props, "show_sheets", "Sheets", "FILE_BLANK")
        self._draw_family_types(layout, props)

    def _draw_views(self, layout, props, project):
        header = layout.row(align=True)
        header.prop(
            props,
            "show_views",
            text="",
            icon="TRIA_DOWN" if props.show_views else "TRIA_RIGHT",
            emboss=False,
        )
        header.label(text="Views", icon="VIEW_CAMERA")
        if not props.show_views:
            return
        views_box = layout.box()
        for view_type, label in _VIEW_GROUPS:
            property_name = {
                "FLOOR_PLAN": "show_floor_plans",
                "SECTION": "show_sections",
                "ELEVATION": "show_elevations",
            }[view_type]
            views = [view for view in project.views if view.view_type == view_type]
            row = views_box.row(align=True)
            is_open = getattr(props, property_name)
            row.prop(
                props,
                property_name,
                text="",
                icon="TRIA_DOWN" if is_open else "TRIA_RIGHT",
                emboss=False,
            )
            row.label(text=f"{label} ({len(views)})", icon="VIEW_ORTHO")
            if not is_open:
                continue
            for view in views:
                item = views_box.row(align=True)
                open_operator = item.operator(
                    WEBIM_OT_browser_open_view.bl_idname,
                    text=view.name,
                    icon="RESTRICT_VIEW_OFF",
                )
                open_operator.view_id = view.id
                item.label(text=f"1:{view.scale}")
                duplicate = item.operator(
                    WEBIM_OT_browser_duplicate_view.bl_idname,
                    text="",
                    icon="DUPLICATE",
                )
                duplicate.view_id = view.id
                delete = item.operator(
                    WEBIM_OT_browser_delete_view.bl_idname,
                    text="",
                    icon="X",
                )
                delete.view_id = view.id

    @staticmethod
    def _draw_family_types(layout, props):
        row = layout.row(align=True)
        row.prop(
            props,
            "show_family_types",
            text="",
            icon="TRIA_DOWN" if props.show_family_types else "TRIA_RIGHT",
            emboss=False,
        )
        tools = tuple(iter_tools())
        row.label(text=f"Family Types ({len(tools)})", icon="ASSET_MANAGER")
        if not props.show_family_types:
            return
        box = layout.box()
        for tool in tools:
            item = box.row(align=True)
            item.label(text=tool.label, icon="OBJECT_DATA")
            item.label(text=tool.ifc_class)
            if tool.status != "active":
                item.label(text="Planned", icon="TIME")

    @staticmethod
    def _draw_empty_branch(layout, props, property_name, label, icon):
        row = layout.row(align=True)
        row.prop(
            props,
            property_name,
            text="",
            icon="TRIA_DOWN" if getattr(props, property_name) else "TRIA_RIGHT",
            emboss=False,
        )
        row.label(text=label, icon=icon)
        if getattr(props, property_name):
            box = layout.box()
            box.label(text="No items", icon="INFO")


_CLASSES = (
    WEBIMProjectBrowserProperties,
    WEBIM_OT_browser_open_view,
    WEBIM_OT_browser_duplicate_view,
    WEBIM_OT_browser_delete_view,
    WEBIM_PT_project_browser,
)


def register() -> None:
    for cls in _CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.webim_project_browser = bpy.props.PointerProperty(
        type=WEBIMProjectBrowserProperties
    )


def unregister() -> None:
    del bpy.types.Scene.webim_project_browser
    for cls in reversed(_CLASSES):
        bpy.utils.unregister_class(cls)
