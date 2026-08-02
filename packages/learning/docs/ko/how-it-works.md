# Learning의 동작 원리

[English](../how-it-works.md) | 한국어

Learning은 학습 진행 상태를 관리하는 runtime이 아닙니다. Package는 Pi가 직접 읽는
다섯 개의 완전한 `SKILL.md`와, 그중 하나를 고르기 쉽게 해 주는 작은 extension으로
구성됩니다.

이 구분이 동작 원리의 핵심입니다.

```text
Pi package discovery
├─ extensions/learning.ts  → /learning 선택기
└─ skills/*/SKILL.md       → Pi의 일반 Skill loader가 모델 context에 넣는 작업 방법
```

Chooser가 Skill을 실행하는 것도 아니고, Skill이 Learning 전용 state machine 위에서
도는 것도 아닙니다.

## 1. Pi가 extension과 Skill을 서로 다른 resource로 발견한다

`package.json`의 `pi.extensions`는 `extensions/learning.ts` 하나를 가리키고,
`pi.skills`는 `skills/` directory를 가리킵니다.

Pi가 package를 load할 때 일어나는 일은 두 가지입니다.

1. Extension module을 실행해 `/learning` command를 등록합니다.
2. 각 `skills/<name>/SKILL.md`의 frontmatter와 본문을 일반 Pi Skill로 discover합니다.

Learning extension은 Skill 목록을 복제해 별도 registry를 만들거나 model prompt를
직접 조립하지 않습니다. 실제 Skill loading과 `/skill:<name>` 처리는 Pi가 맡습니다.
따라서 `/learning`을 한 번도 열지 않아도 사용자가 `/skill:technical-reading`을 직접
실행할 수 있습니다.

## 2. `/learning`은 editor text만 바꾼다

Chooser handler는 argument 또는 TUI 선택 결과를 다섯 Skill 이름 중 하나로 parse한
뒤 `prepareLearningSkill()`을 호출합니다.

이 함수는 현재 editor text에서 기존 Learning Skill prefix만 제거하고, 나머지 초안을
보존한 채 새 prefix를 붙입니다.

```text
현재 editor:
  이 RFC에서 state 전이가 깨지는 예를 설명해 줘

technical-reading 선택 뒤:
  /skill:technical-reading 이 RFC에서 state 전이가 깨지는 예를 설명해 줘
```

여기까지 model request, session event, source read는 발생하지 않습니다. Extension은
`setEditorText()`를 호출하고 끝납니다. 사용자가 편집된 문장을 확인해 직접 전송해야
Pi의 Skill loader가 실행됩니다.

Argument를 바로 준 `/learning technical-reading`도 같은 함수를 거칩니다. TUI를
건너뛸 뿐 자동 실행으로 바뀌지 않습니다.

## 3. Skill method는 prompt-time 실행 계약이다

사용자가 `/skill:technical-reading`을 전송하면 Pi가 해당 `SKILL.md`를 현재 model
context에 넣습니다. 그 뒤의 읽기, repository 탐색, 개념화, pattern 판단, 연습 설계는
모델이 Skill method를 따라 일반 Pi tool로 수행합니다.

즉 Skill의 실행 의미는 별도 TypeScript controller가 아니라 `SKILL.md`에 있습니다.
각 Skill은 단독으로 다음을 결정할 수 있어야 합니다.

- 어떤 요청을 자기 질문으로 받아들이는가
- 어떤 source와 범위를 근거로 쓰는가
- 어떤 순서로 조사하고 구분하는가
- 근거가 부족하거나 다른 질문이 나타나면 어떻게 처리하는가
- 어떤 결과를 만들면 자기 작업이 끝나는가

Reference를 하나도 읽지 않아도 core method가 완전해야 하는 이유입니다. Reference가
없다는 이유로 Skill이 시작할 수 없거나 다른 Learning Skill을 먼저 요구하면 독립적인
capability가 아닙니다.

## 4. 다섯 Skill은 결과가 아니라 질문 소유권으로 나뉜다

Skill 경계는 산출물 형식이나 학습 phase가 아니라 중심 질문으로 정합니다.

| Skill | 소유하는 중심 질문 |
| --- | --- |
| `technical-reading` | 이 source가 실제로 무엇을 주장하고, 보여 주고, 제한하는가? |
| `opensource-reading` | 공개 repository의 exact code slice가 어떤 contract와 tradeoff를 구현하는가? |
| `conceptualize` | Source 표현을 벗어나도 유지되는 개념은 무엇인가? |
| `patternize` | 여러 사례의 반복이 어떤 조건에서 재사용 가능한 routine이 되는가? |
| `exercise` | 이해를 실제 사용 능력으로 보여 줄 관찰 가능한 수행은 무엇인가? |

이 경계 때문에 technical reading은 source의 어휘와 순서를 보존하지만,
conceptualize는 오히려 source-specific wording을 제거해 transfer를 시험합니다. 두
동작을 하나의 자동 phase로 묶으면 서로 다른 완료 조건을 훼손합니다.

