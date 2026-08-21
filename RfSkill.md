---
name: robot-framework-test-generation
description: Generates or updates tests for the Robot Framework core repository while following its acceptance, unit, and web-test architecture. Use when implementing a new Robot Framework test scenario, regression test, test fixture, or test-only requirement in this repository.
---

# Automation Test Generation Skill

## Purpose

Create the smallest maintainable test change for the Robot Framework core repository by following established local patterns. This repository tests the framework itself; it is not a product UI/API automation suite. Do not invent page objects, browser abstractions, product API clients, authentication helpers, database helpers, or business-flow layers that are not present. [E1][E2]

Apply this mandatory sequence:

**SEARCH → UNDERSTAND → REUSE → EXTEND → CREATE**

Creating a shared helper, resource, library, fixture, or framework abstraction is the last option.

## When to Use This Skill

Use this skill when asked to:

- add or update Robot Framework core acceptance tests;
- add or update Python unit tests;
- add or update Libdoc TypeScript/Jest tests;
- create testdata, mocks, listeners, variable files, or other fixtures needed by those tests;
- add a regression test for a Robot Framework issue.

Do not use it to assume this repository contains an external application's UI, API, credentials, sessions, or database. If a requirement targets such a system, stop and clarify the intended repository and architecture. [E1]

## Framework Principles

1. Prefer an acceptance test for user-visible Robot Framework behavior; use a unit test when focused internal logic is best verified directly. Some changes legitimately require both. The repository is intentionally acceptance-heavy, so do not choose solely by conventional test-pyramid advice. [E3][E4]
2. Preserve the two-sided acceptance architecture:
   - `atest/testdata/` contains the feature scenarios executed by Robot Framework.
   - `atest/robot/` contains execution-side tests that run those scenarios and inspect their results. [E5]
3. Keep Python unit tests under the matching `utest/<area>/` package and use the repository's `unittest` infrastructure. [E6]
4. Treat web tests as area-specific: current Libdoc TypeScript tests use Jest under `src/web`; old HTML-report JavaScript specs under `utest/webcontent` use a legacy Jasmine runner. Do not copy Jasmine into new `src/web` work. [E7][E8]
5. Make tests deterministic, isolated, and explicit about platform or optional-dependency constraints. [E9][E10]

## Mandatory Pre-Generation Analysis

Before editing:

1. Restate the observable behavior, expected result, negative cases, and affected subsystem.
2. Decide which layer is supported by evidence:
   - acceptance;
   - Python unit;
   - web/Jest;
   - more than one layer.
3. Inspect the production implementation and its public/internal boundary.
4. Inspect at least two nearby tests and one shared helper/resource they use.
5. For acceptance work, inspect both the execution-side file and corresponding testdata.
6. Identify setup, cleanup, output files, environment variables, tags, and optional dependencies.
7. Record unresolved ambiguity. Do not generate code until the placement and reuse strategy are justified.

## Repository Search Strategy

Search in this order:

1. Exact feature, keyword, option, error text, class, or API name across `atest/robot`, `atest/testdata`, and `utest`.
2. The matching subsystem directories, preserving paths such as `parsing`, `running`, `variables`, `output`, `cli`, `rebot`, or `standard_libraries`.
3. Shared acceptance infrastructure:
   - `atest/resources/atest_resource.robot`;
   - `atest/resources/TestCheckerLibrary.py`;
   - nearby `*_resource.robot` files;
   - `atest/testresources/` mocks, listeners, libraries, and resource/variable files. [E11][E12]
4. Shared unit infrastructure:
   - `utest/resources/`;
   - subsystem-specific helper modules such as `utest/parsing/parsing_test_utils.py`;
   - `robot.utils.asserts`. [E13][E14]
5. History/current naming signals in adjacent tests. Prefer currently discoverable, prevalent patterns over isolated anomalies.

Never infer a convention from a filename alone; open representative implementations and verify how they are used.

## Similar-Test Selection Strategy

Rank candidate examples by:

1. same subsystem and behavior;
2. same test layer and runner;
3. same positive/negative result shape;
4. same fixture and cleanup needs;
5. same platform/dependency constraints;
6. recency and prevalence.

