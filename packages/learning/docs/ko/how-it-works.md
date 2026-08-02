# Learning 동작 방식

[English](../how-it-works.md) | 한국어

Learning은 중앙에서 학습 단계를 관리하는 extension이 아닙니다. Package에는 작은
chooser 하나와 독립적인 `SKILL.md` 다섯 개가 들어 있습니다.

## `/learning`이 실제로 하는 일

Pi가 package를 load하면 extension은 `/learning` 명령 하나를 등록합니다. 명령을
실행하면 다음이 전부입니다.

1. 다섯 Skill 이름을 보여 줍니다.
2. 사용자가 하나를 고릅니다.
3. 기존 editor 초안을 보존합니다.
4. 선택한 `/skill:<name>` 명령을 editor에 넣습니다.
5. 사용자가 내용을 확인하고 직접 전송합니다.

Chooser는 모델을 호출하지 않고 session event를 만들지 않으며 학습 phase를
기록하지 않습니다.

명령 뒤에 이름을 바로 쓸 수도 있습니다.

```text
/learning technical-reading
```

이 경우에도 editor에 Skill command를 준비할 뿐 자동으로 실행하지 않습니다.

## Skill을 실행할 때

사용자가 `/skill:technical-reading` 같은 명령을 전송하면 Pi의 일반 Skill loader가
해당 `SKILL.md`를 모델 context에 넣습니다. Learning 전용 runtime이나 scheduler가
끼어들지 않습니다.

각 `SKILL.md`에는 다음이 모두 들어 있어야 합니다.

- 어떤 요청에 쓰는가?
- 어떤 자료를 입력으로 받는가?
- 무엇을 어떤 순서로 하는가?
- 근거가 부족하면 어떻게 말하는가?
- 어떤 결과가 나오면 끝나는가?

따라서 reference를 하나도 읽지 못하더라도 Skill의 기본 method는 완전해야 합니다.

## 참고 자료를 읽는 때

각 Skill directory에는 더 자세한 점검법이나 예시가 `references/`에 들어 있습니다.
예를 들어 technical-reading에는 여러 reading lens를 구분하는 자료가 있습니다.

모든 reference를 항상 읽으면 source 자체보다 package checklist가 앞서게 됩니다.
그래서 Skill 안의 `Context Directions`가 각 파일이 필요한 상황을 따로 설명합니다.

```text
현재 source가 개념 주장과 runtime semantics를 함께 다룬다
-> lens-library가 구분을 더할 수 있음
-> source가 이미 충분히 구분했다면 읽지 않음
-> 아직 빠진 구분이 있다면 exact reference만 읽음
```

이 directions의 원본은 `judgment.json`입니다. Package를 개발할 때 script가 정책을
`SKILL.md` section으로 생성합니다. 설치된 runtime에서 Judgment session이 시작되는
것은 아닙니다.

## Skill 사이에 공유 state가 없는 이유

Technical reading의 결과는 source에 충실해야 하고, conceptualize의 결과는 source
표현에서 벗어나야 합니다. 두 작업을 한 lifecycle state에 넣으면 읽기만 했는데도
“다음 단계”를 강요하기 쉽습니다.

Learning은 다음을 공유하지 않습니다.

- 현재 학습 phase
- 완료율
- 공통 artifact schema
- 자동 notebook 위치
- Skill 사이의 필수 순서

다른 Skill이 필요해지면 현재 결과를 완성한 뒤 새 요청으로 handoff합니다.

## 파일을 쓰는 때

기본 결과는 대화 안에서 끝납니다. Skill이 저장할 만한 Markdown을 만들었더라도
사용자가 저장을 요청하기 전에는 파일을 만들지 않습니다.

사용자가 target을 이미 정했다면 그 위치를 사용합니다. 현재 대화에 저장 위치가
없다면 최소한의 설정 질문을 먼저 합니다. Learning이 임의로 repository나 notebook을
만들지는 않습니다.

## Maintainer가 확인할 것

Policy나 reference를 바꾸면:

```sh
node packages/learning/scripts/write-context-directions.mjs
pnpm --filter @hobin/learning check
```

Package check는 다음을 확인합니다.

- Pi가 다섯 Skill을 모두 discover하는가?
- 각 policy와 reference path가 유효한가?
- 모든 packaged reference가 정확히 한 policy에 포함되는가?
- 생성된 `Context Directions`와 `SKILL.md`가 byte 단위로 일치하는가?
- Packed package가 Judgment runtime extension을 포함하지 않는가?
