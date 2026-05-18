---
'@token-weather/cli': minor
'@token-weather/provider-adapters': minor
'@token-weather/schemas': minor
'@token-weather/telegram': minor
---

feat(telegram): OS service installer 의 경로 escaping helper — 공백 / XML 특수문자
포함 경로도 자동 등록 가능 (issue #141).

PR #140 (issue #138) 의 review 2 round 에서 분리된 follow-up. 기존에는
`hasUnsafePathChars(p)` (`/[\s<>&"'`]/`) 사전 검사로 공백 / 특수문자 포함 경로를
skip + manual fallback 했는데, **Windows 표준 Node 설치 환경**
(`C:\Program Files\nodejs\node.exe`) 에서 자동 등록이 거의 항상 차단되어
`telegram setup` 의 [Y/n] 동의 옵션이 무의미했음. 본 release 로 OS 별 정확한
escape 적용 후 자동 등록 통과 → success rate 확장.

**변경 사항**:

- `@token-weather/telegram` 새 helper `os-service-path-escape.js` (public export):
  - `escapeSystemdArg(value)` — systemd unit `ExecStart=` 의 double-quote escape.
    systemd 는 direct exec 라 `$VAR` / `` `cmd` `` expansion 없음 → `"` 와 `\` 만
    escape.
  - `escapePlistXml(text)` — launchd plist `<string>` element content 의 XML
    entity escape (`& < >` 만).
  - `escapeSchtasksArg(value)` — Windows schtasks `/TR` 의 cmd `\"...\"` 형태
    (outer `"..."` 안에서 escape 된 quote 로 해석).
- `os-service-templates.js` 3 template 모두 위 helper 호출. 공백 / XML 특수문자
  포함 경로도 정확히 quoted.
- `os-service-installer.js` 의 `hasUnsafePathChars` 사전 검사 + skip 분기 제거.
  다른 skip 사유 (HOME 누락 / systemctl 미감지 / schtasks 미감지 / linger 부재
  등) 는 그대로.

**Non-goal**:

- `ExecStart=` 의 args 를 path 와 분리해 systemd 의 `${arg1} ${arg2}` semantics
  로 전달 — 본 release 는 escape 만, semantics 분리는 별도 issue.
- Windows PowerShell 기반 자동 등록 대안 (schtasks 외) — 별도 issue.
- CLI 평문 / `--json` contract 변경 없음.
