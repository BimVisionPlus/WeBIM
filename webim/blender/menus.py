import bpy


class WEBIM_MT_add(bpy.types.Menu):
    bl_idname = "WEBIM_MT_add"
    bl_label = "WeBIM"

    def draw(self, context):
        layout = self.layout
        layout.operator(
            "webim.create_grid",
            text="Grid",
            icon="GRID",
        )
        layout.operator(
            "webim.create_wall",
            text="Wall",
            icon="MESH_CUBE",
        )
        layout.separator()
        layout.operator(
            "webim.create_view",
            text="Floor Plan View",
            icon="VIEW_CAMERA",
        ).view_type = "FLOOR_PLAN"
        layout.operator(
            "webim.create_view",
            text="Section View",
            icon="VIEW_CAMERA",
        ).view_type = "SECTION"
        layout.operator(
            "webim.create_view",
            text="Elevation View",
            icon="VIEW_CAMERA",
        ).view_type = "ELEVATION"


def draw_webim_add_menu(self, context) -> None:
    self.layout.menu(
        WEBIM_MT_add.bl_idname,
        text="WeBIM",
        icon="HOME",
    )


def draw_webim_export_menu(self, context) -> None:
    self.layout.operator(
        "webim.save_ifc",
        text="WeBIM (.ifc)",
        icon="EXPORT",
    )
