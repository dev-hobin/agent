# Observer Terminal Workbench UX 연구와 적용 설계

> 상태: 구현 전 UX 기준선
>
> 목적: Observer를 설정 중심 control center에서 inspectable inquiry workbench로 전환하기 위한 공개 구현 사례 연구와 적용 계약
>
> 조사 시점: 2026-07-30

## 1. 조사 질문

Observer는 조용히 동작해야 하지만 불투명해서는 안 된다. 사용자가 `/observer`를 열었을 때 다음 질문에 답할 수 있어야 한다.

1. 무엇을 Source로 읽었는가?
2. 어떤 Observation이 생겼는가?
3. Inquiry와 Memo가 어떻게 움직였는가?
4. 무엇을 Markdown으로 제안하려 하는가?
5. 무엇이 실제 Notebook에 저장되어 있는가?

비교 대상은 저장소 전체가 아니라 다음 네 개의 사용자 흐름으로 한정했다.

| 프로젝트 | 조사 slice | Observer와의 대응 |
| --- | --- | --- |
| Lazygit | file → diff → stage → commit, popup, focused scrolling | working set → proposal → Save |
| K9s | resource table → details → action, history, breadcrumbs | standing inquiry overview → detail → contextual action |
| Posting | collection → unsaved request editor → response → explicit save | working state → inspectable draft → durable file |
| Textual | screen stack, modal input boundary, scrollable container | workbench route, modal, focused internal scrolling |

조사 revision:

- Lazygit `df0943ad334d1d3626b42057aad4b69324da3516`
- K9s `436ea2e9f23c5dd2d8e05c3e974220657524ef17`
- Posting `56703a11513e8e74e681b4f859f31945b71e746f`
- Textual `06dbeef4bb70fb718236aa418ed658ef4667a126`

## 2. 결론

> 좋은 terminal workbench는 명령을 홈 화면으로 삼지 않는다. 현재 domain object를 먼저 보여주고, 선택한 object의 detail과 가능한 action을 같은 context에 붙인다.

Observer의 홈은 On/Off와 Processing 설정 목록이 아니라 **현재 탐구 상태**여야 한다.

```text
Observe quietly
→ inspect working state at any time
→ reconcile provisional meaning
→ freeze and validate a publication proposal
→ explicitly publish durable Markdown
```

핵심 규칙은 다음과 같다.

1. **Domain object first**: Source, Observation, Inquiry, Memo, Proposal, Notebook record를 먼저 보여준다.
2. **Selection drives detail**: 현재 선택이 오른쪽 또는 다음 화면의 detail을 결정한다.
3. **Actions are contextual**: Review, Save, retry, discard는 관련 상태에서만 나타난다.
4. **Navigation has memory**: detail을 닫으면 이전 section과 selection으로 돌아간다.
5. **Draft and persistence are distinct**: working state와 exact Markdown, 실제 저장 파일을 시각적으로 구분한다.
6. **Focused region owns scroll**: 열린 detail/modal의 키보드 스크롤은 그 region 안에서만 움직인다.
7. **Destructive actions are explicit**: inspect와 write는 같은 Enter 동작이 아니다.
8. **Mouse is enhancement**: 키보드만으로 완전해야 하며 mouse capture는 framework가 안전하게 scope할 때만 제공한다.

## 3. Lazygit에서 확인한 것

### 3.1 View, context, controller를 분리한다

Lazygit은 view가 buffer를 렌더하고, context가 view별 상태와 입력을 소유하며, controller가 keybinding과 handler를 연결한다. 한 controller를 여러 context에 붙일 수 있고 list navigation 같은 공통 행동을 재사용한다.

이 구조의 중요한 점은 **표시 데이터, 현재 focus/selection, 가능한 행동을 한 구조체에 섞지 않는 것**이다.

근거:

