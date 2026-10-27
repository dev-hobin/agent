# @hobin/learning

[English](./README.md) | 한국어

기술 문서와 공개 저장소를 이해하고, 재사용할 아이디어와 연습으로 발전시킬 때
쓰는 독립적인 [Agent Skills](https://agentskills.io/specification) 다섯 개입니다.
정해진 학습 과정을 실행하는 도구가 아니며, 각 Skill이 자기 결과를 완성하고 끝납니다.

## 에이전트 중립적인 설치

`skills/<name>/` 디렉터리 전체를 사용하는 호스트의 Skill 탐색 경로에 설치하거나
노출합니다. `SKILL.md`만 복사하지 말고 supporting files도 포함합니다. 지침으로
구성된 Skill을 읽는 데 Pi나 Node.js는 필요하지 않고, 참고 자료 선택을 위한
호스트 확장도 필요하지 않습니다.

아래는 호스트별 개인 경로와 직접 호출 예시입니다.

| 호스트 | 경로 | 예시 |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/<name>/` | `/technical-reading` |
| Codex | `~/.agents/skills/<name>/` | `$technical-reading` |
| Pi | 기본 Skill 경로 또는 아래 패키지 설치 | `/skill:technical-reading` |

공통 Agent Skills 탐색 규칙이 아니라 서비스별 사용 예시입니다. 저장소의
[표준 기준 문서](https://github.com/dev-hobin/agent/blob/main/docs/standards.md)는
공식 형식, 자체 레퍼런스 규약, 호스트 API를 구분합니다.

## 먼저 해보기

평소처럼 요청하거나 `technical-reading`을 직접 선택합니다.

```text
이 RFC 부분을 같이 읽어 줘. 예시와 예외를 빼먹지 말고, 여기서 전제하는 state
model을 설명해 줘.
```

## Skill 고르기

| 필요한 결과 | Skill |
| --- | --- |
| 책, 글, 명세, 튜토리얼, PDF, 웹페이지를 원문에 충실하게 이해 | `technical-reading` |
| 공개 저장소의 API, 흐름, 불변식, tradeoff 하나를 실제 코드로 학습 | `opensource-reading` |
| 여러 자료에서 출처 밖에서도 쓸 수 있는 개념 하나를 정리 | `conceptualize` |
| 여러 사례의 반복을 실행할 수 있는 routine으로 정리 | `patternize` |
| 이해를 실제로 사용할 수 있는지 관찰 가능한 연습으로 확인 | `exercise` |

다섯 단계가 아니라 서로 다른 질문입니다. 읽었다고 반드시 개념을 만들거나,
개념을 만들었다고 반드시 pattern으로 이어갈 필요는 없습니다.

## 실행과 참고 자료

호스트가 선택한 `SKILL.md`를 로드하면 에이전트가 일반 source, repository, file
도구로 method를 따릅니다. 현재 결과를 실질적으로 바꿀 참고 자료만 읽습니다.
Method는 대화에서 완전한 결과나 복사 가능한 Markdown을 완성하고, 사용자가
저장을 요청하고 target을 정하거나 승인했을 때만 파일을 쓰도록 지시합니다.

각 Skill의 `judgment.json`은 개발용 원본이고, `SKILL.md`의 결정적인
`Context Directions`로 생성됩니다. JSON은 자체 규약이지 표준 호스트 정책 API가
아닙니다. Judgment runtime이나 reference 선택 service는 없습니다. Notebook,
진행률, Skill 사이의 숨은 state도 만들지 않습니다.

## 선택적인 Pi 선택기

```sh
pi install npm:@hobin/learning
# 한 번만 써 보려면:
pi -e npm:@hobin/learning
```

`adapters/pi/learning.ts`가 `/learning`을 등록합니다. 선택기는 고른 `/skill:...`
명령을 editor에 넣고 초안을 보존할 뿐, 전송하거나 참고 자료를 읽거나 별도 session을
시작하지 않습니다. 선택기 없이 Pi의 직접 Skill 명령을 사용할 수 있습니다.

패키지 설치 방식은 유지됩니다. 소스 경로를 직접 설정했다면
`extensions/learning.ts`를 `adapters/pi/learning.ts`로 바꿉니다. Pi peer dependency는
선택 사항이며, Skill 디렉터리를 소비하는 데 Pi runtime 설치가 필요하지 않습니다.

## 문서

- [Skill 고르기](./docs/ko/choosing-a-skill.md)
- [Learning의 동작 원리](./docs/ko/how-it-works.md) — 표준 method, authoring/runtime
  경계, 선택적인 Pi 연동

## 개발

저장소 루트 README의 개발 환경을 준비한 뒤 실행합니다.

```sh
pnpm check:portable
pnpm --filter @hobin/learning check:pi
```

정책을 바꾼 뒤에는 generated directions를 다시 만듭니다.

```sh
node packages/learning/scripts/write-context-directions.mjs
```

`eval`, `eval:contrast`는 선택적인 Pi 실모델 평가 명령입니다. Portable 검사에
포함되지 않으며 provider 요청이 발생할 수 있습니다.

## 라이선스

[MIT](./LICENSE)
