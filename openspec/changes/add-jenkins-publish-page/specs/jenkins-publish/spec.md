## ADDED Requirements

### Requirement: Jenkins connection settings

The system SHALL provide four user-editable Jenkins connection settings persisted in `config.json`: `jenkinsBaseUrl`, `jenkinsUser`, `jenkinsToken`, and `jenkinsViewName`. The settings panel SHALL expose a dedicated "Jenkins 發布" section containing an input for each field. `jenkinsViewName` SHALL default to `方舟_Main_主任務`; the other three SHALL default to an empty string.

When loading a `config.json` that predates these fields, the system SHALL supply the default values without raising an error and the application SHALL start normally.

#### Scenario: Fresh install has no Jenkins credentials

- **WHEN** the application loads a `config.json` that contains no `jenkins*` keys
- **THEN** `jenkinsBaseUrl`, `jenkinsUser`, and `jenkinsToken` resolve to empty strings
- **AND** `jenkinsViewName` resolves to `方舟_Main_主任務`
- **AND** the application starts without error

#### Scenario: User saves Jenkins settings

- **WHEN** the user enters a Base URL, username, API token, and view name in the "Jenkins 發布" settings section and saves
- **THEN** the four values are written to `config.json`
- **AND** they are reloaded into the settings inputs on the next open

### Requirement: Publish view navigation

The system SHALL add a third primary navigation button labelled "發布" alongside the existing merge and commit buttons, toggling a `#publish-view` container. The view switcher SHALL persist `publish-view` as the last selected view so it is restored on next launch.

#### Scenario: Switching to the publish view

- **WHEN** the user clicks the "發布" navigation button
- **THEN** `#publish-view` becomes visible and the merge and commit views are hidden
- **AND** `publish-view` is stored as the last selected view

#### Scenario: Publish view restored on launch

- **WHEN** the application starts and the last selected view was `publish-view`
- **THEN** the publish view is shown on load

### Requirement: Gate publish view on configured credentials

When the publish view is opened and any of `jenkinsBaseUrl`, `jenkinsUser`, or `jenkinsToken` is empty, the system SHALL display a message prompting the user to configure Jenkins and a shortcut to the settings panel, and SHALL NOT issue any Jenkins HTTP request.

#### Scenario: Opening publish view without credentials

- **WHEN** the user opens the publish view and `jenkinsToken` is empty
- **THEN** a "請先在設定填寫 Jenkins 連線資訊" prompt is shown with a "前往設定" action
- **AND** no request is sent to Jenkins

### Requirement: List all jobs in the configured view

When credentials are configured, the system SHALL fetch the job list from the configured Jenkins view via `GET /view/<jenkinsViewName>/api/json` and render every returned job with its name and last-build status colour. The list SHALL NOT be cached; a "重新整理" action SHALL re-fetch it. Job and view names SHALL be URL-encoded when composing request URLs.

#### Scenario: View contains multiple jobs

- **WHEN** the publish view loads with valid credentials and the configured view contains jobs `發布方舟`, `發布方舟Plus`, `構建_方舟站點`, `重啟IIS`
- **THEN** all four jobs are listed with a status colour indicator

#### Scenario: Job added on Jenkins after initial load

- **WHEN** a new job is added to the view on Jenkins and the user clicks "重新整理"
- **THEN** the newly added job appears in the list

#### Scenario: Configured view does not exist

- **WHEN** the job list request returns HTTP 404
- **THEN** the system surfaces a `NOT_FOUND` error advising the user to check the configured view name
- **AND** no job list is rendered

### Requirement: Render a dynamic form from job parameter definitions

When the user selects a job, the system SHALL fetch its parameter definitions via `GET /job/<job>/api/json?tree=property[parameterDefinitions[name,type,description,defaultParameterValue[value],choices]]` and render one input control per parameter, mapped by parameter type. Each parameter's `description` SHALL be rendered as HTML above its control. A job with no parameter definitions SHALL show a "此 job 無參數，將直接觸發建置" notice and no form fields.

#### Scenario: Control type mapping

- **WHEN** a job exposes parameters of the listed Jenkins types
- **THEN** each is rendered with the mapped control and initial value

