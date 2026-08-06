import bpy
import ifcopenshell.geom


def create_object_from_product(product):
    """Tessellate an IFC product and link its Blender object to the active collection."""
    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)
    shape = ifcopenshell.geom.create_shape(settings, product)

    flat_vertices = shape.geometry.verts
    flat_faces = shape.geometry.faces
    vertices = [tuple(flat_vertices[i : i + 3]) for i in range(0, len(flat_vertices), 3)]
    faces = [tuple(flat_faces[i : i + 3]) for i in range(0, len(flat_faces), 3)]

    mesh = bpy.data.meshes.new(f"{product.is_a()}/{product.Name}")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    obj = bpy.data.objects.new(product.Name or product.is_a(), mesh)
    obj["ifc_entity_id"] = product.id()
    obj["ifc_global_id"] = product.GlobalId
    obj["ifc_class"] = product.is_a()
    bpy.context.collection.objects.link(obj)
    return obj
