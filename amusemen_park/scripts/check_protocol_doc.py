# 통신 문서(doc/놀이동산_온라인.xlsx)와 코드 상수가 일치하는지 점검
# - shared/messages.ts 의 CLIENT_MESSAGE·SERVER_MESSAGE 값이 '메시지' 시트에 모두 있는지 (반대로 문서에만 있는 type 도 보고)
# - ERROR_CODE 값이 '오류 코드' 시트에 모두 있는지
# - server/src/schema/ParkState.ts 의 스키마 필드가 '상태 동기화' 시트에 모두 언급되는지
# - shared/messages.ts 의 payload·응답 인터페이스 필드가 '메시지' 시트 payload 칸에 모두 있는지
# - shared/rides.ts 의 기구(이름·좌석 수·NPC 수·NPC 좌석)가 '기구' 시트·ride_id 목록·NPC 총수와 같은지
# - 통신 규칙 상수(이동 속도·방 정원·메시지 제한·재접속 유예·CRAZY BUMP 물리 등)가 그 값을 설명하는 셀에 적혀 있는지
# - 클라이언트가 보여 주는 오류 문구가 '오류 코드' 시트 표시 문구와 같은지
# - 게임장: server/src/game/common/types.ts 의 MessageType 과 shared/arcade.ts 의 게임방 이름이 'game' 시트에 모두 있는지
# 사용법: PYTHONIOENCODING=utf-8 python amusemen_park/scripts/check_protocol_doc.py   (불일치가 있으면 종료 코드 1)
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DOC_PATH = ROOT.parent / "doc" / "놀이동산_온라인.xlsx"
MESSAGES_TS = ROOT / "shared" / "messages.ts"
RIDES_TS = ROOT / "shared" / "rides.ts"
ZONES_TS = ROOT / "shared" / "zones.ts"
CRAZY_BUMP_TS = ROOT / "shared" / "crazyBump.ts"
SNACK_TS = ROOT / "shared" / "snack.ts"
HEADBAND_TS = ROOT / "shared" / "headband.ts"
CHAT_TS = ROOT / "shared" / "chat.ts"
SCHEMA_TS = ROOT / "server" / "src" / "schema" / "ParkState.ts"
PARK_ROOM_TS = ROOT / "server" / "src" / "rooms" / "ParkRoom.ts"
CLIENT_SRC = ROOT / "client" / "src"
ARCADE_TS = ROOT / "shared" / "arcade.ts"
GAME_TYPES_TS = ROOT / "server" / "src" / "game" / "common" / "types.ts"
GAME_CONSTANTS_TS = ROOT / "server" / "src" / "game" / "common" / "constants.ts"

# 문서의 type 칸에 쓰지만 메시지 상수가 아닌 항목 (Colyseus 기본 동작)
DOC_ONLY_TYPES = {'joinOrCreate("park")', "(입장 성공)", "room.leave()", "(연결 종료)"}

