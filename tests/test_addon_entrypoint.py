import webim


def test_package_exposes_blender_addon_metadata_without_importing_bpy():
    assert webim.bl_info["name"] == "WeBIM"
    assert webim.bl_info["category"] == "3D View"
    assert webim.bl_info["version"] == (0, 1, 0)
    assert callable(webim.register)
    assert callable(webim.unregister)
