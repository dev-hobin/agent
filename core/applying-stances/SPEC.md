---
id: applying-stances
plugin: hobin-stances
skill: applying-stances
version: 0.7.0
---

# applying-stances — 엔지니어링 입장 반영

이 문서가 applying-stances 역량의 인터페이스다. 호스트(Claude Code, Codex)를 알지 않는다.
각 호스트의 구현체는 `claude/`, `codex/` 아래에 있고, 이 명세가 바뀌면 `implementing-core`
skill로 반영한다.

## 1. 목적과 범위

몇 가지 기본 행동 방식을 모든 세션이 읽는 지침 파일에 넣는다. 프로젝트가 이미 말한 것을
중복하거나 거스르지 않고, 정확한 diff를 보여 승인을 받은 뒤에만 쓴다.

- 대상: 프로젝트나 사용자의 에이전트 지침(`CLAUDE.md`, `AGENTS.md`)에 `assets/stances.md`의
  입장 블록을 설치하거나 갱신하는 일, 각 입장을 이미 있는 검사와 연결하는 일.
- 대상 아님: 일반 프로젝트 문서 작성, 코드에서 관례를 강제하는 일(그것은 `enforcing-conventions`).

설명문(호스트가 skill 목록에 보여 줄 문장, 영어):

> Installs a short set of engineering stances into a project's or user's agent
> instructions (CLAUDE.md or AGENTS.md) after showing the exact diff and getting approval,
> and links each stance to an existing check where one exists. Use when asked to set up,
> add, or update these stances, or default working stances, in agent instructions. Not for
> writing general project documentation, editing other parts of agent instructions, or
> enforcing a convention in code.

짧은 설명: Install engineering stances into agent instructions
표시 이름: Applying Stances

## 2. 호출

- **모델이 스스로 고를 수 있다.** 사용자가 명시적으로 불러도 된다. 골라야 할 요청과 고르면 안 되는
  요청은 `triggers.yaml`에 있다. 승인 전에는 아무것도 쓰지 않으므로(G2) 스스로 골라도 지침
  파일이 몰래 바뀌지 않는다.