## 5. Package 전체를 잇는 lifecycle state가 없다

Learning은 다음 값을 session에 기록하지 않습니다.

- 현재 학습 단계
- 완료율
- 다음에 실행할 Skill
- 공통 artifact schema
- 기본 Notebook 또는 repository path

한 Skill이 다른 중심 질문을 발견하면 현재 결과 안에 handoff 필요성을 적을 수는
있습니다. 하지만 package runtime이 다음 Skill을 자동 실행하거나 앞 결과를 hidden
shared state로 넘기지 않습니다. 사용자가 새 요청을 보내면 Pi가 그 Skill을 새로
load합니다.

이 구조에서 “독립적”이라는 말은 서로 협력할 수 없다는 뜻이 아닙니다. 한 결과를
다음 요청의 명시적인 input으로 넘길 수 있다는 뜻이며, 넘길지 말지는 사용자가
결정합니다.

## 6. `judgment.json`은 runtime policy engine이 아니라 authoring source다

각 Skill directory의 `judgment.json`은 packaged reference를 언제 읽을지 작성하는
maintainer용 source입니다. Package 개발 script는 이 policy를
`judgmentPolicyDirections()`로 compile해 `SKILL.md`의 `## Context Directions`
section에 결정적인 Markdown으로 넣습니다.

```sh
node packages/learning/scripts/write-context-directions.mjs
pnpm --filter @hobin/learning check
```

설치된 package에서 이 JSON을 감시하는 Learning service나 Judgment session은
시작되지 않습니다. Runtime에서 모델이 보는 실행 지침은 이미 생성된 `SKILL.md`
본문입니다. `@hobin/judgment`가 devDependency인 이유도 여기에 있습니다.

Package check는 policy와 generated section이 byte 단위로 같은지 확인합니다. 따라서
maintainer가 policy만 바꾸고 Skill prompt를 재생성하지 않으면 배포 검사가 실패합니다.

## 7. Reference는 조건부 보강 자료다

`references/`의 파일은 core method를 대체하지 않습니다. Context Directions에는 각
파일이 현재 결과를 실제로 바꿀 조건이 따로 들어갑니다.

동작 판단은 다음과 같습니다.

1. 먼저 source 자체와 core method로 현재 문제를 봅니다.
2. 빠진 구분이나 반례가 무엇인지 확인합니다.
3. 그 차이를 보탤 수 있는 exact reference만 일반 file-reading tool로 엽니다.
4. Source가 이미 그 구분을 충분히 제공한다면 reference를 읽지 않습니다.

그래서 reference 수가 많아져도 모두 model context에 자동 주입되지 않습니다. Zero,
one, many가 모두 정상입니다. Root `unless`가 맞는 reference는 `when`이 비슷해 보여도
열지 않는다는 지침도 generated section에 포함됩니다.

이 선택은 prompt를 따르는 agent behavior입니다. Learning extension이 tool call을
가로채 강제하는 access-control mechanism은 아닙니다.

## 8. 저장 경계도 Skill 지침이지 숨은 persistence service가 아니다

각 Skill은 기본 결과를 대화에서 완성하도록 작성되어 있습니다. 사용자가 저장을
요청하고 target을 정했을 때만 일반 file tool로 Markdown을 쓰도록 지시합니다.

Learning extension 자체에는 artifact writer, Notebook service, graph database,
session store가 없습니다. 따라서 다음을 구분해야 합니다.

- **구조적으로 보장되는 것:** Chooser는 editor만 바꾸고 Learning state를 저장하지
  않음
- **Skill method가 요구하는 것:** 사용자의 저장 요청과 target 없이 파일을 쓰지 않음
- **Pi가 실제로 수행하는 것:** 모델이 활성 tool을 호출하면 host 권한으로 파일을 씀

Learning은 운영체제 수준에서 write를 막는 sandbox가 아닙니다. 저장 경계는 Skill
method가 지켜야 하는 작업 계약입니다.

## 9. Package check가 구조적 퇴행을 막는다

`pnpm --filter @hobin/learning check`는 다음 구조를 확인합니다.

- Pi loader가 다섯 Skill을 error 없이 discover하는가
- Chooser 목록과 실제 Skill directory가 일치하는가
- 각 Skill이 frontmatter, complete method, Context Directions를 가지는가
- 모든 packaged reference가 정확히 한 policy entry에 포함되는가
- Policy path가 Skill root 안의 실제 Markdown을 가리키는가
- Generated directions가 policy와 일치하는가
- 옛 artifact validator, 공통 graph schema, Judgment runtime extension이 돌아오지
  않았는가

이 검사는 학습 결과의 의미적 품질을 증명하지 않습니다. Package가 독립 Skill
구조와 authoring/runtime 경계를 계속 지키는지만 확인합니다.
