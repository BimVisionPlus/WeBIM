from dataclasses import dataclass
from typing import Literal

ToolStatus = Literal["active", "planned"]


@dataclass(frozen=True, slots=True)
class ToolDefinition:
    key: str
    label: str
    ifc_class: str
    status: ToolStatus
    module: str
