---
id: developing-features
plugin: hobin-feature
skill: developing-features
version: 0.3.0
---

# developing-features — 기능 개발

이 문서가 developing-features 역량의 인터페이스다. 호스트를 알지 않는다. 각 호스트의
구현체는 `claude/`, `codex/` 아래에 있고, 이 명세가 바뀌면 `implementing-core` skill로
반영한다.

## 1. 목적과 범위

요청을 먼저 실행 가능한 수용 시나리오와 소유자 결정으로 바꾸고, 시나리오마다 통과할 때까지
작은 단위로 구현하고 검증한다.

- 대상: 범위, 조건, 설계 가운데 하나라도 정해지지 않은 기능 추가나 동작 변경, 그런 수정.
- 대상 아님: 한 줄 수정, 동작이 바뀌지 않는 리팩터, 다른 사람의 변경 리뷰, 구현 없이 티켓이나
  수용 기준만 쓰는 일.

설명문(호스트가 skill 목록에 보여 줄 문장, 영어):

> Develops a feature or behavior change through checkpoints: write acceptance scenarios
> and owner decisions, model combining conditions, design the surface, implement in small
> verified slices, and verify every scenario with an independent reviewer. Use only when
> explicitly asked to build a non-trivial feature or fix where scope, conditions, or design
> are unsettled. Not for one-line fixes, pure refactors, reviewing someone else's change,
> or writing a ticket or acceptance criteria without implementing.

짧은 설명: Build a feature through verified acceptance scenarios
표시 이름: Hobin Feature

## 2. 호출

- **사용자가 명시적으로 부를 때만** 동작한다. 모델이 스스로 고르지 않는다. 그래서
  `triggers.yaml`이 없다.
- 인자: 만들 기능이나 고칠 동작에 대한 요청(요구사항 문서 경로를 포함할 수 있다).

## 3. 산출물

1. **코드 변경.** 요청한 기능과, 시나리오를 확인하는 테스트.
2. **시나리오 파일.** `assets/acceptance-scenarios.json`을 작업 트리(기능 옆이나 프로젝트의
   계획 폴더)에 `acceptance-scenarios*.json` 이름으로 복사해 채운다.
   - `scenarios[]`: `id`, `given`(저장된 데이터를 포함한 이전 상태), `when`, `then`(관찰 가능한
     결과), `check`(그 결과가 성립할 때만 통과하는 명령), `status`(`pending | pass | fail`).
   - `decisions[]`: `id`, `question`, `owner`, `decision`, `reason`, `revert`.
   - `verification`: `existing_tests`(변경 주변 기존 테스트 명령), `rounds[]`.
3. **보고.** 요청이 지정한 파일, 지정이 없으면 답변에 다음을 쓴다.

```text
Scenarios:        <id> <then 요약> — <check 명령> — pass | fail | not run
Owner decisions:  <id> <질문> → <결정>. Reason: <이유>. Revert: <되돌리는 법>
Checks run:       <명령> — <결과>
Not verified:     <관찰하지 못한 것>
```

4. **제어 모델 결정 기록 (해당할 때).** 사용자나 시스템이 할 수 있는 행동이 모드에 따라 달라지면
   (외부 작업과 폴링, 재시도·재확인·취소, 늦게 도착하는 결과, 함께 행동을 막는 여러 플래그)
   `assets/control-decisions.json`을 작업 트리에 `control-decisions*.json` 이름으로 복사해 채운다.
   - `facts[]`: 코드 사실마다 `code`, `evidence`(`파일:줄`), `quote`(그 줄의 글자 그대로), 닫힌 답
     `answer`(`variable | input | event | excluded | outside`). 입력은 `from`에 묶은 조건과 근거를 적는다.
   - `variables`, `inputs`, `initial`, 이벤트마다 코드가 하는 일을 옮긴 `rules`.
   - `findings[]`: 게이트가 계산한 발견마다 `id`와 `note`.
   상태와 전이는 적지 않는다. `scripts/compile-control-model.mjs`가 기록에서 계산한다.