- 인자: 없음. 범위는 기본이 프로젝트이고, 사용자가 요청할 때만 사용자 범위
  (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`)를 쓴다.

## 3. 산출물

먼저 **제안**을, 요청이 지정한 파일이 있으면 그 파일에, 없으면 답변에 쓴다.

```text
Target: <쓸 파일>와 그 파일을 고른 이유(호스트가 읽는지, import가 필요한지)
<정확한 diff>
Size after the change: <대상 파일과 함께 읽히는 파일의 크기>
Skipped as duplicates: <입장들과 이미 같은 말을 하는 프로젝트 규칙>
Conflicts: <입장들과 다른 말을 하는 프로젝트 규칙>
Without a check: <연결할 검사가 없는 입장들(enforcing-conventions 후보)>
<승인 요청>
```

승인을 받은 뒤에만 대상 파일을 쓰고, 바꾼 파일, 중복이나 충돌로 건너뛴 입장, 검사가 없는
입장을 보고한다.

- 설치 블록은 `<!-- hobin-stances:v1 -->`와 `<!-- /hobin-stances -->` 사이에 있다.
- 검사가 있는 입장은 줄 끝에 `(checked by <경로 또는 명령>)`을 붙인다.

**블록은 스크립트로.** 블록의 정확한 텍스트와 diff는 `scripts/stances.mjs block <대상> [--skip 번호] [--learning]`이
만든다. 어떤 입장을 뺄지(중복·충돌)는 판단이고, 텍스트는 손으로 쓰지 않는다. 쓴 뒤에는
`scripts/stances.mjs check <파일>`이 통과해야 한다. `block`은 파일을 쓰지 않으므로(승인받을 diff를 출력할 뿐)
등록하지 않는다. 대상은 승인 뒤에만 바뀌고, 그때 5단계가 검사한다.

**작업 등록부.** 실행 환경은 에이전트 작업(세션)이 시작한 디렉터리에 그 작업의 등록부
`.hobin-stances/sessions/<세션 ID>.jsonl`을 만든다(`.hobin-stances/.gitignore`는 `*`). 등록부 코드는 다른 역량과 함께 쓰는
`../shared/scripts/session-registry.mjs`다.
- `scripts/stances.mjs check <파일>`(제안 파일과, 승인 뒤 쓴 대상)는 실행 환경이 셸 명령에 넘기는 에이전트 세션 ID로 작업 디렉터리와 그 위에서 등록부를 찾아
  검사한 파일의 절대 경로를 한 줄 덧붙인다.
- 세션 ID가 있는데 등록부가 없거나 쓸 수 없으면 아무것도 쓰거나 검사하지 않고 종료 코드 2로 멈추며, 시작
  디렉터리에서 다시 실행하라고, 실행 환경의 hook이 돌지 않는 곳이면 `--no-gate`를 주라고 알린다. 등록부를 찾았는데
  `--no-gate`를 주면 거절한다(종료 코드 2). 세션 ID가 없으면(사람이 터미널에서 실행) 등록하지 않고 진행한다.
  절차 문서는 `--no-gate`를 말하지 않는다. 멈춤 메시지만 알린다.
- 이 작업이 편집 도구로 쓴 검사한 파일도 실행 환경이 등록부에 덧붙인다.
- 실행 환경의 관문은 등록부에 있는 파일을 모두 검사하고, 사라진 파일은 사라졌다고 알린다. 디렉터리를 뒤지지
  않고, 셸 텍스트, 명령 출력, 파일 시각, 대화 기록에서 추론하지 않는다. 작업이 끝나면 그 등록부를 지우고, 7일이
  지난 등록부는 정리한다.

## 4. 보장 (관찰 가능한 결과만)

| ID | 보장 | 수준 |
| --- | --- | --- |
| G2 | 승인 전에는 지침 파일을 포함해 어떤 파일도 바꾸지 않는다. 쓰는 것은 요청이 지정한 제안 파일뿐이다 | 필수 |
| G3 | 제안은 대상 파일, 정확한 diff, 변경 후 크기를 보이고 승인을 요청한다 | 필수 |
| G4 | 프로젝트가 이미 같은 말을 하는 입장은 다시 넣지 않고, 다른 말을 하는 입장은 넣지 않고 충돌로 보고한다 | 필수 |
| G5 | 대상은 호스트가 실제로 읽는 파일이다. `CLAUDE.md`가 `AGENTS.md`를 import하지 않는데 `AGENTS.md`에 쓰면 `@AGENTS.md` 추가도 함께 제안한다 | 필수 |
| G6 | 블록이 이미 있으면 그 자리에서 바꾸고, 지침 파일에 블록이 두 개 생기지 않는다 | 필수 |
| G7 | `(checked by …)`는 프로젝트에 실제로 있는 검사에만 붙는다 | 필수 |
| G8 | 제안과 기록한 블록은 `scripts/stances.mjs check`를 통과한다(블록 하나, 15줄 이하, 자산에 있는 입장만, 반복 없음) | 필수 |

각 구현체는 보장마다 호스트가 **강제**하는지, skill이 **지시**만 하는지, **지원하지 않는지**를
자기 `IMPLEMENTS.json`에 밝힌다.

## 5. 절차

### 함정 (관찰된 실패)

- Claude Code는 작업 디렉터리나 그 위에 `CLAUDE.md`나 `CLAUDE.local.md`가 없을 때만
  `AGENTS.md`를 읽는다. `CLAUDE.md`가 `@AGENTS.md`로 import하면 예외다. 호스트가 읽지 않는
  파일에 쓰면 아무것도 바뀌지 않는다.
- Codex는 기본으로 프로젝트 지침을 32 KiB까지만 읽는다(`project_doc_max_bytes`). 줄을 넣기 전에
  합친 크기를 확인한다.
- 같은 규칙을 두 번 쓰거나 프로젝트 규칙과 어긋나는 입장을 넣으면 행동이 더 예측하기 어려워진다.
  프로젝트 자신의 규칙이 언제나 이긴다.
- 승인 없이 지침을 쓰지 않는다. 지침은 이후의 모든 세션을 바꾼다.

### 단계

1. **대상 고르기.** 기본은 프로젝트 범위. 사용자 범위(`~/.claude/CLAUDE.md`,
   `~/.codex/AGENTS.md`)는 사용자가 요청할 때만. 프로젝트에서는:
   - `AGENTS.md`가 있고 Claude가 그것을 읽는다(`CLAUDE.md`가 없거나, `CLAUDE.md`가 import한다)
     → `AGENTS.md`에 쓴다.
   - `AGENTS.md`가 있지만 `CLAUDE.md`가 import하지 않는다 → `AGENTS.md`에 쓰고 `CLAUDE.md`에
     `@AGENTS.md`를 추가하자고 제안한다.
   - `CLAUDE.md`만 있다 → `CLAUDE.md`에 쓴다.
   - 둘 다 없다 → `AGENTS.md`를 만든다.
2. **비교하기.** 대상과 그것이 import하는 모든 파일을 읽는다. `assets/stances.md`의 각 줄에
   대해: 프로젝트가 이미 같은 말을 하면 뺀다. 프로젝트가 다른 말을 하면 빼고 충돌을 보고한다.
   그 밖에는 남긴다. 프로젝트가 학습 목표를 밝힌 경우에만 `assets/learning-stance.md`를 더한다.
3. **검사 연결하기.** 남긴 입장마다 `assets/enforcement-map.md`에 있는 검사가 프로젝트에 있는지
   찾고, 있으면 `(checked by <경로 또는 명령>)`을 붙인다. 검사가 없는 입장은 enforcing
   conventions 후보로 나열한다.
4. **diff 보이기.** `<!-- hobin-stances:v1 -->` 블록이 있으면 그 자리에서 바꾸고, 없으면 블록을
   덧붙인다. 정확한 diff와 변경 후 크기를 보이고 승인을 기다린다. 비대화형 실행에서는 여기서
   멈춘다.
5. **쓰고 보고하기.** 승인 뒤 대상을 쓰고 `scripts/stances.mjs check <대상>`을 실행한다. 바꾼 파일, 중복이나 충돌로 건너뛴 입장, 검사가 없는 입장을 보고한다.

## 6. 권장 전략

없음. 한 실행에서 위임 없이 끝낸다.

## 7. 지식

지식 파일은 없다. `assets/`, `scripts/`, `../shared/scripts/session-registry.mjs`는 구현체에 그대로 복사된다(내용 동일).

| 파일 | 쓰임 | 언제 |
| --- | --- | --- |
| `assets/stances.md` | 설치할 블록(15줄 이내), 마커 포함 | 2·4단계 |
| `assets/learning-stance.md` | 학습 지향 프로젝트용 선택 한 줄 | 2단계, 프로젝트가 학습 목표를 밝힐 때만 |
| `assets/enforcement-map.md` | 입장마다 검사할 수 있는 곳 | 3단계 |

## 8. 수용 시나리오

각 시나리오는 `scenarios/<id>/`에 있다: `base/`(실행 전 상태), `golden/`(정답 예시),
`scenario.yaml`(요청과 판정 기준). 판정 기준은 결정적이다(파일 존재, 정규식 일치·불일치,
다른 파일 미변경). 각 구현체는 자기 호스트의 공식 평가기로 모든 시나리오를 같은 ID로 돌린다.

| ID | 상황 | 해야 할 것 | 하면 안 되는 것 |
| --- | --- | --- | --- |
| agents-md-overlap | `CLAUDE.md`가 `@AGENTS.md`를 import하고, `AGENTS.md`가 이미 완료 전 `npm test`·`npm run lint` 실행을 요구하는 프로젝트. 제안을 `PROPOSAL.md`에 쓰라는 요청 | `AGENTS.md`를 대상으로, diff를 보이고, 승인을 요청 | 검증 입장을 diff에 다시 넣기, `PROPOSAL.md` 밖의 파일 변경 |