Classify discovered patterns:

- **A — consistent:** safe default across the relevant layer;
- **B — area-specific:** use only inside the same subsystem;
- **C — legacy/inconsistent:** do not promote without explicit justification.

Known C patterns include `_test_*.py` files that are not discovered by the standard unit runner, mixed assertion styles where repository helpers suffice, and legacy Jasmine patterns for new `src/web` tests. [E6][E8][E15]

## Reuse Strategy

### Acceptance tests

Reuse, in order:

1. `Run Tests`, `Run Tests Without Processing Output`, `Run Rebot`, and existing environment setup from `atest_resource.robot`; do not recreate subprocess orchestration. [E11]
2. `Check Test Case`, `Check Test Suite`, `Check Log Message`, output/file assertions, and parsed `${SUITE}` result objects. [E11][E12]
3. A nearby area resource such as a CLI or Rebot resource.
4. Existing data files, mock libraries, listeners, and variable/resource fixtures under `atest/testresources/`.
5. File-local user keywords when logic is used only in one suite.
6. A new shared resource or Python test library only after proving no suitable extension point exists.

When testdata and execution tests map one-to-one, consider `atest/genrunner.py` instead of hand-writing boilerplate. Its input must remain under `atest/testdata`. [E16]

### Python unit tests

Reuse, in order:

1. nearby test classes and subsystem helpers;
2. `robot.utils.asserts`;
3. `RunningTestCase` when invoking `run`/`rebot` or when stream capture and output cleanup are required;
4. existing mocks and fixtures;
5. a private test method or module-local helper for genuinely repeated local logic. [E13][E14]

Do not add a production abstraction solely to make one test convenient.

## Acceptance Test Generation Rules

1. Place behavior-driving scenarios under the corresponding `atest/testdata/<area>/` path and result verification under `atest/robot/<area>/`. [E5]
2. Use `Suite Setup    Run Tests ...` when one execution can serve multiple independent result checks. Use per-test `Run Tests` only when options, inputs, or isolation require separate execution. [E17][E18]
3. For straightforward one-to-one cases, let each execution-side test call `Check Test Case    ${TESTNAME}`. [E16]
4. Expected testdata outcomes default to PASS. Encode expected failures/skips in `[Documentation]` with `FAIL` or `SKIP`; use `REGEXP:`, `GLOB:`, or `STARTS:` only when exact matching is inappropriate. [E19][E20]
5. Assert behavior through parsed result objects and existing `Check *` keywords. Assert raw stdout, stderr, return codes, files, or syslog only when those outputs are the behavior under test. [E11][E12]
6. Use `[Template]`/`Test Template` for multiple cases sharing the same action and assertion shape; do not force unrelated scenarios into a table.
7. Use test or suite setup/teardown for external state, and clean temporary files or environment mutations even on failure. [E18]
8. Use `${OUTDIR}`, `${OUTFILE}`, `${TEMPDIR}`, `${DATADIR}`, and existing path variables instead of fixed machine paths. [E11][E21]
9. Add only supported execution tags: `manual`, `telnet`, `no-ci`, `require-*`, `no-*`, or `require-<platform/version>` according to actual preconditions. There is no P0/P1 priority convention. [E9]

## Python Unit Test Generation Rules

1. Name files `test_<feature>.py`; duplicate module basenames across `utest` directories are prohibited because discovery rejects them. [E6][E22]
2. Use `Test<Feature>` classes and `test_<behavior>` methods following nearby modules.
3. Import and call the code under test directly.
4. Prefer `robot.utils.asserts` functions used by neighboring tests, especially `assert_equal`, `assert_true`, `assert_raises`, and `assert_raises_with_msg`. Verify exception messages when message behavior matters. [E14]
5. Use `RunningTestCase` only when its stream capture and cleanup behavior is relevant. Declare generated output patterns in `remove_files` or provide equivalent reliable teardown. [E13]
6. Keep constants and tiny helpers module-local; use private class methods when they depend on class fixtures/state.
7. Do not copy manual `try/except/else` assertion patterns when an existing assertion helper expresses the expectation.

## Test Data Rules