# 통신 규칙 상수 → 그 값을 설명해야 하는 문서 셀 (파일, 상수를 찾는 정규식, 시트, 셀, 이름)
CONSTANT_CHECKS = [
    (MESSAGES_TS, r"MOVE_RULE = \{.*?MAX_SPEED:\s*([\d.]+)", "메시지", "G9", "MOVE_RULE.MAX_SPEED"),
    (MESSAGES_TS, r"MOVE_RULE = \{.*?RUN_SPEED:\s*([\d.]+)", "메시지", "G9", "MOVE_RULE.RUN_SPEED"),
    (MESSAGES_TS, r"MOVE_RULE = \{.*?SPEED_TOLERANCE:\s*([\d.]+)", "메시지", "G9", "MOVE_RULE.SPEED_TOLERANCE"),
    (MESSAGES_TS, r"MOVE_RULE = \{.*?SEND_RATE:\s*([\d.]+)", "메시지", "G9", "MOVE_RULE.SEND_RATE"),
    (MESSAGES_TS, r"ROOM_MAX_CLIENTS = ([\d.]+)", "메시지", "G3", "ROOM_MAX_CLIENTS"),
    (PARK_ROOM_TS, r"JOIN_REJECT_CODE = ([\d.]+)", "메시지", "G4", "JOIN_REJECT_CODE"),
    (PARK_ROOM_TS, r"REQUEST_REJECT_CODE = ([\d.]+)", "메시지", "G12", "REQUEST_REJECT_CODE"),
    (PARK_ROOM_TS, r"EXIT_SCATTER_RADIUS = ([\d.]+)", "메시지", "G14", "EXIT_SCATTER_RADIUS"),
    (PARK_ROOM_TS, r"MAX_MESSAGES_PER_SECOND = ([\d.]+)", "메시지", "G29", "MAX_MESSAGES_PER_SECOND"),
    (PARK_ROOM_TS, r"RECONNECT_SECONDS = ([\d.]+)", "메시지", "G29", "RECONNECT_SECONDS"),
    (PARK_ROOM_TS, r"PATCH_INTERVAL_MS = ([\d.]+)", "상태 동기화", "G3", "PATCH_INTERVAL_MS"),
    (RIDES_TS, r"RIDE_GATE_DISTANCE = ([\d.]+)", "메시지", "G11", "RIDE_GATE_DISTANCE"),
    (RIDES_TS, r"RIDE_NEAR_MARGIN = ([\d.]+)", "메시지", "G11", "RIDE_NEAR_MARGIN"),
    (ZONES_TS, r"SPAWN_RADIUS = ([\d.]+)", "상태 동기화", "G4", "SPAWN_RADIUS"),
    (ZONES_TS, r"SPAWN_POINT = \{.*?z:\s*([\d.]+)", "상태 동기화", "G4", "SPAWN_POINT.z"),
    (CRAZY_BUMP_TS, r"ARENA_WIDTH:\s*([\d.]+)", "상태 동기화", "G12", "CRAZY_BUMP.ARENA_WIDTH"),
    (CRAZY_BUMP_TS, r"ARENA_DEPTH:\s*([\d.]+)", "상태 동기화", "G12", "CRAZY_BUMP.ARENA_DEPTH"),
    (CRAZY_BUMP_TS, r"CAR_RADIUS:\s*([\d.]+)", "상태 동기화", "G12", "CRAZY_BUMP.CAR_RADIUS"),
    (CRAZY_BUMP_TS, r"MAX_SPEED:\s*([\d.]+)", "상태 동기화", "G12", "CRAZY_BUMP.MAX_SPEED"),
    (CRAZY_BUMP_TS, r"ACCELERATION:\s*([\d.]+)", "상태 동기화", "G12", "CRAZY_BUMP.ACCELERATION"),
    (CRAZY_BUMP_TS, r"FRICTION:\s*([\d.]+)", "상태 동기화", "G12", "CRAZY_BUMP.FRICTION"),
    (CRAZY_BUMP_TS, r"TURN_RATE:\s*([\d.]+)", "상태 동기화", "G12", "CRAZY_BUMP.TURN_RATE"),
    (CRAZY_BUMP_TS, r"RESTITUTION:\s*([\d.]+)", "상태 동기화", "G12", "CRAZY_BUMP.RESTITUTION"),
    (CRAZY_BUMP_TS, r"SIMULATION_RATE:\s*([\d.]+)", "상태 동기화", "G12", "CRAZY_BUMP.SIMULATION_RATE"),
    (CRAZY_BUMP_TS, r"HIT_MIN_SPEED:\s*([\d.]+)", "메시지", "G24", "CRAZY_BUMP.HIT_MIN_SPEED"),
    (CRAZY_BUMP_TS, r"HIT_COOLDOWN:\s*([\d.]+)", "메시지", "G24", "CRAZY_BUMP.HIT_COOLDOWN"),
    (CRAZY_BUMP_TS, r"INPUT_RATE:\s*([\d.]+)", "메시지", "G23", "CRAZY_BUMP.INPUT_RATE"),
    (CRAZY_BUMP_TS, r"INPUT_TIMEOUT:\s*([\d.]+)", "메시지", "G23", "CRAZY_BUMP.INPUT_TIMEOUT"),
    (SNACK_TS, r"COTTON_CANDY_CART = \{ x:\s*([\d.]+)", "메시지", "G17", "COTTON_CANDY_CART.x"),
    (SNACK_TS, r"COTTON_CANDY_CART = \{.*?z:\s*([\d.]+)", "메시지", "G17", "COTTON_CANDY_CART.z"),
    (SNACK_TS, r"CART_COUNTER_DISTANCE = ([\d.]+)", "메시지", "G17", "CART_COUNTER_DISTANCE"),
    (SNACK_TS, r"CART_NEAR_RADIUS = ([\d.]+)", "메시지", "G17", "CART_NEAR_RADIUS"),
    (SNACK_TS, r"COTTON_CANDY_SECONDS = ([\d.]+)", "메시지", "G18", "COTTON_CANDY_SECONDS"),
    (SNACK_TS, r"CHURROS_CART = \{ x:\s*-?([\d.]+)", "메시지", "G19", "CHURROS_CART.x"),
    (SNACK_TS, r"CHURROS_CART = \{.*?z:\s*-?([\d.]+)", "메시지", "G19", "CHURROS_CART.z"),
    (SNACK_TS, r"CHURROS_SECONDS = ([\d.]+)", "메시지", "G20", "CHURROS_SECONDS"),
    (HEADBAND_TS, r"HEADBAND_SHOP = \{ x:\s*([\d.]+)", "메시지", "G21", "HEADBAND_SHOP.x"),
    (HEADBAND_TS, r"HEADBAND_SHOP = \{.*?z:\s*-?([\d.]+)", "메시지", "G21", "HEADBAND_SHOP.z"),
    (HEADBAND_TS, r"SHOP_COUNTER_DISTANCE = ([\d.]+)", "메시지", "G21", "SHOP_COUNTER_DISTANCE"),
    (HEADBAND_TS, r"SHOP_NEAR_RADIUS = ([\d.]+)", "메시지", "G21", "SHOP_NEAR_RADIUS"),
    (CHAT_TS, r"MAX_LENGTH:\s*([\d.]+)", "메시지", "F25", "CHAT_RULE.MAX_LENGTH"),
    (CHAT_TS, r"MIN_INTERVAL_MS:\s*([\d.]+)", "메시지", "G25", "CHAT_RULE.MIN_INTERVAL_MS"),
    (CHAT_TS, r"SHOW_SECONDS:\s*([\d.]+)", "메시지", "G26", "CHAT_RULE.SHOW_SECONDS"),
    (ARCADE_TS, r"ARCADE_VIEW_POINT = \{ x:\s*([\d.]+)", "상태 동기화", "G14", "ARCADE_VIEW_POINT.x"),
    (ARCADE_TS, r"ARCADE_VIEW_POINT = \{.*?z:\s*([\d.]+)", "상태 동기화", "G14", "ARCADE_VIEW_POINT.z"),
    (ARCADE_TS, r"ARCADE_FORWARD_DISTANCE = ([\d.]+)", "상태 동기화", "G14", "ARCADE_FORWARD_DISTANCE"),
    (GAME_CONSTANTS_TS, r"RECONNECT_WAIT_SEC = ([\d.]+)", "game", "G14", "RECONNECT_WAIT_SEC"),
]

