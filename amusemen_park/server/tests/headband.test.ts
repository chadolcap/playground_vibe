// 머리띠 판매점 규칙 테스트 (근처 판정·머리띠 ID·배치)
import { test } from "node:test";
import assert from "node:assert/strict";
import { COTTON_CANDY_CART, HEADBAND_LIST, HEADBAND_NONE, HEADBAND_SHOP, RIDE_LIST, SHOP_NEAR_RADIUS, getShopCounter, isHeadbandId, isNearShop } from "@shared";

test("창구 앞은 고를 수 있고, 반경 밖은 고를 수 없다 (클라이언트가 더 엄격)", () => {
    const counter = getShopCounter();
    assert.equal(isNearShop(counter.x, counter.z), true);
    assert.equal(isNearShop(counter.x, counter.z + SHOP_NEAR_RADIUS + 0.1), false);
    const edge_z = counter.z + SHOP_NEAR_RADIUS - 0.3;
    assert.equal(isNearShop(counter.x, edge_z), true);
    assert.equal(isNearShop(counter.x, edge_z, 0.6), false);
});

test("머리띠 ID 는 목록에 있는 것만, 벗기('')는 ID 가 아님", () => {
    for (const headband of HEADBAND_LIST) {
        assert.equal(isHeadbandId(headband.id), true);
    }
    assert.equal(isHeadbandId(HEADBAND_NONE), false);
    assert.equal(isHeadbandId("crown"), false);
    assert.equal(isHeadbandId(null), false);
    assert.equal(new Set(HEADBAND_LIST.map((headband) => headband.id)).size, HEADBAND_LIST.length);
});

test("판매점은 놀이기구 영역·솜사탕 수레와 겹치지 않는다", () => {
    for (const ride of RIDE_LIST) {
        const distance = Math.hypot(HEADBAND_SHOP.x - ride.x, HEADBAND_SHOP.z - ride.z);
        assert.ok(distance > ride.footprint_radius + 3, `${ride.id} 와 ${distance.toFixed(1)}m`);
    }
    assert.ok(Math.hypot(HEADBAND_SHOP.x - COTTON_CANDY_CART.x, HEADBAND_SHOP.z - COTTON_CANDY_CART.z) > 10);
});
