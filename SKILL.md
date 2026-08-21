---
name: appium-test-generation
description: Generates and modifies automated tests for the Appium server monorepo while following its Node.js, TypeScript, package-local unit, E2E, and type-test conventions. Use when adding test coverage, implementing a regression test, translating a requirement into an Appium test, or changing test fixtures and test-only helpers.
---

# Automation Test Generation Skill

## Purpose

Use this skill to create tests for this repository's Appium server, driver, plugin, and support packages.
This is not a client application test suite: do not assume page objects, screen objects, business-flow
classes, login helpers, database fixtures, or real-device application scenarios exist. [E1]

Apply the governing sequence:

**SEARCH → UNDERSTAND → REUSE → EXTEND → CREATE**

Creating a helper, fixture abstraction, client wrapper, or framework component is the last option.

## When to Use This Skill

Use this skill when asked to:

- add or update a unit, E2E, protocol, plugin, driver, CLI, or type-level test;
- reproduce a defect with a regression test;
- add test fixtures or test-only setup needed by such a test;
- review generated tests for repository compliance.

Do not use it to generate page-object-based tests for an external mobile application. Ask for the
client test repository when the requirement concerns an application's screens or business journeys.

## Framework Principles

1. Put tests in the package that owns the behavior, under `packages/<package>/test/`. Mirror the
   source area below `test/unit/` when practical. Put integration scenarios under `test/e2e/`. [E2]
2. Name unit files `<subject>.spec.ts` and E2E files `<subject>.e2e.spec.ts`. Type contract tests use
   the owning package's existing `test-d` or `test/types` pattern. [E2] [E3]
3. Use named APIs from `node:test` and default `assert` from `node:assert/strict`. Do not introduce
   Mocha, Chai, Jest, or another runner/assertion library. [E4]
4. Treat tests as TypeScript source compiled into `build/test/**`; package scripts execute the
   compiled JavaScript with `node --test`. [E5]
5. Prefer package-local helpers and the shared test-support packages over inline infrastructure. [E6]
6. Keep a test at the lowest layer that proves the requirement: unit before in-process protocol E2E,
   and in-process E2E before a full Appium/plugin subprocess unless the boundary itself is under test.
   [E7]
7. Preserve isolation. Allocate ports, use temporary directories or isolated `APPIUM_HOME`, reset
   mocks/global state, and close sessions and servers. [E8]

## Mandatory Pre-Generation Analysis

Before editing:

1. Restate the observable behavior, expected result, negative cases, and boundary under test.
2. Identify the owning package and relevant source symbols.
3. Read the owning package's `package.json`, `tsconfig.json`, and the source implementation.
4. Search the same package for tests of the symbol, adjacent behavior, and shared fixtures/helpers.
5. Read at least:
   - the closest same-layer test;
   - one test with comparable setup and cleanup;
   - the helper or harness being considered;
   - the owning package's test scripts.
6. Classify the requested test:
   - pure/unit logic;
   - driver behavior through WebDriverIO;
   - raw HTTP/WebDriver protocol behavior;
   - plugin integration;
   - CLI/subprocess behavior;
   - filesystem/environment integration;
   - type contract.
7. List intended reuse, required fixture data, lifecycle resources, and validation commands.
8. Check whether the chosen pattern is current, area-specific, or legacy.

Do not generate code until these questions are answered from repository evidence.

## Repository Search Strategy

Search in this order:

1. When `.codegraph/` exists and CodeGraph is available, use the configured CodeGraph exploration
   integration to locate symbols and call paths before broad text search. Fall back to repository
   text search when the integration is unavailable. [E28]
2. Search the exact source symbol and command/route name.
3. Search existing tests in the owning package.
4. Search the same concern in sibling packages.
5. Inspect package-local `test/helpers.ts`, `test/mocks.ts`, and `test/fixtures/`.
6. Inspect `@appium/driver-test-support`, `@appium/plugin-test-support`, and `@appium/support`.
7. Inspect FakeDriver tests for canonical driver/session behavior.
8. Inspect Appium package tests for full-server, extension, config, and CLI behavior.

