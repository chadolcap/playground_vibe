// 간식 수레(솜사탕·츄러스) 규칙 테스트 (근처 판정·남은 양·배치)
import { test } from "node:test";
import assert from "node:assert/strict";
import { CART_NEAR_RADIUS, CHURROS_CART, CHURROS_SECONDS, COTTON_CANDY_CART, COTTON_CANDY_SECONDS, HEADBAND_SHOP, RIDES, RIDE_LIST, SNACK_KIND, cottonCandyLeft, getCartCounter, isNearCart, isSnackKind, snackKindLeft } from "@shared";

test("창구 앞은 받을 수 있고, 반경 밖·수레 뒤쪽 멀리는 받을 수 없다", () => {
    const counter = getCartCounter();
    assert.equal(isNearCart(counter.x, counter.z), true);
    assert.equal(isNearCart(counter.x + CART_NEAR_RADIUS + 0.1, counter.z), false);
    // 클라이언트(shrink)는 서버보다 엄격 — 경계 근처에서 버튼이 보이면 서버도 반드시 허용
    const edge_x = counter.x + CART_NEAR_RADIUS - 0.3;
    assert.equal(isNearCart(edge_x, counter.z, 0.6), false);
    assert.equal(isNearCart(edge_x, counter.z), true);
});

// DUCK-X 모델의 실제 동쪽 끝 x (게임 장면에서 잰 값, 기구 위치를 바꾸면 다시 잴 것)
const DUCK_X_EAST_EDGE = -22.5;

test("수레(솜사탕·츄러스)는 놀이기구 영역·다른 가게와 겹치지 않는다", () => {
    for (const cart of [COTTON_CANDY_CART, CHURROS_CART]) {
        for (const ride of RIDE_LIST) {
            if (ride.id === RIDES.duck_x.id) {
                // DUCK-X footprint 원(33m)은 넉넉한 근사 — 실제 모델은 중심 서쪽(뒤)으로 치우쳐 동쪽 끝이 x −22.5 (게임 안에서 잰 값)
                assert.ok(cart.x - DUCK_X_EAST_EDGE > 3, `duck_x 동쪽 끝과 ${(cart.x - DUCK_X_EAST_EDGE).toFixed(1)}m`);
                continue;
            }
            const distance = Math.hypot(cart.x - ride.x, cart.z - ride.z);
            assert.ok(distance > ride.footprint_radius + 3, `${ride.id} 와 ${distance.toFixed(1)}m`);
        }
        assert.ok(Math.hypot(cart.x - HEADBAND_SHOP.x, cart.z - HEADBAND_SHOP.z) > 10);
    }
    assert.ok(Math.hypot(COTTON_CANDY_CART.x - CHURROS_CART.x, COTTON_CANDY_CART.z - CHURROS_CART.z) > 10);
});

test("츄러스 수레는 자기 창구 앞에서만 받을 수 있다 (솜사탕 수레 창구와 구분)", () => {
    const churros = getCartCounter(CHURROS_CART);
    assert.equal(isNearCart(churros.x, churros.z, 0, CHURROS_CART), true);
    assert.equal(isNearCart(churros.x, churros.z), false);
    const candy = getCartCounter();
    assert.equal(isNearCart(candy.x, candy.z, 0, CHURROS_CART), false);
});

test("간식 종류별 남은 양 — 츄러스도 같은 방식, 모르는 종류는 0", () => {
    const until = 50_000 + CHURROS_SECONDS * 1000;
    assert.equal(snackKindLeft(SNACK_KIND.CHURROS, until, 50_000), 1);
    assert.equal(snackKindLeft(SNACK_KIND.CHURROS, until, 50_000 + CHURROS_SECONDS * 500), 0.5);
    assert.equal(snackKindLeft("pizza", until, 50_000), 0);
    assert.equal(isSnackKind(SNACK_KIND.COTTON_CANDY), true);
    assert.equal(isSnackKind(""), false);
});

test("솜사탕 남은 양은 받은 직후 1, 시간이 지나면 줄어 0", () => {
    const until = 100_000 + COTTON_CANDY_SECONDS * 1000;
    assert.equal(cottonCandyLeft(until, 100_000), 1);
    assert.equal(cottonCandyLeft(until, 100_000 + COTTON_CANDY_SECONDS * 500), 0.5);
    assert.equal(cottonCandyLeft(until, until + 1), 0);
    assert.equal(cottonCandyLeft(0, 5), 0);
});
