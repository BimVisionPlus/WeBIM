from webim.core.project import ProjectSettings, create_project
from webim.core.wall import WallInput, create_wall


def test_create_wall_adds_ifc_geometry_and_spatial_container():
    model, hierarchy = create_project(
        ProjectSettings("Demo", "Site", "Building", "Ground Floor")
    )

    wall = create_wall(
        model,
        hierarchy.storey,
        WallInput(
            name="Wall 001",
            start=(0.0, 0.0),
            end=(5.0, 0.0),
            elevation=0.0,
            height=3.0,
            thickness=0.2,
        ),
    )

    assert wall.is_a("IfcWall")
    assert wall.Name == "Wall 001"
    assert wall.Representation.Representations[0].RepresentationIdentifier == "Body"
    assert wall.ContainedInStructure[0].RelatingStructure == hierarchy.storey


def test_create_wall_rejects_coincident_endpoints():
    model, hierarchy = create_project(
        ProjectSettings("Demo", "Site", "Building", "Ground Floor")
    )

    try:
        create_wall(
            model,
            hierarchy.storey,
            WallInput(
                name="Invalid wall",
                start=(1.0, 1.0),
                end=(1.0, 1.0),
                elevation=0.0,
                height=3.0,
                thickness=0.2,
            ),
        )
    except ValueError as exc:
        assert str(exc) == "Wall endpoints must be different"
    else:
        raise AssertionError("Expected coincident endpoints to be rejected")
