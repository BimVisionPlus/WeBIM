from webim.core.project import ProjectSettings
from webim.core.session import IfcSession

SESSION = IfcSession()


def ensure_project(scene, session: IfcSession = SESSION):
    props = scene.webim
    return session.ensure_project(
        ProjectSettings(
            project_name=props.project_name,
            site_name=props.site_name,
            building_name=props.building_name,
            storey_name=props.storey_name,
            storey_elevation=props.storey_elevation,
        )
    )
