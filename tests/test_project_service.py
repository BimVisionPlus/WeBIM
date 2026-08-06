from webim.core.project import ProjectSettings, create_project


def test_create_project_builds_minimum_spatial_hierarchy():
    model, hierarchy = create_project(
        ProjectSettings(
            project_name="WeBIM Demo",
            site_name="Default Site",
            building_name="Main Building",
            storey_name="Ground Floor",
            storey_elevation=0.0,
        )
    )

    assert model.schema == "IFC4"
    assert hierarchy.project.is_a("IfcProject")
    assert hierarchy.site.is_a("IfcSite")
    assert hierarchy.building.is_a("IfcBuilding")
    assert hierarchy.storey.is_a("IfcBuildingStorey")
    assert hierarchy.storey.Name == "Ground Floor"
    assert hierarchy.storey.Elevation == 0.0

    assert hierarchy.site.Decomposes[0].RelatingObject == hierarchy.project
    assert hierarchy.building.Decomposes[0].RelatingObject == hierarchy.site
    assert hierarchy.storey.Decomposes[0].RelatingObject == hierarchy.building