**기록은 스크립트로.** 시나리오 결과는 손으로 적지 않는다. `scripts/scenarios.mjs run`이 각 시나리오의
명령과 기존 테스트를 실행해 기록하고, `scripts/scenarios.mjs check`가 통과해야 완료다.

## 4. 보장 (관찰 가능한 결과만)

| ID | 보장 | 수준 |
| --- | --- | --- |
| G1 | 사용자가 명시적으로 부를 때만 시작한다 | 필수 |
| G2 | 작업 트리에 3절 형식의 시나리오 파일이 남고, 시나리오마다 확인 명령이 있다 | 필수 |
| G3 | 요청·코드·문서가 정하지 않은 결정은 모두 결정, 이유, 되돌리는 법과 함께 보고에 기록된다 | 필수 |
| G4 | 소유자에게 물을 수 없을 때의 결정은 보수적이고 되돌릴 수 있다: 저장된 데이터를 보존하고, 모호하거나 잘못된 입력은 유효한 값으로 받지 않고 거부하며, 되돌릴 수 없는 단계 직전에 상태를 다시 확인한다 | 필수 |
| G5 | 완료를 보고할 때 모든 시나리오 명령과 변경 주변의 기존 테스트가 통과한 상태이고, 보고는 그 마지막 결과와 검증하지 못한 것을 밝힌다 | 필수 |
| G6 | 시나리오 기록의 결과는 `scripts/scenarios.mjs run`이 실제로 실행해 적고, `check`를 통과한다(빈칸·자리 표시자 없음, 모든 시나리오와 기존 테스트 통과, 결정마다 되돌리는 법) | 필수 |
| G7 | 작업 트리에 제어 모델 결정 기록이 있으면 `scripts/compile-control-model.mjs --gate`를 통과한다: 모든 사실의 근거가 실재하고 인용이 그 줄에 있으며, 기록이 컴파일되고, 계산된 발견을 모두 `id`로 확인했다 | 필수 |

각 구현체는 보장마다 호스트가 **강제**하는지, skill이 **지시**만 하는지, **지원하지 않는지**를
자기 `IMPLEMENTS.json`에 밝힌다.

## 5. 절차

### 함정 (관찰된 실패)

- 새 동작에 대한 요청은 이전 동작으로 이미 저장된 데이터를 어떻게 할지 대개 열어 둔다.
  유지, 마이그레이션, 삭제는 소유자 결정이다. 기존 파서가 이미 필드를 버리고 있으면 TODO만
  채운 구현도 저장된 데이터를 조용히 잃는다.
- 외부 시스템이 준 입력이 없음, 비어 있음, 형식이 틀림은 서로 다른 상태다. 이를 빈 유효
  결과로 받는 것은 단순화가 아니라 결함이다.
- 느리거나 외부를 거치는 단계 전에 읽은 상태는 되돌릴 수 없는 단계가 실행될 때쯤 낡아 있을
  수 있다. 되돌릴 수 없는 단계 바로 앞에서 다시 확인한다. 그 단계 뒤에 하는 버전 확인은 확인이
  아니다.
- 새 테스트 통과는 완료가 아니다. 변경 주변의 기존 테스트도 통과해야 하고, 모든 시나리오는
  쓰기만 한 것이 아니라 실행되어야 한다.
- 독립 검증(6단계)은 가장 자주 건너뛰는 단계이고, 이유는 대개 "내 테스트가 통과한다"이다.
  자기 테스트는 구현과 같은 사각지대를 공유한다.
- 프로젝트 지침(`AGENTS.md`, `CLAUDE.md`, 기여 안내)은 팀의 결정을 담고, 아래 기본값보다
  우선한다.

### 단계

1. **시나리오.** `assets/acceptance-scenarios.json`을 작업 트리에 복사하고 채운다. 관찰 가능한
   동작마다 시나리오 하나. 해당하면 없음, 비어 있음, 잘못됨, 중복, 동시 실행 경우를 넣는다.
   시나리오마다 확인 명령을 단다.
