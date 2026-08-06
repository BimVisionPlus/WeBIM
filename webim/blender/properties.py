import bpy
from bpy.props import FloatProperty, StringProperty


class WEBIMProperties(bpy.types.PropertyGroup):
    project_name: StringProperty(name="Project", default="WeBIM Project")
    site_name: StringProperty(name="Site", default="Default Site")
    building_name: StringProperty(name="Building", default="Main Building")
    storey_name: StringProperty(name="Storey", default="Ground Floor")
    storey_elevation: FloatProperty(name="Storey elevation", default=0.0, unit="LENGTH")

    wall_name: StringProperty(name="Wall name", default="Wall 001")
    wall_start_x: FloatProperty(name="Start X", default=0.0, unit="LENGTH")
    wall_start_y: FloatProperty(name="Start Y", default=0.0, unit="LENGTH")
    wall_end_x: FloatProperty(name="End X", default=5.0, unit="LENGTH")
    wall_end_y: FloatProperty(name="End Y", default=0.0, unit="LENGTH")
    wall_elevation: FloatProperty(name="Elevation", default=0.0, unit="LENGTH")
    wall_height: FloatProperty(name="Height", default=3.0, min=0.001, unit="LENGTH")
    wall_thickness: FloatProperty(name="Thickness", default=0.2, min=0.001, unit="LENGTH")
