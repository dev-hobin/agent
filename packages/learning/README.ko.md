# @hobin/learning

[English](./README.md) | 한국어

기술 문서와 공개 저장소를 이해하고, 거기서 얻은 내용을 재사용할 아이디어나
연습으로 만들 때 쓰는 독립적인 Pi Skill 다섯 개입니다.

Learning은 정해진 학습 과정을 실행하는 도구가 아닙니다. 필요한 Skill 하나만 쓸
수 있고, 각 Skill은 자기 결과를 완성한 뒤 끝납니다.

## 설치

[Pi](https://pi.dev)와 Node.js 22.19 이상이 필요합니다.

```sh
pi install npm:@hobin/learning
```

설치하지 않고 한 번만 써 보려면:

```sh
pi -e npm:@hobin/learning
```

## 먼저 해보기

평소처럼 요청해도 됩니다.

```text
이 RFC 부분을 같이 읽어 줘. 예시와 예외를 빼먹지 말고, 여기서 전제하는 state
model을 설명해 줘.
```

Skill을 바로 부를 수도 있습니다.

```text
/skill:technical-reading 이 글의 경계를 뭉개지 말고 설명해 줘.
/skill:opensource-reading 이 API를 docs, tests, implementation에서 추적해 줘.
/skill:conceptualize 이 결과에서 출처를 넘어 쓸 수 있는 개념 하나를 만들어 줘.
/skill:patternize 이 반복 사례가 재사용할 수 있는 routine인지 판단해 줘.
/skill:exercise 예측, 오개념 진단, 수정, transfer 연습을 만들어 줘.
```

`/learning`은 작은 선택기를 엽니다. 고른 `/skill:...` 명령을 editor에 넣고 기존
초안은 보존합니다. 자동으로 전송하거나 별도의 Learning session을 시작하지
않습니다.

## Skill 고르기

| 필요한 결과 | Skill |
| --- | --- |
| 책, 글, 명세, 튜토리얼, PDF, 웹페이지를 원문에 충실하게 이해 | `technical-reading` |
| 오픈 소스 저장소의 공개 API, 흐름, 불변식, tradeoff를 실제 코드 근거로 학습 | `opensource-reading` |
| 여러 자료에서 얻은 내용을 출처 밖에서도 쓸 수 있는 개념으로 정리 | `conceptualize` |
| 여러 사례의 반복을 실제로 실행할 수 있는 routine으로 정리 | `patternize` |
| 이해한 내용을 사용할 수 있는지 관찰 가능한 연습으로 확인 | `exercise` |

이것은 다섯 단계가 아니라 서로 다른 질문입니다. 글을 읽었다고 반드시 개념을
만들 필요가 없고, 개념을 만들었다고 반드시 pattern으로 이어갈 필요도 없습니다.
각 Skill의 결과만으로 끝내도 됩니다.

## Skill을 고른 뒤 일어나는 일

1. Pi가 선택한 `SKILL.md`를 완전한 작업 방법으로 불러옵니다.
2. Skill이 자기 질문에 필요한 source나 repository 범위만 읽습니다.
3. 패키지 참고 자료는 그 파일이 알려 줄 구분이 현재 결과를 바꿀 때만 엽니다.
4. 대화에서 바로 쓸 수 있는 완전한 결과나 복사 가능한 Markdown을 돌려줍니다.
5. 사용자가 저장 위치를 정하거나 승인했을 때만 파일을 씁니다.

Learning은 notebook, graph database, 진행률, Skill 사이의 숨은 state를 만들지
않습니다.

## 선택적 참고 자료 지침

각 Skill에는 패키지 개발에만 쓰는 작은 `judgment.json`이 있습니다. 이 정책은
`SKILL.md` 안의 결정적인 `Context Directions` section으로 생성됩니다. 설치된
Learning이 Judgment runtime을 시작하는 것은 아닙니다. Pi는 일반 Skill 내용으로
method와 directions를 모델에 보여 줄 뿐입니다.

## 문서

- [Skill 고르기](./docs/ko/choosing-a-skill.md) — 다섯 결과를 구분하는 기준
- [Learning 동작 방식](./docs/ko/how-it-works.md) — 선택기, Skill loading, 참고 자료,
  저장 경계

## 개발

```sh
pnpm --filter @hobin/learning check
pnpm --filter @hobin/learning eval
pi -e ./packages/learning
```

정책을 바꾼 뒤 embedded directions를 다시 만듭니다.

```sh
node packages/learning/scripts/write-context-directions.mjs
```

## 라이선스

[MIT](./LICENSE)
