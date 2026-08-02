# @hobin/judgment

[English](./README.md) | 한국어

한 질문에 쓸 자료를 정확히 고정하고, 그 자료가 결론에 어떻게 쓰였는지 확인할 수
있게 만드는 부수 효과 없는 엔진입니다.

Judgment는 다른 확장이나 도구 안에 넣어 쓰는 라이브러리입니다. Pi 명령, Skill,
도구, 프롬프트, 세션, UI를 직접 등록하지 않습니다.

## 설치

```sh
npm install @hobin/judgment
```

정책 파일을 검사하는 CLI도 들어 있습니다.

```sh
npx judgment check path/to/judgment.json
npx judgment explain path/to/judgment.json
npx judgment compile path/to/judgment.json
```

## 왜 필요한가요?

모델이 “이 파일과 테스트 결과를 참고했다”고 말하는 것만으로는 프로그램이 다음을
확인할 수 없습니다.

- 정확히 어느 내용이 쓰였는가?
- 이 질문에 맞는 자료였는가?
- 각 자료가 결론에 무엇을 보탰는가?
- 선택한 뒤 내용이 바뀌지는 않았는가?
- 모델의 해석인지, 별도 검사기의 확인인지, 사용자의 결정인지 구분되는가?

Judgment는 이 질문에 답할 수 있는 값을 만들어 호출자에게 돌려줍니다.

## 판단 하나가 끝나는 과정

호출자가 질문과 후보 자료를 넘기면 다음 순서로 처리합니다.

1. **질문을 연다.** 질문을 소유 기능, 선택적 정책, 현재 branch, 이미 알려진
   근거와 묶습니다.
2. **적용 여부를 정한다.** 정책이 있는 기능은 `applicable`,
   `not-applicable`, `needs-context` 중 하나가 됩니다.
3. **자료를 선택하고 원문을 고정한다.** 지명된 자료만 다시 찾아 읽습니다. 하나라도
   읽지 못하거나 내용이 달라졌다면 선택 전체가 실패합니다.
4. **쓰임을 확인한다.** 선택한 자료마다 “이 제약을 추가했다”, “이 주장을
   뒷받침했다”, “이 방법으로 조사하게 했다”처럼 구체적인 역할이 있어야 합니다.
5. **결론을 만든다.** 방금 확인한 기여, 충돌, 한계만 인용할 수 있습니다.

결과에는 질문, 선택, 읽은 내용, 근거 점검, 결론을 식별하는 hash가 들어갑니다.
Hash는 내용이 달라졌는지 확인하는 장치이지, 자료나 결론이 참이라는 증명은
아닙니다.

실제 값이 어떻게 이어지는지는 [Judgment 동작 방식](./docs/ko/how-it-works.md)에서
예로 설명합니다.

## 선택적 정책 파일

기능의 method 옆에 `judgment.json`을 둘 수 있습니다. 이 파일은 세 가지만
말합니다.

- 이 기능이 필요한 때
- 적용을 막는 명시적인 예외
- 패키지에 든 각 참고 자료가 도움이 되는 때

정책 파일이 없는 것은 정상입니다. 반대로 파일이 있는데 형식이 잘못됐다면 해당
자료를 사용할 수 없습니다.

```ts
import {
  compileJudgmentPolicy,
  parseJudgmentAuthoringPolicyJson,
} from "@hobin/judgment";

const policy = parseJudgmentAuthoringPolicyJson(policyJson);
const compiled = compileJudgmentPolicy({ owner, policy });
console.log(compiled.policySha256);
```

`owner`는 호출자가 정합니다. 정책 JSON이 자신의 소유자를 바꿀 수는 없습니다.

## 질문 하나에 여러 자료 쓰기

하나의 질문에 소유 기능, 지명한 외부 Skill, 현재 branch의 도구 결과, context
file, 사용자의 명시적인 결정을 함께 쓸 수 있습니다.

외부 Skill은 자료를 제공할 뿐 별도의 Judgment 절차를 시작하지 않습니다. 정책상
적용되는 Skill만 긍정적인 근거를 낼 수 있고, 각 Skill의 정책과 파일 root는 서로
섞이지 않습니다.

## 패키지 export

| Export | 용도 |
| --- | --- |
| `@hobin/judgment` | 정책, 질문, 자료, 근거 점검, lifecycle, 결과 값 |
| `@hobin/judgment/node` | 정해진 root 안에서만 읽는 local reader와 원자적 content sealing |
| `@hobin/judgment/pi-context` | Pi descriptor·관찰 adapter와 `ContextAttempt` |
| `@hobin/judgment/schema` | `judgment.json`용 JSON Schema |

## 호출자에게 남는 책임

Judgment는 어떤 기능을 쓸지 고르거나, 모든 Skill을 찾거나, 화면을 그리거나,
세션을 저장하거나, 코드 변경을 허가하지 않습니다. 결론이 실제로 무엇을
허용하는지 정하고 보여 주고 저장하는 일은 호출자가 맡습니다.

## 문서

- [Judgment 동작 방식](./docs/ko/how-it-works.md) — 질문 하나가 처리되는 실제 순서
- [정책 작성](./docs/ko/policy-authoring.md) — `judgment.json`의 정확한 규칙
- [Adapter 연결](./docs/ko/adapter-guide.md) — 다른 프로그램에 엔진을 넣는 방법

## 개발

```sh
pnpm --filter @hobin/judgment check
pnpm --filter @hobin/judgment pack
```

## 라이선스

[MIT](./LICENSE)
