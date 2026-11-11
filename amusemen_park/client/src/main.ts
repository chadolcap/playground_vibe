// 클라이언트 진입점 — 첫 페이지(2단계) → 입장 후 3D 월드(4단계)
import { CloseCode, type Room } from "@colyseus/sdk";
import { startPlaySession, type PlaySession } from "./game/playSession";
import { createIntroScreen } from "./ui/introScreen";
import { createParkWorld, type ParkWorld } from "./world/parkWorld";
import "./style.css";

// 입장 안내 문구가 화면에 머무는 시간
const TOAST_DURATION_MS = 4000;

function boot(): void {
    const world_el = document.getElementById("world-screen") as HTMLElement;
    const canvas_host_el = document.getElementById("world-canvas") as HTMLElement;
    const status_el = document.getElementById("world-status") as HTMLElement;
    const leave_el = document.getElementById("leave-button") as HTMLButtonElement;
    const room_badge_el = document.getElementById("room-badge") as HTMLElement;

    let current_room: Room | null = null;
    let current_world: ParkWorld | null = null;
    let current_session: PlaySession | null = null;
    // 월드 생성(비동기) 중에 퇴장하면 늦게 만들어진 월드를 바로 정리하기 위한 세대 번호
    let world_generation = 0;
    let toast_timer = 0;

    function showToast(text: string): void {
        status_el.textContent = text;
        status_el.classList.add("is-visible");
        window.clearTimeout(toast_timer);
        toast_timer = window.setTimeout(() => status_el.classList.remove("is-visible"), TOAST_DURATION_MS);
    }

    function closeWorld(): void {
        world_generation += 1;
        // 세션(캐릭터·입력)을 먼저 정리한 뒤 월드 해제
        current_session?.dispose();
        current_session = null;
        current_world?.dispose();
        current_world = null;
        world_el.hidden = true;
    }

    async function openWorld(room: Room): Promise<void> {
        const generation = ++world_generation;
        try {
            const world = await createParkWorld(canvas_host_el);
            if (generation !== world_generation) {
                world.dispose();
                return;
            }
            current_world = world;
            const session = await startPlaySession(world, room, world_el, showToast);
            if (generation !== world_generation) {
                session.dispose();
                return;
            }
            current_session = session;
            if (import.meta.env.DEV) {
                (window as unknown as { __park_session?: PlaySession }).__park_session = session;
            }
            // 개발 서버에서만 콘솔 점검용으로 노출 (빌드 결과물에는 포함되지 않음)
            if (import.meta.env.DEV) {
                (window as unknown as { __park_world?: ParkWorld }).__park_world = world;
            }
        } catch (error) {
            // WebGL 미지원·상태 수신 실패 등으로 화면을 만들 수 없으면 방에서 나가고 안내
            console.error("[main] 3D 월드 생성 실패", error);
            closeWorld();
            void room.leave();
            intro.show("이 기기에서는 3D 화면을 열 수 없어요. 다른 브라우저로 접속해 주세요.");
        }
    }

    const intro = createIntroScreen(({ room, room_info }, name) => {
        current_room = room;
        intro.hide();
        world_el.hidden = false;

        // 정원이 차면 새 방이 생기므로 몇 번 방에 들어왔는지 표시
        if (room_info !== null) {
            room_badge_el.textContent = `🎡 ${room_info.room_no}번 놀이동산`;
            showToast(`🐥 ${name} 님, ${room_info.room_no}번 놀이동산에 입장했어요! (현재 ${room_info.player_count}/${room_info.max_players}명)`);
        } else {
            room_badge_el.textContent = "🎡 놀이동산";
            showToast(`🐥 ${name} 님, 놀이동산에 입장했어요!`);
        }
        void openWorld(room);

        // 서버 연결이 끊기면 첫 페이지로 돌아가 안내
        room.onLeave((code) => {
            current_room = null;
            closeWorld();
            // CONSENTED = 직접 나가기(room.leave) 로 인한 정상 퇴장
            const message = code === CloseCode.CONSENTED ? undefined : "서버와 연결이 끊어졌어요. 다시 입장해 주세요.";
            intro.show(message);
        });
    });

    leave_el.addEventListener("click", () => {
        void current_room?.leave();
    });

    intro.show();
}

boot();