##### Example: parameter type to control

| Jenkins parameter type | Rendered control | Initial value source |
| --- | --- | --- |
| ChoiceParameterDefinition | select dropdown | `choices` list |
| BooleanParameterDefinition | checkbox | `defaultParameterValue.value` |
| StringParameterDefinition | single-line text input | `defaultParameterValue.value` |
| TextParameterDefinition | multi-line textarea | `defaultParameterValue.value` |
| any other type | single-line text input, labelled unsupported | empty string |

#### Scenario: Parameter description shown

- **WHEN** a parameter carries a `description` containing HTML markup
- **THEN** that markup is rendered as HTML directly above the parameter's control

#### Scenario: Job without parameters

- **WHEN** the selected job has no `parameterDefinitions`
- **THEN** the form shows "此 job 無參數，將直接觸發建置" and the trigger action targets `/job/<job>/build`

### Requirement: Trigger a parameterized build

When the user submits the form, the system SHALL obtain a CSRF crumb via `GET /crumbIssuer/api/json`, then `POST /job/<job>/buildWithParameters` with the collected parameter values and the crumb header, and SHALL read the queue item URL from the response `Location` header. If the crumb request fails, the system SHALL retry the POST once without a crumb header before reporting failure.

#### Scenario: Successful trigger

- **WHEN** the user submits a valid parameter form
- **THEN** the system fetches a crumb, posts to `buildWithParameters`, and captures the queue item URL from the `Location` header

#### Scenario: Crumb endpoint unavailable

- **WHEN** the crumb request fails
- **THEN** the system retries the build POST once without a crumb header
- **AND** reports `CRUMB_FAILED` only if that retry also fails

#### Scenario: Authentication rejected

- **WHEN** any Jenkins request returns HTTP 401 or 403
- **THEN** the system reports `AUTH_FAILED` with the message "Jenkins 認證失敗，請檢查使用者名稱與 API Token"
- **AND** no build is triggered

### Requirement: Poll build progress to completion

After a trigger, the system SHALL poll at a fixed 3-second interval: first the queue item via `GET <queueUrl>api/json` until an `executable.number` appears or the item is cancelled, then the build via `GET /job/<job>/<number>/api/json?tree=building,result,duration,timestamp` until `building` is `false`. The progress area SHALL display the current stage (排隊中, 建置中 #N, 成功, 失敗) and elapsed time. Polling SHALL stop when the publish view is left or a new build is triggered.

#### Scenario: Build runs to success

- **WHEN** a triggered build is queued, starts, and finishes with result `SUCCESS`
- **THEN** the progress area transitions 排隊中 → 建置中 #N → 成功
- **AND** the final state matches the Jenkins build history entry

#### Scenario: Build fails

- **WHEN** a triggered build finishes with result `FAILURE`
- **THEN** the progress area shows 失敗 for build #N

#### Scenario: Leaving the view stops polling

- **WHEN** the user switches away from the publish view while a build is in progress
- **THEN** the polling interval is cleared and no further Jenkins requests are made for that build

### Requirement: Show progressive console log

The system SHALL provide an expandable console log for the in-progress or completed build, fetched via `GET /job/<job>/<number>/logText/progressiveText?start=<offset>`, using the response `X-Text-Size` header as the next `start` offset and stopping when `X-More-Data` is not `true`.

#### Scenario: Expanding the console during a build

- **WHEN** the user expands the console log while the build is running
- **THEN** log text is appended incrementally as new output becomes available
- **AND** appending stops once `X-More-Data` is no longer `true`

### Requirement: Uniform Jenkins error reporting

All Jenkins service functions SHALL return `{ success: true, ... }` or `{ success: false, error }` where `error` is one of the codes `CONFIG_MISSING`, `AUTH_FAILED`, `NOT_FOUND`, `NETWORK_ERROR`, `CRUMB_FAILED`, or a raw message string. The renderer SHALL map each code to a Traditional Chinese toast message.

#### Scenario: Network failure

- **WHEN** a Jenkins request cannot connect or times out
- **THEN** the service returns `{ success: false, error: "NETWORK_ERROR" }`
- **AND** the renderer shows a Traditional Chinese toast describing the connection failure
