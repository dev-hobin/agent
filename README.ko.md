# Hobin 에이전트 리소스

[English](./README.md) | 한국어

dev-hobin이 관리하는 에이전트 skill 모음입니다. 코드 리뷰, 기능 개발, 엔지니어링 입장(stance),
skill 평가, 학습을 다룹니다. 각 역량은 `core/`에 명세로 한 번 정의하고, Claude Code와
Codex에 각 호스트가 권장하는 방식으로 따로 구현합니다.

## 구성

```text
core/<id>/                 인터페이스: SPEC.md, 지식, 스크립트, 자원, 수용 시나리오(와 트리거 세트)
claude/plugins/<plugin>/   Claude Code 구현체 (skills, agents, claude plugin eval용 평가)
codex/plugins/<plugin>/    Codex 구현체 (plugin.json, skills, agents/openai.yaml)
codex/evals/               Codex 구현체의 plugin-eval 벤치마크
.agents/skills/implementing-core/   명세 변경을 두 구현체에 반영하는 skill
```

명세는 관찰 가능한 결과를 약속하고, 각 수용 시나리오는 정답 예시로 증명합니다. 각
구현체는 약속마다 자기 호스트에서 얼마나 강하게 지키는지(강제, 지시, 미지원)를 밝히고,
그 호스트의 공식 도구로 평가합니다.

## 플러그인

| 플러그인 | Skill | 용도 |
| --- | --- | --- |
| `hobin-review` | `reviewing-code` | diff, 브랜치, PR 리뷰 또는 지정한 범위 진단. 확인된 P0/P1 결함만 보고 |
| `hobin-feature` | `developing-features` | 인수 시나리오, 소유자 결정, 설계, 작은 단위 구현, 검증으로 기능 개발 |
| `hobin-stances` | `applying-stances`, `enforcing-conventions` | 짧은 입장을 지침 파일에 반영하고, 반복해서 어기는 규칙을 자동 검사로 바꿈 |
| `hobin-skill-eval` | `evaluating-skills` | 어떤 에이전트 skill이든 구조, 회귀, 벤치마크 평가 |
| `hobin-learning` | `technical-reading`, `opensource-reading`, `conceptualize`, `patternize`, `exercise` | 출처에 근거한 학습과 연습 |

## 설치

이 저장소를 `hobin` 마켓플레이스로 한 번 등록하고, 쓸 것만 설치합니다.

```sh
# Claude Code
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-review@hobin --scope user
# Codex
codex plugin marketplace add /absolute/path/to/agent
codex plugin add hobin-review@hobin
```

설치 후 새 세션을 시작하세요. 요청이 맞으면 에이전트가 skill을 스스로 고릅니다. 직접 시작하려면
Claude Code에서 `/hobin-review:reviewing-code`, Codex에서 `$hobin-review:reviewing-code`를 씁니다.
Codex에서는 `/hooks`에서 함께 설치된 hook을 한 번 신뢰해야 결과 검사가 자동으로 실행됩니다.
자세한 내용은 [설치](./docs/installation.md)에 있습니다.

## 역량 바꾸기

`core/<id>/SPEC.md`(와 그 자원)를 고친 뒤 `/implementing-core <id>`를 실행합니다. 두
구현체가 새 명세를 따를 때까지 `pnpm check`가 실패합니다.

## 개발과 검사

Node.js 22.19+, pnpm 10.33.4, 그리고 고정된 Agent Skills 검증기용 Python 3.11+이 필요합니다.

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-skills.txt
pnpm install --frozen-lockfile
pnpm check                      # 표준, core 대비 구현체, 평가 suite (모델 호출 없음)
pnpm check:claude               # claude plugin validate --strict
pnpm check:install -- claude    # 격리 설치, 자격 증명·모델 호출 없음
pnpm check:install -- codex
```

호스트 평가는 모델을 호출하므로 비용이 듭니다. 명령은 영문 README와 Codex 레시피
(`.agents/skills/implementing-core/references/codex.md`)를 참고하세요.

## 라이선스

저장소 소유 리소스는 [MIT](./LICENSE)입니다. [`schemas/upstream/`](./schemas/upstream/agent-plugins/1.0.0)의
수정하지 않은 Agent Plugins 스키마는 원래의 Apache-2.0 라이선스와 출처 표기를 유지합니다.
