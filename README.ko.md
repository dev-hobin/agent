# 개발 판단과 학습을 위한 Pi 패키지

[English](./README.md) | 한국어

서로 독립적으로 설치해 사용하는 Pi 패키지 두 개를 담고 있습니다.

## 이 패키지를 만든 이유

사람은 모든 세부 지식을 한꺼번에 머릿속에 올려두고 일하지 않습니다. 지금 어떤 일을 다루는지 판단할 수 있는 큰 작업 방식은 유지하고, 구체적인 상황을 만났을 때 필요한 자료를 찾아봅니다.

이 패키지들도 에이전트의 컨텍스트를 같은 방식으로 구성합니다. Skill에는 계속 유지할 작업 방법을 두고, 상황에 따라 결과를 바꿀 수 있는 세부 내용만 Reference에서 가져옵니다. 모든 내용을 미리 넣거나 하나의 고정된 절차로 만들지 않고, 현재 작업에 필요한 컨텍스트에 집중하기 위한 구조입니다.

## 패키지

| 패키지 | 용도 | 설치 |
| --- | --- | --- |
| [`@hobin/developer`](./packages/developer/README.ko.md) | 개발자가 경험으로 쌓은 직관을 명시적인 개발 판단 Skill로 만들고, 현재 문제에 맞는 Reference를 함께 활용 | `pi install npm:@hobin/developer` |
| [`@hobin/learning`](./packages/learning/README.ko.md) | 기술 문서 읽기, 오픈 소스 학습, 개념화, 패턴 발견, 의도적 연습을 위한 Skill | `pi install npm:@hobin/learning` |

두 패키지는 Node.js 22.19 이상이 필요하며, Pi의 기본 모델·Tool·세션·compaction·응답 루프를 그대로 사용합니다. 하나의 단계형 워크플로를 이루지 않으며 서로 독립적으로 설치해 사용합니다.

설치하지 않고 한 번만 실행하려면:

```sh
pi -e npm:@hobin/developer
```

소스 체크아웃에서 실행할 때는 저장소 루트가 아니라 실제 패키지 디렉터리를 불러옵니다.

```sh
pi -e ./packages/developer
pi -e ./packages/learning
```

## 독립 리소스

[`agents/`](./agents)에는 검토 가능한 컨텍스트 조각이, [`skills/`](./skills)에는 독립적인 Skill이 있습니다. 두 패키지 어디에도 선언되지 않으며 자동으로 로드되지 않습니다. 필요한 컨텍스트 조각을 `AGENTS.md`에 합치거나, `pi --skill ./skills/<name>`으로 Skill을 직접 불러옵니다.

## 개발

```sh
pnpm install --frozen-lockfile
pnpm check
```

패키지 검사는 모델 제공자 없이 실행됩니다. 실제 모델을 사용하는 검증은 별도로 범위를 정해 실행하며 기본 테스트 명령에는 포함되지 않습니다.

## 라이선스

[MIT](./LICENSE)