Search implementations and call sites, not filenames alone. Verify helper signatures before using them.
Never invent an import, command, route, capability, fixture, or harness API.

## Similar-Test Selection Strategy

Rank candidates by:

1. same package and source symbol;
2. same test layer and execution boundary;
3. same lifecycle needs;
4. same module system and mocking mechanism;
5. same client type;
6. recency and prevalence.

Use one primary exemplar and one lifecycle exemplar. Do not combine unrelated patterns merely because
they appear elsewhere in the monorepo.

For client selection:

- Use WebDriverIO for externally observable driver, element, command, and session behavior. [E9]
- Use Axios for HTTP status, headers, routing, protocol payloads, and transport semantics. [E10]
- Use `teen_process` and existing Appium E2E helpers for CLI/subprocess behavior. [E11]
- Use direct class/method calls for unit tests. Direct driver instantiation is valid in unit and
  in-process protocol tests; there is no page-object boundary to enforce here. [E12]

## Reuse Strategy

Follow this decision sequence:

1. Reuse an existing test fixture or constant.
2. Reuse a package-local helper.
3. Reuse a shared test-support package.
4. Extend an existing helper only when multiple tests need the extension and its abstraction remains
   coherent.
5. Create a test-local helper for repeated mechanics contained within one suite.
6. Create a new shared abstraction only with clear repeated demand and explicit user approval.

Preferred reusable categories:

- port and URL helpers from `@appium/driver-test-support`; [E6]
- `pluginE2EHarness` for plugin installation/server setup; [E13]
- FakeDriver and its fake app/capability fixtures for driver-facing E2E tests; [E9]
- `@appium/support` filesystem, environment, temporary-directory, and process utilities; [E8]
- package-local capability, fixture-resolution, CLI, mock, and session helpers; [E6]
- Sinon sandboxes for stubs, spies, and mocks in packages already using Sinon. [E14]

Do not add page objects, business flows, database helpers, authentication helpers, or custom wait
frameworks: no repository convention supports them. [E1]

## Test Generation Rules

### Common structure

- Import only the `node:test` hooks used by the file.
- Use `describe('<module or feature>', function () { ... })`.
- Name test cases with observable `should ...` behavior.
- Use nested `describe('when ...')` blocks when they clarify preconditions.
- Prefer `function ()` callbacks, matching the prevalent suite style. [E4]
- Keep arrange, act, and assertion close together; extract setup only when it is genuinely reused.
- Use loop-generated test cases when one behavior is validated against a meaningful input/output
  matrix; include descriptive generated names. [E15]

### Unit tests

- Instantiate the smallest real subject and mock only external or nondeterministic collaborators.
- Create a fresh Sinon sandbox in `beforeEach` and restore it in `afterEach`.
- Reset mutated caches, schemas, environment variables, and global state.
- Match the package's module mocking style:
  - use existing rewiremock helpers where the package already uses them;
  - use `mock.module()` plus dynamic import in ESM packages that follow that pattern.
  These approaches are area-specific and must not be mixed without evidence. [E16]

### E2E tests

- Reuse a shared server for a suite when neighboring tests do so.
- Create sessions at the scope used by the closest exemplar: plugin E2E commonly uses a new
  WebDriverIO session in `beforeEach`; composed FakeDriver suites may use a suite session. [E9] [E13]
- Allocate a free port through an existing helper. Never hard-code a test server port. [E6]
- Use `127.0.0.1` through the existing `TEST_HOST` export or local established constant. [E6]
- Use FakeDriver unless the requirement specifically concerns another boundary.
- Keep E2E tests independent of external Android/iOS devices and credentials unless the owning package
  already has an established, executable pattern.

### Type tests

- Use `tsd` and its existing assertions only in packages that already expose `test:types`.
- Test assignability/contracts, not runtime behavior. [E3]

