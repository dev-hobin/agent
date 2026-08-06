# Developer Terminal Judgment Workbench 연구와 적용 계약

> 상태: Developer 0.1.15 제품·UX 기준선
>
> 목적: Developer를 Settings 중심 command panel에서 branch-aware judgment workbench로 정렬하기 위한 공개 구현 사례 연구와 적용 계약
>
> 조사 시점: 2026-07-30

## 1. 제품 본질

Developer는 Skill 목록이나 자동 계획기가 아니다.

> Developer는 Pi의 소프트웨어 변경 과정에서 질문, 판단, 근거, 변경 권한, 검증 의무를 현재 branch에 연결하는 판단 통제면이다.

핵심 흐름은 다음과 같다.

```text
중요한 불확실성 발견
→ 하나의 판단 질문으로 라우팅
→ 필요한 근거·사용자 결정 명시
→ 정당화된 변경만 허용
→ 변경 이후 재관찰과 검증 요구
→ 현재 branch에 판단 이력 보존
```

사용자가 언제든 확인할 수 있어야 하는 것은 다음이다.

1. 지금 무엇을 판단하고 있는가?
2. 왜 이 판단이 필요한가?
3. 누가 어떤 Question을 해결해야 하는가?
4. 현재 어떤 작업이 허용되는가?
5. 무엇이 변경됐고 어떤 검증이 남았는가?
6. 현재 branch가 어떤 판단을 거쳐 여기까지 왔는가?

## 2. 조사 질문과 범위

조사 질문:

> Branch-aware 판단 시스템이 Route, Question, Judgment, Landing, History를 터미널에서 어떻게 보여줘야 사용자가 상태와 가능한 행동을 오해하지 않는가?

| 대상 | 조사 slice | Developer와의 대응 |
| --- | --- | --- |
| OpenCode | session route, Permission, Question, command palette, footer | live Route, gate, focused answer, contextual action |
| Aider | ask/code mode, diff, undo, map, slash grammar | mutation authority, landing scope, command 경계 |
| Jujutsu | operation log, `--at-op`, restore/revert | branch history, 과거 상태 inspection, append-only recovery |
| Bubble Tea | Model/Update/View, focus, help, quit filter | pure projection, focus ownership, contextual help |
| Lazygit | selection → detail → action → refresh | judgment inspection, stale action 방지 |
| K9s | live state home, command accelerator, history | Workbench root, navigation memory |
| Textual | screen stack, modal, scrollable container | route stack, modal input boundary, scoped scroll |
| Claude Code | permission mode, Plan approval, interactive diff | authority visibility와 stale diff 보조 비교 |

조사 revision:

- OpenCode `1e17856ba4b5b052650c8115060852f3f023844e`
- Aider `5dc9490bb35f9729ef2c95d00a19ccd30c26339c`
- Jujutsu `6a591f0da9f09c2c60ad62af07e6a764850adc05`
- Bubble Tea `fc707bb7ea0161405bb6c653ec93f6a9c6a72fe1`
- Lazygit `df0943ad334d1d3626b42057aad4b69324da3516`
- K9s `436ea2e9f23c5dd2d8e05c3e974220657524ef17`
- Textual `06dbeef4bb70fb718236aa418ed658ef4667a126`

Claude Code는 비공개 구현이므로 조사 시점의 공식 문서만 보조 근거로 사용했다.

## 3. OpenCode

OpenCode는 현재 session을 홈으로 유지하고 command를 accelerator로 둔다. UI route는 session domain state와 분리되어 있다.

근거:

