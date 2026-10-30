# 저장소 재구성 계획 (2026-10-30)

상태: P1·P2·P3 완료, P4 1차(Sonnet 결과 평가, 3개 모델 트리거 평가) 완료, P5 준비 완료(릴리스 전). 브랜치 작업만 하며 배포, 원격 push, 유료 평가는 하지 않는다.
P4 평가 실행과 P5 릴리스는 각각 별도 승인을 받는다.

## 0. 원칙

| # | 원칙 | 근거 |
| --- | --- | --- |
| 1 | **이식성이 우선이다.** 핵심은 Agent Skills와 Agent Plugins 표준 요소(SKILL.md, references, scripts, assets, plugin.json)로만 만든다. 호스트 전용 요소(`commands/`, `agents/`)는 쓰지 않는다 | [standards.md](../standards.md) "A host integration must not be required" |
| 2 | **skill 하나는 응집된 작업 하나다.** 진입점은 사용자가 명시적으로 부르는 skill이다 | Codex skills 가이드 "one job", Anthropic encoded preference |
| 3 | **판단 관점은 skill이 아니라 진입점 skill의 reference다.** 관점마다 subagent를 띄우고, subagent가 없는 호스트에서는 순서대로 처리한다 | Codex 팀 `code-review` skill 구조, 같이 설치된 skill끼리 충돌한다는 측정 결과 |
| 4 | **삭제 테스트를 통과한 내용만 남긴다.** Gotchas를 맨 위에, 구체적인 "찾아라" 질문을 그다음에 둔다 | Agent Skills best practices, Thariq, 맹기완 9강 |
| 5 | **결정적으로 처리할 수 있는 부분은 scripts와 assets로 옮긴다** (맥락 수집, 시나리오 JSON, 실행기) | Agent Skills using-scripts, 맹기완 "MD로 못 막는다" |
| 6 | **입장(stance)은 사용자의 CLAUDE.md·AGENTS.md에 승인을 받아 넣는다.** 가능하면 타입이나 lint로 올린다 | Claude 기능 개요, OpenAI Harness Engineering, 맹기완 8강 |
| 7 | **병합과 삭제는 평가로 확정한다** | Anthropic skill-creator, OpenAI eval 가이드 |

## 1. 목표 구조 (P3)

```text
marketplace "hobin"
├─ packages/review/      → hobin-review
│   skills/reviewing-code/   SKILL.md(변경 검토 | 범위 진단 모드), references/perspectives/
│                            {contract,async-flow,structure,data-loss,evidence}.md,
│                            scripts/collect-context.sh, agents/openai.yaml
├─ packages/feature/     → hobin-feature
│   skills/developing-features/  references/phases/{requirements,design/*,async-design}.md,
│                                assets/acceptance-scenarios.json
├─ packages/stances/     → hobin-stances
│   skills/applying-stances/ (assets/stances.md), skills/enforcing-conventions/
├─ packages/learning/    → hobin-learning (축소, 명시 호출)
├─ packages/skill-eval/  → hobin-skill-eval: skills/evaluating-skills/
├─ sources/              관점·단계의 공통 원본. 생성 스크립트로 각 skill에 반영하고 드리프트 검사를 둔다
├─ evals/<skill>/        evals.json, triggers.json, results/ (배포 안 함)
└─ archive/              보관하는 reference (어디에도 연결하지 않음)
```

## 2. 기존 26개 skill의 이동 위치

| 기존 | 새 위치 |
| --- | --- |
| specify, model | feature `phases/requirements.md` + review `perspectives/contract.md` |
| sketch, variation, naming, module | feature `phases/design/*` + review `perspectives/structure.md`. 인터프리터·컴파일러 ref와 model의 proof·solver·logic·planning ref는 `archive/` |
| signal, abstraction-review, schedule | review `perspectives/structure.md`. 핵심 입장은 `stances.md`로 |
| process, task-protocol | feature `phases/async-design.md` + review `perspectives/async-flow.md` |
| information-loss | review `perspectives/data-loss.md` |
| verify, claim-evidence | review `perspectives/evidence.md`. 인수 목록 형식은 feature `assets/`로 |
| doctor | review `reviewing-code`의 범위 진단 모드 |
| convention-judgment | stances `enforcing-conventions` |
| adversarial-eval | skill-eval `evaluating-skills` |
| visualize, delegation-gate, work-slice | 삭제. 기본 행동을 바꾸는 1~3줄만 `stances.md`로 |
| learning 5개 + learning-checkpoint | learning 유지·축소. checkpoint는 exercise의 모드로. conceptualize·patternize 병합은 P4에서 결정 |
| `agents/` 조각, `skill-boundaries.md`, Context Directions | `stances.md`와 각 description의 "Not for"로 흡수 |

