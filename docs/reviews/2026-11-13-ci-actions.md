# GitHub Actions runtime review

GitHub's [baseline CI run](https://github.com/kk-ai-lab/tesla-wrap-workshop/actions/runs/43400080031) passed but warned that checkout and setup-node v4 target deprecated Node 20. [PR 27](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/27) updated both actions to v7 in the CI and weekly template-link workflows. The project remains on Node 22 with explicit npm caching and `contents: read` permissions.

The official [checkout v7](https://github.com/actions/checkout/blob/v7/action.yml) and [setup-node v7](https://github.com/actions/setup-node/blob/v7/action.yml) manifests specify Node 24 for their own runtime. Their major-version changes were compared with the repository's triggers and inputs. Neither workflow uses `pull_request_target`, `workflow_run`, a registry URL, or the removed `always-auth` input.

Independent review of head `02f6b712e05a4a84c5e091f30cec23b5eb3d7998` returned [PASS with runner notes](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/27#issuecomment-6849264124). The reviewer confirmed:

- Both local action-validator checks passed under Node 22.
- [PR CI](https://github.com/kk-ai-lab/tesla-wrap-workshop/actions/runs/43401462362) passed on the exact source tree, including 142 unit tests and four browser tests.
- The [manually dispatched template-link workflow](https://github.com/kk-ai-lab/tesla-wrap-workshop/actions/runs/43401481267) passed on the exact head. It checked all 12 live template links and the unchanged Tesla source revision.
- Both GitHub-hosted jobs ran checkout and setup-node v7, installed Node 22.23.4, and restored the npm cache. Neither emitted the old Node 20 action-runtime warning.

The reviewer confirmed runner version 2.338.2 in those runs. This evidence does not cover older self-hosted runners. The runs still reported an Ubuntu image migration notice and the existing ESLint 9 support warning; [issue 29](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/29) tracks the latter.