- [route context](https://github.com/anomalyco/opencode/blob/1e17856ba4b5b052650c8115060852f3f023844e/packages/tui/src/context/route.tsx)
- [session surface](https://github.com/anomalyco/opencode/blob/1e17856ba4b5b052650c8115060852f3f023844e/packages/tui/src/routes/session/index.tsx)
- [command palette](https://github.com/anomalyco/opencode/blob/1e17856ba4b5b052650c8115060852f3f023844e/packages/tui/src/component/command-palette.tsx)

Command palette는 현재 context에서 reachable한 command를 선택하고 suggested command를 별도 노출한다. 같은 action에 keybinding과 slash name을 연결하지만 command 자체가 홈은 아니다.

Pending Permission이나 Question이 있으면 일반 prompt는 숨겨지거나 비활성화된다. Permission은 Question보다 먼저 처리되며 `once`, `always`, `reject`가 구분된다. `always`에는 한 단계 confirmation이 있고 edit Permission은 diff를 표시하며 필요할 때 fullscreen으로 확장된다.

근거:

- [permission prompt](https://github.com/anomalyco/opencode/blob/1e17856ba4b5b052650c8115060852f3f023844e/packages/tui/src/routes/session/permission.tsx)
- [question prompt](https://github.com/anomalyco/opencode/blob/1e17856ba4b5b052650c8115060852f3f023844e/packages/tui/src/routes/session/question.tsx)
- [footer](https://github.com/anomalyco/opencode/blob/1e17856ba4b5b052650c8115060852f3f023844e/packages/tui/src/routes/session/footer.tsx)

Developer 적용:

- 현재 Route와 Question을 홈의 핵심 객체로 둔다.
- Question answer surface는 focus를 소유한다.
- pending 개수는 footer에서 압축하고 전체 내용은 Workbench에서 inspect한다.
- Workbench navigation route는 persisted Developer state와 분리한다.

적용하지 않을 것:

- 모든 Question을 강제 modal로 만들지 않는다.
- plan/build 같은 수동 고정 mode를 도입하지 않는다.
- Pi가 소유한 대화 timeline을 Developer가 복제하지 않는다.

## 4. Aider

Aider는 `ask`, `code`, `architect`, `context` mode를 구분하고 현재 mode를 prompt에 표시한다. `/ask 질문`은 한 요청만 다른 mode로 실행할 수 있고 인수 없는 `/ask`는 sticky mode를 바꾼다.

근거:

- [chat mode](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/commands.py#L138)
- [ask/code/architect](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/commands.py#L1182-L1229)

`/diff`는 마지막 interaction 이전 commit을 기준으로 범위를 정한다. `/undo`는 현재 chat에서 Aider가 만든 commit인지, merge인지, dirty file이 있는지, 이미 push됐는지를 확인한다.

근거:

- [diff](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/commands.py#L657-L690)
- [undo](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/commands.py#L553-L655)

Developer 적용:

- 현재 mutation authority를 ambient하게 식별 가능하게 한다.
- Landing inspection에는 movement, stop, verifier라는 기준점을 둔다.
- Settings를 현재 작업 상태와 분리한다.
- slash command는 정상적인 `/root action` grammar를 사용한다.

적용하지 않을 것:

- Developer가 자동 commit이나 undo를 소유하지 않는다.
- 사용자가 Skill/implementation mode를 고정하지 않는다.
- repository map을 Developer 내부에 복제하지 않는다.

## 5. Jujutsu

Jujutsu operation은 단순한 로그 줄이 아니라 해당 operation 이후의 repository view, parent, timestamp, user, host, description을 가진다.

근거: [operation log](https://github.com/jj-vcs/jj/blob/6a591f0da9f09c2c60ad62af07e6a764850adc05/cli/docs/operation-log.md)

과거 상태 inspection과 복구는 분리된다.

```text
jj --at-op=<id> st/diff/log → inspection
jj op restore <id>          → 새 operation으로 복구
jj op revert <id>           → 새 operation으로 반전
```

Restore/revert는 과거 기록을 지우지 않고 새 operation을 추가한다.

근거:

- [operation restore](https://github.com/jj-vcs/jj/blob/6a591f0da9f09c2c60ad62af07e6a764850adc05/cli/src/commands/operation/restore.rs)
- [operation revert](https://github.com/jj-vcs/jj/blob/6a591f0da9f09c2c60ad62af07e6a764850adc05/cli/src/commands/operation/revert.rs)

`jj op log` 자체도 working-copy snapshot이나 divergent operation reconciliation을 수행할 수 있으므로 mutation 없는 inspection에는 `--at-op=@ --ignore-working-copy`가 필요하다.

근거: [operation log command](https://github.com/jj-vcs/jj/blob/6a591f0da9f09c2c60ad62af07e6a764850adc05/cli/src/commands/operation/log.rs#L47-L115)

Developer 적용:

- Judgment history는 당시 Route, basis, reference provenance, artifact를 함께 보여준다.
- 과거 state inspection은 session entry나 focus event를 추가하지 않는다.
- 미래에 복구 기능이 생겨도 history rewrite가 아니라 새 event여야 한다.

적용하지 않을 것:

- 범용 undo/restore를 Developer protocol에 추가하지 않는다.
- 다른 Pi branch의 history를 global log로 합치지 않는다.

## 6. Bubble Tea, Textual, Lazygit, K9s

Bubble Tea는 UI를 `Model → Update(event) → View`로 분리한다. Focus된 child가 입력을 처리하고 state에 따라 keybinding이 활성화되며 short/full help가 terminal width에 맞춰 달라진다.

근거:

- [help example](https://github.com/charmbracelet/bubbletea/blob/fc707bb7ea0161405bb6c653ec93f6a9c6a72fe1/examples/help/main.go)
- [split editors](https://github.com/charmbracelet/bubbletea/blob/fc707bb7ea0161405bb6c653ec93f6a9c6a72fe1/examples/split-editors/main.go)
- [composable views](https://github.com/charmbracelet/bubbletea/blob/fc707bb7ea0161405bb6c653ec93f6a9c6a72fe1/examples/composable-views/main.go)
- [quit interception](https://github.com/charmbracelet/bubbletea/blob/fc707bb7ea0161405bb6c653ec93f6a9c6a72fe1/examples/prevent-quit/main.go)

Textual은 modal이 아래 screen binding을 차단하고 scroll을 focused container에 귀속한다. Lazygit은 selection → detail → contextual action → refresh 순서를 유지하며 stale detail action을 막는다. K9s는 live resource state를 홈으로 두고 command를 accelerator로 사용하며 Esc history를 제공한다.

Developer 적용:

```text
DeveloperState + runtime facts
→ pure Workbench projection
→ ephemeral route/focus/scroll
→ explicit existing effects
→ fresh projection
```

- focused pane만 입력과 scroll을 처리한다.
- contextual footer에는 현재 가능한 action만 표시한다.
- `?`에서 전체 help를 제공한다.
- action 직전에 current ID를 재검증한다.
- Pi가 scoped lifecycle을 제공하기 전에는 raw terminal mouse mode를 켜지 않는다.

## 7. 교차 결론

```text
1. 현재 domain state가 홈이다.
2. command는 홈이 아니라 accelerator다.
3. gate가 생기면 해당 입력 surface가 focus를 소유한다.
4. inspection과 mutation을 분리한다.
5. history는 당시 상태와 provenance를 보여준다.
6. action은 현재 selection과 상태에서 가능한 것만 보인다.
7. navigation state는 domain history와 분리한다.
8. action 이후 fresh projection을 읽고 stale context를 버린다.
9. footer는 전체 기능 목록보다 ambient state와 contextual action을 표시한다.
10. Settings는 secondary surface다.
```

## 8. Developer 정보 구조

```text
Overview
Active Route
Questions
Judgments
Landings
Settings
```

Evidence는 독립 section으로 평탄화하지 않는다. Active Route의 known evidence, Judgment basis/reference basis, Landing artifacts처럼 자신이 지지하는 질문이나 주장에 귀속한다.

Landing은 `target === implementation` Judgment와 해당 Route의 implementation contract를 묶는다. 현재 event schema에는 특정 verification Judgment가 특정 Landing을 검증했다는 link가 없으므로 per-landing `Verified` 상태를 추론하지 않는다. Workbench는 current branch의 verification debt만 표시한다.

## 9. 명령 계약

Developer 0.1.15의 canonical surface:

```text
/developer
/developer status
/developer questions
/developer settings
/developer on
/developer off
pi --developer
```

기존 `/develop`, `--develop`, colon-style 명령은 등록하지 않는다. Persisted `developer/v5` event protocol과 Skill/tool 이름은 command rename과 무관하므로 유지한다.

## 10. 안전과 검증 계약

Workbench open/close, navigation, history inspection은 다음 effect를 만들지 않아야 한다.

```text
appendEntry
sendUserMessage
setActiveTools
filesystem write
model request
```

Question action은 current branch에서 Question ID가 여전히 open인지 재검증한다. Settings Off는 기존 confirmation을 유지한다. Render verification은 최소 `40×18`, `80×22`, `120×36`에서 keyboard navigation, full detail scrolling, help input isolation, 한글/Unicode alignment를 포함한다.