## 3. 작성 표준

frontmatter에는 `name`(동명사형, 디렉터리명과 같음), `description`, `metadata.version`만 둔다.
description은 3인칭으로 무엇을 하는지 쓰고, 이어서 `Use when …`, `Not for …`를 쓴다.
진입점 skill에는 "Use only when explicitly requested."를 넣는다.

본문은 `Gotchas` → `Procedure` → `Assets / Scripts` → `When to read more` 순서로 둔다.
목표는 100줄 이하다. Core Question, Judgment Spine, Supporting Materials, Status 블록, 형제 skill 배제 문구는 뺀다.

## 4. 평가 체계 (P2 골격, P4 실행)

| 평가 | 내용 |
| --- | --- |
| 트리거 | 진입점 skill마다 질의 20개(트리거될 것 / near-miss), 질의당 3회 실행 |
| 결과 | 실제 과제 2~3개 × 조건 3개(skill 있음 / 없음 / 길이를 맞춘 대조군). 판별력 있는 assertion, 토큰과 시간 기록 |
| 모델 | Haiku, Sonnet, Opus |
| 판정 | 무스킬 대비 이득이 없으면 은퇴. preference 유형은 워크플로 준수도로 판정 |

## 5. 단계

| 단계 | 내용 | 완료 기준 |
| --- | --- | --- |
| P1 정리 | 현재 구조를 유지하면서 표준 결함만 고친다 | `pnpm check` 통과, Pi 동작 보존 |
| P2 평가 골격 | `evals/` 구조, 진입점별 트리거·결과 과제, 실행기 | 구조 검사 통과 (실행은 승인 후) |
| P3 재구성 | §1~§3을 반영하고 `sources/` 생성과 드리프트 검사, `archive/` 이동 | 새 구조로 `pnpm check`와 Claude·Codex 설치 검사 통과 |
| P4 평가와 결정 | 승인 후 실행해서 은퇴·병합을 확정 | skill별 판정 기록 |
| P5 릴리스 준비 | 0.3.0, 마켓플레이스 `hobin`, 이름 변경, 마이그레이션 노트 | 배포는 요청이 있을 때 |

남은 결정 (P5 전까지): npm 패키지를 플러그인과 1:1로 나눌지(권장), Pi developer 어댑터를 갱신할지 은퇴시킬지.

## 6. P1 결과

### 바꾼 것

| 항목 | 내용 |
| --- | --- |
| description 26개 | 3인칭 동사로 시작하고 `Not for …`를 넣었다. 기존 Boundary 절과 이웃 skill에서 near-miss를 가져왔다. 가장 긴 것은 621자다 (상한 1024자) |
| 참조 안내 상용구 | 13개 skill에 똑같이 들어 있던 16줄 "Supporting Materials"를 6줄 `When to read more`로 줄였다. 기능(`unless`면 not-applicable, 해당 `when`만 읽기, 호스트 선택 우선)은 그대로다. Pi 어댑터는 `references.json`만 읽으므로 영향이 없다 |
| Gotchas 4개 | 근거가 있는 skill에만 넣었다 (아래 표) |
| 예측 순서 충돌 | `agents/inspectable-collaboration.md`(2026-08-25)는 "처음 보는 메커니즘은 풀이 예시를 먼저 보이고, 조건을 바꾼 사례에서만 예측을 요청"한다. 이 규칙이 exercise의 "설명 전 예측"과 opensource-reading의 "설명 전 가설"(2026-08-02)보다 나중에 생겼으므로 오래된 두 규칙의 적용 범위를 좁혀 맞췄다 |
| `.claude-plugin/plugin.json`의 "legacy" 표기 | Claude Code 문서상 현재 manifest 위치이므로 "Claude Code host manifest"로 고쳤다 (standards, AGENTS, README 영문·국문) |
| `docs/standards.md` | Skill 작성 지침 결정(3인칭 + `Use when` + `Not for`, 증거 기반 Gotchas, 참조 안내 축약)과 Agent Plugins 1.1.0 Working Draft 관찰 항목을 기록했다 |

