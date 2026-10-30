# Hobin 에이전트 리소스

[English](./README.md) | 한국어

dev-hobin이 관리하는 Agent Skills 모음입니다. 코드 리뷰, 기능 개발, 엔지니어링 입장(stance),
skill 평가, 학습을 다룹니다. Skill은 [Agent Skills](https://agentskills.io/specification),
패키지는 [Agent Plugins](https://agent-plugins.org/specification)를 따릅니다. 호스트별
파일은 선택 사항이며, 모두 같은 원본을 가리킵니다.

## 설계

- **진입점은 적게, 명시적으로 호출.** 패키지마다 하는 일이 하나입니다. 리뷰와 기능 개발은
  이름으로 불러야 실행되므로, 서로 또는 다른 skill과 자동 선택을 다투지 않습니다.
- **관점은 skill이 아니라 reference.** 리뷰는 관점(계약, 비동기 흐름, 구조, 데이터 손실,
  증거)마다 한 번씩 집중해서 검토합니다. 호스트가 subagent를 지원하면 병렬로 돌립니다.
  기능 개발의 설계 단계에서도 같은 관점 파일을 씁니다. 원본은 `sources/lenses/` 한 곳에만 둡니다.
- **Gotchas가 먼저이고, 관찰된 실패만 씁니다.** skill은 강한 모델이 실제로 저지른 실수를
  맨 앞에 두고, 그다음에 절차를 둡니다.
- **결정적으로 처리할 수 있는 부분은 scripts와 assets로 둡니다.** 리뷰 맥락 수집,
  인수 시나리오 파일, 평가 실행기가 여기에 해당합니다.
- **입장(stance)은 사용자의 지침 파일에 둡니다.** "저장된 데이터는 보존" 같은 기본 행동은
  승인을 받아 `AGENTS.md`나 `CLAUDE.md`에 넣습니다. 계속 어겨지면 자동 검사로 올립니다.
- **측정된 것만 남기고, 채점은 결정적으로 합니다.** 각 패키지의 `evals/`에는 judge 모델이
  아니라 코드로 판정하는 통과/실패 회귀 case와 트리거 case가 있습니다. 별도의 벤치마크가
  각 skill을 skill 없음, 그리고 길이를 맞춘 대조군과 비교합니다.

[표준 채택 기록](./docs/standards.md)과 [재구성 계획](./docs/plans/2026-10-30-restructure.md)을
참고하세요.

## 패키지

| 플러그인 | Skill | 용도 |
| --- | --- | --- |
| `hobin-review` | `reviewing-code` | diff, 브랜치, PR을 리뷰하거나 지정한 범위를 진단합니다. 확인된 P0/P1 결함만 보고합니다 |
| `hobin-feature` | `developing-features` | 인수 시나리오 → 소유자 결정 → 설계 → 작은 단위 구현 → 독립 검증 순으로 기능을 개발합니다 |
| `hobin-stances` | `applying-stances`, `enforcing-conventions` | 짧은 입장을 지침 파일에 넣고, 반복해서 어기는 규칙을 자동 검사로 바꿉니다 |
| `hobin-skill-eval` | `evaluating-skills` | 어떤 Agent Skill이든 트리거 평가와 결과 평가를 합니다 |
| `hobin-learning` | `technical-reading`, `opensource-reading`, `conceptualize`, `patternize`, `exercise` | 출처에 근거한 학습과 연습 |

각 패키지는 독립된 npm 패키지(`@hobin/<name>`)이자 플러그인입니다. 쓰는 것만 설치하면 됩니다.

## 설치

**이 리소스 저장소의 checkout**을 한 번 등록한 뒤 플러그인을 설치합니다.
마켓플레이스 이름은 `hobin`입니다.

### Claude Code

```sh
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-review@hobin --scope user
claude plugin install hobin-feature@hobin --scope user
```

### Codex

```sh
codex plugin marketplace add /absolute/path/to/agent
codex plugin add hobin-review@hobin
codex plugin add hobin-feature@hobin
```

설치한 뒤에는 새 세션을 시작하세요.

| 호스트 | 호출 |
| --- | --- |
| Claude Code | `/hobin-review:reviewing-code`, `/hobin-feature:developing-features` |
| Codex | `$hobin-review:reviewing-code`, `$hobin-feature:developing-features` |
| Pi | `/skill:reviewing-code` |

프로젝트에 입장을 넣으려면 Claude Code에서는 `/hobin-stances:applying-stances`,
Codex에서는 `$hobin-stances:applying-stances`를 실행합니다. `AGENTS.md`나
`CLAUDE.md`에 들어갈 변경을 정확히 보여 주고, 승인한 뒤에만 기록합니다.

0.2.x에서 업그레이드한다면 [0.3.0 릴리스 노트](./docs/releases/0.3.0.md)에서 이전 이름과
새 이름의 대응표를 보세요. 자세한 내용은 [설치](./docs/installation.md),
[Claude 플러그인 경계](./docs/claude-plugins.md)에 있습니다.

## 다른 호스트에서 쓰기

지침만으로 된 skill은 Node.js도, 특정 호스트도 필요하지 않습니다. 각 **skill 디렉터리를
통째로**(`references/`, `scripts/`, `assets/` 포함) 호환 호스트에 노출하면 됩니다.
`agents/openai.yaml`은 Codex 메타데이터이며 다른 호스트는 무시합니다. 스크립트에는
POSIX shell(`collect-context.sh`)이나 Node.js 22(`benchmark.mjs`)가 필요합니다.

## 저장소 구조

| 위치 | 용도 |
| --- | --- |
| `packages/*/` | 플러그인: `plugin.json`, `.claude-plugin/plugin.json`, `skills/` |
| `sources/lenses/` | 여러 skill에 복사되는 관점 파일의 단일 원본 (`pnpm sync:sources`) |
| `packages/*/evals/` | `claude plugin eval` 회귀·트리거 case. npm 배포에서 제외 |
| `packages/*/benchmarks/` | 숨은 테스트 벤치마크 과제. npm 배포에서 제외 |
| `archive/` | 출처 보존용으로 남긴 0.2.2 리소스 |
| `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json` | Claude Code와 Codex 카탈로그 |

## 개발과 검사

작성 도구로 Node.js 22.19+, pnpm 10.33.4가 필요하고, 고정된 skill 검증기를 돌리려면
Python 3.11+이 필요합니다.

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-skills.txt
pnpm install --frozen-lockfile
pnpm check            # 표준, 공유 원본 드리프트, 정책, 실제 패키지 산출물, Pi
pnpm check:claude     # 선택, 모델 호출 없음
pnpm check:install -- claude   # 선택, 격리된 설치 검사
pnpm check:install -- codex
```

평가는 모델을 호출하므로 비용이 듭니다. 평가는 세 층으로 나뉩니다.

| 층 | 명령 | 게이트 |
| --- | --- | --- |
| 구조 | `pnpm check` (모델 없이 평가 case, 채점 정규식, fixture, 숨은 테스트까지 검증) | 모든 변경 |
| 회귀 | `claude plugin eval packages/<name> --tag regression --ablation none --scaffold --allow-tools Bash Write Edit --model sonnet --threshold 1.0` | exit code |
| 트리거 | `claude plugin eval packages/<name> --tag trigger --ablation none --model sonnet` | exit code |
| 벤치마크 | `claude plugin eval packages/<name> --tag regression --scaffold --allow-tools Bash Write Edit` (플러그인 유무 비교)와 `node packages/skill-eval/skills/evaluating-skills/scripts/benchmark.mjs packages/<name> --execute` (숨은 테스트) | 없음. 기록하고 비교 |

회귀와 트리거의 채점기는 결정적입니다(정규식, 도구 사용 여부, 파일 존재). 같은 출력에는
항상 같은 판정이 나옵니다. 모델의 행동은 여전히 실행마다 달라지며, 그 변동은 벤치마크가
측정합니다. 게이트가 변동을 가리지는 않습니다.

## 라이선스

저장소 소유 리소스는 [MIT](./LICENSE)입니다. [`schemas/upstream/`](./schemas/upstream/agent-plugins/1.0.0)의
수정하지 않은 Agent Plugins 스키마는 원래의 Apache-2.0 라이선스와 출처 표기를 유지합니다.
