# Hobin 에이전트 리소스

[English](./README.md) | 한국어

개발 판단과 source-grounded 학습을 위한 에이전트 중립적인 원본입니다. Skill은
[Agent Skills 명세](https://agentskills.io/specification)를 따르며, 서비스별 연동은
같은 원본을 소비하는 선택 사항입니다.

## 이 패키지를 만든 이유

사람은 모든 세부 지식을 한꺼번에 머릿속에 올려두고 일하지 않습니다. 지금 어떤
일을 다루는지 판단할 수 있는 큰 작업 방식은 유지하고, 구체적인 상황을 만났을 때
필요한 자료를 찾아봅니다.

이 패키지들도 에이전트의 컨텍스트를 같은 방식으로 구성합니다. Skill에는 계속
유지할 작업 방법을 두고, 상황에 따라 결과를 바꿀 수 있는 세부 내용만 Reference에서
가져옵니다. 모든 내용을 미리 넣거나 하나의 고정된 절차로 만들지 않고, 현재 작업에
필요한 컨텍스트에 집중하기 위한 구조입니다.

[표준 출처와 채택 범위](./docs/standards.md),
[조건부 레퍼런스 계약](./docs/skill-references.md)부터 확인합니다. 후자는 저장소의
자체 규약이지 Agent Skills의 추가 표준이 아닙니다.

## 원본 리소스

| 위치 | 용도 |
| --- | --- |
| [`packages/developer/skills/`](./packages/developer/skills) | 경험으로 쌓은 직관을 명시적인 개발 판단으로 옮긴 Skill 17개와 조건부 Reference |
| [`packages/learning/skills/`](./packages/learning/skills) | 기술 문서 읽기, 저장소 학습, 개념화, 패턴 발견, 연습을 위한 독립 Skill 5개 |
| [`skills/`](./skills) | 두 패키지 밖에서 제공하는 협업 Skill 4개 |
| [`agents/`](./agents) | 프로젝트 지침에 선택해 합치는 컨텍스트 조각이며, 표준 subagent 정의가 아님 |
| `packages/*/adapters/pi/` | 선택적인 Pi lifecycle 연동과 선택기 |
| `packages/*/.claude-plugin/plugin.json` | Skill을 복제하지 않는 선택적 Claude 패키지 식별 metadata |

`@hobin/developer`와 `@hobin/learning`은 서로 독립적으로 배포하는 npm 패키지입니다.
하나의 단계형 workflow가 아니며, 공통 agent loop, 필수 policy runtime, 숨은
cross-Skill state를 만들지 않습니다.
[0.2.0 마이그레이션 안내](./docs/releases/0.2.0.md)와
[0.2.1 namespace metadata 준비](./docs/releases/0.2.1.md)에 변경을 기록했습니다.
Manifest 버전 준비와 실제 npm 배포는 별개입니다.

## Agent Skills 호스트에서 사용

호스트가 발견하는 위치에 **Skill 디렉터리 전체**를 설치하거나 노출합니다.
`SKILL.md`만 복사하지 말고 supporting file도 포함합니다. npm 패키지에서 꺼낸
`skills/`와 이 저장소의 디렉터리는 같은 원본이며, 지침을 읽는 데 Pi나 Node.js는
필요하지 않습니다.

아래는 공통 탐색 규칙이 아니라 호스트별 개인 경로와 호출 예시입니다.

| 호스트 | 발견 또는 로드 방식 | 직접 호출 예시 |
| --- | --- | --- |
| [Claude Code](https://code.claude.com/docs/en/plugins) | 패키지 루트를 플러그인으로 로드 | `/hobin-developer:sketch` |
| [Codex](https://developers.openai.com/codex/skills/) | `~/.agents/skills/<name>/` | `$sketch` |
| Pi | 기본 Skill 경로 또는 아래 패키지 manifest | `/skill:sketch` |

로컬 개발에서는 symlink를 지원하는 호스트가 원본 디렉터리를 가리키게 할 수
있습니다. 배포할 때는 디렉터리 전체를 복사하고 패키지나 저장소 버전을 고정합니다.
설치 전에 같은 이름의 Skill을 확인하며, 다른 리소스를 업데이트로 덮어쓰지 않습니다.
이 저장소는 전역 에이전트 설정을 바꾸거나 범용 설치 관리자를 제공하지 않습니다.

Developer는 hook 없이 `references.json`을 읽을 수 있고, Learning은 생성된 선택
지침을 `SKILL.md`에 포함합니다. 일반 지침과 file access만으로 필요한 참고 자료를
읽으며 서비스별 loader는 필수가 아닙니다. 실제 선택과 지침 준수는 파일 형식이
강제하는 동작이 아니라 모델의 행동입니다.

## 선택적인 Claude namespace

Flat Skill 설치는 Claude의 기본 `/model`, `/doctor`, 번들 `/verify`와 충돌할 수
있습니다. 패키지는 표준 Skill 이름을 바꾸지 않고 plugin 이름만 `hobin-developer`,
`hobin-learning`으로 고정합니다. 실제 작업할 프로젝트에서 패키지 루트를 로드합니다.

```sh
claude --plugin-dir /path/to/agent/packages/developer \
       --plugin-dir /path/to/agent/packages/learning
```

이후 `/hobin-developer:model`, `/hobin-learning:technical-reading`처럼 호출합니다.
일반 `skills add` 설치가 이 namespace를 적용하거나 기존 flat Skill을 제거하지는
않습니다. Codex용 공통 설치 명령과 보장 범위는
[Claude 로딩 및 이름 충돌 안내](./docs/claude-plugins.md)에 있습니다. 원본 method에
전용 설치 관리자나 호스트 runtime을 추가하지 않습니다.

## 선택적인 Pi 연동

기존 패키지 설치는 유지됩니다.

```sh
pi install npm:@hobin/developer
pi install npm:@hobin/learning
```

소스 체크아웃에서는 저장소 루트가 아니라 실제 패키지 디렉터리를 불러옵니다.

```sh
pi -e ./packages/developer
pi -e ./packages/learning
```

Manifest는 `adapters/pi/`를 가리킵니다. Extension 소스 경로를 직접 설정했다면
`extensions/`를 `adapters/pi/`로 바꿉니다. 패키지 설치와 `"extensions": []` 같은
resource filter는 유지됩니다. 세부 동작은 각 패키지 README에서 설명합니다.

## 개발

개발 도구로 Node.js 22.19+, pnpm 10.33.4, 고정한 공식 reference validator용
Python 3.11+가 필요합니다. 지침으로 구성된 Skill의 실행 의존성은 아닙니다.
적합한 Python 실행 파일로 로컬 환경을 만듭니다.

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-skills.txt
pnpm install --frozen-lockfile
pnpm check:portable
pnpm check:pi
# Claude Code가 설치된 경우 선택적인 기본 manifest 검사:
pnpm check:claude
# 표준/portable 및 Pi 검사를 함께 실행하려면:
pnpm check
```

기본 Python이 3.11보다 오래됐다면 환경을 만들 때 설치된 새 실행 파일을 선택합니다.
Windows에서는 사용하는 shell에 맞게 `.venv\Scripts\activate`를 활성화합니다.
검사는 활성 환경의 `python`을 사용합니다.

Pi 개발 의존성 없이 검사하려면 `pnpm install --filter agent --frozen-lockfile`로
설치하고 활성화한 Python 환경에서 `pnpm check:portable`을 실행합니다. CI에서도
이 분리를 확인합니다. Pi 검사는 전체 workspace 설치를 사용합니다.

기본 검사는 provider-free입니다. 구조, 패키지 내용, Pi 연동의 검증이 실제 모델의
올바른 선택이나 미래의 모든 서비스 지원을 증명하지는 않습니다. 실모델 평가는
별도로 범위를 정해 선택적으로 실행합니다.

## 라이선스

[MIT](./LICENSE)