## Test Data Rules

1. Reuse constants such as `BASE_CAPS`, `W3C_PREFIXED_CAPS`, and `W3C_CAPS` from the closest package
   helper where available. [E17]
2. New capabilities must use W3C structure; non-standard capabilities must use the `appium:` prefix.
   Do not default to JSONWP/MJSONWP or legacy multi-argument session APIs. [E17] [E18]
3. Store durable XML, image, JSON, YAML, package, or text samples in the owning package's
   `test/fixtures/` and resolve them relative to the package. [E19]
4. Use temporary directories for generated files and mutable state. Clean them after the test.
5. Do not hard-code credentials, tokens, user-specific absolute paths, or machine-specific ports.
6. Save and restore environment variables changed by a test, including deletion versus an undefined
   string value. [E20]
7. Add the minimum data needed to prove behavior. Do not copy large production-like datasets.

## Assertion and Validation Rules

- Use `assert.strictEqual`, `assert.deepStrictEqual`, `assert.ok`, and `assert.match` as appropriate.
- Use `await assert.rejects(...)` for asynchronous failures and `assert.throws(...)` for synchronous
  failures. Prefer error type/name plus a stable message regex when behavior requires both. [E4]
- Use `assert.doesNotReject` or `assert.doesNotThrow` only when non-failure is the behavior.
- Assert externally meaningful outcomes, status codes, protocol error fields, state changes, or
  collaborator calls—not implementation trivia.
- Avoid loose `assert.equal`, `.catch((err) => err)`, and try/catch followed by `assert.fail`; these
  occur inconsistently and are not defaults. [E21]
- Do not add logging merely to make a test pass. This repository relies on Node test output and CI,
  with no established Allure/JUnit-style reporting convention. [E22]

## Naming and Organization Rules

- Keep the test in the owning package.
- Mirror the source directory for unit tests.
- Keep shared test data in `test/fixtures/`.
- Keep package-wide test infrastructure in `test/helpers.ts` or `test/mocks.ts`.
- Keep one-suite mechanics local to the spec.
- For a large FakeDriver E2E area, follow the existing exported `xxxTests(context)` suite-composition
  pattern only when the parent already owns shared server context. [E23]
- There are no test tags or priority annotations. Categorization is by package, `unit`/`e2e`/type
  location, nested suites, and conditional skips. Do not invent tags. [E2] [E24]

## Framework Guardrails

- Do not add dependencies unless existing platform APIs and repository packages cannot express the
  test and the user approves the dependency.
- Do not modify production/shared framework code solely to accommodate one generated test.
- Do not duplicate free-port, URL, session, temp-directory, extension-install, or server-lifecycle
  helpers.
- Do not bypass `pluginE2EHarness` for a normal plugin E2E test.
- Do not use legacy unprefixed capabilities merely because relaxed-caps behavior supports them.
- Do not create real-device UI tests in this repository without direct evidence and explicit scope.
- Do not use arbitrary sleeps as a default synchronization strategy. Existing sleeps test timeout,
  queue, event, or race behavior; use them only when time itself is under test or a documented
  protocol/event boundary requires them. [E25]
- Do not add `.only`. Add a conditional skip only for a verified platform/runtime constraint and
  explain the condition in code. [E24]
- Do not assume retries exist. E2E package scripts run serially with `--test-concurrency=1`; fix
  isolation and determinism rather than masking failures. [E5]
- Follow the owning package's import-extension convention. ESM packages often use `.js` in relative
  imports while other packages use extensionless imports; do not normalize across packages. [E26]
- For every newly used Node.js built-in API or option, verify availability, stability, and compatible
  behavior across `^20.19.0 || ^22.12.0 || >=24.0.0`. Prefer an existing dependency or fallback when
  any supported runtime lacks a stable compatible API. [E29]

## Prohibited Behaviors