1. Reuse existing testdata and fixtures when extending the same behavior does not make them ambiguous.
2. Keep a fixture minimal: include only syntax and values needed to demonstrate the behavior.
3. Keep execution expectations on the execution side, except for the established status/message markers in testdata documentation. [E19][E20]
4. Use repository variable files and environment mechanisms; never embed machine-specific paths.
5. Create a mock library, listener, parser, or resource file only when the scenario tests that integration boundary and no existing fixture can represent it.
6. Do not add credentials or external service assumptions. This repository has no product authentication/session pattern. [E1]

## Assertion and Validation Rules

1. Assert the smallest stable contract that proves the requirement.
2. Prefer exact status, return code, message, model field, and output assertions when stable.
3. Use wildcard/regexp matching only for intentionally variable content such as paths, versions, or tracebacks.
4. Verify negative scenarios fail for the intended reason, not merely that an exception or nonzero status occurred.
5. Reuse domain-specific checks such as `assert_model`, `Check Test Case`, and `Check Log Message` before writing low-level comparisons. [E12][E23]
6. Do not add arbitrary sleeps or retry loops. Use retries only when retry behavior itself is under test or an existing framework helper explicitly models the required asynchronous behavior.

## Naming and Organization Rules

- Mirror the subsystem's existing directory and filename vocabulary.
- Keep acceptance execution and testdata paths aligned where the feature has a direct mapping. [E5]
- Use descriptive behavior names rather than issue numbers alone.
- Keep reusable acceptance keywords in an existing area resource; keep one-suite helpers in that suite's `*** Keywords ***` section.
- Follow Python formatting configured for Ruff, Black, and isort; the configured line length is 88 and the general target is Python 3.8. [E24][E25]

## Framework Guardrails

- Do not bypass the acceptance runner/resource pipeline by directly launching Robot when `Run Tests` or `Run Rebot` covers the scenario. [E11]
- Do not parse `output.xml`/JSON manually when `Process Output` and `TestCheckerLibrary` expose the needed result. [E11][E12]
- Do not hard-code output directories, interpreter paths, platform separators, or environment-specific values. [E10][E11][E21]
- Do not invent keywords, result-model attributes, helper APIs, tags, or command options. Confirm every API in source or an existing test.
- Do not introduce a new dependency for functionality already available in the standard library, Robot Framework libraries, or repository test helpers.
- Do not change shared test infrastructure or production code merely to accommodate one generated test unless the requirement explicitly includes that change.
- Do not turn area-specific conventions into global rules.
- Do not copy intentionally invalid syntax from `atest/testdata` into execution-side tests without understanding that it is data under test.
- Do not assume acceptance suites are safe to run in process-level parallel. No integrated parallel runner is configured; CI parallelism is by OS/interpreter matrix. [E26]

## Prohibited Behaviors

- Generating product UI/API automation in this repository without evidence of the product layer.
- Creating page objects, drivers, API clients, auth/session managers, database helpers, or business flows speculatively.
- Creating duplicate helpers before repository-wide search.
- Using `_test_*.py` for a new discoverable unit test. [E6]
- Adding unconditional `no-ci` or dependency/platform tags to hide an unstable test.
- Weakening assertions, swallowing errors, or adding broad exception handling to make a test pass.
- Coupling otherwise independent tests through execution order or shared mutable state.
- Modifying unrelated framework code during a test-only request.

## Validation Workflow

Run from the repository root and scale validation to the changed layer:

1. Review the diff: only requirement-related tests/fixtures should have changed.
2. Run the narrowest relevant test:
   - unit directory: `python utest/run.py <directory>`;
   - acceptance suite: `python atest/run.py atest/robot/<area>/<suite>.robot`;
   - web: from `src/web`, `npm run test`. [E27][E28][E29]
3. Run the relevant broader layer when practical:
   - `python utest/run.py -v`;
   - `python atest/run.py`;
   - `npm run test`. [E27][E28][E29]
4. If output XML/JSON schema behavior is affected, run acceptance tests with `--schema-validation`. [E30]
5. For changed Python, run the repository formatter/linter workflow (`invoke format`, optionally targeted as supported by the task). Review formatter changes before proceeding. [E25]
6. Diagnose failures; do not weaken the expected behavior unless repository evidence proves the expectation was wrong.
7. Re-run affected validation until it passes. Report unavailable dependencies, unsupported platforms, or tests that were not run.

