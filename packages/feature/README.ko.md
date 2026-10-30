# @hobin/feature

[English](./README.md) | 한국어

인수 시나리오, 소유자 결정, 설계, 작은 검증 단위, 독립 검증 순서로 기능을 개발하는 Agent Skill입니다.

## Skills

- `developing-features`

Skill은 [Agent Skills 명세](https://agentskills.io/specification)를 따르고, 패키지 루트의
`plugin.json`은 Agent Plugins 1.0.0을 따르며 `hobin-feature`을 선언합니다. 각 Skill 디렉터리는
`references/`, `scripts/`, `assets/`를 포함해 그 자체로 완결됩니다. `agents/openai.yaml`은
Codex용 메타데이터이며 다른 호스트는 무시합니다.

## 사용

`hobin` 마켓플레이스에서 설치한 뒤([설치 안내](https://github.com/dev-hobin/agent/blob/main/docs/installation.md))
명시적으로 호출합니다. Claude Code에서는 `/hobin-feature:developing-features`, Codex에서는 `$hobin-feature:developing-features`입니다.

## 라이선스

MIT