2. **소유자 결정.** 요청, 코드, 문서가 정하지 않은 결정을 모두 적는다. 사용자가 있으면 가장 작은
   질문을 한다. 없으면 보수적이고 되돌릴 수 있는 기본값(데이터 보존, 모호한 입력 거부, 변경
   축소)을 택하고 결정, 이유, 되돌리는 법을 시나리오 파일에 적는다.
3. **조건 모델링.** 여러 조건이 결합하거나 순서가 중요하면 `knowledge/condition-modeling.md`를
   읽고, 표의 행에서 시나리오를 더 끌어낸다. 할 수 있는 행동이 모드에 따라 달라지면
   `knowledge/control-model.md`를 읽고 제어 모델 결정 기록(3절 4)을 쓴 뒤
   `scripts/compile-control-model.mjs --gate`가 통과할 때까지 고친다. 게이트가 알린 발견은 코드의 사실이므로
   숨기지 않고 확인하며, 소유자 결정이 필요한 것은 2단계 결정에 올린다.
4. **설계.** 소유권, 경계, 데이터 모양, 변이가 정해지지 않았으면 `knowledge/design-surface.md`를
   읽고 코드보다 먼저 표면을 쓴다. 위험한 부분은 7절의 관점 가운데 해당하는 것을 읽고 미리 정한다.
5. **단위별 구현.** 각 단위는 시나리오 하나나 몇 개를 끝까지 통과시킨다. 다음 단위 전에 그
   단위의 시나리오 명령과 변경 주변 기존 테스트를 실행한다. 동작 변경과 구조 정리는 다른 단위로
   나눈다.
6. **독립 검증.** 시나리오 파일, diff, 프로젝트 지침만 가지고 모든 시나리오 명령을 다시 실행하고
   반드시 고칠 것만 찾는다: 실패한 시나리오, 깨진 기존 테스트, 명시된 요구사항에 대한 시나리오
   누락, 보수적이지 않은 소유자 결정. 고치고 반복한다. 최대 3회, 남은 것은 보고한다(6절, 권장
   전략).
7. **보고.** 3절 형식으로. 시나리오 파일의 `status`와 `verification.rounds`도 마지막 결과로 맞춘다.

## 6. 권장 전략: 독립 검증자

보장이 아니라 전략이다. 쓸지는 구현체와 실행이 정한다. 보장(G5)은 검증자를 썼는지가 아니라
완료 시점에 시나리오와 기존 테스트가 통과했는지다.

- 6단계를 구현에 쓴 대화 맥락이 없는 새 검증자에게 맡긴다. 검증자는 시나리오 파일, diff,
  프로젝트 지침만 받는다.
- 검증자 역할:
  - 모든 시나리오 명령과 `verification.existing_tests`를 실행한다. 코드를 고치지 않는다.
  - 반드시 고칠 항목만 돌려준다: 실패한 시나리오, 깨진 기존 테스트, 요구사항에 대응하는
    시나리오 누락, 보수적이지 않은 결정. 각 항목에 근거(명령 출력이나 요구사항 문장)를 단다.
  - 없으면 `No must-fix items`와 실행한 명령을 돌려준다.
- 새 검증자를 쓸 수 없으면 같은 입력만 다시 읽는 새 검토 단계로 대신하고, 보고에 그렇게 밝힌다.

## 7. 지식

| 파일 | 언제 읽나 |
| --- | --- |
| `knowledge/condition-modeling.md` | 여러 조건이 결합하거나, 부재·기본값이 중요하거나, 순서·시간이 중요할 때 |
| `knowledge/control-model.md` | 할 수 있는 행동이 모드, 외부 작업, 늦게 오는 결과에 따라 달라질 때: 무엇을 상태머신에 넣을지와 결정 기록 쓰는 법 |
| `knowledge/control-model-format.md` | 결정 기록을 채우거나 스크립트 출력을 읽을 때 |
| `knowledge/design-surface.md` | 데이터 모양, 소유권, 인터페이스, 변이 메커니즘이 아직 정해지지 않았을 때 |

