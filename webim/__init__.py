"""WeBIM — an independent OpenBIM authoring add-on for Blender."""

import sys

# Blender Extensions load add-ons as ``bl_ext.<repository>.webim``.
# Keep the canonical package name available for existing absolute imports.
sys.modules.setdefault("webim", sys.modules[__name__])

__version__ = "0.1.0"

bl_info = {
    "name": "WeBIM",
    "author": "WeBIM",
    "version": (0, 1, 0),
    "blender": (4, 2, 0),
    "location": "View3D > Sidebar > WeBIM",
    "description": "Independent IFC authoring tools powered by IfcOpenShell",
    "category": "3D View",
}


def register() -> None:
    from .blender.registration import register as register_addon

    register_addon()


def unregister() -> None:
    from .blender.registration import unregister as unregister_addon

    unregister_addon()
