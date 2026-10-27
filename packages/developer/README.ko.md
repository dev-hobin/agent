# @hobin/developer

[English](./README.md) | 한국어

[Agent Skills 명세](https://agentskills.io/specification)를 따르는 개발 판단 method와
조건부 Reference 모음입니다. 호스트별 연동은 선택 사항입니다.

## 만든 이유

숙련된 개발자는 모든 설계 원칙을 한꺼번에 떠올리며 일하지 않습니다. 지금 어떤
문제를 다루는지, 다음에 무엇을 판단해야 하는지에 관한 큰 사고 틀은 계속 유지하고,
구체적인 상황을 만났을 때 필요한 자료를 찾아봅니다.

`@hobin/developer`는 개발자가 경험으로 쌓은 이런 직관을 검토 가능한 Skill과
Reference로 옮깁니다. Skill에는 판단의 중심이 되는 작업 방법을 두고, 특정
조건에서만 중요한 세부 내용은 Reference로 나눕니다. 모든 개발 지식을 매번
컨텍스트에 넣는 대신, 현재 문제에 맞는 내용만 가져와 사용할 수 있습니다.

이것은 고정된 workflow가 아니라 점진적으로 컨텍스트를 구성하는 방식입니다.
Reference가 필요하지 않을 수도 있고, 하나 또는 여러 개를 함께 읽을 수도 있습니다.

## 에이전트 중립적인 Skill

원본은 `skills/` 아래의 디렉터리 17개입니다. 호스트의 Skill 발견 방식에 맞게
**디렉터리 전체**를 설치하거나 노출합니다. 있는 경우 `references.json`과
`references/`도 포함해야 합니다. 지침을 읽는 데 Pi나 Node.js는 필요하지 않습니다.

Codex의 개인 Skill 경로는 `~/.agents/skills/`입니다. Claude도 `~/.claude/skills/`의
flat Skill을 지원하지만 기본 명령과의 충돌을 피하려면 아래의 패키지 플러그인
방식을 사용합니다. 경로와 namespace는 호스트 기능이지 공통 Skill 형식이 아닙니다.
서비스별 method 사본이나 전용 reference loader는 필요하지 않습니다.

Developer는 별도의 agent loop, on/off mode, phase state, custom Tool, runtime
verifier, workflow protocol, persistence layer를 만들지 않습니다. 호스트나 사용자가
선택한 `SKILL.md`가 method, 경계, 결과, 종료 조건을 정의합니다. Skill은 독립적인
판단이며 필수 단계나 하나의 pipeline이 아닙니다.

## 사용

평소처럼 에이전트에 요청하면 됩니다. 호스트의 catalog에서 맞는 Skill을 선택할 수
있습니다.

```text
이 요구사항을 구현하기 전에 반드시 유지해야 할 조건을 정리해 줘.
이 버그 뒤에 남아 있는 조건과 금지 상태를 모델링해 줘.
코드를 작성하기 전에 구현 가능한 설계안을 그려 줘.
반복되는 이 구조를 지금 추상화해도 되는지 판단해 줘.
현재 증거로 완료됐다고 말할 수 있는 범위를 검증해 줘.
```

직접 호출 문법은 호스트에 따라 다릅니다. 예를 들어 Claude 플러그인에서는
`/hobin-developer:specify`, Codex에서는 `$specify`, Pi에서는 `/skill:specify`를 씁니다.

## 선택적인 Claude namespace

패키지의 `.claude-plugin/plugin.json`은 설치 디렉터리와 무관하게 plugin 이름을
`hobin-developer`로 고정합니다. 실제 작업할 프로젝트에서 개별 Skill이 아닌
**패키지 루트**를 로드합니다.

```sh
claude --plugin-dir /path/to/agent/packages/developer
```

기본 명령과 겹치는 bare name 대신 `/hobin-developer:model`,
`/hobin-developer:doctor`, `/hobin-developer:verify`를 사용합니다. 식별 metadata만
추가하고 기존 `skills/`를 그대로 사용합니다. 일반 `skills add` 설치에 namespace가
자동 적용되거나 기존 flat Skill이 제거되지는 않습니다. 자세한
[로딩 방법과 보장 범위](https://github.com/dev-hobin/agent/blob/main/docs/claude-plugins.md)를
확인합니다.

## 조건부 참고 자료

Core method는 Reference를 하나도 읽지 않아도 완전해야 합니다. `references.json`이
있는 Skill은 호스트가 이미 해당 호출의 bounded metadata를 제공하지 않았다면
같은 디렉터리의 JSON을 읽도록 지시합니다. 제외 조건이 우선하고, 현재 결과를
실질적으로 바꿀 Reference만 읽습니다. 경로는 작업 디렉터리가 아닌 Skill 기준입니다.

`references.json`과 `when`/`unless`의 의미는 자체 규약이지 호스트가 기본으로
해석해야 하는 Agent Skills 표준 기능이 아닙니다. 저장소의
[표준 기준](https://github.com/dev-hobin/agent/blob/main/docs/standards.md)과
[레퍼런스 계약](https://github.com/dev-hobin/agent/blob/main/docs/skill-references.md)을
참고합니다. 패키지의 metadata 구조는 개발 과정에서 검증하지만, 실제 선택은 모델의
행동이지 강제 접근 제어가 아닙니다.

## 선택적인 Pi 어댑터

기존 설치는 유지됩니다. 이 어댑터는 Pi와 Node.js 22.19 이상이 필요합니다.

```sh
pi install npm:@hobin/developer
# 한 번만 실행하려면:
pi -e npm:@hobin/developer
```

`adapters/pi/skill-references/index.js`는 Pi가 발견한 Skill의 같은 디렉터리에 있는
`references.json`을 다음 시점에 확인합니다. 이 패키지뿐 아니라 다른 패키지나
신뢰한 Skill 위치에도 적용됩니다.

- `SKILL.md`를 `read`로 정상적으로 읽은 뒤
- 에이전트가 시작되기 전 `/skill:name`이 펼쳐진 뒤

문법적으로 올바른 32 KiB 이하 JSON은 화면에 표시하지 않는 선택 metadata로
전달됩니다. 기존 read 결과와 TUI 표시는 유지됩니다. 어댑터는 외부 JSON을 자체
schema로 검증하거나 Reference를 선택하거나 본문을 읽지 않습니다. 파일이 없거나,
잘못됐거나, 너무 크거나, 읽을 수 없으면 아무 동작도 하지 않습니다.

이 어댑터 없이도 Skill이 직접 JSON과 필요한 본문을 읽는 기본 경로는 유지됩니다.
패키지 설치는 그대로 사용하고, 소스 경로를 직접 지정했다면
`extensions/skill-references/index.js`를 `adapters/pi/skill-references/index.js`로
바꿉니다.

### Pi 리소스 제어

Skill은 유지하고 어댑터만 끄려면:

```json
{
  "packages": [
    { "source": "npm:@hobin/developer", "extensions": [] }
  ]
}
```

어댑터는 유지하고 Skill만 끄려면:

```json
{
  "packages": [
    { "source": "npm:@hobin/developer", "skills": [] }
  ]
}
```

## 개발 검사

루트 README의 개발 환경을 준비한 뒤 저장소 루트에서 실행합니다.

```sh
pnpm check:portable
pnpm --filter @hobin/developer check:pi
# Claude Code가 설치된 경우 선택적으로 실행:
pnpm check:claude
```

Portable 검사는 공식 reference validator, 자체 metadata 규약, 실제 packed/relocated
bundle을 확인합니다. Pi 검사는 기본 discovery와 수동 metadata 공개를 확인합니다.
실모델의 올바른 reference 선택을 증명하는 검사는 아닙니다.

## 라이선스

[MIT](./LICENSE)