# 오류 코드 중 클라이언트 문구 표가 아니라 별도 상수로 보여 주는 것 (오류 코드 → (파일, 상수 이름))
FALLBACK_ERROR_TEXTS = {"invalid_payload": (CLIENT_SRC / "game" / "rideController.ts", "REQUEST_FAIL_TEXT")}


def readConstObject(source: str, name: str) -> set[str]:
    match = re.search(rf"export const {name} = \{{(.*?)\}} as const;", source, re.S)
    if match is None:
        raise SystemExit(f"{name} 상수를 찾을 수 없습니다: {MESSAGES_TS}")
    return set(re.findall(r':\s*"([^"]+)"', match.group(1)))


def readConstEntries(source: str, name: str) -> dict[str, str]:
    # KEY: "value" 쌍 (예: ERROR_CODE 의 RIDE_FULL → ride_full)
    match = re.search(rf"export const {name} = \{{(.*?)\}} as const;", source, re.S)
    if match is None:
        raise SystemExit(f"{name} 상수를 찾을 수 없습니다")
    return dict(re.findall(r'(\w+):\s*"([^"]+)"', match.group(1)))


def readSchemaFields(source: str) -> set[str]:
    return set(re.findall(r"^\s+(\w+):\s*t\.", source, re.M))


def readInterfaceFields(source: str) -> dict[str, list[str]]:
    # export interface 이름 → 필드 이름 목록 (통신 payload·응답 형식)
    interfaces = {}
    for name, body in re.findall(r"export interface (\w+) \{(.*?)\n\}", source, re.S):
        interfaces[name] = re.findall(r"^\s+(\w+)\??:", body, re.M)
    return interfaces


