import bpy
from bpy.app.handlers import persistent

from .state import SESSION

NATIVE_PROJECT_KEY = "webim_native_project"


@persistent
def save_native_project_to_blend(_dummy=None) -> None:
    scene = bpy.context.scene
    if scene is not None and SESSION.native_project is not None:
        scene[NATIVE_PROJECT_KEY] = SESSION.serialize_native_project()


@persistent
def load_native_project_from_blend(_dummy=None) -> None:
    scene = bpy.context.scene
    if scene is None:
        return
    payload = scene.get(NATIVE_PROJECT_KEY)
    if payload:
        SESSION.restore_native_project(payload)
        from .tools.grid.renderer import synchronize_grid_representations
        from .views import synchronize_view_representations

        synchronize_grid_representations(SESSION.native_project)
        synchronize_view_representations(SESSION.native_project, scene)


def register() -> None:
    if save_native_project_to_blend not in bpy.app.handlers.save_pre:
        bpy.app.handlers.save_pre.append(save_native_project_to_blend)
    if load_native_project_from_blend not in bpy.app.handlers.load_post:
        bpy.app.handlers.load_post.append(load_native_project_from_blend)


def unregister() -> None:
    if save_native_project_to_blend in bpy.app.handlers.save_pre:
        bpy.app.handlers.save_pre.remove(save_native_project_to_blend)
    if load_native_project_from_blend in bpy.app.handlers.load_post:
        bpy.app.handlers.load_post.remove(load_native_project_from_blend)
