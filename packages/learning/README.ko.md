# @hobin/learning

[English](./README.md) | 한국어

기술 문서와 공개 저장소를 이해하고, 재사용할 아이디어와 연습으로 발전시킬 때
쓰는 독립적인 [Agent Skills](https://agentskills.io/specification) 다섯 개입니다.
정해진 학습 과정을 실행하는 도구가 아니며, 각 Skill이 자기 결과를 완성하고 끝납니다.

## 에이전트 중립적인 설치

루트 `plugin.json`은 Agent Plugins 1.0.0을 따르며 `hobin-learning`을 선언합니다.
Claude와 Codex에서는 여러 프로젝트에서 쓸 수 있는 아래의 기본 플러그인 설치를
권장합니다. 개별 Skill을 노출한다면 supporting files를 포함한 `skills/<name>/`
디렉터리 전체를 사용합니다. 지침 자체를 읽는 데 Pi나 Node.js는 필요하지 않고,
참고 자료 선택을 위한 호스트 확장도 필수가 아닙니다.

아래는 호스트별 로딩 방식과 직접 호출 예시입니다.

| 호스트 | 경로 | 예시 |
| --- | --- | --- |
| Claude Code 플러그인 | 기본 사용자 플러그인 설치 | `/hobin-learning:technical-reading` |
| Codex 플러그인 | 기본 사용자 플러그인 설치 | `$hobin-learning:technical-reading` |
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

## 호스트의 기본 플러그인 설치

아직 npm에 배포하지 않은 0.2.2 준비본의 manifest와 카탈로그가 포함된 checkout을
사용합니다. 임의의 작업 프로젝트가 아닌 **리소스 checkout**을 등록합니다.

Claude Code에서 사용자 전체 프로젝트에 적용하려면:

```sh
claude plugin marketplace add /absolute/path/to/agent --scope user
claude plugin install hobin-learning@hobin-agent --scope user
```

Codex의 기본 사용자 설치:

```sh
codex plugin marketplace add /absolute/path/to/agent
codex plugin add hobin-learning@hobin-agent
```

새 세션에서 Claude는 `/hobin-learning:technical-reading`, Codex는
`$hobin-learning:technical-reading`처럼 사용합니다. 두 호스트가 같은 `skills/`를
사용합니다. `.claude-plugin/plugin.json`은 공통 manifest와 동기화한 기존 Claude
호환 파일이며, 여기서는 `.codex-plugin` 파일이 필요하지 않습니다.

`claude --plugin-dir /absolute/path/to/agent/packages/learning`은 개발용 세션 로드입니다.
일반 flat `skills add`가 namespace를 적용하거나 기존 사본을 제거하지도 않습니다.
[설치와 실제 검증 범위](https://github.com/dev-hobin/agent/blob/main/docs/installation.md),
[Claude 충돌 경계](https://github.com/dev-hobin/agent/blob/main/docs/claude-plugins.md)를 참고합니다.

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
# Claude Code가 설치된 경우 선택적으로 실행:
pnpm check:claude
```

정책을 바꾼 뒤에는 generated directions를 다시 만듭니다.

```sh
node packages/learning/scripts/write-context-directions.mjs
```

`pnpm check:standard`는 Agent Skills와 Agent Plugins를 검사합니다. 선택적인
`pnpm check:install -- claude`와 `pnpm check:install -- codex`는 임시 HOME·설정으로
실제 설치를 검사하며 모델을 호출하지 않습니다. 소비자용 설치기가 아니라 개발 검사입니다.

`eval`, `eval:contrast`는 선택적인 Pi 실모델 평가 명령입니다. Portable 검사에
포함되지 않으며 provider 요청이 발생할 수 있습니다.

## 라이선스

[MIT](./LICENSE)
