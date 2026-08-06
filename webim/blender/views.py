from __future__ import annotations

from typing import ClassVar

import bpy
from bpy.props import EnumProperty, FloatProperty, IntProperty, StringProperty
from mathutils import Euler

from .state import SESSION, ensure_project

_VIEW_TYPES = (
    ("FLOOR_PLAN", "Floor Plan", "Horizontal technical plan view"),
    ("SECTION", "Section", "Vertical technical section view"),
    ("ELEVATION", "Elevation", "Vertical technical elevation view"),
)

_DEFAULT_ROTATIONS = {
    "FLOOR_PLAN": (0.0, 0.0, 0.0),
    "SECTION": (1.5707963267948966, 0.0, 0.0),
    "ELEVATION": (1.5707963267948966, 0.0, -1.5707963267948966),
}


def _default_camera_location(view_type: str, extent: float):
    distance = max(extent, 10.0)
    if view_type == "FLOOR_PLAN":
        return (0.0, 0.0, distance)
    if view_type == "SECTION":
        return (0.0, -distance, 0.0)
    return (-distance, 0.0, 0.0)


def _active_native_view(context):
    obj = context.scene.camera or context.active_object
    if obj is None or obj.type != "CAMERA":
        return None, None
    view_id = obj.get("webim_view_id", "")
    project = SESSION.native_project
    if project is None:
        return obj, None
    return obj, next((view for view in project.views if view.id == view_id), None)


def annotation_view_factor(scene) -> float:
    """Convert paper-size annotation from the 1:100 baseline into model units."""
    camera = scene.camera
    if camera is None or camera.get("webim_class") != "TechnicalView":
        return 1.0
    denominator = int(camera.get("webim_view_scale", 100))
    return max(denominator, 1) / 100.0


def refresh_view_annotations(scene) -> None:
    from .tools.grid.renderer import (
        update_grid_axis_object,
        update_grid_head_positions,
    )

    project = SESSION.native_project
    if project is None:
        return
    camera = scene.camera
    view_scale = (
        max(int(camera.get("webim_view_scale", 100)), 1)
        if camera is not None and camera.get("webim_class") == "TechnicalView"
        else 100
    )
    for axis in project.grid_axes:
        grid_obj = next(
            (
                obj
                for obj in bpy.data.objects
                if obj.get("webim_class") == "GridDatum"
                and obj.get("webim_id") == axis.id
            ),
            None,
        )
        if grid_obj is not None:
            update_grid_axis_object(grid_obj, axis, view_scale=view_scale)
        update_grid_head_positions(axis)


def _configure_camera(camera, view) -> None:
    camera.name = view.name
    camera.data.name = f"{view.name} Camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = view.ortho_scale
    camera.rotation_mode = "XYZ"
    camera.lock_rotation = (True, True, True)
    camera["webim_class"] = "TechnicalView"
    camera["webim_view_id"] = view.id
    camera["webim_view_type"] = view.view_type
    camera["webim_view_scale"] = view.scale
    camera["webim_rotation_locked"] = True


def synchronize_view_representations(project, scene) -> None:
    """Restore missing technical cameras and normalize all of them to orthographic."""
    cameras = {
        obj.get("webim_view_id", ""): obj
        for obj in bpy.data.objects
        if obj.type == "CAMERA" and obj.get("webim_class") == "TechnicalView"
    }
    for view in project.views:
        camera = cameras.get(view.id)
        if camera is None:
            camera_data = bpy.data.cameras.new(f"{view.name} Camera")
            camera = bpy.data.objects.new(view.name, camera_data)
            scene.collection.objects.link(camera)
            camera.location = _default_camera_location(view.view_type, view.ortho_scale)
            camera.rotation_euler = Euler(_DEFAULT_ROTATIONS[view.view_type], "XYZ")
        _configure_camera(camera, view)
    if scene.camera is None and project.views:
        scene.camera = next(
            obj
            for obj in bpy.data.objects
            if obj.get("webim_view_id") == project.views[0].id
        )
    refresh_view_annotations(scene)


def _update_active_view(self, context) -> None:
    camera, view = _active_native_view(context)
    if camera is None or view is None:
        return
    project = SESSION.native_project
    if project is None:
        return
    try:
        updated = project.update_view(
            view.id,
            name=self.name,
            scale=self.scale,
            ortho_scale=self.ortho_scale,
        )
    except (KeyError, ValueError):
        return
    camera.name = updated.name
    camera.data.name = f"{updated.name} Camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = updated.ortho_scale
    camera["webim_view_scale"] = updated.scale
    camera["webim_view_type"] = updated.view_type
    refresh_view_annotations(context.scene)
    SESSION.is_dirty = True


class WEBIMViewProperties(bpy.types.PropertyGroup):
    name: StringProperty(name="View name", default="Level 1 Floor Plan")
    view_type: EnumProperty(name="View type", items=_VIEW_TYPES, default="FLOOR_PLAN")
    scale: IntProperty(
        name="View scale",
        description="Drawing scale denominator: 50 means 1:50",
        default=100,
        min=1,
        max=10000,
        update=_update_active_view,
    )
    ortho_scale: FloatProperty(
        name="View extent",
        description="Orthographic camera width in model units",
        default=20.0,
        min=0.001,
        unit="LENGTH",
        update=_update_active_view,
    )