def readRides(source: str) -> list[dict]:
    # RIDES 의 한 줄짜리 기구 정의 (npc_seats 는 있을 때만)
    rides = []
    pattern = r'\w+: \{ id: "(\w+)", name: "([^"]+)", .*?seat_count: (\d+), npc_count: (\d+),.*?(?:npc_seats: \[([\d, ]+)\])? \}'
    for ride_id, name, seat_count, npc_count, npc_seats in re.findall(pattern, source):
        seats, npcs = int(seat_count), int(npc_count)
        explicit = [int(value) for value in npc_seats.split(",")] if npc_seats else None
        rides.append({
            "id": ride_id,
            "name": name,
            "seat_count": seats,
            "npc_count": npcs,
            "npc_seats": explicit,
            # 서버 getNpcSeats 와 같은 규칙: 지정이 없으면 floor(순서 × 좌석 수 ÷ NPC 수)
            "doc_seats": ", ".join(map(str, explicit)) if explicit else "(고르게) " + ", ".join(str(order * seats // npcs) for order in range(npcs)),
        })
    if not rides:
        raise SystemExit(f"RIDES 기구 정의를 찾을 수 없습니다: {RIDES_TS}")
    return rides


def readClientErrorTexts(source_root: Path) -> dict[str, str]:
    # 클라이언트 오류 문구 표의 [ERROR_CODE.KEY]: "문구"
    texts = {}
    for path in source_root.rglob("*.ts"):
        for key, text in re.findall(r'\[ERROR_CODE\.(\w+)\]:\s*"([^"]+)"', path.read_text(encoding="utf-8")):
            texts[key] = text
    return texts


def sheetValues(sheet, columns: str) -> list[str]:
    values = []
    for row in sheet.iter_rows(min_row=3):
        for cell in row:
            if cell.column_letter in columns and cell.value is not None:
                values.append(str(cell.value).strip())
    return values


def hasNumber(text: str, value: str) -> bool:
    # 다른 숫자의 일부가 아닌 독립된 숫자로 적혀 있는지 (예: 118 안의 8 은 제외)
    return re.search(rf"(?<![\d.]){re.escape(value)}(?![\d])", text) is not None


def checkInterfaces(workbook, interfaces: dict[str, list[str]]) -> list[str]:
    payload_text = "\n".join(sheetValues(workbook["메시지"], "CF"))
    problems = []
    for name, fields in sorted(interfaces.items()):
        for field in fields:
            if not re.search(rf"\b{re.escape(field)}\b", payload_text):
                problems.append(f"[메시지] {name}.{field} 필드가 payload 칸에 없음")
    return problems


def checkRides(workbook, rides: list[dict]) -> list[str]:
    problems = []
    ride_id_list = str(workbook["메시지"]["F11"].value or "")
    for ride in rides:
        if not re.search(rf"\b{ride['id']}\b", ride_id_list):
            problems.append(f"[메시지] F11 ride_id 목록에 {ride['id']} 가 없음")
    # '기구' 시트가 없어도 아래 NPC 총수 점검은 계속함
    doc_rows = {}
    if "기구" not in workbook.sheetnames:
        problems.append("[기구] '기구' 시트가 없음")
        rides_to_compare = []
    else:
        rides_to_compare = rides
        for row in workbook["기구"].iter_rows(min_row=2, max_col=6, values_only=True):
            if row[0] and re.fullmatch(r"[a-z_]+", str(row[0])):
                doc_rows[str(row[0])] = row
    for ride in rides_to_compare:
        row = doc_rows.pop(ride["id"], None)
        if row is None:
            problems.append(f"[기구] {ride['id']} 행이 없음")
            continue
        expected = {"이름": ride["name"], "seat_count": ride["seat_count"], "npc_count": ride["npc_count"], "npc_seats": ride["doc_seats"]}
        actual = {"이름": row[1], "seat_count": row[3], "npc_count": row[4], "npc_seats": row[5]}
        for column, value in expected.items():
            if str(actual[column]).strip() != str(value):
                problems.append(f"[기구] {ride['id']} {column}: 문서 {actual[column]!r} ≠ 코드 {value!r}")
    for extra in sorted(doc_rows):
        problems.append(f"[기구] 문서에만 있는 기구: {extra}")
    total = sum(ride["npc_count"] for ride in rides)
    match = re.search(r"총 (\d+)마리", str(workbook["상태 동기화"]["G13"].value or ""))
    if match is None or int(match.group(1)) != total:
        problems.append(f"[상태 동기화] G13 NPC 총수가 코드({total}마리)와 다름: {match.group(0) if match else '숫자 없음'}")
    return problems


def checkConstants(workbook) -> list[str]:
    problems = []
    sources: dict[Path, str] = {}
    for path, pattern, sheet, cell, label in CONSTANT_CHECKS:
        source = sources.setdefault(path, path.read_text(encoding="utf-8"))
        match = re.search(pattern, source, re.S)
        if match is None:
            problems.append(f"[상수] 코드에서 {label} 를 찾을 수 없음 ({path.name}) — 점검 목록을 고쳐 주세요")
            continue
        if not hasNumber(str(workbook[sheet][cell].value or ""), match.group(1)):
            problems.append(f"[상수] {label} = {match.group(1)} 이(가) {sheet} {cell} 에 적혀 있지 않음")
    # 맵 이동 범위 = 맵 한 변 ÷ 2 − 여백
    zones = sources.setdefault(ZONES_TS, ZONES_TS.read_text(encoding="utf-8"))
    map_size = re.search(r"MAP_SIZE = ([\d.]+)", zones)
    margin = re.search(r"MAP_EDGE_MARGIN = ([\d.]+)", zones)
    if map_size and margin:
        limit = float(map_size.group(1)) / 2 - float(margin.group(1))
        limit_text = str(int(limit)) if limit.is_integer() else str(limit)
        if not hasNumber(str(workbook["메시지"]["G9"].value or ""), limit_text):
            problems.append(f"[상수] 맵 이동 범위 {limit_text} (MAP_SIZE/2 − MAP_EDGE_MARGIN) 이(가) 메시지 G9 에 적혀 있지 않음")
    return problems


def checkErrorTexts(workbook, error_entries: dict[str, str]) -> list[str]:
    client_texts = readClientErrorTexts(CLIENT_SRC)
    expected = {error_entries[key]: text for key, text in client_texts.items() if key in error_entries}
    for code, (path, const_name) in FALLBACK_ERROR_TEXTS.items():
        match = re.search(rf'const {const_name} = "([^"]+)"', path.read_text(encoding="utf-8"))
        if match:
            expected[code] = match.group(1)
    doc_texts = {str(row[0]).strip(): str(row[4] or "").strip() for row in workbook["오류 코드"].iter_rows(min_row=2, max_col=5, values_only=True) if row[0]}
    problems = []
    for code, text in sorted(expected.items()):
        if code in doc_texts and doc_texts[code] != text:
            problems.append(f"[오류 코드] {code} 표시 문구가 클라이언트와 다름: 문서 {doc_texts[code]!r} / 코드 {text!r}")
    return problems


# 게임장 'game' 시트 — 게임방 메시지 type 과 게임방 이름이 모두 적혀 있는지
def checkGameSheet(workbook) -> list[str]:
    if "game" not in workbook.sheetnames:
        return ["[game] 'game' 시트가 없음"]
    sheet_text = "\n".join(sheetValues(workbook["game"], "ABCDEFG"))
    doc_types = set(sheetValues(workbook["game"], "BE"))
    problems = []
    game_source = GAME_TYPES_TS.read_text(encoding="utf-8")
    message_block = game_source[game_source.index("export const MessageType"):game_source.index("export const ErrorCode")]
    game_types = set(re.findall(r'^\s*([A-Z_]+): "\1",', message_block, re.M))
    for value in sorted(game_types):
        if value not in doc_types:
            problems.append(f"[game] 문서에 없는 게임방 메시지 type: {value}")
    for room_name in sorted(set(re.findall(r'room_name: "([^"]+)"', ARCADE_TS.read_text(encoding="utf-8")))):
        if room_name not in sheet_text:
            problems.append(f"[game] 문서에 없는 게임방 이름: {room_name}")
    return problems


def main() -> int:
    messages_source = MESSAGES_TS.read_text(encoding="utf-8")
    code_types = readConstObject(messages_source, "CLIENT_MESSAGE") | readConstObject(messages_source, "SERVER_MESSAGE")
    error_entries = readConstEntries(messages_source, "ERROR_CODE")
    code_errors = set(error_entries.values())
    schema_fields = readSchemaFields(SCHEMA_TS.read_text(encoding="utf-8"))
    interfaces = readInterfaceFields(messages_source)
    rides = readRides(RIDES_TS.read_text(encoding="utf-8"))

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
    problems += checkInterfaces(workbook, interfaces)
    problems += checkRides(workbook, rides)
    problems += checkConstants(workbook)
    problems += checkErrorTexts(workbook, error_entries)
    problems += checkGameSheet(workbook)
    # 읽기 전용으로 연 파일을 닫음 (Windows 에서 열어 둔 채면 엑셀 저장·삭제가 막힘)
    workbook.close()

    field_count = sum(len(fields) for fields in interfaces.values())
    print(f"메시지 type {len(code_types)}개, 오류 코드 {len(code_errors)}개, 스키마 필드 {len(schema_fields)}개, "
          f"payload 필드 {field_count}개, 기구 {len(rides)}종, 상수 {len(CONSTANT_CHECKS) + 1}개, 오류 문구 점검")
    if problems:
        print("\n".join(problems))
        print(f"불일치 {len(problems)}건 — 통신 문서를 갱신해 주세요: {DOC_PATH}")
        return 1
    print("통신 문서와 코드가 일치합니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