### Gotchas의 근거

근거는 crm-client의 실제 수정 커밋 재연 실험(2026-10-29, Opus)이다. 각 커밋의 직전 상태에서 시작하고, 그 커밋의 테스트를 숨은 채점기로 썼다.

| skill | 관찰 |
| --- | --- |
| information-loss-judgment | 이미 저장된 SMS payload를 지우면 안 되는 과제에서, skill 사용을 강제한 실행이 이 skill로 저장 데이터 삭제를 정당화했다 |
| specify | 같은 과제에서 기존 저장 데이터를 어떻게 다룰지 결정이 필요하다는 점을 드러낸 실행이 하나도 없었다 |
| model | 진료비 응답의 Row 봉투 과제에서, 봉투가 없거나 빈 JSON인 응답을 정상인 빈 결과로 받아들이는 실패가 관찰됐다 |
| verify | 같은 과제에서 새 테스트만 통과시키고 기존 테스트가 깨진 채 완료를 주장했다. 독립 검토자가 이를 잡아냈다 |

나머지 22개 skill에는 관찰된 실패가 없으므로 Gotchas를 만들지 않았다. P2와 P4 평가, 그리고 실사용 교정에서 채운다.

### 다시 확인한 결과 바꾸지 않은 것

| 항목 | 판단 |
| --- | --- |
| 참조되지 않는 파일 | 모든 skill 파일이 SKILL.md, `references.json`, `judgment.json` 중 하나에서 참조된다. `packages/learning/references/skill-boundaries.md`는 learning 패키지 검사가 링크를 확인하는 관리 문서다. 지울 파일이 없다 |
| "Parse, don't validate" 중복 | 4개 reference에 있는 것은 같은 출처를 각자의 질문(model, sketch, verify, convention)에 적용한 Source Trace다. 서로 모순되지 않는다. 하나로 합치는 일은 P3의 `sources/`에서 한다 |
| verify와 claim-evidence의 중복 | 두 skill이 겹치는 문제는 P3에서 `perspectives/evidence.md`로 합쳐 해소한다. P1에서는 description만 구분했다 |
| Status 블록, Core Question, Judgment Spine | skill 간 반환 형식이라 현재 구조에서는 유지한다. P3에서 새 템플릿으로 바꿀 때 뺀다 |
| 대문자 강조 금지 | 출처 사본에서 원문을 확인하지 못해 결정으로 기록하지 않았다 |

### 결정 기록

| 결정 | 근거 | 되돌리는 법 |
| --- | --- | --- |
| description은 3인칭 동사로 시작하고 `Use when`은 명령형으로 둔다 | 3인칭은 Claude 지침, 명령형은 Agent Skills 지침이다. 두 지침이 다루는 부분이 다르므로 둘 다 따른다 | 이 브랜치의 description 변경 커밋을 revert |
| root skill의 description을 큰따옴표 YAML로 통일한다 | 일괄 편집할 때 따옴표가 없는 스칼라에서 `: ` 같은 문자가 YAML을 깨뜨릴 위험을 없앤다. 의미는 같다 | 따옴표 제거 |
| 버전은 올리지 않는다 | 릴리스는 P5에서 한다. 테스트가 0.2.2를 고정하고 있다 | 해당 없음 |

## 7. P2·P3·P5 준비 결과

### 구조