class WEBIM_OT_create_view(bpy.types.Operator):
    bl_idname = "webim.create_view"
    bl_label = "Create Technical View"
    bl_options: ClassVar[set[str]] = {"REGISTER", "UNDO"}

    view_type: EnumProperty(name="View type", items=_VIEW_TYPES, default="FLOOR_PLAN")
    name: StringProperty(name="View name")
    scale: IntProperty(name="View scale", default=100, min=1, max=10000)
    ortho_scale: FloatProperty(
        name="View extent", default=20.0, min=0.001, unit="LENGTH"
    )

    def invoke(self, context, event):
        default_label = {item[0]: item[1] for item in _VIEW_TYPES}[self.view_type]
        if not self.name:
            self.name = default_label
        return context.window_manager.invoke_props_dialog(self)

    def draw(self, context):
        layout = self.layout
        layout.prop(self, "name")
        layout.prop(self, "scale")
        layout.prop(self, "ortho_scale")
        layout.label(text="Orthographic / 3D rotation locked", icon="LOCKED")

    def execute(self, context):
        ensure_project(context.scene)
        project = SESSION.native_project
        if project is None:
            return {"CANCELLED"}
        props = context.scene.webim_view
        view_type = self.view_type
        default_label = {item[0]: item[1] for item in _VIEW_TYPES}[view_type]
        view = project.add_view(
            self.name or default_label,
            view_type,
            scale=self.scale,
            ortho_scale=self.ortho_scale,
        )
        camera_data = bpy.data.cameras.new(f"{view.name} Camera")
        camera_data.type = "ORTHO"
        camera_data.ortho_scale = view.ortho_scale
        camera = bpy.data.objects.new(view.name, camera_data)
        camera.location = _default_camera_location(view_type, view.ortho_scale)
        camera.rotation_euler = Euler(_DEFAULT_ROTATIONS[view_type], "XYZ")
        _configure_camera(camera, view)
        context.scene.collection.objects.link(camera)
        context.scene.camera = camera
        for obj in context.selected_objects:
            obj.select_set(False)
        camera.select_set(True)
        context.view_layer.objects.active = camera
        props["name"] = view.name
        props["view_type"] = view.view_type
        props["scale"] = view.scale
        props["ortho_scale"] = view.ortho_scale
        refresh_view_annotations(context.scene)
        SESSION.is_dirty = True
        self.report({"INFO"}, f"Created {default_label} 1:{view.scale}")
        return {"FINISHED"}


class WEBIM_OT_activate_view(bpy.types.Operator):
    bl_idname = "webim.activate_view"
    bl_label = "Activate Technical View"
    bl_options: ClassVar[set[str]] = {"REGISTER"}

    view_id: StringProperty()

    def execute(self, context):
        camera = next(
            (
                obj
                for obj in bpy.data.objects
                if obj.get("webim_view_id") == self.view_id and obj.type == "CAMERA"
            ),
            None,
        )
        if camera is None:
            self.report({"WARNING"}, "Technical view camera was not found")
            return {"CANCELLED"}
        context.scene.camera = camera
        camera.data.type = "ORTHO"
        camera.lock_rotation = (True, True, True)
        for area in context.screen.areas:
            if area.type != "VIEW_3D":
                continue
            space = area.spaces.active
            space.region_3d.view_perspective = "CAMERA"
            space.region_3d.lock_rotation = True
            space.lock_camera = False
        props = context.scene.webim_view
        props["name"] = camera.name
        props["view_type"] = camera.get("webim_view_type", "FLOOR_PLAN")
        props["scale"] = int(camera.get("webim_view_scale", 100))
        props["ortho_scale"] = camera.data.ortho_scale
        refresh_view_annotations(context.scene)
        return {"FINISHED"}


class WEBIM_UL_views(bpy.types.UIList):
    def draw_item(
        self, context, layout, data, item, icon, active_data, active_propname, index
    ):
        if item is None:
            return
        row = layout.row(align=True)
        row.label(text=item.name, icon="VIEW_CAMERA")
        row.label(text=f"1:{item.scale}")


class WEBIM_PT_views(bpy.types.Panel):
    bl_label = "Views"
    bl_idname = "WEBIM_PT_views"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "WeBIM"

    def draw(self, context):
        layout = self.layout
        props = context.scene.webim_view
        project = SESSION.native_project
        layout.prop(props, "name")
        layout.prop(props, "view_type")
        row = layout.row(align=True)
        for view_type, label, _description in _VIEW_TYPES:
            operator = row.operator(
                WEBIM_OT_create_view.bl_idname,
                text=label,
                icon="VIEW_CAMERA",
            )
            operator.view_type = view_type
        layout.separator()
        camera, native_view = _active_native_view(context)
        if camera is not None and native_view is not None:
            layout.label(text=f"Active: {native_view.view_type.replace('_', ' ').title()}")
            layout.prop(props, "scale")
            layout.prop(props, "ortho_scale")
            layout.label(text="Orthographic / Rotation locked", icon="LOCKED")
        if project is None or not project.views:
            return
        layout.separator()
        for view in project.views:
            row = layout.row(align=True)
            row.label(text=f"{view.name}  1:{view.scale}", icon="VIEW_CAMERA")
            operator = row.operator(
                WEBIM_OT_activate_view.bl_idname,
                text="Open",
            )
            operator.view_id = view.id


_CLASSES = (
    WEBIMViewProperties,
    WEBIM_OT_create_view,
    WEBIM_OT_activate_view,
    WEBIM_UL_views,
)


def register() -> None:
    for cls in _CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.webim_view = bpy.props.PointerProperty(
        type=WEBIMViewProperties
    )


def unregister() -> None:
    del bpy.types.Scene.webim_view
    for cls in reversed(_CLASSES):
        bpy.utils.unregister_class(cls)
