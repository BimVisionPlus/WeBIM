# Phát triển một Native BIM Tool mới

Mỗi tool được phát triển theo vertical slice: native domain → session → Blender adapter → IFC exporter.

## 1. Native domain

Tạo entity trong `webim/domain/`. Lớp này không được import `bpy`, `ifcopenshell` hoặc mã Bonsai.

```python
@dataclass(frozen=True, slots=True)
class Slab:
    id: str
    name: str
    boundary: tuple[Point3D, ...]
    thickness: float
    storey_id: str
```

Native entity phải có:

- Stable native ID.
- Validation authoring.
- Serialization có schema version.
- Quan hệ với project/storey/type bằng native ID.

## 2. TDD native behavior

Viết test RED trước:

```bash
env -u PYTHONPATH .venv/Scripts/pytest.exe tests/test_native_slab.py -v
```

Kiểm tra:

- Tạo entity hợp lệ.
- Input sai bị từ chối.
- Stable ID và quan hệ được giữ.
- JSON round trip không mất dữ liệu.
- Domain test không cần Blender hoặc IfcOpenShell.

## 3. Authoring session

Session sở hữu `NativeBimProject` và đánh dấu dirty khi native model thay đổi:

```python
def add_slab(self, ...) -> Slab:
    slab = self.native_project.add_slab(...)
    self.is_dirty = True
    return slab
```

Không tạo IFC entity trong authoring method.

## 4. Blender adapter

```text
webim/blender/tools/slab/
├── __init__.py
├── properties.py
├── operator.py
├── renderer.py
└── panel.py
```

- Operator chuyển input viewport thành native command.
- Renderer tạo Blender object từ native entity.
- Blender object giữ `webim_id` và `webim_class`.
- Business rule không nằm trong `bpy` operator.

## 5. `.blend` persistence

Native project được serialize vào Blender scene qua `blender/persistence.py`:

```text
Scene["webim_native_project"] = JSON
```

Khi load `.blend`, session khôi phục native model từ JSON. Blender object là viewport representation; native JSON mới là authoring data chính.

## 6. IFC adapter

IFC mapping nằm tại export boundary. Viết test riêng cho mapping:

```text
Native Slab → IfcSlab
Native GridDatum[] → IfcGrid U/V/W hoặc IfcAnnotation
```

Exporter phải làm việc trên snapshot và không mutate native project.

Kiểm tra:

- IFC class và predefined type.
- Geometry/representation.
- Spatial containment.
- SI → IFC project units.
- Quan hệ type/host/opening.
- Fallback và warning khi native data chưa tạo được entity IFC đầy đủ.

## 7. Đăng ký và verification

Đăng ký Blender classes/handlers trong `blender/registration.py`, unregister theo thứ tự ngược.

```bash
env -u PYTHONPATH .venv/Scripts/pytest.exe -q
env -u PYTHONPATH .venv/Scripts/ruff.exe check webim tests scripts
env -u PYTHONPATH .venv/Scripts/python.exe -m compileall -q webim tests scripts
env -u PYTHONPATH .venv/Scripts/python.exe scripts/build_addon.py
```

Test ngoài Blender chứng minh native domain và IFC mapping. Modal interaction, `.blend` save/load handlers, selection và undo vẫn phải smoke-test trong Blender thật.
