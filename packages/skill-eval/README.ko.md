# @hobin/skill-eval

[English](./README.md) | 한국어

Agent Skill의 트리거 평가와 결과 평가를 스킬 있음, 없음, 길이를 맞춘 대조군으로 비교하는 Agent Skill입니다.

## Skills

- `evaluating-skills`

Skill은 [Agent Skills 명세](https://agentskills.io/specification)를 따르고, 패키지 루트의
`plugin.json`은 Agent Plugins 1.0.0을 따르며 `hobin-skill-eval`을 선언합니다. 각 Skill 디렉터리는
`references/`, `scripts/`, `assets/`를 포함해 그 자체로 완결됩니다. `agents/openai.yaml`은
Codex용 메타데이터이며 다른 호스트는 무시합니다.

## 사용

`hobin` 마켓플레이스에서 설치한 뒤([설치 안내](https://github.com/dev-hobin/agent/blob/main/docs/installation.md))
명시적으로 호출합니다. Claude Code에서는 `/hobin-skill-eval:evaluating-skills`, Codex에서는 `$hobin-skill-eval:evaluating-skills`입니다.

## 라이선스

MIT
