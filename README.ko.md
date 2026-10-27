# Hobin 에이전트 리소스

[English](./README.md) | 한국어

개발 판단과 source-grounded 학습을 위한 서비스 중립적인 원본입니다. Method는
[Agent Skills](https://agentskills.io/specification), 패키지는
[Agent Plugins](https://agent-plugins.org/specification)를 따릅니다. 호스트별 호환
정보는 선택 사항이며 같은 원본을 사용합니다.

## 이 패키지를 만든 이유

사람은 모든 세부 지식을 한꺼번에 머릿속에 올려두고 일하지 않습니다. 지금 어떤
일을 다루는지 판단할 수 있는 큰 작업 방식은 유지하고, 구체적인 상황을 만났을 때
필요한 자료를 찾아봅니다.

이 패키지들도 에이전트의 컨텍스트를 같은 방식으로 구성합니다. Skill에는 계속
유지할 작업 방법을 두고, 상황에 따라 결과를 바꿀 수 있는 세부 내용만 Reference에서
가져옵니다. 모든 내용을 미리 넣거나 하나의 고정된 절차로 만들지 않고, 현재 작업에
필요한 컨텍스트에 집중하기 위한 구조입니다.

[표준 채택 등록부](./docs/standards.md)와
[조건부 레퍼런스 계약](./docs/skill-references.md)부터 확인합니다. 후자는 자체
규약이지 Agent Skills의 추가 표준이 아닙니다. 등록부는 발행된 명세, 조건부 후보,
호스트 계약과 자체 규약을 구분합니다.

## 원본 리소스

| 위치 | 용도 |
| --- | --- |
| `packages/*/plugin.json` | 공통 패키지 식별자 `hobin-developer`, `hobin-learning` |
| [`packages/developer/skills/`](./packages/developer/skills) | 개발 판단 Skill 17개와 조건부 Reference |
| [`packages/learning/skills/`](./packages/learning/skills) | 읽기, 저장소 학습, 개념, 패턴, 연습을 위한 독립 Skill 5개 |
| [`skills/`](./skills) | 두 패키지 밖에서 제공하는 협업 Skill 4개 |
| [`agents/`](./agents) | 선택적인 프로젝트 지침 조각이며 표준 subagent 정의가 아님 |
| `packages/*/.claude-plugin/plugin.json` | 식별 정보만 담은 기존 Claude 형식의 호환 파일 |
| `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json` | 같은 패키지 루트를 가리키는 호스트별 카탈로그 |
| `packages/*/adapters/pi/` | 선택적인 기존 Pi lifecycle 연동과 선택기 |

`@hobin/developer`와 `@hobin/learning`은 독립적으로 배포하는 npm 패키지입니다.
하나의 단계형 workflow가 아니며 공통 agent loop, 필수 policy runtime, 숨은
cross-Skill state를 만들지 않습니다. Private workspace 루트는 하위 패키지를
재귀 탐색하는 세 번째 플러그인이 아닙니다.

**버전 경계: 0.2.2부터 공통 패키지 manifest를 제공합니다.** 0.2.1에는 Claude 호환
파일만 있습니다. 호스트의 marketplace 카탈로그는 개별 npm 압축파일이 아니라 이 Git
저장소에 있으므로 아래 설치에는 카탈로그가 포함된 checkout을 사용합니다.
[0.2.2 릴리스 기록](./docs/releases/0.2.2.md), [0.2.1 기록](./docs/releases/0.2.1.md),
[0.2.0 마이그레이션](./docs/releases/0.2.0.md)을 참고합니다.

## 기본 설치: 호스트의 플러그인 관리자로 한 번 설치

어느 디렉터리에서 실행해도 됩니다. 경로는 임의의 작업 프로젝트가 아니라
**리소스 checkout**을 가리킵니다. 설치 위치와 캐시는 각 호스트가 관리합니다.

### Claude Code

```sh
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-developer@hobin-agent --scope user
claude plugin install hobin-learning@hobin-agent --scope user
```

`user`가 기본 범위이며 이 컴퓨터에서 내 여러 프로젝트에 적용됩니다. 새 세션을
시작하거나 기존 세션에서 `/reload-plugins`를 실행합니다.

### Codex

```sh
codex plugin marketplace add /absolute/path/to/agent
codex plugin add hobin-developer@hobin-agent
codex plugin add hobin-learning@hobin-agent
```

설치는 사용자 설정에 유지되며 작업 디렉터리가 바뀌어도 적용됩니다. 새 세션을
시작합니다. Codex도 플러그인 Skill을 flat 이름 대신 식별자가 붙은 이름으로 노출합니다.

| 호스트 | 직접 호출 예시 |
| --- | --- |
| Claude Code 플러그인 | `/hobin-developer:sketch`, `/hobin-learning:technical-reading` |
| Codex 플러그인 | `$hobin-developer:sketch`, `$hobin-learning:technical-reading` |
| Pi | `/skill:sketch`, `/skill:technical-reading` |

이 호출 문법은 공통 표준이 아니라 호스트 기능입니다.
[설치·배포 상태·검증 범위](./docs/installation.md)와
[Claude 충돌 경계](./docs/claude-plugins.md)를 참고합니다. `--plugin-dir`는 개발용
세션 로드이며 기본 영구 설치 방식이 아닙니다. 자체 설치 관리자는 만들지 않습니다.

## 독립적인 Skill 사용과 참고 자료

지침으로 구성된 Skill을 읽는 데 Pi나 Node.js는 필요하지 않습니다. Supporting
files를 포함한 **Skill 디렉터리 전체**를 호환 호스트의 발견 경로에 설치하거나
노출합니다. 패키지 밖의 독립 Skill 4개에도 같은 원칙이 적용됩니다. npm 압축파일과
checkout은 같은 원본 리소스를 제공합니다.

Vercel Labs의 `skills` 같은 공통 도구를 이용하는 flat 설치도 선택할 수 있지만,
플러그인 namespace가 적용되지는 않습니다. 같은 이름의 기존 리소스와 덮어쓰기
경고를 확인합니다. 플러그인 설치도 기존 flat 사본을 자동 제거하지 않습니다.
다른 클라이언트가 쓰는 공유 리소스를 무작정 지우지 않습니다.

Developer는 일반 지침과 file access로 `references.json`을 읽고, Learning은 생성된
선택 지침을 `SKILL.md`에 포함합니다. 서비스 전용 reference loader는 필수가
아닙니다. 실제 method 선택과 지침 준수는 파일 형식이 강제하는 동작이 아니라
모델의 행동입니다.

## 선택적인 Pi 연동

기존에 배포된 패키지 설치는 유지됩니다.

```sh
pi install npm:@hobin/developer
pi install npm:@hobin/learning
```

소스 checkout에서는 실제 패키지 루트를 불러옵니다.

```sh
pi -e ./packages/developer
pi -e ./packages/learning
```

Pi manifest는 `adapters/pi/`를 가리킵니다. Extension 소스 경로를 직접 설정했다면
`extensions/`를 `adapters/pi/`로 바꿉니다. 패키지 설치와 `"extensions": []` 같은
리소스 필터는 유지됩니다. 세부 동작과 제어는 각 패키지 README에 있습니다. 이들은
기존 Pi 전용 구성요소이며 공통 Agent Plugins client extension으로 주장하지 않습니다.

## 개발과 검사

개발 도구로 Node.js 22.19+, pnpm 10.33.4, 고정한 Skill reference validator용
Python 3.11+가 필요합니다. 지침 자체의 실행 의존성은 아닙니다.

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-skills.txt
pnpm install --frozen-lockfile
pnpm check:standard  # Agent Skills와 Agent Plugins
pnpm check:portable  # 자체 규약, 실패 사례, 실제 배포 압축파일 포함
pnpm check:pi
pnpm check
# 해당 CLI가 설치된 경우 선택적으로 실행하는 model-free 검사:
pnpm check:claude
pnpm check:install -- claude
pnpm check:install -- codex
```

기본 Python이 3.11보다 오래됐다면 설치된 새 실행 파일로 환경을 만듭니다.
Windows에서는 shell에 맞게 `.venv\Scripts\activate`를 활성화합니다. 검사는 활성
환경의 `python`을 사용합니다.

Pi 개발 의존성 없이 검사하려면 `pnpm install --filter agent --frozen-lockfile` 후
활성 Python 환경에서 `pnpm check:portable`을 실행합니다. CI도 Pi와 Claude/Codex
없이 이 검사를 실행합니다. 상류 plugin schema와 Apache 라이선스는 원본 그대로
보관하고 커밋·SHA-256으로 출처를 고정합니다. 검사 중 schema를 다운로드하지 않습니다.

선택적인 설치 검사는 임시 HOME·설정과 실제 npm 압축파일로 두 작업 디렉터리,
호스트 inventory, 동명 peer 격리, 설치된 리소스의 원본 일치를 확인합니다. 모델을
호출하거나 실제 사용자 설정을 바꾸지 않습니다. 구조와 model-free 연동 검사가
모델의 선택 품질, 보안 인증, 미래의 모든 서비스 동작을 증명하지는 않습니다.
유료 실모델 평가와 배포는 별도로 승인받습니다.

## 라이선스

저장소 자체 리소스는 [MIT](./LICENSE)입니다. 개발 검사에 사용하는
[`schemas/upstream/`](./schemas/upstream/agent-plugins/1.0.0)의 상류 Agent Plugins
schema는 원래의 Apache-2.0 라이선스와 출처를 유지합니다.
