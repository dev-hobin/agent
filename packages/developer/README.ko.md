# @hobin/developer

[English](./README.md) | 한국어

Pi에서 사용하는 개발 판단 Skill과 조건부 Reference 모음입니다.

## 만든 이유

숙련된 개발자는 모든 설계 원칙을 한꺼번에 떠올리며 일하지 않습니다. 지금 어떤 문제를 다루는지, 다음에 무엇을 판단해야 하는지에 관한 큰 사고 틀은 계속 유지하고, 구체적인 상황을 만났을 때 필요한 자료를 찾아봅니다.

`@hobin/developer`는 개발자가 경험으로 쌓은 이런 직관을 검토 가능한 Skill과 Reference로 옮깁니다. Skill에는 판단의 중심이 되는 작업 방법을 두고, 특정 조건에서만 중요한 세부 내용은 Reference로 나눕니다. 모든 개발 지식을 매번 컨텍스트에 넣는 대신, 현재 문제에 맞는 내용만 가져와 사용할 수 있습니다.

이것은 고정된 워크플로가 아니라 점진적으로 컨텍스트를 구성하는 방식입니다. 어떤 작업에는 Reference가 필요하지 않을 수 있고, 하나만 필요할 수도 있으며, 여러 개를 함께 읽어야 할 수도 있습니다.

## 설치

[Pi](https://pi.dev)와 Node.js 22.19 이상이 필요합니다.

```sh
pi install npm:@hobin/developer
```

설치하지 않고 한 번만 실행하려면:

```sh
pi -e npm:@hobin/developer
```

## 사용

평소처럼 Pi에 요청하면 됩니다. Pi의 기본 Skill 목록에서 현재 작업에 맞는 Skill을 모델이 선택할 수 있습니다.

```text
이 요구사항을 구현하기 전에 반드시 유지해야 할 조건을 정리해 줘.
이 버그 뒤에 남아 있는 조건과 금지 상태를 모델링해 줘.
코드를 작성하기 전에 구현 가능한 설계안을 그려 줘.
반복되는 이 구조를 지금 추상화해도 되는지 판단해 줘.
현재 증거로 완료됐다고 말할 수 있는 범위를 검증해 줘.
```

`/skill:<name>`으로 Skill을 직접 불러올 수도 있습니다.

## 제공하는 것

- 서로 독립적인 개발 판단 Skill 17개
- 각 조건에서 필요한 세부 Reference
- 선택된 Skill의 Reference 메타데이터를 공개하는 수동형 Extension 한 개

Skill은 서로 다른 종류의 개발 판단을 다룹니다. 반드시 거쳐야 하는 단계가 아니며 하나의 파이프라인을 이루지도 않습니다. 지금 내려야 하는 판단에 맞는 Skill 하나를 사용하고, 그 결과로 충분하다면 거기서 끝냅니다.

## 필요한 컨텍스트만 불러오는 과정

1. Pi가 기본 Skill 시스템으로 Skill의 이름과 설명을 발견합니다.
2. 모델이나 사용자가 Skill을 선택하면 Pi가 해당 `SKILL.md`를 작업 방법으로 불러옵니다.
3. Extension이 그 Skill 옆의 `references.json`을 화면에 표시하지 않는 선택 메타데이터로 모델에 전달합니다.
4. 모델이 선택된 Skill의 맥락에서 각 조건을 해석합니다.
5. 현재 판단에 실제로 필요한 Reference 본문만 Pi의 기본 `read` Tool로 읽습니다. 여러 Reference가 함께 필요할 수 있고, 하나도 필요하지 않을 수도 있습니다.

Extension은 Reference를 직접 선택하거나 본문을 읽지 않으며, Pi의 Skill 선택을 대체하지도 않습니다. 선택된 Skill의 Reference 메타데이터를 모델이 볼 수 있게 할 뿐입니다.

## Skill References 공개 방식

Pi가 이미 발견한 Skill이라면 이 패키지뿐 아니라 다른 패키지, 전역 Skill 디렉터리, 신뢰한 프로젝트에서 제공한 Skill에도 동작합니다. Extension은 다음 두 시점 중 하나에서 해당 Skill과 같은 디렉터리의 `references.json`을 확인합니다.

- Skill의 `SKILL.md`를 `read`로 정상적으로 읽은 뒤
- 에이전트가 시작되기 전 `/skill:name`이 펼쳐진 뒤

문법적으로 올바르고 32 KiB 이하인 파일은 화면에 표시하지 않는 선택 메타데이터로 모델에 전달됩니다. 기존 Skill 읽기 결과와 Pi의 기본 TUI 표시는 바뀌지 않습니다. 모델이 실제로 Reference를 읽으면 Pi의 일반 `read` Tool UI에 그대로 나타납니다. 파일이 없거나, 잘못됐거나, 너무 크거나, 읽을 수 없으면 아무 동작도 하지 않으며 정상적인 Skill 읽기에는 영향을 주지 않습니다.

Developer 패키지에 포함된 `references.json`은 패키지 검사 과정에서 저장소의 스키마로 별도 검증합니다.

## 경계

Developer는 Pi의 에이전트 루프를 대체하지 않습니다. on/off 모드, 단계 상태, 별도 Tool, 고정 워크플로 프로토콜, 검증기, 영속화 계층을 만들지 않습니다. 설치된 Skill은 Pi의 기본 발견 방식과 점진적 공개 방식에 따라 동작합니다.

## 리소스 제어

Pi의 패키지 설정으로 패키지 리소스를 활성화하거나 제외할 수 있습니다.

Skill은 유지하고 Extension만 끄려면:

```json
{
  "packages": [
    {
      "source": "npm:@hobin/developer",
      "extensions": []
    }
  ]
}
```

Extension은 유지하고 Skill만 끄려면:

```json
{
  "packages": [
    {
      "source": "npm:@hobin/developer",
      "skills": []
    }
  ]
}
```

## 검사

```sh
pnpm install --frozen-lockfile
pnpm check
```

검사는 모델 제공자 없이 실행됩니다. Skill 발견, Skill References 정적 검증, 실행 중 공개 동작, 패키지에 포함되는 파일을 확인합니다.

## 라이선스

[MIT](./LICENSE)
