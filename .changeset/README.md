# Changesets

이 디렉토리에는 [Changesets](https://github.com/changesets/changesets)가 release version과 CHANGELOG를 자동 생성하기 위해 사용하는 파일들이 들어 있습니다.

## 사용

새 PR에서 사용자에게 영향이 있는 변경(public API / CLI / `--json` shape / d.ts 등)을 했다면, 다음을 실행해 changeset 파일을 추가합니다:

```bash
npx changeset
```

대화형 프롬프트가:

1. 영향받는 패키지 선택 (3개 publishable 중 — linked되어 있어 셋이 같은 bump를 받음)
2. bump type 선택 (major / minor / patch — 기준은 [docs/release-policy.md](../docs/release-policy.md))
3. 사용자 노출 변경 요약 (한 줄 markdown)

생성된 `.changeset/<random-name>.md`를 PR에 함께 commit합니다. dev로 머지되면 `changesets/action`이 누적된 changeset을 모아 release PR(`packages/*/package.json` version bump + `packages/*/CHANGELOG.md`)을 자동 생성/갱신합니다. root [CHANGELOG.md](../CHANGELOG.md)는 publish 시점에 수동으로 큐레이트되는 high-level 요약입니다 — 자세한 정책은 [docs/release-policy.md §4](../docs/release-policy.md) 참고.

## 규약

- **3 패키지(linked)**: `@token-weather/cli` / `@token-weather/provider-adapters` / `@token-weather/schemas`는 항상 같은 version으로 release. v0.x 동안은 호환성 단순화 우선. 향후 stable 시 unlink 검토.
- **bump type 기준**: [docs/release-policy.md](../docs/release-policy.md) 참고. 자기 PR이 어디 해당하는지 모르면 PR 본문에 후보를 적고 리뷰에서 결정.
- **chore/docs only PR**: changeset 추가 안 함. CHANGELOG는 사용자 영향이 있는 변경만 기록.
- **base branch**: `dev`. release PR은 dev → main 머지로 이어지는 흐름.