## Definition of Done

- Correct layer and location are justified by similar tests.
- Existing helpers and fixtures were reused where possible.
- Positive, negative, and boundary coverage matches the requirement without unrelated cases.
- Setup and cleanup leave no persistent state.
- Assertions prove the intended behavior and failure reason.
- Naming, tags, data, and structure match the selected subsystem.
- No unsupported architecture or dependency was introduced.
- Targeted validation passes; broader validation is run when practical.
- Remaining uncertainty and unexecuted checks are explicitly reported.

## Handling Uncertainty

When repository evidence is insufficient:

1. state exactly what is unknown;
2. list the competing patterns and evidence for each;
3. explain how the choice affects files, reuse, or validation;
4. ask one focused question if the choice is material;
5. do not invent a convention or silently choose a new architecture.

The acceptance-versus-unit choice is contextual in this repository. Prefer acceptance for user-visible framework behavior and unit tests for focused internal logic, but document the reason when nearby tests support both. [E3][E4]

## Escalation Rules

Stop and ask before:

- creating a new shared resource, Python test library, base class, or dependency;
- changing production code during a test-only request;
- choosing between materially different acceptance and unit designs with equal evidence;
- adding external infrastructure, services, credentials, or process-level parallel execution;
- changing CI, global runner defaults, schemas, or cross-platform behavior beyond the stated requirement.

## Evidence Index

- **[E1]** `setup.py:40-45,74-84`; repository searches found no product page/API/auth/database layers.
- **[E2]** `README.rst:10-13`.
- **[E3]** `utest/README.rst:7-17`.
- **[E4]** `CONTRIBUTING.rst:501-537`.
- **[E5]** `atest/README.rst:96-114`.
- **[E6]** `utest/README.rst:19-32`; `utest/run.py:41-70`.
- **[E7]** `src/web/package.json:4-18`; `.github/workflows/web_tests.yml:20-30`.
- **[E8]** `utest/webcontent/SpecRunner.html:5-8`.
- **[E9]** `atest/README.rst:116-146`.
- **[E10]** `atest/interpreter.py:58-72`; `atest/run.py:107-124`.
- **[E11]** `atest/resources/atest_resource.robot:13-90,171-329`.
- **[E12]** `atest/resources/TestCheckerLibrary.py:142-190,228-318,389-442`.
- **[E13]** `utest/resources/runningtestcase.py:9-71`.
- **[E14]** `src/robot/utils/asserts.py:16-26`; `utest/utils/test_asserts.py:3-7`.
- **[E15]** `utest/utils/test_asserts.py:37-76`.
- **[E16]** `atest/genrunner.py:13-23,58-81`; `atest/README.rst:41-47`.
- **[E17]** `atest/robot/core/test_suite_dir.robot:1-12`.
- **[E18]** `atest/robot/core/suite_setup_and_teardown.robot:14-31`.
- **[E19]** `atest/README.rst:105-114`.
- **[E20]** `atest/resources/TestCheckerLibrary.py:265-318,477-487`.
- **[E21]** `atest/resources/atest_variables.py:21-23`; `atest/run.py:69-90,111-119`.
- **[E22]** `utest/run.py:60-67`.
- **[E23]** `utest/parsing/parsing_test_utils.py:9-25`.
- **[E24]** `pyproject.toml:1-17,29-38`.
- **[E25]** `CONTRIBUTING.rst:133-175`; `tasks.py:75-101`.
- **[E26]** `.github/workflows/acceptance_tests_cpython.yml:15-32`; `doc/userguide/src/CreatingTestData/AdvancedFeatures.rst:218-227`.
- **[E27]** `utest/README.rst:19-33`; `.github/workflows/unit_tests.yml:40-43`.
- **[E28]** `atest/README.rst:49-94`; `atest/run.py:145-175`.
- **[E29]** `src/web/package.json:4-9`; `.github/workflows/web_tests.yml:28-30`.
- **[E30]** `atest/README.rst:207-228`; `atest/run.py:21-23,118-124`.
