---
id: review
plugin: hobin-review
skill: reviewing-code
version: 0.3.0
---

# review — 코드 리뷰

이 문서가 review 역량의 인터페이스다. 호스트(Claude Code, Codex)를 알지 않는다. 각 호스트의
구현체는 `claude/`, `codex/` 아래에 있고, 이 명세가 바뀌면 `implementing-core` skill로
반영한다.

## 1. 목적과 범위

코드 변경이나 지정한 범위에서 사용자나 데이터에 해를 끼칠 결함을 찾고, 각 결함을 증명하고,
그 외에는 말하지 않는다.

- 대상: diff, 브랜치, PR의 **변경 리뷰**와, 이름을 댄 모듈·디렉터리·흐름·기능 단위의 **범위 진단**.
- 대상 아님: 스타일 지적, 자동 수정, 개발 환경 점검, 저장소 전체 재작성.

설명문(호스트가 skill 목록에 보여 줄 문장, 영어):

> Reviews a code change, or a bounded existing scope, for correctness defects and reports
> only verified, high-confidence findings with concrete failure scenarios. Use only when
> explicitly asked to review a diff, branch, or pull request, or to diagnose a named
> module or feature slice. Not for style feedback, automatic repair, environment setup
> checks, or whole-repository rewrites.

짧은 설명: Review a change for verified correctness defects
표시 이름: Hobin Review

## 2. 호출

- **사용자가 명시적으로 부를 때만** 동작한다. 모델이 스스로 고르지 않는다.
- 인자: 리뷰할 대상(브랜치, diff, PR, 범위). 없으면 현재 브랜치를 기준 브랜치와 비교한다.

## 3. 산출물

요청이 지정한 파일, 지정이 없으면 답변에 다음 형식으로 쓴다.

```text
[P0|P1] <한 줄 결함 설명> — <file>:<line>
  Scenario: <입력이나 상태> → <잘못된 결과>
  Evidence: <그것을 보여 주는 테스트, 명령 출력, 코드 추적>
  Direction: <수정이 지켜야 할 것. 전체 패치가 아님>

Checked without findings: <관점들>
Not checked: <리뷰가 관찰할 수 없었던 것>
```

- P0: 데이터 손실, 보안 노출, 주 경로의 crash. P1: 현실적인 경로의 잘못된 동작.
  P2 이하는 요청할 때만.
- 결함이 없으면 `No findings`가 정상 결과다.
- 범위 진단에서는 끝에 지금 / 다음 / 나중 / 그대로 둠 순서의 계획과 이유를 붙인다.

## 4. 보장 (관찰 가능한 결과만)

| ID | 보장 | 수준 |
| --- | --- | --- |
| G1 | 사용자가 명시적으로 부를 때만 시작한다 | 필수 |
| G2 | 리뷰는 대상 코드를 바꾸지 않는다. 쓰는 것은 보고서뿐이다 | 필수 |
| G3 | 결함은 3절 형식을 따르고, 각각 구체적인 실패 시나리오를 단다 | 필수 |

각 구현체는 보장마다 호스트가 **강제**하는지, skill이 **지시**만 하는지, **지원하지 않는지**를
자기 `HOST.md`에 밝힌다.

## 5. 절차

### 함정 (관찰된 실패)

- 프로젝트 지침(`AGENTS.md`, `CLAUDE.md`, 기여 안내)은 팀의 결정을 담고, 이 문서의 어떤 일반
  관점보다 우선한다. 기록된 결정과 어긋나는 지적은 틀린 것이다.
- 변경이 추가한 테스트가 통과해도, 변경이 깨뜨린 기존 테스트에 대해서는 아무것도 말해 주지
  않는다. 안전하다고 말하기 전에 바뀐 코드 주변의 기존 테스트를 실행한다.
- 한 분기·필드·호출자에 대한 변경은 diff가 건드리지 않은 형제에도 반복되는 경우가 많다.
- 심각한 것을 못 찾으면 스타일과 이름 지적으로 흐르기 쉽다. `No findings`도 정상 결과다.
- 관점별 리뷰어의 후보는 검증 전에는 결함이 아니다. 리뷰어는 새로 추가된 무해한 메서드나
  상수도 결함으로 올리곤 하므로, 5단계에서 구체적 시나리오로 재현되지 않으면 버린다.

### 단계

