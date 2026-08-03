# Pi용 Hobin 패키지

[English](./README.md) | 한국어

이 저장소에는 Pi에 따로 설치하는 패키지 세 개와, 근거를 다루는 워크플로를 만들
때 쓰는 라이브러리 하나가 들어 있습니다.

## 패키지

| 패키지 | 하는 일 | 설치 |
| --- | --- | --- |
| [`@hobin/developer`](./packages/developer/README.ko.md) | 코드를 바꾸기 전에 무엇을 확인해야 하는지 정하고, 허용된 범위만 수정한 뒤 결과를 다시 검증 | `pi install npm:@hobin/developer` |
| [`@hobin/learning`](./packages/learning/README.ko.md) | 기술 문서와 오픈 소스 저장소를 읽고, 개념·패턴·연습으로 정리 | `pi install npm:@hobin/learning` |
| [`@hobin/observer`](./packages/observer/README.ko.md) | Pi로 작업하며 얻은 근거를 세션에 모아 두었다가, 검토한 Markdown만 로컬 노트에 저장 | `pi install npm:@hobin/observer` |
| [`@hobin/judgment`](./packages/judgment/README.ko.md) | 다른 도구에 정책, 자료 선택, 원문 고정, 근거 점검, 결론 기능을 붙이는 라이브러리 | `npm install @hobin/judgment` |

모든 패키지는 Node.js 22.19 이상이 필요합니다. Developer, Learning, Observer는
[Pi](https://pi.dev)도 필요합니다.

설치하지 않고 한 번만 써 보려면:

```sh
pi -e npm:@hobin/developer
```

현재 프로젝트의 `.pi/settings.json`에만 기록하려면 `-l`을 붙입니다.

```sh
pi install -l npm:@hobin/learning
```

## 무엇부터 써야 하나요?

- Pi가 코드를 바꿔야 하고, 그 판단이나 완료 여부를 분명히 확인하고 싶다면
  **Developer**를 씁니다.
- 저장소 변경보다 이해, 재사용할 아이디어, 연습 문제가 필요하다면 **Learning**을
  씁니다.
- 평소 Pi 작업은 그대로 하면서 중요한 근거만 모아 나중에 노트로 남기고 싶다면
  **Observer**를 씁니다.
- 다른 확장이나 도구를 만드는 중이라면 **Judgment**를 씁니다. Judgment 자체에는
  Pi 명령, Skill, 프롬프트, UI가 없습니다.

## 패키지 사이의 관계

이 네 패키지는 하나의 큰 제품을 단계별로 나눈 것이 아닙니다.

- Developer는 한 질문과 실제 근거를 묶어 결론을 낼 때 Judgment를 사용합니다.
- Observer는 관찰과 Memo가 현재 자료에 근거했는지 확인할 때 Judgment의 일부
  기능을 사용합니다.
- Learning은 개발할 때만 Judgment의 정책 compiler를 사용합니다. 설치된 Learning은
  평범한 Pi Skill 묶음으로 동작합니다.
- 명령, 상태, 화면, 저장 방식은 각 패키지가 따로 관리합니다.

## 모노레포 설치 경계

저장소 루트를 설치해 네 패키지를 한꺼번에 켜는 방식은 지원하지 않습니다. 루트는
개발용 private pnpm workspace이고, 모든 리소스를 묶는 Pi manifest가 없습니다.

공개 패키지는 하나씩 설치하세요. 소스를 checkout한 상태에서는 실행할 패키지의
정확한 디렉터리를 지정합니다.

```sh
pi -e ./packages/developer
```

이렇게 해야 한 패키지를 시험하다가 관련 없는 확장이나 Skill까지 함께 켜지는 일을
막을 수 있습니다.

## 문서

각 패키지의 README는 GitHub와 npm에서 바로 읽을 수 있는 독립 안내서입니다.
세부 동작은 패키지 안의 `docs/`에 적습니다.

- 영어: `README.md`, `docs/*.md`
- 한국어: `README.ko.md`, `docs/ko/*.md`

저장소 검사는 두 언어의 문서 목록과 내부 링크가 어긋나지 않는지 확인합니다.

## 저장소 구조

```text
packages/
├── judgment/   재사용 엔진, 스키마, API, CLI
├── developer/  Pi root runtime, receipt observer, 프로토콜, 열 개의 Skill
├── learning/   Skill 선택기와 독립적인 학습 Skill 다섯 개
└── observer/   Pi sidecar, 탐구 워크벤치, 로컬 노트 발행기
```

## 개발

```sh
corepack enable pnpm
pnpm install
pnpm check
pnpm eval
```

패키지 하나만 검사하려면:

```sh
pnpm --filter @hobin/developer check
pnpm --filter @hobin/developer eval
pi -e ./packages/developer
```

워크스페이스는 pnpm의 isolated linker를 사용합니다. 버전과 발행 여부는 패키지마다
따로 관리하며, 명시적으로 배포를 결정하기 전까지 모든 manifest는 private 상태를
유지합니다.

Pi 패키지는 Pi 프로세스와 같은 권한으로 실행됩니다. 외부 패키지는 설치 전에
소스를 확인하고, 더 강한 격리가 필요하면 운영체제 수준의 sandbox를 사용하세요.

## 라이선스

[MIT](./LICENSE)
