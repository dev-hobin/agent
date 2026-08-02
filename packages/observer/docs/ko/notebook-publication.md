# Notebook 저장 방식

[English](../notebook-publication.md) | 한국어

Notebook의 Markdown만 장기 보관 record입니다. Pi session 안의 SourceRead, working
Memo, proposal은 저장을 준비하는 상태일 뿐입니다.

## 저장되는 record

| Type | 담는 내용 |
| --- | --- |
| Source | 외부 자료 또는 직접 관찰, provenance, 주요 claim |
| Inquiry | 처음 적은 질문이나 가설, 현재 문장, revision 이유, evidence |
| Memo | 하나 이상의 Inquiry에 묶인 working synthesis |
| Zettel | 검토 뒤 승격한 독립 note |

모든 record는 `observer-record/v1` schema를 따릅니다. Schema 파일은
[`../../schemas/observer-record.v1.schema.json`](../../schemas/observer-record.v1.schema.json)에
있습니다.

Zettel에는 direct Source reference가 적어도 하나 있어야 합니다. Inquiry나 Memo만
연결된 note는 출처까지 추적할 수 없으므로 저장하지 않습니다.

## Markdown 한 파일의 조건

Record file은 다음 모양이어야 합니다.

```text
YAML frontmatter
정확히 하나의 H1
비어 있지 않은 Markdown body
```

Observer가 관리하지 않는 custom frontmatter field는 보존합니다. 다만 Observer
schema 내부의 unknown field는 거부합니다. Record ID prefix는 type과 맞아야 하고,
timestamp와 language tag도 유효해야 합니다.

## 전체 graph를 함께 검사하는 이유

File 하나가 schema에 맞아도 다른 record를 잘못 가리킬 수 있습니다. Review는
batch를 저장한 뒤의 Notebook 전체를 미리 구성해 다음을 검사합니다.

- Record ID가 겹치지 않는가?
- Source, Inquiry, evidence, lineage target이 실제로 존재하는가?
- 자기 자신을 가리키거나 같은 edge가 두 번 들어가지는 않았는가?
- Memo가 적어도 자기 Inquiry scope와 연결되는가?
- Revision lineage가 같은 종류의 record를 가리키는가?
- Promotion status와 target type이 맞는가?
- 모든 Zettel이 direct Source를 가지는가?

Document 하나가 잘못됐다면 graph 검사를 하기 전에 먼저 거부합니다.

## Review에서 고정하는 값

Prepared proposal에는 다음이 묶입니다.

```text
Notebook canonical path와 identity
Episode와 review request ID
output language
create/update할 exact path
update file의 기존 content hash
각 file의 final Markdown
전체 record set
proposal ID
```

그래서 Review 뒤 누군가 target file을 수정하면 같은 proposal로 저장할 수 없습니다.
현재 byte에서 다시 proposal을 만들어야 합니다.

## 사용자가 확인하는 것

Workbench의 Proposal 화면에서 record마다 다음을 봅니다.

- 새 file인지 update인지
- 기존 Markdown
- line diff
- 저장될 final Markdown
- validation error

이 화면을 열고 닫아도 file은 바뀌지 않습니다. Save viewer에서 **Save all N
records**를 선택해야 approval이 만들어집니다. 다른 proposal ID나 일부 record만
승인하는 값은 받지 않습니다.

## Save transaction

승인 뒤에도 바로 final file을 덮어쓰지 않습니다.

1. **Preflight:** Notebook identity와 기존 target byte를 다시 확인합니다.
2. **Plan:** create/update operation과 예상 final byte를 계산합니다.
3. **Stage:** temporary file에 모든 record를 씁니다.
4. **Publish:** 계획한 순서대로 target을 교체합니다.
5. **Readback:** Notebook을 다시 열어 모든 final byte와 graph를 검사합니다.
6. **Settle:** readback이 정확할 때만 `SaveCommitted` event를 기록합니다.

`SaveCommitted`가 없으면 Episode는 저장 완료 상태가 아닙니다.

## 중간에 실패하면

Stage, publish, readback 중 실패하면 Observer가 알고 있는 이전 byte를 복원합니다.
하지만 다른 process가 target을 바꾼 흔적이 있다면 그 byte를 덮어쓰지 않습니다.
대신 `recovery-required` 상태를 보여 줍니다.

| 상황 | 처리 |
| --- | --- |
| Approval 전에 update target 변경 | Save 거부, Review에서 다시 준비 |
| 새 record path에 다른 file이 생김 | Collision으로 거부 |
| Notebook path 또는 manifest 변경 | 현재 target이 아니므로 거부 |
| 관련 없는 record 변경으로 final graph가 깨짐 | Preflight 거부 |
| Readback byte가 계획과 다름 | Settle하지 않고 rollback 또는 recovery 요구 |
| 같은 commit acknowledgment 재시도 | Exact receipt와 state가 맞을 때만 복구 |

## 보장 범위

Observer는 자기 process 안에서 하나의 logical batch가 전부 저장되거나 완료로
표시되지 않게 합니다. 다음까지 보장하지는 않습니다.

- Filesystem snapshot이나 distributed transaction
- Power loss 뒤의 완전한 durability
- 여러 Observer process가 같은 Notebook을 동시에 쓰는 상황
- 외부 editor lock
- Git history, remote sync, backup
- Model이 작성한 내용의 진실성

필요하다면 Notebook folder에 사용자의 backup 또는 version-control policy를 따로
적용하세요.
