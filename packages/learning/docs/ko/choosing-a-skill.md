# 어떤 Learning Skill을 골라야 하나요?

[English](../choosing-a-skill.md) | 한국어

Skill은 입력 형식보다 **원하는 결과**로 고릅니다. 같은 repository를 보더라도
구현 원리를 배우려는지, 개념을 만들려는지, 연습하려는지에 따라 다른 Skill을
씁니다.

## 빠른 선택

| 지금 필요한 것 | Skill | 끝났을 때 남는 것 |
| --- | --- | --- |
| 원문이 실제로 무엇을 말하는지 이해 | `technical-reading` | 원문의 순서, 예시, 예외를 보존한 설명 |
| 공개 저장소에서 기능 하나의 실제 동작을 학습 | `opensource-reading` | Docs, tests, code 위치가 붙은 근거 기반 설명 |
| 여러 학습 결과에서 오래 쓸 생각 하나를 분리 | `conceptualize` | 경계와 반례로 시험한 개념 |
| 여러 사례에서 반복되는 판단 순서를 정리 | `patternize` | 언제 쓰고 어떻게 실행하며 어디서 멈추는지 적힌 routine |
| 이해를 실제 수행으로 확인 | `exercise` | 예측, 진단, 수정, transfer 과제와 mastery 기준 |

## Technical reading과 conceptualize

다음 요청은 원문 이해가 목적입니다.

```text
이 chapter가 무슨 말을 하는지 예시를 빼지 말고 설명해 줘.
```

`technical-reading`은 원문의 논리 순서, 표현, 예외에 계속 책임을 집니다.

다음 요청은 원문 밖에서도 쓸 생각을 만드는 것이 목적입니다.

```text
이 세 chapter에서 공통으로 보이는 information-preserving boundary를 하나의
개념으로 이름 붙이고, 책과 무관한 사례에서도 성립하는지 시험해 줘.
```

이때는 `conceptualize`를 씁니다. 출처 이력은 근거로 남지만 개념의 정의 자체가
책 문장에 매달리면 안 됩니다.

## Open-source reading과 일반 코드 조사

파일 위치를 찾거나 bug를 고치는 것이 목적이면 일반적인 repository 조사로
충분합니다.

`opensource-reading`은 다음처럼 **학습 결과**가 필요할 때 씁니다.

```text
이 저장소의 retry API가 문서, public entry point, test, 내부 구현을 지나 어떻게
동작하는지 알려 줘. 보장 하나와 그 보장을 깨는 반례 하나도 찾아 줘.
```

결과에는 실제 파일과 symbol 근거가 있어야 합니다. 몇 파일을 본 뒤 그럴듯한 전체
architecture 이야기를 만드는 작업이 아닙니다.

## Concept과 pattern

Concept은 구분이나 mental model 하나입니다. Pattern은 여러 상황에서 반복되는
실행 순서입니다.

예를 들어 “원문을 고정한 뒤 판단한다”는 하나의 concept일 수 있습니다. 여러
workflow에서 반복해서 다음 순서가 나타난다면 pattern 후보가 됩니다.

```text
후보 찾기 -> 허용 여부 판단 -> 원문 읽기 -> 한 번에 commit
```

관련 있는 concept가 여러 개 있다는 이유만으로 pattern이 되지는 않습니다. 실제
반복 사례와 그 순서를 강제하는 힘이 있어야 합니다.

## 설명과 exercise

아직 내용을 이해하지 못했다면 먼저 읽거나 개념을 정리합니다. 설명은 이해를
도울 수 있지만 숙련을 입증하지는 않습니다.

다음과 같은 수행이 필요할 때 `exercise`를 씁니다.

- 결과를 보기 전에 동작을 예측
- 비슷해 보이는 오개념 두 개를 구분
- 일부가 비어 있는 worked example 완성
- 잘못된 해법 수정
- 다른 domain으로 transfer

또 다른 요약을 쓰는 것은 연습이 아닙니다.

## Handoff는 선택 사항

작업 중 다른 질문이 중요해지면 다음 Skill로 넘길 수 있습니다.

- 읽은 내용에서 재사용할 의미가 생김 -> `conceptualize`
- 여러 concept가 같은 순서로 반복됨 -> `patternize`
- 이해를 실제 수행으로 확인해야 함 -> `exercise`

하지만 자동으로 다음 단계에 들어가지는 않습니다. 현재 Skill이 자기 결과를 먼저
완성하고, 사용자가 원할 때만 다음 질문을 시작합니다.

## Learning을 쓰지 않을 때

- Pi가 repository를 배우는 것이 아니라 실제로 수정해야 할 때
- 자동으로 쌓이는 영속 notebook이 필요할 때
- 근거 없이 짧은 요약만 원할 때
- Source, concept, 반복 사례, 수행 목표 중 무엇을 다룰지 아직 정하지 못했을 때