- Inventing repository APIs, helpers, page objects, services, tags, reporters, or architectural layers.
- Copying a similar test without reading the implementation under test.
- Starting servers or sessions without guaranteed teardown.
- Leaving temporary directories, local `APPIUM_HOME`, sockets, subprocesses, mocks, or environment
  mutations behind.
- Hard-coding ports, credentials, developer paths, or live external services.
- Converting a unit requirement into an expensive E2E test without evidence.
- Using skipped legacy tests as the primary exemplar.
- Expanding a test request into unrelated production refactoring.
- Claiming validation passed when commands were not run or were blocked.

## Validation Workflow

After generating the minimum code:

1. Re-read the diff against the primary exemplar and this skill.
2. Confirm imports, fixture paths, capability prefixes, and lifecycle cleanup.
3. Confirm no unsupported dependency, helper, tag, or abstraction was introduced.
4. Format and lint the changed test using the current Oxfmt/Oxlint repository commands. CI uses
   `npm run format:check` and `npm run lint:ci`; do not substitute stale Prettier guidance. [E30]
5. Build before executing tests because package test scripts target `build/test/**`. [E5]
6. Run the narrowest relevant test or package test command.
7. Run the owning package's applicable unit, E2E, or type-test script. In a valid checkout, workspace
   scoping follows `npm run <script> -w @appium/<package>`. [E31]
8. For broad/shared changes, run the relevant wider checks only after narrow checks pass.
9. Review failures for product defects, test defects, platform conditions, and leaked resources.
10. Report commands, outcomes, skips, and anything not run.

### Current repository-integrity gate

Before selecting root-level commands, compare root `package.json`, `package-lock.json`, and CI scripts.
In the analyzed checkout, the root manifest identifies `@appium/support` and lacks the workspace/build
scripts declared by the lockfile and used by CI. `packages/base-driver/lib/index.ts` also duplicates a
protocol route module rather than acting as the barrel expected by imports. Do not repair either issue
as part of test generation and do not claim root build validation is available. Report the mismatch
and ask whether to restore the checkout or proceed with a demonstrably valid package-scoped command.
[E27]

## Definition of Done

A generated test is complete only when:

- it proves the requested observable behavior at the correct layer;
- it follows the owning package's naming, imports, module style, and structure;
- it reuses existing helpers and fixtures;
- positive, negative, and cleanup behavior are covered as required by the scenario;
- all sessions, servers, subprocesses, sockets, files, mocks, and environment changes are cleaned up;
- assertions use `node:assert/strict` and are deterministic;
- no unrelated source or framework changes were made;
- applicable format, lint, build, and focused tests pass, or blockers are explicitly reported;
- ambiguity and skipped validation are visible in the final response.

## Handling Uncertainty

When evidence is insufficient:

1. Search another same-layer implementation and its source.
2. Compare prevalence and package/module-system compatibility.
3. Prefer the narrowest established local pattern.
4. State the competing patterns and their evidence.
5. Ask a focused question if the choice changes architecture, dependencies, execution cost, or public
   behavior.

Never resolve uncertainty by inventing a convention.

## Escalation Rules

Stop and ask before:

- creating a new shared test framework abstraction;
- adding a dependency;
- modifying production code only to enable a test;
- requiring a real device, cloud provider, secret, or external service;
- changing CI, package scripts, concurrency, retries, or reporting;
- choosing between incompatible current patterns with no clear local precedent;
- proceeding when repository-integrity issues prevent trustworthy build/test validation.

## Evidence Map

- [E1] `README.md:33-39,94-103`; absence confirmed across `packages/**`.
- [E2] `packages/*/test/unit/**`, `packages/*/test/e2e/**`; `.github/workflows/build.yml:8-40`.
- [E3] `packages/base-driver/package.json:42-46,68-70`; `packages/types/test-d/plugin.test.ts:1-61`.
- [E4] Representative specs, including `packages/appium/test/unit/helpers/capability.spec.ts:1-17`
  and `packages/appium/test/e2e/driver.e2e.spec.ts:1-22`.