| 항목 | 결과 |
| --- | --- |
| 패키지 | `hobin-review`(reviewing-code), `hobin-feature`(developing-features), `hobin-stances`(applying-stances, enforcing-conventions), `hobin-skill-eval`(evaluating-skills), `hobin-learning`(5개 유지). 모두 0.3.0 |
| 관점 | `sources/lenses/`의 contract, async-flow, structure, data-loss, evidence(각 52~56줄). `pnpm sync:sources`로 review의 `perspectives/`와 feature의 `lenses/`에 복사하고, `check:sources`가 드리프트를 막는다 |
| 설계 reference | feature의 `design-surface.md`(150줄), `condition-modeling.md`(100줄) |
| scripts·assets | `collect-context.sh`(리뷰 맥락), `acceptance-scenarios.json`(시나리오·결정 기록), `run-evals.mjs`(평가 실행기, 기본 dry run), stances 자산 3종 |
| Codex 호출 정책 | 진입점 3개(reviewing-code, developing-features, applying-stances)에 `allow_implicit_invocation: false`. enforcing-conventions와 evaluating-skills는 자동 호출 허용 |
| 보관 | 기존 developer 17개 skill과 Pi 어댑터, 루트 skill 4개와 `agents/` 조각을 `archive/`로 옮겼다(삭제 아님) |
| 마켓플레이스 | `hobin-agent` → `hobin` |
| 평가 데이터 | `evals/<skill>/`의 트리거 세트와 결과 과제, 합성 fixture(저장소가 공개라 실제 회사 코드는 쓰지 않음) |

### 증류에서 버린 reference

다음은 기능 개발과 리뷰에 쓰이지 않는 특수 주제여서 새 skill에 옮기지 않았고 `archive/`에만 남겼다:
proof-obligations, solver-result-boundaries, logic-query-semantics, planning-models(model),
language-semantics, runtime-and-compilation, closure-and-conventional-interfaces,
type-transitions(sketch), topology-resolution-routing의 동적 토폴로지 부분, visualize 전체.

### 결정 기록

| 결정 | 근거 | 되돌리는 법 |
| --- | --- | --- |
| Pi developer 어댑터 은퇴 | 새 skill은 `references.json`을 쓰지 않으므로 어댑터가 할 일이 없다. 새 패키지는 `pi.skills`만 선언해 Pi 기본 탐색을 쓴다 | `archive/developer-0.2.2/adapters/`를 패키지로 복원 |
| npm 패키지를 플러그인과 1:1로 분리 | 계획 §8의 권장안. 저장소 규칙 `@hobin/<name>` ↔ `hobin-<name>`을 그대로 유지한다 | 해당 없음(새 이름) |
| learning에는 `agents/openai.yaml`과 "명시 호출" 문구를 넣지 않음 | learning 패키지 검사가 처음(2026-07-19)부터 skill 안의 `agents/`를 금지하고 있고, 자동 선택이 도움이 되는지는 P4 트리거 평가로 판단해야 한다 | P4 이후 검사와 description 수정 |
| learning 본문 축소 보류 | 증거 없이 줄이면 품질이 떨어질 위험이 있다. P4 결과로 결정한다 | 해당 없음 |
| 설치 검사의 충돌 fixture를 `model`에서 `reviewing-code`로 변경 | 새 패키지에는 `model` skill이 없어서 기존 fixture로는 충돌을 시험할 수 없다 | 스크립트 한 줄 |

### P4 실행 전에 확인할 것

1. 실행기 격리: 실행기는 init 이벤트의 plugin 목록을 검사하고, 예상하지 않은 plugin이 있으면 중단한다. 사용자 전역 설치 플러그인(`hobin-developer` 0.2.2)이 `--setting-sources project`에서 실제로 빠지는지는 첫 smoke 실행으로 확인한다.
2. 비용: 결과 평가는 과제 수 × 조건 3 × 모델 2~3 × 3회다. 실행 전에 dry run 출력으로 실행 횟수를 보여 주고 상한을 승인받는다.

## 8. P4 1차 결과 (2026-10-30)

조건: 결과 평가는 Sonnet만, 조건(skill / skill 없음 / 길이를 맞춘 대조군)마다 3회.
트리거 평가는 Haiku·Sonnet·Opus, 질의 20개 × 3회. 표본이 작고 결과 평가는 모델 하나이므로
판정은 잠정적이다. 판정 규칙(§4)이 요구하는 "모델 2개 이상"은 아직 충족하지 못했다.

### 결과 평가 (assertion 통과 수: skill / 없음 / 대조군)