1. **모드 정하기.** 변경 리뷰인지 범위 진단인지. 대상이 불분명하면 현재 브랜치를 기준과 비교.
2. **맥락 모으기.** 변경 리뷰는 `scripts/collect-context.sh [base]`를 저장소 루트에서 실행한다
   (범위, 바뀐 파일, 주변 테스트, 프로젝트 지침 파일, diff를 출력. git만 사용, 읽기 전용).
   요청이 diff 파일을 주면 그것을 쓴다. 범위 진단은 진입점, 테스트, 지침 파일을 직접 찾는다.
   지침 파일을 읽는다.
3. **관점 고르기.** 7절의 관점 가운데 이 변경에 해당하는 것을 고르고, 건너뛴 것과 이유를 밝힌다.
4. **관점별 리뷰.** 고른 관점마다 그 관점 지식의 "After building, find" 질문을 적용한다.
   변경이 크거나 여러 관점에 걸치면 관점별 독립 리뷰어에게 맡긴다(6절, 권장 전략).
5. **후보 검증.** 테스트, 명령, 코드 추적으로 재현한다. 입력이나 상태가 잘못된 결과로 이어지는
   구체적인 시나리오로 만들 수 없는 후보는 버린다. 중복은 합친다.
6. **순위 매기기.** P0, P1만 남긴다(요청 시 P2 이하).
7. **보고.** 3절 형식으로.

## 6. 권장 전략: 관점별 독립 리뷰어

보장이 아니라 전략이다. 쓸지는 구현체와 실행이 정한다.

- 리뷰어 하나는 관점 하나만 맡고, 그 관점 지식, 아래 역할, 리뷰 대상, 2단계의 맥락만 받는다.
  대화 내용은 필요 없다.
- 리뷰어 역할:
  - 주어진 맥락, 저장소, 관점 지식만 쓴다. 파일을 고치거나 만들거나 지우지 않는다.
  - 관점의 "After building, find" 질문 가운데 해당하는 것을 다룬다. 질문이 가리키는 코드를
    직접 읽는다. diff만 보고 답하지 않는다.
  - 후보만 돌려준다: `[P0|P1] <결함> — <file>:<line>`, `Scenario:`, `Evidence:`.
  - 구체적인 시나리오가 있는 후보만 낸다. 없으면 `No findings`와 확인한 질문들을 돌려준다.
- 가능하면 병렬로 돌린다.

## 7. 지식

| 관점 | 파일 | 다루는 것 |
| --- | --- | --- |
| contract | `knowledge/contract.md` | 요구사항, 부재·기본값 의미, 불변식, 소유자 결정, 경계 파싱 |
| async-flow | `knowledge/async-flow.md` | 작업, 큐, 콜백, 재시도, 응답 확인, 취소, 오래된 상태 |
| structure | `knowledge/structure.md` | 책임과 경계 배치, 추상화, 변이 메커니즘, 이름, 동작 변경이 섞인 리팩터 |
| data-loss | `knowledge/data-loss.md` | 변환, 마이그레이션, 정규화, 직렬화, 저장된 데이터 삭제 |
| evidence | `knowledge/evidence.md` | 테스트와 검사가 변경의 주장을 실제로 관찰하는지 |

지식 파일과 `scripts/`는 구현체에 그대로 복사된다(내용 동일).

## 8. 수용 시나리오

각 시나리오는 `scenarios/<id>/`에 있다: `base/`(변경 전 상태), `change.patch`(변경),
`golden/`(정답 예시), `scenario.yaml`(요청과 판정 기준). 판정 기준은 결정적이다(파일 존재,
정규식 일치·불일치, 다른 파일 미변경, 명령 실행). 각 구현체는 자기 호스트의 공식 평가기로
모든 시나리오를 같은 ID로 돌린다.

| ID | 상황 | 잡아야 할 것 | 잡으면 안 되는 것 |
| --- | --- | --- | --- |
| queue-worker-ack | 처리 전에 작업을 확인 응답하고, 재시도마다 새 멱등 키를 만드는 변경 | 조기 응답 확인으로 작업 유실, 재시도 시 이중 적립 | 새 `pendingCount()` |
| settings-migration-envelope | 저장된 템플릿의 footer를 지우는 마이그레이션, 봉투 없는 응답을 빈 결과로 받는 파서 | 저장된 footer 삭제, 빈 응답이 전체 삭제로 이어짐 | `PLACEHOLDER` 상수 이동 |
| format-refactor-sibling | 서식 리팩터와 동작 변경이 섞여 기존 테스트가 깨진 변경 | 깨진 기존 테스트(테스트를 실제로 실행), 테스트 없는 형제 `formatSigned`, CSV 열 깨짐 | 구조 분해로 바꾼 콜백 |
