// 머리에 쓰는 머리띠 — 머리 위로 넘어가는 반원 띠 + 종류별 장식 (토끼·고양이·곰돌이 귀, 리본, 꽃, 악마 뿔)
// 원점 = 정수리, 크기는 머리 폭에 맞춤 (캐릭터마다 머리 크기가 다름)
import * as THREE from "three";
import type { HeadbandId } from "@shared";
import { getMaterial } from "../world/rides/common";

// 띠가 머리를 감싸는 반지름 = 머리 폭 절반 × 이 값 (머리보다 살짝 크게)
const BAND_FIT = 1.04;
// 띠 꼭대기를 정수리보다 이만큼(띠 반지름 대비) 내림 — 머리카락에 살짝 묻혀 떠 보이지 않게
const BAND_SINK = 0.12;
// 장식(귀 등)을 다는 위치: 띠 꼭대기에서 좌우로 이 각도 (라디안)
const EAR_ANGLE = 0.62;

function mesh(geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, rotation_z = 0): THREE.Mesh {
    const result = new THREE.Mesh(geometry, getMaterial(color));
    result.position.set(x, y, z);
    result.rotation.z = rotation_z;
    result.castShadow = true;
    return result;
}

// 띠 위 각도 angle(0 = 꼭대기, + = 왼쪽(+x)) 의 점
function onBand(radius: number, angle: number): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(angle) * radius, Math.cos(angle) * radius, 0);
}

function addEars(group: THREE.Group, radius: number, make: (side: number, point: THREE.Vector3) => THREE.Object3D[]): void {
    for (const side of [-1, 1]) {
        group.add(...make(side, onBand(radius, side * EAR_ANGLE)));
    }
}

export function createHeadband(id: HeadbandId, head_width: number): THREE.Group {
    const radius = (head_width / 2) * BAND_FIT;
    // 장식 크기 기준 (머리 폭 0.6m 일 때 1)
    const unit = head_width / 0.6;
    const group = new THREE.Group();
    // 띠 원의 중심을 정수리 아래로 → 띠 꼭대기가 정수리 근처
    const holder = new THREE.Group();
    holder.position.y = -radius * (1 - BAND_SINK);
    group.add(holder);

    const band_color = id === "devil" ? "#2b2d42" : id === "flower" ? "#90be6d" : id === "bear" ? "#7f5539" : "#ff8fab";
    // 반원 띠 (x-y 평면, 왼쪽 끝 → 꼭대기 → 오른쪽 끝)
    holder.add(mesh(new THREE.TorusGeometry(radius, 0.022 * unit, 6, 24, Math.PI), band_color, 0, 0, 0));

    switch (id) {
        case "bunny":
            addEars(holder, radius, (side, point) => [
                mesh(new THREE.CapsuleGeometry(0.06 * unit, 0.24 * unit, 4, 10), "#ffffff", point.x, point.y + 0.15 * unit, 0, -side * 0.18),
                mesh(new THREE.CapsuleGeometry(0.032 * unit, 0.18 * unit, 4, 8), "#ffc8dd", point.x - side * 0.004, point.y + 0.15 * unit, 0.035 * unit, -side * 0.18),
            ]);
            break;
        case "cat":
            addEars(holder, radius, (side, point) => [
                mesh(new THREE.ConeGeometry(0.085 * unit, 0.16 * unit, 4), "#f4a261", point.x, point.y + 0.06 * unit, 0, -side * 0.3),
                mesh(new THREE.ConeGeometry(0.045 * unit, 0.1 * unit, 4), "#ffc8dd", point.x, point.y + 0.05 * unit, 0.035 * unit, -side * 0.3),
            ]);
            break;
        case "bear":
            addEars(holder, radius, (_side, point) => [
                mesh(new THREE.SphereGeometry(0.075 * unit, 12, 10), "#9c6644", point.x, point.y + 0.04 * unit, 0),
                mesh(new THREE.SphereGeometry(0.042 * unit, 10, 8), "#e6ccb2", point.x, point.y + 0.04 * unit, 0.045 * unit),
            ]);
            break;
        case "ribbon": {
            // 한쪽(왼쪽 위)에 큰 리본: 날개 두 장 + 가운데 매듭
            const point = onBand(radius, EAR_ANGLE * 0.9);
            for (const side of [-1, 1]) {
                const wing = mesh(new THREE.ConeGeometry(0.075 * unit, 0.15 * unit, 12), "#e63946", point.x + side * 0.07 * unit, point.y + 0.03 * unit, 0, side * Math.PI / 2);
                holder.add(wing);
            }
            holder.add(mesh(new THREE.SphereGeometry(0.035 * unit, 10, 8), "#c1121f", point.x, point.y + 0.03 * unit, 0));
            break;
        }
        case "flower": {
            // 띠를 따라 작은 꽃 5송이 (꽃잎 원 + 노란 가운데)
            const colors = ["#ffafcc", "#ffffff", "#ffd166", "#cdb4db", "#ffafcc"];
            colors.forEach((color, index) => {
                const point = onBand(radius, (index - 2) * 0.42);
                holder.add(mesh(new THREE.SphereGeometry(0.05 * unit, 10, 8).scale(1, 1, 0.5), color, point.x, point.y + 0.01, 0.01));
                holder.add(mesh(new THREE.SphereGeometry(0.022 * unit, 8, 6), "#f4a261", point.x, point.y + 0.01, 0.03 * unit));
            });
            break;
        }
        case "devil":
            addEars(holder, radius, (side, point) => [
                mesh(new THREE.ConeGeometry(0.05 * unit, 0.16 * unit, 10), "#d62828", point.x, point.y + 0.07 * unit, 0, -side * 0.35),
            ]);
            break;
    }
    return group;
}
