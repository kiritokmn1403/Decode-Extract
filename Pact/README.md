# vBooks APK Decompiler & Extractor Scripts (Pact)

Thư mục này chứa các kịch bản Node.js chuyên dụng dùng để dịch ngược và trích xuất tài nguyên từ file APK của ứng dụng **vBooks**:

## 1. `decode_manifest.js` (Android Binary XML Decoder)
- **Mục đích**: Giải mã trực tiếp file `AndroidManifest.xml` từ định dạng nhị phân AXML (Android Binary XML) thành XML tiêu chuẩn có cấu trúc rõ ràng, giữ nguyên định dạng namespaces, tags, và attributes.
- **Cách thức hoạt động**:
  - Đọc Root Chunk (RES_XML_TYPE = `0x00030008`).
  - Parse ResStringPool (UTF-8 / UTF-16LE).
  - Bỏ qua ResMap Chunk (`0x0180`).
  - Duyệt tuần tự các chunk `START_NAMESPACE` (`0x0100`), `END_NAMESPACE` (`0x0101`), `START_TAG` (`0x0102`), `END_TAG` (`0x0103`), và `CDATA` (`0x0104`).
  - Tính toán chính xác vị trí attribute trong `ResXMLTree_attrExt` để lấy tên thuộc tính và giá trị (String, Ref `@0x...`, Boolean, Int, Hex).
- **Đầu vào**: `D:/A.I Project/A.I Project - vBooks/vBooks/AndroidManifest.xml`
- **Đầu ra**: `D:/A.I Project/A.I Project - vBooks/vBooks/AndroidManifest_decoded.xml`

## 2. `extract_classes.js` (Dalvik Executable Class Reconstructor)
- **Mục đích**: Phân tích trực tiếp cấu trúc nhị phân của Dalvik Executable (`classes3.dex`) để trích xuất toàn bộ 1,697 class thuộc package `com.vbook` thành mã nguồn Java (`.java`).
- **Cách thức hoạt động**:
  - Đọc Header DEX (`string_ids`, `type_ids`, `proto_ids`, `field_ids`, `method_ids`, `class_defs`).
  - Đọc String Pool (ULEB128 length + MUTF-8 null-terminated strings).
  - Phân giải Type Descriptors (`Lpackage/Name;`, `[I`, `V`, `Z`...).
  - Phân giải Prototype (kiểu trả về và danh sách kiểu tham số).
  - Duyệt `class_defs` và `class_data_item`:
    - Giải mã ULEB128 cho static fields, instance fields, direct methods (constructors/static/private) và virtual methods.
    - Ánh xạ Access Flags (`public`, `private`, `protected`, `static`, `final`, `abstract`, `interface`, `enum`...).
  - Tái tạo mã nguồn `.java` hoàn chỉnh với package, import/kiểu dữ liệu, field, constructor, và method stubs.
  - Tự động tạo cây thư mục theo package và lưu file tương ứng vào `src/main/java/`.
- **Đầu vào**: `D:/A.I Project/A.I Project - vBooks/vBooks/classes3.dex`
- **Đầu ra**: `D:/A.I Project/A.I Project - vBooks/vBooks/src/main/java/com/vbook/...`

## Hướng dẫn chạy
```bash
# Giải mã AndroidManifest.xml
node "D:\A.I Project\A.I Project - vBooks\Pact\decode_manifest.js"

# Trích xuất toàn bộ các lớp Java từ DEX
node "D:\A.I Project\A.I Project - vBooks\Pact\extract_classes.js"
```
