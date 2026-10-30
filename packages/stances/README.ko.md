# @hobin/stances

[English](./README.md) | 한국어

짧은 엔지니어링 입장을 에이전트 지침에 반영하고, 반복해서 어기는 관례를 자동 검사로 올리는 Agent Skill입니다.

## Skills

- `applying-stances`
- `enforcing-conventions`

Skill은 [Agent Skills 명세](https://agentskills.io/specification)를 따르고, 패키지 루트의
`plugin.json`은 Agent Plugins 1.0.0을 따르며 `hobin-stances`을 선언합니다. 각 Skill 디렉터리는
`references/`, `scripts/`, `assets/`를 포함해 그 자체로 완결됩니다. `agents/openai.yaml`은
Codex용 메타데이터이며 다른 호스트는 무시합니다.

## 사용

`hobin` 마켓플레이스에서 설치한 뒤([설치 안내](https://github.com/dev-hobin/agent/blob/main/docs/installation.md))
명시적으로 호출합니다. Claude Code에서는 `/hobin-stances:applying-stances`, Codex에서는 `$hobin-stances:applying-stances`입니다.

## 라이선스

MIT