관점(변경에 해당하는 것만 읽는다):

| 관점 | 파일 | 다루는 것 |
| --- | --- | --- |
| contract | `../shared/lenses/contract.md` | 요구사항, 부재·기본값 의미, 불변식 |
| async-flow | `../shared/lenses/async-flow.md` | 작업, 큐, 재시도, 외부 호출 |
| structure | `../shared/lenses/structure.md` | 경계와 추상화 |
| data-loss | `../shared/lenses/data-loss.md` | 변환과 저장된 데이터 |
| evidence | `../shared/lenses/evidence.md` | 검사가 실제로 무엇을 증명하는지 |

자산:
- `assets/acceptance-scenarios.json` — 복사해 채우는 시나리오·결정 기록(3절 2).
- `assets/control-decisions.json` — 복사해 채우는 제어 모델 결정 기록(3절 4).

스크립트:
- `scripts/scenarios.mjs` — 시나리오 기록을 실행해 적고(`run`) 완결을 검사한다(`check`).
- `scripts/compile-control-model.mjs` — 결정 기록을 상태머신 정의로 컴파일하고, `--gate`로 통과/실패를 판정한다.
- `scripts/check-control-model.mjs` — 상태머신 정의를 검사하고, 정규형(`--canonical`), 비교(`--compare`),
  테스트 시나리오 도출(`--scenarios`)을 낸다. 컴파일러가 함께 쓴다.

관점 지식은 다른 역량과 함께 쓰는 `core/shared/lenses/`에 있다. 지식 파일, 자산, 스크립트는
구현체에 그대로 복사된다(내용 동일).

## 8. 수용 시나리오

각 시나리오는 `scenarios/<id>/`에 있다: `base/`(요청 전 상태), `hidden/`(실행이 끝난 뒤에만
추가되는 테스트), `golden/`(참조 구현, 시나리오 파일, `REPORT.md`),
`scenario.yaml`(요청과 판정 기준). 판정 기준은 결정적이다(숨은 테스트와 기존 테스트의 종료
코드, 파일 존재, 정규식 일치, 명령 실행). 실행이 어떤 도구나 검증자를 썼는지는 판정하지 않는다.
각 구현체는 자기 호스트의 공식 평가기로 모든 시나리오를 같은 ID로 돌린다.

| ID | 상황 | 통과해야 할 것 | 흔한 실패 |
| --- | --- | --- | --- |
| quiet-hours-preferences | v1 기록이 남아 있는 알림 설정에 방해 금지 시간 추가, 미결 질문 3개 | 저장된 v1 필드 보존, `start === end` 거부, 엄격한 24시간 `HH:MM`만 허용, 결정과 되돌리는 법 기록, 테스트 통과 저장 | TODO만 채워 손실 파서를 그대로 둠, `start === end`를 종일로 해석 |
| job-lookup-cancel | 서버 job으로 도는 조회 패널에 취소 추가, 미결 질문 3개 | 취소 뒤 결과를 모름으로 유지해 같은 대상 재조회 차단, 늦은 결과 무시, 재확인 취소 뒤에도 재확인 가능, 결정과 되돌리는 법 기록, 제어 모델 결정 기록이 게이트 통과, 테스트 통과 저장 | 취소를 실패로 처리해 중복 job 허용, 늦은 결과를 받아들임, 발견을 확인하지 않음 |
| refund-approval-revalidate | 몇 분 묵은 스냅숏으로 환불 승인, 미결 질문 4개 | 환불 직전 재확인, 초과 환불·소수 센트 거부, 더블 클릭에도 환불 한 번, 결정과 되돌리는 법 기록, 테스트 통과 저장 | 돈이 나간 뒤에 버전 확인, 주문 갱신만 추가하고 멈춤 |