- [E5] `packages/appium/package.json:62-65`; `packages/base-driver/package.json:42-46`;
  `packages/images-plugin/package.json:46-50`.
- [E6] `packages/driver-test-support/lib/index.ts:1`;
  `packages/base-driver/test/helpers.ts:1-35`; `packages/appium/test/helpers.ts:38-87`.
- [E7] `packages/base-driver/test/unit/**`, `packages/base-driver/test/e2e/**`,
  `packages/appium/test/e2e/**`.
- [E8] `packages/storage-plugin/test/unit/storage.spec.ts:16-39`;
  `packages/appium/test/e2e/driver.e2e.spec.ts:85-125`.
- [E9] `packages/fake-driver/test/helpers.ts:27-45`;
  `packages/fake-driver/test/e2e/element-interaction.e2e.spec.ts:6-24`.
- [E10] `packages/base-driver/test/e2e/protocol/protocol.e2e.spec.ts:35-88`.
- [E11] `packages/appium/test/e2e/e2e-helpers.ts:77-113`.
- [E12] `packages/fake-driver/test/unit/driver.spec.ts:11-32`;
  `packages/base-driver/test/e2e/protocol/protocol.e2e.spec.ts:28-51`.
- [E13] `packages/plugin-test-support/lib/harness.ts:24-145`;
  `packages/images-plugin/test/e2e/plugin.e2e.spec.ts:37-70`.
- [E14] `packages/appium/test/unit/appiumdriver.spec.ts:38-67`.
- [E15] `packages/base-driver/test/unit/protocol/errors.spec.ts:21-238`.
- [E16] `packages/support/test/unit/env.spec.ts:24-40`;
  `packages/images-plugin/test/unit/finder.spec.ts`.
- [E17] `packages/fake-driver/test/helpers.ts:10-25`;
  `packages/appium/test/helpers.ts:24-36`.
- [E18] `packages/appium/test/unit/helpers/capability.spec.ts:91-173`;
  `packages/appium/test/e2e/driver.e2e.spec.ts:377-467`.
- [E19] `packages/appium/test/fixtures/**`; `packages/universal-xml-plugin/test/fixtures/index.ts`.
- [E20] `packages/support/test/unit/env.spec.ts:24-39,314-317`.
- [E21] Prevalent strict/error assertions in [E4]; inconsistent examples in
  `packages/universal-xml-plugin/test/unit/xpath.spec.ts` and skipped FakeDriver alert tests.
- [E22] `.github/workflows/build.yml:121-199`; no external reporter configuration found.
- [E23] `packages/fake-driver/test/e2e/driver.e2e.spec.ts:23-27`;
  `packages/fake-driver/test/e2e/element-interaction.e2e.spec.ts:6-15`.
- [E24] conditional skips in `packages/appium/test/e2e/cli-driver.e2e.spec.ts:107-110,225-228`;
  no tag framework found.
- [E25] timing-specific sleeps in `packages/fake-driver/test/unit/driver.spec.ts:72-130` and
  `packages/appium/test/e2e/driver.e2e.spec.ts:347-375`.
- [E26] `packages/images-plugin/package.json:33-41` and its `.js` relative imports versus
  `packages/appium/test/**` extensionless relative imports.
- [E27] root `package.json:1-45` versus `package-lock.json:1-61`,
  `.github/actions/setup-build/action.yml:74-77`, and duplicated
  `packages/base-driver/lib/index.ts:1-95`.
- [E28] `.claude/CLAUDE.md:1-9`; `.cursor/mcp.json`; repository `.codegraph/`.
- [E29] `.github/copilot-instructions.md:1-9`; `package-lock.json:58-61`.
- [E30] `.github/workflows/build.yml:185-199`; `oxlint.config.mjs`; `oxfmt.config.mjs`.
- [E31] `packages/appium/docs/en/contributing/index.md:66-104`.
