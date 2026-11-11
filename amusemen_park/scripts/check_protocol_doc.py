# 통신 문서(doc/놀이동산_온라인.xlsx)와 코드 상수가 일치하는지 점검
# - shared/messages.ts 의 CLIENT_MESSAGE·SERVER_MESSAGE 값이 '메시지' 시트에 모두 있는지 (반대로 문서에만 있는 type 도 보고)
# - ERROR_CODE 값이 '오류 코드' 시트에 모두 있는지
# - server/src/schema/ParkState.ts 의 스키마 필드가 '상태 동기화' 시트에 모두 언급되는지
# 사용법: python amusemen_park/scripts/check_protocol_doc.py   (불일치가 있으면 종료 코드 1)
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DOC_PATH = ROOT.parent / "doc" / "놀이동산_온라인.xlsx"
MESSAGES_TS = ROOT / "shared" / "messages.ts"
SCHEMA_TS = ROOT / "server" / "src" / "schema" / "ParkState.ts"

# 문서의 type 칸에 쓰지만 메시지 상수가 아닌 항목 (Colyseus 기본 동작)
DOC_ONLY_TYPES = {'joinOrCreate("park")', "(입장 성공)", "room.leave()", "(연결 종료)"}


def readConstObject(source: str, name: str) -> set[str]:
    match = re.search(rf"export const {name} = \{{(.*?)\}} as const;", source, re.S)
    if match is None:
        raise SystemExit(f"{name} 상수를 찾을 수 없습니다: {MESSAGES_TS}")
    return set(re.findall(r':\s*"([^"]+)"', match.group(1)))


def readSchemaFields(source: str) -> set[str]:
    return set(re.findall(r"^\s+(\w+):\s*t\.", source, re.M))


def sheetValues(sheet, columns: str) -> list[str]:
    values = []
    for row in sheet.iter_rows(min_row=3):
        for cell in row:
            if cell.column_letter in columns and cell.value is not None:
                values.append(str(cell.value).strip())
    return values


def main() -> int:
    messages_source = MESSAGES_TS.read_text(encoding="utf-8")
    code_types = readConstObject(messages_source, "CLIENT_MESSAGE") | readConstObject(messages_source, "SERVER_MESSAGE")
    code_errors = readConstObject(messages_source, "ERROR_CODE")
    schema_fields = readSchemaFields(SCHEMA_TS.read_text(encoding="utf-8"))

    workbook = openpyxl.load_workbook(DOC_PATH, read_only=True)
    doc_types = set(sheetValues(workbook["메시지"], "BE")) - DOC_ONLY_TYPES
    doc_errors = {str(row[0]).strip() for row in workbook["오류 코드"].iter_rows(min_row=2, max_col=1, values_only=True) if row[0] and "_" in str(row[0]) and " " not in str(row[0])}
    state_text = "\n".join(str(cell) for row in workbook["상태 동기화"].iter_rows(min_row=3, values_only=True) for cell in row if cell is not None)

    problems = []
    for missing in sorted(code_types - doc_types):
        problems.append(f"[메시지] 코드에는 있지만 문서에 없는 type: {missing}")
    for extra in sorted(doc_types - code_types):
        problems.append(f"[메시지] 문서에만 있는 type (코드에서 바뀌었거나 삭제됨?): {extra}")
    for missing in sorted(code_errors - doc_errors):
        problems.append(f"[오류 코드] 문서에 없는 오류 코드: {missing}")
    for extra in sorted(doc_errors - code_errors):
        problems.append(f"[오류 코드] 문서에만 있는 오류 코드: {extra}")
    for field in sorted(schema_fields):
        if not re.search(rf"\b{re.escape(field)}\b", state_text):
            problems.append(f"[상태 동기화] 문서에 없는 스키마 필드: {field}")

    print(f"메시지 type {len(code_types)}개, 오류 코드 {len(code_errors)}개, 스키마 필드 {len(schema_fields)}개 점검")
    if problems:
        print("\n".join(problems))
        print(f"불일치 {len(problems)}건 — 통신 문서를 갱신해 주세요: {DOC_PATH}")
        return 1
    print("통신 문서와 코드가 일치합니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
