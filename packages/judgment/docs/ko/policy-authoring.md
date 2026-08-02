# 정책 작성

[English](../policy-authoring.md) | 한국어

`judgment.json`은 소유 기능에 관한 두 가지만 적는 파일입니다.

1. 이 기능이 필요한 때와, 적용을 막는 명시적인 예외
2. 패키지에 넣어 둔 각 참고 자료가 method에 없는 내용을 보탤 수 있는 때

런타임 질문, 자료 순위, 읽기 순서, 확인 수준, 코드 변경 권한은 이 파일에 적지
않습니다.

## 전체 예시

```json
{
  "$schema": "https://raw.githubusercontent.com/dev-hobin/agent/main/packages/judgment/schemas/judgment-authoring.schema.json",
  "specVersion": "0.1",
  "when": [
    "Caller-facing operations, ownership, data flow, or implementation shape still need to be invented."
  ],
  "unless": [
    "A concrete candidate already exists and only its stability must be reviewed.",
    "The unresolved issue is product meaning rather than implementation shape."
  ],
  "references": [
    {
      "path": "references/meaning-preserving-conversions.md",
      "when": [
        "A cross-representation design needs explicit preserved-observer, loss, ambiguity, cycle, or unsupported-path checks."
      ]
    },
    {
      "path": "references/design-levels-and-boundaries.md",
      "when": [
        "A design needs an explicit caller vocabulary, owner, hidden mechanism, or dependency direction."
      ]
    }
  ]
}
```

기계가 읽는 schema는 `@hobin/judgment/schema`와
[`../../schemas/judgment-authoring.schema.json`](../../schemas/judgment-authoring.schema.json)에서
볼 수 있습니다.

## 적용 여부를 정하는 법

Root `when` 중 하나 이상이 현재 상황에 실제로 맞고, 맞는 root `unless`가 없으면
이 기능을 적용합니다. 둘 다 맞으면 `unless`가 우선합니다.

지금 가진 정보로 판단할 수 없다면 런타임에서 `needs-context`를 사용합니다.
불확실하다는 이유로 `unless`를 만들면 안 됩니다.

```text
when:   호출자가 사용할 data flow를 아직 설계해야 한다.
unless: 구체적인 interface가 이미 있고 안정성만 검토하면 된다.
```

첫 문장은 이 기능이 맡는 일을 말합니다. 둘째 문장은 이미 만들어진 후보를 다른
검토 기능으로 보내는 예외입니다.

## 참고 자료는 각각 따로 판단한다

`references[]`의 파일은 서로 독립적인 후보입니다. 조건이 맞아도 “읽어 볼 수
있다”는 뜻일 뿐 반드시 읽어야 하거나 그 내용이 정답이라는 뜻은 아닙니다.

좋은 `references[].when`에는 두 가지가 들어갑니다.

- 지금 눈에 보이는 문제
- 이 파일이 새로 알려 줄 구분이나 점검 기준

너무 넓은 문장:

```text
변환이 있을 때.
```

쓸모 있는 문장:

```text
서로 다른 표현 사이를 변환하는 설계에서 보존해야 할 관찰값, 정보 손실,
모호성, 순환, 지원하지 않는 경로를 따로 점검해야 할 때.
```

현재 명세나 테스트가 이미 이 내용을 더 정확히 알려 준다면 패키지의 참고 파일은
읽지 않아도 됩니다.

## 필드

| 필드 | 규칙 |
| --- | --- |
| `$schema` | 선택 사항. Editor 도움말에만 쓰며 정책 identity에는 포함하지 않음 |
| `specVersion` | 필수. 현재는 정확히 `"0.1"` |
| `when` | 적용 조건 하나 이상 |
| `unless` | `when`보다 우선하는 명시적인 제외 조건 |
| `references` | 서로 독립적으로 고를 수 있는 local file 하나 이상 |
| `references[].path` | 정책 파일이 있는 디렉터리를 기준으로 한 상대 POSIX path |
| `references[].when` | 해당 파일이 필요한 상황을 설명하는 문장 하나 이상 |

정책에는 owner 필드가 없습니다. Adapter가 실제 Skill이나 typed capability에서
owner를 구하고, compiler가 그 owner와 정책을 묶습니다.

## 정책 파일을 만들지 않아야 할 때

Skill에 조건부 참고 자료가 없다면 `judgment.json`을 만들 필요가 없습니다.
`SKILL.md`의 method만으로 완전해야 합니다.

```text
파일 없음        -> 참고 자료가 없는 정상 기능
파일이 있고 유효 -> owner와 묶인 정책
파일이 있지만 오류 -> 해당 source 거부
```

형식이 틀린 파일을 “정책 없음”으로 처리하면 안 됩니다.

## 안전한 경로

Reference path는 상대 경로여야 하고 `/`를 써야 합니다. 빈 segment, `.`, `..`는
허용하지 않습니다. 실제 파일을 읽을 때도 `realpath` 결과가 정책 root 안에 있는
regular file인지 다시 확인합니다. Symlink로 root 밖 파일을 가리키면 읽지 않습니다.

## 정책 검사

```sh
judgment check skills/example/judgment.json
judgment explain skills/example/judgment.json
judgment compile skills/example/judgment.json
```

- `check`: 파일을 parse하고 canonical authoring hash를 출력
- `explain`: 모델이 보게 될 조건을 결정적인 형식으로 출력
- `compile`: CLI owner와 정책을 묶어 canonical JSON 출력

패키지 검사에서는 선언한 파일이 실제로 있는지, 생성된 모델 지침과 정책이
어긋나지 않았는지도 확인해야 합니다.
