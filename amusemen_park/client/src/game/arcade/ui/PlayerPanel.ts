// 게임방에서 한 명의 사용자 정보(캐릭터 그림/별명)를 보여주는 패널. 게임 종류와 무관해서 공통 UI 에 둔다.
// 놀이동산 이식: 아바타 코드 글자 → 놀이동산 캐릭터 그림(characterPortrait.ts), 아이디·승율 줄은 전적이 없어 제거.
import { Container, Graphics, Sprite, Text } from "pixi.js";
import type { RoomPlayerInfo } from "../common/types";
import { GetCharacterTexture } from "../characterPortrait";
import type { UiTheme } from "./UiTheme";

export const AVATAR_SIZE = 160;
const FONT_SIZE = 16;
// 명칭과 실제 데이터 사이 간격.
const LABEL_GAP = 8;
// 가로 배치에서 아바타와 글자 사이 간격.
const HORIZONTAL_GAP = 14;

// 패널 배치 옵션 — 생략하면 다른 게임과 같은 세로 배치(아바타 위, 글자 아래)다.
// 에어하키처럼 위쪽 공간이 좁은 화면은 horizontal 로 아바타를 왼쪽, 글자를 오른쪽에 둔다.
export interface PlayerPanelLayout {
  horizontal?: boolean;
  avatar_size?: number;
  font_size?: number;
  // 데이터 글자가 이 폭을 넘으면 가로로 줄여서 맞춘다(긴 별명이 카드 밖으로 나가지 않게).
  value_max_width?: number;
}

export class PlayerPanel extends Container {
  private readonly avatar_label: Text;
  private readonly avatar_sprite = new Sprite();
  private readonly avatar_size: number;
  private readonly name_text: Text;
  private readonly note_text: Text;
  private readonly value_max_width: number;
  // 그림을 불러오는 사이 다른 사람 정보로 바뀌었는지 확인용
  private avatar_key = "";

  constructor(theme: UiTheme, layout: PlayerPanelLayout = {}) {
    super();

    const avatar_size = layout.avatar_size ?? AVATAR_SIZE;
    this.avatar_size = avatar_size;
    const font_size = layout.font_size ?? FONT_SIZE;
    const line_height = font_size + 8;
    this.value_max_width = layout.value_max_width ?? Infinity;

    const avatar_box = new Graphics().roundRect(0, 0, avatar_size, avatar_size, 12).fill(theme.avatar_color);

    // 캐릭터 그림을 만드는 동안(또는 실패하면) 보이는 글자
    this.avatar_label = new Text({
      text: "-",
      style: { fill: theme.avatar_text_color, fontSize: 18, fontFamily: theme.content_font_family },
    });
    this.avatar_label.anchor.set(0.5);
    this.avatar_label.position.set(avatar_size / 2, avatar_size / 2);
    this.avatar_sprite.visible = false;

    // 명칭은 굵게 + 데이터와 다른 색으로 표기한다.
    const label_style = { fill: theme.label_color, fontSize: font_size, fontFamily: theme.font_family, fontWeight: "bold" } as const;
    const value_style = { fill: theme.value_color, fontSize: font_size, fontFamily: theme.font_family } as const;

    const label = new Text({ text: "별명", style: label_style });
    const value_x = label.width + LABEL_GAP;

    this.name_text = new Text({ text: "-", style: value_style });
    // 게임별로 덧붙이는 한 줄 표기(예: 오델로의 돌 색). 쓰지 않는 게임에서는 비어 있다.
    this.note_text = new Text({ text: "", style: { ...value_style, fill: theme.accent_color } });

    // 세로 배치: 아바타 아래에 줄을 쌓는다. 가로 배치: 아바타 오른쪽에 줄을 아바타 높이 가운데로 맞춘다.
    const text_x = layout.horizontal ? avatar_size + HORIZONTAL_GAP : 0;
    const text_y = layout.horizontal ? (avatar_size - line_height * 2) / 2 + 4 : avatar_size + 16;
    label.position.set(text_x, text_y);
    this.name_text.position.set(text_x + value_x, text_y);
    this.note_text.position.set(text_x, text_y + line_height);

    this.addChild(avatar_box, this.avatar_label, this.avatar_sprite, label, this.name_text, this.note_text);
  }

  public SetInfo(info: RoomPlayerInfo): void {
    this.name_text.text = info.name;
    this.FitValueWidth(this.name_text);
    this.SetAvatar(info.avatar, info.name);
  }

  // 놀이동산 캐릭터 그림으로 아바타 칸을 채운다
  private SetAvatar(avatar: string, name: string): void {
    if (avatar === this.avatar_key) return;
    this.avatar_key = avatar;
    this.avatar_sprite.visible = false;
    this.avatar_label.visible = true;
    this.avatar_label.text = Array.from(name)[0] ?? "-";
    void GetCharacterTexture(avatar, "face").then((texture) => {
      if (texture === null || this.destroyed || this.avatar_key !== avatar) return;
      this.avatar_sprite.texture = texture;
      this.avatar_sprite.width = this.avatar_size;
      this.avatar_sprite.height = this.avatar_size;
      this.avatar_sprite.visible = true;
      this.avatar_label.visible = false;
    });
  }

  // value_max_width 를 넘는 글자는 가로로만 줄인다(기본값 Infinity 면 아무것도 하지 않는다).
  private FitValueWidth(value_text: Text): void {
    value_text.scale.x = 1;
    if (value_text.width > this.value_max_width) value_text.scale.x = this.value_max_width / value_text.width;
  }

  public SetNote(note: string): void {
    this.note_text.text = note;
  }
}