- [Codebase Guide: context/controller/helper 경계](https://github.com/jesseduffield/lazygit/blob/df0943ad334d1d3626b42057aad4b69324da3516/docs/dev/Codebase_Guide.md#L26-L40)
- [Codebase Guide: view/context/controller 정의와 dependency 방향](https://github.com/jesseduffield/lazygit/blob/df0943ad334d1d3626b42057aad4b69324da3516/docs/dev/Codebase_Guide.md#L65-L80)

Observer 적용:

```text
Observer domain snapshot
→ WorkbenchProjection (표시 가능한 item/detail/action)
→ WorkbenchSurface (route/focus/scroll)
→ WorkbenchEffects (Memo/Review/Save/Settings)
```

현재 `ObserverControlSurface`처럼 SettingsList가 domain 상태와 action을 동시에 대표하게 두지 않는다.

### 3.2 목록 선택이 detail을 바꾸고, mutation 전에 diff를 본다

Lazygit staging flow는 file을 열어 diff context로 들어가고, line/range를 선택한 다음 stage한다. integration demo도 `Files → Enter → Staging → range select → primary action → Escape → Commit` 순서를 고정한다.

근거:

- [staging keybindings: stage/discard/open/return/commit](https://github.com/jesseduffield/lazygit/blob/df0943ad334d1d3626b42057aad4b69324da3516/pkg/gui/controllers/staging_controller.go#L41-L112)
- [stage-lines integration flow](https://github.com/jesseduffield/lazygit/blob/df0943ad334d1d3626b42057aad4b69324da3516/pkg/integration/tests/demo/stage_lines.go#L53-L81)

Observer가 가져올 것은 partial Save가 아니다. Observer record graph는 batch invariant가 있으므로 Save는 계속 all-or-nothing이다. 가져올 것은 다음 흐름이다.

```text
working item 선택
→ source/meaning detail 확인
→ proposal record 선택
→ diff/final/existing 확인
→ 별도 Save action
```

### 3.3 stale detail에 두 번째 action이 적용되지 않게 한다

Lazygit은 patch를 적용한 뒤 staging view refresh가 끝날 때까지 input을 block한다. 빠른 두 번째 keypress가 refresh 전의 stale diff에 적용되는 것을 막기 위해서다.

근거: [applySelectionAndRefresh의 blocking refresh](https://github.com/jesseduffield/lazygit/blob/df0943ad334d1d3626b42057aad4b69324da3516/pkg/gui/controllers/staging_controller.go#L227-L236)

Observer 적용:

- Workbench action 직전에 current branch/proposal identity를 재검증한다.
- action 처리 중에는 해당 action을 disabled/busy로 표시한다.
- 완료 후 새 projection을 받아 selection을 유효한 item으로 clamp한다.
- 이전 detail에 대한 빠른 Enter를 새 상태의 첫 item에 재사용하지 않는다.

### 3.4 destructive action은 context와 confirmation을 가진다

Unstaged change discard는 warning을 생략하도록 사용자가 명시적으로 설정하지 않은 한 confirmation을 거친다.

근거: [DiscardSelection confirmation](https://github.com/jesseduffield/lazygit/blob/df0943ad334d1d3626b42057aad4b69324da3516/pkg/gui/controllers/staging_controller.go#L213-L224)

Observer 적용:

- `Return to Review`는 proposal identity와 보존되는 working state를 설명한다.
- `Save all N records`는 create/update 수와 Notebook root를 표시한다.
- 초기 Enter는 inspect만 수행하며 write action을 실행하지 않는다.

### 3.5 scroll은 view별로 소유하지만 mouse capture에는 비용이 있다

Lazygit은 main, secondary, confirmation view에 각각 wheel handler를 바인딩한다. confirmation도 Up/Down, PageUp/PageDown, mouse wheel을 그 view 안에서 처리한다.

근거: [view별 scroll bindings](https://github.com/jesseduffield/lazygit/blob/df0943ad334d1d3626b42057aad4b69324da3516/pkg/gui/keybindings.go#L179-L230)

동시에 설정 문서는 mouse event capture가 terminal text selection을 더 어렵게 만든다고 명시한다.

근거: [mouseEvents tradeoff](https://github.com/jesseduffield/lazygit/blob/df0943ad334d1d3626b42057aad4b69324da3516/docs/Config.md#L73-L76)

Observer 적용:

- Up/Down, `j/k`, PageUp/PageDown, Home/End를 focused detail 내부에 제공한다.
- Pi TUI가 scoped mouse API를 제공하기 전에는 extension이 raw terminal mouse mode를 켜지 않는다.
- 향후 mouse가 추가되면 global capture가 아니라 focused overlay/region binding이어야 한다.

## 4. K9s에서 확인한 것

### 4.1 현재 상태가 홈이고 명령은 그 위의 accelerator다

K9s의 기본 경험은 live resource table이다. `:` command, `/` filter, alias는 현재 resource view를 더 빨리 찾거나 좁히는 수단이지 홈 화면 자체가 아니다. `Esc`는 이전 view로 돌아가고 breadcrumb/history를 유지한다.

근거: [K9s navigation, filter, history, details actions](https://github.com/derailed/k9s/blob/436ea2e9f23c5dd2d8e05c3e974220657524ef17/README.md#L378-L431)

Observer 적용:

- `/observer`는 current Episode workbench를 연다.
- slash subcommand는 그대로 유지하지만 accelerator/automation surface로 취급한다.
- Workbench route는 `Overview → Activity/Memos/Inquiries/Proposal/Notebook → Detail` history를 가진다.
- `Esc`는 detail → section → Pi 순으로 한 단계씩 돌아간다.

### 4.2 list와 details가 다른 책임을 가진다

K9s details viewer는 Back, Save, Copy, FullScreen, next/previous match, filter mode를 context-specific action으로 제공한다. filter 상태와 match position은 title에 표시된다.

근거:

- [Details key actions](https://github.com/derailed/k9s/blob/436ea2e9f23c5dd2d8e05c3e974220657524ef17/internal/view/details.go#L137-L153)
- [Details title에 search/match 상태 표시](https://github.com/derailed/k9s/blob/436ea2e9f23c5dd2d8e05c3e974220657524ef17/internal/view/details.go#L319-L338)

Observer 적용:

- footer는 전역 명령 나열이 아니라 현재 section/detail에서 가능한 action만 표시한다.
- detail title은 `Observation 3/7`, `Memo 2/4`, `Proposal record 1/5`처럼 위치를 표시한다.
- 긴 Source/Markdown은 full-screen detail로 확대할 수 있어야 한다.

### 4.3 history와 recovery는 UI state의 일부다

K9s는 component injection 뒤 command history를 push하고, panic recovery 시 현재 command를 기준으로 안전한 view를 다시 구성한다.

근거: [Command exec와 history/recovery](https://github.com/derailed/k9s/blob/436ea2e9f23c5dd2d8e05c3e974220657524ef17/internal/view/command.go#L352-L386)

Observer 적용:

- Workbench의 navigation route는 Notebook/session domain state와 분리된 ephemeral UI state다.
- projection refresh에 실패해도 이전 branch를 변경하지 않고 health/recovery item으로 돌아간다.
- persisted Episode history를 UI route history로 오해하지 않는다.

### 4.4 위험한 action은 item selection과 확인을 요구한다

K9s delete는 선택된 resource들을 dialog에 넘기고 confirmation 이후에만 delete/refresh한다. README도 delete를 `TAB and ENTER to confirm`으로 설명한다.

근거:

- [Delete interaction contract](https://github.com/derailed/k9s/blob/436ea2e9f23c5dd2d8e05c3e974220657524ef17/README.md#L403-L404)
- [resourceDelete dialog boundary](https://github.com/derailed/k9s/blob/436ea2e9f23c5dd2d8e05c3e974220657524ef17/internal/view/browser.go#L759-L782)

Observer 적용: proposal inspect와 batch authorization을 같은 keypress로 합치지 않는다.

### 4.5 mouse는 기본 전제가 아니다

K9s의 mouse support는 opt-in이며 기본값은 false다.

근거: [enableMouse default false](https://github.com/derailed/k9s/blob/436ea2e9f23c5dd2d8e05c3e974220657524ef17/README.md#L501-L510)

Observer도 keyboard-complete를 기본 계약으로 유지한다.

## 5. Posting에서 확인한 것

### 5.1 persistent collection, editable draft, response를 동시에 보인다

Posting의 main screen은 collection browser, request editor, response area를 나란히 구성한다. 사용자는 저장된 request를 고르고, 현재 UI draft를 수정하고, 실행 결과를 같은 workbench에서 본다.

근거:

- [MainScreen composition](https://github.com/darrenburns/posting/blob/56703a11513e8e74e681b4f859f31945b71e746f/src/posting/app.py#L255-L269)
- [Collection browser에서 선택한 request를 main body에 연다](https://github.com/darrenburns/posting/blob/56703a11513e8e74e681b4f859f31945b71e746f/docs/guide/collections.md#L10-L24)

Observer 적용:

```text
Notebook records        Working inquiry state       Proposal/detail
(saved)                 (session)                   (derived/validated)
```

세 영역은 lifecycle이 다르므로 색과 label로 구분한다.

- `Saved`: Notebook Markdown
- `Working`: 아직 publication되지 않은 session state
- `Proposed`: exact Markdown이 준비되었지만 미승인

### 5.2 현재 UI state는 저장 전에도 완전한 inspectable value다

Posting은 현재 UI에서 `RequestModel`을 다시 만들며, command palette의 YAML export는 **unsaved UI state**를 반영한다. Save는 별도 `Ctrl+S` action이다.

근거:

- [Copy current request YAML reflecting unsaved UI state](https://github.com/darrenburns/posting/blob/56703a11513e8e74e681b4f859f31945b71e746f/src/posting/commands.py#L66-L72)
- [Save action이 현재 UI model을 만들고 명시적 path에 기록](https://github.com/darrenburns/posting/blob/56703a11513e8e74e681b4f859f31945b71e746f/src/posting/app.py#L712-L745)
- [Request file format과 explicit save](https://github.com/darrenburns/posting/blob/56703a11513e8e74e681b4f859f31945b71e746f/docs/guide/requests.md#L1-L3)

Observer 적용:

- exact Markdown이 아직 없더라도 working Source/Observation/Memo/Inquiry는 완전한 inspectable domain value로 보여준다.
- `Preparing` 상태에서는 모델의 부분 출력을 draft처럼 노출하지 않는다. 대신 locked scope, 현재 stage, wait reason을 보여준다.
- atomic proposal이 검증된 순간부터 exact Markdown을 보여준다.

### 5.3 navigation은 여러 경로를 제공하지만 footer는 최소화해야 한다

Posting은 Tab/Shift-Tab, `j/k`, arrows, jump mode, mouse, fuzzy request search, focused-widget F1 help를 제공한다.

근거: [Posting navigation](https://github.com/darrenburns/posting/blob/56703a11513e8e74e681b4f859f31945b71e746f/docs/guide/navigation.md#L1-L57)

그러나 Posting roadmap은 footer에 binding이 너무 많고 scroll 가능성조차 불명확한 점, unsaved change warning과 status bar가 아직 부족한 점을 UX 개선 대상으로 기록한다.

근거: [Posting UX gaps](https://github.com/darrenburns/posting/blob/56703a11513e8e74e681b4f859f31945b71e746f/docs/roadmap.md#L50-L80)

Observer 적용:

- footer에는 4–6개의 현재 context action만 표시한다.
- `?`는 focused region의 전체 도움말을 연다.
- working/proposed/saved 상태는 title 또는 badge에서 항상 식별 가능해야 한다.
- 많은 단축키를 footer 한 줄에 모두 넣지 않는다.

## 6. Textual에서 확인한 것

### 6.1 screen stack은 navigation state를 명시적으로 만든다

Textual은 여러 screen 중 top screen 하나만 active하게 하고, push/pop으로 이전 context에 돌아간다. modal은 아래 app binding을 차단하고 아래 화면을 dim 처리한다.

근거:

- [Textual Screens: screen stack](https://textual.textualize.io/guide/screens/#screen-stack)
- [Textual Screens: modal screens](https://textual.textualize.io/guide/screens/#modal-screens)
- [ModalScreen implementation](https://github.com/Textualize/textual/blob/06dbeef4bb70fb718236aa418ed658ef4667a126/src/textual/screen.py#L2158-L2182)

Observer 적용:

```text
Workbench
  push Detail
    push Help or Confirm
  pop  Detail
pop Workbench → Pi
```

Pi TUI는 Textual screen stack을 제공하지 않으므로 `WorkbenchRoute[]`로 같은 의미를 로컬 state에 명시한다.

### 6.2 scroll은 focusable container의 기능이다

Textual `ScrollableContainer`는 focusable이고 `overflow: auto`를 가지며 arrows, Home/End, PageUp/PageDown을 자체 binding으로 제공한다.

근거: [ScrollableContainer implementation](https://github.com/Textualize/textual/blob/06dbeef4bb70fb718236aa418ed658ef4667a126/src/textual/containers.py#L32-L74)

Textual Widget은 wheel event를 현재 scrollable widget에서 처리하고, 실제로 scroll했을 때 event propagation을 중지한다.

근거: [Widget mouse scroll handling](https://github.com/Textualize/textual/blob/06dbeef4bb70fb718236aa418ed658ef4667a126/src/textual/widget.py#L4777-L4805)

Observer 적용:

- scroll offset은 전역 하나가 아니라 route/focused pane별로 보존한다.
- detail을 닫았다 다시 열 때 같은 item이면 offset을 복구할 수 있다.
- modal이 열리면 underlying workbench keybinding을 실행하지 않는다.

## 7. 그대로 복사하지 않을 것

| 사례 | 이유 | Observer 결정 |
| --- | --- | --- |
| Lazygit의 partial staging | Observer final graph는 record 간 관계 invariant를 가진다 | inspect는 record별, Save는 batch 전체 |
| K9s의 많은 mnemonic | Observer는 상시 실행 full app가 아니라 Pi 안의 extension이다 | 기본키 + contextual footer + `?` 도움말 |
| Posting의 editable workbench 전체 | v0.1은 model-owned working semantics와 user-owned approval 경계를 먼저 안정화해야 한다 | 우선 read-only inspection, edit는 후속 결정 |
| Textual식 mouse/scroll widget | Pi TUI에는 scoped wheel API가 없다 | keyboard-complete, raw mouse mode 금지 |
| 모든 상태의 modal 표시 | modal은 사용자의 현재 task를 차단한다 | confirmation/help만 modal, browsing은 workbench route |

## 8. Observer Workbench 정보 구조

### 8.1 홈 화면

Wide terminal:

```text
╭ Observer · ON · Episode OPEN · Piggyback ─────────────────────────────╮
│ Sections                 │ Current state                              │
│ > Overview               │ Since last check                          │
│   Activity        7      │  3 SourceReads · 4 Observations           │
│   Inquiries       2      │  1 challenged · 1 insufficient-context    │
│   Memos           3      │                                           │
│   Proposal        Ready  │ Publication                               │
│   Notebook        14     │  Ready · 2 create · 1 update              │
│   Settings               │  Notebook: ~/notes/observer               │
│                          │                                           │
│                          │ Next: inspect proposal                     │
├──────────────────────────┴───────────────────────────────────────────┤
│ ↑↓/jk move · Enter inspect · Tab focus · ? help · Esc close          │
╰──────────────────────────────────────────────────────────────────────╯
```

Narrow terminal:

```text
╭ Observer · ON · OPEN ───────────────╮
│ > Overview                          │
│   Activity                       7  │
│   Inquiries                      2  │
│   Memos                          3  │
│   Proposal                   Ready  │
│   Notebook                      14  │
│   Settings                          │
├─────────────────────────────────────┤
│ ↑↓/jk move · Enter open · Esc close │
╰─────────────────────────────────────╯
```

Enter는 같은 전체 surface에서 detail route를 push한다. terminal width가 충분하면 list/detail을 함께 보이고, 좁으면 detail이 목록을 대체한다.

### 8.2 Sections

#### Overview

- Mode, Episode, processing policy
- Since last check 요약
- pending/recovery 상태
- proposal readiness
- 가장 자연스러운 next action

#### Activity

시간순으로 다음 item을 한 목록에 표시한다.

```text
SourceRead · title · candidate count
Observation · stance/movement · related inquiries
Hypothesis · original/current review state
Context review · supports/challenges/mixed/insufficient
```

SourceRead detail:

- Source kind/title/URI 또는 direct observation 조건
- faithful summary
- claims와 locators
- candidate ancestry

Observation detail:

- stance, movement, visibility
- rationale
- related Inquiry
- SourceRead link
- 새 Observer hypothesis 여부

#### Inquiries

- origin, original, current
- supporting/challenging evidence
- missing information
- revision reason
- related working Memos

#### Memos

- title, disposition
- full current content
- evidence IDs
- promotion readiness

#### Proposal

```text
Not requested
Needs reconciliation
Preparing(scope/stage/wait reason)
Ready(proposal ID, records, create/update)
Invalidated(reason)
```

Ready일 때 기존 Save proposal viewer의 record list와 diff/final/existing renderer를 재사용한다. `Back`은 Workbench Proposal section으로 돌아온다. `Return to Review`와 `Save all N records`만 state-changing action이다.

#### Notebook

- selected canonical root
- existing `records/*.md`
- type/title/status/path
- read-only exact Markdown detail
- latest Save receipt가 있으면 recently written 표시

#### Settings

- Observer On/Off
- Piggyback/Off/Local background
- default output language
- Notebook setup/change 가능 여부

Settings는 home이 아니라 하나의 section이다.

## 9. UI 상태 정의

```ts
type WorkbenchSection =
  | "overview"
  | "activity"
  | "inquiries"
  | "memos"
  | "proposal"
  | "notebook"
  | "settings";

type WorkbenchRoute =
  | { kind: "section"; section: WorkbenchSection; selected: number }
  | { kind: "detail"; section: WorkbenchSection; itemId: string; scroll: number }
  | { kind: "help"; parent: WorkbenchRoute }
  | { kind: "confirm"; parent: WorkbenchRoute; action: WorkbenchAction };

type ProposalInspectionState =
  | { kind: "not-requested" }
  | { kind: "needs-reconciliation"; observationCount: number }
  | { kind: "preparing"; requestId: string; stage: string; waitReason: string }
  | { kind: "ready"; proposalId: string; records: ProposalRecord[] }
  | { kind: "invalid"; reason: string };
```

금지 상태:

- `ready`인데 exact record Markdown이 없음
- `preparing`인데 model partial output을 exact proposal로 표시
- `confirm` 뒤에서 workbench action이 동시에 입력을 받음
- route가 가리키는 item이 refresh 후 사라졌는데 stale action 실행
- `saved`와 `working`을 같은 label/color로 표시

## 10. Projection boundary

현재 replay snapshot은 충분한 source data를 이미 가진다.

- `ObservationSessionSnapshot`: candidates, SourceReads, semantic Observations, user hypotheses, context reviews
- `MemoSessionSnapshot`: working Memos와 hypotheses
- `ObserverPiSnapshot`: Episode와 prepared Save
- Notebook inventory: durable Markdown

UI는 session entry를 직접 해석하지 않는다.

```ts
projectObserverWorkbench({
  lifecycle,
  observations,
  memo,
  materialReview,
  notebookInventory,
  processing,
  operationalIssue,
}): ObserverWorkbenchView
```

`ObserverWorkbenchView`만 다음을 제공한다.

```ts
interface ObserverWorkbenchView {
  header: WorkbenchHeader;
  overview: WorkbenchOverview;
  activity: readonly WorkbenchActivityItem[];
  inquiries: readonly WorkbenchInquiryItem[];
  memos: readonly WorkbenchMemoItem[];
  proposal: ProposalInspectionState;
  notebook: readonly WorkbenchNotebookItem[];
  settings: WorkbenchSettings;
  actions: readonly WorkbenchAction[];
}
```

## 11. Wished interfaces

| Interface | Contract | Owner | 숨길 것 | Stop check |
| --- | --- | --- | --- | --- |
| `projectObserverWorkbench` | current branch와 Notebook을 read-only view로 투영 | domain projection | replay entry ordering과 profile decoding | 같은 branch에서 deterministic output |
| `ObserverWorkbenchSurface` | route/focus/selection/scroll을 관리하고 action intent만 반환 | TUI | lifecycle mutation과 filesystem | 모든 width/height에서 overflow 없음 |
| `workbenchActions(view, route)` | 현재 상태에서 legal action만 제공 | action policy | controller command strings | forbidden Save/Review가 footer에 없음 |
| `openWorkbenchDetail(item)` | 선택한 domain item의 complete inspectable detail 제공 | projection/detail renderer | raw session entry | count-only item이 없음 |
| `inspectProposal` | ready proposal의 path/diff/final/existing 표시 | proposal viewer | write authorization | 초기 Enter로 write 불가 |
| `inspectNotebookRecord` | existing Markdown을 read-only로 표시 | Notebook viewer | publication mutation | file byte와 화면 Markdown 일치 |
| `applyWorkbenchAction` | current identity 재검증 후 effect 실행, refresh projection | orchestration | controller internals | stale action은 append/write 없이 거부 |

## 12. Interaction traces

### 12.1 작업 중 확인

```text
/observer
→ Overview
→ Activity (7)
→ SourceRead 선택
→ faithful summary/claims/source 확인
→ Esc
→ Observation 선택
→ stance/movement/rationale 확인
→ Esc → Overview → Esc → Pi
```

### 12.2 proposal 준비 중

```text
Review 요청
→ Workbench Proposal: Preparing
→ locked scope와 wait reason 확인
→ Pi로 돌아가 일반 turn 계속
→ atomic commit 성공
→ widget: Proposal ready
→ /observer → Proposal Ready → record inspect
```

### 12.3 Save

```text
Proposal record 목록
→ update 선택
→ Diff → Final Markdown → Existing 전환
→ Back: proposal 유지
→ 다시 열기
→ Save all N records 선택
→ Notebook root/create/update 요약 confirmation
→ branch/target 재검증
→ write/readback/receipt
→ Workbench Notebook: recently written
```

### 12.4 stale action

```text
Proposal detail open
→ 외부 변화 또는 branch change
→ Save 선택
→ current identity mismatch
→ write 없음
→ Proposal Invalidated + reason
→ Return to Review 안내
```

## 13. 검증 기준

| Case | 기대 결과 |
| --- | --- |
| Observation 7개 | 목록에서 7개 모두 열고 rationale/Source link 확인 가능 |
| proposal 없음 | `Not requested`; Save action 없음 |
| Review pending | scope/stage/wait reason 표시; partial Markdown 없음 |
| proposal ready | 모든 target path와 exact Markdown inspect 가능 |
| 기존 Notebook 100 records | bounded list/detail scroll, 전체 파일을 한 번에 render하지 않음 |
| narrow 40×18 | list 또는 detail 한 pane만, footer 항상 보임 |
| wide 120×36 | list/detail 동시 표시 |
| detail scroll | terminal history가 아니라 detail offset 변경 |
| modal open | underlying shortcut 비활성 |
| stale proposal | write/append 없이 invalidated 표시 |
| initial Enter | inspect만 수행, Save 승인 불가 |
| Pi mouse API 없음 | keyboard로 모든 flow 완료 가능 |

## 14. 구현 순서

1. `ObserverWorkbenchView` projection과 fixture tests를 만든다.
2. read-only `Overview / Activity / Inquiries / Memos / Proposal / Notebook` surface를 새 모듈에 만든다.
3. 기존 `/observer`의 기본 surface를 Workbench로 바꾸고 SettingsList를 Settings section 뒤에 보존한다.
4. prepared proposal renderer와 Notebook Markdown renderer를 Workbench detail route에 연결한다.
5. Memo/Review/Save/retry 같은 action을 contextual footer와 action menu로 이동한다.
6. stale identity, busy refresh, route restoration tests를 추가한다.
7. mouse wheel은 Pi TUI가 scoped mouse input lifecycle을 제공할 때 별도 구현한다.

## 15. 최종 제품 문장

> Observer는 Pi 작업을 조용히 감시하는 숨은 자동화가 아니라, Source에서 시작한 관찰과 가설의 이동을 언제든 검사할 수 있게 유지하고, 사용자가 검토한 결과만 로컬 Markdown으로 출판하는 terminal inquiry workbench다.