| skill | 결과 | 차이를 만든 assertion | 판정 |
| --- | --- | --- | --- |
| reviewing-code | 39/39 · 28/39 · 32/39 | 깨진 기존 테스트 보고 3/3 · 0/3 · 0/3, 전체 suite 실행 3/3 · 0/3 · 0/3 | keep |
| developing-features | 30/36 · 26/36 · 23/36 | 숨은 테스트는 같음(6/6 · 6/6 · 5/6). 독립 검증을 거의 건너뜀 → Gotcha 추가 후 검증 subagent 실행 1/6 → 6/6 | keep, 수정함 |
| applying-stances | 16/18 · 2/18 · 11/18 | 정확한 diff 제시 3/3 · 0/3 · 0/3, 중복 규칙 회피 3/3 · 0/3 · 1/3 | keep |
| enforcing-conventions | 18/24 · 14/24 · 15/24 | 지침의 산문 규칙을 검사 포인터로 교체 3/3 · 0/3 · 0/3. 두 assertion이 모든 조건에서 실패해 점검 필요 | keep (약함) |
| evaluating-skills | 15/21 · 19/21 · 21/21 | skill 조건이 비교 조건과 판정 규칙을 적지 않음 → 계획 기록 단계 추가 후 21/21 | 수정함. 대조군을 넘는다는 증거는 아직 없음 |
| patternize | 27/27 · 15/27 · 17/27 | 사례 표, 점검이 붙은 순서 있는 절차 3/3 · 0~1/3 · 0/3 | keep |
| conceptualize | 20/24 · 20/24 · 21/24 | 이득 없음 | 은퇴 후보 (삭제 보류) |

conceptualize와 patternize의 병합: 트리거에서 서로의 질의를 고른 사례가 0건이고, 결과도
patternize만 이득이 있다. 병합 근거가 없으므로 병합하지 않는다. conceptualize는 두 번째 모델
확인 후 은퇴 또는 재작성을 결정한다.

### 트리거 평가 (정답 질의 수 / 20)

| skill | Haiku | Sonnet | Opus |
| --- | --- | --- | --- |
| reviewing-code | 16 | 20 | 18 |
| developing-features | 17 | 19 | 20 |
| applying-stances | 20 | 20 | 20 |
| enforcing-conventions | 16 | 20 | 20 |
| evaluating-skills | 19 | 19 | 20 |
| conceptualize | 13 | 19 | 19 |
| patternize | 11 | 18 | 18 |

- Sonnet과 Opus에서는 오탐률이 0.07 이하다. Haiku는 learning skill에서 recall이 낮다(0.13~0.40).
- developing-features는 "구현하지 말고 인수 조건만 써 달라"는 near-miss에 Sonnet이 3/3으로 반응했다. description의 `Not for`에 이 범주를 추가한 뒤 1/3이 됐다.

### 평가 도구에서 발견해 고친 것

빈 workspace에서는 트리거 측정이 교란됐다 → 트리거 실행에는 Skill 도구만 준다.
채점기가 실행 기록을 보지 못하고, 부정형 assertion을 증거 부족으로 실패시켰다 → 명령과
subagent 기록을 채점기에 넘기고 판정 규칙을 명시했다.
실행 조건마다 도구가 달라 skill의 스크립트를 쓸 수 없었다 → 모든 조건에 같은 도구를 준다.

남은 한계: headless 실행에서 subagent의 shell 호출이 거부되어, 독립 검증자가 시나리오 명령을
실행하지 못한다. 평가 환경의 한계이며 skill 수정으로 해결할 문제가 아니다.

### 비용

총 약 $114. 트리거 평가가 약 $89로 대부분이다. 실행할 때마다 skill이 로드되고 Opus 실행이 비싸다.
결과 평가는 실행당 $0.1~0.4로 약 $24다.

### 다음

1. Opus 결과 평가: 판정이 경계에 있는 conceptualize, evaluating-skills, enforcing-conventions부터 돌린다.
2. enforcing-conventions에서 모든 조건이 실패하는 두 assertion을 점검한다.
3. conceptualize의 은퇴 또는 재작성을 결정한다.
